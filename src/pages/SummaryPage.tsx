import { useEffect, useState } from "react";
import type {
  AdhdInsightsData,
  BioEventType,
  BioLogItem,
  ClearDataOptions,
  MoodLogItem,
  MoodType,
  ParkingBucket,
  ParkingLotData,
  SummaryReasonsData,
  TimelineSessionItem,
  WeekDayStat,
  WeeklySummary,
  WorkStoryEntry,
} from "../db";
import { toLocalDateStr, parseLocalDateStr } from "../db";
import type { ActiveLang, Translations } from "../i18n";
import {
  BIO_EVENT_EMOJIS,
  BIO_EVENT_TYPES,
  MOOD_EMOJIS,
  MOOD_TYPES,
} from "../constants";
import {
  buildSessionStoryTooltip,
  matchSessionStoryEntries,
  ParkingLotPanel,
  SessionStorySlideshow,
} from "../components/ParkingLot";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDashboard,
  IconDownload,
  IconTrash,
} from "../components/Icons";

export type SummaryTabType = "timeline" | "weekly";

export type SummaryReasonsTabType =
  | "work"
  | "contexts"
  | "apps"
  | "overtime"
  | "distractions"
  | "endings";

export interface SummaryPageProps {
  t: Translations;
  activeLang: ActiveLang;
  summaryTab: SummaryTabType;
  summaryReasonsTab: SummaryReasonsTabType;
  selectedDateStr: string;
  selectedDayStats: { totalSec: number; sessionCount: number; avgSec: number };
  summaryParkingData: ParkingLotData;
  workStoryEntries: WorkStoryEntry[];
  bioLogs: BioLogItem[];
  moodLogs: MoodLogItem[];
  showResetConfirm: boolean;
  hoveredTimelineItem: TimelineSessionItem | null;
  timelineSessions: TimelineSessionItem[];
  weeklySummary: WeeklySummary | null;
  summaryReasonsData: SummaryReasonsData | null;
  hoveredWeekDay: WeekDayStat | null;
  maxWeeklyHours: number;
  adhdInsights: AdhdInsightsData | null;
  exportDirPath: string;
  exportSavedMsg: string | null;
  expandedTags: Record<string, boolean>;
  onSetSummaryTab: (tab: SummaryTabType) => void;
  onSetSummaryReasonsTab: (tab: SummaryReasonsTabType) => void;
  onSelectDate: (dateStr: string) => void;
  onShiftDate: (deltaDays: number) => void;
  onOpenDashboard: () => void;
  onOpenMenu: () => void;
  onSetShowResetConfirm: (show: boolean) => void;
  onResetData: (options: ClearDataOptions) => void;
  onSetHoveredTimelineItem: (item: TimelineSessionItem | null) => void;
  onSetHoveredWeekDay: (day: WeekDayStat | null) => void;
  onToggleParkingTask: (id: number, done: boolean) => void;
  onRateParkingIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteParkingEntry: (id: number) => void;
  onChangeParkingBucket: (id: number, bucket: ParkingBucket) => void;
  onAddBioLog: (
    eventType: BioEventType,
    eventTime?: string,
    note?: string,
  ) => Promise<void> | void;
  onDeleteBioLog: (id: number) => void;
  onAddMoodCheckin: (mood: MoodType) => void;
  onDeleteMoodLog: (id: number) => void;
  onOpenLightbox: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
  ) => void;
  onToggleAccordionTag: (key: string) => void;
  onExportData: () => void;
}

