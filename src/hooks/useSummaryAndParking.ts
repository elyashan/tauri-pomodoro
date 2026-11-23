// @llm-index: Summary, Dashboard, Timeline, Parking Lot, Lightbox & JSON export state/handlers
import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActiveDayStats,
  AdhdInsightsData,
  AppDistractionGroup,
  BioLogItem,
  ContextStatItem,
  ParkingBucket,
  ParkingLotData,
  SummaryReasonsData,
  TimelineSessionItem,
  WeekDayStat,
  WeeklySummary,
  WorkStoryEntry,
  deleteParkingItem,
  deleteWorkStoryEntry,
  exportAllData,
  getActiveDayStats,
  getAdhdInsights,
  getAppDistractionSummary,
  getBioLogs,
  getBreakParkingLotData,
  getContextStatsSummary,
  getDateBoundsIso,
  getDayStatsForDate,
  getParkingLotData,
  getSummaryReasonsData,
  getTimelineSessions,
  getWeekBoundsIso,
  getWeeklySummary,
  getWorkStoryEntries,
  parseLocalDateStr,
  rateParkingIdea,
  toLocalDateStr,
  toggleParkingTaskDone,
  updateParkingBucket,
} from "../db";
import { EMPTY_PARKING, type NavPage } from "../constants";
import type { ActiveLang, Translations } from "../i18n";
import type {
  SummaryReasonsTabType,
  SummaryTabType,
} from "../pages/SummaryPage";

export interface UseSummaryAndParkingParams {
  page: NavPage;
  setPage: (page: NavPage) => void;
  activeLang: ActiveLang;
  t: Translations;
  selectedSummaryDate: string;
  setSelectedSummaryDate: (dateStr: string) => void;
  setSummaryBioLogs: (logs: BioLogItem[]) => void;
  setIsCelebrating: (v: boolean) => void;
  setPlanDropdownOpen: (v: boolean) => void;
  refreshPendingSyncCount: () => Promise<void>;
}

