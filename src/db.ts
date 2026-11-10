import Database from "@tauri-apps/plugin-sql";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

// "work" / "break" eski sürümlerden kalan değerlerdir; yeni sürümde sayaç ekranı "timer"dır.
export type PageType = "menu" | "timer" | "work" | "break" | "summary" | "settings" | "dashboard";
export type TimerMode = "work" | "break";
export type BreakKind = "standard" | "long" | "short";

// Uygulama kapanıp açıldığında seansın kaldığı yerden devam edebilmesi için
// sayaç dışındaki çalışma zamanı durumu.
export interface RuntimeState {
  sessionActive: boolean;
  mode: TimerMode;
  breakKind: BreakKind;
  breakTotalSec: number;
  breakElapsedSec: number;
  breakOverdueSec: number;
  breakOvertimeAccumSec: number;
  savedWorkSecondsLeft: number;
  savedWorkElapsedSec: number;
  workStartedAt: string | null;
  breakStartedAt: string | null;
  workTag: string;
  workReason: string;
  sessionDistractions: number;
  currentContext: string;
  activeContextLogId: number | null;
  contextStartedAtElapsedSec: number;
  shortBreakNote?: string;
}

export interface ThemeSettings {
  bgColor: string; // "#rrggbb"
  bgOpacity: number; // 30-100 (%)
  timerColor: string; // "#rrggbb"
}

export const DEFAULT_THEME: ThemeSettings = {
  bgColor: "#1a1814",
  bgOpacity: 82,
  timerColor: "#ffffff",
};

export interface AppState {
  page: PageType;
  work_seconds_left: number;
  work_elapsed_sec: number;
  break_seconds_left: number;
}

export interface ActiveDayStats {
  dayId: number;
  label: string;
  totalSec: number;
  sessionCount: number;
  avgSec: number;
}

export interface DaySummary {
  id: number;
  label: string;
  total_sec: number;
  session_count: number;
  is_active: number;
}

export interface DistractionFrequency {
  reason: string;
  count: number;
}

export type TagKind = "distraction" | "ending" | "work" | "break_overtime";
export type DistractionTrigger = "internal" | "external";
export type DistractionCategory =
  | "impulsive_task"
  | "idea"
  | "screenshot_note"
  | "internal"
  | "external"
  | "escape";

export function doesCategoryAddPenalty(cat: DistractionCategory): boolean {
  // 1: Dürtüsel görev, 2: Akla gelen fikir ve 3: SS Alma (Ekran Görüntüsü Notu) için ek süre eklenmez.
  // 4: İçsel tetikleyici, 5: Dışsal tetikleyici ve 6: Zorluktan kaçış için süre eklenir.
  return cat === "internal" || cat === "external" || cat === "escape";
}

export function categoryToTrigger(cat: DistractionCategory): DistractionTrigger {
  return cat === "external" ? "external" : "internal";
}

export type ParkingItemType = "task" | "idea" | "screenshot";
export type ParkingStatus =
  | "pending"
  | "done"
  | "unrated"
  | "important"
  | "unimportant";

export interface ParkingItem {
  id: number;
  day_id: number;
  item_type: ParkingItemType;
  content: string;
  status: ParkingStatus;
  active_app: string | null;
  active_window: string | null;
  context_text: string | null;
  screenshot_data: string | null;
  keep_synced: number;
  keep_note_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParkingLotData {
  pendingTasks: ParkingItem[];
  doneTasks: ParkingItem[];
  unratedIdeas: ParkingItem[];
  importantIdeas: ParkingItem[];
  unimportantIdeas: ParkingItem[];
  screenshotNotes: ParkingItem[];
  totalTasks: number;
  totalIdeas: number;
  totalScreenshots: number;
}

export type WorkStoryEntryType = "periodic" | "screenshot_note" | "distraction";

export interface WorkStoryEntry {
  id: number;
  day_id: number;
  entry_type: WorkStoryEntryType;
  context_text: string | null;
  work_tag: string | null;
  active_app: string | null;
  active_window: string | null;
  note: string | null;
  screenshot_data: string | null;
  elapsed_work_sec: number;
  created_at: string;
}

export interface CloudAuthState {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  accessToken?: string;
  serverUrl: string;
  googleClientId?: string;
  autoSyncKeep: boolean;
  lastSyncAt: string | null;
}

export const DEFAULT_CLOUD_AUTH: CloudAuthState = {
  userId: "",
  email: "",
  name: "",
  picture: "",
  accessToken: "",
  serverUrl: "http://localhost:4000",
  googleClientId: "",
  autoSyncKeep: true,
  lastSyncAt: null,
};

export interface SyncQueueItem {
  id: number;
  entity_type: string;
  payload_json: string;
  created_at: string;
}

export interface ContextStatItem {
  contextText: string;
  totalDurationSec: number;
  entryCount: number;
  distractionCount: number;
  lastWorkTag: string | null;
  topApp: string | null;
}

export interface AppDistractionDetail {
  windowTitle: string;
  contextText: string | null;
  reason: string;
  category: DistractionCategory;
  count: number;
}

export interface AppDistractionGroup {
  appName: string;
  totalCount: number;
  details: AppDistractionDetail[];
}

export interface GlobalShortcutSettings {
  distractionShortcut: string;
  contextShortcut: string;
}

export const DEFAULT_SHORTCUTS: GlobalShortcutSettings = {
  distractionShortcut: "Ctrl+Shift+D",
  contextShortcut: "Ctrl+Alt+C",
};

export type FeedbackCategory = "bug" | "feature" | "ui" | "other";

export interface FeedbackItem {
  id: number;
  category: FeedbackCategory;
  message: string;
  created_at: string;
}

export interface WindowSizePreset {
  width: number;
  height: number;
}

export type SizeTargetPage = "timer" | "menu" | "summary" | "settings" | "dashboard";
export type CustomWindowSizes = Partial<Record<SizeTargetPage, WindowSizePreset>>;

export interface AdhdInsightsData {
  avgFocusThresholdMins: number | null;
  internalCount: number;
  externalCount: number;
  internalPct: number;
  peakFocusHoursLabel: string | null;
  mostDistractedHoursLabel: string | null;
  avgBreakOvertimeMins: number;
  overtimeBreakRatePct: number;
  completionRatePct: number;
  hyperfocusCount: number;
  topTriggerTag: string | null;
}

export interface TagItem {
  id: number;
  name: string;
  kind: TagKind;
}

export interface TagSummaryItem {
  tag: string;
  count: number;
  explanations: { reason: string; count: number }[];
}

export interface SummaryReasonsData {
  workTags: TagSummaryItem[];
  breakOvertimeTags: TagSummaryItem[];
  distractionTags: TagSummaryItem[];
  endingTags: TagSummaryItem[];
  totalWorkSubjects: number;
  totalBreakOvertimes: number;
  totalDistractions: number;
  totalEndings: number;
  avgDistractionsPerSession: number;
}

export interface TimelineSessionItem {
  id: number;
  dayId: number;
  mode: "work" | "break";
  durationSec: number;
  overtimeSec: number;
  tag: string | null;
  reason: string | null;
  startedAt: string;
  endedAt: string;
  startHour: number;
  endHour: number;
  timeRangeLabel: string;
  durationLabel: string;
}

export interface WeekDayStat {
  dayIndex: number;
  shortLabel: string;
  dateLabel: string;
  fullDateStr: string;
  total_sec: number;
  session_count: number;
  is_today: boolean;
}

export interface WeeklySummary {
  days: WeekDayStat[];
  totalSec: number;
  sessionCount: number;
  dailyAvgSec: number;
  activeDaysCount: number;
}

export interface StudyPlan {
  id: string; // "developer" | "classic" | "ultradian" | "custom"
  name: string;
  workMins: number;
  shortBreakMins: number;
  standardBreakMins: number;
  longBreakMins: number;
  longBreakInterval: number;
}

// Plan adı boş ("") ise arayüz, aktif dile göre varsayılan kısa adı gösterir.
export const DEFAULT_STUDY_PLANS: StudyPlan[] = [
  {
    id: "classic",
    name: "",
    workMins: 25,
    shortBreakMins: 3,
    standardBreakMins: 5,
    longBreakMins: 25,
    longBreakInterval: 4,
  },
  {
    id: "developer",
    name: "",
    workMins: 50,
    shortBreakMins: 5,
    standardBreakMins: 10,
    longBreakMins: 30,
    longBreakInterval: 3,
  },
  {
    id: "ultradian",
    name: "",
    workMins: 90,
    shortBreakMins: 5,
    standardBreakMins: 20,
    longBreakMins: 45,
    longBreakInterval: 2,
  },
  {
    id: "custom",
    name: "",
    workMins: 40,
    shortBreakMins: 5,
    standardBreakMins: 10,
    longBreakMins: 25,
    longBreakInterval: 3,
  },
];

// Önceki sürümlerin kaydettiği uzun varsayılan adlar; bunlar da "varsayılan ad" sayılır.
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
    standardBreakMins: num(raw.standardBreakMins, 1, 90, fallback.standardBreakMins),
    longBreakMins: num(raw.longBreakMins, 1, 180, fallback.longBreakMins),
    longBreakInterval: num(raw.longBreakInterval, 1, 12, fallback.longBreakInterval),
  };
}

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

export const DEFAULT_WORK_SEC = 50 * 60;
export const DEFAULT_BREAK_SEC = 10 * 60;

const DB_URL = "sqlite:pomodoro.db";
const SUMMARY_DAY_LIMIT = 7;
const VALID_PAGES: PageType[] = ["menu", "timer", "work", "break", "summary", "settings", "dashboard"];

const DEFAULT_REASONS = [
  "Telefon",
  "Sosyal Medya",
  "Mesaj / Bildirim",
  "Dış Gürültü",
];

// ---------------------------------------------------------------------------
// Bağlantı ve şema
// ---------------------------------------------------------------------------

