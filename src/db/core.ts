import Database from "@tauri-apps/plugin-sql";
import { DateRangeFilter, DEFAULT_BREAK_SEC, DEFAULT_WORK_SEC } from "./types";

const DB_URL = "sqlite:pomodoro.db";

const ALTER_MIGRATIONS = [
  "ALTER TABLE parking_items ADD COLUMN screenshot_data TEXT",
  "ALTER TABLE parking_items ADD COLUMN keep_synced INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE parking_items ADD COLUMN keep_note_id TEXT",
  "ALTER TABLE distractions ADD COLUMN elapsed_work_sec INTEGER DEFAULT 0",
  "ALTER TABLE distractions ADD COLUMN trigger_type TEXT DEFAULT 'internal'",
  "ALTER TABLE distractions ADD COLUMN category TEXT DEFAULT 'internal'",
  "ALTER TABLE distractions ADD COLUMN active_app TEXT",
  "ALTER TABLE distractions ADD COLUMN active_window TEXT",
  "ALTER TABLE distractions ADD COLUMN context_text TEXT",
  "ALTER TABLE distractions ADD COLUMN penalty_sec INTEGER DEFAULT 0",
  "ALTER TABLE distractions ADD COLUMN tag TEXT",
  "ALTER TABLE tags ADD COLUMN kind TEXT NOT NULL DEFAULT 'distraction'",
  "ALTER TABLE sessions ADD COLUMN tag TEXT",
  "ALTER TABLE sessions ADD COLUMN reason TEXT",
  "ALTER TABLE sessions ADD COLUMN started_at TEXT",
  "ALTER TABLE sessions ADD COLUMN ended_at TEXT",
  "ALTER TABLE sessions ADD COLUMN overtime_sec INTEGER DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN end_tag TEXT",
  "ALTER TABLE sessions ADD COLUMN end_reason TEXT",
  "ALTER TABLE sessions ADD COLUMN hyperfocus_sec INTEGER DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN mood_before TEXT",
  "ALTER TABLE sessions ADD COLUMN mood_after TEXT",
  "ALTER TABLE parking_items ADD COLUMN bucket TEXT NOT NULL DEFAULT 'today'",
  "ALTER TABLE distractions ADD COLUMN is_off_session INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN plan_name TEXT",
  "ALTER TABLE sessions ADD COLUMN round_index INTEGER DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE bio_logs ADD COLUMN sleep_hours REAL",
  "ALTER TABLE sessions ADD COLUMN session_group_id TEXT",
];

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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bio_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_time TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mood_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      phase TEXT NOT NULL DEFAULT 'checkin',
      mood TEXT NOT NULL,
      note TEXT,
      session_id INTEGER,
      created_at TEXT NOT NULL
    )
  `);

  for (const sql of ALTER_MIGRATIONS) {
    try {
      await db.execute(sql);
    } catch {
      // Column already exists
    }
  }

  // Legacy migration for pre-v0.1.7 early-stop tags
  await db.execute(
    `UPDATE sessions
     SET end_tag = tag, end_reason = reason, tag = NULL, reason = NULL
     WHERE mode = 'work' AND started_at IS NULL AND end_tag IS NULL
       AND (tag IS NOT NULL OR reason IS NOT NULL)`,
  );

  // Ensure default app_state row parameters exist when queried directly
  void DEFAULT_WORK_SEC;
  void DEFAULT_BREAK_SEC;

  return db;
}

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = initDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function enqueueSyncMutation(
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
    // Queue failures must not block core mutations
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function getSettingsMap(
  keys: string[],
): Promise<Map<string, string>> {
  const db = await getDb();
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<{ key: string; value: string }[]>(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    keys,
  );
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function setSettings(entries: [string, string][]): Promise<void> {
  const db = await getDb();
  for (const [key, value] of entries) {
    await db.execute(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}

export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDateStr(dateStr: string): Date {
  const parts = dateStr.split("-").map((v) => Number(v));
  if (
    parts.length === 3 &&
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1]) &&
    Number.isFinite(parts[2])
  ) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

export function getDateBoundsIso(dateStr: string): DateRangeFilter {
  const start = parseLocalDateStr(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = parseLocalDateStr(dateStr);
  end.setHours(23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function getWeekBoundsIso(anchorDateStr?: string): DateRangeFilter {
  const end = anchorDateStr ? parseLocalDateStr(anchorDateStr) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function makeDayLabel(date: Date, locale = "tr-TR"): string {
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

/**
 * Reuses today's active `study_days` row when it matches the current calendar day,
 * archiving old rows only when the calendar date rolls over.
 */
export async function getOrCreateActiveDay(
  db: Database,
  locale = "tr-TR",
): Promise<{ id: number; label: string }> {
  const todayStr = toLocalDateStr();
  const todayLabel = makeDayLabel(new Date(), locale);
  const rows = await db.select<
    { id: number; label: string; started_at: string }[]
  >(
    "SELECT id, label, started_at FROM study_days WHERE is_active = 1 ORDER BY id DESC LIMIT 1",
  );

  if (rows.length > 0) {
    const cur = rows[0];
    const rowDayStr = toLocalDateStr(new Date(cur.started_at));
    if (rowDayStr === todayStr) {
      return { id: Number(cur.id), label: todayLabel };
    }
    const nowIso = new Date().toISOString();
    await db.execute(
      "UPDATE study_days SET is_active = 0, ended_at = $1 WHERE is_active = 1",
      [nowIso],
    );
  }

  const nowIso = new Date().toISOString();
  const res = await db.execute(
    "INSERT INTO study_days (label, started_at, is_active) VALUES ($1, $2, 1)",
    [todayLabel, nowIso],
  );
  return { id: Number(res.lastInsertId), label: todayLabel };
}
