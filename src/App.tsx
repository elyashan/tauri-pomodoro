// @llm-index Main Application Composition & Session/Timer Coordinator
// State & Hook Wiring      : lines ~110-585
// Mount Hydration/Recovery : lines ~585-980
// Sizing, Watchers, Tick   : lines ~980-1515
// Context & Capture Flow   : lines ~1515-1930
// Session Lifecycle (Start/Stop/Break): lines ~1930-2875
// Language/Penalty/Reset   : lines ~2875-2985
// JSX Shell (MiniDock, Modals, Pages, Lightbox): lines ~2985-end

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  PageType,
  TimerMode,
  BreakKind,
  RuntimeState,
  AppState,
  LangCode,
  DistractionCategory,
  doesCategoryAddPenalty,
  DEFAULT_STUDY_PLANS,
  DEFAULT_WORK_SEC,
  DEFAULT_BREAK_SEC,
  loadAppState,
  saveAppState,
  loadRuntimeState,
  saveRuntimeState,
  loadThemeSettings,
  loadLanguagePreference,
  saveLanguagePreference,
  loadDistractPenalty,
  saveDistractPenalty,
  getActiveDayStats,
  recordWorkSession,
  deleteWorkSessionById,
  updateSessionMoodAfter,
  recordBreakSession,
  getTimelineSessions,
  loadAmbientNoiseSettings,
  loadRescueExerciseSettings,
  loadBreakChecklistItems,
  loadStudyPlans,
  loadActivePlanId,
  loadSessionCycleStats,
  saveSessionCycleStats,
  recordDistraction,
  getWeeklySummary,
  ClearDataOptions,
  clearSelectedData,
  getTags,
  getPreviousReasons,
  loadCustomWindowSizes,
  addParkingItem,
  getBreakParkingLotData,
  MoodType,
  addMoodLog,
  startContextLog,
  finalizeContextLog,
  incrementContextDistraction,
  getRecentContexts,
  loadGlobalShortcuts,
  getWorkStoryEntries,
  toLocalDateStr,
  parseLocalDateStr,
  getDateBoundsIso,
} from "./db";
import { translations, resolveLanguage } from "./i18n";
import { ConfettiCanvas } from "./Confetti";
import type { CaptureSubmittedEvent } from "./QuickCapture";
import {
  EMPTY_PARKING,
  NavPage,
  ShortcutStatus,
  formatClock,
  getFinalStretchSec,
  getWarmupDurationSec,
  resolveHarmoniousTimerColor,
} from "./constants";
import { playBreakChime, playCelebrationFanfare } from "./lib/audio";
import { hexToRgba, isLightColor } from "./lib/color";
import { persistSnapshots } from "./lib/windowResize";
import { useAppSettingsAndTags } from "./hooks/useAppSettingsAndTags";
import { useBioAndMood } from "./hooks/useBioAndMood";
import { useCloudSync } from "./hooks/useCloudSync";
import { useFeedback } from "./hooks/useFeedback";
import { useMiniDock } from "./hooks/useMiniDock";
import { useSummaryAndParking } from "./hooks/useSummaryAndParking";
import { useSystemWatchers } from "./hooks/useSystemWatchers";
import {
  STALE_SESSION_TIMEOUT_MS,
  STALE_SESSION_TIMEOUT_SEC,
  useTimerLoop,
} from "./hooks/useTimerLoop";
import { useWindowSizing } from "./hooks/useWindowSizing";
import { IconClose } from "./components/Icons";
import { MiniDock } from "./components/MiniDock";
import {
  BreakOverdueModal,
  DistractModal,
  DistractSubmissionPayload,
  EarlyStopModal,
  LightboxModal,
  ShortBreakPromptModal,
  StuckRescueModal,
  WorkTopicModal,
} from "./components/SessionModals";
import { TimerPage, WorkPhase } from "./pages/TimerPage";
import { MenuPage } from "./pages/MenuPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SummaryPage } from "./pages/SummaryPage";
import { DashboardPage } from "./pages/DashboardPage";
import "./App.css";

