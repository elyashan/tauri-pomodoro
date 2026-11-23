import Database from "@tauri-apps/plugin-sql";
import {
  enqueueSyncMutation,
  getDb,
  getOrCreateActiveDay,
} from "./core";
import {
  AdhdInsightsData,
  AppDistractionDetail,
  AppDistractionGroup,
  DateRangeFilter,
  DistractionCategory,
  DistractionTrigger,
  MoodType,
  RecordDistractionParams,
  SummaryReasonsData,
  TagItem,
  TagKind,
  TagSummaryItem,
} from "./types";

function categoryToTrigger(cat: DistractionCategory): DistractionTrigger {
  return cat === "external" ? "external" : "internal";
}

// ---------------------------------------------------------------------------
// Distractions Logging
// ---------------------------------------------------------------------------

export async function recordDistraction(
  rawReasonOrParams: string | RecordDistractionParams,
  rawTag?: string,
  elapsedWorkSec = 0,
  triggerType: DistractionTrigger = "internal",
): Promise<void> {
  const db = await getDb();
  const day = await getOrCreateActiveDay(db);

  let rawReason = "";
  let tagInput = rawTag;
  let elapsedInput = elapsedWorkSec;
  let category: DistractionCategory =
    triggerType === "external" ? "external" : "internal";
  let activeApp: string | null = null;
  let activeWindow: string | null = null;
  let contextText: string | null = null;
  let penaltySec = 0;
  let isOffSession = 0;

  if (typeof rawReasonOrParams === "string") {
    rawReason = rawReasonOrParams;
  } else {
    rawReason = rawReasonOrParams.reason;
    tagInput = rawReasonOrParams.tag;
    elapsedInput = rawReasonOrParams.elapsedWorkSec ?? 0;
    category = rawReasonOrParams.category ?? "internal";
    activeApp = rawReasonOrParams.activeApp?.trim() || null;
    activeWindow = rawReasonOrParams.activeWindow?.trim() || null;
    contextText = rawReasonOrParams.contextText?.trim() || null;
    penaltySec = Math.max(
      0,
      Math.round(Number(rawReasonOrParams.penaltySec) || 0),
    );
    isOffSession = rawReasonOrParams.isOffSession ? 1 : 0;
  }

  const trimmed = rawReason.trim();
  const tag = (tagInput && tagInput.trim()) || "Tag Yok";
  const normalized =
    trimmed.length > 0
      ? trimmed.charAt(0).toLocaleUpperCase("tr-TR") + trimmed.slice(1)
      : tag;
  const elapsed = Math.max(0, Math.round(Number(elapsedInput) || 0));
  const trig: DistractionTrigger = categoryToTrigger(category);

  const nowIso = new Date().toISOString();
  await db.execute(
    `INSERT INTO distractions (
       day_id, reason, tag, created_at, elapsed_work_sec, trigger_type,
       category, active_app, active_window, context_text, penalty_sec, is_off_session
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      day.id,
      normalized,
      tag,
      nowIso,
      elapsed,
      trig,
      category,
      activeApp,
      activeWindow,
      contextText,
      penaltySec,
      isOffSession,
    ],
  );
  await enqueueSyncMutation(db, "distraction", {
    day_id: day.id,
    reason: normalized,
    tag,
    created_at: nowIso,
    elapsed_work_sec: elapsed,
    trigger_type: trig,
    category,
    active_app: activeApp,
    active_window: activeWindow,
    context_text: contextText,
    penalty_sec: penaltySec,
    is_off_session: isOffSession,
  });
}

// ---------------------------------------------------------------------------
// Tag & Reason Management
// ---------------------------------------------------------------------------

const DEFAULT_DISTRACTION_TAGS_TR = [
  "Telefon",
  "Sosyal Medya",
  "Çevre / İnsanlar",
  "Açlık / Mola",
  "Düşünceler",
  "Diğer",
];

const DEFAULT_ENDING_TAGS_TR = [
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
      // Ignore duplicate seeds
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
    const existing = await db.select<TagItem[]>(
      "SELECT id, name, kind FROM tags WHERE name = $1 AND kind = $2",
      [normalized, kind],
    );
    if (existing[0]) return existing[0];
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
  if (!oldName) return;

  if (kind.startsWith("distraction")) {
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
    await db.execute(
      "UPDATE sessions SET tag = $1 WHERE tag = $2 AND mode = 'work'",
      [normalized, oldName],
    );
  } else if (kind === "break_overtime") {
    await db.execute(
      "UPDATE sessions SET tag = $1 WHERE tag = $2 AND mode = 'break'",
      [normalized, oldName],
    );
  }
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tags WHERE id = $1", [id]);
}

export async function getCategoryTagsByPopularity(
  category: DistractionCategory,
  defaultTags: string[],
): Promise<TagItem[]> {
  const db = await getDb();
  const kind = `distraction_${category}` as TagKind;
  let rows = await db.select<TagItem[]>(
    "SELECT id, name, kind FROM tags WHERE kind = $1 ORDER BY id ASC",
    [kind],
  );
  if (rows.length === 0) {
    const nowIso = new Date().toISOString();
    const seedNames = [...defaultTags];
    if (category === "internal") {
      const legacyRows = await db.select<{ name: string }[]>(
        "SELECT name FROM tags WHERE kind = 'distraction' ORDER BY id ASC",
      );
      for (const lr of legacyRows) {
        if (lr.name && !seedNames.includes(lr.name)) {
          seedNames.push(lr.name);
        }
      }
    }
    for (const name of seedNames) {
      try {
        await db.execute(
          "INSERT INTO tags (name, kind, created_at) VALUES ($1, $2, $3)",
          [name, kind, nowIso],
        );
      } catch {
        // Ignore duplicates
      }
    }
    rows = await db.select<TagItem[]>(
      "SELECT id, name, kind FROM tags WHERE kind = $1 ORDER BY id ASC",
      [kind],
    );
  }

  const freqRows = await db.select<{
    tag: string;
    cat_cnt: number;
    total_cnt: number;
  }[]>(
    `SELECT tag,
            SUM(CASE WHEN category = $1 THEN 1 ELSE 0 END) AS cat_cnt,
            COUNT(id) AS total_cnt
     FROM distractions
     WHERE tag IS NOT NULL AND tag != ''
     GROUP BY tag`,
    [category],
  );
  const freqMap = new Map(
    freqRows.map((r) => [
      r.tag,
      { catCnt: Number(r.cat_cnt) || 0, totalCnt: Number(r.total_cnt) || 0 },
    ]),
  );

  return [...rows].sort((a, b) => {
    const fa = freqMap.get(a.name);
    const fb = freqMap.get(b.name);
    const catDiff = (fb?.catCnt || 0) - (fa?.catCnt || 0);
    if (catDiff !== 0) return catDiff;
    const totDiff = (fb?.totalCnt || 0) - (fa?.totalCnt || 0);
    if (totDiff !== 0) return totDiff;
    return a.id - b.id;
  });
}

export async function addCategoryTag(
  rawName: string,
  category: DistractionCategory,
): Promise<TagItem | null> {
  return addTag(rawName, `distraction_${category}` as TagKind);
}

export async function getTopCategoryReasons(
  category: DistractionCategory,
  tag: string,
  limit = 5,
): Promise<string[]> {
  const db = await getDb();
  const trimmedTag = tag.trim();
  const safeLimit = Math.max(1, Math.min(20, Math.round(limit)));
  if (trimmedTag) {
    const rows = await db.select<{ reason: string }[]>(
      `SELECT reason, COUNT(id) AS cnt, MAX(id) AS last_id
       FROM distractions
       WHERE category = $1
         AND tag = $2
         AND reason IS NOT NULL
         AND TRIM(reason) != ''
         AND reason != $2
       GROUP BY reason
       ORDER BY cnt DESC, last_id DESC
       LIMIT $3`,
      [category, trimmedTag, safeLimit],
    );
    return rows.map((r) => r.reason);
  }

  const rows = await db.select<{ reason: string }[]>(
    `SELECT reason, COUNT(id) AS cnt, MAX(id) AS last_id
     FROM distractions
     WHERE category = $1
       AND reason IS NOT NULL
       AND TRIM(reason) != ''
       AND reason != COALESCE(tag, '')
     GROUP BY reason
     ORDER BY cnt DESC, last_id DESC
     LIMIT $2`,
    [category, safeLimit],
  );
  return rows.map((r) => r.reason);
}

export async function getPreviousReasons(
  kind: TagKind,
  tag?: string,
): Promise<string[]> {
  const db = await getDb();
  const cfg =
    kind === "distraction" || kind.startsWith("distraction_")
      ? { table: "distractions", baseWhere: "1=1", tagCol: "tag", reasonCol: "reason" }
      : kind === "work"
        ? { table: "sessions", baseWhere: "mode = 'work'", tagCol: "tag", reasonCol: "reason" }
        : kind === "break_overtime"
          ? {
              table: "sessions",
              baseWhere: "mode = 'break' AND overtime_sec > 0",
              tagCol: "tag",
              reasonCol: "reason",
            }
          : {
              table: "sessions",
              baseWhere: "mode = 'work'",
              tagCol: "end_tag",
              reasonCol: "end_reason",
            };

  const trimmedTag = tag?.trim();
  if (trimmedTag) {
    const rows = await db.select<{ reason: string }[]>(
      `SELECT ${cfg.reasonCol} AS reason, COUNT(id) AS cnt
       FROM ${cfg.table}
       WHERE ${cfg.baseWhere} AND ${cfg.tagCol} = $1
         AND ${cfg.reasonCol} IS NOT NULL AND ${cfg.reasonCol} != ''
         AND ${cfg.reasonCol} != ${cfg.tagCol}
       GROUP BY ${cfg.reasonCol}
       ORDER BY cnt DESC, MAX(id) DESC
       LIMIT 5`,
      [trimmedTag],
    );
    if (rows.length > 0) return rows.map((r) => r.reason);
  }

  const rows = await db.select<{ reason: string }[]>(
    `SELECT ${cfg.reasonCol} AS reason, COUNT(id) AS cnt
     FROM ${cfg.table}
     WHERE ${cfg.baseWhere}
       AND ${cfg.reasonCol} IS NOT NULL AND ${cfg.reasonCol} != ''
     GROUP BY ${cfg.reasonCol}
     ORDER BY cnt DESC, MAX(id) DESC
     LIMIT 5`,
  );
  return rows.map((r) => r.reason);
}

// ---------------------------------------------------------------------------
// Summary Breakdown & ADHD Self-Awareness Analytics
// ---------------------------------------------------------------------------

async function buildAnalyticsFilterClauses(
  db: Database,
  onlyToday: boolean,
  dateRange?: DateRangeFilter,
): Promise<{
  params: (number | string)[];
  dayClause: string;
  distWhere: string;
}> {
  const triggerFilter =
    "COALESCE(category, 'internal') IN ('internal', 'external')";
  const params: (number | string)[] = [];
  let dayClause = "";
  let distWhere = `WHERE ${triggerFilter}`;
  if (dateRange) {
    dayClause = "AND created_at >= $1 AND created_at <= $2";
    distWhere = `WHERE created_at >= $1 AND created_at <= $2 AND ${triggerFilter}`;
    params.push(dateRange.startIso, dateRange.endIso);
  } else if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    dayClause = "AND day_id = $1";
    distWhere = `WHERE day_id = $1 AND ${triggerFilter}`;
    params.push(day.id);
  }
  return { params, dayClause, distWhere };
}

export async function getSummaryReasonsData(
  onlyToday: boolean,
  dateRange?: DateRangeFilter,
): Promise<SummaryReasonsData> {
  const db = await getDb();
  const { params, dayClause, distWhere } = await buildAnalyticsFilterClauses(
    db,
    onlyToday,
    dateRange,
  );

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

  const workRows = await db.select<{ tag: string | null; reason: string | null }[]>(
    `SELECT tag, reason FROM sessions WHERE mode = 'work' ${dayClause} AND (tag IS NOT NULL OR reason IS NOT NULL)`,
    params,
  );
  const breakRows = await db.select<{ tag: string | null; reason: string | null }[]>(
    `SELECT tag, reason FROM sessions WHERE mode = 'break' ${dayClause} AND overtime_sec > 0`,
    params,
  );
  const distRows = await db.select<{
    tag: string | null;
    reason: string;
    is_off_session: number | null;
  }[]>(
    `SELECT tag, reason, COALESCE(is_off_session, 0) AS is_off_session FROM distractions ${distWhere}`,
    params,
  );
  const endingRows = await db.select<{ tag: string | null; reason: string | null }[]>(
    `SELECT end_tag AS tag, end_reason AS reason FROM sessions WHERE mode = 'work' ${dayClause} AND (end_tag IS NOT NULL OR end_reason IS NOT NULL)`,
    params,
  );
  const sessRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(id) AS cnt FROM sessions WHERE mode = 'work' ${dayClause}`,
    params,
  );

  const totalSessions = sessRows[0]?.cnt || 0;
  const totalDistractions = distRows.length;
  const inSessionDistractions = distRows.filter(
    (r) => !Number(r.is_off_session),
  ).length;

  return {
    workTags: buildTagItems(workRows),
    breakOvertimeTags: buildTagItems(breakRows),
    distractionTags: buildTagItems(distRows),
    endingTags: buildTagItems(endingRows),
    totalWorkSubjects: workRows.length,
    totalBreakOvertimes: breakRows.length,
    totalDistractions,
    totalEndings: endingRows.length,
    avgDistractionsPerSession:
      totalSessions > 0
        ? Number((inSessionDistractions / totalSessions).toFixed(1))
        : 0,
  };
}

