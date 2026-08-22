import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { setMainWindow } from './store'
import { createMenu } from './menu'
import { setupAutoUpdater } from './updater'
import { registerAppIpc } from './ipc/app'
import { registerDownloadIpc } from './ipc/download'
import { registerHistoryIpc } from './ipc/history'
import { registerSystemIpc } from './ipc/system'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

function createWindow() {
  const iconPath = process.platform === 'darwin'
    ? path.join(process.env.APP_ROOT || '', 'ldstore.icns')
    : path.join(process.env.APP_ROOT || '', 'ldstore.ico')

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: process.platform !== 'darwin' ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  setMainWindow(win)

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// 注册所有 IPC 处理程序
registerAppIpc()
registerDownloadIpc()
registerHistoryIpc()
registerSystemIpc()

// App 生命周期
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  createMenu()
  setupAutoUpdater()

  setTimeout(() => {
    import('electron-updater').then(({ autoUpdater }) => {
      autoUpdater.checkForUpdates().catch(() => {})
    })
  }, 3000)
})
