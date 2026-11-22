import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  PageType,
  TimerMode,
  BreakKind,
  RuntimeState,
  AppState,
  ActiveDayStats,
  ThemeSettings,
  LangCode,
  TagKind,
  TagItem,
  SummaryReasonsData,
  WeekDayStat,
  WeeklySummary,
  DistractionCategory,
  doesCategoryAddPenalty,
  ParkingLotData,
  ContextStatItem,
  AppDistractionGroup,
  GlobalShortcutSettings,
  DEFAULT_SHORTCUTS,
  SizeTargetPage,
  CustomWindowSizes,
  AdhdInsightsData,
  DEFAULT_WINDOW_SIZES,
  DEFAULT_THEME,
  DEFAULT_WORK_SEC,
  DEFAULT_BREAK_SEC,
  loadAppState,
  saveAppState,
  loadRuntimeState,
  saveRuntimeState,
  loadThemeSettings,
  saveThemeSettings,
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
  TimelineSessionItem,
  exportAllData,
  StudyPlan,
  DEFAULT_STUDY_PLANS,
  AmbientNoiseSettings,
  DEFAULT_AMBIENT_NOISE,
  loadAmbientNoiseSettings,
  saveAmbientNoiseSettings,
  RescueExerciseSettings,
  DEFAULT_RESCUE_EXERCISES,
  loadRescueExerciseSettings,
  saveRescueExerciseSettings,
  loadBreakChecklistItems,
  saveBreakChecklistItems,
  loadStudyPlans,
  saveStudyPlans,
  loadActivePlanId,
  saveActivePlanId,
  loadSessionCycleStats,
  saveSessionCycleStats,
  recordDistraction,
  getWeeklySummary,
  ClearDataOptions,
  clearSelectedData,
  getTags,
  addTag,
  updateTag,
  deleteTag,
  getPreviousReasons,
  getSummaryReasonsData,
  loadCustomWindowSizes,
  saveCustomWindowSizes,
  resetCustomWindowSizes,
  getAdhdInsights,
  addParkingItem,
  getParkingLotData,
  getBreakParkingLotData,
  toggleParkingTaskDone,
  rateParkingIdea,
  deleteParkingItem,
  updateParkingBucket,
  ParkingBucket,
  MoodType,
  getBioLogs,
  addMoodLog,
  getMoodLogs,
  startContextLog,
  finalizeContextLog,
  incrementContextDistraction,
  getRecentContexts,
  getContextStatsSummary,
  getAppDistractionSummary,
  loadGlobalShortcuts,
  saveGlobalShortcuts,
  WorkStoryEntry,
  addWorkStoryEntry,
  getWorkStoryEntries,
  deleteWorkStoryEntry,
  toLocalDateStr,
  parseLocalDateStr,
  getDateBoundsIso,
  getWeekBoundsIso,
  getDayStatsForDate,
} from "./db";
import { captureScreenCompressed } from "./screenshot";
import { UpdateStatus, checkForUpdate, installUpdate } from "./updater";
import { type ActiveLang, translations, resolveLanguage } from "./i18n";
import { ConfettiCanvas } from "./Confetti";
import type { CaptureSubmittedEvent } from "./QuickCapture";
import {
  EMPTY_PARKING,
  NavPage,
  ShortcutStatus,
  TagFormState,
  UPDATE_CHECK_INTERVAL_MS,
  formatClock,
  getFinalStretchSec,
  getWarmupDurationSec,
} from "./constants";
import {
  playAlarmChime,
  playBreakChime,
  playCelebrationFanfare,
  playSubtleMilestoneChime,
} from "./lib/audio";
import { ambientNoiseEngine } from "./lib/ambientNoise";
import { hexToRgba, isLightColor } from "./lib/color";
import {
  applyMonitorClampedWindowSize,
  persistSnapshots,
} from "./lib/windowResize";
import { useBioAndMood } from "./hooks/useBioAndMood";
import { useCloudSync } from "./hooks/useCloudSync";
import { useFeedback } from "./hooks/useFeedback";
import { useMiniDock } from "./hooks/useMiniDock";
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
import {
  SummaryPage,
  SummaryReasonsTabType,
  SummaryTabType,
} from "./pages/SummaryPage";
import { DashboardPage } from "./pages/DashboardPage";
import "./App.css";

