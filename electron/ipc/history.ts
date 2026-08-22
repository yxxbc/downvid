import { ipcMain, BrowserWindow, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const historyFile = path.join(app.getPath('userData'), 'download-history.json')

function readHistory(): any[] {
  try {
    if (fs.existsSync(historyFile)) {
      return JSON.parse(fs.readFileSync(historyFile, 'utf8'))
    }
  } catch {}
  return []
}

function writeHistory(history: any[]) {
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2))
}

function notifyHistoryUpdated(history: any[]) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('history:updated', history)
  })
}

export function registerHistoryIpc() {
  ipcMain.handle('history:get', async () => readHistory())

  ipcMain.handle('history:add', async (_, record: any) => {
    const history = readHistory()
    const newRecord = { ...record, id: Date.now().toString(), createdAt: new Date().toISOString() }
    history.unshift(newRecord)
    writeHistory(history.slice(0, 100))
    notifyHistoryUpdated(readHistory())
    return true
  })

  ipcMain.handle('history:delete', async (_, id: string) => {
    const history = readHistory().filter((h: any) => h.id !== id)
    writeHistory(history)
    notifyHistoryUpdated(readHistory())
    return true
  })
}
