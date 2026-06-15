import { Menu } from 'electron'
import { getMainWindow } from './window'
import { openSwf } from './swf-open'

export function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open SWF...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openSwf()
        },
        { type: 'separator' },
        {
          label: 'Build SWF...',
          accelerator: 'CmdOrCtrl+B',
          click: () => getMainWindow()?.webContents.send('menu-action', 'build')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' }
      ]
    },
    {
      label: 'SWF',
      submenu: [
        { label: 'Export All Scripts...', click: () => getMainWindow()?.webContents.send('menu-action', 'export-scripts') },
        { label: 'Export All Assets...', click: () => getMainWindow()?.webContents.send('menu-action', 'export-assets') },
        { type: 'separator' },
        { label: 'Enable Debugging', click: () => getMainWindow()?.webContents.send('menu-action', 'enable-debug') },
        { label: 'Compress', click: () => getMainWindow()?.webContents.send('menu-action', 'compress') },
        { type: 'separator' },
        { label: 'Panel Studio', click: () => getMainWindow()?.webContents.send('menu-action', 'panel-studio') }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Game Data Editor', click: () => getMainWindow()?.webContents.send('menu-action', 'game-data-editor') },
        { label: 'AMF Service Builder', click: () => getMainWindow()?.webContents.send('menu-action', 'amf-builder') },
        { label: 'Text Localizer', click: () => getMainWindow()?.webContents.send('menu-action', 'text-localizer') },
        { label: 'Mission Editor', click: () => getMainWindow()?.webContents.send('menu-action', 'mission-editor') },
        { label: 'Sound Studio', click: () => getMainWindow()?.webContents.send('menu-action', 'sound-studio') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About', click: () => getMainWindow()?.webContents.send('menu-action', 'about') },
        { type: 'separator' },
        { label: 'ffdec-cli Help', click: () => getMainWindow()?.webContents.send('menu-action', 'ffdec-help') }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
