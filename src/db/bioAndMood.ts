import {
  getDateBoundsIso,
  getDb,
  getOrCreateActiveDay,
  toLocalDateStr,
} from "./core";
import {
  BioEventType,
  BioLogItem,
  DateRangeFilter,
  MoodLogItem,
  MoodPhase,
  MoodType,
} from "./types";

export async function addBioLog(
  eventType: BioEventType,
  eventTime?: string,
  note?: string,
): Promise<BioLogItem> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hm =
    eventTime && /^\d{1,2}:\d{2}$/.test(eventTime.trim())
      ? eventTime.trim()
      : `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const trimmedNote = note?.trim() || null;
  const createdAt = now.toISOString();

  const res = await db.execute(
    `INSERT INTO bio_logs (day_id, event_type, event_time, note, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [day.id, eventType, hm, trimmedNote, createdAt],
  );

  return {
    id: Number(res.lastInsertId),
    day_id: day.id,
    event_type: eventType,
    event_time: hm,
    note: trimmedNote,
    created_at: createdAt,
  };
}

export async function getBioLogs(
  onlyToday = true,
  dateRange?: DateRangeFilter,
): Promise<BioLogItem[]> {
  const db = await getDb();
  if (dateRange) {
    return db.select<BioLogItem[]>(
      `SELECT id, day_id, event_type, event_time, note, created_at
       FROM bio_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY event_time ASC, id ASC`,
      [dateRange.startIso, dateRange.endIso],
    );
  }
  if (onlyToday) {
    const todayRange = getDateBoundsIso(toLocalDateStr());
    return db.select<BioLogItem[]>(
      `SELECT id, day_id, event_type, event_time, note, created_at
       FROM bio_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY event_time ASC, id ASC`,
      [todayRange.startIso, todayRange.endIso],
    );
  }
  return db.select<BioLogItem[]>(
    `SELECT id, day_id, event_type, event_time, note, created_at
     FROM bio_logs
     ORDER BY created_at DESC, id DESC`,
  );
}

export async function deleteBioLog(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM bio_logs WHERE id = $1", [id]);
}

export async function addMoodLog(
  mood: MoodType,
  phase: MoodPhase = "checkin",
  note?: string,
  sessionId?: number | null,
): Promise<MoodLogItem> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const createdAt = new Date().toISOString();
  const trimmedNote = note?.trim() || null;

  const res = await db.execute(
    `INSERT INTO mood_logs (day_id, phase, mood, note, session_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [day.id, phase, mood, trimmedNote, sessionId ?? null, createdAt],
  );

  return {
    id: Number(res.lastInsertId),
    day_id: day.id,
    phase,
    mood,
    note: trimmedNote,
    session_id: sessionId ?? null,
    created_at: createdAt,
  };
}

export async function getMoodLogs(
  onlyToday = true,
  dateRange?: DateRangeFilter,
): Promise<MoodLogItem[]> {
  const db = await getDb();
  if (dateRange) {
    return db.select<MoodLogItem[]>(
      `SELECT id, day_id, phase, mood, note, session_id, created_at
       FROM mood_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at ASC, id ASC`,
      [dateRange.startIso, dateRange.endIso],
    );
  }
  if (onlyToday) {
    const todayRange = getDateBoundsIso(toLocalDateStr());
    return db.select<MoodLogItem[]>(
      `SELECT id, day_id, phase, mood, note, session_id, created_at
       FROM mood_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at ASC, id ASC`,
      [todayRange.startIso, todayRange.endIso],
    );
  }
  return db.select<MoodLogItem[]>(
    `SELECT id, day_id, phase, mood, note, session_id, created_at
     FROM mood_logs
     ORDER BY created_at DESC, id DESC`,
  );
}

export async function deleteMoodLog(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM mood_logs WHERE id = $1", [id]);
}
