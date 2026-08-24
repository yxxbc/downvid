# AGENTS.md — DownVid 开发速查

## 快速开始

```bash
pnpm install
pnpm download-deps          # 首次运行必须：下载 yt-dlp + ffmpeg 到 bin/<platform>/<arch>/
pnpm dev                    # Vite dev server + Electron 热重载
```

## 验证命令

```bash
pnpm vue-tsc --noEmit       # 类型检查（唯一 lint，CI 也跑这个）
pnpm build                  # vue-tsc + vite build + electron-builder（当前平台）
```

没有 ESLint、Prettier、测试套件。（CONTRIBUTING.md 声称有 ESLint/Prettier，实际未安装。）`tsconfig.json` 开启了 `strict` + `noUnusedLocals` + `noUnusedParameters`，未使用的 import 会导致构建失败。

## 项目结构

- `electron/` → 主进程，输出 `dist-electron/`
- `src/` → Vue 3 渲染进程（`<script setup>`、Tailwind、Pinia），输出 `dist/`
- `bin/<platform>/<arch>/` → yt-dlp + ffmpeg 二进制，Git LFS 追踪
- 两个进程都由 `vite-plugin-electron/simple` 从一个 `vite.config.ts` 构建

## IPC 边界（手动维护，三个地方必须同步）

1. `electron/ipc/<domain>.ts` — `ipcMain.handle(...)`（注册在 `electron/main.ts`）
2. `electron/preload.ts` — `contextBridge` 入口
3. `src/env.d.ts` — `Window.electronAPI` 类型定义

添加渲染进程可调用的主进程功能时，三处都要改，否则静默失败。

### 广播事件（主→渲染）

`download:progress`、`history:updated`、`update:status`、`menu:showAbout`。渲染进程订阅者返回 unsubscribe 闭包。

## 下载架构

### 解析分发 (`electron/ipc/download.ts` → `ytdlp:parse`)

抖音/快手有专属解析器 (`electron/parsers/`)：平台 API 优先，headless `puppeteer-core` 驱动系统已安装的 Chrome/Edge (`electron/utils/browser.ts`) 作为 fallback。每次失败都被空 `catch` 吞掉，最终落到 `parseWithYtdlp`。调试解析 bug 时注意哪个分支实际运行了——错误是不可见的。

### 两条完全独立的下载路径

- `directUrl` 存在（仅抖音/快手——解析器返回 CDN URL）→ `downloadDirectFile`，纯 `fetch` + write stream，手动进度。
- 否则 → `spawn(yt-dlp)`，进度通过 **stdout 正则匹配** 抓取。format selector、audio-only (`-x mp3`)、subtitle-only (`--skip-download --write-subs`)、YouTube 多音轨、m3u8 等全在这里组装参数数组。

暂停 = `child.kill()`（Windows 额外 `taskkill /T /F`），任务从 `electron/store.ts` 的 `activeDownloads` 移除。恢复 = 重新 spawn yt-dlp，从 `.part` 文件续传。无跨重启恢复。

### yt-dlp 环境细节

- `electron/utils/binary.ts` 按顺序尝试多个路径解析 `yt-dlp`/`ffmpeg`；打包应用命中 `process.resourcesPath/bin`。二进制在 `bin/<platform>/<arch>/`，Git LFS 追踪。`release.yml` 将对应架构扁平化到 `bin/` 并删除其他平台目录，然后 electron-builder 将 `bin` 作为 `extraResources` 打包。
- YouTube 需要 JS 运行时；`checkJsRuntime()` 返回 `process.execPath`（Electron 二进制）作为 `--js-runtimes node:<path>`，打包应用无需单独安装 Node。
- Cookies 总是尝试：手动 `settings.cookiesFile`（`cookieMode === 'manual'`），否则 `--cookies-from-browser <chrome|edge>` 从 `getAvailableBrowser()` 获取。

## 状态管理

- 一个 Pinia store：`src/stores/download.ts` — 队列、选择、下载编排。
- 用户设置 **不在** Pinia 中：直接读 `localStorage['settings']` JSON（`downloadDir`、`filenameTemplate`、`preferredQuality`、`cookieMode`、`cookiesFile`），store 和多个组件直接读取。改形状需全局 grep。
- 下载历史由主进程管理：`userData/download-history.json`，上限 100 条，每次变更重新广播。
- 无路由。`App.vue` 用 `v-show` 切换四个视图；跨组件导航用 `window` CustomEvent（`tab-changed`、`navigate-to-settings`）。

## 构建平台

```bash
pnpm build:mac:arm64       # 也可 :mac:x64 :win :linux:x64 :linux:arm64
```

Linux x64 有独立格式脚本可并行：`build:linux:x64:appimage`、`:deb`、`:rpm`、`:tar.gz`。

## 发布

1. `package.json` 升版本
2. `CHANGELOG.md` 加 `## [x.y.z]` 段落
3. 推 tag `v*` → `release.yml` 自动构建 5 个架构目标并发布

Release notes 从 CHANGELOG.md 按版本 header 提取。

## 注意事项

- `electron/main.ts` 中 `app.commandLine.appendSwitch('disable-gpu-sandbox')` — macOS Tahoe + Electron 30 崩溃修复，不要删
- 所有 UI 字符、注释、commit body 使用中文，匹配此风格
- 分支命名：`feat/…` `fix/…` `docs/…` `chore/…`，Conventional Commits
- `localStorage['settings']` 存用户设置，改形状需全局搜索
- yt-dlp 的 JS 运行时用 Electron 自身（`process.execPath`），不需要单独安装 Node
- Tailwind 使用 Material-3 风格语义色 token（`bg-surface`、`text-on-surface-variant`、`surface-container-high` 等），定义在 `tailwind.config.js`，用这些而非 raw hex。`darkMode: 'class'` 已配置但从未切换 class。
- 主进程日志写到 `userData/downvid.log`（含 5s 心跳），Settings 视图通过 `app:getLog` 读最后 500 行——这是诊断打包应用崩溃的最快方式
- GitHub API 和 updater 的 owner/name 硬编码在 `electron/constants.ts` 和 `electron-builder.json5` 中
