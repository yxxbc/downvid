import { BrowserWindow } from 'electron'

// 全局窗口引用
let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// 发送消息到渲染进程
export function sendToRenderer(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// 广播消息到所有窗口
export function broadcast(channel: string, data?: any) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  })
}

// 存储正在进行的下载任务
export const activeDownloads = new Map<string, any>()
