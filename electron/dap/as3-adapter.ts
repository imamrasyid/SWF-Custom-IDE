import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { getPortablePath } from '../services/config-service'

export interface DapRequest {
  seq: number
  type: 'request'
  command: string
  arguments?: any
}

export interface DapResponse {
  seq: number
  type: 'response'
  request_seq: number
  command: string
  success: boolean
  message?: string
  body?: any
}

export interface DapEvent {
  seq: number
  type: 'event'
  event: string
  body?: any
}

export interface Breakpoint {
  id: number
  file: string
  line: number
  verified: boolean
  condition?: string
}

export interface StackFrame {
  id: number
  name: string
  source?: { path: string; name: string }
  line: number
  column: number
}

export interface Variable {
  name: string
  value: string
  type: string
  variablesReference?: number
}

export class As3DapAdapter extends EventEmitter {
  private fdbProcess: ChildProcess | null = null
  private seq = 0
  private breakpoints: Map<number, Breakpoint> = new Map()
  private bpIdCounter = 1
  private outputBuffer = ''
  private isRunning = false
  private isPaused = false
  private currentFrame: StackFrame | null = null
  private pendingCommands: { command: string; resolve: (value: string) => void }[] = []
  private swfPath = ''
  private fdbPath = ''

  constructor() {
    super()
  }

  private getFdbPath(): string {
    const fdbExe = process.platform === 'win32' ? 'fdb.exe' : 'fdb'
    
    const embeddedFdb = getPortablePath(path.join('bin', 'flex-sdk', 'bin', fdbExe))
    if (embeddedFdb) return embeddedFdb
    
    return path.join('bin', 'flex-sdk', 'bin', fdbExe)
  }

