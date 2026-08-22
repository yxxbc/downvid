import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { setMainWindow } from './store'
import { createMenu } from './menu'
import { setupAutoUpdater } from './updater'
import { registerAppIpc } from './ipc/app'
import { registerDownloadIpc } from './ipc/download'
import { registerHistoryIpc } from './ipc/history'
import { registerSystemIpc } from './ipc/system'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 禁用 GPU 加速（避免某些机器上 GPU 崩溃）
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// 日志文件
const logFile = path.join(app.getPath('userData'), 'downvid.log')
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(logFile, line)
  console.log(line.trim())
}

log('=== DownVid 启动 ===')
log(`APP_ROOT: ${process.env.APP_ROOT}`)
log(`VITE_DEV_SERVER_URL: ${VITE_DEV_SERVER_URL || 'N/A'}`)
log(`Platform: ${process.platform} ${process.arch}`)

// 全局错误处理
process.on('uncaughtException', (err) => {
  log(`[FATAL] uncaughtException: ${err.message}\n${err.stack}`)
})

process.on('unhandledRejection', (reason) => {
  log(`[ERROR] unhandledRejection: ${reason}`)
})

function createWindow() {
  log('createWindow 开始')

  const iconPath = process.platform === 'darwin'
    ? path.join(process.env.APP_ROOT || '', 'ldstore.icns')
    : path.join(process.env.APP_ROOT || '', 'ldstore.ico')

  const preloadPath = path.join(__dirname, 'preload.mjs')
  log(`preload path: ${preloadPath}, exists: ${fs.existsSync(preloadPath)}`)

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: process.platform !== 'darwin' ? iconPath : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  })

  setMainWindow(win)

  win.webContents.on('did-finish-load', () => {
    log('webContents did-finish-load')
    win.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`webContents did-fail-load: ${code} ${desc}`)
  })

  // 渲染进程崩溃时不要退出整个应用
  win.webContents.on('render-process-gone', (_e, details) => {
    log(`render-process-gone: ${details.reason}`)
  })

  win.on('closed', () => {
    log('Window closed')
  })

  if (VITE_DEV_SERVER_URL) {
    log(`Loading URL: ${VITE_DEV_SERVER_URL}`)
    win.loadURL(VITE_DEV_SERVER_URL).catch((err) => {
      log(`loadURL error: ${err.message}`)
    })
  } else {
    const indexPath = path.join(RENDERER_DIST, 'index.html')
    log(`Loading file: ${indexPath}, exists: ${fs.existsSync(indexPath)}`)
    win.loadFile(indexPath).catch((err) => {
      log(`loadFile error: ${err.message}`)
    })
  }

  log('createWindow 完成')
}

// 注册所有 IPC 处理程序
registerAppIpc()
registerDownloadIpc()
registerHistoryIpc()
registerSystemIpc()
log('IPC handlers registered')

// App 生命周期
app.on('window-all-closed', () => {
  log('window-all-closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  log('activate')
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  log('before-quit')
})

app.on('will-quit', () => {
  log('will-quit')
})

app.whenReady().then(() => {
  log('app.whenReady')
  createWindow()
  createMenu()
  setupAutoUpdater()
  log('Menu and updater initialized')

  setTimeout(() => {
    import('electron-updater').then(({ autoUpdater }) => {
      log('Checking for updates...')
      autoUpdater.checkForUpdates().catch((err) => {
        log(`Update check error: ${err.message}`)
      })
    })
  }, 3000)
})
