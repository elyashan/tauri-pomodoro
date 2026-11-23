# Pomodoro Widget — Architecture & LLM Codebase Index

Compact reference map for fast navigation and low-token updates.

## Build & Check Commands

- Frontend (`tsc && vite build`): `npm.cmd run build`
- Rust backend check: `cargo check --manifest-path src-tauri/Cargo.toml`
- TypeScript compiler constraints ([`tsconfig.json`](tsconfig.json)): `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.

---

## Directory & Module Map

### Entry & Global Orchestration
- `src/main.tsx` — React root mount (`App` vs `QuickCapture` window detection).
- `src/App.tsx` — Main window state machine, timer loop, session persistence, modal routing (`// @llm-index`).
- `src/QuickCapture.tsx` — Standalone always-on-top Quick Capture popup window (`open-capture` listener & submit).
- `src/i18n.ts` — Strongly typed `tr` / `en` localization dictionaries (`Translations`, `ActiveLang`, `// @llm-index`).
- `src/constants.ts` — Mood types (`MOOD_TYPES`, `MOOD_EMOJIS`), bio event types, sleep options, formatting helpers.
- `src/updater.ts` — Tauri app updater lock/resource lifecycle (`releasePendingUpdate`).
- `src/cloudSync.ts` & `src/screenshot.ts` — Cloud backup sync helpers and capture invocation wrappers.

### Pages (`src/pages/`)
- `src/pages/MenuPage.tsx` — Home launcher, study plan picker, today stats, daily bio context pills, start mood selector.
- `src/pages/TimerPage.tsx` — Active work/break timer view, inline break parking, sequential break flow (Hyperfocus offer → Labeled end-mood card → Quiet break checklist).
- `src/pages/SummaryPage.tsx` — Thin composition shell (`// @llm-index`) for Daily Timeline, Weekly Chart, Parking, and Insights.
  - `src/pages/summary/timelineUtils.ts` — `buildVerticalTimelineModel` (groups multi-round work sessions by `sessionGroupId`, nests mid-session breaks & bio events), `formatSessionGroupShortBadge` & `formatSessionGroupFullLabel` (hover metadata).
  - `src/pages/summary/SummaryDateBar.tsx` — Date navigation arrows, calendar input, 7-day selector strip.
  - `src/pages/summary/SummaryResetConfirm.tsx` — Selective data deletion confirmation (`workTime` / `distractions`).
  - `src/pages/summary/TimelineBioPopover.tsx` — Inline timeline `+` popover for logging wake/coffee/meds/meal + sleep hours.
  - `src/pages/summary/TimelineRows.tsx` — Vertical timeline candles, gap rails, nested breaks/bios, compact sub-header `.vtimeline-mood-row` transitions, hover tooltips, story slideshow trigger.
  - `src/pages/summary/WeeklyChartSection.tsx` — 7-day stats & interactive bar chart (`maxWeeklyHours > 0` guarded).
  - `src/pages/summary/ReasonsBreakdownCard.tsx` — Accordion breakdown across Distractions / Break Overtime / Endings tabs (shown in both Daily and Weekly views).
  - `src/pages/summary/AdhdInsightsCard.tsx` — 6 ADHD self-awareness cards (Focus Threshold, Trigger Ratio, Transition Friction, Completion/Hyperfocus, Peak Hours, Mood Flow) + dynamic tip.
- `src/pages/DashboardPage.tsx` — Expanded desktop analytics & cloud sync overview.
- `src/pages/SettingsPage.tsx` — Plans, global shortcuts, theme/accent, ambient noise, break checklists, custom window sizes, feedback.

### Reusable UI & Modals (`src/components/`)
- `src/components/modals/` — Extracted session modal dialogs:
  - `types.ts`, `ShortBreakPromptModal.tsx`, `WorkTopicModal.tsx`, `DistractModal.tsx`, `EarlyStopModal.tsx`, `BreakOverdueModal.tsx`, `LightboxModal.tsx`, `StuckRescueModal.tsx`.
- `src/components/SessionModals.tsx` — Barrel re-export for `src/components/modals/*`.
- `src/components/ParkingLot.tsx` — Task/Idea/Screenshot parking list + `SessionStorySlideshow` + `matchSessionStoryEntries`.
- `src/components/BioIcon.tsx` — Shared `renderBioIcon` helper across Home & Summary.
- `src/components/TimeInput24.tsx` — Controlled `HH:MM` 24-hour input with wheel/Enter submit passing normalized value.
- `src/components/VisualTimer.tsx`, `src/components/MiniDock.tsx`, `src/components/InlineTagForm.tsx`, `src/components/TagManagerSection.tsx`, `src/components/Icons.tsx`.

### Database (`src/db/` — `@tauri-apps/plugin-sql`, `sqlite:pomodoro.db`)
- `src/db/core.ts` — Schema creation, `ALTER_MIGRATIONS`, active day management.
- `src/db/types.ts` — Shared TypeScript interfaces (`RuntimeState`, `TimelineSessionItem`, `AdhdInsightsData`, `BioLogItem`, `MoodLogItem`, etc.).
- `src/db/sessions.ts` — Session recording (`work`/`break`/`idle`), deletion (`deleteWorkSessionById` also cleans `mood_logs`), `getTimelineSessions` (clamps midnight-crossing rows when `dateRange` applies), `getWeeklySummary`.
- `src/db/distractions.ts` — Distraction logging, tag summaries, `getPreviousReasons`, `getAdhdInsights` (queries `sessions` + `distractions` + `mood_logs`).
- `src/db/bioAndMood.ts` — Biological log CRUD (`HH:MM` normalized) & mood logs.
- `src/db/parking.ts`, `src/db/contextAndStory.ts`, `src/db/settings.ts`, `src/db/cloud.ts`, `src/db/index.ts`.