// Promise'i önbelleğe alıyoruz; böylece aynı anda gelen çağrılar
// birden fazla bağlantı açıp şemayı paralel oluşturmaya çalışmaz.
let dbPromise: Promise<Database> | null = null;

async function initDb(): Promise<Database> {
  const db = await Database.load(DB_URL);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS study_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS distractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      page TEXT NOT NULL,
      work_seconds_left INTEGER NOT NULL,
      work_elapsed_sec INTEGER NOT NULL,
      break_seconds_left INTEGER NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'distraction',
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'feature',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS parking_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      active_app TEXT,
      active_window TEXT,
      context_text TEXT,
      screenshot_data TEXT,
      keep_synced INTEGER NOT NULL DEFAULT 0,
      keep_note_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS context_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      context_text TEXT NOT NULL,
      work_tag TEXT,
      active_app TEXT,
      active_window TEXT,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      distraction_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      ended_at TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS work_story_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'periodic',
      context_text TEXT,
      work_tag TEXT,
      active_app TEXT,
      active_window TEXT,
      note TEXT,
      screenshot_data TEXT,
      elapsed_work_sec INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  try {
    await db.execute("ALTER TABLE parking_items ADD COLUMN screenshot_data TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE parking_items ADD COLUMN keep_synced INTEGER NOT NULL DEFAULT 0");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE parking_items ADD COLUMN keep_note_id TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN elapsed_work_sec INTEGER DEFAULT 0");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN trigger_type TEXT DEFAULT 'internal'");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN category TEXT DEFAULT 'internal'");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN active_app TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN active_window TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN context_text TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN penalty_sec INTEGER DEFAULT 0");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE tags ADD COLUMN kind TEXT NOT NULL DEFAULT 'distraction'");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE distractions ADD COLUMN tag TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN tag TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN reason TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN started_at TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN ended_at TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN overtime_sec INTEGER DEFAULT 0");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  // Erken bitirme nedeni, çalışma konusundan (tag/reason) ayrı tutulur.
  // Önceden ikisi aynı sütunları paylaştığı için özet verileri birbirine karışıyordu.
  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN end_tag TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN end_reason TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

  // v0.1.7 ve öncesinde (started_at olmayan kayıtlar) tag/reason sadece erken
  // bitirme nedeni için kullanılıyordu; bunları yeni sütunlara taşı.
  await db.execute(
    `UPDATE sessions
     SET end_tag = tag, end_reason = reason, tag = NULL, reason = NULL
     WHERE mode = 'work' AND started_at IS NULL AND end_tag IS NULL
       AND (tag IS NOT NULL OR reason IS NOT NULL)`,
  );

  return db;
}

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = initDb().catch((err) => {
      // Başarısız olursa bir sonraki çağrıda tekrar denensin
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function enqueueSyncMutation(
  db: Database,
  entityType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.execute(
      "INSERT INTO sync_queue (entity_type, payload_json, created_at) VALUES ($1, $2, $3)",
      [entityType, JSON.stringify(payload), new Date().toISOString()],
    );
  } catch {
    // Kuyruk hatası ana akışı engellemez
  }
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function makeDayLabel(date: Date, locale = "tr-TR"): string {
  // Örn: "06 Kas" veya "06 Nov"
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

async function getOrCreateActiveDay(
  db: Database,
  locale = "tr-TR",
): Promise<{ id: number; label: string }> {
  const rows = await db.select<{ id: number; label: string }[]>(
    "SELECT id, label FROM study_days WHERE is_active = 1 ORDER BY id DESC LIMIT 1",
  );
  if (rows.length > 0) return rows[0];

  const now = new Date();
  const label = makeDayLabel(now, locale);
  const res = await db.execute(
    "INSERT INTO study_days (label, started_at, is_active) VALUES ($1, $2, 1)",
    [label, now.toISOString()],
  );
  return { id: Number(res.lastInsertId), label };
}

// ---------------------------------------------------------------------------
// Uygulama durumu (son kalınan yer)
// ---------------------------------------------------------------------------

export async function loadAppState(): Promise<AppState> {
  const db = await getDb();
  const rows = await db.select<AppState[]>(
    `SELECT page, work_seconds_left, work_elapsed_sec, break_seconds_left
     FROM app_state WHERE id = 1`,
  );

  if (rows.length === 0) {
    return {
      page: "menu",
      work_seconds_left: DEFAULT_WORK_SEC,
      work_elapsed_sec: 0,
      break_seconds_left: DEFAULT_BREAK_SEC,
    };
  }

  const row = rows[0];
  const wLeft = Number(row.work_seconds_left);
  const wElap = Number(row.work_elapsed_sec);
  const bLeft = Number(row.break_seconds_left);

  return {
    page: VALID_PAGES.includes(row.page) ? row.page : "menu",
    work_seconds_left:
      Number.isFinite(wLeft) && wLeft >= 0 ? wLeft : DEFAULT_WORK_SEC,
    work_elapsed_sec: Number.isFinite(wElap) && wElap >= 0 ? wElap : 0,
    break_seconds_left:
      Number.isFinite(bLeft) && bLeft >= 0 ? bLeft : DEFAULT_BREAK_SEC,
  };
}

export async function saveAppState(state: AppState): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_state (id, page, work_seconds_left, work_elapsed_sec, break_seconds_left)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       page = excluded.page,
       work_seconds_left = excluded.work_seconds_left,
       work_elapsed_sec = excluded.work_elapsed_sec,
       break_seconds_left = excluded.break_seconds_left`,
    [
      state.page,
      Math.max(0, Math.round(state.work_seconds_left)),
      Math.max(0, Math.round(state.work_elapsed_sec)),
      Math.max(0, Math.round(state.break_seconds_left)),
    ],
  );
}

// ---------------------------------------------------------------------------
// Günler ve seanslar
// ---------------------------------------------------------------------------

export async function getActiveDayStats(locale = "tr-TR"): Promise<ActiveDayStats> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db, locale);

  const rows = await db.select<{ total: number | null; cnt: number }[]>(
    `SELECT COALESCE(SUM(duration_sec), 0) AS total, COUNT(id) AS cnt
     FROM sessions
     WHERE day_id = $1 AND mode = 'work'`,
    [day.id],
  );

  const totalSec = Number(rows[0]?.total ?? 0);
  const sessionCount = Number(rows[0]?.cnt ?? 0);

  return {
    dayId: day.id,
    label: day.label,
    totalSec,
    sessionCount,
    avgSec: sessionCount > 0 ? Math.round(totalSec / sessionCount) : 0,
  };
}

// Aktif günü bitirir, yeni bir gün açar ve yeni günün (boş) istatistiklerini döner
export async function startNewDay(locale = "tr-TR"): Promise<ActiveDayStats> {
  const db = await getDb();
  const nowIso = new Date().toISOString();

  await db.execute(
    "UPDATE study_days SET is_active = 0, ended_at = $1 WHERE is_active = 1",
    [nowIso],
  );
  await db.execute(
    "INSERT INTO study_days (label, started_at, is_active) VALUES ($1, $2, 1)",
    [makeDayLabel(new Date(), locale), nowIso],
  );

  return getActiveDayStats(locale);
}

// Yeni bir seans başlatırken çağrılır. Aktif gün hâlihazırda boşsa (hiç kayıt
// yoksa) onu yeniden kullanır; böylece boş gün kayıtları birikmez.
export async function beginSessionDay(locale = "tr-TR"): Promise<ActiveDayStats> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db, locale);
  const rows = await db.select<{ cnt: number }[]>(
    `SELECT (SELECT COUNT(id) FROM sessions WHERE day_id = $1) +
            (SELECT COUNT(id) FROM distractions WHERE day_id = $1) +
            (SELECT COUNT(id) FROM parking_items WHERE day_id = $1) +
            (SELECT COUNT(id) FROM context_logs WHERE day_id = $1) AS cnt`,
    [day.id],
  );
  if (Number(rows[0]?.cnt ?? 0) > 0) {
    return startNewDay(locale);
  }
  const nowIso = new Date().toISOString();
  await db.execute(
    "UPDATE study_days SET label = $1, started_at = $2 WHERE id = $3",
    [makeDayLabel(new Date(), locale), nowIso, day.id],
  );
  return getActiveDayStats(locale);
}

export async function recordWorkSession(
  durationSec: number,
  tag?: string,
  reason?: string,
  startedAt?: string,
  endedAt?: string,
  endTag?: string,
  endReason?: string,
): Promise<void> {
  const sec = Math.round(durationSec);
  if (sec <= 0) return;

  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const now = new Date();
  const endIso = endedAt || now.toISOString();
  const startIso = startedAt || new Date(now.getTime() - sec * 1000).toISOString();

  await db.execute(
    `INSERT INTO sessions (day_id, mode, duration_sec, created_at, tag, reason, started_at, ended_at, overtime_sec, end_tag, end_reason)
     VALUES ($1, 'work', $2, $3, $4, $5, $6, $7, 0, $8, $9)`,
    [
      day.id,
      sec,
      endIso,
      tag || null,
      reason || null,
      startIso,
      endIso,
      endTag || null,
      endReason || null,
    ],
  );
  await enqueueSyncMutation(db, "session", {
    day_id: day.id,
    mode: "work",
    duration_sec: sec,
    created_at: endIso,
    tag: tag || null,
    reason: reason || null,
    started_at: startIso,
    ended_at: endIso,
    overtime_sec: 0,
    end_tag: endTag || null,
    end_reason: endReason || null,
  });
}

export async function recordBreakSession(
  durationSec: number,
  tag?: string,
  reason?: string,
  overtimeSec = 0,
  startedAt?: string,
  endedAt?: string,
): Promise<void> {
  const sec = Math.round(durationSec);
  if (sec <= 0) return;

  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const now = new Date();
  const endIso = endedAt || now.toISOString();
  const startIso = startedAt || new Date(now.getTime() - sec * 1000).toISOString();
  const overtime = Math.max(0, Math.round(overtimeSec));

  await db.execute(
    `INSERT INTO sessions (day_id, mode, duration_sec, created_at, tag, reason, started_at, ended_at, overtime_sec)
     VALUES ($1, 'break', $2, $3, $4, $5, $6, $7, $8)`,
    [
      day.id,
      sec,
      endIso,
      tag ?? null,
      reason ?? null,
      startIso,
      endIso,
      overtime,
    ],
  );
  await enqueueSyncMutation(db, "session", {
    day_id: day.id,
    mode: "break",
    duration_sec: sec,
    created_at: endIso,
    tag: tag ?? null,
    reason: reason ?? null,
    started_at: startIso,
    ended_at: endIso,
    overtime_sec: overtime,
  });
}

export async function getTimelineSessions(
  dayId?: number,
): Promise<TimelineSessionItem[]> {
  const db = await getDb();
  let targetDayId = dayId;
  if (!targetDayId) {
    const activeDay = await getOrCreateActiveDay(db);
    targetDayId = activeDay.id;
  }

  const rows = await db.select<{
    id: number;
    day_id: number;
    mode: string;
    duration_sec: number;
    created_at: string;
    tag: string | null;
    reason: string | null;
    started_at: string | null;
    ended_at: string | null;
    overtime_sec: number | null;
  }[]>(
    `SELECT id, day_id, mode, duration_sec, created_at, tag, reason, started_at, ended_at, overtime_sec
     FROM sessions
     WHERE day_id = $1
     ORDER BY COALESCE(started_at, created_at) ASC`,
    [targetDayId],
  );

  return rows.map((r) => {
    const dur = Number(r.duration_sec);
    const overtime = Number(r.overtime_sec ?? 0);
    const end = r.ended_at ? new Date(r.ended_at) : new Date(r.created_at);
    const start = r.started_at
      ? new Date(r.started_at)
      : new Date(end.getTime() - dur * 1000);

    const sH = Math.min(
      23.95,
      Math.max(
        0,
        start.getHours() +
          start.getMinutes() / 60 +
          start.getSeconds() / 3600,
      ),
    );
    const crossedMidnight =
      end.getFullYear() !== start.getFullYear() ||
      end.getMonth() !== start.getMonth() ||
      end.getDate() !== start.getDate();
    const rawEndH = crossedMidnight
      ? 24
      : end.getHours() + end.getMinutes() / 60 + end.getSeconds() / 3600;
    const eH = Math.min(24, Math.max(sH + 0.05, rawEndH));

    const pad = (n: number) => n.toString().padStart(2, "0");
    const timeRangeLabel = `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;

    const mins = Math.round(dur / 60);
    const durLabel =
      mins < 60
        ? `${mins} dk`
        : `${Math.floor(mins / 60)} sa ${mins % 60} dk`;

    return {
      id: Number(r.id),
      dayId: Number(r.day_id),
      mode: r.mode === "break" ? ("break" as const) : ("work" as const),
      durationSec: dur,
      overtimeSec: overtime,
      tag: r.tag,
      reason: r.reason,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      startHour: sH,
      endHour: eH,
      timeRangeLabel,
      durationLabel: durLabel,
    };
  });
}

