# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DownVid — Electron 30 + Vue 3 desktop video downloader wrapping `yt-dlp` + `ffmpeg`. Repo dir is `videdown`, package/product name is `downvid`/DownVid. All UI strings, comments and commit bodies are Chinese — match that.

## Commands

```bash
pnpm install
pnpm download-deps          # REQUIRED before first dev run: fetches yt-dlp+ffmpeg into bin/<platform>/<arch>/
pnpm dev                    # vite dev server + electron (hot reload for both processes)
pnpm vue-tsc --noEmit       # type check — this is the only "lint" in CI
pnpm build                  # vue-tsc && vite build && electron-builder (current platform)
pnpm build:mac:arm64        # also :mac:x64 :win :linux:x64 :linux:arm64
```

No test suite and no ESLint/Prettier installed (CONTRIBUTING.md claims otherwise). CI (`.github/workflows/ci.yml`) runs only `vue-tsc --noEmit` + `vite build` on the 3 OSes. `tsconfig.json` has `strict` + `noUnusedLocals` + `noUnusedParameters`, so an unused import fails the build.

Release: bump `package.json` version → add a `## [x.y.z]` section to `CHANGELOG.md` → push tag `v*`. `release.yml` builds 5 arch targets and greps release notes out of CHANGELOG by that exact header.

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
- Otherwise → `spawn(yt-dlp)`, progress **scraped from stdout with regexes**. Format selector, audio-only (`-x mp3`), subtitle-only (`--skip-download --write-subs`), YouTube multi-audio-track and m3u8 cases are all assembled as arg arrays here.

Pause = `child.kill()` (plus `taskkill /T /F` on Windows) and the task is dropped from `activeDownloads` in `electron/store.ts`. Resume re-spawns yt-dlp, which continues from the leftover `.part` file. There is no cross-restart resume.

### yt-dlp environment quirks

- `utils/binary.ts` resolves `yt-dlp`/`ffmpeg` by trying an ordered list of paths; packaged apps hit `process.resourcesPath/bin`. Binaries live in `bin/<platform>/<arch>/` and are **tracked in Git LFS** (`.gitattributes`). `release.yml` flattens the right arch into `bin/` and deletes the other platform dirs before electron-builder packs `bin` as `extraResources`.
- YouTube needs a JS runtime for yt-dlp; `checkJsRuntime()` returns `process.execPath` (the Electron binary) as `--js-runtimes node:<path>`, so no separate Node install is needed in a packaged app.
- Cookies always attempted: manual `settings.cookiesFile` when `cookieMode === 'manual'`, otherwise `--cookies-from-browser <chrome|edge>` from `getAvailableBrowser()`.

### State

- One Pinia store, `src/stores/download.ts` — queue, selection, and the download orchestration (`processDownload`).
- User settings are **not** in Pinia: raw `localStorage['settings']` JSON (`downloadDir`, `filenameTemplate`, `preferredQuality`, `cookieMode`, `cookiesFile`), read directly by the store and several components. Change the shape in one place and you must grep for the rest.
- Download history is main-process owned: `userData/download-history.json`, capped at 100 records, rebroadcast on every mutation.
- No router. `App.vue` `v-show`es four views; cross-component navigation uses `window` CustomEvents (`tab-changed`, `navigate-to-settings`).

### Gotchas

- `electron/main.ts` disables GPU via six `commandLine.appendSwitch` calls — a macOS Tahoe + Electron 30 crash workaround. Don't drop them casually.
- `electron/updater.ts` `setupAutoUpdater()` is dead code, never called. Update checking runs through the `app:checkForUpdates` / `app:downloadUpdate` handlers in `electron/ipc/app.ts` instead, so the `update:status` events those handlers' types promise are never emitted.
- Main process logs to `userData/downvid.log` (with a 5s heartbeat) and the Settings view reads the last 500 lines via `app:getLog` — that's the fastest way to diagnose a packaged-app crash.
- Tailwind uses Material-3-style semantic color tokens defined in `tailwind.config.js` (`bg-surface`, `text-on-surface-variant`, `surface-container-high`, …). Use those, not raw hex. `darkMode: 'class'` is configured but nothing ever toggles the class.
- Repo owner/name for the GitHub API and updater is hardcoded in `electron/constants.ts` and `electron-builder.json5`.

## Conventions

Conventional Commits (`feat(parser): …`), branches `feat/…` `fix/…` `docs/…` `chore/…`, PRs target `main`. See `CONTRIBUTING.md`.
