// 根据实际发布的安装包重新生成 electron-updater 更新清单（latest*.yml）。
//
// 各平台/架构在不同 CI job 中构建，各自生成的 latest*.yml 在汇总时会互相覆盖，
// 曾导致清单与实际上传文件不一致（如 Windows 便携版覆盖安装包后 sha512 校验失败）。
// 这里对最终要上传的文件逐个计算 sha512/size，保证清单与文件一致；旧版本客户端
// 读取的也是这些清单，因此同样能正常升级。
//
// 用法: node scripts/gen-update-manifests.mjs <artifacts 目录> <版本号>

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [dir, version] = process.argv.slice(2)
if (!dir || !version) {
  console.error('用法: node scripts/gen-update-manifests.mjs <artifacts 目录> <版本号>')
  process.exit(1)
}

function listFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(e => {
    const full = path.join(root, e.name)
    return e.isDirectory() ? listFiles(full) : [full]
  })
}

const all = listFiles(dir)
const releaseDate = new Date().toISOString()

function entry(pattern) {
  const matches = all.filter(f => pattern.test(path.basename(f)))
  if (matches.length === 0) return null
  // 多个 job 可能产出同名文件，取第一个即可（内容相同）
  const file = matches[0]
  const data = fs.readFileSync(file)
  return {
    url: path.basename(file),
    sha512: crypto.createHash('sha512').update(data).digest('base64'),
    size: data.length,
  }
}

function writeManifest(name, patterns) {
  const files = patterns.map(entry).filter(Boolean)
  if (files.length === 0) {
    console.warn(`跳过 ${name}：未找到对应安装包`)
    return
  }
  const lines = [`version: ${version}`, 'files:']
  for (const f of files) {
    lines.push(`  - url: ${f.url}`, `    sha512: ${f.sha512}`, `    size: ${f.size}`)
  }
  // 顶层 path/sha512 供旧版 electron-updater 兼容读取，指向首选安装包
  lines.push(`path: ${files[0].url}`, `sha512: ${files[0].sha512}`, `releaseDate: '${releaseDate}'`, '')
  // 删除 job 产出的旧清单，统一写到 artifacts 根目录
  for (const old of all.filter(f => path.basename(f) === name)) fs.rmSync(old)
  fs.writeFileSync(path.join(dir, name), lines.join('\n'))
  console.log(`生成 ${name}: ${files.map(f => f.url).join(', ')}`)
}

const v = version.replace(/\./g, '\\.')
writeManifest('latest.yml', [new RegExp(`^DownVid-Setup-${v}\\.exe$`)])
writeManifest('latest-mac.yml', [
  new RegExp(`^DownVid-arm64-Mac-${v}\\.zip$`),
  new RegExp(`^DownVid-x64-Mac-${v}\\.zip$`),
  new RegExp(`^DownVid-arm64-Mac-${v}\\.dmg$`),
  new RegExp(`^DownVid-x64-Mac-${v}\\.dmg$`),
])
writeManifest('latest-linux.yml', [
  new RegExp(`^DownVid-x86_64-Linux-${v}\\.AppImage$`),
  new RegExp(`^DownVid-amd64-Linux-${v}\\.deb$`),
  new RegExp(`^DownVid-x86_64-Linux-${v}\\.rpm$`),
])
writeManifest('latest-linux-arm64.yml', [new RegExp(`^DownVid-arm64-Linux-${v}\\.AppImage$`)])
