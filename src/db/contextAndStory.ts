import { enqueueSyncMutation, getDb, getOrCreateActiveDay } from "./core";
import {
  ContextStatItem,
  DateRangeFilter,
  WorkStoryEntry,
  WorkStoryEntryType,
} from "./types";

// ---------------------------------------------------------------------------
// Active Context Logs
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
  dateRange?: DateRangeFilter,
): Promise<ContextStatItem[]> {
  const db = await getDb();
  const params: (number | string)[] = [];
  let whereClause = "";
  if (dateRange) {
    whereClause = "WHERE started_at >= $1 AND started_at <= $2";
    params.push(dateRange.startIso, dateRange.endIso);
  } else if (onlyToday) {
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
// Work Story Entries (Periodic Screenshots & Active Window Snapshots)
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
    [
      day.id,
      params.entryType,
      ctx,
      wTag,
      app,
      win,
      note,
      shot,
      elapsed,
      nowIso,
    ],
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
  limit = 80,
  dateRange?: DateRangeFilter,
): Promise<WorkStoryEntry[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(200, Math.round(limit)));
  const params: (number | string)[] = [];
  let whereClause = "";
  if (dateRange) {
    whereClause = "WHERE created_at >= $1 AND created_at <= $2";
    params.push(dateRange.startIso, dateRange.endIso);
  } else if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    whereClause = "WHERE day_id = $1";
    params.push(day.id);
  }
  params.push(safeLimit);

  const rows = await db.select<WorkStoryEntry[]>(
    `SELECT id, day_id, entry_type, context_text, work_tag, active_app, active_window,
            note, screenshot_data, elapsed_work_sec, created_at
     FROM work_story_entries
     ${whereClause}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params,
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
