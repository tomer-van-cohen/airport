import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { PtyManager } from './pty-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { setupMenu } from './menu';
import { IPC } from '../shared/ipc-channels';
import { startHookWatcher } from './hook-watcher';

if (started) {
  app.quit();
}

const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
app.setName(isDev ? 'Airport Dev' : 'Airport');
if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Airport Dev'));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const ptyManager = new PtyManager();
  let mainWindow: BrowserWindow | null = null;
  let stateSaved = false;

  const createWindow = () => {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 500,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
      backgroundColor: '#000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Intercept window close to save state first
    mainWindow.on('close', (e) => {
      if (!stateSaved && mainWindow && !mainWindow.isDestroyed()) {
        e.preventDefault();
        mainWindow.webContents.send(IPC.STATE_REQUEST_SAVE);
        // Give the renderer time to save, then actually close
        setTimeout(() => {
          stateSaved = true;
          ptyManager.closeAll();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
          }
        }, 500);
      }
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.focus();
    });
  };

  registerIpcHandlers(ptyManager, () => mainWindow);
  const stopHookWatcher = startHookWatcher(ptyManager, () => mainWindow);

  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', () => {
    setupMenu();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      stateSaved = false;
      createWindow();
    }
  });

  app.on('before-quit', (e) => {
    if (!stateSaved && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.webContents.send(IPC.STATE_REQUEST_SAVE);
      setTimeout(() => {
        stateSaved = true;
        stopHookWatcher();
        ptyManager.closeAll();
        app.quit();
      }, 500);
    } else {
      stopHookWatcher();
      ptyManager.closeAll();
    }
  });
}