const STALE_SESSION_TIMEOUT_SEC = 60 * 60; // 60 min
const STALE_SESSION_TIMEOUT_MS = STALE_SESSION_TIMEOUT_SEC * 1000;

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

  // Çalışma Planları (Study Plans) & Döngü Takibi
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>(DEFAULT_STUDY_PLANS);
  const [activePlanId, setActivePlanId] = useState<string>("developer");
  const [editingPlanId, setEditingPlanId] = useState<string>("developer");
  const [completedWorkCount, setCompletedWorkCount] = useState<number>(0);
  const [sessionShortBreakCount, setSessionShortBreakCount] = useState<number>(0);
  const [breakKind, setBreakKind] = useState<BreakKind>("standard");
  const [savedWorkSecondsLeft, setSavedWorkSecondsLeft] =
    useState<number>(DEFAULT_WORK_SEC);
  const [savedWorkElapsedSec, setSavedWorkElapsedSec] = useState<number>(0);

  const currentPlan =
    studyPlans.find((p) => p.id === activePlanId) ||
    studyPlans[0] ||
    DEFAULT_STUDY_PLANS[0];

  const getPlanDisplayName = (plan: StudyPlan): string =>
    plan.name.trim() || t.planNames[plan.id] || plan.id;

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
  const [breakOverdueTags, setBreakOverdueTags] = useState<TagItem[]>([]);
  const [selectedBreakOverdueTag, setSelectedBreakOverdueTag] =
    useState<string>("Telefon");
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
  const [workTags, setWorkTags] = useState<TagItem[]>([]);
  const [selectedWorkTopicTag, setSelectedWorkTopicTag] =
    useState<string>("Ders");
  const [workTopicReasonText, setWorkTopicReasonText] = useState("");
  const [workPrevReasons, setWorkPrevReasons] = useState<string[]>([]);
  const [isEditingWorkTags, setIsEditingWorkTags] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [autoStartOn, setAutoStartOn] = useState(false);

  // Dikkat Dağılma Ek Süresi (Dakika) ve Seans İçi Dağılma Sayacı
  const [distractPenaltyMins, setDistractPenaltyMins] = useState(1);
  const [currentSessionDistractions, setCurrentSessionDistractions] =
    useState(0);

  // Dikkatim Dağıldı Kutusu & Açık Sekme Yakalama
  const [showDistractBox, setShowDistractBox] = useState(false);
  const [detectedActiveApp, setDetectedActiveApp] = useState<{
    appName: string;
    windowTitle: string;
  }>({ appName: "", windowTitle: "" });

  // Aktif Meşguliyet (Context), Kısa Mola Notu, Otopark & Global Kısayollar
  const [currentContext, setCurrentContext] = useState<string>("");
  const [activeContextLogId, setActiveContextLogId] = useState<number | null>(
    null,
  );
  const [contextStartedAtElapsedSec, setContextStartedAtElapsedSec] =
    useState<number>(0);
  const [recentContexts, setRecentContexts] = useState<string[]>([]);
  const [contextStats, setContextStats] = useState<ContextStatItem[]>([]);
  const [appDistractions, setAppDistractions] = useState<AppDistractionGroup[]>(
    [],
  );

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
    summaryMoodLogs,
    setSummaryMoodLogs,
    hydrateTodayBioLogs,
    handleAddBioLog,
    handleDeleteBioLog,
    handleAddMoodCheckin,
    handleDeleteMoodLog,
  } = useBioAndMood({ page, selectedSummaryDate });
  const [milestonePulse, setMilestonePulse] = useState<boolean>(false);
  const firedMilestonesRef = useRef<{
    warmupDone: boolean;
    halfway: boolean;
    finalStretch: boolean;
  }>({ warmupDone: false, halfway: false, finalStretch: false });

  const [breakParkingData, setBreakParkingData] =
    useState<ParkingLotData>(EMPTY_PARKING);
  const [summaryParkingData, setSummaryParkingData] =
    useState<ParkingLotData>(EMPTY_PARKING);
  const [showBreakParking, setShowBreakParking] = useState<boolean>(true);

  const [shortcuts, setShortcuts] =
    useState<GlobalShortcutSettings>(DEFAULT_SHORTCUTS);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus | null>(
    null,
  );
  const [recordingShortcutFor, setRecordingShortcutFor] = useState<
    "distraction" | null
  >(null);

  // Satır-İçi Tag Ekle / Düzenle / Sil Formu (window.prompt / window.confirm yerine)
  const [tagForm, setTagForm] = useState<TagFormState | null>(null);

  // Çalışma <-> Mola Geçiş Animasyonu
  const [isModeSwitching, setIsModeSwitching] = useState(false);
  const prevTimerModeRef = useRef<TimerMode>("work");

  // Özel Pencere Boyutları
  const [customSizes, setCustomSizes] = useState<CustomWindowSizes>({});
  const [currentWinSize, setCurrentWinSize] = useState<{
    w: number;
    h: number;
  }>({
    w: 315,
    h: 362,
  });
  const [sizeSavedFlash, setSizeSavedFlash] = useState(false);

  // 5dk Çalışma Hikayesi & Lightbox
  const [workStoryEntries, setWorkStoryEntries] = useState<WorkStoryEntry[]>(
    [],
  );
  const [lightboxEntry, setLightboxEntry] = useState<WorkStoryEntry | null>(
    null,
  );
  const [lightboxGroupEntries, setLightboxGroupEntries] = useState<
    WorkStoryEntry[]
  >([]);
  const openLightbox = (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
  ) => {
    setLightboxEntry(entry);
    setLightboxGroupEntries(groupFrames || []);
  };
  const lastPeriodicShotSecRef = useRef<number>(0);

  // Uygulama İçi Geri Bildirim (Feedback) & ADHD Öz-Farkındalık Verisi
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
  const [adhdInsights, setAdhdInsights] = useState<AdhdInsightsData | null>(
    null,
  );

  // Erken Durdurma Kutusu
  const [showStopBox, setShowStopBox] = useState(false);
  const [endingTags, setEndingTags] = useState<TagItem[]>([]);
  const [selectedEndingTag, setSelectedEndingTag] = useState<string>("Diğer");
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

  // İstatistikler ve Özet verisi
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

  // Arka planda gizliyken bile sürenin şaşmaması için zaman referansı
  const lastTickRef = useRef<number>(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);

  // Renk ayarları, görsel sayaç, arka plan sesi, mola rutini & uzaktan güncelleme
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const themeDirtyRef = useRef(false);
  const [ambientNoise, setAmbientNoise] = useState<AmbientNoiseSettings>(
    DEFAULT_AMBIENT_NOISE,
  );
  const [rescueExercises, setRescueExercises] = useState<RescueExerciseSettings>(
    DEFAULT_RESCUE_EXERCISES,
  );
  const [breakChecklistItems, setBreakChecklistItems] = useState<string[]>([]);
  const currentPlanWorkMinsRef = useRef<number>(currentPlan.workMins);
  currentPlanWorkMinsRef.current = currentPlan.workMins;
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    kind: "idle",
  });

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
    lastActiveAt: lastActiveAtRef.current,
  };

  const distractPenaltyRef = useRef<number>(distractPenaltyMins);
  distractPenaltyRef.current = distractPenaltyMins;
  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;
  const freqOnlyTodayRef = useRef(freqOnlyToday);
  freqOnlyTodayRef.current = freqOnlyToday;
  const isRunningRef = useRef<boolean>(false);
  isRunningRef.current = isRunning;

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

  useEffect(() => {
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
              lastActiveAt: null,
            };
            await saveAppState(cleanAppState).catch(() => {});
            await saveRuntimeState(cleanRuntime).catch(() => {});
            await saveSessionCycleStats(0, 0).catch(() => {});

            workStartedAtRef.current = null;
            breakStartedAtRef.current = null;
            lastActiveAtRef.current = null;
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

  // Çalışma sayacı aktifken Windows Focus Moduna (Rahatsız Etmeyin / Bildirimleri Gizle) gir, mola veya duraklatmada geri aç
  useEffect(() => {
    if (!loaded) return;
    const shouldSuppress =
      sessionActive && isRunning && timerMode === "work";
    invoke("set_windows_focus_mode", { enabled: shouldSuppress }).catch(
      () => {},
    );
  }, [loaded, sessionActive, isRunning, timerMode]);

  // Sağ alt sistem tepsisi (System Tray) simgesi üzerine gelindiğinde Son Meşguliyet (Context) ve sayacı göster
  useEffect(() => {
    if (!loaded) return;
    const ctxLabel =
      currentContext.trim() ||
      (currentWorkTag
        ? `${currentWorkTag}${currentWorkReason ? `: ${currentWorkReason}` : ""}`
        : t.qcContextNone);
    const clk = formatClock(
      timerMode === "work" ? workSecondsLeft : breakSecondsLeft,
    );
    const modeTitle = !sessionActive
      ? "Pomodoro Widget"
      : timerMode === "work"
        ? `💼 ${clk}`
        : `☕ ${clk}`;
    invoke("update_tray_tooltip", {
      tooltip: `${modeTitle} • 🎯 ${ctxLabel}`,
    }).catch(() => {});
  }, [
    loaded,
    sessionActive,
    timerMode,
    workSecondsLeft,
    breakSecondsLeft,
    currentContext,
    currentWorkTag,
    currentWorkReason,
    t.qcContextNone,
  ]);

  // 5 Dakikada 1 Otomatik Ekran Görüntüsü + Açık Pencere İsmi + Context = Çalışma Hikayesi
  useEffect(() => {
    if (!loaded || !sessionActive || !isRunning || timerMode !== "work") {
      if (!sessionActive || timerMode !== "work") {
        lastPeriodicShotSecRef.current = 0;
      }
      return;
    }
    const currentBucket = Math.floor(workElapsedSec / 300);
    const prevBucket = Math.floor(lastPeriodicShotSecRef.current / 300);
    if (workElapsedSec >= 300 && currentBucket > prevBucket) {
      lastPeriodicShotSecRef.current = workElapsedSec;
      (async () => {
        try {
          const shot = await captureScreenCompressed(true, null, 720, 0.68);
          if (!shot.dataUrl) return;
          const fg =
            shot.activeApp || shot.activeWindow
              ? { appName: shot.activeApp, windowTitle: shot.activeWindow }
              : await invoke<{ appName: string; windowTitle: string }>(
                  "get_last_active_window",
                ).catch(() => ({ appName: "", windowTitle: "" }));
          const rt = runtimeStateRef.current;
          const ctxText =
            rt.currentContext.trim() ||
            (rt.workTag
              ? `${rt.workTag}${rt.workReason ? `: ${rt.workReason}` : ""}`
              : "");
          await addWorkStoryEntry({
            entryType: "periodic",
            screenshotData: shot.dataUrl,
            activeApp: fg.appName,
            activeWindow: fg.windowTitle,
            contextText: ctxText,
            workTag: rt.workTag,
            note: `${Math.floor(workElapsedSec / 60)} dk • ${fg.appName || rt.workTag || "Çalışma"}`,
            elapsedWorkSec: workElapsedSec,
          });
          setWorkStoryEntries(
            await getWorkStoryEntries(freqOnlyTodayRef.current, 80),
          );
          triggerBackgroundCloudSync();
        } catch (err) {
          console.error("5dk çalışma hikayesi kaydedilemedi:", err);
        }
      })();
    }
  }, [loaded, sessionActive, isRunning, timerMode, workElapsedSec]);

  // Çalışma <-> Mola geçişlerinde yumuşak görsel geçiş animasyonu tetikle ve Otopark'ı yenile
  useEffect(() => {
    if (!loaded) {
      prevTimerModeRef.current = timerMode;
      return;
    }
    if (prevTimerModeRef.current !== timerMode) {
      prevTimerModeRef.current = timerMode;
      setIsModeSwitching(true);
      if (timerMode === "break") {
        setShowBreakParking(true);
        getBreakParkingLotData()
          .then(setBreakParkingData)
          .catch(() => {});
      }
      const timer = setTimeout(() => setIsModeSwitching(false), 680);
      return () => clearTimeout(timer);
    }
  }, [timerMode, loaded]);

  // Spotlight Yakalama Penceresi için Rust arka planına anlık durum senkronizasyonu
  useEffect(() => {
    if (!loaded) return;
    invoke("sync_capture_snapshot", {
      snapshot: {
        currentContext,
        workTag: currentWorkTag,
        workReason: currentWorkReason,
        sessionActive,
        timerMode,
        distractPenaltyMins,
        lang: activeLang,
        bgColor: theme.bgColor,
        recentContexts,
        uiScale: theme.uiScale,
      },
    }).catch(() => {});
  }, [
    loaded,
    currentContext,
    currentWorkTag,
    currentWorkReason,
    sessionActive,
    timerMode,
    distractPenaltyMins,
    activeLang,
    theme.bgColor,
    theme.uiScale,
    recentContexts,
  ]);

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

  const anyModalOpen =
    showStopBox ||
    showDistractBox ||
    showBreakOverdueBox ||
    showWorkTopicBox ||
    showShortBreakPrompt ||
    showContextEditBox ||
    showStuckRescueBox;

  // Sistem tepsisi (Tray), OS uyanma ve pencere kapatma olaylarını dinle
  useEffect(() => {
    if (!loaded) return;
    let unlistenMini: (() => void) | null = null;
    let unlistenRestore: (() => void) | null = null;
    let unlistenOsResumed: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    (async () => {
      unlistenMini = await listen("request-mini-dock", () => {
        enterMiniDock();
      });
      unlistenRestore = await listen("tray-restore", () => {
        exitMiniDock();
      });
      unlistenOsResumed = await listen("os-resumed", () => {
        const rt = runtimeStateRef.current;
        const anchorMs =
          lastTickRef.current || lastActiveAtRef.current || Date.now();
        if (
          rt.sessionActive &&
          (Date.now() - anchorMs >= STALE_SESSION_TIMEOUT_MS ||
            toLocalDateStr(new Date(anchorMs)) !== toLocalDateStr())
        ) {
          void autoCloseStaleSessionRef.current(anchorMs);
          void revealExpandedWindowRef.current();
          return;
        }
        if (rt.sessionActive && rt.mode === "work" && isRunningRef.current) {
          if (!workPauseStartedAtRef.current) {
            setWorkPauseStartedAtMs(lastTickRef.current || Date.now());
          }
          lastTickRef.current = Date.now();
          setIsRunning(false);
        }
        void revealExpandedWindowRef.current();
      });
      const win = getCurrentWindow();
      unlistenResize = await win.onResized(async () => {
        try {
          const factor = await win.scaleFactor();
          const size = await win.innerSize();
          const mult = Math.max(1, (theme.uiScale || 100) / 100);
          setCurrentWinSize({
            w: Math.round(size.width / factor / mult),
            h: Math.round(size.height / factor / mult),
          });
        } catch {
          // ignore
        }
      });
    })();

    return () => {
      if (unlistenMini) unlistenMini();
      if (unlistenRestore) unlistenRestore();
      if (unlistenOsResumed) unlistenOsResumed();
      if (unlistenResize) unlistenResize();
    };
  }, [loaded, isMiniDock, theme.uiScale]);

  useEffect(() => {
    document.documentElement.style.zoom = "";
    if (!loaded) return;
    const scaleMult = Math.max(1, (theme.uiScale || 100) / 100);
    invoke("set_window_zoom", { zoom: scaleMult }).catch(() => {});
  }, [theme.uiScale, loaded]);

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

  const hasWorkElapsed = workElapsedSec > 0;
  const hasWorkPauseStart = workPauseStartedAtMs !== null;
  const hasReminderBanner = reminderBanner?.kind === "milestone";
  const isBreakAlarm =
    sessionActive && timerMode === "break" && breakOverdueSec > 0;

  // Sayfaya, diyaloglara, mini widget durumuna ve kullanıcı özel boyutlarına göre pencere boyutunu ayarla
  useEffect(() => {
    if (!loaded || isMiniDock) return;
    const scaleMult = Math.max(1, (theme.uiScale || 100) / 100);
    const applyScaledSize = (baseW: number, baseH: number) => {
      void applyMonitorClampedWindowSize(baseW, baseH, scaleMult);
      setCurrentWinSize({ w: baseW, h: baseH });
    };

    if (anyModalOpen) {
      let modalW = 325;
      let modalH = 340;
      if (showDistractBox) {
        modalW = 370;
        modalH = 490;
      } else if (showStuckRescueBox) {
        modalW = 340;
        modalH = 325;
      } else if (showShortBreakPrompt || showContextEditBox) {
        const hasChips = Boolean(currentContext || recentContexts.length > 0);
        modalW = 325;
        modalH = showContextEditBox
          ? hasChips
            ? 205
            : 165
          : hasChips
            ? 230
            : 190;
      } else if (showWorkTopicBox) {
        modalW = 325;
        modalH = tagForm ? 300 : workPrevReasons.length > 0 ? 270 : 235;
      }
      applyScaledSize(modalW, modalH);
      return;
    }
    const targetPage = page as SizeTargetPage;
    const custom = customSizes[targetPage];
    const hasBreakParking =
      targetPage === "timer" &&
      sessionActive &&
      timerMode === "break" &&
      showBreakParking &&
      breakParkingData.pendingTasks.length > 0;
    const hasPausedHint =
      targetPage === "timer" &&
      sessionActive &&
      !isRunning &&
      timerMode === "work" &&
      (hasWorkElapsed || hasWorkPauseStart);
    const hasTimerReminder = targetPage === "timer" && hasReminderBanner;
    const timerMinW =
      timerMode === "work" && !isRunning
        ? 304
        : DEFAULT_WINDOW_SIZES.timer.width;
    const timerMinH =
      (timerMode === "work" ? DEFAULT_WINDOW_SIZES.timer.height : 138) +
      (theme.timerStyle !== "digital" ? 42 : 0) +
      (hasPausedHint ? 20 : 0) +
      (hasTimerReminder ? 28 : 0) +
      (showStuckBtn && timerMode === "work" ? 26 : 0) +
      (timerMode === "break" && breakChecklistItems.length > 0 ? 28 : 0) +
      (hyperfocusOfferLeftSec > 0 && timerMode === "break" ? 34 : 0) +
      (isBreakAlarm ? 24 : 0);
    const breakPanelH =
      (isBreakAlarm ? 392 : 365) + (breakChecklistItems.length > 0 ? 22 : 0);

    if (custom) {
      const w = hasBreakParking
        ? Math.max(custom.width, 345)
        : targetPage === "timer"
          ? Math.max(custom.width, timerMinW)
          : custom.width;
      const h = hasBreakParking
        ? Math.max(custom.height, breakPanelH)
        : targetPage === "timer"
          ? Math.max(custom.height, timerMinH)
          : custom.height;
      applyScaledSize(w, h);
      return;
    }
    if (page === "menu") {
      const hasBanner =
        updateStatus.kind === "available" ||
        updateStatus.kind === "downloading";
      const h = hasBanner
        ? DEFAULT_WINDOW_SIZES.menu.height + 35
        : DEFAULT_WINDOW_SIZES.menu.height;
      applyScaledSize(DEFAULT_WINDOW_SIZES.menu.width, h);
    } else if (page === "dashboard") {
      applyScaledSize(
        DEFAULT_WINDOW_SIZES.dashboard.width,
        DEFAULT_WINDOW_SIZES.dashboard.height,
      );
    } else if (page === "summary") {
      applyScaledSize(
        DEFAULT_WINDOW_SIZES.summary.width,
        DEFAULT_WINDOW_SIZES.summary.height,
      );
    } else if (page === "settings") {
      applyScaledSize(
        DEFAULT_WINDOW_SIZES.settings.width,
        DEFAULT_WINDOW_SIZES.settings.height,
      );
    } else {
      const w = hasBreakParking ? 345 : timerMinW;
      const h = hasBreakParking ? breakPanelH : timerMinH;
      applyScaledSize(w, h);
    }
  }, [
    page,
    anyModalOpen,
    showDistractBox,
    showStuckRescueBox,
    showShortBreakPrompt,
    showContextEditBox,
    showWorkTopicBox,
    tagForm,
    workPrevReasons.length,
    currentContext,
    recentContexts.length,
    loaded,
    updateStatus.kind,
    isMiniDock,
    customSizes,
    sessionActive,
    isRunning,
    hasWorkElapsed,
    hasWorkPauseStart,
    hasReminderBanner,
    showStuckBtn,
    hyperfocusOfferLeftSec,
    isBreakAlarm,
    timerMode,
    showBreakParking,
    breakParkingData.pendingTasks.length,
    breakChecklistItems.length,
    theme.uiScale,
    theme.timerStyle,
  ]);

  const ambientShouldPlay =
    loaded &&
    ambientNoise.sound !== "off" &&
    (!ambientNoise.playOnlyInWork ||
      (sessionActive && timerMode === "work" && isRunning));

  useEffect(() => {
    ambientNoiseEngine.setConfig(
      ambientNoise.sound,
      ambientNoise.volume,
      ambientShouldPlay,
    );
  }, [ambientNoise.sound, ambientNoise.volume, ambientShouldPlay]);

  useEffect(() => {
    return () => {
      ambientNoiseEngine.stop();
    };
  }, []);

  // Renk ayarları değişince kaydet
  useEffect(() => {
    if (!loaded || !themeDirtyRef.current) return;
    const tTimer = setTimeout(() => {
      saveThemeSettings(theme).catch((err) =>
        console.error("Renk ayarları kaydedilemedi:", err),
      );
    }, 400);
    return () => clearTimeout(tTimer);
  }, [theme, loaded]);

  // Güncelleme kontrolü
  useEffect(() => {
    if (!loaded || import.meta.env.DEV) return;
    const runCheck = async () => {
      const result = await checkForUpdate();
      if (result.kind === "available") setUpdateStatus(result);
    };
    const first = setTimeout(runCheck, 10_000);
    const interval = setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [loaded]);

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

  // Çalışma sırasında duraklatıldığında geçen ara süresini canlı say
  useEffect(() => {
    if (
      !loaded ||
      !sessionActive ||
      isRunning ||
      timerMode !== "work" ||
      workPauseStartedAtMs === null ||
      showBreakOverdueBox
    ) {
      setWorkPausedLiveSec(0);
      return;
    }
    const updatePauseClock = () => {
      const pausedSec = Math.max(
        0,
        Math.floor((Date.now() - workPauseStartedAtMs) / 1000),
      );
      if (
        pausedSec >= STALE_SESSION_TIMEOUT_SEC ||
        toLocalDateStr(new Date(workPauseStartedAtMs)) !== toLocalDateStr()
      ) {
        void autoCloseStaleSessionRef.current(workPauseStartedAtMs);
        return;
      }
      setWorkPausedLiveSec(pausedSec);
    };
    updatePauseClock();
    const tmr = setInterval(updatePauseClock, 1000);
    return () => clearInterval(tmr);
  }, [
    loaded,
    sessionActive,
    isRunning,
    timerMode,
    workPauseStartedAtMs,
    showBreakOverdueBox,
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

  // Sistem saatine dayalı sayaç döngüsü (StrictMode güvenli — iç içe setState yok)
  useEffect(() => {
    if (!isRunning || !sessionActive) return;
    let disposed = false;
    let sleepCheckInFlight = false;
    lastTickRef.current = Date.now();

    const applyDelta = (delta: number, now: number) => {
      lastTickRef.current += delta * 1000;
      lastActiveAtRef.current = now;

      const rt = runtimeStateRef.current;
      const appSt = appStateRef.current;

      if (rt.mode === "work") {
        setWorkSecondsLeft((prev) => Math.max(0, prev - delta));
        setWorkElapsedSec((prev) => prev + delta);
        return;
      }

      const prevLeft = appSt.break_seconds_left;
      if (prevLeft > 0) {
        if (prevLeft > delta) {
          setBreakSecondsLeft(prevLeft - delta);
          setBreakElapsedSec(rt.breakElapsedSec + delta);
        } else {
          // Mola tam bu adımda doldu: aşan kısmı gecikmeye yaz ve alarm çal
          const overflow = delta - prevLeft;
          const nextOverdue = rt.breakOverdueSec + overflow;
          if (
            nextOverdue + rt.breakOvertimeAccumSec >=
            STALE_SESSION_TIMEOUT_SEC
          ) {
            void autoCloseStaleSessionRef.current(now - nextOverdue * 1000);
            return;
          }
          setBreakSecondsLeft(0);
          setBreakElapsedSec(rt.breakElapsedSec + prevLeft);
          setBreakOverdueSec(nextOverdue);
          playAlarmChime();
          if (isMiniDockRef.current) {
            triggerMiniDockContextToast(t.breakOverAlert);
            setTimeout(() => {
              invoke("alert_break_started").catch(() => {});
            }, 90);
          } else {
            invoke("alert_break_started").catch(() => {});
          }
          lastAlarmPlayRef.current = now;
        }
      } else {
        const nextOverdue = rt.breakOverdueSec + delta;
        if (
          nextOverdue + rt.breakOvertimeAccumSec >=
          STALE_SESSION_TIMEOUT_SEC
        ) {
          void autoCloseStaleSessionRef.current(now - nextOverdue * 1000);
          return;
        }
        setBreakOverdueSec(nextOverdue);
        if (now - lastAlarmPlayRef.current >= 12000) {
          playAlarmChime();
          lastAlarmPlayRef.current = now;
        }
      }
    };

    const runTick = async () => {
      if (disposed || sleepCheckInFlight) return;
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);
      if (delta < 1) return;

      if (delta <= 15) {
        applyDelta(delta, now);
        return;
      }

      const tickAnchor = lastTickRef.current;
      const crossedDay =
        toLocalDateStr(new Date(tickAnchor)) !== toLocalDateStr();

      if (runtimeStateRef.current.mode === "break") {
        const rt = runtimeStateRef.current;
        const remBreak = appStateRef.current.break_seconds_left;
        const projectedOverdue =
          rt.breakOvertimeAccumSec +
          rt.breakOverdueSec +
          Math.max(0, delta - remBreak);
        if (crossedDay || projectedOverdue >= STALE_SESSION_TIMEOUT_SEC) {
          void autoCloseStaleSessionRef.current(
            tickAnchor + Math.min(delta, remBreak) * 1000,
          );
          return;
        }
        applyDelta(delta, now);
        return;
      }

      // WebView2 arka plan/tepsi kısıtlaması (throttling) nedeniyle delta > 15 olabilir;
      // sadece Rust tarafı gerçek bir OS uyku/askıya alma boşluğu gördüyse çalışmayı duraklat.
      sleepCheckInFlight = true;
      try {
        const osSlept = await invoke<boolean>("did_os_sleep_since", {
          sinceMs: tickAnchor,
        }).catch(() => delta > 300);
        if (disposed) return;
        if (osSlept) {
          const sleptLong = Date.now() - tickAnchor >= STALE_SESSION_TIMEOUT_MS;
          if (crossedDay || sleptLong) {
            void autoCloseStaleSessionRef.current(tickAnchor);
            void revealExpandedWindowRef.current();
            return;
          }
          if (!workPauseStartedAtRef.current) {
            setWorkPauseStartedAtMs(tickAnchor);
          }
          lastTickRef.current = Date.now();
          setIsRunning(false);
          void revealExpandedWindowRef.current();
          return;
        }
        const latestNow = Date.now();
        const latestDelta = Math.floor((latestNow - lastTickRef.current) / 1000);
        if (latestDelta >= 1) {
          applyDelta(latestDelta, latestNow);
        }
      } finally {
        sleepCheckInFlight = false;
      }
    };

    const onWakeCheck = () => {
      if (document.visibilityState === "visible") {
        void runTick();
      }
    };

    const timer = setInterval(() => {
      void runTick();
    }, 500);
    window.addEventListener("focus", onWakeCheck);
    document.addEventListener("visibilitychange", onWakeCheck);

    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", onWakeCheck);
      document.removeEventListener("visibilitychange", onWakeCheck);
    };
  }, [isRunning, sessionActive]);

  // Ekran kapalı / PC başından 5 dk ayrılma durumunda çalışmayı duraklat ve ara başlangıcını kaydet (mola kesilmez)
  useEffect(() => {
    if (!isRunning || !sessionActive) return;
    const pollIdle = setInterval(async () => {
      const idleSecs = await invoke<number>("get_system_idle_secs").catch(
        () => 0,
      );
      const rt = runtimeStateRef.current;
      if (rt.mode === "work" && idleSecs >= 300) {
        const rewindSec = Math.min(
          idleSecs,
          appStateRef.current.work_elapsed_sec,
        );
        if (rewindSec > 0) {
          setWorkElapsedSec((prev) => Math.max(0, prev - rewindSec));
          setWorkSecondsLeft((prev) => prev + rewindSec);
        }
        if (!workPauseStartedAtRef.current) {
          setWorkPauseStartedAtMs(Date.now() - rewindSec * 1000);
        }
        setIsRunning(false);
        void revealExpandedWindowRef.current();
      }
    }, 10000);
    return () => clearInterval(pollIdle);
  }, [isRunning, sessionActive]);

  // Isınma bitişi, yarı zaman ve son dakikalarda hafif faz bildirimi (yalnızca +-5sn penceresinde)
  useEffect(() => {
    if (!isRunning || !sessionActive || timerMode !== "work" || isHyperfocus) {
      return;
    }
    const warmupSec = getWarmupDurationSec(currentPlan.workMins);
    const finalSec = getFinalStretchSec(currentPlan.workMins);

    if (
      warmupSec > 0 &&
      Math.abs(workElapsedSec - warmupSec) <= 5 &&
      !firedMilestonesRef.current.warmupDone &&
      workSecondsLeft > finalSec
    ) {
      firedMilestonesRef.current.warmupDone = true;
      playSubtleMilestoneChime("warmup_done");
      setMilestonePulse(true);
      setReminderBanner({ kind: "milestone", text: t.warmupDoneBanner });
    }

    const totalRoundSec = workElapsedSec + workSecondsLeft;
    if (
      totalRoundSec >= 240 &&
      workSecondsLeft > finalSec &&
      Math.abs(workElapsedSec - Math.floor(totalRoundSec / 2)) <= 5 &&
      !firedMilestonesRef.current.halfway
    ) {
      firedMilestonesRef.current.halfway = true;
      playSubtleMilestoneChime("halfway");
      setMilestonePulse(true);
      setReminderBanner({ kind: "milestone", text: t.halfwayBanner });
    }

    if (
      workElapsedSec >= 60 &&
      workSecondsLeft > 0 &&
      Math.abs(workSecondsLeft - finalSec) <= 5 &&
      !firedMilestonesRef.current.finalStretch
    ) {
      firedMilestonesRef.current.finalStretch = true;
      playSubtleMilestoneChime("final");
      setMilestonePulse(true);
      setReminderBanner({
        kind: "milestone",
        text: t.finalStretchBanner(Math.max(1, Math.ceil(finalSec / 60))),
      });
    }
  }, [
    isRunning,
    sessionActive,
    timerMode,
    isHyperfocus,
    workElapsedSec,
    workSecondsLeft,
    currentPlan.workMins,
    t,
  ]);

  useEffect(() => {
    if (!milestonePulse) return;
    const id = setTimeout(() => setMilestonePulse(false), 2500);
    return () => clearTimeout(id);
  }, [milestonePulse]);

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
    if (!recent || !recent.sessionId) return;
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

  // Özel Pencere Boyutu Kaydetme & Standart Boyuta Dönme
  const handleSaveCurrentWindowSize = async () => {
    const win = getCurrentWindow();
    const factor = await win.scaleFactor();
    const size = await win.innerSize();
    const mult = Math.max(1, (theme.uiScale || 100) / 100);
    const w = Math.max(220, Math.round(size.width / factor / mult));
    const h = Math.max(110, Math.round(size.height / factor / mult));
    const targetPage = page as SizeTargetPage;
    const updated: CustomWindowSizes = {
      ...customSizes,
      [targetPage]: { width: w, height: h },
    };
    setCustomSizes(updated);
    setCurrentWinSize({ w, h });
    await saveCustomWindowSizes(updated);
    setSizeSavedFlash(true);
    setTimeout(() => setSizeSavedFlash(false), 1800);
  };

  const handleResetStandardSizes = async () => {
    setCustomSizes({});
    await resetCustomWindowSizes();
    const targetPage = page as SizeTargetPage;
    const std = DEFAULT_WINDOW_SIZES[targetPage] || DEFAULT_WINDOW_SIZES.menu;
    const mult = Math.max(1, (theme.uiScale || 100) / 100);
    await applyMonitorClampedWindowSize(std.width, std.height, mult);
    setCurrentWinSize({ w: std.width, h: std.height });
  };

  const toggleAutoStart = async () => {
    if (autoStartOn) {
      await disable();
      setAutoStartOn(false);
    } else {
      await enable();
      setAutoStartOn(true);
    }
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
      setBreakParkingData(await getBreakParkingLotData());
      if (page === "summary") {
        const scopeRange =
          summaryTab === "weekly"
            ? getWeekBoundsIso(selectedSummaryDate)
            : getDateBoundsIso(selectedSummaryDate);
        setSummaryParkingData(await getParkingLotData(false, scopeRange));
      } else {
        setSummaryParkingData(
          await getParkingLotData(freqOnlyTodayRef.current),
        );
      }
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
    let unlistenCapture: (() => void) | null = null;
    listen<CaptureSubmittedEvent>("capture-submitted", (ev) => {
      captureHandlerRef.current(ev.payload);
    }).then((fn) => {
      unlistenCapture = fn;
    });
    return () => {
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
          ).catch(() => {});
        }
      }

      const wSec = currentPlan.workMins * 60;
      const stdBreakSec = currentPlan.standardBreakMins * 60;

      setSessionActive(false);
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
          );
        }
      }

      const wSec = currentPlan.workMins * 60;
      const stdBreakSec = currentPlan.standardBreakMins * 60;

      setSessionActive(false);
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
            );
            const locale = activeLang === "tr" ? "tr-TR" : "en-US";
            setDayStats(await getActiveDayStats(locale));
            setWeeklySummary(await getWeeklySummary(locale));
            setTimelineSessions(await getTimelineSessions());
          }
          setSessionActive(false);
          setWorkSecondsLeft(currentPlan.workMins * 60);
          setWorkElapsedSec(0);
          setCurrentSessionDistractions(0);
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
      setSessionActive(false);
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      setCurrentSessionDistractions(0);
      workStartedAtRef.current = null;
      lastActiveAtRef.current = null;
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
        );
        const locale = activeLang === "tr" ? "tr-TR" : "en-US";
        setDayStats(await getActiveDayStats(locale));
        setWeeklySummary(await getWeeklySummary(locale));
        setTimelineSessions(await getTimelineSessions());
      }
      setSessionActive(false);
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      setCurrentSessionDistractions(0);
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

  const handleSelectPlan = async (planId: string) => {
    setPlanDropdownOpen(false);
    if (sessionActive) return;
    setActivePlanId(planId);
    setEditingPlanId(planId);
    await saveActivePlanId(planId);
    const chosen = studyPlans.find((p) => p.id === planId);
    if (chosen) {
      setWorkSecondsLeft(chosen.workMins * 60);
      setBreakTotalSec(chosen.standardBreakMins * 60);
      setBreakSecondsLeft(chosen.standardBreakMins * 60);
    }
  };

  const handleUpdatePlanField = async (
    planId: string,
    field: keyof StudyPlan,
    value: string | number,
  ) => {
    const updated = studyPlans.map((p) => {
      if (p.id !== planId) return p;
      return { ...p, [field]: value };
    });
    setStudyPlans(updated);
    await saveStudyPlans(updated);
    if (
      planId === activePlanId &&
      field === "workMins" &&
      !isRunning &&
      workElapsedSec === 0 &&
      timerMode === "work"
    ) {
      setWorkSecondsLeft(Number(value) * 60);
    }
  };

  const handleResetPlansDefault = async () => {
    const fresh = DEFAULT_STUDY_PLANS.map((p) => ({ ...p }));
    setStudyPlans(fresh);
    await saveStudyPlans(fresh);
    const current = fresh.find((p) => p.id === activePlanId) || fresh[0];
    if (!isRunning && workElapsedSec === 0 && timerMode === "work") {
      setWorkSecondsLeft(current.workMins * 60);
    }
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

  // ---------------------------------------------------------------------------
  // TAG YÖNETİMİ (SATIR-İÇİ EKLE, DÜZENLE, SİL — OS POPUP OLMADAN)
  // ---------------------------------------------------------------------------
  const handleAddNewTag = (kind: TagKind) => {
    setTagForm({ mode: "add", kind, value: "" });
  };

  const handleEditTagItem = (
    tagId: number,
    currentName: string,
    kind: TagKind,
  ) => {
    setTagForm({
      mode: "edit",
      kind,
      tagId,
      currentName,
      value: currentName,
    });
  };

  const handleDeleteTagItem = (tagId: number, name: string, kind: TagKind) => {
    setTagForm({
      mode: "delete",
      kind,
      tagId,
      currentName: name,
      value: name,
    });
  };

  const submitTagForm = async () => {
    if (!tagForm) return;
    const { mode, kind, tagId, currentName, value } = tagForm;
    const trimmed = value.trim();

    if (mode === "add") {
      if (!trimmed) return;
      const added = await addTag(trimmed, kind);
      const pickedName = added?.name || trimmed;
      if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
        setSelectedEndingTag(pickedName);
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
        setSelectedWorkTopicTag(pickedName);
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(
          await getTags("break_overtime", t.defaultBreakOvertimeTags),
        );
        setSelectedBreakOverdueTag(pickedName);
      }
    } else if (mode === "edit" && tagId !== undefined && currentName) {
      if (trimmed && trimmed !== currentName) {
        await updateTag(tagId, trimmed, kind);
        if (kind === "ending") {
          setEndingTags(await getTags("ending", t.defaultEndingTags));
          if (selectedEndingTag === currentName) setSelectedEndingTag(trimmed);
        } else if (kind === "work") {
          setWorkTags(await getTags("work", t.defaultWorkTags));
          if (currentWorkTag === currentName) setCurrentWorkTag(trimmed);
          if (selectedWorkTopicTag === currentName) {
            setSelectedWorkTopicTag(trimmed);
          }
        } else if (kind === "break_overtime") {
          setBreakOverdueTags(
            await getTags("break_overtime", t.defaultBreakOvertimeTags),
          );
          if (selectedBreakOverdueTag === currentName) {
            setSelectedBreakOverdueTag(trimmed);
          }
        }
      }
    } else if (mode === "delete" && tagId !== undefined) {
      await deleteTag(tagId);
      if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(
          await getTags("break_overtime", t.defaultBreakOvertimeTags),
        );
      }
    }
    setTagForm(null);
  };

  const handleTagsChangedFromSettings = async (kind: TagKind) => {
    if (kind === "work") {
      setWorkTags(await getTags("work", t.defaultWorkTags));
    } else if (kind === "ending") {
      setEndingTags(await getTags("ending", t.defaultEndingTags));
    } else if (kind === "break_overtime") {
      setBreakOverdueTags(
        await getTags("break_overtime", t.defaultBreakOvertimeTags),
      );
    }
  };

  const openDashboard = async () => {
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const weekly = await getWeeklySummary(locale);
    const reasonsData = await getSummaryReasonsData(freqOnlyToday);
    const timeline = await getTimelineSessions();
    const insights = await getAdhdInsights(freqOnlyToday);
    const pData = await getParkingLotData(freqOnlyToday);
    const cStats = await getContextStatsSummary(freqOnlyToday);
    const aStats = await getAppDistractionSummary(freqOnlyToday);
    const wStory = await getWorkStoryEntries(freqOnlyToday, 80);

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
      mLogs,
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
      getMoodLogs(false, dayRange),
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
    setSummaryMoodLogs(mLogs);
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

  const handleChangeSummaryTab = async (tab: SummaryTabType) => {
    setSummaryTab(tab);
    setFreqOnlyToday(tab === "timeline");
    await loadSummaryForScope(tab, selectedSummaryDate, activeLang);
  };

  const handleSelectSummaryDate = async (dateStr: string) => {
    setSelectedSummaryDate(dateStr);
    await loadSummaryForScope(summaryTab, dateStr, activeLang);
  };

  const handleShiftSummaryDate = async (deltaDays: number) => {
    const d = parseLocalDateStr(selectedSummaryDate);
    d.setDate(d.getDate() + deltaDays);
    const nextStr = toLocalDateStr(d);
    setSelectedSummaryDate(nextStr);
    await loadSummaryForScope(summaryTab, nextStr, activeLang);
  };

  const openSettings = () => {
    setPlanDropdownOpen(false);
    setRecordingShortcutFor(null);
    setPage("settings");
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

  // Mola Otoparkı & Özet Otoparkı Etkileşimleri (Veritabanına Ekleme Sırasıyla Kaydedilir)
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

  // Global Kısayol Kaydetme & Sıfırlama
  const handleApplyShortcuts = async (next: GlobalShortcutSettings) => {
    setShortcuts(next);
    await saveGlobalShortcuts(next);
    const status = await invoke<ShortcutStatus>("update_global_shortcuts", {
      distractionShortcut: next.distractionShortcut,
      contextShortcut: next.contextShortcut,
    }).catch(() => null);
    if (status) setShortcutStatus(status);
  };

  const handleResetShortcuts = async () => {
    setRecordingShortcutFor(null);
    await handleApplyShortcuts({ ...DEFAULT_SHORTCUTS });
  };

  const openQuickCaptureFromUi = (mode: "distraction" | "context") => {
    invoke("open_quick_capture_manual", { mode }).catch(() => {});
  };

  const toggleAccordionTag = (tagName: string) => {
    setExpandedTags((prev) => ({ ...prev, [tagName]: !prev[tagName] }));
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
      setSummaryMoodLogs([]);
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

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    themeDirtyRef.current = true;
    setTheme((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateAmbientNoise = (patch: Partial<AmbientNoiseSettings>) => {
    setAmbientNoise((prev) => {
      const next = { ...prev, ...patch };
      saveAmbientNoiseSettings(next).catch(() => {});
      return next;
    });
  };

  const handleUpdateRescueExercises = (
    patch: Partial<RescueExerciseSettings>,
  ) => {
    setRescueExercises((prev) => {
      const next = { ...prev, ...patch };
      saveRescueExerciseSettings(next).catch(() => {});
      return next;
    });
  };

  const handleUpdateBreakChecklistItems = (items: string[]) => {
    setBreakChecklistItems(items);
    saveBreakChecklistItems(items).catch(() => {});
  };

  const handleLanguageChange = async (newPref: LangCode) => {
    setLangPref(newPref);
    await saveLanguagePreference(newPref);
    const newActive = resolveLanguage(newPref);
    const newT = translations[newActive];
    setEndingTags(await getTags("ending", newT.defaultEndingTags));
    setWorkTags(await getTags("work", newT.defaultWorkTags));
    setBreakOverdueTags(
      await getTags("break_overtime", newT.defaultBreakOvertimeTags),
    );
  };

  const handlePenaltyChange = async (mins: number) => {
    setDistractPenaltyMins(mins);
    await saveDistractPenalty(mins);
  };

  const handleCheckUpdate = async () => {
    setUpdateStatus({ kind: "checking" });
    setUpdateStatus(await checkForUpdate());
  };

  const handleInstallUpdate = async () => {
    setIsRunning(false);
    await installUpdate(setUpdateStatus, async () => {
      await saveAppState(appStateRef.current).catch(() => {});
      await saveRuntimeState(runtimeStateRef.current).catch(() => {});
      await saveThemeSettings(theme).catch(() => {});
    });
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

  const maxWeeklyHours = Math.max(
    1,
    ...(weeklySummary?.days.map((d) => d.total_sec / 3600) ?? [1]),
  );

  const updateAvailable = updateStatus.kind === "available";

  const shellStyle = {
    "--shell-bg": hexToRgba(theme.bgColor, theme.bgOpacity / 100),
    "--shell-bg-solid": hexToRgba(
      theme.bgColor,
      Math.max(0.97, Math.min(1, theme.bgOpacity / 100 + 0.2)),
    ),
    "--timer-color": theme.timerColor,
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
        isLight={isLightColor(theme.bgColor)}
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
      } ${isLightColor(theme.bgColor) ? "light-theme" : ""} ${modeClass} ${
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
              backgroundColor: isBreakAlarm
                ? "#ef4444"
                : timerMode === "work"
                  ? workPhase === "warmup"
                    ? "#34d399"
                    : workPhase === "final"
                      ? "#fb923c"
                      : workPhase === "hyperfocus"
                        ? "#f97316"
                        : "var(--timer-color, #fbbf24)"
                  : "#38bdf8",
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
              timerColor={theme.timerColor}
              hasPausedProgress={hasPausedProgress}
              workElapsedSec={workElapsedSec}
              workPausedLiveSec={workPausedLiveSec}
              distractPenaltyMins={distractPenaltyMins}
              reminderBanner={reminderBanner}
              workPhase={workPhase}
              warmupLeftSec={warmupLeftSec}
              showStuckBtn={showStuckBtn}
              hyperfocusOfferLeftSec={hyperfocusOfferLeftSec}
              canLogBreakEndMood={Boolean(
                recentCompletedRound?.sessionId &&
                !recentCompletedRound.moodLogged,
              )}
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
              onToggleBreakParking={() => setShowBreakParking((p) => !p)}
              onOpenMenu={openMenu}
              onEnterMiniDock={enterMiniDock}
              onHideToTray={hideToTray}
              onDismissReminderBanner={() => setReminderBanner(null)}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onChangeParkingBucket={handleChangeParkingBucket}
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
              moodLogs={summaryMoodLogs}
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
              onAddMoodCheckin={handleAddMoodCheckin}
              onDeleteMoodLog={handleDeleteMoodLog}
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
              }}
              onDelete={handleDeleteWorkStoryItem}
            />
          )}
        </>
      )}
    </div>
  );
}
