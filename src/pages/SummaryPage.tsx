import type {
  AdhdInsightsData,
  AppDistractionGroup,
  ContextStatItem,
  DaySummary,
  ParkingItem,
  ParkingLotData,
  SummaryReasonsData,
  TimelineSessionItem,
  WeekDayStat,
  WeeklySummary,
  WorkStoryEntry,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import { ParkingLotPanel, WorkStoryGrid } from "../components/ParkingLot";

export type SummaryTabType =
  | "timeline"
  | "weekly"
  | "recent"
  | "parking"
  | "story"
  | "adhd";

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
  summaryParkingData: ParkingLotData;
  workStoryEntries: WorkStoryEntry[];
  showResetConfirm: boolean;
  hoveredTimelineItem: TimelineSessionItem | null;
  timelineSessions: TimelineSessionItem[];
  weeklySummary: WeeklySummary | null;
  summaryReasonsData: SummaryReasonsData | null;
  hoveredWeekDay: WeekDayStat | null;
  maxWeeklyHours: number;
  hoveredDay: DaySummary | null;
  summaryDays: DaySummary[];
  maxRecentHours: number;
  adhdInsights: AdhdInsightsData | null;
  freqOnlyToday: boolean;
  docsStatusMsg: string | null;
  contextStats: ContextStatItem[];
  appDistractions: AppDistractionGroup[];
  expandedTags: Record<string, boolean>;
  onSetSummaryTab: (tab: SummaryTabType) => void;
  onSetSummaryReasonsTab: (tab: SummaryReasonsTabType) => void;
  onOpenDashboard: () => void;
  onOpenMenu: () => void;
  onSetShowResetConfirm: (show: boolean) => void;
  onResetAllData: () => void;
  onSetHoveredTimelineItem: (item: TimelineSessionItem | null) => void;
  onSetHoveredWeekDay: (day: WeekDayStat | null) => void;
  onSetHoveredDay: (day: DaySummary | null) => void;
  onToggleFreqFilter: () => void;
  onSyncParkingToDocs: () => void;
  onSyncSingleItemToDocs: (item: ParkingItem) => void;
  onToggleParkingTask: (id: number, done: boolean) => void;
  onRateParkingIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteParkingEntry: (id: number) => void;
  onOpenLightbox: (entry: WorkStoryEntry) => void;
  onToggleAccordionTag: (key: string) => void;
  onExportData: () => void;
}

