import { ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { getPortablePath } from '../services/config-service'

let adlProcess: ChildProcess | null = null

export function registerSimulatorIpc() {
  ipcMain.handle('simulator:runAdl', async (event, swfPath: string, sdkPath?: string): Promise<{ success: boolean; log: string }> => {
    if (adlProcess) {
      try { adlProcess.kill() } catch {}
      adlProcess = null
    }

    return new Promise((resolve) => {
      try {
        const swfDir = path.dirname(swfPath)
        const swfName = path.basename(swfPath)

        let resolvedSdkPath = sdkPath || ''
        const adlExeName = process.platform === 'win32' ? 'adl.exe' : 'adl'
        let adlPath = resolvedSdkPath ? path.join(resolvedSdkPath, 'bin', adlExeName) : ''

        if (!adlPath || !fs.existsSync(adlPath)) {
          const embeddedSdk = getPortablePath(path.join('bin', 'flex-sdk'))
          if (embeddedSdk) {
            const testAdl = path.join(embeddedSdk, 'bin', adlExeName)
            if (fs.existsSync(testAdl)) {
              resolvedSdkPath = embeddedSdk
              adlPath = testAdl
            }
          }
        }

        if (!adlPath || !fs.existsSync(adlPath)) {
          resolve({ success: false, log: `AIR Debug Launcher (adl) not found at: ${adlPath || 'configured path'}. Please configure a valid Flex/AIR SDK path.` })
          return
        }

        const tempDescPath = path.join(os.tmpdir(), 'ns-app-descriptor.xml')
        const xmlContent = `<?xml version="1.0" encoding="utf-8" ?>
<application xmlns="http://ns.adobe.com/air/application/51.3">
  <id>com.ninjasage.simulator</id>
  <versionNumber>1.0.0</versionNumber>
  <filename>NinjaSageSimulator</filename>
  <initialWindow>
    <content>${swfName}</content>
    <visible>true</visible>
    <width>1000</width>
    <height>600</height>
  </initialWindow>
</application>`
        fs.writeFileSync(tempDescPath, xmlContent, 'utf8')

        const env = { ...process.env }
        const jrePath = getPortablePath(path.join('bin', 'jre'))
        if (jrePath) {
          env.JAVA_HOME = jrePath
          const jreBin = path.join(jrePath, 'bin')
          if (process.platform === 'win32') {
            env.PATH = `${jreBin};${env.PATH || ''}`
          } else {
            env.PATH = `${jreBin}:${env.PATH || ''}`
          }
        }

        adlProcess = spawn(adlPath, [tempDescPath, swfDir], { env })

        const webContents = event.sender
        
        adlProcess.stdout?.on('data', (data) => {
          webContents.send('simulator:log', data.toString())
        })

        adlProcess.stderr?.on('data', (data) => {
          webContents.send('simulator:log', data.toString())
        })

        adlProcess.on('close', (code) => {
          webContents.send('simulator:log', `[ADL Process exited with code ${code}]`)
          adlProcess = null
        })

        adlProcess.on('error', (err) => {
          webContents.send('simulator:log', `[ADL Process error: ${err.message}]`)
          adlProcess = null
        })

        resolve({ success: true, log: `AIR Debug Launcher started successfully.` })
      } catch (err: any) {
        resolve({ success: false, log: `Failed to launch ADL: ${err.message}` })
      }
    })
  })

  ipcMain.handle('simulator:killAdl', async () => {
    if (adlProcess) {
      try { adlProcess.kill() } catch {}
      adlProcess = null
      return true
    }
    return false
  })
}
