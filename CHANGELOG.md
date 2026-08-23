# Changelog

本文件记录 DownVid 的所有版本更新。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

### 新增
- 跨平台支持：macOS (ARM64/x64)、Windows (x64)、Linux (x64/ARM64)
- 自动更新系统 (electron-updater + GitHub Releases)
- 一键下载依赖脚本 `bin/download-deps.sh`
- GitHub Actions CI/CD 自动构建多平台发布
- 项目模块化重构

### 变更
- 项目名称从 Videdown 改为 DownVid
- electron/main.ts 拆分为多个模块

---

## [1.0.0] - 2026-08-23

### 新增
- 支持抖音无水印视频下载
- 支持快手无水印视频下载
- 支持 B站、YouTube、Instagram 等 1000+ 平台
- 多画质选择 (360p/480p/720p/1080p)
- 实时下载进度显示
- 下载队列管理
- Cookie 支持 (YouTube/B站登录)
- YouTube 多音轨选择
- 字幕下载
- 纯音频下载模式
- 下载历史记录
- 深色/浅色主题
### 修复
- 开启GPU加速

