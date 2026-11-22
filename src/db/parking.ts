import { enqueueSyncMutation, getDb, getOrCreateActiveDay } from "./core";
import {
  DateRangeFilter,
  ParkingBucket,
  ParkingItem,
  ParkingItemType,
  ParkingLotData,
  ParkingStatus,
} from "./types";

function mapParkingRow(r: ParkingItem): ParkingItem {
  const iType: ParkingItemType =
    r.item_type === "idea"
      ? "idea"
      : r.item_type === "screenshot"
        ? "screenshot"
        : "task";
  const bucket: ParkingBucket =
    r.bucket === "maybe" || r.bucket === "archived" ? r.bucket : "today";

  return {
    id: Number(r.id),
    day_id: Number(r.day_id),
    item_type: iType,
    content: r.content,
    status: r.status as ParkingStatus,
    bucket,
    active_app: r.active_app ?? null,
    active_window: r.active_window ?? null,
    context_text: r.context_text ?? null,
    screenshot_data: r.screenshot_data ?? null,
    keep_synced: Number(r.keep_synced ?? 0),
    keep_note_id: r.keep_note_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function addParkingItem(params: {
  itemType: ParkingItemType;
  content: string;
  bucket?: ParkingBucket;
  activeApp?: string;
  activeWindow?: string;
  contextText?: string;
  screenshotData?: string;
}): Promise<ParkingItem | null> {
  const trimmed =
    params.content.trim() ||
    (params.itemType === "screenshot" ? "📸 Ekran Görüntüsü Notu" : "");
  if (!trimmed) return null;
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);
  const nowIso = new Date().toISOString();
  const status: ParkingStatus =
    params.itemType === "task" ? "pending" : "unrated";
  const bucket: ParkingBucket = params.bucket ?? "today";
  const app = params.activeApp?.trim() || null;
  const win = params.activeWindow?.trim() || null;
  const ctx = params.contextText?.trim() || null;
  const shot = params.screenshotData || null;

  const res = await db.execute(
    `INSERT INTO parking_items (
       day_id, item_type, content, status, bucket, active_app, active_window, context_text, screenshot_data, keep_synced, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11)`,
    [
      day.id,
      params.itemType,
      trimmed,
      status,
      bucket,
      app,
      win,
      ctx,
      shot,
      nowIso,
      nowIso,
    ],
  );

  const item: ParkingItem = {
    id: Number(res.lastInsertId),
    day_id: day.id,
    item_type: params.itemType,
    content: trimmed,
    status,
    bucket,
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
  dateRange?: DateRangeFilter,
  includeAllPendingTasks = true,
): Promise<ParkingLotData> {
  const db = await getDb();
  const params: (number | string)[] = [];
  let whereClause = "";
  if (dateRange) {
    whereClause = includeAllPendingTasks
      ? "WHERE (created_at >= $1 AND created_at <= $2) OR (item_type = 'task' AND status != 'done' AND COALESCE(bucket, 'today') != 'archived')"
      : "WHERE created_at >= $1 AND created_at <= $2";
    params.push(dateRange.startIso, dateRange.endIso);
  } else if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    whereClause = includeAllPendingTasks
      ? "WHERE day_id = $1 OR (item_type = 'task' AND status != 'done' AND COALESCE(bucket, 'today') != 'archived')"
      : "WHERE day_id = $1";
    params.push(day.id);
  }

  const rows = await db.select<ParkingItem[]>(
    `SELECT id, day_id, item_type, content, status, COALESCE(bucket, 'today') AS bucket,
            active_app, active_window, context_text, screenshot_data,
            COALESCE(keep_synced, 0) AS keep_synced, keep_note_id, created_at, updated_at
     FROM parking_items
     ${whereClause}
     ORDER BY id ASC`,
    params,
  );

  const pendingTasks: ParkingItem[] = [];
  const doneTasks: ParkingItem[] = [];
  const maybeTasks: ParkingItem[] = [];
  const unratedIdeas: ParkingItem[] = [];
  const importantIdeas: ParkingItem[] = [];
  const unimportantIdeas: ParkingItem[] = [];
  const maybeIdeas: ParkingItem[] = [];
  const screenshotNotes: ParkingItem[] = [];
  const archivedItems: ParkingItem[] = [];

  for (const r of rows) {
    const item = mapParkingRow(r);

    if (item.bucket === "archived") {
      archivedItems.push(item);
    } else if (item.bucket === "maybe") {
      if (item.item_type === "task") {
        maybeTasks.push(item);
      } else {
        maybeIdeas.push(item);
      }
    } else if (item.item_type === "task") {
      if (item.status === "done") {
        doneTasks.push(item);
      } else {
        pendingTasks.push(item);
      }
    } else if (item.item_type === "screenshot") {
      screenshotNotes.push(item);
    } else if (item.status === "important") {
      importantIdeas.push(item);
    } else if (item.status === "unimportant") {
      unimportantIdeas.push(item);
    } else {
      unratedIdeas.push(item);
    }
  }

  return {
    pendingTasks,
    doneTasks,
    maybeTasks,
    unratedIdeas,
    importantIdeas,
    unimportantIdeas,
    maybeIdeas,
    screenshotNotes,
    archivedItems,
    totalTasks: pendingTasks.length + doneTasks.length,
    totalIdeas:
      unratedIdeas.length + importantIdeas.length + unimportantIdeas.length,
    totalScreenshots: screenshotNotes.length,
  };
}

export async function getBreakParkingLotData(
  recentDays = 3,
  limit = 12,
): Promise<ParkingLotData> {
  const db = await getDb();
  const cutoffIso = new Date(
    Date.now() - recentDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = await db.select<ParkingItem[]>(
    `SELECT id, day_id, item_type, content, status, COALESCE(bucket, 'today') AS bucket,
            active_app, active_window, context_text, screenshot_data,
            COALESCE(keep_synced, 0) AS keep_synced, keep_note_id, created_at, updated_at
     FROM parking_items
     WHERE item_type = 'task'
       AND status != 'done'
       AND COALESCE(bucket, 'today') = 'today'
       AND created_at >= $1
     ORDER BY id DESC
     LIMIT $2`,
    [cutoffIso, limit],
  );

  const pendingTasks = rows.map(mapParkingRow);
  return {
    pendingTasks,
    doneTasks: [],
    maybeTasks: [],
    unratedIdeas: [],
    importantIdeas: [],
    unimportantIdeas: [],
    maybeIdeas: [],
    screenshotNotes: [],
    archivedItems: [],
    totalTasks: pendingTasks.length,
    totalIdeas: 0,
    totalScreenshots: 0,
  };
}

export async function updateParkingBucket(
  id: number,
  bucket: ParkingBucket,
): Promise<void> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  await db.execute(
    "UPDATE parking_items SET bucket = $1, updated_at = $2 WHERE id = $3",
    [bucket, nowIso, id],
  );
  await enqueueSyncMutation(db, "parking_item_update", {
    id,
    bucket,
    updated_at: nowIso,
  });
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
  await enqueueSyncMutation(db, "parking_item_update", {
    id,
    status,
    updated_at: nowIso,
  });
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
  await enqueueSyncMutation(db, "parking_item_update", {
    id,
    status: rating,
    updated_at: nowIso,
  });
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
