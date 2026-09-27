# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DownVid — Electron 44 + Vue 3 desktop video downloader wrapping `yt-dlp` + `ffmpeg`. Repo dir is `videdown`, package/product name is `downvid`/DownVid. All UI strings, comments and commit bodies are Chinese — match that.

## Commands

```bash
pnpm install
pnpm download-deps          # REQUIRED before first dev run: fetches yt-dlp+ffmpeg into bin/<platform>/<arch>/
pnpm dev                    # vite dev server + electron (hot reload for both processes)
pnpm vue-tsc --noEmit       # type check — this is the only "lint" in CI
pnpm build                  # vue-tsc && vite build && electron-builder (current platform)
pnpm build:mac:arm64        # also :mac:x64 :win :linux:x64 :linux:arm64
```

TypeScript is pinned to 5.x: vue-tsc can't run on TypeScript 7 (the Go port drops `typescript/lib/tsc`); Dependabot ignores its major bumps.

No test suite and no ESLint/Prettier installed (CONTRIBUTING.md claims otherwise). CI (`.github/workflows/ci.yml`) runs only `vue-tsc --noEmit` + `vite build` (+ a smoke test of `scripts/gen-update-manifests.mjs`) on the 3 OSes, without LFS. `tsconfig.json` has `strict` + `noUnusedLocals` + `noUnusedParameters`, so an unused import fails the build.

Release: bump `package.json` version → add a `## [x.y.z]` section to `CHANGELOG.md` → push tag `v*`. `release.yml` builds 5 arch targets (each job pulls only its own `bin/<platform>/<arch>` from LFS), regenerates every `latest*.yml` from the final artifacts via `scripts/gen-update-manifests.mjs` (per-job manifests used to overwrite each other), and greps release notes out of CHANGELOG by that exact header. Artifact names are what old clients' updater manifests point at — don't rename `DownVid-Setup-*`, `DownVid-<arch>-Mac-*`, `DownVid-x86_64-Linux-*` etc.

Updating bundled binaries: run the `Update binaries` workflow (`update-bin.yml`, manual) — it runs `bin/download-deps.sh --force` (yt-dlp nightly, ffmpeg BtbN n8.1 / native arm64 mac) and commits via LFS. Locally: `bash bin/download-deps.sh <platform> --force`.

## Architecture

Two processes, both TypeScript, both built by `vite-plugin-electron/simple` from one `vite.config.ts`:

- `electron/` → main process, output `dist-electron/`
- `src/` → Vue 3 renderer (`<script setup>`, Tailwind, Pinia), output `dist/`

### The IPC boundary is hand-maintained in three places

Adding anything the renderer calls in main means editing all three or it silently breaks:

1. `electron/ipc/<domain>.ts` — `ipcMain.handle(...)`, registered from `electron/main.ts`
2. `electron/preload.ts` — `contextBridge` entry under `window.electronAPI`
3. `src/env.d.ts` — the `Window.electronAPI` type (no generation, purely manual)

Progress/events flow the other way as broadcasts (`download:progress`, `history:updated`, `update:status`, `menu:showAbout`); renderer subscribers return an unsubscribe closure.

### Parse dispatch (`electron/ipc/download.ts` → `ytdlp:parse`)

Douyin and Kuaishou have bespoke parsers (`electron/parsers/`): platform API first, headless `puppeteer-core` driving a *system-installed* Chrome/Edge (`utils/browser.ts`) as fallback. Every failure is swallowed by an empty `catch` and falls through to `parseWithYtdlp`. When debugging a parse bug, check which branch actually ran — the errors are invisible.

### Download has two entirely separate paths

