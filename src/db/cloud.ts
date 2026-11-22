import {
  getDb,
  getOrCreateActiveDay,
  getSetting,
  setSetting,
} from "./core";
import {
  CloudAuthState,
  DEFAULT_CLOUD_AUTH,
  ParkingItem,
  SyncQueueItem,
  UserCloudSnapshot,
  WorkStoryEntry,
} from "./types";

export async function loadCloudAuthState(): Promise<CloudAuthState> {
  const raw = await getSetting("cloudAuthState");
  if (!raw) return { ...DEFAULT_CLOUD_AUTH };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_CLOUD_AUTH };
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      name: typeof parsed.name === "string" ? parsed.name : "",
      picture: typeof parsed.picture === "string" ? parsed.picture : "",
      accessToken:
        typeof parsed.accessToken === "string" ? parsed.accessToken : "",
      serverUrl:
        typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()
          ? parsed.serverUrl.trim().replace(/\/+$/, "")
          : DEFAULT_CLOUD_AUTH.serverUrl,
      googleClientId:
        typeof parsed.googleClientId === "string"
          ? parsed.googleClientId.trim()
          : "",
      autoSyncKeep:
        typeof parsed.autoSyncKeep === "boolean" ? parsed.autoSyncKeep : true,
      googleDocId:
        typeof parsed.googleDocId === "string" ? parsed.googleDocId : null,
      googleDocUrl:
        typeof parsed.googleDocUrl === "string" ? parsed.googleDocUrl : null,
      lastSyncAt:
        typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : null,
    };
  } catch {
    return { ...DEFAULT_CLOUD_AUTH };
  }
}

export async function saveCloudAuthState(state: CloudAuthState): Promise<void> {
  await setSetting("cloudAuthState", JSON.stringify(state));
}

export async function getPendingSyncQueue(
  limit = 100,
): Promise<SyncQueueItem[]> {
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

export async function exportUserCloudSnapshot(): Promise<UserCloudSnapshot> {
  const db = await getDb();
  const [
    study_days,
    sessions,
    distractions,
    parking_items,
    context_logs,
    work_story_entries,
    tags,
  ] = await Promise.all([
    db.select<unknown[]>("SELECT * FROM study_days ORDER BY id ASC"),
    db.select<unknown[]>("SELECT * FROM sessions ORDER BY id ASC"),
    db.select<unknown[]>("SELECT * FROM distractions ORDER BY id ASC"),
    db.select<unknown[]>("SELECT * FROM parking_items ORDER BY id ASC"),
    db.select<unknown[]>("SELECT * FROM context_logs ORDER BY id ASC"),
    db.select<unknown[]>(
      "SELECT * FROM work_story_entries ORDER BY id DESC LIMIT 60",
    ),
    db.select<unknown[]>("SELECT * FROM tags ORDER BY id ASC"),
  ]);

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

export async function mergeRemoteSnapshotToLocal(
  remote: Partial<UserCloudSnapshot> | null | undefined,
): Promise<void> {
  if (!remote) return;
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);

  if (Array.isArray(remote.parking_items)) {
    const localRows = await db.select<{
      id: number;
      content: string;
      created_at: string;
      status: string;
    }[]>("SELECT id, content, created_at, status FROM parking_items");
    const localKeyMap = new Map(
      localRows.map((r) => [`${r.content}|||${r.created_at}`, r]),
    );
    for (const rawItem of remote.parking_items) {
      const item = rawItem as Partial<ParkingItem> | null;
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

  if (Array.isArray(remote.work_story_entries)) {
    const localStories = await db.select<{ created_at: string }[]>(
      "SELECT created_at FROM work_story_entries",
    );
    const seen = new Set(localStories.map((s) => s.created_at));
    for (const rawSt of remote.work_story_entries) {
      const st = rawSt as Partial<WorkStoryEntry> | null;
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
