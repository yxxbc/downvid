<div align="center">
  <h1>DownVid</h1>
</div>

DownVid 是一款现代化的开源视频下载工具，让你可以从抖音 小红书 B站 YT Instagram等网站下载无水印高清视频。基于 Electron 构建，使用 yt-dlp 作为下载引擎，DownVid 提供了简洁直观的界面和强大的功能，满足你的所有下载需求。

> Based on [Videdown](https://github.com/cshuangyy/videdown) by cshuangyy (MIT License)

  <p>
    <a href="https://github.com/yxxbc/downvid/stargazers"><img src="src/assets/screen.png" alt="DownVid Screenshot" width="98%"></a>
    <a href="https://github.com/yxxbc/downvid/releases"><img src="https://img.shields.io/github/downloads/yxxbc/downvid/total?color=369eff&labelColor=black&logo=github&label=Downloads" /></a>
    <a href="https://github.com/yxxbc/downvid/releases/latest"><img src="https://img.shields.io/github/v/release/yxxbc/downvid?color=369eff&labelColor=black&logo=github&label=Latest%20Release" /></a>
    <br />
    <br />
  </p>

## 开始使用

DownVid 目前正在积极开发中，欢迎反馈任何[问题](https://github.com/yxxbc/downvid/issues)。

[下载 DownVid](https://github.com/yxxbc/downvid/releases)

## 功能特性

### 全球视频下载支持

通过强大的 yt-dlp 引擎，可以从全球几乎所有网站下载视频。支持 1000+ 个网站，包括 YouTube、抖音、B站、小红书、Instagram 等。

### 一流的界面体验

现代化、简洁的界面，操作直观。一键暂停/恢复/重试，实时进度追踪，全面的下载队列管理。

### 实时下载进度

显示下载进度、下载速度、预计剩余时间，让你随时掌握下载状态。

### Cookie 支持

支持导入浏览器 Cookie，可以下载需要登录的视频内容。

### 多格式选择

支持选择不同的视频质量和格式，包括仅下载音频。

## 支持的网站

DownVid 通过 yt-dlp 支持 1000+ 个视频和音频平台。主要支持：

- **国内平台**：抖音、B站（哔哩哔哩）、小红书、快手、西瓜视频
- **国际平台**：YouTube、Instagram、TikTok、Twitter/X、Facebook
- **其他**：支持几乎所有 yt-dlp 支持的网站

完整支持列表请访问 [yt-dlp 支持网站](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

## 安装使用

### 下载安装

1. 访问 [Releases](https://github.com/yxxbc/downvid/releases) 页面
2. 下载最新版本的安装程序
3. 运行安装程序，按提示完成安装
4. 安装完成后即可使用

### 从源码构建

#### 1. 克隆仓库

```bash
git clone https://github.com/yxxbc/downvid.git
cd downvid
```

#### 2. 下载依赖工具

本项目需要 **yt-dlp** 和 **ffmpeg** 才能正常运行。

**macOS/Linux 用户：**

```bash
# 使用包管理器安装 yt-dlp 和 ffmpeg
# macOS (Homebrew)
brew install yt-dlp ffmpeg

# Ubuntu/Debian
sudo apt update
sudo apt install yt-dlp ffmpeg
```

#### 3. 安装项目依赖

```bash
pnpm install
```

#### 4. 运行和构建

```bash
# 开发模式运行
pnpm dev

# 构建生产版本
pnpm build
```

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全的 JavaScript 超集
- **Tailwind CSS** - 实用优先的 CSS 框架
- **YT-DLP** - 强大的视频下载引擎
- **FFmpeg** - 音视频处理工具

## 开源协议

本项目基于 [MIT](LICENSE) 协议开源。

基于 [Videdown](https://github.com/cshuangyy/videdown) (MIT License) 修改。

## 致谢

- [Videdown](https://github.com/cshuangyy/videdown) - 原始项目
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 强大的视频下载引擎
- [FFmpeg](https://ffmpeg.org/) - 音视频处理解决方案
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
