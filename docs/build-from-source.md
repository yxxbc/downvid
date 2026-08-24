# 从源码构建

本文档详细介绍如何从源码构建 DownVid。

---

## 目录

- [环境要求](#环境要求)
- [安装步骤](#安装步骤)
- [运行开发模式](#运行开发模式)
- [构建生产版本](#构建生产版本)
- [常见构建问题](#常见构建问题)

---

## 环境要求

| 工具 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| [Node.js](https://nodejs.org/) | >= 18 | 22 LTS | JavaScript 运行时 |
| [pnpm](https://pnpm.io/) | >= 8 | 11 | 包管理器（不要用 npm 或 yarn） |
| [Git](https://git-scm.com/) | 任意 | 最新 | 版本控制 |

### 检查版本

```bash
node --version    # 应显示 v18.x.x 或更高
pnpm --version    # 应显示 8.x.x 或更高
git --version     # 任意版本即可
```

### 安装 pnpm（如果还没装）

```bash
# 方法一：npm 全局安装
npm install -g pnpm

# 方法二：macOS Homebrew
brew install pnpm

# 方法三：官方脚本（Linux/macOS）
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

> ⚠️ **不要用 npm 或 yarn！** 本项目使用 pnpm 的 workspace 功能，用 npm 或 yarn 安装依赖会导致构建失败。

---

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/yxxbc/downvid.git
cd downvid
```

### 2. 安装项目依赖

```bash
pnpm install
```

> ⚠️ **必须先运行 `pnpm install`，再运行后续命令。**

### 3. 下载二进制依赖

本项目需要 **yt-dlp**（视频下载引擎）和 **ffmpeg**（音视频处理工具）才能正常运行。

#### 方式一：使用内置脚本下载（推荐）

```bash
# 自动检测你的操作系统和架构，下载对应的二进制文件
pnpm download-deps
```

下载后的文件会放在 `bin/<平台>/<架构>/` 目录下：

```
bin/
├── darwin/         # macOS
│   ├── arm64/      # Apple Silicon (M1/M2/M3/M4)
│   │   ├── yt-dlp
│   │   └── ffmpeg
│   └── x64/        # Intel Mac
│       ├── yt-dlp
│       └── ffmpeg
├── win32/          # Windows
│   └── x64/
│       ├── yt-dlp.exe
│       └── ffmpeg.exe
└── linux/          # Linux
    ├── x64/
    │   ├── yt-dlp
    │   └── ffmpeg
    └── arm64/
        ├── yt-dlp
        └── ffmpeg
```

也可以指定平台下载：

```bash
pnpm download-deps:mac     # 只下载 macOS 的二进制
pnpm download-deps:win     # 只下载 Windows 的二进制
pnpm download-deps:linux   # 只下载 Linux 的二进制
```

#### 方式二：手动安装（不推荐）

如果你不想使用内置脚本，也可以手动安装：

**macOS：**
```bash
brew install yt-dlp ffmpeg
```

**Ubuntu / Debian：**
```bash
sudo apt update
sudo apt install yt-dlp ffmpeg
```

**Windows：**
```bash
winget install yt-dlp.yt-dlp Gyan.FFmpeg
```

> ⚠️ **手动安装的问题：** 手动安装的 yt-dlp 和 ffmpeg 会被安装到系统路径，而不是项目目录。这意味着：
> - 构建出的应用包不会包含这些工具
> - 其他用户的电脑上没有安装这些工具就无法运行
> - 因此**强烈推荐**使用内置脚本下载

### 4. 验证安装

```bash
# 检查 yt-dlp 是否可用
./bin/darwin/arm64/yt-dlp --version    # macOS ARM64
./bin/win32/x64/yt-dlp.exe --version   # Windows
./bin/linux/x64/yt-dlp --version       # Linux x64

# 检查 ffmpeg 是否可用
./bin/darwin/arm64/ffmpeg -version      # macOS ARM64
```

---

## 运行开发模式

```bash
pnpm dev
```

这会同时启动：
- **Vite 开发服务器**（前端热重载）
- **Electron 主进程**（自动重启）

修改代码后，渲染进程（Vue）会自动热重载，主进程（Electron）会自动重启。

### 开发模式注意事项

- 修改 `src/` 目录下的文件 → 浏览器自动刷新
- 修改 `electron/` 目录下的文件 → Electron 自动重启
- 修改 `electron/preload.ts` → 需要手动重启（因为 preload 只加载一次）
- 修改 `vite.config.ts` → 需要手动重启

---

## 构建生产版本

### 构建当前平台

```bash
pnpm build
```

这会依次执行：
1. `vue-tsc --noEmit` — TypeScript 类型检查
2. `vite build` — 构建渲染进程代码
3. `electron-builder` — 打包 Electron 应用

### 构建指定平台

```bash
# macOS
pnpm build:mac          # 通用（同时构建 ARM64 和 x64）
pnpm build:mac:arm64    # 只构建 Apple Silicon 版本
pnpm build:mac:x64      # 只构建 Intel 版本

# Windows
pnpm build:win          # 只构建 x64 版本

# Linux
pnpm build:linux        # 通用（同时构建 x64 和 ARM64）
pnpm build:linux:x64    # 只构建 x64 版本
pnpm build:linux:arm64  # 只构建 ARM64 版本
```

### Linux x64 并行构建

Linux x64 有 4 种打包格式（AppImage、deb、rpm、tar.gz），可以并行构建加速：

```bash
# 在 4 个终端中分别运行：
pnpm build:linux:x64:appimage
pnpm build:linux:x64:deb
pnpm build:linux:x64:rpm
pnpm build:linux:x64:tar.gz
```

### 构建输出

构建完成后，输出文件在 `release/` 目录下：

```
release/
└── 1.0.0/
    ├── DownVid-arm64-Mac-1.0.0.dmg
    ├── DownVid-arm64-Mac-1.0.0.zip
    ├── DownVid-x64-Mac-1.0.0.dmg
    ├── DownVid-x64-Mac-1.0.0.zip
    ├── DownVid-Setup-1.0.0.exe
    ├── DownVid-x64-Linux-1.0.0.AppImage
    ├── DownVid-x64-Linux-1.0.0.deb
    ├── DownVid-x64-Linux-1.0.0.rpm
    └── DownVid-x64-Linux-1.0.0.tar.gz
```

---

## 常见构建问题

### 问题：`pnpm install` 失败

**错误信息：** `ERR_PNPM_NO_NODE_ENV` 或类似错误

**解决方案：**

```bash
# 清除缓存
rm -rf node_modules
rm -rf ~/.pnpm-store
pnpm store prune

# 重新安装
pnpm install
```

### 问题：`vue-tsc` 类型检查失败

**错误信息：** `TS2339: Property 'xxx' does not exist on type...`

**解决方案：**
- 这通常是 TypeScript 严格模式报错
- 检查你修改的文件中是否有未使用的 import（`noUnusedLocals` 和 `noUnusedParameters` 开启了）
- 删除未使用的 import 即可

### 问题：`electron-builder` 打包失败

**错误信息：** `Error: Cannot find module 'xxx'`

**解决方案：**

```bash
# 清除 electron-builder 缓存
rm -rf ~/Library/Application\ Support/electron-builder/Cache
rm -rf ~/.cache/electron-builder

# 重新构建
pnpm build
```

### 问题：macOS 打包提示 "No identity found"

**错误信息：** `No identity found for signing`

**解决方案：**
这是正常的。项目的 electron-builder 配置中 `identity: null` 表示不做代码签名。如果构建脚本报这个错，可能是配置问题，检查 `electron-builder.json5` 中的 `mac.identity` 是否为 `null`。

### 问题：构建出的应用无法运行

**可能原因：**
1. 没有运行 `pnpm download-deps` 下载二进制依赖
2. 下载了错误平台的二进制（比如在 Intel Mac 上下载了 ARM64 版本）
3. `bin/` 目录下的文件没有可执行权限

**解决方案：**

```bash
# 重新下载依赖
pnpm download-deps

# 添加可执行权限（Linux/macOS）
chmod +x bin/*/bin/yt-dlp bin/*/bin/ffmpeg
```

### 问题：Windows 上构建很慢

**解决方案：**
Windows 上的 electron-builder 需要下载一些工具（如 NSIS），如果网络不好会很慢。可以设置代理或使用国内镜像。

---

## 下一步

- 遇到问题？查看 [故障排除指南](./troubleshooting.md)
- 有疑问？查看 [常见问题](./faq.md)
