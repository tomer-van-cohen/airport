import { app, Menu, BrowserWindow } from 'electron';

export function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Session',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:new-session');
          },
        },
        {
          label: 'Close Session',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:close-session');
          },
        },
        { type: 'separator' },
        {
          label: 'Jump to Next Waiting',
          accelerator: 'CmdOrCtrl+J',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:jump-waiting');
          },
        },
        { type: 'separator' },
        {
          label: 'Next Session',
          accelerator: 'CmdOrCtrl+]',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:next-session');
          },
        },
        {
          label: 'Previous Session',
          accelerator: 'CmdOrCtrl+[',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:prev-session');
          },
        },
        {
          label: 'Next Session',
          accelerator: 'CmdOrCtrl+Shift+]',
          visible: false,
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:next-session');
          },
        },
        {
          label: 'Previous Session',
          accelerator: 'CmdOrCtrl+Shift+[',
          visible: false,
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:prev-session');
          },
        },
        { type: 'separator' },
        {
          label: 'Clear Terminal',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:clear-terminal');
          },
        },
      ],
    },
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
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
