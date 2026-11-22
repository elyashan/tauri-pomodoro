import {
  enqueueSyncMutation,
  getDateBoundsIso,
  getDb,
  getOrCreateActiveDay,
  getSetting,
  makeDayLabel,
  parseLocalDateStr,
  setSetting,
  toLocalDateStr,
} from "./core";
import {
  ActiveDayStats,
  AppState,
  BreakKind,
  ClearDataOptions,
  DateRangeFilter,
  DEFAULT_BREAK_SEC,
  DEFAULT_WORK_SEC,
  MoodType,
  PageType,
  RuntimeState,
  TimelineSessionItem,
  TimerMode,
  WeekDayStat,
  WeeklySummary,
} from "./types";

const VALID_PAGES: PageType[] = [
  "menu",
  "timer",
  "work",
  "break",
  "summary",
  "settings",
  "dashboard",
];

// ---------------------------------------------------------------------------
// App & Runtime State Snapshots
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

export async function loadRuntimeState(): Promise<RuntimeState | null> {
  const rawStr = await getSetting("runtimeState");
  if (!rawStr) return null;
  try {
    const raw = JSON.parse(rawStr) as Partial<RuntimeState>;
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
      workStartedAt:
        typeof raw.workStartedAt === "string" ? raw.workStartedAt : null,
      breakStartedAt:
        typeof raw.breakStartedAt === "string" ? raw.breakStartedAt : null,
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
      workPauseStartedAt:
        typeof raw.workPauseStartedAt === "number" &&
        Number.isFinite(raw.workPauseStartedAt) &&
        raw.workPauseStartedAt > 0
          ? Math.round(raw.workPauseStartedAt)
          : null,
      isHyperfocus: Boolean(raw.isHyperfocus),
      hyperfocusExtraSec: posInt(raw.hyperfocusExtraSec, 0),
      sessionStartMood:
        raw.sessionStartMood === "calm" ||
        raw.sessionStartMood === "focused" ||
        raw.sessionStartMood === "tired" ||
        raw.sessionStartMood === "anxious" ||
        raw.sessionStartMood === "motivated"
          ? raw.sessionStartMood
          : null,
      lastActiveAt:
        typeof raw.lastActiveAt === "number" &&
        Number.isFinite(raw.lastActiveAt) &&
        raw.lastActiveAt > 0
          ? Math.round(raw.lastActiveAt)
          : null,
    };
  } catch {
    return null;
  }
}

export async function saveRuntimeState(state: RuntimeState): Promise<void> {
  await setSetting("runtimeState", JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Days, Work & Break Sessions, Statistics
// ---------------------------------------------------------------------------

export async function getActiveDayStats(
  locale = "tr-TR",
): Promise<ActiveDayStats> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db, locale);
  const { startIso, endIso } = getDateBoundsIso(toLocalDateStr());

  const rows = await db.select<{ total: number | null; cnt: number }[]>(
    `SELECT COALESCE(SUM(duration_sec), 0) AS total, COUNT(id) AS cnt
     FROM sessions
     WHERE mode = 'work' AND created_at >= $1 AND created_at <= $2`,
    [startIso, endIso],
  );

  const totalSec = Number(rows[0]?.total ?? 0);
  const sessionCount = Number(rows[0]?.cnt ?? 0);

  return {
    dayId: day.id,
    label: makeDayLabel(new Date(), locale),
    totalSec,
    sessionCount,
    avgSec: sessionCount > 0 ? Math.round(totalSec / sessionCount) : 0,
  };
}

export async function recordWorkSession(
  durationSec: number,
  tag?: string,
  reason?: string,
  startedAt?: string,
  endedAt?: string,
  endTag?: string,
  endReason?: string,
  hyperfocusSec = 0,
  moodBefore?: MoodType | null,
  moodAfter?: MoodType | null,
): Promise<number | null> {
  const sec = Math.round(durationSec);
  if (sec <= 0) return null;

  const hf = Math.max(0, Math.round(hyperfocusSec));
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const now = new Date();
  const endIso = endedAt || now.toISOString();
  const endMs = new Date(endIso).getTime();
  const parsedStartMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const maxSlackMs = 5 * 60 * 1000;
  const validStartMs =
    Number.isFinite(parsedStartMs) &&
    parsedStartMs <= endMs &&
    endMs - parsedStartMs <= sec * 1000 + maxSlackMs
      ? parsedStartMs
      : endMs - sec * 1000;
  const startIso = new Date(validStartMs).toISOString();

  const res = await db.execute(
    `INSERT INTO sessions (day_id, mode, duration_sec, created_at, tag, reason, started_at, ended_at, overtime_sec, end_tag, end_reason, hyperfocus_sec, mood_before, mood_after)
     VALUES ($1, 'work', $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12)`,
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
      hf,
      moodBefore || null,
      moodAfter || null,
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
    hyperfocus_sec: hf,
    mood_before: moodBefore || null,
    mood_after: moodAfter || null,
  });
  let insertedId = Number(res.lastInsertId) || null;
  if (!insertedId) {
    const idRows = await db.select<{ id: number }[]>(
      "SELECT id FROM sessions ORDER BY id DESC LIMIT 1",
    );
    insertedId = Number(idRows[0]?.id) || null;
  }
  return insertedId;
}

