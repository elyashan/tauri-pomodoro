import {
  getDb,
  getSetting,
  getSettingsMap,
  setSetting,
  setSettings,
} from "./core";
import {
  AmbientNoiseSettings,
  AmbientSoundType,
  CustomWindowSizes,
  DEFAULT_AMBIENT_NOISE,
  DEFAULT_RESCUE_EXERCISES,
  DEFAULT_SHORTCUTS,
  DEFAULT_STUDY_PLANS,
  DEFAULT_THEME,
  FeedbackCategory,
  FeedbackItem,
  GlobalShortcutSettings,
  LangCode,
  RescueExerciseSettings,
  SizeTargetPage,
  StudyPlan,
  ThemeSettings,
  TimerVisualStyle,
} from "./types";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const LEGACY_PLAN_NAMES = new Set([
  "Geliştirici Standardı",
  "Klasik Pomodoro",
  "Ultradian Ritmi",
  "Özel Plan",
]);

function sanitizePlan(raw: Partial<StudyPlan>, fallback: StudyPlan): StudyPlan {
  const num = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  return {
    id: fallback.id,
    name: LEGACY_PLAN_NAMES.has(name) ? "" : name.slice(0, 24),
    workMins: num(raw.workMins, 1, 240, fallback.workMins),
    shortBreakMins: num(raw.shortBreakMins, 1, 60, fallback.shortBreakMins),
    standardBreakMins: num(
      raw.standardBreakMins,
      1,
      90,
      fallback.standardBreakMins,
    ),
    longBreakMins: num(raw.longBreakMins, 1, 180, fallback.longBreakMins),
    longBreakInterval: num(
      raw.longBreakInterval,
      1,
      12,
      fallback.longBreakInterval,
    ),
  };
}

// ---------------------------------------------------------------------------
// Core Preferences (Penalty, Language, Theme)
// ---------------------------------------------------------------------------

export async function loadDistractPenalty(): Promise<number> {
  const val = await getSetting("distractPenaltyMins");
  if (val === null) return 1;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 1;
}

export async function saveDistractPenalty(mins: number): Promise<void> {
  await setSetting("distractPenaltyMins", String(mins));
}

export async function loadLanguagePreference(): Promise<LangCode> {
  const val = await getSetting("language");
  return val === "tr" || val === "en" || val === "auto" ? val : "auto";
}

export async function saveLanguagePreference(lang: LangCode): Promise<void> {
  await setSetting("language", lang);
}

export async function loadThemeSettings(): Promise<ThemeSettings> {
  const map = await getSettingsMap([
    "bgColor",
    "bgOpacity",
    "timerColor",
    "uiScale",
    "timerStyle",
  ]);
  const bgColor = map.get("bgColor") ?? "";
  const timerColor = map.get("timerColor") ?? "";
  const opacity = Number(map.get("bgOpacity"));
  const rawScale = Number(map.get("uiScale"));
  const rawStyle = map.get("timerStyle");
  const timerStyle: TimerVisualStyle =
    rawStyle === "pie" || rawStyle === "candle" ? rawStyle : "digital";

  return {
    bgColor: HEX_COLOR.test(bgColor) ? bgColor : DEFAULT_THEME.bgColor,
    timerColor: HEX_COLOR.test(timerColor)
      ? timerColor
      : DEFAULT_THEME.timerColor,
    bgOpacity:
      Number.isFinite(opacity) && opacity >= 30 && opacity <= 100
        ? Math.round(opacity)
        : DEFAULT_THEME.bgOpacity,
    uiScale:
      rawScale === 125 || rawScale === 150 ? rawScale : DEFAULT_THEME.uiScale,
    timerStyle,
  };
}

export async function saveThemeSettings(theme: ThemeSettings): Promise<void> {
  await setSettings([
    ["bgColor", theme.bgColor],
    ["bgOpacity", String(theme.bgOpacity)],
    ["timerColor", theme.timerColor],
    ["uiScale", String(theme.uiScale)],
    ["timerStyle", theme.timerStyle || "digital"],
  ]);
}

// ---------------------------------------------------------------------------
// Study Plans & Session Cycle Counters
// ---------------------------------------------------------------------------

