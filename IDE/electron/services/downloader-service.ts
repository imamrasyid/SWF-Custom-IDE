import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import crypto from 'crypto'
import { exec } from 'child_process'
import { app, WebContents } from 'electron'

export type DownloadProgress = {
  file: string
  percent: number
  downloadedBytes: number
  totalBytes: number
  speed: string // e.g. "2.4 MB/s"
  status: 'downloading' | 'verifying' | 'extracting' | 'completed' | 'error' | 'paused'
  error?: string
}

let activeRequest: http.ClientRequest | null = null
let isPaused = false

// Cancel/Pause active download
export function cancelDownload() {
  if (activeRequest) {
    isPaused = true
    activeRequest.destroy()
    activeRequest = null
  }
}

// Check disk space (requires Node 18.9.0+)
export async function getFreeDiskSpace(targetPath: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      if (typeof fs.statfs === 'function') {
        fs.statfs(targetPath, (err, stats) => {
          if (err) {
            resolve(Number.MAX_SAFE_INTEGER) // fallback on error
          } else {
            resolve(stats.bavail * stats.bsize)
          }
        });
      } else {
        resolve(Number.MAX_SAFE_INTEGER)
      }
    } catch {
      resolve(Number.MAX_SAFE_INTEGER)
    }
  })
}

// Download file with redirect handling, HTTP Range resume support, and SHA-256 check
export function downloadFile(
  url: string,
  destPath: string,
  fileName: string,
  webContents: WebContents,
  expectedHash?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDest = destPath + '.tmp'
    isPaused = false
    
    let totalBytes = 0
    let downloadedBytes = 0
    let lastTime = Date.now()
    let lastBytes = 0

    function reportProgress(percent: number, speed: string, status: DownloadProgress['status'], error?: string) {
      const payload: DownloadProgress = {
        file: fileName,
        percent,
        downloadedBytes,
        totalBytes,
        speed,
        status,
        error
      }
      webContents.send('downloader:progress', payload)
    }

    function makeRequest(requestUrl: string) {
      if (isPaused) {
        reject(new Error('Download paused by user'))
        return
      }

      // Check if partially downloaded file exists for Range Resume
      let existingSize = 0
      try {
        if (fs.existsSync(tempDest)) {
          existingSize = fs.statSync(tempDest).size
        }
      } catch {}

      const headers: Record<string, string> = {}
      if (existingSize > 0) {
        headers['Range'] = `bytes=${existingSize}-`
        console.log(`[Downloader] Requesting range bytes=${existingSize}- for ${fileName}`)
      }

      const client = requestUrl.startsWith('https') ? https : http
      const options: https.RequestOptions = {
        method: 'GET',
        headers
      }

      const req = client.request(requestUrl, options, (res) => {
        // Handle Redirects
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          makeRequest(res.headers.location)
          return
        }

        // Support for Range downloads (206 Partial Content)
        const isPartial = res.statusCode === 206
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          reject(new Error(`Failed to download. Status code: ${res.statusCode}`))
          return
        }

        const contentLength = parseInt(res.headers['content-length'] || '0', 10)
        if (isPartial) {
          downloadedBytes = existingSize
          totalBytes = contentLength + existingSize
        } else {
          downloadedBytes = 0
          totalBytes = contentLength
          // Truncate/reset temp file if not doing a partial range download
          try { if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest) } catch {}
        }

        // Open in append ('a') or overwrite ('w') mode depending on partial download
        const fileStream = fs.createWriteStream(tempDest, { flags: isPartial ? 'a' : 'w' })
        
        res.on('data', (chunk) => {
          downloadedBytes += chunk.length
          fileStream.write(chunk)

          // Calculate speed every 500ms
          const now = Date.now()
          if (now - lastTime > 500) {
            const timeDiff = (now - lastTime) / 1000 // in seconds
            const bytesDiff = downloadedBytes - lastBytes
            const speedBytesPerSec = bytesDiff / timeDiff
            let speedStr = ''
            if (speedBytesPerSec > 1024 * 1024) {
              speedStr = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
            } else if (speedBytesPerSec > 1024) {
              speedStr = `${(speedBytesPerSec / 1024).toFixed(0)} KB/s`
            } else {
              speedStr = `${speedBytesPerSec.toFixed(0)} B/s`
            }
            
            const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0
            reportProgress(percent, speedStr, 'downloading')
            
            lastTime = now
            lastBytes = downloadedBytes
          }
        })

        res.on('end', () => {
          fileStream.end()
        })

        fileStream.on('finish', () => {
          if (isPaused) {
            reject(new Error('Download paused by user'))
            return
          }

          reportProgress(99, '0 B/s', 'verifying')

          // Calculate checksum of completed file
          if (expectedHash) {
            const sha256Hash = crypto.createHash('sha256')
            const readerStream = fs.createReadStream(tempDest)
            
            readerStream.on('data', (c) => sha256Hash.update(c))
            readerStream.on('end', () => {
              const fileHash = sha256Hash.digest('hex')
              if (fileHash !== expectedHash.toLowerCase()) {
                fs.unlink(tempDest, () => {})
                reject(new Error(`SHA-256 hash mismatch. File might be corrupted.`))
              } else {
                finalizeRename()
              }
            })
            readerStream.on('error', (err) => reject(err))
          } else {
            finalizeRename()
          }

          function finalizeRename() {
            fs.rename(tempDest, destPath, (err) => {
              if (err) {
                reject(err)
              } else {
                resolve(destPath)
              }
            })
          }
        })

        fileStream.on('error', (err) => {
          fileStream.close()
          reject(err)
        })
      })

      req.on('error', (err) => {
        reject(err)
      })

      activeRequest = req
      req.end()
    }

    makeRequest(url)
  })
}

// Extract zip using native tar on Windows
export function extractZip(zipPath: string, destDir: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true })
    
    // Command on Windows using native tar.exe (available in Win10+)
    const cmd = `tar -xf "${zipPath}" -C "${destDir}"`
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
        resolve(true)
      }
    })
  })
}