// Özet grafiği için son N günü (eskiden yeniye) getirir
export async function getDaysSummary(): Promise<DaySummary[]> {
  const db = await getDb();
  // Hiç gün yoksa aktif günü oluştur ki grafik boş kalmasın
  await getOrCreateActiveDay(db);

  const rows = await db.select<DaySummary[]>(
    `SELECT d.id AS id,
            d.label AS label,
            d.is_active AS is_active,
            COALESCE(SUM(s.duration_sec), 0) AS total_sec,
            COUNT(s.id) AS session_count
     FROM study_days d
     LEFT JOIN sessions s ON s.day_id = d.id AND s.mode = 'work'
     GROUP BY d.id
     ORDER BY d.id DESC
     LIMIT $1`,
    [SUMMARY_DAY_LIMIT],
  );

  return rows
    .map((r) => ({
      id: Number(r.id),
      label: r.label,
      is_active: Number(r.is_active),
      total_sec: Number(r.total_sec),
      session_count: Number(r.session_count),
    }))
    .reverse();
}

// ---------------------------------------------------------------------------
// Dikkat dağılmaları
// ---------------------------------------------------------------------------

export interface RecordDistractionParams {
  reason: string;
  tag?: string;
  elapsedWorkSec?: number;
  category?: DistractionCategory;
  activeApp?: string;
  activeWindow?: string;
  contextText?: string;
  penaltySec?: number;
}

