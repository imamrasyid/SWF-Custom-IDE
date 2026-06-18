import path from 'path'
import fs from 'fs'
import { flipFuses, FuseVersion, FuseV1Options, FuseState } from '@electron/fuses'

async function main() {
  const releaseDir = path.resolve('release')
  const winDir = path.join(releaseDir, 'win-unpacked')

  if (!fs.existsSync(winDir)) {
    console.error('Release directory not found. Run electron-builder first.')
    console.error(`Expected: ${winDir}`)
    process.exit(1)
  }

  const electronPath = path.join(winDir, 'NinjaSage Modding Toolkit.exe')
  if (!fs.existsSync(electronPath)) {
    console.error('Electron executable not found.')
    process.exit(1)
  }

  console.log('Flipping Electron fuses...\n')

  const result = await flipFuses(electronPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: FuseState.DISABLE,
    [FuseV1Options.EnableCookieEncryption]: FuseState.ENABLE,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: FuseState.DISABLE,
    [FuseV1Options.EnableNodeCliInspectArguments]: FuseState.DISABLE,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: FuseState.ENABLE,
    [FuseV1Options.OnlyLoadAppFromAsar]: FuseState.ENABLE,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: FuseState.DISABLE,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: FuseState.DISABLE,
  })

  console.log(`Fuses flipped successfully! (${result} bytes written)`)
  console.log('\nFuse configuration:')
  console.log('  RunAsNode:                          DISABLE')
  console.log('  EnableCookieEncryption:             ENABLE')
  console.log('  EnableNodeOptionsEnvironmentVariable: DISABLE')
  console.log('  EnableNodeCliInspectArguments:      DISABLE')
  console.log('  EnableEmbeddedAsarIntegrityValidation: ENABLE')
  console.log('  OnlyLoadAppFromAsar:                ENABLE')
  console.log('  LoadBrowserProcessSpecificV8Snapshot: DISABLE')
  console.log('  GrantFileProtocolExtraPrivileges:    DISABLE')
}

main().catch((err) => {
  console.error('Failed to flip fuses:', err)
  process.exit(1)
})
