import { ipcMain, dialog, shell, clipboard, app } from 'electron'
import { getDefaultDownloadDir } from '../utils/platform'
import fs from 'node:fs'
import path from 'node:path'

function getLogPath(): string {
  return path.join(app.getPath('userData'), 'downvid.log')
}

export function registerSystemIpc() {
  ipcMain.handle('clipboard:readText', () => clipboard.readText())
  ipcMain.handle('clipboard:writeText', (_, text: string) => clipboard.writeText(text))

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: getDefaultDownloadDir(),
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('app:getDefaultDownloadDir', () => getDefaultDownloadDir())
  ipcMain.handle('shell:openPath', async (_, filePath: string) => shell.openPath(filePath))
  ipcMain.handle('shell:openExternal', async (_, url: string) => shell.openExternal(url))

  // 日志相关
  ipcMain.handle('app:getLog', async () => {
    try {
      const logPath = getLogPath()
      if (!fs.existsSync(logPath)) return { success: true, content: '', path: logPath }
      const content = fs.readFileSync(logPath, 'utf-8')
      // 只返回最后 500 行，避免日志过大
      const lines = content.split('\n')
      const tail = lines.slice(-500).join('\n')
      return { success: true, content: tail, path: logPath, totalLines: lines.length }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '读取日志失败' }
    }
  })

  ipcMain.handle('app:clearLog', async () => {
    try {
      const logPath = getLogPath()
      if (fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '', 'utf-8')
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '清空日志失败' }
    }
  })

  ipcMain.handle('app:openLogDir', async () => {
    try {
      const logPath = getLogPath()
      await shell.showItemInFolder(logPath)
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '打开日志目录失败' }
    }
  })

  ipcMain.handle('app:fetchImage', async (_, url: string, referer: string) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Referer': referer || 'https://www.bilibili.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      return `data:${contentType};base64,${base64}`
    } catch {
      return null
    }
  })
}
