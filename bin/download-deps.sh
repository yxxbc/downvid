#!/bin/bash
# 下载 yt-dlp 和 ffmpeg 二进制文件到 bin/ 目录
# 用法: bash bin/download-deps.sh [platform]
# platform: all (默认), win32, darwin, linux

set -e

BIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM="${1:-all}"

# 版本配置
YTDLP_VERSION="latest"
FFMPEG_VERSION="latest"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

# ===== yt-dlp =====
download_ytdlp() {
  local os=$1 arch=$2 ext=$3
  local dir="${BIN_DIR}/${os}/${arch}"
  local file="yt-dlp${ext}"
  
  mkdir -p "$dir"
  
  if [ -f "$dir/$file" ]; then
    warn "$dir/$file 已存在，跳过"
    return
  fi
  
  log "下载 yt-dlp (${os}/${arch})..."
  
  if [ "$os" = "win32" ]; then
    curl -L --fail --retry 3 --retry-delay 2 -o "$dir/$file" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  elif [ "$os" = "darwin" ]; then
    if [ "$arch" = "arm64" ]; then
      curl -L --fail --retry 3 --retry-delay 2 -o "$dir/$file" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos_arm64"
    else
      curl -L --fail --retry 3 --retry-delay 2 -o "$dir/$file" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    fi
    chmod +x "$dir/$file"
  elif [ "$os" = "linux" ]; then
    if [ "$arch" = "arm64" ]; then
      curl -L --fail --retry 3 --retry-delay 2 -o "$dir/$file" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"
    else
      curl -L --fail --retry 3 --retry-delay 2 -o "$dir/$file" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"
    fi
    chmod +x "$dir/$file"
  fi
  
  log "yt-dlp (${os}/${arch}) 下载完成"
}

# ===== ffmpeg =====
download_ffmpeg() {
  local os=$1 arch=$2
  local dir="${BIN_DIR}/${os}/${arch}"
  
  mkdir -p "$dir"
  
  if [ -f "$dir/ffmpeg" ] || [ -f "$dir/ffmpeg.exe" ]; then
    warn "$dir/ffmpeg 已存在，跳过"
    return
  fi
  
  log "下载 ffmpeg (${os}/${arch})..."
  
  if [ "$os" = "win32" ]; then
    local tmpdir=$(mktemp -d)
    curl -L --fail --retry 3 --retry-delay 2 -o "$tmpdir/ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    unzip -q -o "$tmpdir/ffmpeg.zip" -d "$tmpdir"
    cp "$tmpdir"/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe "$dir/ffmpeg.exe"
    rm -rf "$tmpdir"
  elif [ "$os" = "darwin" ]; then
    local tmpdir=$(mktemp -d)
    if [ "$arch" = "arm64" ]; then
      curl -L --fail --retry 3 --retry-delay 2 -o "$tmpdir/ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macosarm64-gpl.zip"
    else
      curl -L --fail --retry 3 --retry-delay 2 -o "$tmpdir/ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macosx64-gpl.zip"
    fi
    unzip -q -o "$tmpdir/ffmpeg.zip" -d "$tmpdir"
    cp "$tmpdir"/ffmpeg-master-latest-macos*/bin/ffmpeg "$dir/ffmpeg"
    chmod +x "$dir/ffmpeg"
    rm -rf "$tmpdir"
  elif [ "$os" = "linux" ]; then
    local tmpdir=$(mktemp -d)
    if [ "$arch" = "arm64" ]; then
      curl -L --fail --retry 3 --retry-delay 2 -o "$tmpdir/ffmpeg.tar.xz" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
    else
      curl -L --fail --retry 3 --retry-delay 2 -o "$tmpdir/ffmpeg.tar.xz" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
    fi
    tar -xf "$tmpdir/ffmpeg.tar.xz" -C "$tmpdir"
    cp "$tmpdir"/ffmpeg-*-static/ffmpeg "$dir/ffmpeg"
    chmod +x "$dir/ffmpeg"
    rm -rf "$tmpdir"
  fi
  
  log "ffmpeg (${os}/${arch}) 下载完成"
}

# ===== 主逻辑 =====
case "$PLATFORM" in
  win32|windows)
    download_ytdlp "win32" "x64" ".exe"
    download_ffmpeg "win32" "x64"
    ;;
  darwin|mac|macos)
    download_ytdlp "darwin" "arm64" ""
    download_ytdlp "darwin" "x64" ""
    download_ffmpeg "darwin" "arm64"
    download_ffmpeg "darwin" "x64"
    ;;
  linux)
    download_ytdlp "linux" "x64" ""
    download_ytdlp "linux" "arm64" ""
    download_ffmpeg "linux" "x64"
    download_ffmpeg "linux" "arm64"
    ;;
  all|*)
    download_ytdlp "win32" "x64" ".exe"
    download_ffmpeg "win32" "x64"
    download_ytdlp "darwin" "arm64" ""
    download_ytdlp "darwin" "x64" ""
    download_ffmpeg "darwin" "arm64"
    download_ffmpeg "darwin" "x64"
    download_ytdlp "linux" "x64" ""
    download_ytdlp "linux" "arm64" ""
    download_ffmpeg "linux" "x64"
    download_ffmpeg "linux" "arm64"
    ;;
esac

log "所有依赖下载完成!"
echo ""
echo "目录结构:"
find "$BIN_DIR" -type f -name "*yt-dlp*" -o -name "*ffmpeg*" | sort
