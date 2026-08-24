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

没有 ESLint、Prettier、测试套件。`tsconfig.json` 开启了 `strict` + `noUnusedLocals` + `noUnusedParameters`，未使用的 import 会导致构建失败。

## 项目结构

- `electron/` → 主进程，输出 `dist-electron/`
- `src/` → Vue 3 渲染进程（`<script setup>`、Tailwind、Pinia），输出 `dist/`
- `bin/<platform>/<arch>/` → yt-dlp + ffmpeg 二进制，Git LFS 追踪
- 两个进程都由 `vite-plugin-electron/simple` 从一个 `vite.config.ts` 构建

## IPC 边界（手动维护，三个地方必须同步）

1. `electron/ipc/<domain>.ts` — `ipcMain.handle(...)`
2. `electron/preload.ts` — `contextBridge` 入口
3. `src/env.d.ts` — `Window.electronAPI` 类型定义

添加渲染进程可调用的主进程功能时，三处都要改，否则静默失败。

## 构建平台

```bash
pnpm build:mac:arm64       # 也可 :mac:x64 :win :linux:x64 :linux:arm64
```

Linux x64 有独立格式脚本可并行：`build:linux:x64:appimage`、`:deb`、`:rpm`、`:tar.gz`。

## 发布

1. `package.json` 升版本
2. `CHANGELOG.md` 加 `## [x.y.z]` 段落
3. 推 tag `v*` → `release.yml` 自动构建 5 个架构目标并发布

## 注意事项

- `electron/main.ts` 中 6 个 `commandLine.appendSwitch` 禁用 GPU — macOS Tahoe + Electron 30 崩溃修复，不要删
- 所有 UI 字符、注释、commit body 使用中文，匹配此风格
- 分支命名：`feat/…` `fix/…` `docs/…` `chore/…`，Conventional Commits
- `localStorage['settings']` 存用户设置（`downloadDir`、`filenameTemplate` 等），不在 Pinia 中，改形状需全局搜索
- yt-dlp 的 JS 运行时用 Electron 自身（`process.execPath`），不需要单独安装 Node
- `electron/updater.ts` 的 `setupAutoUpdater()` 是死代码，从未调用
