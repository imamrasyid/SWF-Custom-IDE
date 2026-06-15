import { dialog } from 'electron'
import { getMainWindow } from './window'

export async function openSwf() {
  const result = await dialog.showOpenDialog(getMainWindow()!, {
    title: 'Open SWF File',
    filters: [
      { name: 'SWF Files', extensions: ['swf'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths.length > 0) {
    getMainWindow()?.webContents.send('swf-opened', result.filePaths[0])
  }
}