export async function deleteWorkSessionById(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM sessions WHERE id = $1", [id]);
}

export async function updateSessionMoodAfter(
  id: number,
  mood: MoodType,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET mood_after = $1 WHERE id = $2", [
    mood,
    id,
  ]);
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
  const startIso =
    startedAt || new Date(now.getTime() - sec * 1000).toISOString();
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

export async function getDayStatsForDate(
  dateStr: string,
): Promise<{ totalSec: number; sessionCount: number; avgSec: number }> {
  const db = await getDb();
  const { startIso, endIso } = getDateBoundsIso(dateStr);
  const rows = await db.select<{ total: number | null; cnt: number }[]>(
    `SELECT COALESCE(SUM(duration_sec), 0) AS total, COUNT(id) AS cnt
     FROM sessions
     WHERE mode = 'work' AND created_at >= $1 AND created_at <= $2`,
    [startIso, endIso],
  );
  const totalSec = Number(rows[0]?.total ?? 0);
  const sessionCount = Number(rows[0]?.cnt ?? 0);
  return {
    totalSec,
    sessionCount,
    avgSec: sessionCount > 0 ? Math.round(totalSec / sessionCount) : 0,
  };
}

export async function getTimelineSessions(
  dayId?: number,
  dateRange?: DateRangeFilter,
): Promise<TimelineSessionItem[]> {
  const db = await getDb();
  const effectiveRange = dateRange ?? getDateBoundsIso(toLocalDateStr());
  let rows: {
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
    hyperfocus_sec: number | null;
    mood_before: string | null;
    mood_after: string | null;
  }[];

  if (dayId !== undefined && !dateRange) {
    rows = await db.select(
      `SELECT id, day_id, mode, duration_sec, created_at, tag, reason, started_at, ended_at,
              overtime_sec, COALESCE(hyperfocus_sec, 0) AS hyperfocus_sec, mood_before, mood_after
       FROM sessions
       WHERE day_id = $1
       ORDER BY COALESCE(started_at, created_at) ASC`,
      [dayId],
    );
  } else {
    rows = await db.select(
      `SELECT id, day_id, mode, duration_sec, created_at, tag, reason, started_at, ended_at,
              overtime_sec, COALESCE(hyperfocus_sec, 0) AS hyperfocus_sec, mood_before, mood_after
       FROM sessions
       WHERE COALESCE(ended_at, created_at) > $1 AND COALESCE(started_at, created_at) <= $2
       ORDER BY COALESCE(started_at, created_at) ASC`,
      [effectiveRange.startIso, effectiveRange.endIso],
    );
  }

  const dayStartMs = new Date(effectiveRange.startIso).getTime();
  const dayEndMs = new Date(effectiveRange.endIso).getTime();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const items: TimelineSessionItem[] = rows
    .map((r): TimelineSessionItem | null => {
      const dur = Number(r.duration_sec);
      const overtime = Number(r.overtime_sec ?? 0);
      const hyperfocus = Number(r.hyperfocus_sec ?? 0);
      const end = r.ended_at ? new Date(r.ended_at) : new Date(r.created_at);
      const endMs = end.getTime();
      const rawStart = r.started_at
        ? new Date(r.started_at)
        : new Date(endMs - dur * 1000);
      const rawStartMs = rawStart.getTime();

      // Self-heal old corrupted rows whose wall-clock span is >10 min larger than actual duration
      const wallSpanMs = endMs - rawStartMs;
      const maxExpectedSpanMs = Math.max(dur, 60) * 1000 + 10 * 60 * 1000;
      const effectiveStartMs =
        !Number.isFinite(rawStartMs) ||
        rawStartMs > endMs ||
        wallSpanMs > maxExpectedSpanMs
          ? endMs - Math.max(dur, 1) * 1000
          : rawStartMs;

      const clampedStartMs = Math.max(effectiveStartMs, dayStartMs);
      const clampedEndMs = Math.min(endMs, dayEndMs);
      if (clampedEndMs <= clampedStartMs) {
        return null;
      }

      const clampedStart = new Date(clampedStartMs);
      const clampedEnd = new Date(clampedEndMs);
      const endsAtMidnight = clampedEndMs >= dayEndMs - 1000;

      const rawStartH =
        clampedStartMs <= dayStartMs
          ? 0
          : clampedStart.getHours() +
            clampedStart.getMinutes() / 60 +
            clampedStart.getSeconds() / 3600;
      const sH = Math.min(23.95, Math.max(0, rawStartH));
      const rawEndH = endsAtMidnight
        ? 24
        : clampedEnd.getHours() +
          clampedEnd.getMinutes() / 60 +
          clampedEnd.getSeconds() / 3600;
      const eH = Math.min(24, Math.max(sH + 0.05, rawEndH));

      const startLbl = `${pad(clampedStart.getHours())}:${pad(clampedStart.getMinutes())}`;
      const endLbl = endsAtMidnight
        ? "24:00"
        : `${pad(clampedEnd.getHours())}:${pad(clampedEnd.getMinutes())}`;
      const timeRangeLabel = `${startLbl} - ${endLbl}`;
      const mins = Math.round(dur / 60);
      const durationLabel =
        mins < 60 ? `${mins} dk` : `${Math.floor(mins / 60)} sa ${mins % 60} dk`;

      return {
        id: Number(r.id),
        dayId: Number(r.day_id),
        mode:
          r.mode === "idle"
            ? ("idle" as const)
            : r.mode === "break"
              ? ("break" as const)
              : ("work" as const),
        durationSec: dur,
        overtimeSec: overtime,
        hyperfocusSec: hyperfocus,
        moodBefore: (r.mood_before as MoodType | null) || null,
        moodAfter: (r.mood_after as MoodType | null) || null,
        tag: r.tag,
        reason: r.reason,
        startedAt: clampedStart.toISOString(),
        endedAt: clampedEnd.toISOString(),
        startHour: sH,
        endHour: eH,
        timeRangeLabel,
        durationLabel,
      };
    })
    .filter((item): item is TimelineSessionItem => item !== null);

  return items.sort(
    (a, b) => a.startHour - b.startHour || a.endHour - b.endHour || a.id - b.id,
  );
}

