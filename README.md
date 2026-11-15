# Pomodoro Widget

Floating desktop Pomodoro timer with quick distraction capture, context tracking, and session analytics. Built with Tauri v2, Rust, React 19, TypeScript, and SQLite.

Prebuilt installers and auto-updater manifests are available on [Releases](https://github.com/elyashan/tauri-pomodoro/releases).

## Usage

### Timer Window
- Select a preset (`Classic`, `Developer`, `Ultradian`, or `Custom`) and set a topic to start.
- Click the topic or active context text on the timer to update it inline.
- Click `−` to collapse the timer into a bottom-right mini-dock.
- Click `✕` to hide the window to the system tray.

### Quick Capture (`Ctrl+Alt+D`)
- Press `Ctrl+Alt+D` globally to open the capture popup.
- Switch categories and tags with `Tab` and submit with `Enter`.
- **Impulsive Task / Idea**: Saved to the Parking Lot with no timer penalty and surfaced during breaks.
- **Internal / External Distraction**: Logged under distractions with an optional timer penalty and context prompt.

### Summary & Export
- **Daily / Weekly**: Shows a 24-hour work/break timeline and session totals. Click any work block to open its 5-minute work story slideshow.
- **Parking Lot**: Collapsible list of captured tasks with optional Google Docs sync.
- **Breakdown**: Filter counts across `Distract` (`internal` and `external`), `Overtime`, and `Stopped` events.
- **Backup**: Exports all records to `Downloads/pomodoro-backup.json` in a single file (excluding images and stories).

## Technical Details

### Stack
- **Shell & Native Core**: Rust + Tauri v2 (`main` timer window and `capture` popup window).
- **UI**: React 19, TypeScript, Vite.
- **Database**: Local SQLite via `tauri-plugin-sql`.
- **Tauri Plugins**: `global-shortcut`, `autostart`, `updater` (Minisign), `opener`, `process`.

### OS Integration
- **Active Window & Idle Detection**:
  - Windows: Win32 API for foreground HWND tracking/restoration and idle/sleep detection.
  - macOS: `osascript`.
  - Linux: `xdotool`.
- **Windows Focus Assist**: Toggles Focus Assist via WNF.
- **Screen Snapshots**: Captures periodic 5-minute frames for the work story slideshow.

### CI & Updates
- `.github/workflows/release.yml` runs `tauri-apps/tauri-action@v0` across `windows-latest`, `macos-latest` (`universal-apple-darwin`), and `ubuntu-22.04`.
- Releases generate `latest.json` for `tauri-plugin-updater` signature verification.

## Build from Source

Requires Node.js 22 and Rust (stable).

Linux (`ubuntu-22.04`) system packages:
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

Install dependencies and run or build:
```bash
npm install
npm run tauri dev
npm run tauri build
```
