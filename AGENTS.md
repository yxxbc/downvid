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

TypeScript 固定在 5.x：vue-tsc 无法在 TypeScript 7（Go 重写版，去掉了 `typescript/lib/tsc`）上运行，Dependabot 已忽略其大版本升级。

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
- 否则 → `spawn(yt-dlp)`：解析结果 20 分钟内用 `--load-info-json` 跳过二次提取（未开始下载即失败则回退为 URL）。进度来自 `--progress-template` 输出的 `[dvp]`（stdout）/ `[dvpp]`（后处理，`--print` 隐含 quiet 时走 **stderr**）行，最终路径由 `--print after_move` 给出。format selector（仅在格式无音轨时合并 bestaudio）、audio-only、subtitle-only、YouTube 多音轨等在这里组装。
- 直链支持 Range 时 4 段并行下载；暂停通过 `activeDownloads` 中的 `AbortController`。
- 视频格式由纯函数 `electron/parsers/formats.ts` 生成：保留无 `vcodec` 的格式（X/Twitter mp4），m3u8 仅在该清晰度无直链时保留，都没有分辨率时提供 `bv*+ba/b`「最佳画质」兜底。

暂停（yt-dlp 路径）= `child.kill()`（Windows 额外 `taskkill /T /F`），任务从 `electron/store.ts` 的 `activeDownloads` 移除。恢复 = 重新 spawn yt-dlp，从 `.part` 文件续传。无跨重启恢复。

### yt-dlp 环境细节

- `electron/utils/binary.ts` 按顺序尝试多个路径解析 `yt-dlp`/`ffmpeg`；打包应用命中 `process.resourcesPath/bin`。二进制在 `bin/<platform>/<arch>/`，Git LFS 追踪。`release.yml` 将对应架构扁平化到 `bin/` 并删除其他平台目录，然后 electron-builder 将 `bin` 作为 `extraResources` 打包。
- YouTube 需要 JS 运行时；`checkJsRuntime()` 返回 `process.execPath`（Electron 二进制）作为 `--js-runtimes node:<path>`，打包应用无需单独安装 Node。
- Cookie 经 `utils/cookies.ts` 的 `runWithCookies`：手动文件 → 无；自动模式依次尝试各已安装浏览器 → 快照 `userData/cookies/browser-cookies.txt` → 无。仅在 cookie *读取*错误（`isCookieError`）时切换来源，鉴权错误不切换。下载优先使用 30 分钟内的快照，与解析保持一致。

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
3. 推 tag `v*` → `release.yml` 自动构建 5 个架构目标并发布（每个 job 只拉取本平台 LFS；`scripts/gen-update-manifests.mjs` 按最终产物重新生成全部 `latest*.yml`）

产物文件名是旧版本客户端更新清单所引用的，不要改 `DownVid-Setup-*`、`DownVid-<arch>-Mac-*`、`DownVid-x86_64-Linux-*` 等命名。

更新内置二进制：手动运行 `Update binaries` 工作流（`update-bin.yml`），它执行 `bin/download-deps.sh --force`（yt-dlp nightly、ffmpeg BtbN n8.1 / mac 原生 arm64）并经 LFS 提交；本地为 `bash bin/download-deps.sh <platform> --force`。

Release notes 从 CHANGELOG.md 按版本 header 提取。

## 注意事项

- `electron/main.ts` 中 `app.commandLine.appendSwitch('disable-gpu-sandbox')` — macOS Tahoe + Electron 30 崩溃修复，不要删
- 所有 UI 字符、注释、commit body 使用中文，匹配此风格
- 分支命名：`feat/…` `fix/…` `docs/…` `chore/…`，Conventional Commits
- `localStorage['settings']` 存用户设置，改形状需全局搜索
- yt-dlp 的 JS 运行时用 Electron 自身（`process.execPath`），不需要单独安装 Node
- Tailwind v4（CSS-first，无 `tailwind.config.js`）：Material-3 风格语义色 token（`bg-surface`、`text-on-surface-variant`、`surface-container-high` 等）定义在 `src/style.css` 的 `@theme` 中，用这些而非 raw hex。同文件 `@layer base` 兼容块保留了 v3 默认值（gray-200 边框、按钮 pointer 光标）。`@custom-variant dark` 已声明但从未切换 class。
- 主进程日志写到 `userData/downvid.log`（含 5s 心跳），Settings 视图通过 `app:getLog` 读最后 500 行——这是诊断打包应用崩溃的最快方式
- GitHub API 和 updater 的 owner/name 硬编码在 `electron/constants.ts` 和 `electron-builder.json5` 中
- 更新逻辑在 `electron/updater.ts`：Windows/Linux 用 electron-updater（`autoDownload = false`）；macOS 未签名无法用 Squirrel，自行下载对应架构 zip、校验 sha512、去除隔离属性并 ad-hoc 签名，退出后由脚本替换 `.app`（失败回滚）；tar.gz/便携版/DMG 内运行走 GitHub API 检查 + 前往下载页。electron-updater 使用独立 session 分区，`app:setProxy` 会同步代理