export function useSummaryAndParking({
  page,
  setPage,
  activeLang,
  t,
  selectedSummaryDate,
  setSelectedSummaryDate,
  setSummaryBioLogs,
  setIsCelebrating,
  setPlanDropdownOpen,
  refreshPendingSyncCount,
}: UseSummaryAndParkingParams) {
  const [dayStats, setDayStats] = useState<ActiveDayStats>({
    dayId: 1,
    label: "Bugün",
    totalSec: 0,
    sessionCount: 0,
    avgSec: 0,
  });
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(
    null,
  );
  const [summaryTab, setSummaryTab] = useState<SummaryTabType>("timeline");
  const [selectedDayStats, setSelectedDayStats] = useState<{
    totalSec: number;
    sessionCount: number;
    avgSec: number;
  }>({ totalSec: 0, sessionCount: 0, avgSec: 0 });
  const [exportDirPath, setExportDirPath] = useState<string>("");
  const [exportSavedMsg, setExportSavedMsg] = useState<string | null>(null);
  const [summaryReasonsTab, setSummaryReasonsTab] =
    useState<SummaryReasonsTabType>("distractions");
  const [summaryReasonsData, setSummaryReasonsData] =
    useState<SummaryReasonsData | null>(null);
  const [timelineSessions, setTimelineSessions] = useState<
    TimelineSessionItem[]
  >([]);
  const [hoveredTimelineItem, setHoveredTimelineItem] =
    useState<TimelineSessionItem | null>(null);
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [hoveredWeekDay, setHoveredWeekDay] = useState<WeekDayStat | null>(
    null,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [freqOnlyToday, setFreqOnlyToday] = useState(true);
  const freqOnlyTodayRef = useRef(freqOnlyToday);
  freqOnlyTodayRef.current = freqOnlyToday;

  const [adhdInsights, setAdhdInsights] = useState<AdhdInsightsData | null>(
    null,
  );
  const [contextStats, setContextStats] = useState<ContextStatItem[]>([]);
  const [appDistractions, setAppDistractions] = useState<AppDistractionGroup[]>(
    [],
  );

  const [workStoryEntries, setWorkStoryEntries] = useState<WorkStoryEntry[]>(
    [],
  );
  const [lightboxEntry, setLightboxEntry] = useState<WorkStoryEntry | null>(
    null,
  );
  const [lightboxGroupEntries, setLightboxGroupEntries] = useState<
    WorkStoryEntry[]
  >([]);
  const [lightboxSource, setLightboxSource] = useState<"story" | "parking">(
    "story",
  );

  const [breakParkingData, setBreakParkingData] =
    useState<ParkingLotData>(EMPTY_PARKING);
  const [summaryParkingData, setSummaryParkingData] =
    useState<ParkingLotData>(EMPTY_PARKING);
  const [showBreakParking, setShowBreakParking] = useState<boolean>(false);
  const [breakParkingLayout, setBreakParkingLayout] = useState<{
    openRows: number;
    sections: number;
  }>({ openRows: 0, sections: 1 });

  const handleBreakParkingLayoutChange = useCallback(
    (openRows: number, sections: number) => {
      setBreakParkingLayout((prev) =>
        prev.openRows === openRows && prev.sections === sections
          ? prev
          : { openRows, sections },
      );
    },
    [],
  );

  const openLightbox = (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
    source: "story" | "parking" = "story",
  ) => {
    setLightboxEntry(entry);
    setLightboxGroupEntries(groupFrames || []);
    setLightboxSource(source);
  };

  const loadSummaryForScope = async (
    tab: SummaryTabType,
    dateStr: string,
    lang: ActiveLang = activeLang,
  ) => {
    const locale = lang === "tr" ? "tr-TR" : "en-US";
    const dateRange =
      tab === "weekly" ? getWeekBoundsIso(dateStr) : getDateBoundsIso(dateStr);
    const dayRange = getDateBoundsIso(dateStr);
    const [
      dayStat,
      weekly,
      reasonsData,
      timeline,
      insights,
      pData,
      cStats,
      aStats,
      wStory,
      bLogs,
    ] = await Promise.all([
      getDayStatsForDate(dateStr),
      getWeeklySummary(locale, dateStr),
      getSummaryReasonsData(false, dateRange),
      getTimelineSessions(undefined, dayRange),
      getAdhdInsights(false, dateRange),
      getParkingLotData(false, dateRange),
      getContextStatsSummary(false, dateRange),
      getAppDistractionSummary(false, dateRange),
      getWorkStoryEntries(false, 200, dateRange),
      getBioLogs(false, dayRange),
    ]);

    setSelectedDayStats(dayStat);
    setWeeklySummary(weekly);
    setSummaryReasonsData(reasonsData);
    setTimelineSessions(timeline);
    setAdhdInsights(insights);
    setSummaryParkingData(pData);
    setContextStats(cStats);
    setAppDistractions(aStats);
    setWorkStoryEntries(wStory);
    setSummaryBioLogs(bLogs);
    const selectedOrToday =
      weekly.days.find((d) => d.fullDateStr === dateStr) ??
      weekly.days.find((d) => d.is_today) ??
      weekly.days[weekly.days.length - 1] ??
      null;
    setHoveredWeekDay(selectedOrToday);
    setHoveredTimelineItem(null);
  };

  const openSummary = async () => {
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    const initialTab: SummaryTabType =
      summaryTab === "weekly" ? "weekly" : "timeline";
    setSummaryTab(initialTab);
    setFreqOnlyToday(initialTab === "timeline");
    const todayStr = toLocalDateStr();
    setSelectedSummaryDate(todayStr);
    await loadSummaryForScope(initialTab, todayStr, activeLang);
    setShowResetConfirm(false);
    setPage("summary");
  };

  const openDashboard = async () => {
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const [
      weekly,
      reasonsData,
      timeline,
      insights,
      pData,
      cStats,
      aStats,
      wStory,
    ] = await Promise.all([
      getWeeklySummary(locale),
      getSummaryReasonsData(freqOnlyToday),
      getTimelineSessions(),
      getAdhdInsights(freqOnlyToday),
      getParkingLotData(freqOnlyToday),
      getContextStatsSummary(freqOnlyToday),
      getAppDistractionSummary(freqOnlyToday),
      getWorkStoryEntries(freqOnlyToday, 80),
    ]);

    setWeeklySummary(weekly);
    setSummaryReasonsData(reasonsData);
    setTimelineSessions(timeline);
    setAdhdInsights(insights);
    setSummaryParkingData(pData);
    setContextStats(cStats);
    setAppDistractions(aStats);
    setWorkStoryEntries(wStory);
    await refreshPendingSyncCount();
    setPage("dashboard");
  };

  const handleChangeSummaryTab = async (tab: SummaryTabType) => {
    setSummaryTab(tab);
    setFreqOnlyToday(tab === "timeline");
    await loadSummaryForScope(tab, selectedSummaryDate, activeLang);
  };

  const handleSelectSummaryDate = async (
    dateStr: string,
    openDaily = false,
  ) => {
    const nextTab: SummaryTabType = openDaily ? "timeline" : summaryTab;
    if (openDaily && summaryTab !== "timeline") {
      setSummaryTab("timeline");
      setFreqOnlyToday(true);
    }
    setSelectedSummaryDate(dateStr);
    await loadSummaryForScope(nextTab, dateStr, activeLang);
  };

  const handleShiftSummaryDate = async (deltaDays: number) => {
    const d = parseLocalDateStr(selectedSummaryDate);
    d.setDate(d.getDate() + deltaDays);
    const nextStr = toLocalDateStr(d);
    setSelectedSummaryDate(nextStr);
    await loadSummaryForScope(summaryTab, nextStr, activeLang);
  };

  const toggleFreqFilter = async () => {
    const nextVal = !freqOnlyToday;
    setFreqOnlyToday(nextVal);
    setSummaryReasonsData(await getSummaryReasonsData(nextVal));
    setAdhdInsights(await getAdhdInsights(nextVal));
    setSummaryParkingData(await getParkingLotData(nextVal));
    setContextStats(await getContextStatsSummary(nextVal));
    setAppDistractions(await getAppDistractionSummary(nextVal));
    setWorkStoryEntries(await getWorkStoryEntries(nextVal, 80));
  };

  const refreshParkingViews = async () => {
    setBreakParkingData(await getBreakParkingLotData());
    if (page === "summary") {
      const scopeRange =
        summaryTab === "weekly"
          ? getWeekBoundsIso(selectedSummaryDate)
          : getDateBoundsIso(selectedSummaryDate);
      setSummaryParkingData(await getParkingLotData(false, scopeRange));
    } else {
      setSummaryParkingData(await getParkingLotData(freqOnlyTodayRef.current));
    }
  };

  const handleToggleParkingTask = async (id: number, done: boolean) => {
    await toggleParkingTaskDone(id, done);
    await refreshParkingViews();
  };

  const handleRateParkingIdea = async (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => {
    await rateParkingIdea(id, rating);
    await refreshParkingViews();
  };

  const handleDeleteParkingEntry = async (id: number) => {
    await deleteParkingItem(id);
    await refreshParkingViews();
  };

  const handleChangeParkingBucket = async (
    id: number,
    bucket: ParkingBucket,
  ) => {
    await updateParkingBucket(id, bucket);
    await refreshParkingViews();
  };

  const handleDeleteWorkStoryItem = async (id: number) => {
    await deleteWorkStoryEntry(id);
    setLightboxGroupEntries((prev) => prev.filter((item) => item.id !== id));
    setLightboxEntry(null);
    if (page === "summary") {
      await loadSummaryForScope(summaryTab, selectedSummaryDate, activeLang);
    } else {
      setWorkStoryEntries(
        await getWorkStoryEntries(freqOnlyTodayRef.current, 80),
      );
    }
  };

  const handleExportData = async () => {
    try {
      const jsonStr = await exportAllData();
      const filename = "pomodoro-backup.json";
      try {
        const savedPath = await invoke<string>("save_backup_json", {
          filename,
          content: jsonStr,
        });
        setExportSavedMsg(t.exportSavedMsg(savedPath));
        setTimeout(() => setExportSavedMsg(null), 4500);
        return;
      } catch {
        // Tarayıcı geliştirme modu fallback
      }
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSavedMsg(t.exportSavedMsg(filename));
      setTimeout(() => setExportSavedMsg(null), 4500);
    } catch (err) {
      console.error("Dışa aktarma hatası:", err);
    }
  };

  const toggleAccordionTag = (tagName: string) => {
    setExpandedTags((prev) => ({ ...prev, [tagName]: !prev[tagName] }));
  };

  const refreshActiveStatsAndTimeline = async (lang: ActiveLang = activeLang) => {
    const locale = lang === "tr" ? "tr-TR" : "en-US";
    setDayStats(await getActiveDayStats(locale));
    setWeeklySummary(await getWeeklySummary(locale));
    setTimelineSessions(await getTimelineSessions());
  };

  const maxWeeklyHours = Math.max(
    1,
    ...(weeklySummary?.days.map((d) => d.total_sec / 3600) ?? [1]),
  );

  return {
    dayStats,
    setDayStats,
    weeklySummary,
    setWeeklySummary,
    summaryTab,
    setSummaryTab,
    selectedDayStats,
    setSelectedDayStats,
    exportDirPath,
    setExportDirPath,
    exportSavedMsg,
    summaryReasonsTab,
    setSummaryReasonsTab,
    summaryReasonsData,
    timelineSessions,
    setTimelineSessions,
    hoveredTimelineItem,
    setHoveredTimelineItem,
    expandedTags,
    hoveredWeekDay,
    setHoveredWeekDay,
    showResetConfirm,
    setShowResetConfirm,
    freqOnlyToday,
    setFreqOnlyToday,
    freqOnlyTodayRef,
    adhdInsights,
    contextStats,
    setContextStats,
    appDistractions,
    setAppDistractions,
    workStoryEntries,
    setWorkStoryEntries,
    lightboxEntry,
    setLightboxEntry,
    lightboxGroupEntries,
    setLightboxGroupEntries,
    lightboxSource,
    setLightboxSource,
    openLightbox,
    breakParkingData,
    setBreakParkingData,
    summaryParkingData,
    setSummaryParkingData,
    showBreakParking,
    setShowBreakParking,
    breakParkingLayout,
    setBreakParkingLayout,
    handleBreakParkingLayoutChange,
    maxWeeklyHours,
    loadSummaryForScope,
    openSummary,
    openDashboard,
    handleChangeSummaryTab,
    handleSelectSummaryDate,
    handleShiftSummaryDate,
    toggleFreqFilter,
    refreshParkingViews,
    refreshActiveStatsAndTimeline,
    handleToggleParkingTask,
    handleRateParkingIdea,
    handleDeleteParkingEntry,
    handleChangeParkingBucket,
    handleDeleteWorkStoryItem,
    handleExportData,
    toggleAccordionTag,
  };
}