export async function getWeeklySummary(
  locale = "tr-TR",
  anchorDateStr?: string,
): Promise<WeeklySummary> {
  const db = await getDb();

  const now = new Date();
  const anchor = anchorDateStr ? parseLocalDateStr(anchorDateStr) : now;
  const mondayOffset = (anchor.getDay() + 6) % 7;

  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - mondayOffset);
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
  const shortNames = isTr
    ? ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      dateLabel: d.toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
      }),
      fullDateStr: toLocalDateStr(d),
      total_sec: daySec,
      session_count: dayCount,
      is_today: isToday,
    });
  }

  return {
    days,
    totalSec,
    sessionCount: totalSessions,
    dailyAvgSec: Math.round(totalSec / 7),
    activeDaysCount: days.filter((d) => d.total_sec > 0).length,
  };
}

export async function clearSelectedData(
  options: ClearDataOptions,
  locale = "tr-TR",
): Promise<void> {
  if (!options.workTime && !options.distractions) return;
  const db = await getDb();

  if (options.workTime && options.distractions) {
    for (const table of [
      "sessions",
      "distractions",
      "parking_items",
      "context_logs",
      "work_story_entries",
      "bio_logs",
      "mood_logs",
      "sync_queue",
      "study_days",
    ]) {
      await db.execute(`DELETE FROM ${table}`);
    }
    await db.execute(
      "DELETE FROM settings WHERE key IN ('completedWorkCount', 'sessionShortBreakCount', 'runtimeState')",
    );
    await db.execute(
      "UPDATE app_state SET page = 'menu', work_seconds_left = $1, work_elapsed_sec = 0, break_seconds_left = $2 WHERE id = 1",
      [DEFAULT_WORK_SEC, DEFAULT_BREAK_SEC],
    );
    await getOrCreateActiveDay(db, locale);
    return;
  }

  if (options.workTime) {
    for (const table of [
      "sessions",
      "work_story_entries",
      "context_logs",
      "mood_logs",
    ]) {
      await db.execute(`DELETE FROM ${table}`);
    }
    await db.execute(
      "DELETE FROM sync_queue WHERE entity_type IN ('session', 'work_story_entry', 'work_story_delete', 'context_log_start', 'context_log_finalize')",
    );
    await db.execute(
      "DELETE FROM settings WHERE key IN ('completedWorkCount', 'sessionShortBreakCount', 'runtimeState')",
    );
    await db.execute(
      "UPDATE app_state SET page = 'menu', work_seconds_left = $1, work_elapsed_sec = 0, break_seconds_left = $2 WHERE id = 1",
      [DEFAULT_WORK_SEC, DEFAULT_BREAK_SEC],
    );
    await getOrCreateActiveDay(db, locale);
  }

  if (options.distractions) {
    await db.execute("DELETE FROM distractions");
    await db.execute("DELETE FROM parking_items");
    await db.execute("UPDATE context_logs SET distraction_count = 0");
    await db.execute(
      "DELETE FROM sync_queue WHERE entity_type IN ('distraction', 'parking_item', 'parking_item_add', 'parking_item_update', 'parking_item_delete', 'parking_update', 'parking_delete')",
    );
  }
}
