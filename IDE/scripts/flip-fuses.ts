import path from 'path'
import fs from 'fs'
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses'

async function main() {
  const releaseDir = path.resolve('release')
  const winDir = path.join(releaseDir, 'win-unpacked')

  if (!fs.existsSync(winDir)) {
    console.error('Release directory not found. Run electron-builder first.')
    process.exit(1)
  }

  const exeFiles = fs.readdirSync(winDir).filter(f => f.endsWith('.exe'))
  if (exeFiles.length === 0) {
    console.error('No .exe file found in win-unpacked.')
    process.exit(1)
  }

  const electronPath = path.join(winDir, exeFiles[0])
  console.log(`Found executable: ${exeFiles[0]}`)
  console.log('Flipping Electron fuses...\n')

  try {
    const result = await flipFuses(electronPath, {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    })

    console.log(`Fuses flipped successfully! (${result} bytes written)`)
    console.log('\nFuse configuration:')
    console.log('  RunAsNode:                                DISABLE')
    console.log('  EnableCookieEncryption:                   ENABLE')
    console.log('  EnableNodeOptionsEnvironmentVariable:     DISABLE')
    console.log('  EnableNodeCliInspectArguments:            DISABLE')
    console.log('  OnlyLoadAppFromAsar:                      DISABLE')
    console.log('  LoadBrowserProcessSpecificV8Snapshot:     DISABLE')
    console.log('  GrantFileProtocolExtraPrivileges:         DISABLE')
    console.log('\n✓ Fuses flipped. App is ready for distribution.')
  } catch (error) {
    console.error('Failed to flip fuses:')
    if (error instanceof Error) {
      console.error('  Error:', error.message)
      if (error.stack) {
        console.error('  Stack:', error.stack)
      }
    } else {
      console.error('  Unknown error:', error)
    }
    process.exit(1)
  }
}

main()