export function SummaryPage({
  t,
  activeLang,
  summaryTab,
  summaryReasonsTab,
  summaryParkingData,
  workStoryEntries,
  showResetConfirm,
  hoveredTimelineItem,
  timelineSessions,
  weeklySummary,
  summaryReasonsData,
  hoveredWeekDay,
  maxWeeklyHours,
  hoveredDay,
  summaryDays,
  maxRecentHours,
  adhdInsights,
  freqOnlyToday,
  docsStatusMsg,
  contextStats,
  appDistractions,
  expandedTags,
  onSetSummaryTab,
  onSetSummaryReasonsTab,
  onOpenDashboard,
  onOpenMenu,
  onSetShowResetConfirm,
  onResetAllData,
  onSetHoveredTimelineItem,
  onSetHoveredWeekDay,
  onSetHoveredDay,
  onToggleFreqFilter,
  onSyncParkingToDocs,
  onSyncSingleItemToDocs,
  onToggleParkingTask,
  onRateParkingIdea,
  onDeleteParkingEntry,
  onOpenLightbox,
  onToggleAccordionTag,
  onExportData,
}: SummaryPageProps) {
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
              {t.timelineTab}
            </button>
            <button
              className={`tab-btn ${summaryTab === "weekly" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("weekly")}
            >
              {t.viewWeekly}
            </button>
            <button
              className={`tab-btn ${summaryTab === "recent" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("recent")}
            >
              {t.viewRecentDays}
            </button>
            <button
              className={`tab-btn ${summaryTab === "parking" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("parking")}
              title={`${t.parkingTab} (${
                summaryParkingData.totalTasks +
                summaryParkingData.totalIdeas +
                summaryParkingData.totalScreenshots
              })`}
            >
              {t.parkingTab}
            </button>
            <button
              className={`tab-btn ${summaryTab === "story" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("story")}
              title={`${t.workStoryTitle} (${workStoryEntries.length})`}
            >
              📸 {t.workStoryTab}
            </button>
            <button
              className={`tab-btn ${summaryTab === "adhd" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("adhd")}
            >
              {t.adhdTab}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            className="ghost-btn"
            onClick={onOpenDashboard}
            title={t.dashboardBtn}
          >
            📊 {t.dashboardBtn}
          </button>
          <button className="ghost-btn" onClick={onOpenMenu}>
            ← {t.home}
          </button>
        </div>
      </div>

      {showResetConfirm ? (
        <div className="reset-confirm-box">
          <div className="reset-confirm-title">{t.resetConfirmTitle}</div>
          <div className="reset-confirm-desc">{t.resetConfirmDesc}</div>
          <div className="btn-row" style={{ marginTop: "8px" }}>
            <button className="warn-btn" onClick={onResetAllData}>
              {t.resetConfirmYes}
            </button>
            <button onClick={() => onSetShowResetConfirm(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 24 SAATLİK ÇİZELGE GÖRÜNÜMÜ */}
          {summaryTab === "timeline" && (
            <>
              <div className="tooltip-banner">
                {hoveredTimelineItem ? (
                  <>
                    <span>
                      <b>
                        {hoveredTimelineItem.mode === "work" ? t.work : t.break}
                      </b>
                      :{" "}
                      {hoveredTimelineItem.tag ||
                        (hoveredTimelineItem.mode === "work"
                          ? t.work
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
                      const blockClass =
                        s.mode === "work"
                          ? "work-block"
                          : s.overtimeSec > 0
                            ? "overtime-block"
                            : "break-block";
                      return (
                        <div
                          key={s.id}
                          className={`timeline-block ${blockClass}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          onMouseEnter={() => onSetHoveredTimelineItem(s)}
                          title={`${s.mode === "work" ? t.work : t.break}: ${s.timeRangeLabel} (${t.formatDuration(s.durationSec)})`}
                        />
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
                    timelineSessions.map((s) => (
                      <div
                        key={s.id}
                        className={`timeline-session-row ${
                          hoveredTimelineItem?.id === s.id ? "active-row" : ""
                        }`}
                        onMouseEnter={() => onSetHoveredTimelineItem(s)}
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
                            {s.mode === "work" ? "💼" : "☕"}{" "}
                            {s.tag || (s.mode === "work" ? t.work : t.break)}
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
                        </div>
                        <span className="timeline-row-dur">
                          {t.formatDuration(s.durationSec)}
                        </span>
                      </div>
                    ))
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
              </div>
            </>
          )}

          {/* HAFTALIK ÖZET GÖRÜNÜMÜ */}
          {summaryTab === "weekly" && (
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
                  <div className="stat-lbl">{t.avgDistractionsPerSession}</div>
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
                  return (
                    <div
                      key={d.dayIndex}
                      className="bar-col"
                      onMouseEnter={() => onSetHoveredWeekDay(d)}
                    >
                      <span className="bar-hours">
                        {hours.toFixed(1)}
                        {activeLang === "tr" ? "s" : "h"}
                      </span>
                      <div
                        className={`bar-fill ${isHovered ? "active-bar" : ""}`}
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

          {/* SON GÜNLER GÖRÜNÜMÜ */}
          {summaryTab === "recent" && (
            <>
              <div className="tooltip-banner" style={{ marginTop: "6px" }}>
                {hoveredDay ? (
                  (() => {
                    const hours = (hoveredDay.total_sec / 3600).toFixed(1);
                    const avgMins =
                      hoveredDay.session_count > 0
                        ? Math.round(
                            hoveredDay.total_sec /
                              hoveredDay.session_count /
                              60,
                          )
                        : 0;
                    const details = t.summaryBarDetails(
                      hoveredDay.label,
                      hours,
                      hoveredDay.session_count,
                      avgMins,
                    );
                    return (
                      <>
                        <span>
                          <b>{details.main}</b>
                        </span>
                        <span>{details.sub}</span>
                      </>
                    );
                  })()
                ) : (
                  <span>{t.summaryHoverHint}</span>
                )}
              </div>

              <div className="chart-area">
                {summaryDays.map((d) => {
                  const hours = d.total_sec / 3600;
                  const heightPct = Math.max(
                    6,
                    (hours / maxRecentHours) * 85,
                  );
                  return (
                    <div
                      key={d.id}
                      className="bar-col"
                      onMouseEnter={() => onSetHoveredDay(d)}
                    >
                      <span className="bar-hours">
                        {hours.toFixed(1)}
                        {activeLang === "tr" ? "s" : "h"}
                      </span>
                      <div
                        className={`bar-fill ${hoveredDay?.id === d.id ? "active-bar" : ""}`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="bar-label">
                        {d.is_active ? `${d.label}*` : d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ADHD ÖZ-FARKINDALIK (SELF-REALIZATION) GÖRÜNÜMÜ */}
          {summaryTab === "adhd" && (
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
          )}

          {/* MOLA & FİKİR OTOPARKI GÖRÜNÜMÜ */}
          {summaryTab === "parking" && (
            <div className="parking-panel summary-parking no-drag">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="parking-banner-title">
                  {t.parkingTab} (
                  {summaryParkingData.totalTasks +
                    summaryParkingData.totalIdeas +
                    summaryParkingData.totalScreenshots}
                  )
                </span>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={onToggleFreqFilter}
                  title={freqOnlyToday ? t.filterToday : t.filterAll}
                >
                  {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
                </button>
              </div>
              <ParkingLotPanel
                data={summaryParkingData}
                isBreakView={false}
                t={t}
                docsStatusMsg={docsStatusMsg}
                onSyncAllToDocs={onSyncParkingToDocs}
                onSyncSingleToDocs={onSyncSingleItemToDocs}
                onToggleTask={onToggleParkingTask}
                onRateIdea={onRateParkingIdea}
                onDeleteEntry={onDeleteParkingEntry}
                onOpenLightbox={onOpenLightbox}
              />
            </div>
          )}

          {/* ÇALIŞMA HİKAYESİ GÖRÜNÜMÜ */}
          {summaryTab === "story" && (
            <div className="parking-panel summary-parking no-drag">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <span className="parking-banner-title">
                  📸 {t.workStoryTitle} ({workStoryEntries.length})
                </span>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={onToggleFreqFilter}
                  title={freqOnlyToday ? t.filterToday : t.filterAll}
                >
                  {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
                </button>
              </div>
              <WorkStoryGrid
                entries={workStoryEntries}
                emptyMessage={t.workStoryEmpty}
                onSelectEntry={onOpenLightbox}
              />
            </div>
          )}

          {/* KOMPAKT KATEGORİ KIRILIMI */}
          <div className="summary-subtabs">
            <button
              className={`subtab-btn ${summaryReasonsTab === "work" ? "active" : ""}`}
              onClick={() => onSetSummaryReasonsTab("work")}
              title={t.workTagsTab}
            >
              💼 {t.workTagsShortTab} (
              {summaryReasonsData?.totalWorkSubjects ?? 0})
            </button>
            <button
              className={`subtab-btn ${summaryReasonsTab === "contexts" ? "active" : ""}`}
              onClick={() => onSetSummaryReasonsTab("contexts")}
              title={t.contextFullTab}
            >
              🎯 {t.contextShortTab} ({contextStats.length})
            </button>
            <button
              className={`subtab-btn ${summaryReasonsTab === "apps" ? "active" : ""}`}
              onClick={() => onSetSummaryReasonsTab("apps")}
              title={t.appsFullTab}
            >
              🌐 {t.appsShortTab} (
              {appDistractions.reduce((acc, g) => acc + g.totalCount, 0)})
            </button>
            <button
              className={`subtab-btn ${summaryReasonsTab === "distractions" ? "active" : ""}`}
              onClick={() => onSetSummaryReasonsTab("distractions")}
              title={t.distractionReasonsTab}
            >
              ⚡ {t.distractionShortTab} (
              {summaryReasonsData?.totalDistractions ?? 0})
            </button>
            <button
              className={`subtab-btn ${summaryReasonsTab === "overtime" ? "active" : ""}`}
              onClick={() => onSetSummaryReasonsTab("overtime")}
              title={t.breakOvertimeTab}
            >
              ⏰ {t.breakOvertimeShortTab} (
              {summaryReasonsData?.totalBreakOvertimes ?? 0})
            </button>
            <button
              className={`subtab-btn ${summaryReasonsTab === "endings" ? "active" : ""}`}
              onClick={() => onSetSummaryReasonsTab("endings")}
              title={t.endingReasonsTab}
            >
              ⏹ {t.endingShortTab} ({summaryReasonsData?.totalEndings ?? 0})
            </button>
            <button
              className="ghost-btn"
              onClick={onToggleFreqFilter}
              title={freqOnlyToday ? t.filterToday : t.filterAll}
            >
              {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
            </button>
          </div>

          <div className="accordion-list">
            {(() => {
              if (summaryReasonsTab === "contexts") {
                if (contextStats.length === 0) {
                  return (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#a1a1aa",
                        padding: "6px",
                      }}
                    >
                      {t.noContextStats}
                    </div>
                  );
                }
                return contextStats.map((ctx) => {
                  const expandKey = `ctx:${ctx.contextText}`;
                  const isExpanded = !!expandedTags[expandKey];
                  return (
                    <div key={ctx.contextText} className="accordion-card">
                      <div
                        className="accordion-header"
                        onClick={() => onToggleAccordionTag(expandKey)}
                      >
                        <div
                          className="accordion-title"
                          style={{ minWidth: 0, overflow: "hidden" }}
                        >
                          <span className="accordion-arrow">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <span
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            🎯 {ctx.contextText}
                          </span>
                        </div>
                        <span
                          className="accordion-count"
                          style={{ flexShrink: 0 }}
                        >
                          {t.formatDuration(ctx.totalDurationSec)} • ⚡
                          {ctx.distractionCount}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="accordion-body">
                          {ctx.lastWorkTag && (
                            <div className="explanation-row">
                              <span className="explanation-text">
                                💼 {ctx.lastWorkTag}
                              </span>
                              <span className="explanation-badge">
                                {ctx.entryCount}x
                              </span>
                            </div>
                          )}
                          {ctx.topApp && (
                            <div className="explanation-row">
                              <span className="explanation-text">
                                🌐 {ctx.topApp}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              }

              if (summaryReasonsTab === "apps") {
                const totalAppDist = appDistractions.reduce(
                  (acc, g) => acc + g.totalCount,
                  0,
                );
                if (appDistractions.length === 0) {
                  return (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#a1a1aa",
                        padding: "6px",
                      }}
                    >
                      {t.noAppDistractions}
                    </div>
                  );
                }
                return appDistractions.map((grp) => {
                  const expandKey = `app:${grp.appName}`;
                  const isExpanded = !!expandedTags[expandKey];
                  const pct =
                    totalAppDist > 0
                      ? Math.round((grp.totalCount / totalAppDist) * 100)
                      : 0;
                  return (
                    <div key={grp.appName} className="accordion-card">
                      <div
                        className="accordion-header"
                        onClick={() => onToggleAccordionTag(expandKey)}
                      >
                        <div className="accordion-title">
                          <span className="accordion-arrow">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <span>🌐 {grp.appName}</span>
                        </div>
                        <span className="accordion-count">
                          {t.timesCount(grp.totalCount, pct)}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="accordion-body">
                          {grp.details.map((d, idx) => (
                            <div key={idx} className="explanation-row">
                              <span className="explanation-text">
                                <span className="explanation-bullet">•</span>
                                {d.windowTitle && (
                                  <>
                                    <b>{d.windowTitle}</b>
                                    {" — "}
                                  </>
                                )}
                                <span style={{ color: "#fbbf24" }}>
                                  [{t.catKeyHints[d.category]}]
                                </span>{" "}
                                {d.reason}
                                {d.contextText ? ` (🎯 ${d.contextText})` : ""}
                              </span>
                              <span className="explanation-badge">
                                {d.count}x
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              }

              const activeList =
                summaryReasonsTab === "work"
                  ? summaryReasonsData?.workTags ?? []
                  : summaryReasonsTab === "overtime"
                    ? summaryReasonsData?.breakOvertimeTags ?? []
                    : summaryReasonsTab === "distractions"
                      ? summaryReasonsData?.distractionTags ?? []
                      : summaryReasonsData?.endingTags ?? [];
              const totalCount =
                summaryReasonsTab === "work"
                  ? summaryReasonsData?.totalWorkSubjects ?? 0
                  : summaryReasonsTab === "overtime"
                    ? summaryReasonsData?.totalBreakOvertimes ?? 0
                    : summaryReasonsTab === "distractions"
                      ? summaryReasonsData?.totalDistractions ?? 0
                      : summaryReasonsData?.totalEndings ?? 0;
              const emptyMsg =
                summaryReasonsTab === "work"
                  ? activeLang === "tr"
                    ? "Henüz çalışma konusu kaydedilmedi."
                    : "No work topics recorded yet."
                  : summaryReasonsTab === "overtime"
                    ? activeLang === "tr"
                      ? "Henüz mola gecikmesi kaydedilmedi."
                      : "No break overtime recorded yet."
                    : summaryReasonsTab === "distractions"
                      ? t.noDistractions
                      : t.noEndingReasons;

              if (activeList.length === 0) {
                return (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#a1a1aa",
                      padding: "6px",
                    }}
                  >
                    {emptyMsg}
                  </div>
                );
              }

              return activeList.map((item) => {
                const expandKey = `${summaryReasonsTab}:${item.tag}`;
                const isExpanded = !!expandedTags[expandKey];
                const pct =
                  totalCount > 0
                    ? Math.round((item.count / totalCount) * 100)
                    : 0;
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
                        <span>{item.tag}</span>
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
              });
            })()}
          </div>

          {/* VERİLERİ SIFIRLAMA & DIŞA AKTARMA BUTONLARI */}
          <div
            className="summary-bottom-row"
            style={{ justifyContent: "space-between" }}
          >
            <button
              className="ghost-btn"
              onClick={onExportData}
              title={t.exportDataBtn}
            >
              {t.exportDataBtn}
            </button>
            <button
              className="ghost-btn reset-data-btn"
              onClick={() => onSetShowResetConfirm(true)}
            >
              🗑 {t.resetAllData}
            </button>
          </div>
        </>
      )}
    </>
  );
}