- `directUrl` present (Douyin/Kuaishou only — their parsers return a CDN URL) → `downloadDirectFile`, a plain `fetch` + write stream with hand-rolled progress.
- Otherwise → `spawn(yt-dlp)` with `--load-info-json <parse cacheFile>` when the parse result is < 20 min old (skips re-extraction; falls back to the URL if it fails before downloading). Progress comes from `--progress-template` lines prefixed `[dvp]` (stdout) / `[dvpp]` (postprocess — **stderr** under the quiet mode `--print` implies); the final path from `--print after_move:[dvfile]%(filepath)s`. Format selector (`buildFormatSelector`: merge `bestaudio` only when the format has no audio), audio-only (`-x mp3`), subtitle-only, YouTube multi-audio-track are all assembled as arg arrays here.
- Direct downloads use 4 parallel `Range` segments when the CDN supports it; pause goes through an `AbortController` stored in `activeDownloads`.
- Video formats are built by the pure `electron/parsers/formats.ts`: formats without `vcodec` (X/Twitter mp4) are kept, m3u8 only kept for heights with no direct link, and a `bv*+ba/b` "最佳画质" fallback is offered when nothing has a height.

Pause = `child.kill()` (plus `taskkill /T /F` on Windows) and the task is dropped from `activeDownloads` in `electron/store.ts`. Resume re-spawns yt-dlp, which continues from the leftover `.part` file. There is no cross-restart resume.

### yt-dlp environment quirks

- `utils/binary.ts` resolves `yt-dlp`/`ffmpeg` by trying an ordered list of paths; packaged apps hit `process.resourcesPath/bin`. Binaries live in `bin/<platform>/<arch>/` and are **tracked in Git LFS** (`.gitattributes`). `release.yml` flattens the right arch into `bin/` and deletes the other platform dirs before electron-builder packs `bin` as `extraResources`.
- YouTube needs a JS runtime for yt-dlp; `checkJsRuntime()` returns `process.execPath` (the Electron binary) as `--js-runtimes node:<path>`, so no separate Node install is needed in a packaged app.
- Cookies go through `utils/cookies.ts` `runWithCookies`: manual file → none, or (auto) each installed browser → exported snapshot `userData/cookies/browser-cookies.txt` → none. It only moves to the next source on a cookie *load* error (`isCookieError`), never on auth errors. Downloads prefer a fresh (<30 min) snapshot so they match the parse.

### State

- One Pinia store, `src/stores/download.ts` — queue, selection, and the download orchestration (`processDownload`).
- User settings are **not** in Pinia: raw `localStorage['settings']` JSON (`downloadDir`, `filenameTemplate`, `preferredQuality`, `cookieMode`, `cookiesFile`), read directly by the store and several components. Change the shape in one place and you must grep for the rest.
- Download history is main-process owned: `userData/download-history.json`, capped at 100 records, rebroadcast on every mutation.
- No router. `App.vue` `v-show`es four views; cross-component navigation uses `window` CustomEvents (`tab-changed`, `navigate-to-settings`).

### Gotchas

- `electron/main.ts` disables GPU via six `commandLine.appendSwitch` calls — a macOS Tahoe + Electron 30 crash workaround. Don't drop them casually.
- Updates live in `electron/updater.ts` (IPC in `ipc/app.ts` just delegates). Windows/Linux use electron-updater with `autoDownload = false`; macOS is unsigned so Squirrel can't work — it downloads the arch zip itself, verifies sha512, strips `com.apple.quarantine`, ad-hoc signs, and a detached bash script swaps the `.app` after quit (with rollback). Unsupported installs (tar.gz, Windows portable, running from DMG) get a GitHub-API check and a "go to releases" button. electron-updater uses its own `electron-updater` session partition, so `app:setProxy` sets the proxy there too.
- Main process logs to `userData/downvid.log` (with a 5s heartbeat) and the Settings view reads the last 500 lines via `app:getLog` — that's the fastest way to diagnose a packaged-app crash.
- Tailwind v4, CSS-first: no `tailwind.config.js`; Material-3-style semantic color tokens live in the `@theme` block of `src/style.css` (`bg-surface`, `text-on-surface-variant`, `surface-container-high`, …). Use those, not raw hex. The `@layer base` compat block there keeps v3 defaults (gray-200 borders, pointer cursor on buttons). `@custom-variant dark` is declared but nothing ever toggles the class.
- Repo owner/name for the GitHub API and updater is hardcoded in `electron/constants.ts` and `electron-builder.json5`.

## Conventions

Conventional Commits (`feat(parser): …`), branches `feat/…` `fix/…` `docs/…` `chore/…`, PRs target `main`. See `CONTRIBUTING.md`.