export async function loadStudyPlans(): Promise<StudyPlan[]> {
  const raw = await getSetting("studyPlans");
  if (!raw) return DEFAULT_STUDY_PLANS.map((p) => ({ ...p }));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return DEFAULT_STUDY_PLANS.map((def) => {
        const found = parsed.find(
          (item: Partial<StudyPlan>) => item && item.id === def.id,
        );
        return found ? sanitizePlan(found, def) : { ...def };
      });
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_STUDY_PLANS.map((p) => ({ ...p }));
}

export async function saveStudyPlans(plans: StudyPlan[]): Promise<void> {
  const sanitized = DEFAULT_STUDY_PLANS.map((def) => {
    const found = plans.find((p) => p.id === def.id);
    return found ? sanitizePlan(found, def) : { ...def };
  });
  await setSetting("studyPlans", JSON.stringify(sanitized));
}

export async function loadActivePlanId(): Promise<string> {
  return (await getSetting("activePlanId")) || "developer";
}

export async function saveActivePlanId(id: string): Promise<void> {
  await setSetting("activePlanId", id);
}

export async function loadSessionCycleStats(): Promise<{
  completedWorkCount: number;
  shortBreakCount: number;
}> {
  const map = await getSettingsMap([
    "completedWorkCount",
    "sessionShortBreakCount",
  ]);
  const c = parseInt(map.get("completedWorkCount") || "0", 10);
  const s = parseInt(map.get("sessionShortBreakCount") || "0", 10);
  return {
    completedWorkCount: Number.isFinite(c) && c >= 0 ? c : 0,
    shortBreakCount: Number.isFinite(s) && s >= 0 ? s : 0,
  };
}

export async function saveSessionCycleStats(
  completedWorkCount: number,
  shortBreakCount: number,
): Promise<void> {
  await setSettings([
    ["completedWorkCount", String(completedWorkCount)],
    ["sessionShortBreakCount", String(shortBreakCount)],
  ]);
}

// ---------------------------------------------------------------------------
// Custom Window Sizes & Global Shortcuts
// ---------------------------------------------------------------------------

