import Database from "@tauri-apps/plugin-sql";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export type PageType = "menu" | "work" | "break" | "summary" | "settings";

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

export interface TagItem {
  id: number;
  name: string;
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

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

export const DEFAULT_WORK_SEC = 50 * 60;
export const DEFAULT_BREAK_SEC = 10 * 60;

const DB_URL = "sqlite:pomodoro.db";
const SUMMARY_DAY_LIMIT = 7;
const VALID_PAGES: PageType[] = ["menu", "work", "break", "summary", "settings"];

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
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);

  try {
    await db.execute("ALTER TABLE sessions ADD COLUMN tag TEXT");
  } catch {
    // sütun zaten varsa hata yok sayılır
  }

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
      page: "work",
      work_seconds_left: DEFAULT_WORK_SEC,
      work_elapsed_sec: 0,
      break_seconds_left: DEFAULT_BREAK_SEC,
    };
  }

  const row = rows[0];
  return {
    page: VALID_PAGES.includes(row.page) ? row.page : "work",
    work_seconds_left: Number(row.work_seconds_left) || DEFAULT_WORK_SEC,
    work_elapsed_sec: Number(row.work_elapsed_sec) || 0,
    break_seconds_left: Number(row.break_seconds_left) || DEFAULT_BREAK_SEC,
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

export async function recordWorkSession(durationSec: number, tag?: string): Promise<void> {
  const sec = Math.round(durationSec);
  if (sec <= 0) return;

  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  await db.execute(
    "INSERT INTO sessions (day_id, mode, duration_sec, created_at, tag) VALUES ($1, 'work', $2, $3, $4)",
    [day.id, sec, new Date().toISOString(), tag ?? null],
  );
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

export async function recordDistraction(rawReason: string): Promise<void> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const trimmed = rawReason.trim();
  const normalized =
    trimmed.length > 0
      ? trimmed.charAt(0).toLocaleUpperCase("tr-TR") + trimmed.slice(1)
      : "Diğer";

  await db.execute(
    "INSERT INTO distractions (day_id, reason, created_at) VALUES ($1, $2, $3)",
    [day.id, normalized, new Date().toISOString()],
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
    "UPDATE app_state SET work_seconds_left = $1, work_elapsed_sec = 0, break_seconds_left = $2 WHERE id = 1",
    [DEFAULT_WORK_SEC, DEFAULT_BREAK_SEC],
  );
  await getOrCreateActiveDay(db, locale);
}

// ---------------------------------------------------------------------------
// Tag (Erken Bitirme / Kategori) Yönetimi
// ---------------------------------------------------------------------------

const DEFAULT_TAGS_TR = [
  "Toplantı",
  "Yemek",
  "Mola İhtiyacı",
  "Acil İş",
  "Ders Bitti",
  "Yorgunluk",
];

export async function getTags(fallbackDefaults?: string[]): Promise<TagItem[]> {
  const db = await getDb();
  const rows = await db.select<TagItem[]>("SELECT id, name FROM tags ORDER BY id ASC");
  if (rows.length > 0) return rows;

  const defaults =
    fallbackDefaults && fallbackDefaults.length > 0 ? fallbackDefaults : DEFAULT_TAGS_TR;
  const nowIso = new Date().toISOString();
  for (const name of defaults) {
    try {
      await db.execute("INSERT INTO tags (name, created_at) VALUES ($1, $2)", [name, nowIso]);
    } catch {
      // Çift kayıtları yoksay
    }
  }
  return db.select<TagItem[]>("SELECT id, name FROM tags ORDER BY id ASC");
}

export async function addTag(rawName: string): Promise<TagItem | null> {
  const name = rawName.trim();
  if (!name) return null;
  const normalized = name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1);
  const db = await getDb();
  try {
    const res = await db.execute("INSERT INTO tags (name, created_at) VALUES ($1, $2)", [
      normalized,
      new Date().toISOString(),
    ]);
    return { id: Number(res.lastInsertId), name: normalized };
  } catch {
    const rows = await db.select<TagItem[]>("SELECT id, name FROM tags WHERE name = $1", [normalized]);
    return rows[0] ?? null;
  }
}

export async function updateTag(id: number, rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name) return;
  const normalized = name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1);
  const db = await getDb();
  const oldRows = await db.select<{ name: string }[]>("SELECT name FROM tags WHERE id = $1", [id]);
  const oldName = oldRows[0]?.name;

  await db.execute("UPDATE tags SET name = $1 WHERE id = $2", [normalized, id]);
  if (oldName) {
    await db.execute("UPDATE sessions SET tag = $1 WHERE tag = $2", [normalized, oldName]);
  }
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tags WHERE id = $1", [id]);
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
