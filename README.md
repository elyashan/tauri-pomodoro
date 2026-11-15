# Pomodoro Widget

A small always-on-top desktop Pomodoro timer and distraction tracker built with Tauri v2, React, TypeScript, and SQLite.

## Why I built this

Most timers just count down from 25 or 50 minutes and ring a bell. When I actually sit down to study or code, the timer isn't what breaks the session—it's noticing an unrelated bug halfway through and opening three tabs to chase it, forgetting what exact line I was debugging after getting coffee, or letting a 5-minute break turn into 35 minutes without realizing why.

I wanted a lightweight floating widget that stays out of the way while I work, catches stray thoughts in two seconds via a keyboard shortcut, and gives me an honest look at how my focus actually holds up over a day or a week.

## What it does

- **Floating timer & mini-dock**: Stays always-on-top without getting in the way, shrinks into a small corner pill (`−`) or system tray (`✕`), and turns on Windows Focus Assist / Do Not Disturb during work sessions so desktop notifications stay quiet.
- **Quick Capture (`Ctrl+Alt+D`)**: A keyboard-first popup (`Tab` / `Enter`) that opens anywhere, even while working in another app:
  - **Impulsive tasks & ideas** go straight into a "Parking Lot" so you don't act on them mid-session—they show up once your break starts.
  - **Internal / external triggers** get logged with optional tags, past suggestions, and an optional time penalty, plus an active context update so you remember where to pick up.
- **Active Context tracking**: Keeps track of the specific task or sub-problem you're currently on (before a short break or a distraction) and brings it back as a reminder when you return.
- **Break overtime & sleep detection**: Asks why a break ran long instead of silently pretending it didn't, and detects system sleep or long idle gaps so leaving the lid closed doesn't log fake 6-hour work sessions.
- **Daily & Weekly Summary**:
  - 24-hour session timeline with optional 5-minute work story snapshots (screenshot + active window + context) viewable as a slideshow per work block.
  - Collapsible Parking Lot checklists/ideas (with optional Google Docs export/sync).
  - Breakdown of distractions (internal/external triggers), break delays, and early stops.
  - Pattern stats from your own logs: typical minute attention tends to drift, internal vs. external trigger split, break-to-work friction, and peak focus hours.
- **Display scaling & localization**: 100% / 125% / 150% UI scaling, dark/light/custom themes, and full English & Turkish support.

## Install

Prebuilt installers for Windows (`.msi` / `.exe`), macOS (Universal `.dmg`), and Linux (`.deb` / `.AppImage`) are available on the [Releases](https://github.com/elyashan/tauri-pomodoro/releases) page.

New versions can also be checked and installed directly from inside the app's Settings screen via GitHub Releases (`latest.json`).

## Building from source

**Prerequisites:**
- Node.js 22+
- Rust (stable toolchain)
- On Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

```bash
npm install
npm run tauri dev
```

To build a release installer locally:

```bash
npm run tauri build
```

## Data & Privacy

Everything is stored locally in a SQLite database on your machine—sessions, distractions, parking items, work story snapshots, and context logs never leave your computer unless you explicitly use Google Docs export or cloud sync.

You can export a single lightweight JSON backup (`pomodoro-backup.json` saved to your `Downloads` folder, excluding screenshots and story images) anytime from the Summary screen.

---

## Türkçe

Bilgisayarda ders çalışırken veya kod yazarken dikkatin dağıldığı anları (dürtüsel görevler, akla gelen fikirler, içsel/dışsal bölünmeler) çalışmayı bölmeden kaydetmek için Tauri v2, React ve SQLite ile geliştirilmiş masaüstü Pomodoro aracı.

**Temel özellikler:**
- Her zaman üstte durabilen sade sayaç, sağ alt köşe mini modu (`−`), sistem tepsisi (`✕`) desteği ve çalışma sırasında Windows Odaklanma Yardımı (bildirim gizleme).
- Herhangi bir uygulamadayken `Ctrl+Alt+D` ile açılan klavye odaklı hızlı yakalama penceresi (`Tab` / `Enter` ile kategori, tag ve not seçimi; dürtüsel görev ve fikirleri mola otoparkına atma).
- Kısa mola veya bölünme öncesi nerede kaldığınızı hatırlatan Active Context takibi.
- Mola uzatma sebebi sorma ve bilgisayar uyku modunda kaldığında sahte saatler loglamasını engelleyen idle/sleep algılama.
- Günlük/haftalık özet ekranında 24 saatlik çizelge, çalışma bloklarına göre 5 dakikalık slayt hikayesi, mola otoparkı (isteğe bağlı Google Docs aktarımı), kırılımlar ve kişisel odak çıkarımları.
- Tek dosyada resimsiz JSON yedeği (`Downloads/pomodoro-backup.json`) ve Türkçe / İngilizce arayüz desteği.

Kurulum dosyaları için [Releases](https://github.com/elyashan/tauri-pomodoro/releases) sayfasına göz atabilirsiniz.
