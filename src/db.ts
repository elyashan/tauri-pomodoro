import Database from "@tauri-apps/plugin-sql";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

// "work" / "break" eski sürümlerden kalan değerlerdir; yeni sürümde sayaç ekranı "timer"dır.
export type PageType = "menu" | "timer" | "work" | "break" | "summary" | "settings";
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
const VALID_PAGES: PageType[] = ["menu", "timer", "work", "break", "summary", "settings"];

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
            (SELECT COUNT(id) FROM distractions WHERE day_id = $1) AS cnt`,
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
      Math.max(0, Math.round(overtimeSec)),
    ],
  );
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

export async function recordDistraction(
  rawReason: string,
  rawTag?: string,
): Promise<void> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const trimmed = rawReason.trim();
  const tag = (rawTag && rawTag.trim()) || "Diğer";
  const normalized =
    trimmed.length > 0
      ? trimmed.charAt(0).toLocaleUpperCase("tr-TR") + trimmed.slice(1)
      : tag;

  await db.execute(
    "INSERT INTO distractions (day_id, reason, tag, created_at) VALUES ($1, $2, $3, $4)",
    [day.id, normalized, tag, new Date().toISOString()],
  );
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
  const tags = await db.select("SELECT * FROM tags ORDER BY id ASC");
  const settings = await db.select("SELECT * FROM settings ORDER BY key ASC");

  const data = {
    app: "pomodoro-widget",
    version: "0.1.11",
    exported_at: new Date().toISOString(),
    study_days: days,
    sessions,
    distractions,
    tags,
    settings,
  };

  return JSON.stringify(data, null, 2);
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