export default function App() {
  const [loaded, setLoaded] = useState(false);

  // Navigasyon sayfası ("menu" | "timer" | "summary" | "settings" | "dashboard") ile
  // seans içi mod ("work" | "break") birbirinden tamamen ayrıdır.
  const [page, setPage] = useState<NavPage>("menu");
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [timerMode, setTimerMode] = useState<TimerMode>("work");

  // Özel Plan Dropdown durumu
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const planDropdownRef = useRef<HTMLDivElement | null>(null);

  // Dil durumu
  const [langPref, setLangPref] = useState<LangCode>("auto");
  const activeLang = resolveLanguage(langPref);
  const t = translations[activeLang];

  // Çalışma Planları & Döngü Takibi
  const [completedWorkCount, setCompletedWorkCount] = useState<number>(0);
  const [sessionShortBreakCount, setSessionShortBreakCount] = useState<number>(0);
  const [sessionGroupId, setSessionGroupId] = useState<string | null>(null);
  const sessionGroupIdRef = useRef<string | null>(null);
  sessionGroupIdRef.current = sessionGroupId;
  const [breakKind, setBreakKind] = useState<BreakKind>("standard");
  const [savedWorkSecondsLeft, setSavedWorkSecondsLeft] =
    useState<number>(DEFAULT_WORK_SEC);
  const [savedWorkElapsedSec, setSavedWorkElapsedSec] = useState<number>(0);

  const [workSecondsLeft, setWorkSecondsLeft] = useState(DEFAULT_WORK_SEC);
  const [workElapsedSec, setWorkElapsedSec] = useState(0);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(DEFAULT_BREAK_SEC);

  // Mola süresi, gerçek geçen mola ve gecikme (overtime) takibi
  const [breakTotalSec, setBreakTotalSec] = useState(DEFAULT_BREAK_SEC);
  const [breakElapsedSec, setBreakElapsedSec] = useState(0);
  const [breakOverdueSec, setBreakOverdueSec] = useState(0);
  const [breakOvertimeAccumSec, setBreakOvertimeAccumSec] = useState(0);
  const [showBreakOverdueBox, setShowBreakOverdueBox] = useState(false);
  // Gecikme diyaloğu kapandığında çalışmayı otomatik başlatıp başlatmayacağımızı tutar
  const autoStartAfterBreakRef = useRef<boolean>(true);
  const [breakOverduePrevReasons, setBreakOverduePrevReasons] = useState<
    string[]
  >([]);
  const [breakOverdueReasonText, setBreakOverdueReasonText] = useState("");
  const [isEditingBreakOverdueTags, setIsEditingBreakOverdueTags] =
    useState(false);
  const [workPauseStartedAtMs, setWorkPauseStartedAtMs] = useState<
    number | null
  >(null);
  const workPauseStartedAtRef = useRef<number | null>(null);
  workPauseStartedAtRef.current = workPauseStartedAtMs;
  const [workPausedLiveSec, setWorkPausedLiveSec] = useState<number>(0);
  const [breakOverdueSource, setBreakOverdueSource] = useState<
    "break" | "work_pause"
  >("break");
  const [pendingWorkPauseSec, setPendingWorkPauseSec] = useState<number>(0);
  const [pendingWorkPauseStartIso, setPendingWorkPauseStartIso] = useState<
    string | null
  >(null);

  // Çalışma Konusu (Subject / Task)
  const [currentWorkTag, setCurrentWorkTag] = useState<string>("Ders");
  const [currentWorkReason, setCurrentWorkReason] = useState<string>("");
  const [showWorkTopicBox, setShowWorkTopicBox] = useState(false);
  const [workTopicReasonText, setWorkTopicReasonText] = useState("");
  const [workPrevReasons, setWorkPrevReasons] = useState<string[]>([]);
  const [isEditingWorkTags, setIsEditingWorkTags] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);

  // Dikkat Dağılma Ek Süresi (Dakika) ve Seans İçi Dağılma Sayacı
  const [distractPenaltyMins, setDistractPenaltyMins] = useState(1);
  const [currentSessionDistractions, setCurrentSessionDistractions] =
    useState(0);

  // Dikkatim Dağıldı Kutusu & Açık Sekme Yakalama
  const [showDistractBox, setShowDistractBox] = useState(false);
  const [distractModalHeight, setDistractModalHeight] = useState<number>(274);
  const [detectedActiveApp, setDetectedActiveApp] = useState<{
    appName: string;
    windowTitle: string;
  }>({ appName: "", windowTitle: "" });

  // Aktif Meşguliyet (Context) & Kısa Mola Notu
  const [currentContext, setCurrentContext] = useState<string>("");
  const [activeContextLogId, setActiveContextLogId] = useState<number | null>(
    null,
  );
  const [contextStartedAtElapsedSec, setContextStartedAtElapsedSec] =
    useState<number>(0);
  const [recentContexts, setRecentContexts] = useState<string[]>([]);

  const [showShortBreakPrompt, setShowShortBreakPrompt] =
    useState<boolean>(false);
  const [showContextEditBox, setShowContextEditBox] = useState<boolean>(false);
  const [shortBreakDraft, setShortBreakDraft] = useState<string>("");

  const [reminderBanner, setReminderBanner] = useState<{
    kind?: "context" | "short_break" | "milestone";
    text: string;
  } | null>(null);

  const [isHyperfocus, setIsHyperfocus] = useState<boolean>(false);
  const [hyperfocusExtraSec, setHyperfocusExtraSec] = useState<number>(0);
  const [recentCompletedRound, setRecentCompletedRound] = useState<{
    sessionId: number | null;
    elapsedSec: number;
    hyperfocusSec: number;
    tag: string;
    reason: string;
    startedAt: string;
    startMood: MoodType | null;
    prevCompletedWorkCount: number;
    moodLogged: boolean;
  } | null>(null);
  const [showStuckRescueBox, setShowStuckRescueBox] = useState<boolean>(false);
  const [selectedSummaryDate, setSelectedSummaryDate] = useState<string>(() =>
    toLocalDateStr(),
  );
  const {
    selectedStartMood,
    setSelectedStartMood,
    sessionStartMood,
    setSessionStartMood,
    todayBioLogs,
    setTodayBioLogs,
    summaryBioLogs,
    setSummaryBioLogs,
    hydrateTodayBioLogs,
    handleAddBioLog,
    handleDeleteBioLog,
  } = useBioAndMood({ page, selectedSummaryDate });
  const [milestonePulse, setMilestonePulse] = useState<boolean>(false);
  const firedMilestonesRef = useRef<{
    warmupDone: boolean;
    halfway: boolean;
    finalStretch: boolean;
  }>({ warmupDone: false, halfway: false, finalStretch: false });
  const [isModeSwitching, setIsModeSwitching] = useState(false);

  const {
    feedbacks,
    feedbackCat,
    setFeedbackCat,
    feedbackText,
    setFeedbackText,
    feedbackCopied,
    hydrateFeedbacks,
    handleAddFeedbackItem,
    handleDeleteFeedbackItem,
    handleCopyAllFeedbacks,
    handleOpenGithubFeedback,
  } = useFeedback();

  // Erken Durdurma Kutusu
  const [showStopBox, setShowStopBox] = useState(false);
  const [endingPreviousReasons, setEndingPreviousReasons] = useState<string[]>(
    [],
  );
  const [endingReasonText, setEndingReasonText] = useState("");
  const [isEditingEndingTags, setIsEditingEndingTags] = useState(false);

  // Zaman Damgası Referansları (24s Çizelge & Eski Seans Koruması için)
  const workStartedAtRef = useRef<string | null>(null);
  const breakStartedAtRef = useRef<string | null>(null);
  const lastActiveAtRef = useRef<number | null>(null);
  const lastAlarmPlayRef = useRef<number>(0);
  const currentLocalDateRef = useRef<string>(toLocalDateStr());
  const completingWorkRoundRef = useRef<boolean>(false);
  const pendingRoundRecordRef = useRef<Promise<number | null> | null>(null);
  const recentCompletedRoundRef = useRef<typeof recentCompletedRound>(null);
  recentCompletedRoundRef.current = recentCompletedRound;
  const isSubmittingSessionRef = useRef<boolean>(false);
  const autoClosingStaleRef = useRef<boolean>(false);
  const autoCloseStaleSessionRef = useRef<
    (effectiveEndMs: number) => Promise<void>
  >(async () => {});

  const lastTickRef = useRef<number>(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);

  // Güncel anlık durum referansları (interval ve yedekleme için güvenli okuma)
  const appStateRef = useRef<AppState>({
    page: "menu",
    work_seconds_left: DEFAULT_WORK_SEC,
    work_elapsed_sec: 0,
    break_seconds_left: DEFAULT_BREAK_SEC,
  });
  appStateRef.current = {
    page: page as PageType,
    work_seconds_left: workSecondsLeft,
    work_elapsed_sec: workElapsedSec,
    break_seconds_left: breakSecondsLeft,
  };

  const runtimeStateRef = useRef<RuntimeState>({
    sessionActive: false,
    mode: "work",
    breakKind: "standard",
    breakTotalSec: DEFAULT_BREAK_SEC,
    breakElapsedSec: 0,
    breakOverdueSec: 0,
    breakOvertimeAccumSec: 0,
    savedWorkSecondsLeft: DEFAULT_WORK_SEC,
    savedWorkElapsedSec: 0,
    workStartedAt: null,
    breakStartedAt: null,
    workTag: "",
    workReason: "",
    sessionDistractions: 0,
    currentContext: "",
    activeContextLogId: null,
    contextStartedAtElapsedSec: 0,
    workPauseStartedAt: null,
    isHyperfocus: false,
    hyperfocusExtraSec: 0,
    sessionStartMood: null,
    sessionGroupId: null,
    lastActiveAt: null,
  });
  runtimeStateRef.current = {
    sessionActive,
    mode: timerMode,
    breakKind,
    breakTotalSec,
    breakElapsedSec,
    breakOverdueSec,
    breakOvertimeAccumSec,
    savedWorkSecondsLeft,
    savedWorkElapsedSec,
    workStartedAt: workStartedAtRef.current,
    breakStartedAt: breakStartedAtRef.current,
    workTag: currentWorkTag,
    workReason: currentWorkReason,
    sessionDistractions: currentSessionDistractions,
    currentContext,
    activeContextLogId,
    contextStartedAtElapsedSec,
    workPauseStartedAt: workPauseStartedAtMs,
    isHyperfocus,
    hyperfocusExtraSec,
    sessionStartMood,
    sessionGroupId,
    lastActiveAt: lastActiveAtRef.current,
  };

  const distractPenaltyRef = useRef<number>(distractPenaltyMins);
  distractPenaltyRef.current = distractPenaltyMins;
  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;
  const isRunningRef = useRef<boolean>(false);
  isRunningRef.current = isRunning;

  const refreshPendingSyncCountRef = useRef<() => Promise<void>>(
    async () => {},
  );

  const {
    dayStats,
    setDayStats,
    weeklySummary,
    setWeeklySummary,
    summaryTab,
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
    handleToggleParkingTask,
    handleRateParkingIdea,
    handleDeleteParkingEntry,
    handleChangeParkingBucket,
    handleDeleteWorkStoryItem,
    handleExportData,
    toggleAccordionTag,
  } = useSummaryAndParking({
    page,
    setPage,
    activeLang,
    t,
    selectedSummaryDate,
    setSelectedSummaryDate,
    setSummaryBioLogs,
    setIsCelebrating,
    setPlanDropdownOpen,
    refreshPendingSyncCount: () => refreshPendingSyncCountRef.current(),
  });

  const {
    studyPlans,
    setStudyPlans,
    activePlanId,
    setActivePlanId,
    editingPlanId,
    setEditingPlanId,
    currentPlan,
    currentPlanWorkMinsRef,
    getPlanDisplayName,
    theme,
    setTheme,
    ambientNoise,
    setAmbientNoise,
    rescueExercises,
    setRescueExercises,
    breakChecklistItems,
    setBreakChecklistItems,
    shortcuts,
    setShortcuts,
    shortcutStatus,
    setShortcutStatus,
    recordingShortcutFor,
    setRecordingShortcutFor,
    autoStartOn,
    setAutoStartOn,
    appVersion,
    setAppVersion,
    updateStatus,
    tagForm,
    setTagForm,
    workTags,
    setWorkTags,
    selectedWorkTopicTag,
    setSelectedWorkTopicTag,
    endingTags,
    setEndingTags,
    selectedEndingTag,
    setSelectedEndingTag,
    breakOverdueTags,
    setBreakOverdueTags,
    selectedBreakOverdueTag,
    setSelectedBreakOverdueTag,
    handleSelectPlan,
    handleUpdatePlanField,
    handleResetPlansDefault,
    updateTheme,
    handleUpdateAmbientNoise,
    handleUpdateRescueExercises,
    handleUpdateBreakChecklistItems,
    handleApplyShortcuts,
    handleResetShortcuts,
    openQuickCaptureFromUi,
    toggleAutoStart,
    handleCheckUpdate,
    handleInstallUpdate,
    handleAddNewTag,
    handleEditTagItem,
    handleDeleteTagItem,
    submitTagForm,
    handleTagsChangedFromSettings,
    refreshTagsForTranslations,
  } = useAppSettingsAndTags({
    loaded,
    t,
    sessionActive,
    timerMode,
    isRunning,
    workElapsedSec,
    currentWorkTag,
    setCurrentWorkTag,
    setPlanDropdownOpen,
    setWorkSecondsLeft,
    setBreakTotalSec,
    setBreakSecondsLeft,
    setIsRunning,
    onSaveBeforeUpdate: async () => {
      await saveAppState(appStateRef.current).catch(() => {});
      await saveRuntimeState(runtimeStateRef.current).catch(() => {});
    },
  });

  const {
    isMiniDock,
    isMiniDockRef,
    miniDockUserDraggedRef,
    miniDockContextToast,
    triggerMiniDockContextToast,
    enterMiniDock,
    exitMiniDock,
    revealExpandedWindowRef,
  } = useMiniDock({
    loaded,
    uiScale: theme.uiScale,
    reminderBanner,
    runtimeStateRef,
    contextFallbackLabel: t.qcContextNone,
    onRevealTimerPage: () => setPage("timer"),
  });

  const {
    cloudAuth,
    cloudEmailInput,
    setCloudEmailInput,
    cloudNameInput,
    setCloudNameInput,
    cloudTokenInput,
    setCloudTokenInput,
    cloudServerInput,
    setCloudServerInput,
    pendingSyncCount,
    isOnline,
    syncStatusMsg,
    isSyncingCloud,
    hydrateCloudSync,
    refreshPendingSyncCount,
    triggerBackgroundCloudSync,
    handleGoogleSignIn,
    handleGoogleSignOut,
    handleSaveCloudToken,
    handleManualCloudSync,
  } = useCloudSync({
    loaded,
    syncRunningLabel: t.syncRunning,
    freqOnlyTodayRef,
    onSyncedRefresh: (pData, bData, wStory) => {
      setSummaryParkingData(pData);
      setBreakParkingData(bData);
      setWorkStoryEntries(wStory);
    },
  });
  refreshPendingSyncCountRef.current = refreshPendingSyncCount;

  const startupInitRef = useRef<boolean>(false);

  useEffect(() => {
    if (startupInitRef.current) return;
    startupInitRef.current = true;
    (async () => {
      try {
        const saved = await loadAppState();
        const savedRuntime = await loadRuntimeState();
        const savedLang = await loadLanguagePreference();
        const active = resolveLanguage(savedLang);
        const currentT = translations[active];

        const locale = active === "tr" ? "tr-TR" : "en-US";
        const stats = await getActiveDayStats(locale);
        const weekly = await getWeeklySummary(locale);
        const penalty = await loadDistractPenalty();
        const savedTheme = await loadThemeSettings();

        setLangPref(savedLang);
        setDayStats(stats);
        setWeeklySummary(weekly);
        setDistractPenaltyMins(penalty);
        setTheme(savedTheme);

        // Tag listelerini yükle
        const eTags = await getTags("ending", currentT.defaultEndingTags);
        const wTags = await getTags("work", currentT.defaultWorkTags);
        const boTags = await getTags(
          "break_overtime",
          currentT.defaultBreakOvertimeTags,
        );
        setEndingTags(eTags);
        setWorkTags(wTags);
        setBreakOverdueTags(boTags);

        const defaultWorkTag =
          wTags[0]?.name || currentT.defaultWorkTags[0] || "Ders";
        setCurrentWorkTag(defaultWorkTag);
        setSelectedWorkTopicTag(defaultWorkTag);
        if (boTags.length > 0) setSelectedBreakOverdueTag(boTags[0].name);

        await getCurrentWindow().setAlwaysOnTop(true).catch(() => {});

        const loadedPlans = await loadStudyPlans();
        const loadedPlanId = await loadActivePlanId();
        const loadedCycles = await loadSessionCycleStats();
        setStudyPlans(loadedPlans);
        const validPlan =
          loadedPlans.find((p) => p.id === loadedPlanId) ||
          loadedPlans[0] ||
          DEFAULT_STUDY_PLANS[0];
        setActivePlanId(validPlan.id);
        setEditingPlanId(validPlan.id);
        setCompletedWorkCount(loadedCycles.completedWorkCount);
        setSessionShortBreakCount(loadedCycles.shortBreakCount);

        // Çalışma zamanı ve sayfa durumunu geri yükle (eski sürümden geçiş dahil)
        if (savedRuntime) {
          const parseIsoMs = (iso: string | null | undefined) => {
            if (!iso) return null;
            const ms = new Date(iso).getTime();
            return Number.isFinite(ms) ? ms : null;
          };
          const lastAliveMs =
            savedRuntime.lastActiveAt ??
            savedRuntime.workPauseStartedAt ??
            (savedRuntime.mode === "break"
              ? parseIsoMs(savedRuntime.breakStartedAt)
              : parseIsoMs(savedRuntime.workStartedAt));
          const nowMs = Date.now();
          const isFromPreviousDay =
            lastAliveMs !== null &&
            toLocalDateStr(new Date(lastAliveMs)) !== toLocalDateStr();
          const isTimedOut =
            lastAliveMs !== null &&
            nowMs - lastAliveMs >= STALE_SESSION_TIMEOUT_MS;

          if (savedRuntime.sessionActive && (isFromPreviousDay || isTimedOut)) {
            const safeEndMs = Math.min(nowMs, lastAliveMs ?? nowMs);
            const endIso = new Date(safeEndMs).toISOString();
            if (savedRuntime.mode === "work") {
              if (savedRuntime.activeContextLogId) {
                await finalizeContextLog(
                  savedRuntime.activeContextLogId,
                  Math.max(
                    0,
                    saved.work_elapsed_sec -
                      savedRuntime.contextStartedAtElapsedSec,
                  ),
                ).catch(() => {});
              }
              if (saved.work_elapsed_sec >= 15) {
                const startIso = new Date(
                  safeEndMs - saved.work_elapsed_sec * 1000,
                ).toISOString();
                await recordWorkSession(
                  saved.work_elapsed_sec,
                  savedRuntime.workTag,
                  savedRuntime.workReason,
                  startIso,
                  endIso,
                  undefined,
                  undefined,
                  savedRuntime.hyperfocusExtraSec || 0,
                  savedRuntime.sessionStartMood ?? null,
                  null,
                  null,
                  0,
                  false,
                  savedRuntime.sessionGroupId ?? null,
                ).catch(() => {});
              }
            } else if (savedRuntime.mode === "break") {
              if (
                savedRuntime.breakKind === "short" &&
                savedRuntime.savedWorkElapsedSec >= 15
              ) {
                const bStartMs = parseIsoMs(savedRuntime.breakStartedAt);
                const wEndMs =
                  bStartMs !== null ? Math.min(safeEndMs, bStartMs) : safeEndMs;
                const wEndIso = new Date(wEndMs).toISOString();
                const wStartIso = new Date(
                  wEndMs - savedRuntime.savedWorkElapsedSec * 1000,
                ).toISOString();
                await recordWorkSession(
                  savedRuntime.savedWorkElapsedSec,
                  savedRuntime.workTag,
                  savedRuntime.workReason,
                  wStartIso,
                  wEndIso,
                  undefined,
                  undefined,
                  savedRuntime.hyperfocusExtraSec || 0,
                  savedRuntime.sessionStartMood ?? null,
                  null,
                  null,
                  0,
                  false,
                  savedRuntime.sessionGroupId ?? null,
                ).catch(() => {});
              }
              const plannedBreakDone = Math.min(
                savedRuntime.breakElapsedSec,
                savedRuntime.breakTotalSec,
              );
              if (plannedBreakDone >= 10) {
                const defaultBreakTag =
                  savedRuntime.breakKind === "short"
                    ? currentT.breakModeShortLabel
                    : savedRuntime.breakKind === "long"
                      ? currentT.breakModeLongLabel
                      : currentT.breakModeStdLabel;
                const bStartMs =
                  parseIsoMs(savedRuntime.breakStartedAt) ??
                  safeEndMs - plannedBreakDone * 1000;
                const bEndMs = Math.min(
                  safeEndMs,
                  bStartMs + plannedBreakDone * 1000,
                );
                await recordBreakSession(
                  plannedBreakDone,
                  defaultBreakTag,
                  undefined,
                  0,
                  new Date(bEndMs - plannedBreakDone * 1000).toISOString(),
                  new Date(bEndMs).toISOString(),
                  savedRuntime.sessionGroupId ?? null,
                ).catch(() => {});
              }
            }

            const wSec = validPlan.workMins * 60;
            const stdBreakSec = validPlan.standardBreakMins * 60;
            const cleanAppState: AppState = {
              page: "menu",
              work_seconds_left: wSec,
              work_elapsed_sec: 0,
              break_seconds_left: stdBreakSec,
            };
            const cleanRuntime: RuntimeState = {
              sessionActive: false,
              mode: "work",
              breakKind: "standard",
              breakTotalSec: stdBreakSec,
              breakElapsedSec: 0,
              breakOverdueSec: 0,
              breakOvertimeAccumSec: 0,
              savedWorkSecondsLeft: wSec,
              savedWorkElapsedSec: 0,
              workStartedAt: null,
              breakStartedAt: null,
              workTag: savedRuntime.workTag || defaultWorkTag,
              workReason: "",
              sessionDistractions: 0,
              currentContext: "",
              activeContextLogId: null,
              contextStartedAtElapsedSec: 0,
              workPauseStartedAt: null,
              isHyperfocus: false,
              hyperfocusExtraSec: 0,
              sessionStartMood: null,
              sessionGroupId: null,
              lastActiveAt: null,
            };
            await saveAppState(cleanAppState).catch(() => {});
            await saveRuntimeState(cleanRuntime).catch(() => {});
            await saveSessionCycleStats(0, 0).catch(() => {});

            workStartedAtRef.current = null;
            breakStartedAtRef.current = null;
            lastActiveAtRef.current = null;
            sessionGroupIdRef.current = null;
            setSessionGroupId(null);
            setCompletedWorkCount(0);
            setSessionShortBreakCount(0);
            setSessionActive(false);
            setIsRunning(false);
            setTimerMode("work");
            setBreakKind("standard");
            setBreakTotalSec(stdBreakSec);
            setBreakSecondsLeft(stdBreakSec);
            setBreakElapsedSec(0);
            setBreakOverdueSec(0);
            setBreakOvertimeAccumSec(0);
            setSavedWorkSecondsLeft(wSec);
            setSavedWorkElapsedSec(0);
            setWorkSecondsLeft(wSec);
            setWorkElapsedSec(0);
            setCurrentWorkReason("");
            setCurrentSessionDistractions(0);
            setCurrentContext("");
            setActiveContextLogId(null);
            setContextStartedAtElapsedSec(0);
            setIsHyperfocus(false);
            setHyperfocusExtraSec(0);
            setSessionStartMood(null);
            setWorkPauseStartedAtMs(null);
            setDayStats(await getActiveDayStats(locale));
            setWeeklySummary(await getWeeklySummary(locale));
            setPage("menu");
          } else {
            setSessionActive(savedRuntime.sessionActive);
            setTimerMode(savedRuntime.mode);
            setBreakKind(savedRuntime.breakKind);
            setBreakTotalSec(savedRuntime.breakTotalSec);
            setBreakElapsedSec(savedRuntime.breakElapsedSec);
            setBreakOverdueSec(savedRuntime.breakOverdueSec);
            setBreakOvertimeAccumSec(savedRuntime.breakOvertimeAccumSec);
            setSavedWorkSecondsLeft(savedRuntime.savedWorkSecondsLeft);
            setSavedWorkElapsedSec(savedRuntime.savedWorkElapsedSec);
            workStartedAtRef.current = savedRuntime.workStartedAt;
            breakStartedAtRef.current = savedRuntime.breakStartedAt;
            if (savedRuntime.workTag) {
              setCurrentWorkTag(savedRuntime.workTag);
              setSelectedWorkTopicTag(savedRuntime.workTag);
            }
            setCurrentWorkReason(savedRuntime.workReason);
            setCurrentSessionDistractions(savedRuntime.sessionDistractions);
            setCurrentContext(
              savedRuntime.currentContext || savedRuntime.shortBreakNote || "",
            );
            setActiveContextLogId(savedRuntime.activeContextLogId ?? null);
            setContextStartedAtElapsedSec(
              savedRuntime.contextStartedAtElapsedSec || 0,
            );
            setIsHyperfocus(Boolean(savedRuntime.isHyperfocus));
            setHyperfocusExtraSec(savedRuntime.hyperfocusExtraSec || 0);
            setSessionStartMood(savedRuntime.sessionStartMood ?? null);
            const loadedGroupId = savedRuntime.sessionGroupId ?? null;
            sessionGroupIdRef.current = loadedGroupId;
            setSessionGroupId(loadedGroupId);

            if (savedRuntime.sessionActive) {
              lastActiveAtRef.current = savedRuntime.lastActiveAt ?? Date.now();
              setWorkSecondsLeft(
                saved.work_seconds_left || validPlan.workMins * 60,
              );
              setWorkElapsedSec(saved.work_elapsed_sec);
              setBreakSecondsLeft(saved.break_seconds_left);
              // PC yeniden başlatıldı / uyandıysa kullanıcı devam ettirene kadar duraklatılmış başla
              setIsRunning(false);
              if (
                savedRuntime.mode === "work" &&
                savedRuntime.workPauseStartedAt &&
                Date.now() - savedRuntime.workPauseStartedAt <
                  STALE_SESSION_TIMEOUT_MS
              ) {
                setWorkPauseStartedAtMs(savedRuntime.workPauseStartedAt);
              }
              setPage("timer");
            } else {
              lastActiveAtRef.current = null;
              setWorkSecondsLeft(validPlan.workMins * 60);
              setWorkElapsedSec(0);
              setBreakSecondsLeft(validPlan.standardBreakMins * 60);
              setBreakTotalSec(validPlan.standardBreakMins * 60);
              setPage(
                saved.page === "summary" || saved.page === "settings"
                  ? saved.page
                  : "menu",
              );
            }
          }
        } else {
          // v0.1.9 veya öncesinden yükseltme: yarım kalmış bir çalışma/mola varsa duraklatılmış koru
          const hadInProgressSession =
            saved.work_elapsed_sec > 0 || saved.page === "break";
          if (hadInProgressSession) {
            setSessionActive(true);
            setIsRunning(false);
            setTimerMode(saved.page === "break" ? "break" : "work");
            setWorkSecondsLeft(saved.work_seconds_left);
            setWorkElapsedSec(saved.work_elapsed_sec);
            setBreakSecondsLeft(saved.break_seconds_left);
            setBreakTotalSec(
              Math.max(
                saved.break_seconds_left,
                validPlan.standardBreakMins * 60,
              ),
            );
            setPage("timer");
          } else {
            setSessionActive(false);
            setTimerMode("work");
            setWorkSecondsLeft(validPlan.workMins * 60);
            setWorkElapsedSec(0);
            setBreakSecondsLeft(validPlan.standardBreakMins * 60);
            setBreakTotalSec(validPlan.standardBreakMins * 60);
            setPage("menu");
          }
        }

        const timeline = await getTimelineSessions();
        setTimelineSessions(timeline);

        const loadedSizes = await loadCustomWindowSizes();
        setCustomSizes(loadedSizes);
        await hydrateFeedbacks();

        const loadedShortcuts = await loadGlobalShortcuts();
        setShortcuts(loadedShortcuts);
        invoke<ShortcutStatus>("update_global_shortcuts", {
          distractionShortcut: loadedShortcuts.distractionShortcut,
          contextShortcut: loadedShortcuts.contextShortcut,
        })
          .then(setShortcutStatus)
          .catch(() => {});

        setBreakParkingData(await getBreakParkingLotData());
        await hydrateTodayBioLogs();
        setAmbientNoise(await loadAmbientNoiseSettings());
        setRescueExercises(await loadRescueExerciseSettings());
        setBreakChecklistItems(
          await loadBreakChecklistItems(currentT.defaultBreakChecklist),
        );
        setRecentContexts(await getRecentContexts(6));
        setWorkStoryEntries(await getWorkStoryEntries(false, 80));
        invoke<string>("get_backup_export_dir")
          .then(setExportDirPath)
          .catch(() => {});

        await hydrateCloudSync();

        await getCurrentWindow().setResizable(true).catch(() => {});
      } catch (err) {
        console.error("Veritabanı yüklenemedi:", err);
        setLoadError(String(err));
      }

      getVersion()
        .then(setAppVersion)
        .catch(() => {});

      try {
        if (!import.meta.env.DEV) {
          const firstRunDone = localStorage.getItem("autostart_initialized");
          if (!firstRunDone) {
            await enable();
            localStorage.setItem("autostart_initialized", "1");
          } else if (await isEnabled()) {
            await enable();
          }
        }
        setAutoStartOn(await isEnabled());
      } catch (err) {
        console.error("Otomatik başlatma ayarlanamadı:", err);
      }

      const startWin = getCurrentWindow();
      await startWin.show().catch(() => {});
      await startWin.unminimize().catch(() => {});
      setLoaded(true);
    })();
  }, []);

  const anyModalOpen =
    showStopBox ||
    showDistractBox ||
    showBreakOverdueBox ||
    showWorkTopicBox ||
    showShortBreakPrompt ||
    showContextEditBox ||
    showStuckRescueBox;

  const warmupTotalSec = getWarmupDurationSec(currentPlan.workMins);
  const finalStretchSec = getFinalStretchSec(currentPlan.workMins);
  const warmupLeftSec =
    warmupTotalSec > 0 && !isHyperfocus && workElapsedSec < warmupTotalSec
      ? warmupTotalSec - workElapsedSec
      : 0;
  const workPhase: WorkPhase = isHyperfocus
    ? "hyperfocus"
    : warmupLeftSec > 0
      ? "warmup"
      : workSecondsLeft > 0 && workSecondsLeft <= finalStretchSec
        ? "final"
        : "focus";
  const showStuckBtn =
    sessionActive &&
    timerMode === "work" &&
    (workElapsedSec <= Math.max(warmupTotalSec, 180) ||
      currentSessionDistractions >= 1);

  const hyperfocusOfferLeftSec =
    sessionActive &&
    timerMode === "break" &&
    breakKind !== "short" &&
    recentCompletedRound &&
    breakElapsedSec < 15
      ? Math.max(0, 15 - breakElapsedSec)
      : 0;

  const hasHyperfocusOffer = hyperfocusOfferLeftSec > 0;
  const canShowBreakEndMood = Boolean(
    sessionActive &&
    timerMode === "break" &&
    recentCompletedRound?.sessionId &&
    !recentCompletedRound.moodLogged,
  );
  const hasWorkElapsed = workElapsedSec > 0;
  const hasWorkPauseStart = workPauseStartedAtMs !== null;
  const hasReminderBanner = reminderBanner?.kind === "milestone";
  const isBreakAlarm =
    sessionActive && timerMode === "break" && breakOverdueSec > 0;

  const {
    setCustomSizes,
    currentWinSize,
    setCurrentWinSize,
    sizeSavedFlash,
    handleSaveCurrentWindowSize,
    handleResetStandardSizes,
  } = useWindowSizing({
    loaded,
    isMiniDock,
    page,
    theme,
    anyModalOpen,
    showDistractBox,
    distractModalHeight,
    showStuckRescueBox,
    showShortBreakPrompt,
    showContextEditBox,
    showWorkTopicBox,
    isEditingWorkTags,
    hasTagForm: Boolean(tagForm),
    workPrevReasonsCount: workPrevReasons.length,
    currentContext,
    recentContextsCount: recentContexts.length,
    updateStatusKind: updateStatus.kind,
    sessionActive,
    isRunning,
    hasWorkElapsed,
    hasWorkPauseStart,
    hasReminderBanner,
    hasHyperfocusOffer,
    canShowBreakEndMood,
    isBreakAlarm,
    isHyperfocus,
    timerMode,
    showBreakParking,
    breakParkingLayout,
    breakParkingData,
    breakChecklistCount: breakChecklistItems.length,
  });

  useSystemWatchers({
    loaded,
    sessionActive,
    isRunning,
    timerMode,
    workSecondsLeft,
    breakSecondsLeft,
    workElapsedSec,
    currentContext,
    currentWorkTag,
    currentWorkReason,
    distractPenaltyMins,
    activeLang,
    bgColor: theme.bgColor,
    uiScale: theme.uiScale,
    recentContexts,
    isMiniDock,
    qcContextNoneLabel: t.qcContextNone,
    runtimeStateRef,
    isRunningRef,
    lastTickRef,
    lastActiveAtRef,
    workPauseStartedAtRef,
    freqOnlyTodayRef,
    autoCloseStaleSessionRef,
    revealExpandedWindowRef,
    enterMiniDock,
    exitMiniDock,
    setIsRunning,
    setWorkPauseStartedAtMs,
    setCurrentWinSize,
    setWorkStoryEntries,
    triggerBackgroundCloudSync,
  });

  useTimerLoop({
    loaded,
    sessionActive,
    isRunning,
    timerMode,
    isHyperfocus,
    workElapsedSec,
    workSecondsLeft,
    workPlanMins: currentPlan.workMins,
    workPauseStartedAtMs,
    showBreakOverdueBox,
    milestonePulse,
    t,
    lastTickRef,
    lastActiveAtRef,
    lastAlarmPlayRef,
    workPauseStartedAtRef,
    isRunningRef,
    isMiniDockRef,
    appStateRef,
    runtimeStateRef,
    autoCloseStaleSessionRef,
    revealExpandedWindowRef,
    firedMilestonesRef,
    setWorkSecondsLeft,
    setWorkElapsedSec,
    setBreakSecondsLeft,
    setBreakElapsedSec,
    setBreakOverdueSec,
    setIsRunning,
    setWorkPauseStartedAtMs,
    setWorkPausedLiveSec,
    setMilestonePulse,
    setReminderBanner,
    setIsModeSwitching,
    setShowBreakParking,
    setBreakParkingData,
    triggerMiniDockContextToast,
  });

  // Sayaç ekranı hatırlatıcı şeridini 14 saniye sonra otomatik temizle
  useEffect(() => {
    if (!reminderBanner) return;
    const tmr = setTimeout(() => {
      setReminderBanner(null);
    }, 14000);
    return () => clearTimeout(tmr);
  }, [reminderBanner]);

  // Seans aktif değilken sayaç ekranında kalınmasını ve sayacın çalışmasını engelle
  useEffect(() => {
    if (!loaded) return;
    if (!sessionActive) {
      if (isRunning) setIsRunning(false);
      if (page === "timer") setPage("menu");
    }
  }, [loaded, sessionActive, isRunning, page]);

  // Plan dropdown dışına tıklanınca veya Escape'e basılınca kapat
  useEffect(() => {
    if (!planDropdownOpen) return;
    const onDocDown = (ev: MouseEvent) => {
      if (
        planDropdownRef.current &&
        !planDropdownRef.current.contains(ev.target as Node)
      ) {
        setPlanDropdownOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setPlanDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [planDropdownOpen]);

  // Durum kaydı (duraklatıldığında ve kritik değişikliklerde anında kaydet)
  useEffect(() => {
    if (!loaded || isRunning) return;
    persistSnapshots(appStateRef.current, runtimeStateRef.current);
  }, [
    loaded,
    isRunning,
    page,
    sessionActive,
    timerMode,
    breakKind,
    workSecondsLeft,
    workElapsedSec,
    breakSecondsLeft,
    breakElapsedSec,
    breakOverdueSec,
    breakOvertimeAccumSec,
    currentWorkTag,
    currentWorkReason,
    currentSessionDistractions,
    currentContext,
    activeContextLogId,
    contextStartedAtElapsedSec,
    workPauseStartedAtMs,
  ]);

  // Sayaç çalışırken 5 saniyede bir yedekle
  useEffect(() => {
    if (!loaded || !isRunning) return;
    persistSnapshots(appStateRef.current, runtimeStateRef.current);
    const backup = setInterval(
      () => persistSnapshots(appStateRef.current, runtimeStateRef.current),
      5000,
    );
    return () => clearInterval(backup);
  }, [loaded, isRunning]);

  // Çalışma süresi 0'a ulaştığında doğrudan molaya geç (ilk 15sn içinde Hiperodak seçeneği ile)
  useEffect(() => {
    if (
      !isRunning ||
      !sessionActive ||
      timerMode !== "work" ||
      workSecondsLeft > 0
    ) {
      if (timerMode !== "work" || workSecondsLeft > 0) {
        completingWorkRoundRef.current = false;
      }
      return;
    }
    if (completingWorkRoundRef.current) return;
    completingWorkRoundRef.current = true;
    lastActiveAtRef.current = Date.now();

    const finishedElapsed = Math.max(1, workElapsedSec);
    const finishedTag = currentWorkTag;
    const finishedReason = currentWorkReason;
    const finishedCtxId = activeContextLogId;
    const finishedCtxDelta = Math.max(
      0,
      finishedElapsed - contextStartedAtElapsedSec,
    );
    const finishedStartedAt =
      workStartedAtRef.current ||
      new Date(Date.now() - finishedElapsed * 1000).toISOString();
    const finishedEndedAt = new Date().toISOString();
    const finishedHyperfocus = hyperfocusExtraSec;
    const finishedStartMood = sessionStartMood;
    const prevCompleted = completedWorkCount;

    setIsCelebrating(true);
    playCelebrationFanfare();

    const nextCompleted = prevCompleted + 1;
    setCompletedWorkCount(nextCompleted);
    saveSessionCycleStats(nextCompleted, sessionShortBreakCount).catch(
      () => {},
    );

    const isLong = nextCompleted % currentPlan.longBreakInterval === 0;
    const bKind: BreakKind = isLong ? "long" : "standard";
    const bMins = isLong
      ? currentPlan.longBreakMins
      : currentPlan.standardBreakMins;
    const bSec = bMins * 60;

    // Bir sonraki çalışma turu için sayacı hazırla
    setWorkSecondsLeft(currentPlan.workMins * 60);
    setWorkElapsedSec(0);
    setCurrentSessionDistractions(0);
    setActiveContextLogId(null);
    setContextStartedAtElapsedSec(0);
    setIsHyperfocus(false);
    setHyperfocusExtraSec(0);
    setSessionStartMood(null);
    firedMilestonesRef.current = {
      warmupDone: false,
      halfway: false,
      finalStretch: false,
    };
    workStartedAtRef.current = null;

    // Otomatik molaya geç ve başlat
    setWorkPauseStartedAtMs(null);
    setWorkPausedLiveSec(0);
    setBreakKind(bKind);
    setTimerMode("break");
    setBreakSecondsLeft(bSec);
    setBreakTotalSec(bSec);
    setBreakElapsedSec(0);
    setBreakOverdueSec(0);
    setBreakOvertimeAccumSec(0);
    setIsRunning(true);
    playBreakChime();
    if (isMiniDockRef.current) {
      triggerMiniDockContextToast(
        isLong ? t.longBreakStartedAlert : t.breakStartedAlert,
      );
      setTimeout(() => {
        invoke("alert_break_started").catch(() => {});
      }, 90);
    } else {
      invoke("alert_break_started").catch(() => {});
    }
    breakStartedAtRef.current = finishedEndedAt;

    const prelimRound = {
      sessionId: null as number | null,
      elapsedSec: finishedElapsed,
      hyperfocusSec: finishedHyperfocus,
      tag: finishedTag,
      reason: finishedReason,
      startedAt: finishedStartedAt,
      startMood: finishedStartMood,
      prevCompletedWorkCount: prevCompleted,
      moodLogged: false,
    };
    recentCompletedRoundRef.current = prelimRound;
    setRecentCompletedRound(prelimRound);

    const recPromise = (async (): Promise<number | null> => {
      if (finishedCtxId) {
        await finalizeContextLog(finishedCtxId, finishedCtxDelta).catch(
          () => {},
        );
      }
      const roundNum =
        (prevCompleted % Math.max(1, currentPlan.longBreakInterval)) + 1;
      const sid = await recordWorkSession(
        finishedElapsed,
        finishedTag,
        finishedReason,
        finishedStartedAt,
        finishedEndedAt,
        undefined,
        undefined,
        finishedHyperfocus,
        finishedStartMood,
        null,
        getPlanDisplayName(currentPlan),
        roundNum,
        true,
        sessionGroupIdRef.current,
      );
      const completedRound = {
        ...prelimRound,
        sessionId: sid,
      };
      if (recentCompletedRoundRef.current?.startedAt === finishedStartedAt) {
        recentCompletedRoundRef.current = completedRound;
      }
      setRecentCompletedRound((prev) =>
        prev && prev.startedAt === finishedStartedAt
          ? { ...prev, sessionId: sid }
          : prev,
      );
      const locale = activeLang === "tr" ? "tr-TR" : "en-US";
      setDayStats(await getActiveDayStats(locale));
      setWeeklySummary(await getWeeklySummary(locale));
      setTimelineSessions(await getTimelineSessions());
      setBreakParkingData(await getBreakParkingLotData());
      return sid;
    })().finally(() => {
      if (pendingRoundRecordRef.current === recPromise) {
        pendingRoundRecordRef.current = null;
      }
    });
    pendingRoundRecordRef.current = recPromise;
  }, [
    isRunning,
    sessionActive,
    timerMode,
    workSecondsLeft,
    workElapsedSec,
    activeLang,
    currentWorkTag,
    currentWorkReason,
    completedWorkCount,
    sessionShortBreakCount,
    currentPlan,
    activeContextLogId,
    contextStartedAtElapsedSec,
    hyperfocusExtraSec,
    sessionStartMood,
    t,
  ]);

  const handleExtendHyperfocusFromBreak = async (extraMins: number) => {
    if (isSubmittingSessionRef.current) return;
    isSubmittingSessionRef.current = true;
    try {
      let awaitedSid: number | null = null;
      if (pendingRoundRecordRef.current) {
        awaitedSid = await pendingRoundRecordRef.current.catch(() => null);
      }
      const recent = recentCompletedRoundRef.current ?? recentCompletedRound;
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);
      setIsCelebrating(false);

      const sidToDelete = recent?.sessionId ?? awaitedSid;
      if (sidToDelete) {
        await deleteWorkSessionById(sidToDelete).catch(() => {});
      }

      if (recent) {
        setCompletedWorkCount(recent.prevCompletedWorkCount);
        saveSessionCycleStats(
          recent.prevCompletedWorkCount,
          sessionShortBreakCount,
        ).catch(() => {});
        setWorkElapsedSec(recent.elapsedSec);
        workStartedAtRef.current = recent.startedAt;
        setSessionStartMood(recent.startMood);
        setHyperfocusExtraSec(recent.hyperfocusSec + extraMins * 60);
        setContextStartedAtElapsedSec(recent.elapsedSec);
      } else {
        setHyperfocusExtraSec((prev) => prev + extraMins * 60);
      }

      if (currentContext.trim()) {
        const cId = await startContextLog({
          contextText: currentContext.trim(),
          workTag: currentWorkTag,
        });
        setActiveContextLogId(cId);
      }

      setIsHyperfocus(true);
      setTimerMode("work");
      setWorkSecondsLeft(extraMins * 60);
      setBreakElapsedSec(0);
      setBreakOverdueSec(0);
      setBreakOvertimeAccumSec(0);
      breakStartedAtRef.current = null;
      lastActiveAtRef.current = Date.now();
      setReminderBanner({
        kind: "milestone",
        text: t.hyperfocusActiveBanner(extraMins),
      });
      setPage("timer");
      setIsRunning(true);

      const locale = activeLang === "tr" ? "tr-TR" : "en-US";
      setDayStats(await getActiveDayStats(locale));
      setWeeklySummary(await getWeeklySummary(locale));
      setTimelineSessions(await getTimelineSessions());
    } finally {
      isSubmittingSessionRef.current = false;
    }
  };

  const handleSelectBreakEndMood = async (mood: MoodType) => {
    const recent = recentCompletedRoundRef.current ?? recentCompletedRound;
    if (!recent || !recent.sessionId || recent.moodLogged) return;
    if (recentCompletedRoundRef.current) {
      recentCompletedRoundRef.current = {
        ...recentCompletedRoundRef.current,
        moodLogged: true,
      };
    }
    setRecentCompletedRound((prev) =>
      prev ? { ...prev, moodLogged: true } : null,
    );
    await updateSessionMoodAfter(recent.sessionId, mood);
    await addMoodLog(mood, "end", undefined, recent.sessionId);
    setTimelineSessions(await getTimelineSessions());
  };

  // Kutlama animasyonu ve konfeti en geç 4.2 saniye sonra kesinlikle kapanır
  useEffect(() => {
    if (!isCelebrating) return;
    const timer = setTimeout(() => {
      setIsCelebrating(false);
    }, 4200);
    return () => clearTimeout(timer);
  }, [isCelebrating]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, select, option, .no-drag, .clickable-timer, .bar-col, .accordion-header, .timeline-block",
      )
    ) {
      return;
    }
    if (isMiniDockRef.current) {
      miniDockUserDraggedRef.current = true;
    }
    getCurrentWindow().startDragging();
  };

  const hideToTray = () => {
    getCurrentWindow().hide();
  };

  const getCategoryDisplayName = (
    cat: DistractionCategory,
    lang: "tr" | "en" = activeLang,
  ): string => {
    const trObj = translations[lang];
    switch (cat) {
      case "impulsive_task":
        return trObj.catImpulsiveTask;
      case "idea":
        return trObj.catIdea;
      case "internal":
        return trObj.catInternal;
      case "external":
        return trObj.catExternal;
    }
  };

  // Aktif Meşguliyet (Context) Kaydetme & Süre Muhasebesi
  const applyNewContext = async (
    rawText: string,
    activeApp?: string,
    activeWindow?: string,
  ) => {
    const text = rawText.trim();
    if (!text) return;
    const rt = runtimeStateRef.current;
    const appSt = appStateRef.current;

    if (rt.activeContextLogId && rt.sessionActive && rt.mode === "work") {
      const delta = Math.max(
        0,
        appSt.work_elapsed_sec - rt.contextStartedAtElapsedSec,
      );
      await finalizeContextLog(rt.activeContextLogId, delta);
    }

    setCurrentContext(text);
    const newId = await startContextLog({
      contextText: text,
      workTag: rt.workTag,
      activeApp,
      activeWindow,
    });
    const baseElapsed =
      rt.sessionActive && rt.mode === "work" ? appSt.work_elapsed_sec : 0;
    setActiveContextLogId(newId);
    setContextStartedAtElapsedSec(baseElapsed);
    setRecentContexts(await getRecentContexts(6));
  };

  // Hem Global Spotlight Hem Widget İçi Ortak Dikkat / Görev / Fikir İşleyici
  const processDistractionSubmission = async (params: {
    category: DistractionCategory;
    reasonText: string;
    tag?: string;
    activeApp: string;
    activeWindow: string;
  }) => {
    const rt = runtimeStateRef.current;
    const appSt = appStateRef.current;
    const lang = activeLangRef.current;
    const catLabel = getCategoryDisplayName(params.category, lang);
    const cleanText = params.reasonText.trim() || catLabel;
    const isOffSession = !rt.sessionActive;
    const effectiveCtx = isOffSession
      ? ""
      : rt.currentContext.trim() ||
        (rt.workTag
          ? `${rt.workTag}${rt.workReason ? `: ${rt.workReason}` : ""}`
          : "");

    const warmupSec = getWarmupDurationSec(currentPlanWorkMinsRef.current);
    const isInWarmup =
      rt.sessionActive &&
      rt.mode === "work" &&
      !rt.isHyperfocus &&
      warmupSec > 0 &&
      appSt.work_elapsed_sec < warmupSec;
    const addsPenalty = doesCategoryAddPenalty(params.category);
    const penaltyMins = distractPenaltyRef.current;
    let appliedPenaltySec = 0;

    if (
      addsPenalty &&
      !isInWarmup &&
      rt.sessionActive &&
      rt.mode === "work" &&
      penaltyMins > 0
    ) {
      appliedPenaltySec = penaltyMins * 60;
      setWorkSecondsLeft((prev) => prev + appliedPenaltySec);
    }

    if (addsPenalty && rt.sessionActive) {
      setCurrentSessionDistractions((prev) => prev + 1);
    }

    if (!isOffSession && addsPenalty && rt.activeContextLogId) {
      await incrementContextDistraction(rt.activeContextLogId);
    }

    // 1: Dürtüsel Görev, 2: Akla Gelen Fikir -> Mola Otoparkına ekleme sırasına göre kaydedilir (süre eklenmez!)
    if (
      params.category === "impulsive_task" ||
      params.category === "idea"
    ) {
      await addParkingItem({
        itemType: params.category === "impulsive_task" ? "task" : "idea",
        content: cleanText,
        activeApp: params.activeApp,
        activeWindow: params.activeWindow,
        contextText: effectiveCtx,
      });
      await refreshParkingViews();
    }

    await recordDistraction({
      reason: cleanText,
      tag: params.tag?.trim() || "Tag Yok",
      elapsedWorkSec: rt.sessionActive ? appSt.work_elapsed_sec : 0,
      category: params.category,
      activeApp: params.activeApp,
      activeWindow: params.activeWindow,
      contextText: effectiveCtx,
      penaltySec: appliedPenaltySec,
      isOffSession,
    });

    triggerBackgroundCloudSync();
  };

  const captureHandlerRef = useRef<(ev: CaptureSubmittedEvent) => void>(
    () => {},
  );
  captureHandlerRef.current = (ev: CaptureSubmittedEvent) => {
    if (ev.mode === "context") {
      applyNewContext(ev.text, ev.activeApp, ev.activeWindow).catch((err) =>
        console.error("Meşguliyet kaydedilemedi:", err),
      );
    } else {
      (async () => {
        await processDistractionSubmission({
          category: ev.category || "internal",
          reasonText: ev.text,
          tag: ev.tag,
          activeApp: ev.activeApp,
          activeWindow: ev.activeWindow,
        });
        if (ev.newContext?.trim() && runtimeStateRef.current.sessionActive) {
          await applyNewContext(ev.newContext, ev.activeApp, ev.activeWindow);
        }
      })().catch((err) => console.error("Hızlı yakalama kaydedilemedi:", err));
    }
  };

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let unlistenCapture: (() => void) | null = null;
    listen<CaptureSubmittedEvent>("capture-submitted", (ev) => {
      if (!cancelled) {
        captureHandlerRef.current(ev.payload);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenCapture = fn;
      }
    });
    return () => {
      cancelled = true;
      if (unlistenCapture) unlistenCapture();
    };
  }, [loaded]);

  // ---------------------------------------------------------------------------
  // AÇIK KALAN / GECEYARISI GEÇEN SEANSLARI OTOMATİK KAPATMA
  // ---------------------------------------------------------------------------
  const autoCloseStaleSession = async (effectiveEndMs: number) => {
    if (autoClosingStaleRef.current) return;
    autoClosingStaleRef.current = true;
    try {
      const rt = runtimeStateRef.current;
      const appSt = appStateRef.current;

      setIsRunning(false);
      setIsCelebrating(false);
      setPlanDropdownOpen(false);
      setShowDistractBox(false);
      setShowStopBox(false);
      setShowBreakOverdueBox(false);
      setShowWorkTopicBox(false);
      setShowShortBreakPrompt(false);
      setShowContextEditBox(false);
      setShowStuckRescueBox(false);
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);

      const safeEndMs = Math.min(Date.now(), Math.max(0, effectiveEndMs));
      const endIso = new Date(safeEndMs).toISOString();

      if (rt.mode === "work") {
        if (rt.activeContextLogId) {
          await finalizeContextLog(
            rt.activeContextLogId,
            Math.max(0, appSt.work_elapsed_sec - rt.contextStartedAtElapsedSec),
          ).catch(() => {});
        }
        if (appSt.work_elapsed_sec >= 15) {
          const startIso = new Date(
            safeEndMs - appSt.work_elapsed_sec * 1000,
          ).toISOString();
          await recordWorkSession(
            appSt.work_elapsed_sec,
            rt.workTag,
            rt.workReason,
            startIso,
            endIso,
            undefined,
            undefined,
            rt.hyperfocusExtraSec || 0,
            rt.sessionStartMood ?? null,
            null,
            null,
            0,
            false,
            rt.sessionGroupId ?? null,
          ).catch(() => {});
        }
      } else if (rt.mode === "break") {
        if (rt.breakKind === "short" && rt.savedWorkElapsedSec >= 15) {
          const wEndMs = rt.breakStartedAt
            ? Math.min(safeEndMs, new Date(rt.breakStartedAt).getTime())
            : safeEndMs;
          const wEndIso = new Date(wEndMs).toISOString();
          const wStartIso = new Date(
            wEndMs - rt.savedWorkElapsedSec * 1000,
          ).toISOString();
          await recordWorkSession(
            rt.savedWorkElapsedSec,
            rt.workTag,
            rt.workReason,
            wStartIso,
            wEndIso,
            undefined,
            undefined,
            rt.hyperfocusExtraSec || 0,
            rt.sessionStartMood ?? null,
            null,
            null,
            0,
            false,
            rt.sessionGroupId ?? null,
          ).catch(() => {});
        }
        const plannedBreakDone = Math.min(rt.breakElapsedSec, rt.breakTotalSec);
        if (plannedBreakDone >= 10) {
          const defaultBreakTag =
            rt.breakKind === "short"
              ? t.breakModeShortLabel
              : rt.breakKind === "long"
                ? t.breakModeLongLabel
                : t.breakModeStdLabel;
          const bStartMs = rt.breakStartedAt
            ? new Date(rt.breakStartedAt).getTime()
            : safeEndMs - plannedBreakDone * 1000;
          const bEndMs = Math.min(
            safeEndMs,
            bStartMs + plannedBreakDone * 1000,
          );
          await recordBreakSession(
            plannedBreakDone,
            defaultBreakTag,
            undefined,
            0,
            new Date(bEndMs - plannedBreakDone * 1000).toISOString(),
            new Date(bEndMs).toISOString(),
            rt.sessionGroupId ?? null,
          ).catch(() => {});
        }
      }

      const wSec = currentPlan.workMins * 60;
      const stdBreakSec = currentPlan.standardBreakMins * 60;

      setSessionActive(false);
      sessionGroupIdRef.current = null;
      setSessionGroupId(null);
      setTimerMode("work");
      setWorkSecondsLeft(wSec);
      setWorkElapsedSec(0);
      setSavedWorkSecondsLeft(wSec);
      setSavedWorkElapsedSec(0);
      setBreakKind("standard");
      setBreakTotalSec(stdBreakSec);
      setBreakSecondsLeft(stdBreakSec);
      setBreakElapsedSec(0);
      setBreakOverdueSec(0);
      setBreakOvertimeAccumSec(0);
      setWorkPauseStartedAtMs(null);
      setWorkPausedLiveSec(0);
      setPendingWorkPauseSec(0);
      setPendingWorkPauseStartIso(null);
      setBreakOverdueSource("break");
      setCurrentSessionDistractions(0);
      setCompletedWorkCount(0);
      setSessionShortBreakCount(0);
      setCurrentContext("");
      setActiveContextLogId(null);
      setContextStartedAtElapsedSec(0);
      setReminderBanner(null);
      setIsHyperfocus(false);
      setHyperfocusExtraSec(0);
      setSessionStartMood(null);
      firedMilestonesRef.current = {
        warmupDone: false,
        halfway: false,
        finalStretch: false,
      };
      workStartedAtRef.current = null;
      breakStartedAtRef.current = null;
      lastActiveAtRef.current = null;

      const cleanAppState: AppState = {
        page: "menu",
        work_seconds_left: wSec,
        work_elapsed_sec: 0,
        break_seconds_left: stdBreakSec,
      };
      const cleanRuntimeState: RuntimeState = {
        sessionActive: false,
        mode: "work",
        breakKind: "standard",
        breakTotalSec: stdBreakSec,
        breakElapsedSec: 0,
        breakOverdueSec: 0,
        breakOvertimeAccumSec: 0,
        savedWorkSecondsLeft: wSec,
        savedWorkElapsedSec: 0,
        workStartedAt: null,
        breakStartedAt: null,
        workTag: currentWorkTag,
        workReason: "",
        sessionDistractions: 0,
        currentContext: "",
        activeContextLogId: null,
        contextStartedAtElapsedSec: 0,
        workPauseStartedAt: null,
        isHyperfocus: false,
        hyperfocusExtraSec: 0,
        sessionStartMood: null,
        sessionGroupId: null,
        lastActiveAt: null,
      };
      persistSnapshots(cleanAppState, cleanRuntimeState);
      await saveSessionCycleStats(0, 0).catch(() => {});

      const locale = activeLang === "tr" ? "tr-TR" : "en-US";
      setDayStats(await getActiveDayStats(locale));
      setWeeklySummary(await getWeeklySummary(locale));
      setTimelineSessions(
        await getTimelineSessions(
          undefined,
          getDateBoundsIso(toLocalDateStr()),
        ),
      );
      setBreakParkingData(await getBreakParkingLotData());
      setPage("menu");
    } finally {
      autoClosingStaleRef.current = false;
    }
  };
  autoCloseStaleSessionRef.current = autoCloseStaleSession;

  // Geceyarısı 00:00 geçişini canlı izle: gün dönünce aktif seansı 23:59:59'da kapat ve bugünü yenile
  useEffect(() => {
    if (!loaded) return;
    const tmr = setInterval(() => {
      const today = toLocalDateStr();
      if (today === currentLocalDateRef.current) return;
      currentLocalDateRef.current = today;
      const todayStartMs = parseLocalDateStr(today).getTime();
      const prevDayEndMs = todayStartMs - 1000;
      if (runtimeStateRef.current.sessionActive) {
        void autoCloseStaleSessionRef.current(prevDayEndMs);
      } else {
        const locale = activeLangRef.current === "tr" ? "tr-TR" : "en-US";
        void Promise.all([
          getActiveDayStats(locale).then(setDayStats),
          getWeeklySummary(locale).then(setWeeklySummary),
          getTimelineSessions(undefined, getDateBoundsIso(today)).then(
            setTimelineSessions,
          ),
          hydrateTodayBioLogs(),
        ]).catch(() => {});
        setSelectedSummaryDate(today);
      }
    }, 15_000);
    return () => clearInterval(tmr);
  }, [loaded]);

  // ---------------------------------------------------------------------------
  // SEANS BAŞLATMA & SEANS BİTİRME (SESSION LIFECYCLE)
  // ---------------------------------------------------------------------------
  const flushPendingWorkPauseSilently = async () => {
    const startMs = workPauseStartedAtRef.current;
    if (startMs) {
      const pausedSec = Math.floor((Date.now() - startMs) / 1000);
      if (pausedSec >= 10) {
        await recordBreakSession(
          pausedSec,
          t.workPauseDefaultTag,
          undefined,
          pausedSec,
          new Date(startMs).toISOString(),
          new Date().toISOString(),
          sessionGroupIdRef.current,
        );
      }
    }
    setWorkPauseStartedAtMs(null);
    setWorkPausedLiveSec(0);
    setPendingWorkPauseSec(0);
    setPendingWorkPauseStartIso(null);
    setBreakOverdueSource("break");
  };

  const handleStartSession = async () => {
    setPlanDropdownOpen(false);
    setIsCelebrating(false);
    setRecentCompletedRound(null);
    setShowStuckRescueBox(false);
    setIsHyperfocus(false);
    setHyperfocusExtraSec(0);
    firedMilestonesRef.current = {
      warmupDone: false,
      halfway: false,
      finalStretch: false,
    };

    const startMood = selectedStartMood;
    setSessionStartMood(startMood);
    setSelectedStartMood(null);
    const nextGroupId = `sg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    sessionGroupIdRef.current = nextGroupId;
    setSessionGroupId(nextGroupId);

    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const freshStats = await getActiveDayStats(locale);
    setDayStats(freshStats);
    setTimelineSessions(
      await getTimelineSessions(undefined, getDateBoundsIso(toLocalDateStr())),
    );
    if (startMood) {
      await addMoodLog(startMood, "start").catch(() => {});
    }

    const wSec = currentPlan.workMins * 60;
    const stdBreakSec = currentPlan.standardBreakMins * 60;
    const nowIso = new Date().toISOString();

    setCompletedWorkCount(0);
    setSessionShortBreakCount(0);
    await saveSessionCycleStats(0, 0);

    setWorkSecondsLeft(wSec);
    setWorkElapsedSec(0);
    setSavedWorkSecondsLeft(wSec);
    setSavedWorkElapsedSec(0);
    setBreakKind("standard");
    setBreakTotalSec(stdBreakSec);
    setBreakSecondsLeft(stdBreakSec);
    setBreakElapsedSec(0);
    setBreakOverdueSec(0);
    setBreakOvertimeAccumSec(0);
    setWorkPauseStartedAtMs(null);
    setWorkPausedLiveSec(0);
    setPendingWorkPauseSec(0);
    setPendingWorkPauseStartIso(null);
    setBreakOverdueSource("break");
    setCurrentSessionDistractions(0);

    workStartedAtRef.current = nowIso;
    breakStartedAtRef.current = null;
    lastActiveAtRef.current = Date.now();
    completingWorkRoundRef.current = false;
    setContextStartedAtElapsedSec(0);
    if (currentContext.trim()) {
      const cId = await startContextLog({
        contextText: currentContext.trim(),
        workTag: currentWorkTag,
      });
      setActiveContextLogId(cId);
    } else {
      setActiveContextLogId(null);
    }

    setTimerMode("work");
    setSessionActive(true);
    setPage("timer");
    setIsRunning(true);
  };

  const handleFinishSession = async () => {
    if (isSubmittingSessionRef.current) return;
    isSubmittingSessionRef.current = true;
    try {
      setIsRunning(false);
      setIsCelebrating(false);
      setPlanDropdownOpen(false);
      setShowDistractBox(false);
      setShowStopBox(false);
      setShowBreakOverdueBox(false);
      setShowWorkTopicBox(false);
      setShowShortBreakPrompt(false);
      setShowContextEditBox(false);
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);
      setShowStuckRescueBox(false);
      await flushPendingWorkPauseSilently();

      const nowIso = new Date().toISOString();
      const curStartMood = sessionStartMood;
      const curHyperfocus = hyperfocusExtraSec;

      if (activeContextLogId && timerMode === "work") {
        await finalizeContextLog(
          activeContextLogId,
          Math.max(0, workElapsedSec - contextStartedAtElapsedSec),
        );
      }
      setActiveContextLogId(null);
      setContextStartedAtElapsedSec(0);

      // Yarım kalan çalışma veya mola varsa istatistik kaybolmasın diye kaydet
      const activeRoundNum =
        (completedWorkCount % Math.max(1, currentPlan.longBreakInterval)) + 1;
      const activePlanLabel = getPlanDisplayName(currentPlan);
      if (timerMode === "work" && workElapsedSec >= 15) {
        const startIso =
          workStartedAtRef.current ||
          new Date(Date.now() - workElapsedSec * 1000).toISOString();
        await recordWorkSession(
          workElapsedSec,
          currentWorkTag,
          currentWorkReason,
          startIso,
          nowIso,
          undefined,
          undefined,
          curHyperfocus,
          curStartMood,
          null,
          activePlanLabel,
          activeRoundNum,
          false,
          sessionGroupIdRef.current,
        );
      } else if (timerMode === "break") {
        // Kısa moladaysa önce duraklatılmış çalışmayı kaydet
        if (breakKind === "short" && savedWorkElapsedSec >= 15) {
          const wStart =
            workStartedAtRef.current ||
            new Date(Date.now() - savedWorkElapsedSec * 1000).toISOString();
          await recordWorkSession(
            savedWorkElapsedSec,
            currentWorkTag,
            currentWorkReason,
            wStart,
            breakStartedAtRef.current || nowIso,
            undefined,
            undefined,
            curHyperfocus,
            curStartMood,
            null,
            activePlanLabel,
            activeRoundNum,
            false,
            sessionGroupIdRef.current,
          );
        }
        const totalOvertime = breakOvertimeAccumSec + breakOverdueSec;
        const actualBreakSec = breakElapsedSec + totalOvertime;
        if (actualBreakSec >= 10) {
          const defaultBreakTag =
            breakKind === "short"
              ? t.breakModeShortLabel
              : breakKind === "long"
                ? t.breakModeLongLabel
                : t.breakModeStdLabel;
          await recordBreakSession(
            actualBreakSec,
            defaultBreakTag,
            undefined,
            totalOvertime,
            breakStartedAtRef.current ||
              new Date(Date.now() - actualBreakSec * 1000).toISOString(),
            nowIso,
            sessionGroupIdRef.current,
          );
        }
      }

      const wSec = currentPlan.workMins * 60;
      const stdBreakSec = currentPlan.standardBreakMins * 60;

      setSessionActive(false);
      sessionGroupIdRef.current = null;
      setSessionGroupId(null);
      setTimerMode("work");
      setWorkSecondsLeft(wSec);
      setWorkElapsedSec(0);
      setSavedWorkSecondsLeft(wSec);
      setSavedWorkElapsedSec(0);
      setBreakKind("standard");
      setBreakTotalSec(stdBreakSec);
      setBreakSecondsLeft(stdBreakSec);
      setBreakElapsedSec(0);
      setBreakOverdueSec(0);
      setBreakOvertimeAccumSec(0);
      setWorkPauseStartedAtMs(null);
      setWorkPausedLiveSec(0);
      setPendingWorkPauseSec(0);
      setPendingWorkPauseStartIso(null);
      setBreakOverdueSource("break");
      setCurrentSessionDistractions(0);
      setCompletedWorkCount(0);
      setSessionShortBreakCount(0);
      setCurrentContext("");
      setActiveContextLogId(null);
      setContextStartedAtElapsedSec(0);
      setReminderBanner(null);
      setIsHyperfocus(false);
      setHyperfocusExtraSec(0);
      setSessionStartMood(null);
      firedMilestonesRef.current = {
        warmupDone: false,
        halfway: false,
        finalStretch: false,
      };
      workStartedAtRef.current = null;
      breakStartedAtRef.current = null;
      lastActiveAtRef.current = null;

      await saveSessionCycleStats(0, 0);
      const locale = activeLang === "tr" ? "tr-TR" : "en-US";
      const freshStats = await getActiveDayStats(locale);
      setDayStats(freshStats);
      setWeeklySummary(await getWeeklySummary(locale));
      setTimelineSessions(
        await getTimelineSessions(
          undefined,
          getDateBoundsIso(toLocalDateStr()),
        ),
      );
      setBreakParkingData(await getBreakParkingLotData());
      setPage("menu");
    } finally {
      isSubmittingSessionRef.current = false;
    }
  };

  // ---------------------------------------------------------------------------
  // DİKKAT DAĞILMASI İŞLEMLERİ (WİDGET İÇİ 4 ADIMLI ETKİLEŞİMLİ KART)
  // ---------------------------------------------------------------------------
  const handleDistractedClick = async () => {
    if (!sessionActive) return;

    const fg = await invoke<{ appName: string; windowTitle: string }>(
      "get_last_active_window",
    ).catch(() => ({ appName: "", windowTitle: "" }));
    setDetectedActiveApp(fg);
    setTagForm(null);
    setShowDistractBox(true);
  };

  const submitDistraction = async (payload: DistractSubmissionPayload) => {
    await processDistractionSubmission({
      category: payload.category,
      reasonText: payload.text,
      tag: payload.tag,
      activeApp: detectedActiveApp.appName,
      activeWindow: detectedActiveApp.windowTitle,
    });
    if (payload.newContext?.trim()) {
      await applyNewContext(
        payload.newContext,
        detectedActiveApp.appName,
        detectedActiveApp.windowTitle,
      );
    }
    setShowDistractBox(false);
    setTagForm(null);
  };

  // ---------------------------------------------------------------------------
  // ERKEN BİTİRME (STOP) İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleStopSession = async () => {
    setIsRunning(false);
    if (timerMode === "work") {
      // Isınma fazında durdurulursa mazeret sorulmaz ve cezalandırılmaz
      if (workPhase === "warmup") {
        if (isSubmittingSessionRef.current) return;
        isSubmittingSessionRef.current = true;
        try {
          await flushPendingWorkPauseSilently();
          if (activeContextLogId) {
            await finalizeContextLog(
              activeContextLogId,
              Math.max(0, workElapsedSec - contextStartedAtElapsedSec),
            );
            setActiveContextLogId(null);
            setContextStartedAtElapsedSec(0);
          }
          if (workElapsedSec >= 15) {
            const startIso =
              workStartedAtRef.current ||
              new Date(Date.now() - workElapsedSec * 1000).toISOString();
            await recordWorkSession(
              workElapsedSec,
              currentWorkTag,
              currentWorkReason,
              startIso,
              new Date().toISOString(),
              undefined,
              undefined,
              hyperfocusExtraSec,
              sessionStartMood,
              null,
              getPlanDisplayName(currentPlan),
              (completedWorkCount % Math.max(1, currentPlan.longBreakInterval)) +
                1,
              false,
              sessionGroupIdRef.current,
            );
            const locale = activeLang === "tr" ? "tr-TR" : "en-US";
            setDayStats(await getActiveDayStats(locale));
            setWeeklySummary(await getWeeklySummary(locale));
            setTimelineSessions(await getTimelineSessions());
          }
          setSessionActive(false);
          sessionGroupIdRef.current = null;
          setSessionGroupId(null);
          recentCompletedRoundRef.current = null;
          setRecentCompletedRound(null);
          setWorkSecondsLeft(currentPlan.workMins * 60);
          setWorkElapsedSec(0);
          setSavedWorkSecondsLeft(currentPlan.workMins * 60);
          setSavedWorkElapsedSec(0);
          setBreakKind("standard");
          setBreakTotalSec(currentPlan.standardBreakMins * 60);
          setBreakSecondsLeft(currentPlan.standardBreakMins * 60);
          setCurrentSessionDistractions(0);
          setCompletedWorkCount(0);
          setSessionShortBreakCount(0);
          setCurrentContext("");
          setReminderBanner(null);
          setIsHyperfocus(false);
          setHyperfocusExtraSec(0);
          setSessionStartMood(null);
          firedMilestonesRef.current = {
            warmupDone: false,
            halfway: false,
            finalStretch: false,
          };
          workStartedAtRef.current = null;
          lastActiveAtRef.current = null;
          await saveSessionCycleStats(0, 0);
          setPage("menu");
        } finally {
          isSubmittingSessionRef.current = false;
        }
        return;
      }

      if (workElapsedSec >= 15) {
        const loadedTags = await getTags("ending", t.defaultEndingTags);
        setEndingTags(loadedTags);
        const initialTag = loadedTags[0]?.name || t.other;
        setSelectedEndingTag(initialTag);

        const prevReasons = await getPreviousReasons("ending", initialTag);
        setEndingPreviousReasons(prevReasons);
        setEndingReasonText("");
        setShowStopBox(true);
        return;
      }
      await flushPendingWorkPauseSilently();
      if (activeContextLogId) {
        await finalizeContextLog(
          activeContextLogId,
          Math.max(0, workElapsedSec - contextStartedAtElapsedSec),
        );
        setActiveContextLogId(null);
        setContextStartedAtElapsedSec(0);
      }
      setSessionActive(false);
      sessionGroupIdRef.current = null;
      setSessionGroupId(null);
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      setSavedWorkSecondsLeft(currentPlan.workMins * 60);
      setSavedWorkElapsedSec(0);
      setBreakKind("standard");
      setBreakTotalSec(currentPlan.standardBreakMins * 60);
      setBreakSecondsLeft(currentPlan.standardBreakMins * 60);
      setCurrentSessionDistractions(0);
      setCompletedWorkCount(0);
      setSessionShortBreakCount(0);
      setCurrentContext("");
      setReminderBanner(null);
      setIsHyperfocus(false);
      setHyperfocusExtraSec(0);
      setSessionStartMood(null);
      firedMilestonesRef.current = {
        warmupDone: false,
        halfway: false,
        finalStretch: false,
      };
      workStartedAtRef.current = null;
      lastActiveAtRef.current = null;
      await saveSessionCycleStats(0, 0);
      setPage("menu");
    } else {
      const totalOvertime = breakOvertimeAccumSec + breakOverdueSec;
      if (totalOvertime >= 10) {
        autoStartAfterBreakRef.current = true;
        await handleOpenBreakOverdueBox();
        return;
      }
      await submitBreakOverdue(true, true);
    }
  };

  const cancelStopBox = () => {
    setShowStopBox(false);
    setEndingReasonText("");
    setIsEditingEndingTags(false);
    if (sessionActive) {
      if (timerMode === "work") {
        void handleResumeWork();
      } else {
        lastActiveAtRef.current = Date.now();
        setIsRunning(true);
      }
    }
  };

  const handleSelectEndingTag = async (tagName: string) => {
    setSelectedEndingTag(tagName);
    const prevReasons = await getPreviousReasons("ending", tagName);
    setEndingPreviousReasons(prevReasons);
  };

  const submitEnding = async (withTag = true) => {
    if (isSubmittingSessionRef.current) return;
    isSubmittingSessionRef.current = true;
    try {
      await flushPendingWorkPauseSilently();
      if (activeContextLogId) {
        await finalizeContextLog(
          activeContextLogId,
          Math.max(0, workElapsedSec - contextStartedAtElapsedSec),
        );
        setActiveContextLogId(null);
        setContextStartedAtElapsedSec(0);
      }
      if (workElapsedSec >= 15) {
        const endTag = withTag ? selectedEndingTag : t.other;
        const endReason = withTag
          ? endingReasonText.trim() || selectedEndingTag
          : undefined;
        const startIso =
          workStartedAtRef.current ||
          new Date(Date.now() - workElapsedSec * 1000).toISOString();

        await recordWorkSession(
          workElapsedSec,
          currentWorkTag,
          currentWorkReason,
          startIso,
          new Date().toISOString(),
          endTag,
          endReason,
          hyperfocusExtraSec,
          sessionStartMood,
          null,
          getPlanDisplayName(currentPlan),
          (completedWorkCount % Math.max(1, currentPlan.longBreakInterval)) + 1,
          false,
          sessionGroupIdRef.current,
        );
        const locale = activeLang === "tr" ? "tr-TR" : "en-US";
        setDayStats(await getActiveDayStats(locale));
        setWeeklySummary(await getWeeklySummary(locale));
        setTimelineSessions(await getTimelineSessions());
      }
      setSessionActive(false);
      sessionGroupIdRef.current = null;
      setSessionGroupId(null);
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      setSavedWorkSecondsLeft(currentPlan.workMins * 60);
      setSavedWorkElapsedSec(0);
      setBreakKind("standard");
      setBreakTotalSec(currentPlan.standardBreakMins * 60);
      setBreakSecondsLeft(currentPlan.standardBreakMins * 60);
      setCurrentSessionDistractions(0);
      setCompletedWorkCount(0);
      setSessionShortBreakCount(0);
      setCurrentContext("");
      setReminderBanner(null);
      setIsHyperfocus(false);
      setHyperfocusExtraSec(0);
      setSessionStartMood(null);
      firedMilestonesRef.current = {
        warmupDone: false,
        halfway: false,
        finalStretch: false,
      };
      workStartedAtRef.current = null;
      lastActiveAtRef.current = null;
      await saveSessionCycleStats(0, 0);
      setShowStopBox(false);
      setEndingReasonText("");
      setIsEditingEndingTags(false);
      setPage("menu");
    } finally {
      isSubmittingSessionRef.current = false;
    }
  };

  // ---------------------------------------------------------------------------
  // MOLA, KISA MOLA, KONU SEÇİMİ & EXPORT
  // ---------------------------------------------------------------------------
  const handleOpenContextBox = () => {
    setShortBreakDraft(currentContext || "");
    setShowContextEditBox(true);
  };

  const confirmContextEdit = async () => {
    const nextCtx = shortBreakDraft.trim();
    setShowContextEditBox(false);
    if (nextCtx) {
      if (nextCtx !== currentContext.trim()) {
        await applyNewContext(nextCtx);
      }
    } else {
      if (activeContextLogId && timerMode === "work") {
        await finalizeContextLog(
          activeContextLogId,
          Math.max(0, workElapsedSec - contextStartedAtElapsedSec),
        );
      }
      setActiveContextLogId(null);
      setContextStartedAtElapsedSec(0);
      setCurrentContext("");
    }
  };

  const handleTakeShortBreak = () => {
    if (!sessionActive) return;
    setShortBreakDraft(currentContext || "");
    setShowShortBreakPrompt(true);
  };

  const confirmStartShortBreak = async () => {
    if (!sessionActive) return;
    await flushPendingWorkPauseSilently();
    const chosenContext = shortBreakDraft.trim() || currentContext.trim();
    setShowShortBreakPrompt(false);

    if (activeContextLogId) {
      await finalizeContextLog(
        activeContextLogId,
        Math.max(0, workElapsedSec - contextStartedAtElapsedSec),
      );
      setActiveContextLogId(null);
    }

    if (chosenContext) {
      setCurrentContext(chosenContext);
      setRecentContexts(await getRecentContexts(6));
    }

    setSavedWorkSecondsLeft(workSecondsLeft);
    setSavedWorkElapsedSec(workElapsedSec);
    const nextShort = sessionShortBreakCount + 1;
    setSessionShortBreakCount(nextShort);
    await saveSessionCycleStats(completedWorkCount, nextShort);

    const bSec = currentPlan.shortBreakMins * 60;
    setBreakKind("short");
    setBreakTotalSec(bSec);
    setBreakSecondsLeft(bSec);
    setBreakElapsedSec(0);
    setBreakOverdueSec(0);
    setBreakOvertimeAccumSec(0);
    setTimerMode("break");
    setIsRunning(true);
    playBreakChime();
    breakStartedAtRef.current = new Date().toISOString();
    lastActiveAtRef.current = Date.now();
  };

  const handleOpenBreakOverdueBox = async (
    source: "break" | "work_pause" = "break",
  ) => {
    setBreakOverdueSource(source);
    if (isMiniDockRef.current) {
      await exitMiniDock();
    }
    const loadedTags = await getTags(
      "break_overtime",
      t.defaultBreakOvertimeTags,
    );
    setBreakOverdueTags(loadedTags);
    const initial =
      loadedTags[0]?.name || t.defaultBreakOvertimeTags[0] || t.other;
    setSelectedBreakOverdueTag(initial);
    const prev = await getPreviousReasons("break_overtime", initial);
    setBreakOverduePrevReasons(prev);
    setBreakOverdueReasonText("");
    setTagForm(null);
    setShowBreakOverdueBox(true);
  };

  const handleSelectBreakOverdueTag = async (tagName: string) => {
    setSelectedBreakOverdueTag(tagName);
    const prev = await getPreviousReasons("break_overtime", tagName);
    setBreakOverduePrevReasons(prev);
  };

  const submitBreakOverdue = async (
    skipReason = false,
    autoRunWork = autoStartAfterBreakRef.current,
  ) => {
    if (isSubmittingSessionRef.current) return;
    isSubmittingSessionRef.current = true;
    try {
      if (breakOverdueSource === "work_pause") {
        const pauseSec = Math.max(10, pendingWorkPauseSec);
        const tag = !skipReason
          ? selectedBreakOverdueTag
          : t.workPauseDefaultTag;
        const reason = !skipReason
          ? breakOverdueReasonText.trim() || selectedBreakOverdueTag
          : undefined;
        const endIso = new Date().toISOString();
        const startIso =
          pendingWorkPauseStartIso ||
          new Date(Date.now() - pauseSec * 1000).toISOString();

        await recordBreakSession(
          pauseSec,
          tag,
          reason,
          pauseSec,
          startIso,
          endIso,
          sessionGroupIdRef.current,
        );
        setTimelineSessions(await getTimelineSessions());

        setShowBreakOverdueBox(false);
        setIsEditingBreakOverdueTags(false);
        setTagForm(null);
        setBreakOverdueSource("break");
        setWorkPauseStartedAtMs(null);
        setWorkPausedLiveSec(0);
        setPendingWorkPauseSec(0);
        setPendingWorkPauseStartIso(null);

        if (!workStartedAtRef.current) {
          workStartedAtRef.current = new Date(
            Date.now() - workElapsedSec * 1000,
          ).toISOString();
        }
        lastActiveAtRef.current = Date.now();
        setTimerMode("work");
        setPage("timer");
        setIsRunning(true);
        return;
      }

      const totalOvertime = breakOvertimeAccumSec + breakOverdueSec;
      const actualBreakSec = breakElapsedSec + totalOvertime;
      const defaultTag =
        breakKind === "short"
          ? t.breakModeShortLabel
          : breakKind === "long"
            ? t.breakModeLongLabel
            : t.breakModeStdLabel;

      if (actualBreakSec >= 10) {
        const hasModalOvertimeReason = totalOvertime >= 10 && !skipReason;
        const tag = hasModalOvertimeReason
          ? selectedBreakOverdueTag
          : defaultTag;
        const reason = hasModalOvertimeReason
          ? breakOverdueReasonText.trim() || selectedBreakOverdueTag
          : undefined;
        const endIso = new Date().toISOString();
        const startIso =
          breakStartedAtRef.current ||
          new Date(Date.now() - actualBreakSec * 1000).toISOString();

        await recordBreakSession(
          actualBreakSec,
          tag,
          reason,
          totalOvertime,
          startIso,
          endIso,
          sessionGroupIdRef.current,
        );
        setTimelineSessions(await getTimelineSessions());
      }

      setShowBreakOverdueBox(false);
      setIsEditingBreakOverdueTags(false);
      setTagForm(null);
      setBreakOverdueSource("break");
      setBreakElapsedSec(0);
      setBreakOverdueSec(0);
      setBreakOvertimeAccumSec(0);
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);
      breakStartedAtRef.current = null;

      if (breakKind === "long") {
        const wSec = currentPlan.workMins * 60;
        const stdBreakSec = currentPlan.standardBreakMins * 60;

        setSessionActive(false);
        sessionGroupIdRef.current = null;
        setSessionGroupId(null);
        setIsRunning(false);
        setTimerMode("work");
        setBreakKind("standard");
        setWorkSecondsLeft(wSec);
        setWorkElapsedSec(0);
        setSavedWorkSecondsLeft(wSec);
        setSavedWorkElapsedSec(0);
        setBreakTotalSec(stdBreakSec);
        setBreakSecondsLeft(stdBreakSec);
        setWorkPauseStartedAtMs(null);
        setWorkPausedLiveSec(0);
        setPendingWorkPauseSec(0);
        setPendingWorkPauseStartIso(null);
        setCurrentSessionDistractions(0);
        setCompletedWorkCount(0);
        setSessionShortBreakCount(0);
        setCurrentContext("");
        setActiveContextLogId(null);
        setContextStartedAtElapsedSec(0);
        setReminderBanner(null);
        setIsHyperfocus(false);
        setHyperfocusExtraSec(0);
        setSessionStartMood(null);
        firedMilestonesRef.current = {
          warmupDone: false,
          halfway: false,
          finalStretch: false,
        };
        workStartedAtRef.current = null;
        lastActiveAtRef.current = null;

        await saveSessionCycleStats(0, 0);
        const locale = activeLang === "tr" ? "tr-TR" : "en-US";
        setDayStats(await getActiveDayStats(locale));
        setWeeklySummary(await getWeeklySummary(locale));
        setTimelineSessions(
          await getTimelineSessions(
            undefined,
            getDateBoundsIso(toLocalDateStr()),
          ),
        );
        setBreakParkingData(await getBreakParkingLotData());
        if (isMiniDockRef.current) {
          await exitMiniDock();
        }
        setPage("menu");
        return;
      }

      if (breakKind === "short") {
        setWorkSecondsLeft(savedWorkSecondsLeft);
        setWorkElapsedSec(savedWorkElapsedSec);
        setContextStartedAtElapsedSec(savedWorkElapsedSec);
        if (currentContext.trim() && autoRunWork) {
          const cId = await startContextLog({
            contextText: currentContext.trim(),
            workTag: currentWorkTag,
          });
          setActiveContextLogId(cId);
        }
      } else {
        setWorkSecondsLeft(currentPlan.workMins * 60);
        setWorkElapsedSec(0);
        setContextStartedAtElapsedSec(0);
        setIsHyperfocus(false);
        setHyperfocusExtraSec(0);
        firedMilestonesRef.current = {
          warmupDone: false,
          halfway: false,
          finalStretch: false,
        };
        workStartedAtRef.current = autoRunWork
          ? new Date().toISOString()
          : null;
        if (currentContext.trim() && autoRunWork) {
          const cId = await startContextLog({
            contextText: currentContext.trim(),
            workTag: currentWorkTag,
          });
          setActiveContextLogId(cId);
        }
      }

      lastActiveAtRef.current = autoRunWork ? Date.now() : lastActiveAtRef.current;
      setTimerMode("work");
      setPage("timer");
      setIsRunning(autoRunWork);
    } finally {
      isSubmittingSessionRef.current = false;
    }
  };

  const handleStartWorkFromBreak = async () => {
    const totalOvertime = breakOvertimeAccumSec + breakOverdueSec;
    autoStartAfterBreakRef.current = true;
    if (totalOvertime >= 10) {
      setIsRunning(false);
      await handleOpenBreakOverdueBox();
    } else {
      await submitBreakOverdue(true, true);
    }
  };

  const handleOpenWorkTopicBox = async () => {
    setPlanDropdownOpen(false);
    const loadedTags = await getTags("work", t.defaultWorkTags);
    setWorkTags(loadedTags);
    const initial =
      currentWorkTag || loadedTags[0]?.name || t.defaultWorkTags[0];
    setSelectedWorkTopicTag(initial);
    const prev = await getPreviousReasons("work", initial);
    setWorkPrevReasons(prev);
    setWorkTopicReasonText(currentWorkReason);
    setShowWorkTopicBox(true);
  };

  const handleSelectWorkTopicTag = async (tagName: string) => {
    setSelectedWorkTopicTag(tagName);
    const prev = await getPreviousReasons("work", tagName);
    setWorkPrevReasons(prev);
  };

  const submitWorkTopic = async () => {
    setCurrentWorkTag(selectedWorkTopicTag);
    setCurrentWorkReason(workTopicReasonText.trim());
    setShowWorkTopicBox(false);
  };

  const handleResumeWork = async () => {
    if (!sessionActive) return;
    if (timerMode === "work") {
      const startMs = workPauseStartedAtRef.current;
      const pausedSec = startMs
        ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
        : 0;
      if (
        startMs &&
        (pausedSec >= STALE_SESSION_TIMEOUT_SEC ||
          toLocalDateStr(new Date(startMs)) !== toLocalDateStr())
      ) {
        await autoCloseStaleSession(startMs);
        return;
      }
      if (pausedSec >= 10 && startMs && workPhase !== "warmup") {
        setPendingWorkPauseSec(pausedSec);
        setPendingWorkPauseStartIso(new Date(startMs).toISOString());
        setPage("timer");
        await handleOpenBreakOverdueBox("work_pause");
        return;
      }
      setWorkPauseStartedAtMs(null);
      setWorkPausedLiveSec(0);
      if (!workStartedAtRef.current) {
        workStartedAtRef.current = new Date(
          Date.now() - workElapsedSec * 1000,
        ).toISOString();
      }
      lastActiveAtRef.current = Date.now();
      setPage("timer");
      setIsRunning(true);
      return;
    }
    if (!isBreakAlarm) {
      lastActiveAtRef.current = Date.now();
      setPage("timer");
      setIsRunning(true);
    }
  };

  const handleToggleRunning = () => {
    if (isBreakAlarm) return;
    if (isRunning) {
      lastActiveAtRef.current = Date.now();
      if (timerMode === "work" && !workPauseStartedAtRef.current) {
        setWorkPauseStartedAtMs(Date.now());
      }
      setIsRunning(false);
    } else {
      void handleResumeWork();
    }
  };

  // ---------------------------------------------------------------------------
  // MENÜ, AYARLAR VE ÖZET SAYFASI GEÇİŞLERİ
  // ---------------------------------------------------------------------------
  const openMenu = async () => {
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    setShowDistractBox(false);
    setShowStopBox(false);
    setShowBreakOverdueBox(false);
    setShowWorkTopicBox(false);
    setShowShortBreakPrompt(false);
    setShowContextEditBox(false);
    setShowStuckRescueBox(false);
    setTagForm(null);
    setDayStats(
      await getActiveDayStats(activeLang === "tr" ? "tr-TR" : "en-US"),
    );
    await hydrateTodayBioLogs();
    setPage("menu");
  };

  const openSettings = () => {
    setPlanDropdownOpen(false);
    setRecordingShortcutFor(null);
    setPage("settings");
  };

  const handleOpenStuckRescue = () => {
    if (!sessionActive || timerMode !== "work") return;
    setIsRunning(false);
    setShowDistractBox(false);
    setShowStuckRescueBox(true);
  };

  const handleStuckResume = () => {
    setShowStuckRescueBox(false);
    setWorkPauseStartedAtMs(null);
    setWorkPausedLiveSec(0);
    lastActiveAtRef.current = Date.now();
    setIsRunning(true);
  };

  const handleStuckTakeShortBreak = () => {
    setShowStuckRescueBox(false);
    handleTakeShortBreak();
  };

  const handleResetData = async (options: ClearDataOptions) => {
    if (!options.workTime && !options.distractions) return;
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    if (options.workTime) {
      setIsRunning(false);
    }
    await clearSelectedData(options, locale);

    if (options.workTime) {
      const freshStats = await getActiveDayStats(locale);
      setSessionActive(false);
      sessionGroupIdRef.current = null;
      setSessionGroupId(null);
      setTimerMode("work");
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      setSavedWorkSecondsLeft(currentPlan.workMins * 60);
      setSavedWorkElapsedSec(0);
      setBreakKind("standard");
      setBreakSecondsLeft(currentPlan.standardBreakMins * 60);
      setBreakTotalSec(currentPlan.standardBreakMins * 60);
      setBreakElapsedSec(0);
      setBreakOverdueSec(0);
      setBreakOvertimeAccumSec(0);
      setWorkPauseStartedAtMs(null);
      setWorkPausedLiveSec(0);
      setPendingWorkPauseSec(0);
      setPendingWorkPauseStartIso(null);
      setBreakOverdueSource("break");
      setCompletedWorkCount(0);
      setSessionShortBreakCount(0);
      setCurrentContext("");
      setActiveContextLogId(null);
      setContextStartedAtElapsedSec(0);
      setReminderBanner(null);
      setIsHyperfocus(false);
      setHyperfocusExtraSec(0);
      setSessionStartMood(null);
      setSelectedStartMood(null);
      recentCompletedRoundRef.current = null;
      setRecentCompletedRound(null);
      setShowStuckRescueBox(false);
      firedMilestonesRef.current = {
        warmupDone: false,
        halfway: false,
        finalStretch: false,
      };
      setContextStats([]);
      setRecentContexts([]);
      workStartedAtRef.current = null;
      breakStartedAtRef.current = null;
      lastActiveAtRef.current = null;
      setDayStats(freshStats);
      setSelectedDayStats({ totalSec: 0, sessionCount: 0, avgSec: 0 });
      setWorkStoryEntries([]);
      setHoveredWeekDay(null);
      setHoveredTimelineItem(null);
      if (options.distractions) {
        setTodayBioLogs([]);
        setSummaryBioLogs([]);
      }
    }

    if (options.distractions) {
      setCurrentSessionDistractions(0);
      setBreakParkingData(EMPTY_PARKING);
      setSummaryParkingData(EMPTY_PARKING);
      setAppDistractions([]);
    }

    const nextDate = options.workTime ? toLocalDateStr() : selectedSummaryDate;
    if (options.workTime) {
      setSelectedSummaryDate(nextDate);
    }
    await loadSummaryForScope(summaryTab, nextDate, activeLang);
    setShowResetConfirm(false);
  };

  const handleLanguageChange = async (newPref: LangCode) => {
    setLangPref(newPref);
    await saveLanguagePreference(newPref);
    const newActive = resolveLanguage(newPref);
    const newT = translations[newActive];
    await refreshTagsForTranslations(newT);
  };

  const handlePenaltyChange = async (mins: number) => {
    setDistractPenaltyMins(mins);
    await saveDistractPenalty(mins);
  };

  if (!loaded) return null;

  if (loadError) {
    return (
      <div className="widget-shell solid-bg" onMouseDown={handleMouseDown}>
        <div className="top-bar">
          <span className="badge">⠿ Error</span>
          <button className="icon-btn" onClick={hideToTray}>
            <IconClose size={12} />
          </button>
        </div>
        <div
          style={{
            fontSize: "10px",
            color: "#fca5a5",
            wordBreak: "break-word",
          }}
        >
          {loadError}
        </div>
      </div>
    );
  }

  const isTimerAlarmView = page === "timer" && isBreakAlarm;

  const progressPct = !sessionActive
    ? 0
    : isBreakAlarm
      ? 100
      : timerMode === "work"
        ? Math.min(
            100,
            Math.max(
              0,
              (workElapsedSec / Math.max(1, workElapsedSec + workSecondsLeft)) *
                100,
            ),
          )
        : Math.min(
            100,
            Math.max(
              0,
              ((breakTotalSec - breakSecondsLeft) /
                Math.max(1, breakTotalSec)) *
                100,
            ),
          );

  const remainingRatio = Math.max(0, Math.min(1, 1 - progressPct / 100));

  const activeSeconds =
    timerMode === "work" ? workSecondsLeft : breakSecondsLeft;
  const liveClockStr = isBreakAlarm
    ? `-${formatClock(breakOverdueSec)}`
    : formatClock(activeSeconds);
  const hasPausedProgress =
    sessionActive && !isRunning && timerMode === "work" && workElapsedSec > 0;

  const currentCycleIndex = completedWorkCount % currentPlan.longBreakInterval;
  const currentBreakShortName =
    breakKind === "short"
      ? t.breakModeShortLabel
      : breakKind === "long"
        ? t.breakModeLongLabel
        : t.breakModeStdLabel;

  const currentBreakFullTooltip =
    breakKind === "short"
      ? t.shortBreakBadge(
          Math.round(breakTotalSec / 60),
          sessionShortBreakCount,
        )
      : breakKind === "long"
        ? t.longBreakBadge(Math.round(breakTotalSec / 60), completedWorkCount)
        : t.standardBreakBadge(
            Math.round(breakTotalSec / 60),
            currentCycleIndex || currentPlan.longBreakInterval,
            currentPlan.longBreakInterval,
          );

  const fullTopicLabel = `${currentWorkTag || t.selectWorkTopic}${
    currentWorkReason ? `: ${currentWorkReason}` : ""
  }`;

  const updateAvailable = updateStatus.kind === "available";

  const isLightTheme = isLightColor(theme.bgColor);
  const effectiveBgHex = isLightTheme ? "#efefef" : "#0c0d0e";
  const resolvedUserTimer = resolveHarmoniousTimerColor(
    theme.timerColor,
    isLightTheme,
  );
  const effectiveTimerColor = isBreakAlarm
    ? isLightTheme
      ? "#dc2626"
      : "#f87171"
    : sessionActive && timerMode === "break"
      ? breakKind === "long"
        ? isLightTheme
          ? "#6d28d9"
          : "#c4b5fd"
        : isLightTheme
          ? "#0284c7"
          : "#7dd3fc"
      : sessionActive && timerMode === "work" && isHyperfocus
        ? isLightTheme
          ? "#d97706"
          : "#fbbf24"
        : resolvedUserTimer.color;

  const effectiveProgressColor = isBreakAlarm
    ? "var(--accent-danger)"
    : sessionActive && timerMode === "break"
      ? breakKind === "long"
        ? "var(--accent-long-break)"
        : "var(--accent-warmup)"
      : sessionActive && timerMode === "work" && isHyperfocus
        ? "var(--accent-amber)"
        : resolvedUserTimer.id !== "neutral"
          ? resolvedUserTimer.color
          : "var(--accent-primary)";

  const shellStyle = {
    "--shell-bg": hexToRgba(effectiveBgHex, theme.bgOpacity / 100),
    "--shell-bg-solid": hexToRgba(
      effectiveBgHex,
      Math.max(0.97, Math.min(1, theme.bgOpacity / 100 + 0.2)),
    ),
    "--timer-color": effectiveTimerColor,
  } as React.CSSProperties;

  const isTimerModeStyle = (page === "timer" || isMiniDock) && sessionActive;
  const modeClass = !isTimerModeStyle
    ? ""
    : timerMode === "work"
      ? "mode-work"
      : breakKind === "long"
        ? "mode-long-break"
        : "mode-break";

  if (isMiniDock) {
    return (
      <MiniDock
        isLight={isLightTheme}
        progressColor={effectiveProgressColor}
        workPhase={workPhase}
        modeClass={modeClass}
        isBreakAlarm={isBreakAlarm}
        isCelebrating={isCelebrating}
        isRunning={isRunning}
        miniDockContextToast={miniDockContextToast}
        shellStyle={shellStyle}
        sessionActive={sessionActive}
        timerMode={timerMode}
        breakKind={breakKind}
        liveClockStr={liveClockStr}
        progressPct={progressPct}
        t={t}
        onStartDrag={() => {
          miniDockUserDraggedRef.current = true;
          getCurrentWindow().startDragging().catch(() => {});
        }}
        onExitMiniDock={exitMiniDock}
        onHideToTray={hideToTray}
      />
    );
  }

  const breakParkingTotalCount = breakParkingData.pendingTasks.length;
  const hasBreakParkingView =
    page === "timer" &&
    sessionActive &&
    timerMode === "break" &&
    showBreakParking &&
    breakParkingTotalCount > 0;

  const isTimerCentered =
    page === "timer" && !anyModalOpen && !hasBreakParkingView;

  const tagHandlers = {
    tagForm,
    onChangeTagForm: setTagForm,
    onSubmitTagForm: submitTagForm,
    onAddNewTag: handleAddNewTag,
    onEditTagItem: handleEditTagItem,
    onDeleteTagItem: handleDeleteTagItem,
  };

  return (
    <div
      className={`widget-shell ${
        page !== "timer" || anyModalOpen || hasBreakParkingView
          ? "solid-bg"
          : ""
      } ${isTimerCentered ? "timer-centered" : ""} ${
        isLightTheme ? "light-theme" : ""
      } ${modeClass} ${
        isModeSwitching ? "mode-switching" : ""
      } ${isCelebrating ? "celebrating-shell" : ""} ${
        milestonePulse ? "milestone-pulse" : ""
      } ${
        isTimerAlarmView ? "alarm-shell" : ""
      }`}
      style={shellStyle}
      onMouseDown={handleMouseDown}
    >
      {isCelebrating && (
        <>
          <ConfettiCanvas
            durationMs={4500}
            onComplete={() => setIsCelebrating(false)}
          />
          <div className="celebration-badge">{t.sessionCompleted}</div>
        </>
      )}

      {/* İnce Yuvarlatılmış İlerleme Çizgisi (Yalnızca sayaç ekranında) */}
      {page === "timer" && !anyModalOpen && (
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${progressPct}%`,
              backgroundColor: effectiveProgressColor,
            }}
          />
        </div>
      )}

      {/* =====================================================================
          ORTAK TAG & AÇIKLAMA DİYALOGLARI (Kısa Mola Notu, Konu, Dağılma, Erken Bitirme, Gecikme, Kurtarma)
         ===================================================================== */}
      {showStuckRescueBox ? (
        <StuckRescueModal
          t={t}
          enabledExercises={rescueExercises}
          onResume={handleStuckResume}
          onTakeShortBreak={handleStuckTakeShortBreak}
          onCancel={() => {
            setShowStuckRescueBox(false);
            void handleResumeWork();
          }}
        />
      ) : showShortBreakPrompt || showContextEditBox ? (
        <ShortBreakPromptModal
          t={t}
          currentContext={currentContext}
          recentContexts={recentContexts}
          shortBreakDraft={shortBreakDraft}
          isDirectContextEdit={showContextEditBox}
          onChangeDraft={setShortBreakDraft}
          onConfirm={
            showContextEditBox ? confirmContextEdit : confirmStartShortBreak
          }
          onCancel={() => {
            setShowShortBreakPrompt(false);
            setShowContextEditBox(false);
          }}
        />
      ) : showWorkTopicBox ? (
        <WorkTopicModal
          {...tagHandlers}
          t={t}
          workTags={workTags}
          selectedWorkTopicTag={selectedWorkTopicTag}
          workPrevReasons={workPrevReasons}
          workTopicReasonText={workTopicReasonText}
          isEditingWorkTags={isEditingWorkTags}
          onToggleEditTags={() => {
            setIsEditingWorkTags(!isEditingWorkTags);
            setTagForm(null);
          }}
          onSelectTag={handleSelectWorkTopicTag}
          onChangeReasonText={setWorkTopicReasonText}
          onSubmit={submitWorkTopic}
          onCancel={() => {
            setShowWorkTopicBox(false);
            setTagForm(null);
          }}
        />
      ) : showDistractBox ? (
        <DistractModal
          t={t}
          currentContext={currentContext}
          recentContexts={recentContexts}
          fullTopicLabel={fullTopicLabel}
          detectedActiveApp={detectedActiveApp}
          distractPenaltyMins={distractPenaltyMins}
          isWarmupPhase={timerMode === "work" && workPhase === "warmup"}
          getCategoryDisplayName={(cat) => getCategoryDisplayName(cat)}
          canShowStuckRescue={timerMode === "work" && (showStuckBtn || workElapsedSec <= 300)}
          onOpenStuckRescue={handleOpenStuckRescue}
          onPreferredHeightChange={setDistractModalHeight}
          onSubmit={submitDistraction}
          onCancel={() => {
            setShowDistractBox(false);
            setTagForm(null);
          }}
        />
      ) : showStopBox ? (
        <EarlyStopModal
          {...tagHandlers}
          t={t}
          workElapsedSec={workElapsedSec}
          endingTags={endingTags}
          selectedEndingTag={selectedEndingTag}
          endingPreviousReasons={endingPreviousReasons}
          endingReasonText={endingReasonText}
          isEditingEndingTags={isEditingEndingTags}
          onToggleEditTags={() => {
            setIsEditingEndingTags(!isEditingEndingTags);
            setTagForm(null);
          }}
          onSelectTag={handleSelectEndingTag}
          onChangeReasonText={setEndingReasonText}
          onSubmitWithTag={(withTag) => submitEnding(withTag)}
          onCancel={cancelStopBox}
        />
      ) : showBreakOverdueBox ? (
        <BreakOverdueModal
          {...tagHandlers}
          t={t}
          source={breakOverdueSource}
          totalOvertimeSec={
            breakOverdueSource === "work_pause"
              ? pendingWorkPauseSec
              : breakOvertimeAccumSec + breakOverdueSec
          }
          breakOverdueTags={breakOverdueTags}
          selectedBreakOverdueTag={selectedBreakOverdueTag}
          breakOverduePrevReasons={breakOverduePrevReasons}
          breakOverdueReasonText={breakOverdueReasonText}
          isEditingBreakOverdueTags={isEditingBreakOverdueTags}
          onToggleEditTags={() => {
            setIsEditingBreakOverdueTags(!isEditingBreakOverdueTags);
            setTagForm(null);
          }}
          onSelectTag={handleSelectBreakOverdueTag}
          onChangeReasonText={setBreakOverdueReasonText}
          onSubmit={(skipReason) => submitBreakOverdue(skipReason)}
        />
      ) : (
        <>
          {page === "timer" && sessionActive && (
            <TimerPage
              t={t}
              activeLang={activeLang}
              timerMode={timerMode}
              breakKind={breakKind}
              currentPlan={currentPlan}
              planDisplayName={getPlanDisplayName(currentPlan)}
              fullTopicLabel={fullTopicLabel}
              currentContext={currentContext}
              currentCycleIndex={currentCycleIndex}
              sessionShortBreakCount={sessionShortBreakCount}
              currentBreakShortName={currentBreakShortName}
              currentBreakFullTooltip={currentBreakFullTooltip}
              breakParkingTotalCount={breakParkingTotalCount}
              hasBreakParkingView={hasBreakParkingView}
              breakParkingData={breakParkingData}
              breakChecklistItems={breakChecklistItems}
              updateAvailable={updateAvailable}
              isBreakAlarm={isBreakAlarm}
              isRunning={isRunning}
              breakOverdueSec={breakOverdueSec}
              activeSeconds={activeSeconds}
              remainingRatio={remainingRatio}
              timerStyle={theme.timerStyle}
              timerColor={effectiveTimerColor}
              hasPausedProgress={hasPausedProgress}
              workElapsedSec={workElapsedSec}
              workPausedLiveSec={workPausedLiveSec}
              distractPenaltyMins={distractPenaltyMins}
              reminderBanner={reminderBanner}
              workPhase={workPhase}
              warmupLeftSec={warmupLeftSec}
              showStuckBtn={showStuckBtn}
              hyperfocusOfferLeftSec={hyperfocusOfferLeftSec}
              canLogBreakEndMood={canShowBreakEndMood}
              onToggleRunning={handleToggleRunning}
              onOpenWorkTopicBox={handleOpenWorkTopicBox}
              onOpenContextBox={handleOpenContextBox}
              onOpenStuckRescue={handleOpenStuckRescue}
              onExtendHyperfocus={(mins) =>
                void handleExtendHyperfocusFromBreak(mins)
              }
              onSelectBreakEndMood={(mood) =>
                void handleSelectBreakEndMood(mood)
              }
              onDismissBreakEndMood={() => {
                if (recentCompletedRoundRef.current) {
                  recentCompletedRoundRef.current = {
                    ...recentCompletedRoundRef.current,
                    moodLogged: true,
                  };
                }
                setRecentCompletedRound((prev) =>
                  prev ? { ...prev, moodLogged: true } : null,
                );
              }}
              onToggleBreakParking={() => {
                if (!showBreakParking) {
                  const sections =
                    (breakParkingData.pendingTasks.length > 0 ? 1 : 0) +
                    (breakParkingData.doneTasks.length > 0 ? 1 : 0) +
                    (breakParkingData.unratedIdeas.length > 0 ? 1 : 0) +
                    (breakParkingData.importantIdeas.length > 0 ? 1 : 0) +
                    (breakParkingData.unimportantIdeas.length > 0 ? 1 : 0) +
                    (breakParkingData.screenshotNotes.length > 0 ? 1 : 0);
                  const openRows =
                    breakParkingData.pendingTasks.length +
                    breakParkingData.unratedIdeas.length +
                    breakParkingData.importantIdeas.length;
                  setBreakParkingLayout({ openRows, sections });
                }
                setShowBreakParking((p) => !p);
              }}
              onOpenMenu={openMenu}
              onEnterMiniDock={enterMiniDock}
              onHideToTray={hideToTray}
              onDismissReminderBanner={() => setReminderBanner(null)}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onChangeParkingBucket={handleChangeParkingBucket}
              onBreakParkingLayoutChange={handleBreakParkingLayoutChange}
              onOpenLightbox={openLightbox}
              onStartWorkFromBreak={handleStartWorkFromBreak}
              onStopSession={handleStopSession}
              onTakeShortBreak={handleTakeShortBreak}
              onDistractedClick={handleDistractedClick}
            />
          )}

          {page === "menu" && (
            <MenuPage
              t={t}
              activeLang={activeLang}
              dayStats={dayStats}
              updateAvailable={updateAvailable}
              updateStatus={updateStatus}
              sessionActive={sessionActive}
              isBreakAlarm={isBreakAlarm}
              isRunning={isRunning}
              timerMode={timerMode}
              currentBreakShortName={currentBreakShortName}
              fullTopicLabel={fullTopicLabel}
              sessionShortBreakCount={sessionShortBreakCount}
              currentCycleIndex={currentCycleIndex}
              currentPlan={currentPlan}
              studyPlans={studyPlans}
              activePlanId={activePlanId}
              planDropdownOpen={planDropdownOpen}
              planDropdownRef={planDropdownRef}
              liveClockStr={liveClockStr}
              todayBioLogs={todayBioLogs}
              selectedStartMood={selectedStartMood}
              getPlanDisplayName={getPlanDisplayName}
              onOpenDashboard={openDashboard}
              onOpenSummary={openSummary}
              onOpenSettings={openSettings}
              onEnterMiniDock={enterMiniDock}
              onHideToTray={hideToTray}
              onInstallUpdate={handleInstallUpdate}
              onTogglePlanDropdown={() => setPlanDropdownOpen((prev) => !prev)}
              onSelectPlan={handleSelectPlan}
              onOpenWorkTopicBox={handleOpenWorkTopicBox}
              onSelectStartMood={setSelectedStartMood}
              onAddBioLog={handleAddBioLog}
              onReturnToTimer={() => {
                setIsCelebrating(false);
                if (sessionActive && !isBreakAlarm) {
                  if (!isRunning && timerMode === "work") {
                    void handleResumeWork();
                    return;
                  }
                  setIsRunning(true);
                }
                setPage("timer");
              }}
              onFinishSession={handleFinishSession}
              onStartSession={handleStartSession}
            />
          )}

          {page === "settings" && (
            <SettingsPage
              t={t}
              activeLang={activeLang}
              langPref={langPref}
              distractPenaltyMins={distractPenaltyMins}
              shortcuts={shortcuts}
              shortcutStatus={shortcutStatus}
              recordingShortcutFor={recordingShortcutFor}
              studyPlans={studyPlans}
              editingPlanId={editingPlanId}
              theme={theme}
              ambientNoise={ambientNoise}
              rescueExercises={rescueExercises}
              breakChecklistItems={breakChecklistItems}
              autoStartOn={autoStartOn}
              sizeSavedFlash={sizeSavedFlash}
              currentWinSize={currentWinSize}
              feedbackCopied={feedbackCopied}
              feedbackCat={feedbackCat}
              feedbackText={feedbackText}
              feedbacks={feedbacks}
              appVersion={appVersion}
              updateStatus={updateStatus}
              getPlanDisplayName={getPlanDisplayName}
              onOpenMenu={openMenu}
              onLanguageChange={handleLanguageChange}
              onPenaltyChange={handlePenaltyChange}
              onResetShortcuts={handleResetShortcuts}
              onSetRecordingShortcutFor={setRecordingShortcutFor}
              onApplyShortcuts={handleApplyShortcuts}
              onOpenQuickCapture={openQuickCaptureFromUi}
              onResetPlansDefault={handleResetPlansDefault}
              onSetEditingPlanId={setEditingPlanId}
              onUpdatePlanField={handleUpdatePlanField}
              onUpdateTheme={updateTheme}
              onUpdateAmbientNoise={handleUpdateAmbientNoise}
              onUpdateRescueExercises={handleUpdateRescueExercises}
              onUpdateBreakChecklistItems={handleUpdateBreakChecklistItems}
              onToggleAutoStart={toggleAutoStart}
              onSaveCurrentWindowSize={handleSaveCurrentWindowSize}
              onResetStandardSizes={handleResetStandardSizes}
              onSetFeedbackCat={setFeedbackCat}
              onSetFeedbackText={setFeedbackText}
              onAddFeedbackItem={handleAddFeedbackItem}
              onCopyAllFeedbacks={handleCopyAllFeedbacks}
              onOpenGithubFeedback={handleOpenGithubFeedback}
              onDeleteFeedbackItem={handleDeleteFeedbackItem}
              onInstallUpdate={handleInstallUpdate}
              onCheckUpdate={handleCheckUpdate}
              onTagsChanged={handleTagsChangedFromSettings}
            />
          )}

          {page === "summary" && (
            <SummaryPage
              t={t}
              activeLang={activeLang}
              summaryTab={summaryTab}
              summaryReasonsTab={summaryReasonsTab}
              selectedDateStr={selectedSummaryDate}
              selectedDayStats={selectedDayStats}
              summaryParkingData={summaryParkingData}
              workStoryEntries={workStoryEntries}
              bioLogs={summaryBioLogs}
              showResetConfirm={showResetConfirm}
              hoveredTimelineItem={hoveredTimelineItem}
              timelineSessions={timelineSessions}
              weeklySummary={weeklySummary}
              summaryReasonsData={summaryReasonsData}
              hoveredWeekDay={hoveredWeekDay}
              maxWeeklyHours={maxWeeklyHours}
              adhdInsights={adhdInsights}
              exportDirPath={exportDirPath}
              exportSavedMsg={exportSavedMsg}
              expandedTags={expandedTags}
              onSetSummaryTab={handleChangeSummaryTab}
              onSetSummaryReasonsTab={setSummaryReasonsTab}
              onSelectDate={handleSelectSummaryDate}
              onShiftDate={handleShiftSummaryDate}
              onOpenDashboard={openDashboard}
              onOpenMenu={openMenu}
              onSetShowResetConfirm={setShowResetConfirm}
              onResetData={handleResetData}
              onSetHoveredTimelineItem={setHoveredTimelineItem}
              onSetHoveredWeekDay={setHoveredWeekDay}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onChangeParkingBucket={handleChangeParkingBucket}
              onAddBioLog={handleAddBioLog}
              onDeleteBioLog={handleDeleteBioLog}
              onOpenLightbox={openLightbox}
              onToggleAccordionTag={toggleAccordionTag}
              onExportData={handleExportData}
            />
          )}

          {page === "dashboard" && (
            <DashboardPage
              t={t}
              freqOnlyToday={freqOnlyToday}
              cloudAuth={cloudAuth}
              isOnline={isOnline}
              pendingSyncCount={pendingSyncCount}
              syncStatusMsg={syncStatusMsg}
              isSyncingCloud={isSyncingCloud}
              cloudEmailInput={cloudEmailInput}
              cloudNameInput={cloudNameInput}
              cloudTokenInput={cloudTokenInput}
              cloudServerInput={cloudServerInput}
              dayStats={dayStats}
              summaryParkingData={summaryParkingData}
              contextStats={contextStats}
              appDistractions={appDistractions}
              onToggleFreqFilter={toggleFreqFilter}
              onOpenSummary={openSummary}
              onOpenMenu={openMenu}
              onEnterMiniDock={enterMiniDock}
              onHideToTray={hideToTray}
              onManualCloudSync={handleManualCloudSync}
              onGoogleSignOut={handleGoogleSignOut}
              onGoogleSignIn={handleGoogleSignIn}
              onSaveCloudToken={handleSaveCloudToken}
              onSetCloudEmailInput={setCloudEmailInput}
              onSetCloudNameInput={setCloudNameInput}
              onSetCloudTokenInput={setCloudTokenInput}
              onSetCloudServerInput={setCloudServerInput}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onChangeParkingBucket={handleChangeParkingBucket}
            />
          )}

          {lightboxEntry && (
            <LightboxModal
              entry={lightboxEntry}
              entries={lightboxGroupEntries}
              t={t}
              onSelectEntry={setLightboxEntry}
              onClose={() => {
                setLightboxEntry(null);
                setLightboxGroupEntries([]);
                setLightboxSource("story");
              }}
              onDelete={async (id) => {
                if (lightboxSource === "parking") {
                  await handleDeleteParkingEntry(id);
                  setLightboxEntry(null);
                  setLightboxGroupEntries([]);
                  setLightboxSource("story");
                } else {
                  await handleDeleteWorkStoryItem(id);
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
