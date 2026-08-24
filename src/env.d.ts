/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    // 剪贴板
    clipboard: {
      readText: () => Promise<string>
      writeText: (text: string) => Promise<void>
    }
    dialog: {
      selectFolder: () => Promise<string | null>
      selectFile: () => Promise<string | null>
    }
    // 应用信息
    app: {
      getVersion: () => Promise<string>
      getContributors: () => Promise<{
        success: boolean
        data?: Array<{
          login: string
          avatarUrl: string
          htmlUrl: string
          contributions: number
          isBot: boolean
          isDeveloper: boolean
        }>
        error?: string
        fromCache?: boolean
        warning?: string
      }>
      getDefaultDownloadDir: () => Promise<string>
      fetchImage: (url: string, referer?: string) => Promise<string>
      getLog: () => Promise<{
        success: boolean
        content?: string
        path?: string
        totalLines?: number
        error?: string
      }>
      clearLog: () => Promise<{ success: boolean; error?: string }>
      openLogDir: () => Promise<{ success: boolean; error?: string }>
      setProxy: (proxy: string) => Promise<boolean>
      testProxy: (proxy: string) => Promise<{ success: boolean; latency?: number; error?: string }>
      getDiskSpace: (dir?: string) => Promise<{ free: number; total: number; unit: string }>
    }
    shell: {
      openPath: (filePath: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
    }
    ytdlp: {
      parse: (url: string, cookiesFile?: string, proxy?: string) => Promise<any>
      download: (options: {
        url: string
        formatId: string
        outputDir: string
        filename?: string
        taskId: string
        directUrl?: string 
        cookiesFile?: string
        downloadMode?: 'video' | 'audio'
        audioTrack?: any
        subtitles?: string[]
        proxy?: string
        cacheFile?: string
      }) => Promise<any>
      pauseDownload: (taskId: string) => Promise<boolean>
    }
    onDownloadProgress: (callback: (data: any) => void) => () => void
    history: {
      get: () => Promise<any[]>
      add: (record: any) => Promise<boolean>
      delete: (id: string) => Promise<boolean>
      onUpdated: (callback: (history: any[]) => void) => () => void
    }
    // 更新检查
    checkForUpdates: () => Promise<{
      hasUpdate: boolean
      version?: string
      currentVersion?: string
      releaseNotes?: string
      releaseDate?: string
      downloadUrl?: string
      error?: string
    }>
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>
    installUpdate: () => Promise<void>
    onUpdateStatus: (callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
      version?: string
      releaseNotes?: string
      percent?: number
      speed?: number
      message?: string
    }) => void) => () => void
    // 菜单事件监听
    onMenuShowAbout: (callback: () => void) => () => void
    // 窗口控制
    window: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
    }
  }
}