export async function recordDistraction(
  rawReasonOrParams: string | RecordDistractionParams,
  rawTag?: string,
  elapsedWorkSec = 0,
  triggerType: DistractionTrigger = "internal",
): Promise<void> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);

  let rawReason = "";
  let tagInput = rawTag;
  let elapsedInput = elapsedWorkSec;
  let category: DistractionCategory =
    triggerType === "external" ? "external" : "internal";
  let activeApp: string | null = null;
  let activeWindow: string | null = null;
  let contextText: string | null = null;
  let penaltySec = 0;

  if (typeof rawReasonOrParams === "string") {
    rawReason = rawReasonOrParams;
  } else {
    rawReason = rawReasonOrParams.reason;
    tagInput = rawReasonOrParams.tag;
    elapsedInput = rawReasonOrParams.elapsedWorkSec ?? 0;
    category = rawReasonOrParams.category ?? "internal";
    activeApp = rawReasonOrParams.activeApp?.trim() || null;
    activeWindow = rawReasonOrParams.activeWindow?.trim() || null;
    contextText = rawReasonOrParams.contextText?.trim() || null;
    penaltySec = Math.max(0, Math.round(Number(rawReasonOrParams.penaltySec) || 0));
  }

  const trimmed = rawReason.trim();
  const tag = (tagInput && tagInput.trim()) || "Diğer";
  const normalized =
    trimmed.length > 0
      ? trimmed.charAt(0).toLocaleUpperCase("tr-TR") + trimmed.slice(1)
      : tag;
  const elapsed = Math.max(0, Math.round(Number(elapsedInput) || 0));
  const trig: DistractionTrigger = categoryToTrigger(category);

  const nowIso = new Date().toISOString();
  await db.execute(
    `INSERT INTO distractions (
       day_id, reason, tag, created_at, elapsed_work_sec, trigger_type,
       category, active_app, active_window, context_text, penalty_sec
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      day.id,
      normalized,
      tag,
      nowIso,
      elapsed,
      trig,
      category,
      activeApp,
      activeWindow,
      contextText,
      penaltySec,
    ],
  );
  await enqueueSyncMutation(db, "distraction", {
    day_id: day.id,
    reason: normalized,
    tag,
    created_at: nowIso,
    elapsed_work_sec: elapsed,
    trigger_type: trig,
    category,
    active_app: activeApp,
    active_window: activeWindow,
    context_text: contextText,
    penalty_sec: penaltySec,
  });
}

// Daha önce seçilen şıkları en sık kullanılandan başlayarak getirir
export async function getReasonChoices(fallbackDefaults?: string[]): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ reason: string; cnt: number }[]>(`
    SELECT reason, COUNT(id) AS cnt, MAX(id) AS last_id
    FROM distractions
    GROUP BY reason
    ORDER BY cnt DESC, last_id DESC
    LIMIT 10
  `);

  const saved = rows.map((r) => r.reason);
  const defaults = fallbackDefaults && fallbackDefaults.length > 0 ? fallbackDefaults : DEFAULT_REASONS;
  for (const def of defaults) {
    if (
      !saved.some(
        (s) => s.toLocaleLowerCase() === def.toLocaleLowerCase(),
      )
    ) {
      saved.push(def);
    }
  }
  return saved.slice(0, 8);
}

// Özet ekranı için dikkat dağılma sıklığını (Bugün veya Tüm Günler) getirir
export async function getDistractionFrequencies(
  onlyToday: boolean,
): Promise<DistractionFrequency[]> {
  const db = await getDb();

  let rows: DistractionFrequency[];
  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    rows = await db.select<DistractionFrequency[]>(
      `SELECT reason, COUNT(id) AS count
       FROM distractions
       WHERE day_id = $1
       GROUP BY reason
       ORDER BY count DESC`,
      [day.id],
    );
  } else {
    rows = await db.select<DistractionFrequency[]>(`
      SELECT reason, COUNT(id) AS count
      FROM distractions
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 8
    `);
  }

  return rows.map((r) => ({ reason: r.reason, count: Number(r.count) }));
}

// ---------------------------------------------------------------------------
// Haftalık Özet
// ---------------------------------------------------------------------------

export async function getWeeklySummary(locale = "tr-TR"): Promise<WeeklySummary> {
  const db = await getDb();

  const now = new Date();
  const currentDay = now.getDay(); // 0: Pazar, 1: Pazartesi...
  const mondayOffset = (currentDay + 6) % 7; // Pazartesi 0, Salı 1... Pazar 6

  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const rows = await db.select<{ duration_sec: number; created_at: string }[]>(
    `SELECT duration_sec, created_at FROM sessions
     WHERE mode = 'work' AND created_at >= $1 AND created_at <= $2`,
    [monday.toISOString(), sunday.toISOString()],
  );

  const isTr = locale.toLowerCase().startsWith("tr");
  const shortDaysTr = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const shortDaysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const shortNames = isTr ? shortDaysTr : shortDaysEn;

  const days: WeekDayStat[] = [];
  let totalSec = 0;
  let totalSessions = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const dayYear = d.getFullYear();
    const dayMonth = d.getMonth();
    const dayDate = d.getDate();

    const matching = rows.filter((r) => {
      const rd = new Date(r.created_at);
      return (
        rd.getFullYear() === dayYear &&
        rd.getMonth() === dayMonth &&
        rd.getDate() === dayDate
      );
    });

    const daySec = matching.reduce((acc, r) => acc + Number(r.duration_sec), 0);
    const dayCount = matching.length;

    totalSec += daySec;
    totalSessions += dayCount;

    days.push({
      dayIndex: i,
      shortLabel: shortNames[i],
      dateLabel: d.toLocaleDateString(locale, { day: "2-digit", month: "short" }),
      fullDateStr: d.toISOString().slice(0, 10),
      total_sec: daySec,
      session_count: dayCount,
      is_today: isToday,
    });
  }

  const activeDaysCount = days.filter((d) => d.total_sec > 0).length;
  const dailyAvgSec = Math.round(totalSec / 7);

  return {
    days,
    totalSec,
    sessionCount: totalSessions,
    dailyAvgSec,
    activeDaysCount,
  };
}

// ---------------------------------------------------------------------------
// Verileri Sıfırlama
// ---------------------------------------------------------------------------

export async function clearAllData(locale = "tr-TR"): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM sessions");
  await db.execute("DELETE FROM distractions");
  await db.execute("DELETE FROM parking_items");
  await db.execute("DELETE FROM context_logs");
  await db.execute("DELETE FROM work_story_entries");
  await db.execute("DELETE FROM sync_queue");
  await db.execute("DELETE FROM study_days");
  await db.execute(
    "DELETE FROM settings WHERE key IN ('completedWorkCount', 'sessionShortBreakCount', 'runtimeState')",
  );
  await db.execute(
    "UPDATE app_state SET page = 'menu', work_seconds_left = $1, work_elapsed_sec = 0, break_seconds_left = $2 WHERE id = 1",
    [DEFAULT_WORK_SEC, DEFAULT_BREAK_SEC],
  );
  await getOrCreateActiveDay(db, locale);
}

// ---------------------------------------------------------------------------
// Tag ve Açıklama Yönetimi
// ---------------------------------------------------------------------------

export const DEFAULT_DISTRACTION_TAGS_TR = [
  "Telefon",
  "Sosyal Medya",
  "Çevre / İnsanlar",
  "Açlık / Mola",
  "Düşünceler",
  "Diğer",
];

export const DEFAULT_ENDING_TAGS_TR = [
  "Toplantı",
  "Yemek",
  "Mola İhtiyacı",
  "Acil İş",
  "Ders Bitti",
  "Yorgunluk",
  "Diğer",
];

export async function getTags(
  kind: TagKind,
  fallbackDefaults?: string[],
): Promise<TagItem[]> {
  const db = await getDb();
  const rows = await db.select<TagItem[]>(
    "SELECT id, name, kind FROM tags WHERE kind = $1 ORDER BY id ASC",
    [kind],
  );
  if (rows.length > 0) return rows;

  const defaults =
    fallbackDefaults && fallbackDefaults.length > 0
      ? fallbackDefaults
      : kind === "distraction"
        ? DEFAULT_DISTRACTION_TAGS_TR
        : DEFAULT_ENDING_TAGS_TR;

  const nowIso = new Date().toISOString();
  for (const name of defaults) {
    try {
      await db.execute(
        "INSERT INTO tags (name, kind, created_at) VALUES ($1, $2, $3)",
        [name, kind, nowIso],
      );
    } catch {
      // Çift kayıtları yoksay
    }
  }
  return db.select<TagItem[]>(
    "SELECT id, name, kind FROM tags WHERE kind = $1 ORDER BY id ASC",
    [kind],
  );
}

export async function addTag(
  rawName: string,
  kind: TagKind,
): Promise<TagItem | null> {
  const name = rawName.trim();
  if (!name) return null;
  const normalized = name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1);
  const db = await getDb();
  try {
    const res = await db.execute(
      "INSERT INTO tags (name, kind, created_at) VALUES ($1, $2, $3)",
      [normalized, kind, new Date().toISOString()],
    );
    return { id: Number(res.lastInsertId), name: normalized, kind };
  } catch {
    const rows = await db.select<TagItem[]>(
      "SELECT id, name, kind FROM tags WHERE name = $1 AND kind = $2",
      [normalized, kind],
    );
    return rows[0] ?? null;
  }
}

export async function updateTag(
  id: number,
  rawName: string,
  kind: TagKind,
): Promise<void> {
  const name = rawName.trim();
  if (!name) return;
  const normalized = name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1);
  const db = await getDb();
  const oldRows = await db.select<{ name: string }[]>(
    "SELECT name FROM tags WHERE id = $1",
    [id],
  );
  const oldName = oldRows[0]?.name;

  await db.execute("UPDATE tags SET name = $1 WHERE id = $2", [normalized, id]);
  if (oldName) {
    if (kind === "distraction") {
      await db.execute("UPDATE distractions SET tag = $1 WHERE tag = $2", [
        normalized,
        oldName,
      ]);
    } else if (kind === "ending") {
      await db.execute(
        "UPDATE sessions SET end_tag = $1 WHERE end_tag = $2 AND mode = 'work'",
        [normalized, oldName],
      );
    } else if (kind === "work") {
      await db.execute("UPDATE sessions SET tag = $1 WHERE tag = $2 AND mode = 'work'", [
        normalized,
        oldName,
      ]);
    } else if (kind === "break_overtime") {
      await db.execute("UPDATE sessions SET tag = $1 WHERE tag = $2 AND mode = 'break'", [
        normalized,
        oldName,
      ]);
    }
  }
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tags WHERE id = $1", [id]);
}

// Seçilen tag için (veya genel) daha önce girilen açıklamaları getirir
export async function getPreviousReasons(
  kind: TagKind,
  tag?: string,
): Promise<string[]> {
  const db = await getDb();
  if (kind === "distraction") {
    if (tag && tag.trim()) {
      const rows = await db.select<{ reason: string; cnt: number }[]>(
        `SELECT reason, COUNT(id) AS cnt FROM distractions
         WHERE tag = $1 AND reason IS NOT NULL AND reason != '' AND reason != tag
         GROUP BY reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
        [tag.trim()],
      );
      if (rows.length > 0) return rows.map((r) => r.reason);
    }
    const rows = await db.select<{ reason: string; cnt: number }[]>(
      `SELECT reason, COUNT(id) AS cnt FROM distractions
       WHERE reason IS NOT NULL AND reason != ''
       GROUP BY reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
    );
    return rows.map((r) => r.reason);
  } else if (kind === "work") {
    if (tag && tag.trim()) {
      const rows = await db.select<{ reason: string; cnt: number }[]>(
        `SELECT reason, COUNT(id) AS cnt FROM sessions
         WHERE mode = 'work' AND tag = $1 AND reason IS NOT NULL AND reason != '' AND reason != tag
         GROUP BY reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
        [tag.trim()],
      );
      if (rows.length > 0) return rows.map((r) => r.reason);
    }
    const rows = await db.select<{ reason: string; cnt: number }[]>(
      `SELECT reason, COUNT(id) AS cnt FROM sessions
       WHERE mode = 'work' AND reason IS NOT NULL AND reason != ''
       GROUP BY reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
    );
    return rows.map((r) => r.reason);
  } else if (kind === "break_overtime") {
    if (tag && tag.trim()) {
      const rows = await db.select<{ reason: string; cnt: number }[]>(
        `SELECT reason, COUNT(id) AS cnt FROM sessions
         WHERE mode = 'break' AND overtime_sec > 0 AND tag = $1
           AND reason IS NOT NULL AND reason != '' AND reason != tag
         GROUP BY reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
        [tag.trim()],
      );
      if (rows.length > 0) return rows.map((r) => r.reason);
    }
    const rows = await db.select<{ reason: string; cnt: number }[]>(
      `SELECT reason, COUNT(id) AS cnt FROM sessions
       WHERE mode = 'break' AND overtime_sec > 0 AND reason IS NOT NULL AND reason != ''
       GROUP BY reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
    );
    return rows.map((r) => r.reason);
  } else {
    // ending (ayrı end_tag / end_reason sütunlarını kullanır)
    if (tag && tag.trim()) {
      const rows = await db.select<{ reason: string; cnt: number }[]>(
        `SELECT end_reason AS reason, COUNT(id) AS cnt FROM sessions
         WHERE mode = 'work' AND end_tag = $1
           AND end_reason IS NOT NULL AND end_reason != '' AND end_reason != end_tag
         GROUP BY end_reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
        [tag.trim()],
      );
      if (rows.length > 0) return rows.map((r) => r.reason);
    }
    const rows = await db.select<{ reason: string; cnt: number }[]>(
      `SELECT end_reason AS reason, COUNT(id) AS cnt FROM sessions
       WHERE mode = 'work' AND end_reason IS NOT NULL AND end_reason != ''
       GROUP BY end_reason ORDER BY cnt DESC, MAX(id) DESC LIMIT 8`,
    );
    return rows.map((r) => r.reason);
  }
}