### Hooks, Utilities & Styles (`src/hooks/`, `src/lib/`, `src/styles/`)
- `src/hooks/` — Focus-extracted App coordinators:
  - `useAppSettingsAndTags.ts` — Study plans, theme, ambient noise, rescue settings, break checklist, shortcuts, autostart, updater & inline tag CRUD.
  - `useWindowSizing.ts` — DPI zoom sync, custom window presets & monitor-clamped auto-sizing (synced with sequential break strip heights).
  - `useSummaryAndParking.ts` — Daily/Weekly summary, dashboard stats, timeline selection, ADHD insights, parking lot actions, lightbox & JSON export.
  - `useSystemWatchers.ts` — Windows Focus Assist, tray tooltip, 5m periodic story capture, spotlight context snapshot & Tauri tray/OS-resume listeners.
  - `useTimerLoop.ts` — Wall-clock tick loop, OS sleep/idle checks, work-pause clock, phase milestones & mode-switch transitions.
  - `useBioAndMood.ts`, `useCloudSync.ts`, `useFeedback.ts`, `useMiniDock.ts`.
- `src/lib/` — `ambientNoise.ts`, `audio.ts`, `color.ts`, `keyCombo.ts`, `windowResize.ts`.
- `src/styles/` — `tokens.css`, `base.css`, `menu.css`, `timer.css`, `summary.css`, `settings.css`, `dashboard.css`, `modals.css`, `parking.css`, `quickcapture.css`.

### Rust Backend (`src-tauri/src/`)
- `src-tauri/src/lib.rs` — Tauri builder, commands (`set_window_zoom`, `close_capture_and_restore_focus`, `set_capture_window_size`, etc.), window event handlers, and `RunEvent::Exit` cleanup calling `focus_mode::restore_focus_mode_on_exit()`.
- `src-tauri/src/capture.rs` — Screen capture via Windows GDI (`StretchBlt` + `HALFTONE` + `SetBrushOrgEx`, deselects `HBITMAP` before `GetDIBits`, validates `lines == target_h`) and macOS `screencapture` fallback.
- `src-tauri/src/focus_mode.rs` — Windows Focus Assist toggle & exit restoration guard (`FOCUS_MODE_ACTIVE`).
- `src-tauri/src/tray.rs` — System tray icon menu (`toggle` respects `!is_visible || is_minimized`, `quit` restores focus mode).
- `src-tauri/src/active_window.rs` & `src-tauri/src/shortcuts.rs` — Foreground window watcher/restorer & global shortcuts.

---

## SQLite Tables (`sqlite:pomodoro.db` in `src/db/core.ts`)

- **`study_days`**: `id`, `label`, `started_at`, `ended_at`, `is_active`
- **`sessions`**: `id`, `day_id`, `mode`, `duration_sec`, `created_at`, plus migrations: `tag`, `reason`, `started_at`, `ended_at`, `overtime_sec`, `end_tag`, `end_reason`, `hyperfocus_sec`, `mood_before`, `mood_after`, `plan_name`, `round_index`, `is_completed`, `session_group_id`
- **`distractions`**: `id`, `day_id`, `reason`, `created_at`, plus migrations: `elapsed_work_sec`, `trigger_type`, `category`, `active_app`, `active_window`, `context_text`, `penalty_sec`, `tag`, `is_off_session`
- **`bio_logs`**: `id`, `day_id`, `event_type`, `event_time`, `note`, `created_at`, plus migration: `sleep_hours`
- **`mood_logs`**: `id`, `day_id`, `phase`, `mood`, `note`, `session_id`, `created_at`
- **`parking_items`**: `id`, `day_id`, `item_type`, `content`, `status`, `active_app`, `active_window`, `context_text`, `screenshot_data`, `keep_synced`, `keep_note_id`, `created_at`, `updated_at`, plus migration: `bucket`
- **`context_logs`**: `id`, `day_id`, `context_text`, `work_tag`, `active_app`, `active_window`, `duration_sec`, `distraction_count`, `started_at`, `ended_at`
- **`work_story_entries`**: `id`, `day_id`, `entry_type`, `context_text`, `work_tag`, `active_app`, `active_window`, `note`, `screenshot_data`, `elapsed_work_sec`, `created_at`
- **`tags` / `settings` / `app_state` / `feedbacks` / `sync_queue`**

---

## Core Invariants

1. **Timeline Grouping (`buildVerticalTimelineModel`):** Work rounds sharing `sessionGroupId` aggregate under the earliest round's start time (`minStartItem`), sum `durationSec`/`overtimeSec`/`hyperfocusSec`, recompute `startedAt` and `durationLabel`, and nest mid-session breaks & bio events occurring inside that span.
2. **Colorblindness Palette Safety:** Avoid pairing red and green on Timeline/Settings views, and avoid purple adjacent to Cobalt Blue on Timeline candles (Work = blue, Break = slate, Pause = gold-yellow, Overtime/Gap = coral).
3. **Windows WebView2 Focus & Resize:** `close_capture_and_restore_focus` calls `restore_hwnd(prev_hwnd)` *before* hiding the capture window so Windows allows foreground handoff; `useMiniDock` guards state across async awaits and bumps resize sequence counters via `src/lib/windowResize.ts`.
4. **Windows Focus Assist & GDI Capture:** `RunEvent::Exit` and tray `"quit"` always invoke `focus_mode::restore_focus_mode_on_exit()`. GDI screen capture deselects the `HBITMAP` before `GetDIBits` and rejects partial scanline returns (`lines != target_h`).
