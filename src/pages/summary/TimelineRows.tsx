import type { Dispatch, SetStateAction } from "react";
import type { TimelineSessionItem, WorkStoryEntry } from "../../db";
import type { ActiveLang, Translations } from "../../i18n";
import { formatSleepHours } from "../../constants";
import { renderBioIcon } from "../../components/BioIcon";
import {
  buildSessionStoryTooltip,
  matchSessionStoryEntries,
  SessionStorySlideshow,
} from "../../components/ParkingLot";
import { IconClose, IconCoffee } from "../../components/Icons";
import {
  formatSessionGroupFullLabel,
  formatSessionGroupShortBadge,
  type VerticalTimelineModel,
} from "./timelineUtils";

export interface TimelineRowsProps {
  t: Translations;
  activeLang: ActiveLang;
  model: VerticalTimelineModel;
  workStoryEntries: WorkStoryEntry[];
  hoveredTimelineItem: TimelineSessionItem | null;
  activeStorySessionId: number | null;
  onSetHoveredTimelineItem: (item: TimelineSessionItem | null) => void;
  onSetActiveStorySessionId: Dispatch<SetStateAction<number | null>>;
  onDeleteBioLog: (id: number) => void;
  onOpenLightbox: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
    source?: "story" | "parking",
  ) => void;
}