// Özet için Tag kategorilerine ayrılmış ve açıklamaları içeren detaylı veri
export async function getSummaryReasonsData(
  onlyToday: boolean,
): Promise<SummaryReasonsData> {
  const db = await getDb();
  let dayFilter = "";
  const params: any[] = [];
  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    dayFilter = "WHERE day_id = $1";
    params.push(day.id);
  }

  // Helper to aggregate tag-reason breakdown
  const buildTagItems = (
    rows: { tag: string | null; reason: string | null }[],
  ): TagSummaryItem[] => {
    const map = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const tag = (r.tag && r.tag.trim()) || "Diğer";
      const reason = (r.reason && r.reason.trim()) || tag;
      if (!map.has(tag)) map.set(tag, new Map());
      const rMap = map.get(tag)!;
      rMap.set(reason, (rMap.get(reason) || 0) + 1);
    }
    const list: TagSummaryItem[] = [];
    for (const [tag, rMap] of map.entries()) {
      let tagCount = 0;
      const explanations: { reason: string; count: number }[] = [];
      for (const [reason, count] of rMap.entries()) {
        tagCount += count;
        explanations.push({ reason, count });
      }
      explanations.sort((a, b) => b.count - a.count);
      list.push({ tag, count: tagCount, explanations });
    }
    list.sort((a, b) => b.count - a.count);
    return list;
  };

  // 1. Çalışma Konuları (Work tags)
  const workFilter = onlyToday
    ? "WHERE mode = 'work' AND day_id = $1 AND (tag IS NOT NULL OR reason IS NOT NULL)"
    : "WHERE mode = 'work' AND (tag IS NOT NULL OR reason IS NOT NULL)";
  const workRows = await db.select<{ tag: string | null; reason: string | null }[]>(
    `SELECT tag, reason FROM sessions ${workFilter}`,
    params,
  );
  const workTags = buildTagItems(workRows);

  // 2. Mola Gecikmeleri (yalnızca gerçekten süre aşımı olan molalar: overtime_sec > 0)
  const breakFilter = onlyToday
    ? "WHERE mode = 'break' AND day_id = $1 AND overtime_sec > 0"
    : "WHERE mode = 'break' AND overtime_sec > 0";
  const breakRows = await db.select<{ tag: string | null; reason: string | null }[]>(
    `SELECT tag, reason FROM sessions ${breakFilter}`,
    params,
  );
  const breakOvertimeTags = buildTagItems(breakRows);

  // 3. Dikkat Dağılma Kayıtları
  const distRows = await db.select<{ tag: string | null; reason: string }[]>(
    `SELECT tag, reason FROM distractions ${dayFilter}`,
    params,
  );
  const distractionTags = buildTagItems(distRows);

  // 4. Erken Bitirme Kayıtları (end_tag / end_reason sütunlarından okunur)
  const endingFilter = onlyToday
    ? "WHERE mode = 'work' AND day_id = $1 AND (end_tag IS NOT NULL OR end_reason IS NOT NULL)"
    : "WHERE mode = 'work' AND (end_tag IS NOT NULL OR end_reason IS NOT NULL)";
  const endingRows = await db.select<{ tag: string | null; reason: string | null }[]>(
    `SELECT end_tag AS tag, end_reason AS reason FROM sessions ${endingFilter}`,
    params,
  );
  const endingTags = buildTagItems(endingRows);

  // Seans Başı Ortalama Dikkat Dağılması
  const sessRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(id) AS cnt FROM sessions ${dayFilter ? "WHERE day_id = $1 AND mode = 'work'" : "WHERE mode = 'work'"}`,
    params,
  );
  const totalSessions = sessRows[0]?.cnt || 0;
  const totalDistractions = distRows.length;
  const avgDistractionsPerSession =
    totalSessions > 0 ? Number((totalDistractions / totalSessions).toFixed(1)) : 0;

  return {
    workTags,
    breakOvertimeTags,
    distractionTags,
    endingTags,
    totalWorkSubjects: workRows.length,
    totalBreakOvertimes: breakRows.length,
    totalDistractions,
    totalEndings: endingRows.length,
    avgDistractionsPerSession,
  };
}

// ---------------------------------------------------------------------------
// Dikkat Dağılması Ek Süre Ayarı (Settings)
// ---------------------------------------------------------------------------

export async function loadDistractPenalty(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'distractPenaltyMins'",
  );
  if (rows.length === 0) return 1;
  const n = parseInt(rows[0]?.value, 10);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 1;
}

export async function saveDistractPenalty(mins: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('distractPenaltyMins', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(mins)],
  );
}

// ---------------------------------------------------------------------------
// Dil ve Tema ayarları
// ---------------------------------------------------------------------------

export type LangCode = "auto" | "tr" | "en";

export async function loadLanguagePreference(): Promise<LangCode> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT value FROM settings WHERE key = 'language'",
  );
  const val = rows[0]?.value;
  if (val === "tr" || val === "en" || val === "auto") {
    return val;
  }
  return "auto";
}

export async function saveLanguagePreference(lang: LangCode): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('language', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [lang],
  );
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function loadThemeSettings(): Promise<ThemeSettings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings WHERE key IN ('bgColor', 'bgOpacity', 'timerColor')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const bgColor = map.get("bgColor") ?? "";
  const timerColor = map.get("timerColor") ?? "";
  const opacity = Number(map.get("bgOpacity"));

  return {
    bgColor: HEX_COLOR.test(bgColor) ? bgColor : DEFAULT_THEME.bgColor,
    timerColor: HEX_COLOR.test(timerColor)
      ? timerColor
      : DEFAULT_THEME.timerColor,
    bgOpacity:
      Number.isFinite(opacity) && opacity >= 30 && opacity <= 100
        ? Math.round(opacity)
        : DEFAULT_THEME.bgOpacity,
  };
}

export async function saveThemeSettings(theme: ThemeSettings): Promise<void> {
  const db = await getDb();
  const entries: [string, string][] = [
    ["bgColor", theme.bgColor],
    ["bgOpacity", String(theme.bgOpacity)],
    ["timerColor", theme.timerColor],
  ];
  for (const [key, value] of entries) {
    await db.execute(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}

// ---------------------------------------------------------------------------
// Her Zaman Üstte (Always on Top) & Mola Ayarları & Veri Dışa Aktarma
// ---------------------------------------------------------------------------

export async function loadAlwaysOnTop(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'alwaysOnTop'",
  );
  if (rows.length === 0) return true; // Varsayılan açık
  return rows[0].value === "1";
}

export async function saveAlwaysOnTop(on: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('alwaysOnTop', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [on ? "1" : "0"],
  );
}

export async function loadDefaultBreakMins(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'defaultBreakMins'",
  );
  if (rows.length === 0) return 10;
  const n = parseInt(rows[0].value, 10);
  return n === 7 || n === 10 || n === 20 ? n : 10;
}

export async function saveDefaultBreakMins(mins: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('defaultBreakMins', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [mins.toString()],
  );
}

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const days = await db.select("SELECT * FROM study_days ORDER BY id ASC");
  const sessions = await db.select("SELECT * FROM sessions ORDER BY id ASC");
  const distractions = await db.select("SELECT * FROM distractions ORDER BY id ASC");
  const parking_items = await db.select("SELECT * FROM parking_items ORDER BY id ASC");
  const context_logs = await db.select("SELECT * FROM context_logs ORDER BY id ASC");
  const work_story_entries = await db.select("SELECT * FROM work_story_entries ORDER BY id ASC");
  const tags = await db.select("SELECT * FROM tags ORDER BY id ASC");
  const feedbacks = await db.select("SELECT * FROM feedbacks ORDER BY id DESC");
  const settings = await db.select("SELECT * FROM settings ORDER BY key ASC");

  const data = {
    app: "pomodoro-widget",
    version: "0.1.14",
    exported_at: new Date().toISOString(),
    study_days: days,
    sessions,
    distractions,
    parking_items,
    context_logs,
    work_story_entries,
    tags,
    feedbacks,
    settings,
  };

  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Geri Bildirim (In-App Feedback) Yönetimi
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

// ---------------------------------------------------------------------------
// Özel Pencere Boyutları (Custom Window Sizes)
// ---------------------------------------------------------------------------

export const DEFAULT_WINDOW_SIZES: Record<SizeTargetPage, WindowSizePreset> = {
  timer: { width: 284, height: 138 },
  menu: { width: 315, height: 375 },
  summary: { width: 390, height: 490 },
  settings: { width: 335, height: 495 },
  dashboard: { width: 690, height: 530 },
};

export async function loadCustomWindowSizes(): Promise<CustomWindowSizes> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'customWindowSizes'",
  );
  if (rows.length === 0) return {};
  try {
    const parsed = JSON.parse(rows[0].value);
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomWindowSizes = {};
    for (const k of ["timer", "menu", "summary", "settings", "dashboard"] as SizeTargetPage[]) {
      const item = parsed[k];
      if (item && typeof item === "object") {
        const w = Math.round(Number(item.width));
        const h = Math.round(Number(item.height));
        if (Number.isFinite(w) && Number.isFinite(h) && w >= 200 && w <= 1400 && h >= 110 && h <= 1100) {
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
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('customWindowSizes', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(sizes)],
  );
}

export async function resetCustomWindowSizes(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM settings WHERE key = 'customWindowSizes'");
}

// ---------------------------------------------------------------------------
// ADHD Öz-Farkındalık (Self-Realization) Analitiği
// ---------------------------------------------------------------------------

export async function getAdhdInsights(
  onlyToday: boolean,
): Promise<AdhdInsightsData> {
  const db = await getDb();
  const params: number[] = [];
  let dayClause = "";
  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    dayClause = "AND day_id = $1";
    params.push(day.id);
  }

  // 1. Çalışma seansları
  const workSessions = await db.select<{
    duration_sec: number;
    started_at: string | null;
    created_at: string;
    end_tag: string | null;
    end_reason: string | null;
  }[]>(
    `SELECT duration_sec, started_at, created_at, end_tag, end_reason
     FROM sessions
     WHERE mode = 'work' ${dayClause}`,
    params,
  );

  // 2. Mola seansları
  const breakSessions = await db.select<{
    duration_sec: number;
    overtime_sec: number | null;
  }[]>(
    `SELECT duration_sec, overtime_sec
     FROM sessions
     WHERE mode = 'break' ${dayClause}`,
    params,
  );

  // 3. Dikkat dağılmaları
  const distRows = await db.select<{
    tag: string | null;
    created_at: string;
    elapsed_work_sec: number | null;
    trigger_type: string | null;
  }[]>(
    `SELECT tag, created_at, elapsed_work_sec, trigger_type
     FROM distractions
     ${onlyToday ? "WHERE day_id = $1" : ""}`,
    params,
  );

  // Odak Eşiği (kaçıncı dakikada dağılıyor)
  const validElapsed = distRows
    .map((d) => Number(d.elapsed_work_sec ?? 0))
    .filter((s) => s >= 30 && s <= 180 * 60);
  const avgFocusThresholdMins =
    validElapsed.length > 0
      ? Math.max(
          1,
          Math.round(
            validElapsed.reduce((a, b) => a + b, 0) / validElapsed.length / 60,
          ),
        )
      : null;

  // İçsel dürtü vs Dışsal bölünme
  let internalCount = 0;
  let externalCount = 0;
  const tagFreq = new Map<string, number>();
  const distBuckets = new Array<number>(12).fill(0); // 2 saatlik dilimler (0..11)

  for (const d of distRows) {
    if (d.trigger_type === "external") {
      externalCount++;
    } else {
      internalCount++;
    }
    const tg = (d.tag && d.tag.trim()) || "Diğer";
    tagFreq.set(tg, (tagFreq.get(tg) || 0) + 1);

    const dt = new Date(d.created_at);
    if (!Number.isNaN(dt.getTime())) {
      const b = Math.floor(dt.getHours() / 2);
      distBuckets[b] = (distBuckets[b] || 0) + 1;
    }
  }

  const totalDist = internalCount + externalCount;
  const internalPct =
    totalDist > 0 ? Math.round((internalCount / totalDist) * 100) : 0;

  let topTriggerTag: string | null = null;
  let topTriggerMax = 0;
  for (const [k, v] of tagFreq.entries()) {
    if (v > topTriggerMax) {
      topTriggerMax = v;
      topTriggerTag = k;
    }
  }

  // Verimli Saat Dilimi (2 saatlik bloklarda toplam çalışma süresi)
  const workBuckets = new Array<number>(12).fill(0);
  let earlyStopCount = 0;
  let hyperfocusCount = 0;

  for (const w of workSessions) {
    const dur = Number(w.duration_sec) || 0;
    const isEarlyStop = Boolean(w.end_tag || w.end_reason);
    if (isEarlyStop) earlyStopCount++;
    if (dur >= 35 * 60 && !isEarlyStop) hyperfocusCount++;

    const dt = new Date(w.started_at || w.created_at);
    if (!Number.isNaN(dt.getTime())) {
      const b = Math.floor(dt.getHours() / 2);
      workBuckets[b] = (workBuckets[b] || 0) + dur;
    }
  }

  const formatBucket = (idx: number): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(idx * 2)}:00–${pad(idx * 2 + 2)}:00`;
  };

  let peakBucket = -1;
  let maxWorkSec = 0;
  for (let i = 0; i < 12; i++) {
    if (workBuckets[i] > maxWorkSec) {
      maxWorkSec = workBuckets[i];
      peakBucket = i;
    }
  }
  const peakFocusHoursLabel = peakBucket >= 0 ? formatBucket(peakBucket) : null;

  let worstBucket = -1;
  let maxDistCnt = 0;
  for (let i = 0; i < 12; i++) {
    if (distBuckets[i] > maxDistCnt) {
      maxDistCnt = distBuckets[i];
      worstBucket = i;
    }
  }
  const mostDistractedHoursLabel =
    worstBucket >= 0 ? formatBucket(worstBucket) : null;

  // Mola sarkması / geçiş direnci
  const overtimeBreaks = breakSessions.filter(
    (b) => Number(b.overtime_sec ?? 0) > 0,
  );
  const overtimeBreakRatePct =
    breakSessions.length > 0
      ? Math.round((overtimeBreaks.length / breakSessions.length) * 100)
      : 0;
  const avgBreakOvertimeMins =
    overtimeBreaks.length > 0
      ? Math.max(
          1,
          Math.round(
            overtimeBreaks.reduce(
              (a, b) => a + Number(b.overtime_sec ?? 0),
              0,
            ) /
              overtimeBreaks.length /
              60,
          ),
        )
      : 0;

  const completionRatePct =
    workSessions.length > 0
      ? Math.round(
          ((workSessions.length - earlyStopCount) / workSessions.length) * 100,
        )
      : 100;

  return {
    avgFocusThresholdMins,
    internalCount,
    externalCount,
    internalPct,
    peakFocusHoursLabel,
    mostDistractedHoursLabel,
    avgBreakOvertimeMins,
    overtimeBreakRatePct,
    completionRatePct,
    hyperfocusCount,
    topTriggerTag,
  };
}

