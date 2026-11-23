// @llm-index: Pure timeline grouping/layout builders & shared Summary tab types
import type { BioLogItem, TimelineSessionItem } from "../../db";
import type { Translations, ActiveLang } from "../../i18n";

export type SummaryTabType = "timeline" | "weekly";
export type SummarySectionTab = "overview" | "parking" | "insights";

export type SummaryReasonsTabType =
  | "work"
  | "contexts"
  | "apps"
  | "overtime"
  | "distractions"
  | "endings";

export type VerticalTimelineEvent =
  | {
      kind: "bio";
      key: string;
      startMin: number;
      endMin: number;
      hmLabel: string;
      bio: BioLogItem;
    }
  | {
      kind: "session";
      key: string;
      startMin: number;
      endMin: number;
      startHm: string;
      endHm: string;
      session: TimelineSessionItem;
      sessions: TimelineSessionItem[];
    };

export function parseHmToMinutes(hm: string): number | null {
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Math.min(24 * 60, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
}

export function formatHoursHm(hourVal: number): string {
  const totalMins = Math.min(24 * 60, Math.max(0, Math.round(hourVal * 60)));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function formatSessionGroupShortBadge(
  sessions: TimelineSessionItem[],
  activeLang: ActiveLang,
): string | null {
  const completedCount = sessions.filter((x) => x.isCompleted).length;
  if (completedCount === 0) return null;
  const partialCount = sessions.length - completedCount;
  const isTr = activeLang === "tr";

  if (partialCount === 0) {
    const roundIdx =
      sessions.length === 1
        ? sessions[0].roundIndex || 1
        : completedCount;
    return completedCount === 1
      ? isTr
        ? `${roundIdx}. tur`
        : `R${roundIdx}`
      : isTr
        ? `${completedCount} tur`
        : `${completedCount}r`;
  }

  return isTr ? `${completedCount}+ tur` : `${completedCount}r+`;
}

export function formatSessionGroupFullLabel(
  sessions: TimelineSessionItem[],
  activeLang: ActiveLang,
): string | null {
  const completedCount = sessions.filter((x) => x.isCompleted).length;
  const partialCount = sessions.length - completedCount;
  const plan = sessions.find((x) => x.planName?.trim())?.planName?.trim() || "";
  const isTr = activeLang === "tr";

  if (completedCount > 0 && partialCount === 0) {
    const roundIdx =
      sessions.length === 1
        ? sessions[0].roundIndex || 1
        : completedCount;
    const roundStr =
      completedCount === 1
        ? isTr
          ? `${roundIdx}. tur`
          : `R${roundIdx}`
        : isTr
          ? `${completedCount} tur`
          : `${completedCount} rounds`;
    return plan ? `${plan} · ${roundStr}` : roundStr;
  }

  if (completedCount > 0 && partialCount > 0) {
    const roundStr = isTr
      ? `${completedCount} tur + yarım`
      : `${completedCount}r + partial`;
    return plan ? `${plan} · ${roundStr}` : roundStr;
  }

  const r = sessions[0]?.roundIndex ?? 0;
  if (plan && r > 0) {
    return isTr ? `${plan} · ${r}. tur (yarım)` : `${plan} · R${r} (partial)`;
  }
  if (plan) {
    return plan;
  }
  if (r > 0) {
    return isTr ? `${r}. tur (yarım)` : `R${r} (partial)`;
  }
  return null;
}

export interface VerticalTimelineModel {
  verticalEvents: VerticalTimelineEvent[];
  nestedBreaksByWorkId: Map<number, TimelineSessionItem[]>;
  nestedOvertimeByWorkId: Map<number, TimelineSessionItem[]>;
  nestedBiosByWorkId: Map<number, BioLogItem[]>;
}

export function buildVerticalTimelineModel(
  timelineSessions: TimelineSessionItem[],
  bioLogs: BioLogItem[],
  t: Translations,
): VerticalTimelineModel {
  const verticalEvents: VerticalTimelineEvent[] = [];
  const nestedBreaksByWorkId = new Map<number, TimelineSessionItem[]>();
  const nestedOvertimeByWorkId = new Map<number, TimelineSessionItem[]>();
  const nestedBiosByWorkId = new Map<number, BioLogItem[]>();

  const validSessions = timelineSessions.filter(
    (s) => s.durationSec >= 30 || s.overtimeSec >= 60,
  );
  const workSessions = validSessions.filter((w) => w.mode === "work");

  // Birleşik Timeline: Aynı sessionGroupId'ye sahip turları tek bir Seans satırında topla
  const sessionGroups: TimelineSessionItem[][] = [];
  const groupById = new Map<string, TimelineSessionItem[]>();
  for (const w of workSessions) {
    const gid = w.sessionGroupId?.trim();
    if (gid) {
      const existing = groupById.get(gid);
      if (existing) {
        existing.push(w);
      } else {
        const arr = [w];
        groupById.set(gid, arr);
        sessionGroups.push(arr);
      }
    } else {
      sessionGroups.push([w]);
    }
  }

  const workGroupRanges: {
    id: number;
    groupId: string | null;
    startHour: number;
    endHour: number;
    startMs: number;
    endMs: number;
    startMin: number;
    endMin: number;
  }[] = [];

  for (const grp of sessionGroups) {
    const minStartItem = grp.reduce(
      (best, cur) => (cur.startHour <= best.startHour ? cur : best),
      grp[0],
    );
    const maxEndItem = grp.reduce(
      (best, cur) => (cur.endHour >= best.endHour ? cur : best),
      grp[0],
    );
    const startHour = Math.min(...grp.map((x) => x.startHour));
    const endHour = Math.max(...grp.map((x) => x.endHour));
    const startMs = Math.min(...grp.map((x) => new Date(x.startedAt).getTime()));
    const endMs = Math.max(...grp.map((x) => new Date(x.endedAt).getTime()));
    const startMin = Math.round(startHour * 60);
    const endMin = Math.max(startMin, Math.round(endHour * 60));

    const startParts = minStartItem.timeRangeLabel
      .split("-")
      .map((x) => x.trim());
    const endParts = maxEndItem.timeRangeLabel.split("-").map((x) => x.trim());
    const startHm = startParts[0] || formatHoursHm(startHour);
    const endHm = endParts[1] || formatHoursHm(endHour);

    const distinctTags = Array.from(
      new Set(grp.map((x) => x.tag?.trim()).filter(Boolean)),
    ) as string[];
    const mergedTag =
      distinctTags.length > 0 ? distinctTags.join(" / ") : minStartItem.tag;
    const mergedReason =
      [...grp].reverse().find((x) => x.reason?.trim())?.reason ??
      minStartItem.reason;
    const totalDurationSec = grp.reduce((acc, x) => acc + x.durationSec, 0);

    const sortedByStart = [...grp].sort((a, b) => a.startHour - b.startHour);
    const sortedByEnd = [...grp].sort((a, b) => a.endHour - b.endHour);

    const aggregated: TimelineSessionItem =
      grp.length === 1
        ? grp[0]
        : {
            ...minStartItem,
            tag: mergedTag,
            reason: mergedReason,
            durationSec: totalDurationSec,
            overtimeSec: grp.reduce((acc, x) => acc + x.overtimeSec, 0),
            hyperfocusSec: grp.reduce((acc, x) => acc + x.hyperfocusSec, 0),
            moodBefore:
              sortedByStart.find((x) => x.moodBefore)?.moodBefore ?? null,
            moodAfter:
              sortedByEnd.reverse().find((x) => x.moodAfter)?.moodAfter ?? null,
            startHour,
            endHour,
            startedAt: Number.isFinite(startMs)
              ? new Date(startMs).toISOString()
              : minStartItem.startedAt,
            endedAt: Number.isFinite(endMs)
              ? new Date(endMs).toISOString()
              : maxEndItem.endedAt,
            timeRangeLabel: `${startHm} - ${endHm}`,
            durationLabel: t.formatDuration(totalDurationSec),
          };

    workGroupRanges.push({
      id: aggregated.id,
      groupId: aggregated.sessionGroupId,
      startHour,
      endHour,
      startMs,
      endMs,
      startMin,
      endMin,
    });

    verticalEvents.push({
      kind: "session",
      key: aggregated.sessionGroupId
        ? `grp-${aggregated.sessionGroupId}-${aggregated.id}`
        : `sess-${aggregated.id}`,
      startMin,
      endMin,
      startHm,
      endHm,
      session: aggregated,
      sessions: grp,
    });
  }

  for (const s of validSessions) {
    const isWork = s.mode === "work";
    if (isWork) continue;
    const isIdle = s.mode === "idle";
    const isWorkPause =
      !isIdle && (s.tag === "Work Pause" || s.tag === "Çalışma Arası");
    const isMidSessionBreak = !isIdle && !isWorkPause;

    if (isMidSessionBreak) {
      const bStartMs = new Date(s.startedAt).getTime();
      const isLongBreak =
        s.tag === t.breakModeLongLabel ||
        s.tag === "Long Break" ||
        s.tag === "Uzun Mola";
      const enclosingGroup = !isLongBreak
        ? workGroupRanges.find((wg) =>
            s.sessionGroupId && wg.groupId
              ? s.sessionGroupId === wg.groupId && bStartMs < wg.endMs
              : bStartMs >= wg.startMs && bStartMs < wg.endMs,
          )
        : undefined;
      if (enclosingGroup) {
        const targetMap =
          s.overtimeSec >= 180
            ? nestedOvertimeByWorkId
            : nestedBreaksByWorkId;
        const existing = targetMap.get(enclosingGroup.id) ?? [];
        existing.push(s);
        targetMap.set(enclosingGroup.id, existing);
        continue;
      }
    }

    const parts = s.timeRangeLabel.split("-").map((x) => x.trim());
    const startHm = parts[0] || formatHoursHm(s.startHour);
    const endHm = parts[1] || formatHoursHm(s.endHour);
    const startMin = Math.round(s.startHour * 60);
    const endMin = Math.max(startMin, Math.round(s.endHour * 60));
    verticalEvents.push({
      kind: "session",
      key: `sess-${s.id}`,
      startMin,
      endMin,
      startHm,
      endHm,
      session: s,
      sessions: [s],
    });
  }

  for (const b of bioLogs) {
    const bioMin = parseHmToMinutes(b.event_time) ?? 0;
    const enclosingWorkRange = workGroupRanges.find(
      (wr) => bioMin >= wr.startMin && bioMin < wr.endMin,
    );
    if (enclosingWorkRange) {
      const existing = nestedBiosByWorkId.get(enclosingWorkRange.id) ?? [];
      existing.push(b);
      nestedBiosByWorkId.set(enclosingWorkRange.id, existing);
      continue;
    }
    verticalEvents.push({
      kind: "bio",
      key: `bio-${b.id}`,
      startMin: bioMin,
      endMin: bioMin,
      hmLabel: b.event_time,
      bio: b,
    });
  }

  verticalEvents.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.kind !== b.kind) return a.kind === "bio" ? -1 : 1;
    return a.endMin - b.endMin;
  });

  return {
    verticalEvents,
    nestedBreaksByWorkId,
    nestedOvertimeByWorkId,
    nestedBiosByWorkId,
  };
}