export async function loadCustomWindowSizes(): Promise<CustomWindowSizes> {
  const raw = await getSetting("customWindowSizes");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomWindowSizes = {};
    for (const k of [
      "timer",
      "menu",
      "summary",
      "settings",
      "dashboard",
    ] as SizeTargetPage[]) {
      const item = parsed[k];
      if (item && typeof item === "object") {
        const w = Math.round(Number(item.width));
        const h = Math.round(Number(item.height));
        if (
          Number.isFinite(w) &&
          Number.isFinite(h) &&
          w >= 200 &&
          w <= 1400 &&
          h >= 110 &&
          h <= 1100
        ) {
          out[k] = { width: w, height: h };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveCustomWindowSizes(
  sizes: CustomWindowSizes,
): Promise<void> {
  await setSetting("customWindowSizes", JSON.stringify(sizes));
}

export async function resetCustomWindowSizes(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM settings WHERE key = 'customWindowSizes'");
}

export async function loadGlobalShortcuts(): Promise<GlobalShortcutSettings> {
  const map = await getSettingsMap(["distractionShortcut"]);
  const saved = map.get("distractionShortcut")?.trim();
  return {
    distractionShortcut:
      !saved || saved === "Ctrl+Shift+D"
        ? DEFAULT_SHORTCUTS.distractionShortcut
        : saved,
    contextShortcut: "",
  };
}

export async function saveGlobalShortcuts(
  shortcuts: GlobalShortcutSettings,
): Promise<void> {
  await setSettings([
    ["distractionShortcut", shortcuts.distractionShortcut.trim()],
    ["contextShortcut", ""],
  ]);
}

// ---------------------------------------------------------------------------
// Ambient Focus Sound, Rescue Exercises & Break Reminder Notes
// ---------------------------------------------------------------------------

export async function loadAmbientNoiseSettings(): Promise<AmbientNoiseSettings> {
  const raw = await getSetting("ambientNoiseSettings");
  if (!raw) return { ...DEFAULT_AMBIENT_NOISE };
  try {
    const parsed = JSON.parse(raw) as Partial<AmbientNoiseSettings>;
    const sound: AmbientSoundType =
      parsed.sound === "brown" ||
      parsed.sound === "pink" ||
      parsed.sound === "white" ||
      parsed.sound === "rain"
        ? parsed.sound
        : "off";
    const vol = Number(parsed.volume);
    return {
      sound,
      volume:
        Number.isFinite(vol) && vol >= 0 && vol <= 100
          ? Math.round(vol)
          : DEFAULT_AMBIENT_NOISE.volume,
      playOnlyInWork:
        typeof parsed.playOnlyInWork === "boolean"
          ? parsed.playOnlyInWork
          : DEFAULT_AMBIENT_NOISE.playOnlyInWork,
    };
  } catch {
    return { ...DEFAULT_AMBIENT_NOISE };
  }
}

export async function saveAmbientNoiseSettings(
  cfg: AmbientNoiseSettings,
): Promise<void> {
  await setSetting("ambientNoiseSettings", JSON.stringify(cfg));
}

export async function loadRescueExerciseSettings(): Promise<RescueExerciseSettings> {
  const raw = await getSetting("rescueExerciseSettings");
  if (!raw) return { ...DEFAULT_RESCUE_EXERCISES };
  try {
    const parsed = JSON.parse(raw) as Partial<RescueExerciseSettings>;
    return {
      breathing:
        typeof parsed.breathing === "boolean" ? parsed.breathing : true,
      gaze: typeof parsed.gaze === "boolean" ? parsed.gaze : true,
      physical: typeof parsed.physical === "boolean" ? parsed.physical : true,
    };
  } catch {
    return { ...DEFAULT_RESCUE_EXERCISES };
  }
}

export async function saveRescueExerciseSettings(
  cfg: RescueExerciseSettings,
): Promise<void> {
  await setSetting("rescueExerciseSettings", JSON.stringify(cfg));
}

export async function loadBreakChecklistItems(
  defaults: string[],
): Promise<string[]> {
  const raw = await getSetting("breakChecklistItems");
  if (!raw) return [...defaults];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaults];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [...defaults];
  }
}

export async function saveBreakChecklistItems(items: string[]): Promise<void> {
  await setSetting("breakChecklistItems", JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// In-App Feedback & Full JSON Export
// ---------------------------------------------------------------------------

export async function addFeedback(
  category: FeedbackCategory,
  rawMessage: string,
): Promise<FeedbackItem | null> {
  const message = rawMessage.trim();
  if (!message) return null;
  const db = await getDb();
  const created_at = new Date().toISOString();
  const res = await db.execute(
    "INSERT INTO feedbacks (category, message, created_at) VALUES ($1, $2, $3)",
    [category, message, created_at],
  );
  return {
    id: Number(res.lastInsertId),
    category,
    message,
    created_at,
  };
}

export async function getFeedbacks(): Promise<FeedbackItem[]> {
  const db = await getDb();
  const rows = await db.select<FeedbackItem[]>(
    "SELECT id, category, message, created_at FROM feedbacks ORDER BY id DESC",
  );
  return rows.map((r) => ({
    id: Number(r.id),
    category:
      r.category === "bug" || r.category === "ui" || r.category === "other"
        ? r.category
        : "feature",
    message: r.message,
    created_at: r.created_at,
  }));
}

export async function deleteFeedback(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM feedbacks WHERE id = $1", [id]);
}

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const [
    study_days,
    sessions,
    distractions,
    rawParkingItems,
    context_logs,
    tags,
    feedbacks,
    settings,
    bio_logs,
    mood_logs,
  ] = await Promise.all([
    db.select("SELECT * FROM study_days ORDER BY id ASC"),
    db.select("SELECT * FROM sessions ORDER BY id ASC"),
    db.select("SELECT * FROM distractions ORDER BY id ASC"),
    db.select<Record<string, unknown>[]>(
      "SELECT * FROM parking_items WHERE COALESCE(item_type, '') != 'screenshot' ORDER BY id ASC",
    ),
    db.select("SELECT * FROM context_logs ORDER BY id ASC"),
    db.select("SELECT * FROM tags ORDER BY id ASC"),
    db.select("SELECT * FROM feedbacks ORDER BY id DESC"),
    db.select("SELECT * FROM settings ORDER BY key ASC"),
    db.select("SELECT * FROM bio_logs ORDER BY id ASC"),
    db.select("SELECT * FROM mood_logs ORDER BY id ASC"),
  ]);

  const parking_items = rawParkingItems.map(
    ({ screenshot_data: _img, ...rest }) => rest,
  );

  return JSON.stringify(
    {
      app: "pomodoro-widget",
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      study_days,
      sessions,
      distractions,
      parking_items,
      context_logs,
      tags,
      feedbacks,
      settings,
      bio_logs,
      mood_logs,
    },
    null,
    2,
  );
}