// ---------------------------------------------------------------------------
// Çalışma Planları (Study Plans) & Döngü / Kısa Mola Sayacı
// ---------------------------------------------------------------------------

export async function loadStudyPlans(): Promise<StudyPlan[]> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'studyPlans'",
  );
  if (rows.length === 0) return DEFAULT_STUDY_PLANS.map((p) => ({ ...p }));
  try {
    const parsed = JSON.parse(rows[0].value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return DEFAULT_STUDY_PLANS.map((def) => {
        const found = parsed.find(
          (item: Partial<StudyPlan>) => item && item.id === def.id,
        );
        return found ? sanitizePlan(found, def) : { ...def };
      });
    }
  } catch {
    // fallback
  }
  return DEFAULT_STUDY_PLANS.map((p) => ({ ...p }));
}

export async function saveStudyPlans(plans: StudyPlan[]): Promise<void> {
  const db = await getDb();
  const sanitized = DEFAULT_STUDY_PLANS.map((def) => {
    const found = plans.find((p) => p.id === def.id);
    return found ? sanitizePlan(found, def) : { ...def };
  });
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('studyPlans', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(sanitized)],
  );
}

export async function loadRuntimeState(): Promise<RuntimeState | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'runtimeState'",
  );
  if (rows.length === 0) return null;
  try {
    const raw = JSON.parse(rows[0].value) as Partial<RuntimeState>;
    if (!raw || typeof raw !== "object") return null;
    const mode: TimerMode = raw.mode === "break" ? "break" : "work";
    const breakKind: BreakKind =
      raw.breakKind === "long" || raw.breakKind === "short"
        ? raw.breakKind
        : "standard";
    const posInt = (v: unknown, def: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : def;
    };
    return {
      sessionActive: Boolean(raw.sessionActive),
      mode,
      breakKind,
      breakTotalSec: Math.max(60, posInt(raw.breakTotalSec, DEFAULT_BREAK_SEC)),
      breakElapsedSec: posInt(raw.breakElapsedSec, 0),
      breakOverdueSec: posInt(raw.breakOverdueSec, 0),
      breakOvertimeAccumSec: posInt(raw.breakOvertimeAccumSec, 0),
      savedWorkSecondsLeft: posInt(raw.savedWorkSecondsLeft, DEFAULT_WORK_SEC),
      savedWorkElapsedSec: posInt(raw.savedWorkElapsedSec, 0),
      workStartedAt: typeof raw.workStartedAt === "string" ? raw.workStartedAt : null,
      breakStartedAt: typeof raw.breakStartedAt === "string" ? raw.breakStartedAt : null,
      workTag: typeof raw.workTag === "string" ? raw.workTag : "",
      workReason: typeof raw.workReason === "string" ? raw.workReason : "",
      sessionDistractions: posInt(raw.sessionDistractions, 0),
      currentContext:
        typeof raw.currentContext === "string" ? raw.currentContext : "",
      activeContextLogId:
        typeof raw.activeContextLogId === "number" &&
        Number.isFinite(raw.activeContextLogId) &&
        raw.activeContextLogId > 0
          ? Math.round(raw.activeContextLogId)
          : null,
      contextStartedAtElapsedSec: posInt(raw.contextStartedAtElapsedSec, 0),
      shortBreakNote:
        typeof raw.shortBreakNote === "string" ? raw.shortBreakNote : "",
    };
  } catch {
    return null;
  }
}

export async function saveRuntimeState(state: RuntimeState): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('runtimeState', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(state)],
  );
}

export async function loadActivePlanId(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'activePlanId'",
  );
  if (rows.length === 0) return "developer";
  return rows[0].value || "developer";
}

export async function saveActivePlanId(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('activePlanId', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [id],
  );
}

export async function loadSessionCycleStats(): Promise<{
  completedWorkCount: number;
  shortBreakCount: number;
}> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings WHERE key IN ('completedWorkCount', 'sessionShortBreakCount')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
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
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('completedWorkCount', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(completedWorkCount)],
  );
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('sessionShortBreakCount', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(shortBreakCount)],
  );
}

// ---------------------------------------------------------------------------
// "Sonra Bak" Otoparkı (Parking Lot: Dürtüsel Görevler, Fikirler & Ekran Notları)
// Ekleme sırasına göre (ORDER BY id ASC) saklanır ve ayrıştırılır.
// ---------------------------------------------------------------------------

