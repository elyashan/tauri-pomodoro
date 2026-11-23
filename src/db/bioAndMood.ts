import {
  getDateBoundsIso,
  getDb,
  getOrCreateActiveDay,
  parseLocalDateStr,
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
  sleepHours?: number | null,
  targetDateStr?: string,
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
  const sleepVal =
    eventType === "wake" &&
    typeof sleepHours === "number" &&
    Number.isFinite(sleepHours) &&
    sleepHours > 0
      ? sleepHours
      : null;

  let createdAt = now.toISOString();
  if (targetDateStr) {
    const baseDate = parseLocalDateStr(targetDateStr);
    const [hhRaw, mmRaw] = hm.split(":");
    const hh = Number(hhRaw);
    const mm = Number(mmRaw);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      baseDate.setHours(
        Math.min(23, Math.max(0, hh)),
        Math.min(59, Math.max(0, mm)),
        0,
        0,
      );
    }
    createdAt = baseDate.toISOString();
  }

  const res = await db.execute(
    `INSERT INTO bio_logs (day_id, event_type, event_time, note, sleep_hours, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [day.id, eventType, hm, trimmedNote, sleepVal, createdAt],
  );

  return {
    id: Number(res.lastInsertId),
    day_id: day.id,
    event_type: eventType,
    event_time: hm,
    note: trimmedNote,
    sleep_hours: sleepVal,
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
      `SELECT id, day_id, event_type, event_time, note, sleep_hours, created_at
       FROM bio_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY event_time ASC, id ASC`,
      [dateRange.startIso, dateRange.endIso],
    );
  }
  if (onlyToday) {
    const todayRange = getDateBoundsIso(toLocalDateStr());
    return db.select<BioLogItem[]>(
      `SELECT id, day_id, event_type, event_time, note, sleep_hours, created_at
       FROM bio_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY event_time ASC, id ASC`,
      [todayRange.startIso, todayRange.endIso],
    );
  }
  return db.select<BioLogItem[]>(
    `SELECT id, day_id, event_type, event_time, note, sleep_hours, created_at
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
