import { ipcMain, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { GITHUB_OWNER, GITHUB_REPO } from '../constants'
import fs from 'node:fs'
import path from 'node:path'

// 贡献者内存缓存
let contributorsCache: any[] | null = null
let contributorsCacheTime = 0
const MEMORY_CACHE_TTL = 1000 * 60 * 30 // 内存缓存 30 分钟
const FILE_CACHE_TTL = 1000 * 60 * 60 * 24 * 7 // 文件缓存 7 天

// 本地缓存文件路径
function getContributorsCachePath() {
  return path.join(app.getPath('userData'), 'contributors.json')
}

// 读取本地文件缓存
function readFileCache(): { data: any[]; updatedAt: number } | null {
  try {
    const cachePath = getContributorsCachePath()
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8')
      const parsed = JSON.parse(content)
      if (parsed.data && Array.isArray(parsed.data)) {
        return { data: parsed.data, updatedAt: parsed.updatedAt || 0 }
      }
    }
  } catch {}
  return null
}

// 写入本地文件缓存
function writeFileCache(data: any[]) {
  try {
    const cachePath = getContributorsCachePath()
    fs.writeFileSync(cachePath, JSON.stringify({ data, updatedAt: Date.now() }, null, 2), 'utf-8')
  } catch {}
}

// 从 GitHub API 获取贡献者
async function fetchContributorsFromAPI(): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contributors?per_page=100`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DownVid-App',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()
  return data
    .filter((c: any) => c.type === 'User')
    .map((c: any) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      htmlUrl: c.html_url,
      contributions: c.contributions,
    }))
}

export function registerAppIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:getContributors', async () => {
    // 1. 命中内存缓存
    if (contributorsCache && Date.now() - contributorsCacheTime < MEMORY_CACHE_TTL) {
      return { success: true, data: contributorsCache, fromCache: true }
    }

    // 2. 读取本地文件缓存
    const fileCache = readFileCache()
    const fileCacheValid = fileCache && Date.now() - fileCache.updatedAt < FILE_CACHE_TTL

    // 如果文件缓存有效，先返回缓存，同时后台静默更新
    if (fileCacheValid && fileCache) {
      contributorsCache = fileCache.data
      contributorsCacheTime = fileCache.updatedAt

      // 后台静默更新（不阻塞返回）
      fetchContributorsFromAPI()
        .then((data) => {
          contributorsCache = data
          contributorsCacheTime = Date.now()
          writeFileCache(data)
        })
        .catch(() => {})

      return { success: true, data: fileCache.data, fromCache: true }
    }

    // 3. 调用 GitHub API
    try {
      const data = await fetchContributorsFromAPI()

      // 更新内存缓存和文件缓存
      contributorsCache = data
      contributorsCacheTime = Date.now()
      writeFileCache(data)

      return { success: true, data }
    } catch (error) {
      // API 失败但有本地缓存（即使过期了），返回本地缓存
      if (fileCache) {
        contributorsCache = fileCache.data
        contributorsCacheTime = fileCache.updatedAt
        return {
          success: true,
          data: fileCache.data,
          fromCache: true,
          warning: '无法连接 GitHub，显示缓存数据',
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '获取贡献者失败',
      }
    }
  })

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
