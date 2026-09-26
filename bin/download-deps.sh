#!/bin/bash
# 下载 yt-dlp 和 ffmpeg 二进制文件到 bin/ 目录
# 用法: bash bin/download-deps.sh [platform] [--force]
# platform: all (默认), win32, darwin, linux
# --force:  覆盖已存在的文件（用于升级二进制）
#
# 来源：
#   yt-dlp  — yt-dlp-nightly-builds（yt-dlp 官方推荐日常使用 nightly，站点修复更及时）
#   ffmpeg  — Windows/Linux: BtbN FFmpeg-Builds n8.1 稳定分支
#             macOS arm64:   eugeneware/ffmpeg-static（原生 arm64，避免 Rosetta 转译）
#             macOS x64:     evermeet.cx（不可用时回退 eugeneware/ffmpeg-static）

set -e

BIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM="all"
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    *) PLATFORM="$arg" ;;
  esac
done

YTDLP_BASE="https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download"
BTBN_BASE="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest"
FFMPEG_BRANCH="8.1"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

fetch() { curl -L --fail --retry 3 --retry-delay 2 -o "$1" "$2"; }

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# 按 "<hash>  <name>" 格式的校验文件验证下载结果
verify() {
  local file=$1 name=$2 sums=$3
  local expected actual
  expected=$(grep -E "[ *]${name}\$" "$sums" | head -1 | cut -d' ' -f1)
  if [ -z "$expected" ]; then warn "未找到 ${name} 的校验值，跳过校验"; return; fi
  actual=$(sha256_of "$file")
  if [ "$expected" != "$actual" ]; then err "${name} 校验失败"; exit 1; fi
}

exists() {
  if [ -f "$1" ] && [ "$FORCE" = "0" ]; then
    warn "$1 已存在，跳过（使用 --force 覆盖更新）"
    return 0
  fi
  return 1
}

# ===== yt-dlp =====
YTDLP_SUMS=""
download_ytdlp() {
  local os=$1 arch=$2
  local dir="${BIN_DIR}/${os}/${arch}"
  local file="yt-dlp" asset
  mkdir -p "$dir"

  case "${os}/${arch}" in
    win32/x64)    file="yt-dlp.exe"; asset="yt-dlp.exe" ;;
    darwin/*)     asset="yt-dlp_macos" ;;  # universal binary
    linux/arm64)  asset="yt-dlp_linux_aarch64" ;;
    linux/x64)    asset="yt-dlp_linux" ;;
  esac

  exists "$dir/$file" && return

  if [ -z "$YTDLP_SUMS" ]; then
    YTDLP_SUMS=$(mktemp)
    fetch "$YTDLP_SUMS" "${YTDLP_BASE}/SHA2-256SUMS"
  fi

  log "下载 yt-dlp (${os}/${arch})..."
  fetch "$dir/$file" "${YTDLP_BASE}/${asset}"
  verify "$dir/$file" "$asset" "$YTDLP_SUMS"
  [ "$os" != "win32" ] && chmod +x "$dir/$file"
  log "yt-dlp (${os}/${arch}) 下载完成"
}

# ===== ffmpeg =====
BTBN_SUMS=""
download_ffmpeg() {
  local os=$1 arch=$2
  local dir="${BIN_DIR}/${os}/${arch}"
  local file="ffmpeg"
  [ "$os" = "win32" ] && file="ffmpeg.exe"
  mkdir -p "$dir"

  exists "$dir/$file" && return

  log "下载 ffmpeg (${os}/${arch})..."
  local tmpdir
  tmpdir=$(mktemp -d)

  if [ "$os" = "darwin" ]; then
    if [ "$arch" = "arm64" ]; then
      fetch "$tmpdir/ffmpeg.gz" "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-arm64.gz"
      gunzip -c "$tmpdir/ffmpeg.gz" > "$dir/$file"
    elif fetch "$tmpdir/ffmpeg.zip" "https://evermeet.cx/ffmpeg/getrelease/zip"; then
      unzip -q -o "$tmpdir/ffmpeg.zip" -d "$tmpdir"
      cp "$tmpdir/ffmpeg" "$dir/$file"
    else
      # evermeet 不可用时回退到 eugeneware/ffmpeg-static 的 x64 构建
      warn "evermeet.cx 下载失败，改用 eugeneware/ffmpeg-static"
      fetch "$tmpdir/ffmpeg.gz" "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64.gz"
      gunzip -c "$tmpdir/ffmpeg.gz" > "$dir/$file"
    fi
  else
    local target archive
    case "${os}/${arch}" in
      win32/x64)   target="win64";      archive="zip" ;;
      linux/x64)   target="linux64";    archive="tar.xz" ;;
      linux/arm64) target="linuxarm64"; archive="tar.xz" ;;
    esac
    local name="ffmpeg-n${FFMPEG_BRANCH}-latest-${target}-gpl-${FFMPEG_BRANCH}"
    if [ -z "$BTBN_SUMS" ]; then
      BTBN_SUMS=$(mktemp)
      fetch "$BTBN_SUMS" "${BTBN_BASE}/checksums.sha256"
    fi
    fetch "$tmpdir/${name}.${archive}" "${BTBN_BASE}/${name}.${archive}"
    verify "$tmpdir/${name}.${archive}" "${name}.${archive}" "$BTBN_SUMS"
    if [ "$archive" = "zip" ]; then
      unzip -q -o "$tmpdir/${name}.${archive}" -d "$tmpdir"
    else
      tar -xf "$tmpdir/${name}.${archive}" -C "$tmpdir"
    fi
    cp "$tmpdir/${name}/bin/${file}" "$dir/$file"
  fi

  [ "$os" != "win32" ] && chmod +x "$dir/$file"
  rm -rf "$tmpdir"
  log "ffmpeg (${os}/${arch}) 下载完成"
}

# ===== 主逻辑 =====
case "$PLATFORM" in
  win32|windows)
    download_ytdlp "win32" "x64"
    download_ffmpeg "win32" "x64"
    ;;
  darwin|mac|macos)
    download_ytdlp "darwin" "arm64"
    download_ytdlp "darwin" "x64"
    download_ffmpeg "darwin" "arm64"
    download_ffmpeg "darwin" "x64"
    ;;
  linux)
    download_ytdlp "linux" "x64"
    download_ytdlp "linux" "arm64"
    download_ffmpeg "linux" "x64"
    download_ffmpeg "linux" "arm64"
    ;;
  all|*)
    download_ytdlp "win32" "x64"
    download_ffmpeg "win32" "x64"
    download_ytdlp "darwin" "arm64"
    download_ytdlp "darwin" "x64"
    download_ffmpeg "darwin" "arm64"
    download_ffmpeg "darwin" "x64"
    download_ytdlp "linux" "x64"
    download_ytdlp "linux" "arm64"
    download_ffmpeg "linux" "x64"
    download_ffmpeg "linux" "arm64"
    ;;
esac

log "所有依赖下载完成!"
echo ""
echo "目录结构:"
find "$BIN_DIR" -type f -name "*yt-dlp*" -o -name "*ffmpeg*" | sort