export async function addParkingItem(params: {
  itemType: ParkingItemType;
  content: string;
  activeApp?: string;
  activeWindow?: string;
  contextText?: string;
  screenshotData?: string;
}): Promise<ParkingItem | null> {
  const trimmed = params.content.trim() || (params.itemType === "screenshot" ? "📸 Ekran Görüntüsü Notu" : "");
  if (!trimmed) return null;
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const nowIso = new Date().toISOString();
  const status: ParkingStatus =
    params.itemType === "task" ? "pending" : "unrated";
  const app = params.activeApp?.trim() || null;
  const win = params.activeWindow?.trim() || null;
  const ctx = params.contextText?.trim() || null;
  const shot = params.screenshotData || null;

  const res = await db.execute(
    `INSERT INTO parking_items (
       day_id, item_type, content, status, active_app, active_window, context_text, screenshot_data, keep_synced, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)`,
    [day.id, params.itemType, trimmed, status, app, win, ctx, shot, nowIso, nowIso],
  );

  const insertedId = Number(res.lastInsertId);
  const item: ParkingItem = {
    id: insertedId,
    day_id: day.id,
    item_type: params.itemType,
    content: trimmed,
    status,
    active_app: app,
    active_window: win,
    context_text: ctx,
    screenshot_data: shot,
    keep_synced: 0,
    keep_note_id: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await enqueueSyncMutation(db, "parking_item_add", { ...item });
  return item;
}

export async function getParkingLotData(
  onlyToday = false,
): Promise<ParkingLotData> {
  const db = await getDb();
  let rows: ParkingItem[];

  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    rows = await db.select<ParkingItem[]>(
      `SELECT id, day_id, item_type, content, status, active_app, active_window, context_text, screenshot_data, COALESCE(keep_synced, 0) AS keep_synced, keep_note_id, created_at, updated_at
       FROM parking_items
       WHERE day_id = $1
       ORDER BY id ASC`,
      [day.id],
    );
  } else {
    rows = await db.select<ParkingItem[]>(
      `SELECT id, day_id, item_type, content, status, active_app, active_window, context_text, screenshot_data, COALESCE(keep_synced, 0) AS keep_synced, keep_note_id, created_at, updated_at
       FROM parking_items
       ORDER BY id ASC`,
    );
  }

  const pendingTasks: ParkingItem[] = [];
  const doneTasks: ParkingItem[] = [];
  const unratedIdeas: ParkingItem[] = [];
  const importantIdeas: ParkingItem[] = [];
  const unimportantIdeas: ParkingItem[] = [];
  const screenshotNotes: ParkingItem[] = [];

  for (const r of rows) {
    const iType: ParkingItemType =
      r.item_type === "idea"
        ? "idea"
        : r.item_type === "screenshot"
          ? "screenshot"
          : "task";

    const item: ParkingItem = {
      id: Number(r.id),
      day_id: Number(r.day_id),
      item_type: iType,
      content: r.content,
      status: r.status as ParkingStatus,
      active_app: r.active_app ?? null,
      active_window: r.active_window ?? null,
      context_text: r.context_text ?? null,
      screenshot_data: r.screenshot_data ?? null,
      keep_synced: Number(r.keep_synced ?? 0),
      keep_note_id: r.keep_note_id ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };

    if (item.item_type === "task") {
      if (item.status === "done") {
        doneTasks.push(item);
      } else {
        pendingTasks.push(item);
      }
    } else if (item.item_type === "screenshot") {
      screenshotNotes.push(item);
    } else {
      if (item.status === "important") {
        importantIdeas.push(item);
      } else if (item.status === "unimportant") {
        unimportantIdeas.push(item);
      } else {
        unratedIdeas.push(item);
      }
    }
  }

  return {
    pendingTasks,
    doneTasks,
    unratedIdeas,
    importantIdeas,
    unimportantIdeas,
    screenshotNotes,
    totalTasks: pendingTasks.length + doneTasks.length,
    totalIdeas:
      unratedIdeas.length + importantIdeas.length + unimportantIdeas.length,
    totalScreenshots: screenshotNotes.length,
  };
}

export async function toggleParkingTaskDone(
  id: number,
  done: boolean,
): Promise<void> {
  const db = await getDb();
  const status: ParkingStatus = done ? "done" : "pending";
  const nowIso = new Date().toISOString();
  await db.execute(
    "UPDATE parking_items SET status = $1, updated_at = $2 WHERE id = $3",
    [status, nowIso, id],
  );
  await enqueueSyncMutation(db, "parking_item_update", { id, status, updated_at: nowIso });
}

export async function rateParkingIdea(
  id: number,
  rating: "important" | "unimportant" | "unrated",
): Promise<void> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  await db.execute(
    "UPDATE parking_items SET status = $1, updated_at = $2 WHERE id = $3",
    [rating, nowIso, id],
  );
  await enqueueSyncMutation(db, "parking_item_update", { id, status: rating, updated_at: nowIso });
}

export async function deleteParkingItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM parking_items WHERE id = $1", [id]);
  await enqueueSyncMutation(db, "parking_item_delete", { id });
}

export async function markParkingItemsKeepSynced(
  ids: number[],
  keepNoteId?: string,
): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.execute(
      "UPDATE parking_items SET keep_synced = 1, keep_note_id = COALESCE($1, keep_note_id) WHERE id = $2",
      [keepNoteId || null, id],
    );
  }
}

// ---------------------------------------------------------------------------
// Aktif Meşguliyet (Context) Kayıtları ve Çalışma İstatistikleri
// ---------------------------------------------------------------------------

export async function startContextLog(params: {
  contextText: string;
  workTag?: string;
  activeApp?: string;
  activeWindow?: string;
}): Promise<number | null> {
  const text = params.contextText.trim();
  if (!text) return null;
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const nowIso = new Date().toISOString();
  const res = await db.execute(
    `INSERT INTO context_logs (
       day_id, context_text, work_tag, active_app, active_window, duration_sec, distraction_count, started_at
     ) VALUES ($1, $2, $3, $4, $5, 0, 0, $6)`,
    [
      day.id,
      text,
      params.workTag?.trim() || null,
      params.activeApp?.trim() || null,
      params.activeWindow?.trim() || null,
      nowIso,
    ],
  );
  const id = Number(res.lastInsertId);
  await enqueueSyncMutation(db, "context_log_start", {
    id,
    day_id: day.id,
    context_text: text,
    work_tag: params.workTag?.trim() || null,
    active_app: params.activeApp?.trim() || null,
    active_window: params.activeWindow?.trim() || null,
    started_at: nowIso,
  });
  return id;
}

export async function finalizeContextLog(
  id: number | null,
  addDurationSec: number,
): Promise<void> {
  if (!id || id <= 0) return;
  const add = Math.max(0, Math.round(Number(addDurationSec) || 0));
  const db = await getDb();
  const endIso = new Date().toISOString();
  await db.execute(
    `UPDATE context_logs
     SET duration_sec = duration_sec + $1,
         ended_at = $2
     WHERE id = $3`,
    [add, endIso, id],
  );
  await enqueueSyncMutation(db, "context_log_finalize", {
    id,
    add_duration_sec: add,
    ended_at: endIso,
  });
}

export async function incrementContextDistraction(
  id: number | null,
): Promise<void> {
  if (!id || id <= 0) return;
  const db = await getDb();
  await db.execute(
    "UPDATE context_logs SET distraction_count = distraction_count + 1 WHERE id = $1",
    [id],
  );
}

export async function getRecentContexts(limit = 6): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ context_text: string }[]>(
    `SELECT context_text
     FROM context_logs
     WHERE context_text IS NOT NULL AND context_text != ''
     GROUP BY context_text
     ORDER BY MAX(id) DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.context_text);
}

export async function getContextStatsSummary(
  onlyToday: boolean,
): Promise<ContextStatItem[]> {
  const db = await getDb();
  const params: number[] = [];
  let whereClause = "";
  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    whereClause = "WHERE day_id = $1";
    params.push(day.id);
  }

  const rows = await db.select<{
    context_text: string;
    work_tag: string | null;
    active_app: string | null;
    duration_sec: number;
    distraction_count: number;
  }[]>(
    `SELECT context_text, work_tag, active_app, duration_sec, distraction_count
     FROM context_logs
     ${whereClause}
     ORDER BY id ASC`,
    params,
  );

  const map = new Map<
    string,
    {
      totalDurationSec: number;
      entryCount: number;
      distractionCount: number;
      lastWorkTag: string | null;
      appCounts: Map<string, number>;
    }
  >();

  for (const r of rows) {
    const key = (r.context_text || "").trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        totalDurationSec: 0,
        entryCount: 0,
        distractionCount: 0,
        lastWorkTag: null,
        appCounts: new Map(),
      });
    }
    const entry = map.get(key)!;
    entry.totalDurationSec += Math.max(0, Number(r.duration_sec) || 0);
    entry.entryCount += 1;
    entry.distractionCount += Math.max(0, Number(r.distraction_count) || 0);
    if (r.work_tag) entry.lastWorkTag = r.work_tag;
    if (r.active_app) {
      entry.appCounts.set(
        r.active_app,
        (entry.appCounts.get(r.active_app) || 0) + 1,
      );
    }
  }

  const out: ContextStatItem[] = [];
  for (const [contextText, v] of map.entries()) {
    let topApp: string | null = null;
    let topCnt = 0;
    for (const [app, cnt] of v.appCounts.entries()) {
      if (cnt > topCnt) {
        topCnt = cnt;
        topApp = app;
      }
    }
    out.push({
      contextText,
      totalDurationSec: v.totalDurationSec,
      entryCount: v.entryCount,
      distractionCount: v.distractionCount,
      lastWorkTag: v.lastWorkTag,
      topApp,
    });
  }

  out.sort(
    (a, b) =>
      b.totalDurationSec - a.totalDurationSec || b.entryCount - a.entryCount,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Hangi Uygulama / Açık Sekmede Dikkat Dağıldı Analitiği (Summary)
// ---------------------------------------------------------------------------

export async function getAppDistractionSummary(
  onlyToday: boolean,
): Promise<AppDistractionGroup[]> {
  const db = await getDb();
  const params: number[] = [];
  let whereClause = "WHERE (active_app IS NOT NULL AND active_app != '') OR (active_window IS NOT NULL AND active_window != '')";
  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    whereClause =
      "WHERE day_id = $1 AND ((active_app IS NOT NULL AND active_app != '') OR (active_window IS NOT NULL AND active_window != ''))";
    params.push(day.id);
  }

  const rows = await db.select<{
    active_app: string | null;
    active_window: string | null;
    context_text: string | null;
    reason: string;
    category: string | null;
  }[]>(
    `SELECT active_app, active_window, context_text, reason, category
     FROM distractions
     ${whereClause}
     ORDER BY id DESC`,
    params,
  );

  const appMap = new Map<
    string,
    {
      totalCount: number;
      detailMap: Map<string, AppDistractionDetail>;
    }
  >();

  for (const r of rows) {
    const appName = (r.active_app && r.active_app.trim()) || "Uygulama";
    const winTitle = (r.active_window && r.active_window.trim()) || appName;
    const ctx = (r.context_text && r.context_text.trim()) || null;
    const cat = (r.category as DistractionCategory) || "internal";
    const reason = (r.reason && r.reason.trim()) || "";

    if (!appMap.has(appName)) {
      appMap.set(appName, { totalCount: 0, detailMap: new Map() });
    }
    const group = appMap.get(appName)!;
    group.totalCount += 1;

    const dKey = `${winTitle}|||${ctx || ""}|||${reason}|||${cat}`;
    const existing = group.detailMap.get(dKey);
    if (existing) {
      existing.count += 1;
    } else {
      group.detailMap.set(dKey, {
        windowTitle: winTitle,
        contextText: ctx,
        reason,
        category: cat,
        count: 1,
      });
    }
  }

  const result: AppDistractionGroup[] = [];
  for (const [appName, v] of appMap.entries()) {
    const details = Array.from(v.detailMap.values()).sort(
      (a, b) => b.count - a.count,
    );
    result.push({
      appName,
      totalCount: v.totalCount,
      details,
    });
  }
  result.sort((a, b) => b.totalCount - a.totalCount);
  return result;
}

// ---------------------------------------------------------------------------
// Global Kısayol Ayarları (Global Shortcuts)
// ---------------------------------------------------------------------------

export async function loadGlobalShortcuts(): Promise<GlobalShortcutSettings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings WHERE key IN ('distractionShortcut', 'contextShortcut')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    distractionShortcut:
      map.get("distractionShortcut")?.trim() ||
      DEFAULT_SHORTCUTS.distractionShortcut,
    contextShortcut:
      map.get("contextShortcut")?.trim() || DEFAULT_SHORTCUTS.contextShortcut,
  };
}

export async function saveGlobalShortcuts(
  shortcuts: GlobalShortcutSettings,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('distractionShortcut', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shortcuts.distractionShortcut.trim()],
  );
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('contextShortcut', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shortcuts.contextShortcut.trim()],
  );
}

// ---------------------------------------------------------------------------
// Çalışma Hikayesi (Work Story: 5 dk'da 1 Screenshot + Açık Pencere + Context)
// ---------------------------------------------------------------------------

export async function addWorkStoryEntry(params: {
  entryType: WorkStoryEntryType;
  contextText?: string;
  workTag?: string;
  activeApp?: string;
  activeWindow?: string;
  note?: string;
  screenshotData?: string;
  elapsedWorkSec?: number;
}): Promise<WorkStoryEntry> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const nowIso = new Date().toISOString();
  const elapsed = Math.max(0, Math.round(Number(params.elapsedWorkSec) || 0));
  const ctx = params.contextText?.trim() || null;
  const wTag = params.workTag?.trim() || null;
  const app = params.activeApp?.trim() || null;
  const win = params.activeWindow?.trim() || null;
  const note = params.note?.trim() || null;
  const shot = params.screenshotData || null;

  const res = await db.execute(
    `INSERT INTO work_story_entries (
       day_id, entry_type, context_text, work_tag, active_app, active_window,
       note, screenshot_data, elapsed_work_sec, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [day.id, params.entryType, ctx, wTag, app, win, note, shot, elapsed, nowIso],
  );

  const entry: WorkStoryEntry = {
    id: Number(res.lastInsertId),
    day_id: day.id,
    entry_type: params.entryType,
    context_text: ctx,
    work_tag: wTag,
    active_app: app,
    active_window: win,
    note,
    screenshot_data: shot,
    elapsed_work_sec: elapsed,
    created_at: nowIso,
  };

  await enqueueSyncMutation(db, "work_story_entry", { ...entry });
  return entry;
}

