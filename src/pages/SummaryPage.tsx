// @llm-index: Summary page shell composing DateBar, TimelineRows, WeeklyChart, ParkingLot, ReasonsBreakdown, AdhdInsights
import { useState } from "react";
import type {
  AdhdInsightsData,
  BioEventType,
  BioLogItem,
  ClearDataOptions,
  ParkingBucket,
  ParkingLotData,
  SummaryReasonsData,
  TimelineSessionItem,
  WeekDayStat,
  WeeklySummary,
  WorkStoryEntry,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import { ParkingLotPanel } from "../components/ParkingLot";
import {
  IconArrowLeft,
  IconDownload,
  IconPlus,
  IconTrash,
} from "../components/Icons";
import {
  buildVerticalTimelineModel,
  type SummaryReasonsTabType,
  type SummarySectionTab,
  type SummaryTabType,
} from "./summary/timelineUtils";
import { SummaryResetConfirm } from "./summary/SummaryResetConfirm";
import { SummaryDateBar } from "./summary/SummaryDateBar";
import { TimelineBioPopover } from "./summary/TimelineBioPopover";
import { TimelineRows } from "./summary/TimelineRows";
import { WeeklyChartSection } from "./summary/WeeklyChartSection";
import { ReasonsBreakdownCard } from "./summary/ReasonsBreakdownCard";
import { AdhdInsightsCard } from "./summary/AdhdInsightsCard";

export type { SummaryTabType, SummaryReasonsTabType };

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
  onSelectDate: (dateStr: string, openDaily?: boolean) => void;
  onShiftDate: (deltaDays: number) => void;
  onOpenDashboard?: () => void;
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
    sleepHours?: number | null,
    targetDateStr?: string,
  ) => Promise<void> | void;
  onDeleteBioLog: (id: number) => void;
  onOpenLightbox: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
    source?: "story" | "parking",
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
  onOpenLightbox,
  onToggleAccordionTag,
  onExportData,
}: SummaryPageProps) {
  const [summarySection, setSummarySection] =
    useState<SummarySectionTab>("overview");
  const [activeStorySessionId, setActiveStorySessionId] = useState<
    number | null
  >(null);
  const [showBioPopover, setShowBioPopover] = useState(false);

  const timelineModel =
    summaryTab === "timeline"
      ? buildVerticalTimelineModel(timelineSessions, bioLogs, t)
      : null;

  const totalParkingCount =
    summaryParkingData.pendingTasks.length +
    summaryParkingData.unratedIdeas.length;

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-left" style={{ gap: "8px" }}>
          <span className="badge">{t.summary}</span>
          <div className="summary-tab-group">
            <button
              className={`tab-btn ${summaryTab === "timeline" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("timeline")}
            >
              {t.summaryDailyTab}
            </button>
            <button
              className={`tab-btn ${summaryTab === "weekly" ? "active" : ""}`}
              onClick={() => onSetSummaryTab("weekly")}
            >
              {t.summaryWeeklyTab}
            </button>
          </div>
        </div>
        <button className="ghost-btn" onClick={onOpenMenu}>
          <IconArrowLeft size={12} />
          <span>{t.home}</span>
        </button>
      </div>

      {showResetConfirm ? (
        <SummaryResetConfirm
          t={t}
          onResetData={onResetData}
          onCancel={() => onSetShowResetConfirm(false)}
        />
      ) : (
        <>
          <SummaryDateBar
            t={t}
            activeLang={activeLang}
            summaryTab={summaryTab}
            selectedDateStr={selectedDateStr}
            weeklySummary={weeklySummary}
            onSelectDate={onSelectDate}
            onShiftDate={onShiftDate}
          />

          <div className="linear-tabs summary-section-tabs no-drag">
            <button
              type="button"
              className={`linear-tab-btn ${summarySection === "overview" ? "active" : ""}`}
              onClick={() => setSummarySection("overview")}
            >
              <span>{t.summarySectionOverview}</span>
            </button>
            <button
              type="button"
              className={`linear-tab-btn ${summarySection === "parking" ? "active" : ""}`}
              onClick={() => setSummarySection("parking")}
            >
              <span>{t.summarySectionParking}</span>
              {totalParkingCount > 0 && (
                <span className="linear-tab-count">{totalParkingCount}</span>
              )}
            </button>
            <button
              type="button"
              className={`linear-tab-btn ${summarySection === "insights" ? "active" : ""}`}
              onClick={() => setSummarySection("insights")}
            >
              <span>{t.summarySectionInsights}</span>
            </button>
          </div>

          <div className="summary-scroll-stack no-drag">
            {summarySection === "overview" && (
              <div className="summary-section-card">
                {summaryTab === "timeline" && timelineModel ? (
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

                    <div className="vtimeline-wrap">
                      <div className="vtimeline-legend">
                        <div className="vtimeline-legend-items">
                          <span className="vtimeline-legend-item">
                            <span className="vtimeline-legend-dot work" />
                            <span>{t.work}</span>
                          </span>
                          <span className="vtimeline-legend-item">
                            <span className="vtimeline-legend-dot break" />
                            <span>{t.break}</span>
                          </span>
                          <span className="vtimeline-legend-item">
                            <span className="vtimeline-legend-dot pause" />
                            <span>
                              {activeLang === "tr" ? "Ara" : "Pause"}
                            </span>
                          </span>
                          <span className="vtimeline-legend-item">
                            <span className="vtimeline-legend-dot overtime" />
                            <span>{t.breakOvertimeShortTab}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`vtimeline-add-bio-btn ${showBioPopover ? "active" : ""}`}
                          onClick={() => setShowBioPopover((prev) => !prev)}
                          title={t.bioContextTitle}
                        >
                          <IconPlus size={11} />
                        </button>
                      </div>

                      {showBioPopover && (
                        <TimelineBioPopover
                          t={t}
                          activeLang={activeLang}
                          selectedDateStr={selectedDateStr}
                          onAddBioLog={onAddBioLog}
                          onClose={() => setShowBioPopover(false)}
                        />
                      )}

                      <TimelineRows
                        t={t}
                        activeLang={activeLang}
                        model={timelineModel}
                        workStoryEntries={workStoryEntries}
                        hoveredTimelineItem={hoveredTimelineItem}
                        activeStorySessionId={activeStorySessionId}
                        onSetHoveredTimelineItem={onSetHoveredTimelineItem}
                        onSetActiveStorySessionId={setActiveStorySessionId}
                        onDeleteBioLog={onDeleteBioLog}
                        onOpenLightbox={onOpenLightbox}
                      />
                    </div>
                  </>
                ) : (
                  <WeeklyChartSection
                    t={t}
                    activeLang={activeLang}
                    selectedDateStr={selectedDateStr}
                    weeklySummary={weeklySummary}
                    summaryReasonsData={summaryReasonsData}
                    hoveredWeekDay={hoveredWeekDay}
                    maxWeeklyHours={maxWeeklyHours}
                    onSelectDate={onSelectDate}
                    onSetHoveredWeekDay={onSetHoveredWeekDay}
                  />
                )}
              </div>
            )}

            {summarySection === "parking" && (
              <div className="summary-section-card">
                <div className="parking-panel summary-parking">
                  <ParkingLotPanel
                    data={summaryParkingData}
                    isBreakView={false}
                    t={t}
                    onToggleTask={onToggleParkingTask}
                    onRateIdea={onRateParkingIdea}
                    onDeleteEntry={onDeleteParkingEntry}
                    onChangeBucket={onChangeParkingBucket}
                    onOpenLightbox={onOpenLightbox}
                  />
                </div>
              </div>
            )}

            {summarySection === "insights" && (
              <>
                <ReasonsBreakdownCard
                  t={t}
                  activeLang={activeLang}
                  summaryReasonsTab={summaryReasonsTab}
                  summaryReasonsData={summaryReasonsData}
                  expandedTags={expandedTags}
                  onSetSummaryReasonsTab={onSetSummaryReasonsTab}
                  onToggleAccordionTag={onToggleAccordionTag}
                />

                <AdhdInsightsCard t={t} adhdInsights={adhdInsights} />

                <div className="summary-bottom-row">
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
                      <span
                        className="summary-export-saved"
                        title={exportSavedMsg}
                      >
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
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
