import Database from "@tauri-apps/plugin-sql";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export type PageType = "menu" | "work" | "break" | "summary";

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

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

export const DEFAULT_WORK_SEC = 50 * 60;
export const DEFAULT_BREAK_SEC = 10 * 60;

const DB_URL = "sqlite:pomodoro.db";
const SUMMARY_DAY_LIMIT = 7;
const VALID_PAGES: PageType[] = ["menu", "work", "break", "summary"];

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

function makeDayLabel(date: Date): string {
  // Örn: "06 Kas"
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

async function getOrCreateActiveDay(
  db: Database,
): Promise<{ id: number; label: string }> {
  const rows = await db.select<{ id: number; label: string }[]>(
    "SELECT id, label FROM study_days WHERE is_active = 1 ORDER BY id DESC LIMIT 1",
  );
  if (rows.length > 0) return rows[0];

  const now = new Date();
  const label = makeDayLabel(now);
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

export async function getActiveDayStats(): Promise<ActiveDayStats> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);

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
export async function startNewDay(): Promise<ActiveDayStats> {
  const db = await getDb();
  const nowIso = new Date().toISOString();

  await db.execute(
    "UPDATE study_days SET is_active = 0, ended_at = $1 WHERE is_active = 1",
    [nowIso],
  );
  await db.execute(
    "INSERT INTO study_days (label, started_at, is_active) VALUES ($1, $2, 1)",
    [makeDayLabel(new Date()), nowIso],
  );

  return getActiveDayStats();
}

export async function recordWorkSession(durationSec: number): Promise<void> {
  const sec = Math.round(durationSec);
  if (sec <= 0) return;

  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  await db.execute(
    "INSERT INTO sessions (day_id, mode, duration_sec, created_at) VALUES ($1, 'work', $2, $3)",
    [day.id, sec, new Date().toISOString()],
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
export async function getReasonChoices(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ reason: string; cnt: number }[]>(`
    SELECT reason, COUNT(id) AS cnt, MAX(id) AS last_id
    FROM distractions
    GROUP BY reason
    ORDER BY cnt DESC, last_id DESC
    LIMIT 10
  `);

  const saved = rows.map((r) => r.reason);
  for (const def of DEFAULT_REASONS) {
    if (
      !saved.some(
        (s) => s.toLocaleLowerCase("tr-TR") === def.toLocaleLowerCase("tr-TR"),
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
