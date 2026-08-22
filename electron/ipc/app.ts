import { ipcMain, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { GITHUB_OWNER, GITHUB_REPO } from '../constants'
import { sendToRenderer } from '../store'

export function registerAppIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:checkForUpdates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result) {
        return {
          hasUpdate: result.updateInfo.version !== app.getVersion(),
          version: result.updateInfo.version,
          currentVersion: app.getVersion(),
          releaseNotes: result.updateInfo.releaseNotes || '',
          downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        }
      }
      return { hasUpdate: false, currentVersion: app.getVersion() }
    } catch (error) {
      return {
        hasUpdate: false,
        error: error instanceof Error ? error.message : '检查更新失败，请检查网络连接',
      }
    }
  })

  ipcMain.handle('app:downloadUpdate', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '下载更新失败' }
    }
  })

  ipcMain.handle('app:installUpdate', () => {
    autoUpdater.quitAndInstall()
  })
}
