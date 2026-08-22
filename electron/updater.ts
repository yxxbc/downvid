import { autoUpdater } from 'electron-updater'
import { getMainWindow } from './store'

export function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    getMainWindow()?.webContents.send('update:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    getMainWindow()?.webContents.send('update:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    getMainWindow()?.webContents.send('update:status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    getMainWindow()?.webContents.send('update:status', {
      status: 'downloading',
      percent: progress.percent,
      speed: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    getMainWindow()?.webContents.send('update:status', { status: 'downloaded' })
  })

  autoUpdater.on('error', (err) => {
    console.error('自动更新错误:', err)
    getMainWindow()?.webContents.send('update:status', { status: 'error', message: err.message })
  })
}