export async function getAdhdInsights(
  onlyToday: boolean,
  dateRange?: DateRangeFilter,
): Promise<AdhdInsightsData> {
  const db = await getDb();
  const { params, dayClause, distWhere } = await buildAnalyticsFilterClauses(
    db,
    onlyToday,
    dateRange,
  );

  const [workSessions, breakSessions, distRows, moodRows] = await Promise.all([
    db.select<{
      duration_sec: number;
      started_at: string | null;
      created_at: string;
      end_tag: string | null;
      end_reason: string | null;
      hyperfocus_sec: number | null;
      is_completed: number | null;
      mood_before: string | null;
      mood_after: string | null;
    }[]>(
      `SELECT duration_sec, started_at, created_at, end_tag, end_reason,
              COALESCE(hyperfocus_sec, 0) AS hyperfocus_sec,
              COALESCE(is_completed, 0) AS is_completed,
              mood_before, mood_after
       FROM sessions WHERE mode = 'work' AND duration_sec >= 30 ${dayClause}`,
      params,
    ),
    db.select<{ duration_sec: number; overtime_sec: number | null }[]>(
      `SELECT duration_sec, overtime_sec
       FROM sessions WHERE mode = 'break' ${dayClause}`,
      params,
    ),
    db.select<{
      tag: string | null;
      created_at: string;
      elapsed_work_sec: number | null;
      trigger_type: string | null;
    }[]>(
      `SELECT tag, created_at, elapsed_work_sec, trigger_type
       FROM distractions ${distWhere} AND COALESCE(is_off_session, 0) = 0`,
      params,
    ),
    db.select<{ phase: string; mood: string }[]>(
      `SELECT phase, mood FROM mood_logs WHERE 1=1 ${dayClause}`,
      params,
    ),
  ]);

  const validElapsed = distRows
    .map((d) => Number(d.elapsed_work_sec ?? 0))
    .filter((s) => s >= 30 && s <= 180 * 60);
  const avgFocusThresholdMins =
    validElapsed.length > 0
      ? Math.max(
          1,
          Math.round(
            validElapsed.reduce((a, b) => a + b, 0) / validElapsed.length / 60,
          ),
        )
      : null;

  let internalCount = 0;
  let externalCount = 0;
  const tagFreq = new Map<string, number>();
  const distBuckets = new Array<number>(12).fill(0);

  for (const d of distRows) {
    if (d.trigger_type === "external") {
      externalCount++;
    } else {
      internalCount++;
    }
    const tg = d.tag?.trim() || "";
    if (
      tg &&
      tg !== "Tag Yok" &&
      tg !== "No Tag" &&
      tg !== "Diğer" &&
      tg !== "Other"
    ) {
      tagFreq.set(tg, (tagFreq.get(tg) || 0) + 1);
    }

    const dt = new Date(d.created_at);
    if (!Number.isNaN(dt.getTime())) {
      const b = Math.floor(dt.getHours() / 2);
      distBuckets[b] = (distBuckets[b] || 0) + 1;
    }
  }

  const totalDist = internalCount + externalCount;
  const internalPct =
    totalDist > 0 ? Math.round((internalCount / totalDist) * 100) : 50;

  let topTriggerTag: string | null = null;
  let topTriggerMax = 0;
  for (const [k, v] of tagFreq.entries()) {
    if (v > topTriggerMax) {
      topTriggerMax = v;
      topTriggerTag = k;
    }
  }

  const workBuckets = new Array<number>(12).fill(0);
  let completedCount = 0;
  let hyperfocusCount = 0;
  let hyperfocusSecSum = 0;
  const validMoods = new Set<MoodType>([
    "calm",
    "focused",
    "tired",
    "scattered",
    "overwhelmed",
    "anxious",
    "motivated",
  ]);
  const startMoodFreq = new Map<MoodType, number>();
  const endMoodFreq = new Map<MoodType, number>();
  let sessionsWithMood = 0;

  for (const w of workSessions) {
    const dur = Number(w.duration_sec) || 0;
    const hf = Math.max(0, Number(w.hyperfocus_sec ?? 0) || 0);
    if (Number(w.is_completed ?? 0) === 1) completedCount++;
    if (hf > 0) hyperfocusCount++;
    hyperfocusSecSum += hf;

    const mb = w.mood_before as MoodType | null;
    const ma = w.mood_after as MoodType | null;
    if (mb && validMoods.has(mb)) {
      startMoodFreq.set(mb, (startMoodFreq.get(mb) || 0) + 1);
    }
    if (ma && validMoods.has(ma)) {
      endMoodFreq.set(ma, (endMoodFreq.get(ma) || 0) + 1);
    }
    if (mb || ma) sessionsWithMood++;

    const dt = new Date(w.started_at || w.created_at);
    if (!Number.isNaN(dt.getTime())) {
      const b = Math.floor(dt.getHours() / 2);
      workBuckets[b] = (workBuckets[b] || 0) + dur;
    }
  }

  if (startMoodFreq.size === 0) {
    for (const m of moodRows) {
      if (m.phase === "start" && validMoods.has(m.mood as MoodType)) {
        const key = m.mood as MoodType;
        startMoodFreq.set(key, (startMoodFreq.get(key) || 0) + 1);
      }
    }
  }
  if (endMoodFreq.size === 0) {
    for (const m of moodRows) {
      if (m.phase === "end" && validMoods.has(m.mood as MoodType)) {
        const key = m.mood as MoodType;
        endMoodFreq.set(key, (endMoodFreq.get(key) || 0) + 1);
      }
    }
  }

  const pickTopMood = (map: Map<MoodType, number>): MoodType | null => {
    let best: MoodType | null = null;
    let bestCnt = 0;
    for (const [m, cnt] of map.entries()) {
      if (cnt > bestCnt) {
        bestCnt = cnt;
        best = m;
      }
    }
    return best;
  };
  const moodLoggedCount = Math.max(sessionsWithMood, moodRows.length);

  const formatBucket = (idx: number): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(idx * 2)}:00–${pad(idx * 2 + 2)}:00`;
  };

  const findMaxBucket = (buckets: number[]): string | null => {
    let bestIdx = -1;
    let maxVal = 0;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i] > maxVal) {
        maxVal = buckets[i];
        bestIdx = i;
      }
    }
    return bestIdx >= 0 ? formatBucket(bestIdx) : null;
  };

  const overtimeBreaks = breakSessions.filter(
    (b) => Number(b.overtime_sec ?? 0) > 0,
  );
  const overtimeBreakRatePct =
    breakSessions.length > 0
      ? Math.round((overtimeBreaks.length / breakSessions.length) * 100)
      : 0;
  const avgBreakOvertimeMins =
    overtimeBreaks.length > 0
      ? Math.max(
          1,
          Math.round(
            overtimeBreaks.reduce(
              (a, b) => a + Number(b.overtime_sec ?? 0),
              0,
            ) /
              overtimeBreaks.length /
              60,
          ),
        )
      : 0;

  const completionRatePct =
    workSessions.length > 0
      ? Math.round((completedCount / workSessions.length) * 100)
      : 0;

  return {
    avgFocusThresholdMins,
    internalCount,
    externalCount,
    internalPct,
    peakFocusHoursLabel: findMaxBucket(workBuckets),
    mostDistractedHoursLabel: findMaxBucket(distBuckets),
    avgBreakOvertimeMins,
    overtimeBreakRatePct,
    completionRatePct,
    hyperfocusCount,
    hyperfocusTotalMins: Math.round(hyperfocusSecSum / 60),
    topTriggerTag,
    moodLoggedCount,
    topStartMood: pickTopMood(startMoodFreq),
    topEndMood: pickTopMood(endMoodFreq),
  };
}

export async function getAppDistractionSummary(
  onlyToday: boolean,
  dateRange?: DateRangeFilter,
): Promise<AppDistractionGroup[]> {
  const db = await getDb();
  const params: (number | string)[] = [];
  let whereClause =
    "WHERE COALESCE(is_off_session, 0) = 0 AND ((active_app IS NOT NULL AND active_app != '') OR (active_window IS NOT NULL AND active_window != ''))";
  if (dateRange) {
    whereClause =
      "WHERE created_at >= $1 AND created_at <= $2 AND COALESCE(is_off_session, 0) = 0 AND ((active_app IS NOT NULL AND active_app != '') OR (active_window IS NOT NULL AND active_window != ''))";
    params.push(dateRange.startIso, dateRange.endIso);
  } else if (onlyToday) {
    const day = await getOrCreateActiveDay(db);
    whereClause =
      "WHERE day_id = $1 AND COALESCE(is_off_session, 0) = 0 AND ((active_app IS NOT NULL AND active_app != '') OR (active_window IS NOT NULL AND active_window != ''))";
    params.push(day.id);
  }

  const rows = await db.select<{
    active_app: string | null;
    active_window: string | null;
    context_text: string | null;
    reason: string;
    category: string | null;
  }[]>(
    `SELECT active_app, active_window, context_text, reason, category
     FROM distractions
     ${whereClause}
     ORDER BY id DESC`,
    params,
  );

  const appMap = new Map<
    string,
    {
      totalCount: number;
      detailMap: Map<string, AppDistractionDetail>;
    }
  >();

  for (const r of rows) {
    const appName = (r.active_app && r.active_app.trim()) || "Uygulama";
    const winTitle = (r.active_window && r.active_window.trim()) || appName;
    const ctx = (r.context_text && r.context_text.trim()) || null;
    const rawCat = r.category;
    const cat: DistractionCategory =
      rawCat === "impulsive_task" || rawCat === "external"
        ? rawCat
        : rawCat === "idea" || rawCat === "screenshot_note"
          ? "idea"
          : "internal";
    const reason = (r.reason && r.reason.trim()) || "";

    if (!appMap.has(appName)) {
      appMap.set(appName, { totalCount: 0, detailMap: new Map() });
    }
    const group = appMap.get(appName)!;
    group.totalCount += 1;

    const dKey = `${winTitle}|||${ctx || ""}|||${reason}|||${cat}`;
    const existing = group.detailMap.get(dKey);
    if (existing) {
      existing.count += 1;
    } else {
      group.detailMap.set(dKey, {
        windowTitle: winTitle,
        contextText: ctx,
        reason,
        category: cat,
        count: 1,
      });
    }
  }

  const result: AppDistractionGroup[] = [];
  for (const [appName, v] of appMap.entries()) {
    const details = Array.from(v.detailMap.values()).sort(
      (a, b) => b.count - a.count,
    );
    result.push({
      appName,
      totalCount: v.totalCount,
      details,
    });
  }
  result.sort((a, b) => b.totalCount - a.totalCount);
  return result;
}