  async initialize(args: { swfPath: string; sdkPath?: string }): Promise<void> {
    this.swfPath = args.swfPath
    this.fdbPath = this.getFdbPath()
    
    if (!fs.existsSync(this.fdbPath)) {
      throw new Error(`fdb not found at: ${this.fdbPath}`)
    }

    return new Promise((resolve, reject) => {
      try {
        this.fdbProcess = spawn(this.fdbPath, [this.swfPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env }
        })

        this.fdbProcess.stdout?.on('data', (data: Buffer) => {
          this.handleFdbOutput(data.toString())
        })

        this.fdbProcess.stderr?.on('data', (data: Buffer) => {
          console.error('[fdb stderr]', data.toString())
        })

        this.fdbProcess.on('close', (code) => {
          this.isRunning = false
          this.sendEvent('terminated', { restart: false })
        })

        this.fdbProcess.on('error', (err) => {
          reject(err)
        })

        // Wait for fdb prompt
        this.waitForPrompt().then(() => resolve()).catch(reject)
      } catch (err) {
        reject(err)
      }
    })
  }

  private waitForPrompt(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for fdb prompt'))
      }, timeout)

      const check = () => {
        if (this.outputBuffer.includes('(fdb)') || this.outputBuffer.includes('fdb)')) {
          clearTimeout(timer)
          this.outputBuffer = ''
          resolve()
        }
      }

      const interval = setInterval(check, 100)
      setTimeout(() => {
        clearInterval(interval)
        clearTimeout(timer)
        reject(new Error('Timeout'))
      }, timeout)
    })
  }

  private handleFdbOutput(data: string): void {
    this.outputBuffer += data

    // Check for breakpoints hit
    const bpMatch = this.outputBuffer.match(/Breakpoint (\d+), .+ at (.+):(\d+)/)
    if (bpMatch) {
      const bpNum = parseInt(bpMatch[1], 10)
      const file = bpMatch[2]
      const line = parseInt(bpMatch[3], 10)
      
      this.isPaused = true
      this.currentFrame = {
        id: 0,
        name: 'current',
        source: { path: file, name: path.basename(file) },
        line,
        column: 0
      }

      this.sendEvent('stopped', {
        reason: 'breakpoint',
        threadId: 1,
        text: `Breakpoint ${bpNum} hit`
      })
    }

    // Check for program pause (Ctrl+C or step)
    if (this.outputBuffer.includes('^C') || this.outputBuffer.match(/\r?\n\(fdb\)/)) {
      if (this.isRunning && !this.isPaused) {
        this.isPaused = true
        this.sendEvent('stopped', {
          reason: 'pause',
          threadId: 1
        })
      }
    }

    // Check for program end
    if (this.outputBuffer.includes('Normal termination') || this.outputBuffer.includes('Program exited')) {
      this.isRunning = false
      this.sendEvent('terminated', { restart: false })
    }

    // Resolve pending commands
    if (this.outputBuffer.includes('(fdb)') || this.outputBuffer.includes('fdb)')) {
      this.isPaused = true
      const pending = this.pendingCommands.shift()
      if (pending) {
        pending.resolve(this.outputBuffer)
      }
      this.outputBuffer = ''
    }
  }

  private sendFdbCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.fdbProcess?.stdin) {
        reject(new Error('fdb not running'))
        return
      }

      this.pendingCommands.push({ command, resolve })
      this.fdbProcess.stdin.write(command + '\n')

      // Timeout after 10 seconds
      setTimeout(() => {
        const idx = this.pendingCommands.findIndex(c => c.command === command)
        if (idx >= 0) {
          this.pendingCommands.splice(idx, 1)
          reject(new Error('Command timeout'))
        }
      }, 10000)
    })
  }

  private sendResponse(request_seq: number, command: string, success: boolean, body?: any, message?: string): void {
    const response: DapResponse = {
      seq: ++this.seq,
      type: 'response',
      request_seq,
      command,
      success,
      body,
      message
    }
    this.emit('response', response)
  }

  private sendEvent(event: string, body?: any): void {
    const dapEvent: DapEvent = {
      seq: ++this.seq,
      type: 'event',
      event,
      body
    }
    this.emit('event', dapEvent)
  }

  async handleRequest(request: DapRequest): Promise<void> {
    const { seq, command, arguments: args } = request

    try {
      switch (command) {
        case 'initialize':
          this.sendResponse(seq, command, true, {
            supportsConfigurationDoneRequest: true,
            supportsEvaluateForHovers: true,
            supportsStepBack: false,
            supportsSetVariable: false,
            supportsRestartFrame: false,
            supportsGotoTargetsRequest: false,
            supportsStepInTargetsRequest: false,
            supportsErrorHints: false,
            supportedChecksumFormats: [],
            exceptionBreakpointFilters: [],
            completionsTriggerCharacters: [],
            additionalModuleColumns: [],
            supportedSteppingGranularities: []
          })
          this.sendEvent('initialized')
          break

        case 'launch':
          await this.initialize({ swfPath: args?.program || this.swfPath })
          this.isRunning = true
          this.sendResponse(seq, command, true)
          // Auto-continue after launch
          await this.sendFdbCommand('run')
          break

        case 'setBreakpoints': {
          const source = args?.source?.path || ''
          const bps = args?.breakpoints || []
          
          // Clear existing breakpoints for this file
          for (const [id, bp] of this.breakpoints) {
            if (bp.file === source) {
              await this.sendFdbCommand(`clear ${bp.id}`)
              this.breakpoints.delete(id)
            }
          }

          const verifiedBps: any[] = []
          for (const bp of bps) {
            const id = this.bpIdCounter++
            const file = source
            const line = bp.line + 1 // DAP is 0-indexed, fdb is 1-indexed
            
            await this.sendFdbCommand(`break ${file}:${line}`)
            this.breakpoints.set(id, { id, file, line, verified: true, condition: bp.condition })
            verifiedBps.push({ id, verified: true, line: bp.line })
          }

          this.sendResponse(seq, command, true, { breakpoints: verifiedBps })
          break
        }

        case 'threads':
          this.sendResponse(seq, command, true, {
            threads: [{ id: 1, name: 'Main Thread' }]
          })
          break

        case 'stackTrace': {
          const whereOutput = await this.sendFdbCommand('where')
          const frames = this.parseStackTrace(whereOutput)
          this.sendResponse(seq, command, true, {
            stackFrames: frames,
            totalFrames: frames.length
          })
          break
        }

        case 'scopes': {
          const frameId = args?.frameId || 0
          this.sendResponse(seq, command, true, {
            scopes: [
              { name: 'Locals', variablesReference: 1, presentationHint: 'locals' },
              { name: 'Globals', variablesReference: 2, presentationHint: 'globals' }
            ]
          })
          break
        }

        case 'variables': {
          const ref = args?.variablesReference
          if (ref === 1) {
            // Locals
            const localsOutput = await this.sendFdbCommand('locals')
            const variables = this.parseVariables(localsOutput)
            this.sendResponse(seq, command, true, { variables })
          } else if (ref === 2) {
            // Globals - limited in fdb
            this.sendResponse(seq, command, true, { variables: [] })
          } else {
            this.sendResponse(seq, command, true, { variables: [] })
          }
          break
        }

        case 'continue':
          this.isPaused = false
          this.isRunning = true
          await this.sendFdbCommand('run')
          this.sendResponse(seq, command, true, { allThreadsContinued: true })
          break

        case 'next': // Step over
          await this.sendFdbCommand('next')
          this.sendResponse(seq, command, true)
          break

        case 'stepIn':
          await this.sendFdbCommand('step')
          this.sendResponse(seq, command, true)
          break

        case 'stepOut':
          await this.sendFdbCommand('finish')
          this.sendResponse(seq, command, true)
          break

        case 'pause':
          if (this.fdbProcess) {
            this.fdbProcess.kill('SIGINT')
            this.isPaused = true
            this.sendResponse(seq, command, true)
            this.sendEvent('stopped', { reason: 'pause', threadId: 1 })
          }
          break

        case 'evaluate': {
          const expression = args?.expression || ''
          const printOutput = await this.sendFdbCommand(`print ${expression}`)
          const value = this.parsePrintOutput(printOutput)
          this.sendResponse(seq, command, true, {
            result: value,
            type: 'string',
            presentationHint: { kind: 'data' }
          })
          break
        }

        case 'disconnect':
          await this.terminate()
          this.sendResponse(seq, command, true)
          break

        case 'terminate':
          await this.terminate()
          this.sendResponse(seq, command, true)
          break

        default:
          this.sendResponse(seq, command, false, undefined, `Unknown command: ${command}`)
      }
    } catch (err: any) {
      this.sendResponse(seq, command, false, undefined, err.message)
    }
  }

  private parseStackTrace(output: string): StackFrame[] {
    const frames: StackFrame[] = []
    const lines = output.split('\n')
    
    for (const line of lines) {
      const match = line.match(/#(\d+)\s+(.+)\s+at\s+(.+):(\d+)/)
      if (match) {
        frames.push({
          id: parseInt(match[1], 10),
          name: match[2].trim(),
          source: { path: match[3], name: path.basename(match[3]) },
          line: parseInt(match[4], 10),
          column: 0
        })
      }
    }

    // If no frames parsed, create a default one
    if (frames.length === 0 && this.currentFrame) {
      frames.push(this.currentFrame)
    }

    return frames
  }

  private parseVariables(output: string): Variable[] {
    const variables: Variable[] = []
    const lines = output.split('\n')
    
    for (const line of lines) {
      const match = line.match(/(\w+)\s*=\s*(.+)/)
      if (match) {
        variables.push({
          name: match[1].trim(),
          value: match[2].trim(),
          type: typeof match[2].trim()
        })
      }
    }

    return variables
  }

  private parsePrintOutput(output: string): string {
    const lines = output.split('\n')
    for (const line of lines) {
      if (line.includes('=') && !line.includes('(fdb)')) {
        const parts = line.split('=')
        if (parts.length >= 2) {
          return parts.slice(1).join('=').trim()
        }
      }
    }
    return output.trim()
  }

  async terminate(): Promise<void> {
    if (this.fdbProcess) {
      try {
        await this.sendFdbCommand('quit')
      } catch {}
      this.fdbProcess.kill()
      this.fdbProcess = null
      this.isRunning = false
      this.isPaused = false
    }
  }

  dispose(): void {
    this.terminate()
    this.removeAllListeners()
  }
}