export function TimelineRows({
  t,
  activeLang,
  model,
  workStoryEntries,
  hoveredTimelineItem,
  activeStorySessionId,
  onSetHoveredTimelineItem,
  onSetActiveStorySessionId,
  onDeleteBioLog,
  onOpenLightbox,
}: TimelineRowsProps) {
  const {
    verticalEvents,
    nestedBreaksByWorkId,
    nestedOvertimeByWorkId,
    nestedBiosByWorkId,
  } = model;

  if (verticalEvents.length === 0) {
    return <div className="timeline-empty-msg">{t.noTimelineSessions}</div>;
  }

  let prevMaxEndMin = verticalEvents[0].endMin;

  return (
    <div className="vtimeline-list">
      {verticalEvents.map((ev, idx) => {
        const gapMin = idx > 0 ? Math.max(0, ev.startMin - prevMaxEndMin) : 0;
        prevMaxEndMin = Math.max(prevMaxEndMin, ev.endMin);
        const isFirst = idx === 0;
        const isLast = idx === verticalEvents.length - 1;
        const spineEdgesClass = `${isFirst ? "spine-first" : ""} ${
          isLast ? "spine-last" : ""
        }`;

        const gapHeight = Math.min(
          36,
          Math.max(20, Math.round(16 + (gapMin / 60) * 3.5)),
        );
        const gapNode =
          gapMin >= 60 ? (
            <div className="vtimeline-gap-row" style={{ height: `${gapHeight}px` }}>
              <span />
              <span className="vtimeline-gap-rail" />
              <span className="vtimeline-gap-label">
                {t.formatDuration(gapMin * 60)}
              </span>
            </div>
          ) : gapMin >= 15 ? (
            <div className="vtimeline-gap-row subtle">
              <span />
              <span className="vtimeline-gap-rail" />
              <span />
            </div>
          ) : null;

        if (ev.kind === "bio") {
          const b = ev.bio;
          const bioLabel = t.bioEventLabels[b.event_type];
          const sleepBadge =
            b.event_type === "wake" && b.sleep_hours != null
              ? formatSleepHours(b.sleep_hours, activeLang)
              : null;
          return (
            <div key={ev.key} className="vtimeline-entry-wrap">
              {gapNode}
              <div className="vtimeline-item bio-item">
                <div className="vtimeline-time-col single">
                  <span>{ev.hmLabel}</span>
                </div>
                <div className={`vtimeline-spine-col ${spineEdgesClass}`}>
                  <div
                    className={`vtimeline-bio-node bio-${b.event_type}`}
                    title={`${b.event_time} ${bioLabel}${sleepBadge ? ` (${sleepBadge})` : ""}${b.note ? `: ${b.note}` : ""}`}
                  >
                    {renderBioIcon(b.event_type, 11)}
                  </div>
                </div>
                <div className="vtimeline-body">
                  <div className="vtimeline-bio-row">
                    <span className="vtimeline-bio-title">{bioLabel}</span>
                    {sleepBadge && (
                      <span className="vtimeline-bio-sleep-badge">
                        {sleepBadge}
                      </span>
                    )}
                    {b.note && (
                      <span className="vtimeline-subtitle">· {b.note}</span>
                    )}
                    <button
                      type="button"
                      className="vtimeline-bio-del"
                      onClick={() => onDeleteBioLog(b.id)}
                      title={t.cancel}
                    >
                      <IconClose size={10} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const s = ev.session;
        const constituents = ev.sessions;
        const isWork = s.mode === "work";
        const isIdle = s.mode === "idle";
        const isWorkPause =
          !isWork &&
          !isIdle &&
          (s.tag === "Work Pause" || s.tag === "Çalışma Arası");
        const isHeavyOvertime =
          !isWork && !isIdle && !isWorkPause && s.overtimeSec >= 180;
        const isSimpleBreak =
          !isWork && !isIdle && !isWorkPause && !isHeavyOvertime;

        if (isSimpleBreak) {
          const overtimeMin =
            s.overtimeSec > 0
              ? Math.max(1, Math.round(s.overtimeSec / 60))
              : 0;
          return (
            <div key={ev.key} className="vtimeline-entry-wrap">
              {gapNode}
              <div className="vtimeline-item break-inline-item">
                <div className="vtimeline-time-col single muted">
                  <span>{ev.startHm}</span>
                </div>
                <div className={`vtimeline-spine-col ${spineEdgesClass}`}>
                  <span className="vtimeline-break-pip" />
                </div>
                <div className="vtimeline-break-inline-row">
                  <IconCoffee size={10} className="vtimeline-break-inline-icon" />
                  <span className="vtimeline-break-inline-txt">
                    {s.tag || t.break} · {t.formatDuration(s.durationSec)}
                  </span>
                  {overtimeMin > 0 && (
                    <span className="vtimeline-break-overtime-inline">
                      +{overtimeMin}
                      {activeLang === "tr" ? "dk" : "m"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        }

        const candleClass = isWork
          ? "candle-work"
          : isIdle
            ? "candle-idle"
            : isWorkPause
              ? "candle-pause"
              : "candle-overtime";
        const candleHeight = Math.min(
          64,
          Math.max(24, Math.round(18 + (s.durationSec / 60) * 0.72)),
        );
        const sessionFrames = (() => {
          if (!isWork) return [];
          const map = new Map<number, WorkStoryEntry>();
          for (const cs of constituents) {
            for (const fr of matchSessionStoryEntries(workStoryEntries, cs)) {
              map.set(fr.id, fr);
            }
          }
          return Array.from(map.values()).sort(
            (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
          );
        })();
        const isStoryOpen = isWork && activeStorySessionId === s.id;
        const titleText =
          s.tag || (isWork ? t.work : isIdle ? t.idleTimelineLabel : t.break);
        const rawReason = s.reason?.trim() || "";
        const showReason =
          rawReason.length > 0 &&
          rawReason.toLowerCase() !== titleText.trim().toLowerCase();

        const nestedBreaks = isWork
          ? (nestedBreaksByWorkId.get(s.id) ?? [])
          : [];
        const nestedOvertimes = isWork
          ? (nestedOvertimeByWorkId.get(s.id) ?? [])
          : [];
        const nestedBios = isWork ? (nestedBiosByWorkId.get(s.id) ?? []) : [];
        const nestedBreaksSec = nestedBreaks.reduce(
          (acc, nb) => acc + nb.durationSec,
          0,
        );
        const nestedBreaksOvertimeSec = nestedBreaks.reduce(
          (acc, nb) => acc + nb.overtimeSec,
          0,
        );
        const allNestedShort =
          nestedBreaks.length > 0 &&
          nestedBreaks.every(
            (nb) =>
              nb.tag === t.breakModeShortLabel ||
              nb.tag === "Short Break" ||
              nb.tag === "Kısa Mola",
          );
        const nestedBreakWord =
          activeLang === "tr"
            ? allNestedShort
              ? "kısa mola"
              : "mola"
            : allNestedShort
              ? nestedBreaks.length === 1
                ? "short break"
                : "short breaks"
              : nestedBreaks.length === 1
                ? "break"
                : "breaks";
        const planRoundBadge = isWork
          ? formatSessionGroupShortBadge(constituents, activeLang)
          : null;
        const planRoundFullLabel = isWork
          ? formatSessionGroupFullLabel(constituents, activeLang)
          : null;
        const hasBadges =
          Boolean(planRoundBadge) ||
          s.overtimeSec > 0 ||
          s.hyperfocusSec > 0 ||
          (isWork && sessionFrames.length > 0);

        return (
          <div key={ev.key} className="vtimeline-entry-wrap">
            {gapNode}
            <div
              className={`vtimeline-item session-item ${
                constituents.some((cs) => hoveredTimelineItem?.id === cs.id)
                  ? "active-row"
                  : ""
              } ${isWork ? "story-clickable" : ""} ${
                isStoryOpen ? "active-story-row" : ""
              }`}
              onMouseEnter={() => onSetHoveredTimelineItem(s)}
              onMouseLeave={() => onSetHoveredTimelineItem(null)}
              onClick={
                isWork
                  ? () =>
                      onSetActiveStorySessionId((prev) =>
                        prev === s.id ? null : s.id,
                      )
                  : undefined
              }
              title={
                isWork
                  ? buildSessionStoryTooltip(
                      s,
                      sessionFrames,
                      t,
                      t.formatDuration(s.durationSec),
                      planRoundFullLabel,
                    )
                  : undefined
              }
            >
              <div className="vtimeline-time-col">
                <span>{ev.startHm}</span>
                <span>{ev.endHm}</span>
              </div>
              <div className={`vtimeline-spine-col ${spineEdgesClass}`}>
                <div
                  className={`vtimeline-candle ${candleClass}`}
                  style={{ minHeight: `${candleHeight}px` }}
                />
              </div>
              <div className="vtimeline-body">
                <div className="vtimeline-header-row">
                  <div className="vtimeline-title-group">
                    <span className="vtimeline-title">{titleText}</span>
                    <span className="vtimeline-duration">
                      · {t.formatDuration(s.durationSec)}
                    </span>
                  </div>
                  {hasBadges && (
                    <span className="vtimeline-meta-badges">
                      {planRoundBadge && (
                        <span
                          className="vtimeline-plan-pill"
                          title={planRoundFullLabel ?? undefined}
                        >
                          {planRoundBadge}
                        </span>
                      )}
                      {s.overtimeSec > 0 && (
                        <span
                          className={`overtime-badge ${
                            isHeavyOvertime ? "danger" : ""
                          }`}
                        >
                          +{Math.max(1, Math.round(s.overtimeSec / 60))}
                          {activeLang === "tr" ? "dk" : "m"}
                        </span>
                      )}
                      {s.hyperfocusSec > 0 && (
                        <span className="hyperfocus-timeline-badge">
                          {t.hyperfocusSummaryBadge(
                            Math.max(1, Math.round(s.hyperfocusSec / 60)),
                          )}
                        </span>
                      )}
                      {isWork && sessionFrames.length > 0 && (
                        <span className="story-count-badge">
                          {sessionFrames.length}f
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {(s.moodBefore || s.moodAfter) && (
                  <div className="vtimeline-mood-row">
                    {s.moodBefore && (
                      <span className="mood-timeline-item">
                        <span className={`mood-dot mood-${s.moodBefore}`} />
                        <span>{t.moodLabels[s.moodBefore]}</span>
                      </span>
                    )}
                    {s.moodBefore && s.moodAfter && (
                      <span className="mood-timeline-arrow">→</span>
                    )}
                    {s.moodAfter && (
                      <span className="mood-timeline-item">
                        <span className={`mood-dot mood-${s.moodAfter}`} />
                        <span>{t.moodLabels[s.moodAfter]}</span>
                      </span>
                    )}
                  </div>
                )}
                {showReason && (
                  <div className="vtimeline-subtitle">{rawReason}</div>
                )}
                {nestedBreaks.length > 0 && (
                  <div
                    className="vtimeline-nested-breaks"
                    title={nestedBreaks
                      .map(
                        (nb) =>
                          `${nb.timeRangeLabel} · ${t.formatDuration(nb.durationSec)}`,
                      )
                      .join("\n")}
                  >
                    <IconCoffee size={10} />
                    <span>
                      {nestedBreaks.length} {nestedBreakWord} ·{" "}
                      {t.formatDuration(nestedBreaksSec)}
                    </span>
                    {nestedBreaksOvertimeSec > 0 && (
                      <span className="vtimeline-break-overtime-inline">
                        +{Math.max(1, Math.round(nestedBreaksOvertimeSec / 60))}
                        {activeLang === "tr" ? "dk" : "m"}
                      </span>
                    )}
                  </div>
                )}
                {nestedOvertimes.map((ov) => (
                  <div
                    key={`nov-${ov.id}`}
                    className="vtimeline-nested-overtime"
                    title={ov.timeRangeLabel}
                  >
                    <IconCoffee size={10} />
                    <span>
                      {ov.tag || t.break} · {t.formatDuration(ov.durationSec)}
                    </span>
                    <span className="overtime-badge danger">
                      +{Math.max(1, Math.round(ov.overtimeSec / 60))}
                      {activeLang === "tr" ? "dk" : "m"}
                    </span>
                  </div>
                ))}
                {nestedBios.map((b) => {
                  const bioLabel = t.bioEventLabels[b.event_type];
                  const sleepBadge =
                    b.event_type === "wake" && b.sleep_hours != null
                      ? formatSleepHours(b.sleep_hours, activeLang)
                      : null;
                  return (
                    <div
                      key={`nbio-${b.id}`}
                      className="vtimeline-nested-bio"
                      title={`${b.event_time} ${bioLabel}${sleepBadge ? ` (${sleepBadge})` : ""}${b.note ? `: ${b.note}` : ""}`}
                    >
                      <span className={`bio-ev-icon bio-${b.event_type}`}>
                        {renderBioIcon(b.event_type, 10)}
                      </span>
                      <span className="vtimeline-nested-bio-time">
                        {b.event_time}
                      </span>
                      <span className="vtimeline-nested-bio-lbl">
                        {bioLabel}
                        {sleepBadge ? ` (${sleepBadge})` : ""}
                        {b.note ? ` · ${b.note}` : ""}
                      </span>
                      <button
                        type="button"
                        className="vtimeline-bio-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBioLog(b.id);
                        }}
                        title={t.cancel}
                      >
                        <IconClose size={9} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {isStoryOpen && (
              <div className="vtimeline-story-indent">
                <SessionStorySlideshow
                  sessionId={s.id}
                  title={`${s.tag || t.work} • ${s.timeRangeLabel}`}
                  frames={sessionFrames}
                  t={t}
                  emptyMessage={t.workStoryEmpty}
                  onOpenFullscreen={(entry, groupFrames) =>
                    onOpenLightbox(entry, groupFrames, "story")
                  }
                  onClose={() => onSetActiveStorySessionId(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