export async function getWorkStoryEntries(
  onlyToday = false,
  limit = 40,
): Promise<WorkStoryEntry[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(200, Math.round(limit)));
  if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    const rows = await db.select<WorkStoryEntry[]>(
      `SELECT id, day_id, entry_type, context_text, work_tag, active_app, active_window,
              note, screenshot_data, elapsed_work_sec, created_at
       FROM work_story_entries
       WHERE day_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [day.id, safeLimit],
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      day_id: Number(r.day_id),
      elapsed_work_sec: Number(r.elapsed_work_sec ?? 0),
    }));
  }

  const rows = await db.select<WorkStoryEntry[]>(
    `SELECT id, day_id, entry_type, context_text, work_tag, active_app, active_window,
            note, screenshot_data, elapsed_work_sec, created_at
     FROM work_story_entries
     ORDER BY id DESC
     LIMIT $1`,
    [safeLimit],
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    day_id: Number(r.day_id),
    elapsed_work_sec: Number(r.elapsed_work_sec ?? 0),
  }));
}

export async function deleteWorkStoryEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM work_story_entries WHERE id = $1", [id]);
  await enqueueSyncMutation(db, "work_story_delete", { id });
}

// ---------------------------------------------------------------------------
// Bulut Senkronizasyon Kuyruğu (Offline-First Sync Queue) & Google Auth
// ---------------------------------------------------------------------------

export async function loadCloudAuthState(): Promise<CloudAuthState> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'cloudAuthState'",
  );
  if (rows.length === 0) return { ...DEFAULT_CLOUD_AUTH };
  try {
    const parsed = JSON.parse(rows[0].value);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_CLOUD_AUTH };
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      name: typeof parsed.name === "string" ? parsed.name : "",
      picture: typeof parsed.picture === "string" ? parsed.picture : "",
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : "",
      serverUrl:
        typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()
          ? parsed.serverUrl.trim().replace(/\/+$/, "")
          : DEFAULT_CLOUD_AUTH.serverUrl,
      googleClientId:
        typeof parsed.googleClientId === "string" ? parsed.googleClientId.trim() : "",
      autoSyncKeep:
        typeof parsed.autoSyncKeep === "boolean" ? parsed.autoSyncKeep : true,
      lastSyncAt: typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : null,
    };
  } catch {
    return { ...DEFAULT_CLOUD_AUTH };
  }
}

export async function saveCloudAuthState(state: CloudAuthState): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('cloudAuthState', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(state)],
  );
}

export async function getPendingSyncQueue(limit = 100): Promise<SyncQueueItem[]> {
  const db = await getDb();
  const rows = await db.select<SyncQueueItem[]>(
    "SELECT id, entity_type, payload_json, created_at FROM sync_queue ORDER BY id ASC LIMIT $1",
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    entity_type: r.entity_type,
    payload_json: r.payload_json,
    created_at: r.created_at,
  }));
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(id) AS cnt FROM sync_queue",
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function removeSyncedQueueIds(ids: number[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.execute("DELETE FROM sync_queue WHERE id = $1", [id]);
  }
}

export interface UserCloudSnapshot {
  study_days: any[];
  sessions: any[];
  distractions: any[];
  parking_items: any[];
  context_logs: any[];
  work_story_entries: any[];
  tags: any[];
  exported_at: string;
}

export async function exportUserCloudSnapshot(): Promise<UserCloudSnapshot> {
  const db = await getDb();
  const study_days = await db.select<any[]>("SELECT * FROM study_days ORDER BY id ASC");
  const sessions = await db.select<any[]>("SELECT * FROM sessions ORDER BY id ASC");
  const distractions = await db.select<any[]>("SELECT * FROM distractions ORDER BY id ASC");
  const parking_items = await db.select<any[]>("SELECT * FROM parking_items ORDER BY id ASC");
  const context_logs = await db.select<any[]>("SELECT * FROM context_logs ORDER BY id ASC");
  const work_story_entries = await db.select<any[]>(
    "SELECT * FROM work_story_entries ORDER BY id DESC LIMIT 60",
  );
  const tags = await db.select<any[]>("SELECT * FROM tags ORDER BY id ASC");

  return {
    study_days,
    sessions,
    distractions,
    parking_items,
    context_logs,
    work_story_entries,
    tags,
    exported_at: new Date().toISOString(),
  };
}

/**
 * Sunucudan dönen kullanıcıya özel verileri yerel SQLite ile çakışmasız birleştirir.
 */
export async function mergeRemoteSnapshotToLocal(
  remote: Partial<UserCloudSnapshot> | null | undefined,
): Promise<void> {
  if (!remote) return;
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);

  // Parking items (content + created_at eşleşmesine göre eksik olanları ekle veya durumunu güncelle)
  if (Array.isArray(remote.parking_items)) {
    const localRows = await db.select<{ id: number; content: string; created_at: string; status: string }[]>(
      "SELECT id, content, created_at, status FROM parking_items",
    );
    const localKeyMap = new Map(
      localRows.map((r) => [`${r.content}|||${r.created_at}`, r]),
    );
    for (const item of remote.parking_items) {
      if (!item || typeof item.content !== "string") continue;
      const key = `${item.content}|||${item.created_at || ""}`;
      const existing = localKeyMap.get(key);
      if (!existing) {
        await db.execute(
          `INSERT INTO parking_items (
             day_id, item_type, content, status, active_app, active_window,
             context_text, screenshot_data, keep_synced, keep_note_id, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            day.id,
            item.item_type || "task",
            item.content,
            item.status || "pending",
            item.active_app || null,
            item.active_window || null,
            item.context_text || null,
            item.screenshot_data || null,
            Number(item.keep_synced || 0),
            item.keep_note_id || null,
            item.created_at || new Date().toISOString(),
            item.updated_at || new Date().toISOString(),
          ],
        );
      } else if (item.status && item.status !== existing.status) {
        await db.execute(
          "UPDATE parking_items SET status = $1, keep_synced = COALESCE($2, keep_synced) WHERE id = $3",
          [item.status, Number(item.keep_synced || 0), existing.id],
        );
      }
    }
  }

  // Work story entries (created_at eşleşmesine göre eksik olanları ekle)
  if (Array.isArray(remote.work_story_entries)) {
    const localStories = await db.select<{ created_at: string }[]>(
      "SELECT created_at FROM work_story_entries",
    );
    const seen = new Set(localStories.map((s) => s.created_at));
    for (const st of remote.work_story_entries) {
      if (!st || !st.created_at || seen.has(st.created_at)) continue;
      seen.add(st.created_at);
      await db.execute(
        `INSERT INTO work_story_entries (
           day_id, entry_type, context_text, work_tag, active_app, active_window,
           note, screenshot_data, elapsed_work_sec, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          day.id,
          st.entry_type || "periodic",
          st.context_text || null,
          st.work_tag || null,
          st.active_app || null,
          st.active_window || null,
          st.note || null,
          st.screenshot_data || null,
          Number(st.elapsed_work_sec || 0),
          st.created_at,
        ],
      );
    }
  }
}