export function SummaryPage({
  t,
  activeLang,
  summaryTab,
  summaryReasonsTab,
  selectedDateStr,
  selectedDayStats,
  summaryParkingData,
  workStoryEntries,
  bioLogs,
  moodLogs,
  showResetConfirm,
  hoveredTimelineItem,
  timelineSessions,
  weeklySummary,
  summaryReasonsData,
  hoveredWeekDay,
  maxWeeklyHours,
  adhdInsights,
  exportDirPath,
  exportSavedMsg,
  expandedTags,
  onSetSummaryTab,
  onSetSummaryReasonsTab,
  onSelectDate,
  onShiftDate,
  onOpenDashboard,
  onOpenMenu,
  onSetShowResetConfirm,
  onResetData,
  onSetHoveredTimelineItem,
  onSetHoveredWeekDay,
  onToggleParkingTask,
  onRateParkingIdea,
  onDeleteParkingEntry,
  onChangeParkingBucket,
  onAddBioLog,
  onDeleteBioLog,
  onAddMoodCheckin,
  onDeleteMoodLog,
  onOpenLightbox,
  onToggleAccordionTag,
  onExportData,
}: SummaryPageProps) {
  const [activeStorySessionId, setActiveStorySessionId] = useState<
    number | null
  >(null);
  const [resetWorkTime, setResetWorkTime] = useState(true);
  const [bioTypeDraft, setBioTypeDraft] = useState<BioEventType>("coffee");
  const [bioTimeDraft, setBioTimeDraft] = useState(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [bioNoteDraft, setBioNoteDraft] = useState("");
  const [resetDistractions, setResetDistractions] = useState(true);

  useEffect(() => {
    if (showResetConfirm) {
      setResetWorkTime(true);
      setResetDistractions(true);
    }
  }, [showResetConfirm]);
  const activeStorySession =
    summaryTab === "timeline"
      ? (timelineSessions.find(
          (s) => s.id === activeStorySessionId && s.mode === "work",
        ) ?? null)
      : null;
  const activeStoryFrames = activeStorySession
    ? matchSessionStoryEntries(workStoryEntries, activeStorySession)
    : [];

  const todayStr = toLocalDateStr();
  const parsedSelectedDate = parseLocalDateStr(selectedDateStr);
  const dateDisplayLabel =
    summaryTab === "weekly" && weeklySummary?.days?.length === 7
      ? `${weeklySummary.days[0].dateLabel} – ${weeklySummary.days[6].dateLabel}`
      : parsedSelectedDate.toLocaleDateString(
          activeLang === "tr" ? "tr-TR" : "en-US",
          { weekday: "short", day: "numeric", month: "short", year: "numeric" },
        );
  const totalParkingCount = summaryParkingData.pendingTasks.length;

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-left" style={{ gap: "6px" }}>
          <span className="badge">⠿ {t.summary}</span>
          <div className="summary-tab-group">
            <button
              className={`tab-btn ${summaryTab === "timeline" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("timeline")}
            >
              📅 {t.summaryDailyTab}
            </button>
            <button
              className={`tab-btn ${summaryTab === "weekly" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("weekly")}
            >
              📆 {t.summaryWeeklyTab}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            className="ghost-btn"
            onClick={onOpenDashboard}
            title={t.dashboardBtn}
          >
            <IconDashboard size={12} />
            <span>{t.dashboardBtn}</span>
          </button>
          <button className="ghost-btn" onClick={onOpenMenu}>
            <IconArrowLeft size={12} />
            <span>{t.home}</span>
          </button>
        </div>
      </div>

      {showResetConfirm ? (
        <div className="reset-confirm-box no-drag">
          <div className="reset-confirm-title">{t.resetConfirmTitle}</div>
          <div className="reset-confirm-desc">{t.resetConfirmDesc}</div>
          <div className="reset-options-list">
            <label className="reset-option-row">
              <input
                type="checkbox"
                checked={resetWorkTime}
                onChange={(e) => setResetWorkTime(e.target.checked)}
              />
              <div className="reset-option-copy">
                <div className="reset-option-title">
                  {t.resetOptionWorkTitle}
                </div>
                <div className="reset-option-desc">{t.resetOptionWorkDesc}</div>
              </div>
            </label>
            <label className="reset-option-row">
              <input
                type="checkbox"
                checked={resetDistractions}
                onChange={(e) => setResetDistractions(e.target.checked)}
              />
              <div className="reset-option-copy">
                <div className="reset-option-title">
                  {t.resetOptionDistractionsTitle}
                </div>
                <div className="reset-option-desc">
                  {t.resetOptionDistractionsDesc}
                </div>
              </div>
            </label>
          </div>
          <div className="btn-row" style={{ marginTop: "8px" }}>
            <button
              className="warn-btn"
              disabled={!resetWorkTime && !resetDistractions}
              onClick={() =>
                onResetData({
                  workTime: resetWorkTime,
                  distractions: resetDistractions,
                })
              }
            >
              {resetWorkTime && resetDistractions
                ? t.resetConfirmYes
                : t.resetConfirmSelected}
            </button>
            <button onClick={() => onSetShowResetConfirm(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="summary-scroll-stack no-drag">
          {/* TAKVİM & HAFTA SEÇİCİ */}
          <div className="summary-date-bar">
            <div className="summary-date-top">
              <div className="summary-date-nav">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => onShiftDate(summaryTab === "weekly" ? -7 : -1)}
                >
                  <IconChevronLeft size={12} />
                </button>
                <span className="summary-date-label">{dateDisplayLabel}</span>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => onShiftDate(summaryTab === "weekly" ? 7 : 1)}
                >
                  <IconChevronRight size={12} />
                </button>
              </div>
              <div className="summary-date-actions">
                {selectedDateStr !== todayStr && (
                  <button
                    type="button"
                    className="summary-today-btn"
                    onClick={() => onSelectDate(todayStr)}
                  >
                    {t.todayBtn}
                  </button>
                )}
                <input
                  type="date"
                  className="summary-date-input"
                  value={selectedDateStr}
                  title={t.calendarPickerTooltip}
                  onChange={(e) => {
                    if (e.target.value) onSelectDate(e.target.value);
                  }}
                />
              </div>
            </div>

            {weeklySummary && weeklySummary.days.length > 0 && (
              <div className="summary-week-strip">
                {weeklySummary.days.map((d) => {
                  const isSelected = d.fullDateStr === selectedDateStr;
                  const hasWork = d.total_sec > 0;
                  return (
                    <button
                      key={d.dayIndex}
                      type="button"
                      className={`summary-day-pill ${isSelected ? "active" : ""} ${hasWork ? "has-work" : ""}`}
                      onClick={() => {
                        onSelectDate(d.fullDateStr);
                        if (summaryTab === "weekly") {
                          onSetSummaryTab("timeline");
                        }
                      }}
                      title={`${d.shortLabel} (${d.dateLabel}): ${t.formatDuration(d.total_sec)}`}
                    >
                      <span>{d.shortLabel}</span>
                      <span className="summary-day-pill-num">
                        {Number(d.fullDateStr.split("-")[2]) || d.dateLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* KART 1: GÜNLÜK 24S ÇİZELGE VEYA HAFTALIK GRAFİK */}
          <div className="summary-section-card">
            {summaryTab === "timeline" ? (
              <>
                <div className="weekly-stats-grid">
                  <div className="stat-card">
                    <div className="stat-val">
                      {t.formatDuration(selectedDayStats.totalSec)}
                    </div>
                    <div className="stat-lbl">{t.totalWork}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">
                      {selectedDayStats.sessionCount}
                    </div>
                    <div className="stat-lbl">{t.sessions}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">
                      {t.formatDuration(selectedDayStats.avgSec)}
                    </div>
                    <div className="stat-lbl">{t.average}</div>
                  </div>
                </div>

                <div className="tooltip-banner">
                  {hoveredTimelineItem ? (
                    <>
                      <span>
                        <b>
                          {hoveredTimelineItem.mode === "work"
                            ? t.work
                            : hoveredTimelineItem.mode === "idle"
                              ? t.idleTimelineLabel
                              : t.break}
                        </b>
                        :{" "}
                        {hoveredTimelineItem.tag ||
                          (hoveredTimelineItem.mode === "work"
                            ? t.work
                            : hoveredTimelineItem.mode === "idle"
                              ? t.idleTimelineLabel
                              : t.break)}
                        {hoveredTimelineItem.reason
                          ? ` (${hoveredTimelineItem.reason})`
                          : ""}
                      </span>
                      <span>
                        {hoveredTimelineItem.timeRangeLabel} •{" "}
                        {t.formatDuration(hoveredTimelineItem.durationSec)}
                        {hoveredTimelineItem.overtimeSec > 0
                          ? ` (+${Math.max(1, Math.round(hoveredTimelineItem.overtimeSec / 60))} ${activeLang === "tr" ? "dk" : "m"})`
                          : ""}
                      </span>
                    </>
                  ) : (
                    <span>{t.summaryHoverHint}</span>
                  )}
                </div>

                <div className="timeline-container">
                  <div className="timeline-24h-wrapper">
                    <div className="timeline-24h-track">
                      {timelineSessions.map((s) => {
                        const leftPct = (s.startHour / 24) * 100;
                        const widthPct = Math.max(
                          1.0,
                          ((s.endHour - s.startHour) / 24) * 100,
                        );
                        const isWork = s.mode === "work";
                        const isIdle = s.mode === "idle";
                        const sessionFrames = isWork
                          ? matchSessionStoryEntries(workStoryEntries, s)
                          : [];
                        const isStoryOpen =
                          isWork && activeStorySessionId === s.id;
                        const blockClass = isWork
                          ? "work-block"
                          : isIdle
                            ? "idle-block"
                            : s.overtimeSec > 0
                              ? "overtime-block"
                              : "break-block";
                        return (
                          <div
                            key={s.id}
                            className={`timeline-block ${blockClass} ${isWork ? "story-clickable" : ""} ${isStoryOpen ? "active-story-block" : ""}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            onMouseEnter={() => onSetHoveredTimelineItem(s)}
                            onClick={
                              isWork
                                ? () =>
                                    setActiveStorySessionId((prev) =>
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
                                  )
                                : `${isIdle ? t.idleTimelineLabel : t.break}: ${s.tag || ""} ${s.timeRangeLabel} (${t.formatDuration(s.durationSec)})`
                            }
                          />
                        );
                      })}
                      {bioLogs.map((b) => {
                        const m = b.event_time.match(/^(\d{1,2}):(\d{2})$/);
                        if (!m) return null;
                        const h = Math.min(
                          23.9,
                          Math.max(0, Number(m[1]) + Number(m[2]) / 60),
                        );
                        return (
                          <span
                            key={`bio-${b.id}`}
                            className="timeline-bio-marker"
                            style={{ left: `${(h / 24) * 100}%` }}
                            title={`${b.event_time} ${BIO_EVENT_EMOJIS[b.event_type]} ${t.bioEventLabels[b.event_type]}${b.note ? `: ${b.note}` : ""}`}
                          >
                            {BIO_EVENT_EMOJIS[b.event_type]}
                          </span>
                        );
                      })}
                    </div>
                    <div className="timeline-hours-axis">
                      <span>00:00</span>
                      <span>04:00</span>
                      <span>08:00</span>
                      <span>12:00</span>
                      <span>16:00</span>
                      <span>20:00</span>
                      <span>24:00</span>
                    </div>
                  </div>

                  <div className="timeline-session-list">
                    {timelineSessions.length > 0 ? (
                      timelineSessions.map((s) => {
                        const isWork = s.mode === "work";
                        const isIdle = s.mode === "idle";
                        const sessionFrames = isWork
                          ? matchSessionStoryEntries(workStoryEntries, s)
                          : [];
                        const isStoryOpen =
                          isWork && activeStorySessionId === s.id;
                        return (
                          <div
                            key={s.id}
                            className={`timeline-session-row ${
                              hoveredTimelineItem?.id === s.id ? "active-row" : ""
                            } ${isWork ? "story-clickable" : ""} ${
                              isStoryOpen ? "active-story-row" : ""
                            }`}
                            onMouseEnter={() => onSetHoveredTimelineItem(s)}
                            onClick={
                              isWork
                                ? () =>
                                    setActiveStorySessionId((prev) =>
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
                                  )
                                : undefined
                            }
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                minWidth: 0,
                                overflow: "hidden",
                              }}
                            >
                              <span className="timeline-row-time">
                                {s.timeRangeLabel}
                              </span>
                              <span className="timeline-row-tag">
                                {isWork ? "💼" : isIdle ? "🛋️" : "☕"}{" "}
                                {s.tag ||
                                  (isWork
                                    ? t.work
                                    : isIdle
                                      ? t.idleTimelineLabel
                                      : t.break)}
                              </span>
                              {s.reason && (
                                <span
                                  style={{
                                    color: "#a1a1aa",
                                    fontSize: "9px",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  ({s.reason})
                                </span>
                              )}
                              {s.overtimeSec > 0 ? (
                                <span className="overtime-badge">
                                  +{Math.max(1, Math.round(s.overtimeSec / 60))}
                                  {activeLang === "tr" ? "dk" : "m"}
                                </span>
                              ) : null}
                              {s.hyperfocusSec > 0 && (
                                <span className="hyperfocus-timeline-badge">
                                  {t.hyperfocusSummaryBadge(
                                    Math.max(
                                      1,
                                      Math.round(s.hyperfocusSec / 60),
                                    ),
                                  )}
                                </span>
                              )}
                              {(s.moodBefore || s.moodAfter) && (
                                <span
                                  className="mood-timeline-badge"
                                  title={`${s.moodBefore ? t.moodLabels[s.moodBefore] : ""}${s.moodBefore && s.moodAfter ? " → " : ""}${s.moodAfter ? t.moodLabels[s.moodAfter] : ""}`}
                                >
                                  {s.moodBefore
                                    ? MOOD_EMOJIS[s.moodBefore]
                                    : ""}
                                  {s.moodBefore && s.moodAfter ? "→" : ""}
                                  {s.moodAfter ? MOOD_EMOJIS[s.moodAfter] : ""}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                flexShrink: 0,
                              }}
                            >
                              {isWork && sessionFrames.length > 0 && (
                                <span className="story-count-badge">
                                  📸 {sessionFrames.length}
                                </span>
                              )}
                              <span className="timeline-row-dur">
                                {t.formatDuration(s.durationSec)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#a1a1aa",
                          padding: "8px",
                          textAlign: "center",
                        }}
                      >
                        {t.noTimelineSessions}
                      </div>
                    )}
                  </div>

                  {activeStorySession && (
                    <SessionStorySlideshow
                      sessionId={activeStorySession.id}
                      title={`${activeStorySession.tag || t.work} • ${activeStorySession.timeRangeLabel}`}
                      frames={activeStoryFrames}
                      t={t}
                      emptyMessage={t.workStoryEmpty}
                      onOpenFullscreen={onOpenLightbox}
                      onClose={() => setActiveStorySessionId(null)}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="weekly-stats-grid">
                  <div className="stat-card">
                    <div className="stat-val">
                      {t.formatDuration(weeklySummary?.totalSec ?? 0)}
                    </div>
                    <div className="stat-lbl">{t.weeklyTotal}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">
                      {t.formatDuration(weeklySummary?.dailyAvgSec ?? 0)}
                    </div>
                    <div className="stat-lbl">{t.weeklyDailyAvg}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">
                      {summaryReasonsData?.avgDistractionsPerSession ?? 0}
                    </div>
                    <div className="stat-lbl">
                      {t.avgDistractionsPerSession}
                    </div>
                  </div>
                </div>

                <div className="tooltip-banner">
                  {hoveredWeekDay ? (
                    <>
                      <span>
                        <b>{hoveredWeekDay.shortLabel}</b> (
                        {hoveredWeekDay.dateLabel}):{" "}
                        {(hoveredWeekDay.total_sec / 3600).toFixed(1)}{" "}
                        {activeLang === "tr" ? "sa" : "h"}
                      </span>
                      <span>
                        {hoveredWeekDay.session_count}{" "}
                        {t.sessions.toLowerCase()} •{" "}
                        {t.formatDuration(hoveredWeekDay.total_sec)}
                      </span>
                    </>
                  ) : (
                    <span>{t.summaryHoverHint}</span>
                  )}
                </div>

                <div className="chart-area">
                  {weeklySummary?.days.map((d) => {
                    const hours = d.total_sec / 3600;
                    const heightPct = Math.max(
                      6,
                      (hours / maxWeeklyHours) * 85,
                    );
                    const isHovered = hoveredWeekDay?.dayIndex === d.dayIndex;
                    const isSelected = d.fullDateStr === selectedDateStr;
                    return (
                      <div
                        key={d.dayIndex}
                        className="bar-col"
                        onMouseEnter={() => onSetHoveredWeekDay(d)}
                        onClick={() => {
                          onSelectDate(d.fullDateStr);
                          onSetSummaryTab("timeline");
                        }}
                        style={{ cursor: "pointer" }}
                        title={`${d.shortLabel} (${d.dateLabel})`}
                      >
                        <span className="bar-hours">
                          {hours.toFixed(1)}
                          {activeLang === "tr" ? "s" : "h"}
                        </span>
                        <div
                          className={`bar-fill ${isHovered || isSelected ? "active-bar" : ""}`}
                          style={{
                            height: `${heightPct}%`,
                            borderColor: d.is_today ? "#fbbf24" : undefined,
                            borderWidth: d.is_today ? "1px" : "0",
                            borderStyle: "solid",
                          }}
                        />
                        <span
                          className="bar-label"
                          style={{
                            color: d.is_today ? "#fbbf24" : undefined,
                            fontWeight: d.is_today ? 700 : undefined,
                          }}
                        >
                          {d.shortLabel}
                          {d.is_today ? "•" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* KART 2: BİYOLOJİK BAĞLAM & RUH HALİ HİKAYESİ */}
          <div className="summary-section-card">
            <div className="summary-section-head">
              <span>{t.bioSummaryTitle}</span>
              <span className="summary-section-count">
                {bioLogs.length + moodLogs.length}
              </span>
            </div>

            <div className="bio-summary-add-row">
              <div className="bio-summary-type-pills">
                {BIO_EVENT_TYPES.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    className={`bio-type-chip ${bioTypeDraft === ev ? "active" : ""}`}
                    onClick={() => setBioTypeDraft(ev)}
                    title={t.bioEventLabels[ev]}
                  >
                    {BIO_EVENT_EMOJIS[ev]}
                  </button>
                ))}
              </div>
              <input
                type="time"
                className="bio-time-input"
                value={bioTimeDraft}
                onChange={(e) => setBioTimeDraft(e.target.value)}
              />
              <input
                type="text"
                className="bio-note-input"
                placeholder={t.bioNotePlaceholder}
                value={bioNoteDraft}
                onChange={(e) => setBioNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void onAddBioLog(
                      bioTypeDraft,
                      bioTimeDraft,
                      bioNoteDraft.trim() || undefined,
                    );
                    setBioNoteDraft("");
                  }
                }}
                maxLength={60}
              />
              <button
                type="button"
                className="primary-btn bio-save-btn"
                onClick={() => {
                  void onAddBioLog(
                    bioTypeDraft,
                    bioTimeDraft,
                    bioNoteDraft.trim() || undefined,
                  );
                  setBioNoteDraft("");
                }}
              >
                {t.add}
              </button>
            </div>

            {bioLogs.length === 0 ? (
              <div className="bio-empty-msg">{t.bioEmptyHint}</div>
            ) : (
              <div className="bio-log-list">
                {bioLogs.map((b) => (
                  <div key={b.id} className="bio-log-row">
                    <span className="bio-log-time">{b.event_time}</span>
                    <span className="bio-log-label">
                      {BIO_EVENT_EMOJIS[b.event_type]}{" "}
                      {t.bioEventLabels[b.event_type]}
                    </span>
                    {b.note && <span className="bio-log-note">{b.note}</span>}
                    <button
                      type="button"
                      className="tag-icon-btn del-btn"
                      onClick={() => onDeleteBioLog(b.id)}
                      title={t.cancel}
                    >
                      <IconClose size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mood-summary-divider" />
            <div className="mood-checkin-bar">
              <span className="mood-strip-label">
                {t.moodQuickCheckinLabel}
              </span>
              <div className="mood-pills-row compact">
                {MOOD_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="mood-pill-btn compact"
                    onClick={() => onAddMoodCheckin(m)}
                    title={t.moodLabels[m]}
                  >
                    <span>{MOOD_EMOJIS[m]}</span>
                    <span>{t.moodLabels[m]}</span>
                  </button>
                ))}
              </div>
            </div>

            {moodLogs.length === 0 ? (
              <div className="bio-empty-msg">{t.moodEmptyHint}</div>
            ) : (
              <div className="mood-stream-list">
                {moodLogs.map((ml) => {
                  const dt = new Date(ml.created_at);
                  const pad = (n: number) => n.toString().padStart(2, "0");
                  const hm = Number.isNaN(dt.getTime())
                    ? ""
                    : `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
                  const phaseTxt =
                    ml.phase === "start"
                      ? t.moodPhaseStart
                      : ml.phase === "end"
                        ? t.moodPhaseEnd
                        : t.moodPhaseCheckin;
                  return (
                    <span key={ml.id} className="mood-stream-chip">
                      <span>{hm}</span>
                      <span>
                        {MOOD_EMOJIS[ml.mood]} {t.moodLabels[ml.mood]}
                      </span>
                      <span className="mood-phase-sub">({phaseTxt})</span>
                      <button
                        type="button"
                        className="tag-icon-btn del-btn"
                        onClick={() => onDeleteMoodLog(ml.id)}
                        title={t.cancel}
                      >
                        <IconClose size={9} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* KART 3: MOLA & FİKİR OTOPARKI */}
          <div className="summary-section-card">
            <div className="summary-section-head">
              <span>{t.parkingTab}</span>
              <span className="summary-section-count">{totalParkingCount}</span>
            </div>
            <div className="parking-panel summary-parking no-drag">
              <ParkingLotPanel
                data={summaryParkingData}
                isBreakView={false}
                t={t}
                onToggleTask={onToggleParkingTask}
                onRateIdea={onRateParkingIdea}
                onDeleteEntry={onDeleteParkingEntry}
                onChangeBucket={onChangeParkingBucket}
                onOpenLightbox={(e) => onOpenLightbox(e)}
              />
            </div>
          </div>

          {/* KART 4: DAĞILMA, GECİKME & ERKEN BİTİRME KIRILIMI */}
          {summaryTab === "timeline" && (() => {
            const effectiveTab =
              summaryReasonsTab === "overtime" ||
              summaryReasonsTab === "endings"
                ? summaryReasonsTab
                : "distractions";
            const activeList =
              effectiveTab === "overtime"
                ? summaryReasonsData?.breakOvertimeTags ?? []
                : effectiveTab === "endings"
                  ? summaryReasonsData?.endingTags ?? []
                  : summaryReasonsData?.distractionTags ?? [];
            const totalCount =
              effectiveTab === "overtime"
                ? summaryReasonsData?.totalBreakOvertimes ?? 0
                : effectiveTab === "endings"
                  ? summaryReasonsData?.totalEndings ?? 0
                  : summaryReasonsData?.totalDistractions ?? 0;
            const emptyMsg =
              effectiveTab === "overtime"
                ? activeLang === "tr"
                  ? "Henüz mola gecikmesi kaydedilmedi."
                  : "No break overtime recorded yet."
                : effectiveTab === "endings"
                  ? t.noEndingReasons
                  : t.noDistractions;

            return (
              <div className="summary-section-card">
                <div className="summary-section-head">
                  <span>📊 {t.breakdownTitle}</span>
                </div>

                {/* KOMPAKT KATEGORİ KIRILIMI */}
                <div className="summary-subtabs">
                  <button
                    className={`subtab-btn ${effectiveTab === "distractions" ? "active" : ""}`}
                    onClick={() => onSetSummaryReasonsTab("distractions")}
                    title={t.distractionReasonsTab}
                  >
                    ⚡ {t.distractionShortTab} (
                    {summaryReasonsData?.totalDistractions ?? 0})
                  </button>
                  <button
                    className={`subtab-btn ${effectiveTab === "overtime" ? "active" : ""}`}
                    onClick={() => onSetSummaryReasonsTab("overtime")}
                    title={t.breakOvertimeTab}
                  >
                    ⏰ {t.breakOvertimeShortTab} (
                    {summaryReasonsData?.totalBreakOvertimes ?? 0})
                  </button>
                  <button
                    className={`subtab-btn ${effectiveTab === "endings" ? "active" : ""}`}
                    onClick={() => onSetSummaryReasonsTab("endings")}
                    title={t.endingReasonsTab}
                  >
                    ⏹ {t.endingShortTab} ({summaryReasonsData?.totalEndings ?? 0})
                  </button>
                </div>

                <div className="accordion-list">
                  {activeList.length === 0 ? (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#a1a1aa",
                        padding: "6px",
                      }}
                    >
                      {emptyMsg}
                    </div>
                  ) : (
                    activeList.map((item) => {
                      const expandKey = `${effectiveTab}:${item.tag}`;
                      const isExpanded = !!expandedTags[expandKey];
                      const pct =
                        totalCount > 0
                          ? Math.round((item.count / totalCount) * 100)
                          : 0;
                      const displayTag =
                        item.tag === "Tag Yok" || item.tag === "No Tag"
                          ? t.noTagLabel
                          : item.tag === "Diğer" || item.tag === "Other"
                            ? activeLang === "tr"
                              ? "Diğer"
                              : "Other"
                            : item.tag;
                      return (
                        <div key={item.tag} className="accordion-card">
                          <div
                            className="accordion-header"
                            onClick={() => onToggleAccordionTag(expandKey)}
                          >
                            <div className="accordion-title">
                              <span className="accordion-arrow">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <span>{displayTag}</span>
                            </div>
                            <span className="accordion-count">
                              {t.timesCount(item.count, pct)}
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="accordion-body">
                              {item.explanations.map((exp, idx) => (
                                <div key={idx} className="explanation-row">
                                  <span className="explanation-text">
                                    <span className="explanation-bullet">•</span>
                                    {exp.reason}
                                  </span>
                                  <span className="explanation-badge">
                                    {exp.count}x
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* KART 5: ADHD ÖZ-FARKINDALIK */}
          <div className="summary-section-card">
            <div className="summary-section-head">
              <span>{t.adhdTab}</span>
            </div>
            <div className="adhd-insights-wrap">
              <div className="adhd-cards-grid">
                <div className="adhd-card">
                  <div className="adhd-card-title">
                    ⏱ {t.adhdFocusThresholdTitle}
                  </div>
                  <div className="adhd-card-desc">
                    {t.adhdFocusThresholdDesc(
                      adhdInsights?.avgFocusThresholdMins ?? null,
                    )}
                  </div>
                </div>

                <div className="adhd-card">
                  <div className="adhd-card-title">
                    🧭 {t.adhdTriggerRatioTitle}
                  </div>
                  <div className="adhd-card-desc">
                    {t.adhdTriggerRatioDesc(
                      adhdInsights?.internalPct ?? 50,
                      adhdInsights?.internalCount ?? 0,
                      adhdInsights?.externalCount ?? 0,
                    )}
                  </div>
                </div>

                <div className="adhd-card">
                  <div className="adhd-card-title">
                    ⏳ {t.adhdTransitionTitle}
                  </div>
                  <div className="adhd-card-desc">
                    {t.adhdTransitionDesc(
                      adhdInsights?.avgBreakOvertimeMins ?? 0,
                      adhdInsights?.overtimeBreakRatePct ?? 0,
                    )}
                  </div>
                </div>

                <div className="adhd-card">
                  <div className="adhd-card-title">
                    🔥 {t.adhdCompletionTitle}
                  </div>
                  <div className="adhd-card-desc">
                    {t.adhdCompletionDesc(
                      adhdInsights?.completionRatePct ?? 100,
                      adhdInsights?.hyperfocusCount ?? 0,
                    )}
                    {(adhdInsights?.hyperfocusTotalMins ?? 0) > 0 && (
                      <div className="adhd-hf-sub">
                        🔥 {t.hyperfocusInsightLabel}:{" "}
                        {t.formatDuration(
                          (adhdInsights?.hyperfocusTotalMins ?? 0) * 60,
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="adhd-card full">
                  <div className="adhd-card-title">🌅 {t.adhdChronoTitle}</div>
                  <div className="adhd-card-desc">
                    {t.adhdChronoDesc(
                      adhdInsights?.peakFocusHoursLabel ?? null,
                      adhdInsights?.mostDistractedHoursLabel ?? null,
                    )}
                  </div>
                </div>
              </div>

              <div className="adhd-tip-box">
                {t.adhdDynamicTip(
                  adhdInsights?.avgFocusThresholdMins ?? null,
                  adhdInsights?.internalPct ?? 50,
                  adhdInsights?.overtimeBreakRatePct ?? 0,
                  adhdInsights?.topTriggerTag ?? null,
                )}
              </div>
            </div>
          </div>

          {/* VERİLERİ SIFIRLAMA & DIŞA AKTARMA BUTONLARI */}
          <div
            className="summary-bottom-row"
            style={{ justifyContent: "space-between" }}
          >
            <div className="summary-export-wrap">
              <button
                className="ghost-btn"
                onClick={onExportData}
                title={t.exportDataTooltip(exportDirPath || "Downloads")}
              >
                <IconDownload size={12} />
                <span>{t.exportDataBtn}</span>
              </button>
              {exportSavedMsg && (
                <span className="summary-export-saved" title={exportSavedMsg}>
                  {exportSavedMsg}
                </span>
              )}
            </div>
            <button
              className="ghost-btn reset-data-btn"
              onClick={() => onSetShowResetConfirm(true)}
            >
              <IconTrash size={12} />
              <span>{t.resetAllData}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
