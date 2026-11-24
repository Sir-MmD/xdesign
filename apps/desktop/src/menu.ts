// The menus (docs/plan/18 section 9.2): Edit, View and Help with "About xDesign" (the version) and
// "Open data folder". On macOS the app menu comes first with "About xDesign" and "Quit xDesign", so
// Help has only "Open data folder" there.
import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'

import { appName } from './identity.ts'
import type { Log } from './log.ts'
import type { Paths } from './paths.ts'

function showAbout(): void {
  const options = {
    type: 'info' as const,
    title: `About ${appName}`,
    message: `${appName} ${app.getVersion()}`,
    buttons: ['OK'],
  }
  const window = BrowserWindow.getFocusedWindow()
  void (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options))
}

export function setMenu(paths: Paths, log: Log): void {
  const mac = process.platform === 'darwin'
  const about: MenuItemConstructorOptions = { label: `About ${appName}`, click: showAbout }
  const openData: MenuItemConstructorOptions = {
    label: 'Open data folder',
    click: () => {
      void shell.openPath(paths.userData).then((problem) => {
        if (problem !== '') {
          log.warn('the data folder did not open', { problem })
        }
      })
    },
  }
  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [about, { type: 'separator' }, { role: 'quit', label: `Quit ${appName}` }],
  }
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [appMenu] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { label: 'Help', role: 'help', submenu: mac ? [openData] : [about, openData] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
