import JavaScriptObfuscator from 'javascript-obfuscator'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  debugProtection: true,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsCount: 1,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1,
  transformObjectKeys: true,
  unicodeEscapeSequence: true,
  target: 'node'
}

const TARGET_FILES = ['main.js', 'preload.js']
const INTEGRITY_DIR = 'dist-electron'

function obfuscateFile(filePath: string): string {
  const code = fs.readFileSync(filePath, 'utf-8')
  const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS)
  const obfuscatedCode = result.getObfuscatedCode()
  fs.writeFileSync(filePath, obfuscatedCode, 'utf-8')
  console.log(`  Obfuscated: ${path.basename(filePath)} (${(code.length / 1024).toFixed(1)}KB -> ${(obfuscatedCode.length / 1024).toFixed(1)}KB)`)
  return obfuscatedCode
}

function generateIntegrityHashes(distDir: string): void {
  const hashes: Record<string, string> = {}

  for (const file of TARGET_FILES) {
    const filePath = path.join(distDir, file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath)
      hashes[file] = crypto.createHash('sha256').update(content).digest('hex')
    }
  }

  const integrityPath = path.join(distDir, '.integrity')
  const integrityData = JSON.stringify({
    algorithm: 'SHA256',
    files: hashes,
    generatedAt: new Date().toISOString()
  }, null, 2)

  fs.writeFileSync(integrityPath, integrityData, 'utf-8')
  console.log(`  Integrity hashes saved to .integrity`)

  const unpackedDir = path.join(distDir, '..', 'app.asar.unpacked')
  if (!fs.existsSync(unpackedDir)) {
    fs.mkdirSync(unpackedDir, { recursive: true })
  }
  fs.writeFileSync(path.join(unpackedDir, '.integrity'), JSON.stringify(hashes), 'utf-8')
  console.log(`  Integrity hashes copied to app.asar.unpacked/.integrity`)
}

function main() {
  const distDir = path.resolve(INTEGRITY_DIR)

  if (!fs.existsSync(distDir)) {
    console.error('dist-electron directory not found. Run vite build first.')
    process.exit(1)
  }

  console.log('=== NinjaSage Build Protection ===\n')
  console.log('Step 1: Obfuscating main process files...\n')

  for (const file of TARGET_FILES) {
    const filePath = path.join(distDir, file)
    if (fs.existsSync(filePath)) {
      obfuscateFile(filePath)
    } else {
      console.warn(`  Warning: ${file} not found, skipping`)
    }
  }

  console.log('\nStep 2: Generating integrity hashes...\n')
  generateIntegrityHashes(distDir)

  console.log('\n=== Protection complete! ===')
}

main()
