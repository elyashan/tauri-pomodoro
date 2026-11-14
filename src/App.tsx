import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  PageType,
  TimerMode,
  BreakKind,
  RuntimeState,
  AppState,
  ActiveDayStats,
  DaySummary,
  ThemeSettings,
  LangCode,
  TagKind,
  TagItem,
  SummaryReasonsData,
  WeekDayStat,
  WeeklySummary,
  DistractionCategory,
  doesCategoryAddPenalty,
  ParkingItem,
  ParkingLotData,
  ContextStatItem,
  AppDistractionGroup,
  GlobalShortcutSettings,
  DEFAULT_SHORTCUTS,
  FeedbackCategory,
  FeedbackItem,
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
  startNewDay,
  beginSessionDay,
  recordWorkSession,
  recordBreakSession,
  getTimelineSessions,
  TimelineSessionItem,
  exportAllData,
  loadAlwaysOnTop,
  saveAlwaysOnTop,
  StudyPlan,
  DEFAULT_STUDY_PLANS,
  loadStudyPlans,
  saveStudyPlans,
  loadActivePlanId,
  saveActivePlanId,
  loadSessionCycleStats,
  saveSessionCycleStats,
  recordDistraction,
  getDaysSummary,
  getWeeklySummary,
  clearAllData,
  getTags,
  addTag,
  updateTag,
  deleteTag,
  getPreviousReasons,
  getSummaryReasonsData,
  addFeedback,
  getFeedbacks,
  deleteFeedback,
  loadCustomWindowSizes,
  saveCustomWindowSizes,
  resetCustomWindowSizes,
  getAdhdInsights,
  addParkingItem,
  getParkingLotData,
  toggleParkingTaskDone,
  rateParkingIdea,
  deleteParkingItem,
  startContextLog,
  finalizeContextLog,
  incrementContextDistraction,
  getRecentContexts,
  getContextStatsSummary,
  getAppDistractionSummary,
  loadGlobalShortcuts,
  saveGlobalShortcuts,
  WorkStoryEntry,
  CloudAuthState,
  DEFAULT_CLOUD_AUTH,
  addWorkStoryEntry,
  getWorkStoryEntries,
  deleteWorkStoryEntry,
  loadCloudAuthState,
  saveCloudAuthState,
  markParkingItemsKeepSynced,
  getPendingSyncCount,
} from "./db";
import {
  CropRegionPct,
  captureScreenCompressed,
  captureScreenSnapshotRaw,
  compressAndCropDataUrl,
} from "./screenshot";
import {
  signInWithGoogleAccount,
  signOutGoogleAccount,
  syncWithCloudServer,
  syncParkingToGoogleDocs,
} from "./cloudSync";
import { UpdateStatus, checkForUpdate, installUpdate } from "./updater";
import { translations, resolveLanguage } from "./i18n";
import { ConfettiCanvas } from "./Confetti";
import type { CaptureSubmittedEvent } from "./QuickCapture";
import {
  EMPTY_PARKING,
  NavPage,
  ShortcutStatus,
  TagFormState,
  UPDATE_CHECK_INTERVAL_MS,
  formatClock,
} from "./constants";
import {
  playAlarmChime,
  playBreakChime,
  playCelebrationFanfare,
} from "./lib/audio";
import { hexToRgba, isLightColor } from "./lib/color";
import { buildSingleItemParkingData } from "./components/ParkingLot";
import { MiniDock } from "./components/MiniDock";
import {
  BreakOverdueModal,
  DistractModal,
  EarlyStopModal,
  LightboxModal,
  ShortBreakPromptModal,
  WorkTopicModal,
} from "./components/SessionModals";
import { TimerPage } from "./pages/TimerPage";
import { MenuPage } from "./pages/MenuPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  SummaryPage,
  SummaryReasonsTabType,
  SummaryTabType,
} from "./pages/SummaryPage";
import { DashboardPage } from "./pages/DashboardPage";
import "./App.css";

function persistSnapshots(appState: AppState, runtimeState: RuntimeState) {
  saveAppState(appState).catch((err) =>
    console.error("Durum kaydedilemedi:", err),
  );
  saveRuntimeState(runtimeState).catch((err) =>
    console.error("Çalışma zamanı durumu kaydedilemedi:", err),
  );
}

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

  // Her zaman üstte kalma (Always on Top)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);

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

  // Dikkatim Dağıldı Kutusu (6 Kategori + Açık Sekme Yakalama)
  const [showDistractBox, setShowDistractBox] = useState(false);
  const [distractTags, setDistractTags] = useState<TagItem[]>([]);
  const [selectedDistractTag, setSelectedDistractTag] =
    useState<string>("Diğer");
  const [distractPreviousReasons, setDistractPreviousReasons] = useState<
    string[]
  >([]);
  const [distractReasonText, setDistractReasonText] = useState("");
  const [distractCategory, setDistractCategory] =
    useState<DistractionCategory>("internal");
  const [detectedActiveApp, setDetectedActiveApp] = useState<{
    appName: string;
    windowTitle: string;
  }>({ appName: "", windowTitle: "" });
  const [isEditingDistractTags, setIsEditingDistractTags] = useState(false);

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
  const [shortBreakDraft, setShortBreakDraft] = useState<string>("");

  const [reminderBanner, setReminderBanner] = useState<{
    kind?: "context" | "short_break";
    text: string;
  } | null>(null);

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
    "distraction" | "context" | null
  >(null);

  // Satır-İçi Tag Ekle / Düzenle / Sil Formu (window.prompt / window.confirm yerine)
  const [tagForm, setTagForm] = useState<TagFormState | null>(null);

  // Çalışma <-> Mola Geçiş Animasyonu
  const [isModeSwitching, setIsModeSwitching] = useState(false);
  const prevTimerModeRef = useRef<TimerMode>("work");

  // Sağ Alt Mini Sayaç Widget (isMiniDock) & Özel Pencere Boyutları
  const [isMiniDock, setIsMiniDock] = useState(false);
  const [miniDockContextToast, setMiniDockContextToast] = useState<
    string | null
  >(null);
  const miniDockToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const savedNormalPosRef = useRef<{ x: number; y: number } | null>(null);
  const [customSizes, setCustomSizes] = useState<CustomWindowSizes>({});
  const [currentWinSize, setCurrentWinSize] = useState<{
    w: number;
    h: number;
  }>({
    w: 315,
    h: 362,
  });
  const [sizeSavedFlash, setSizeSavedFlash] = useState(false);

  // Distracted İçi (3·S) Mini Screenshot Önizleme & Bölge Kırpıcı + 5dk Çalışma Hikayesi + Bulut & Google Docs
  const [distractRawShot, setDistractRawShot] = useState<string>("");
  const [distractPreviewShot, setDistractPreviewShot] = useState<string>("");
  const [distractCropBox, setDistractCropBox] = useState<CropRegionPct | null>(
    null,
  );

  const [workStoryEntries, setWorkStoryEntries] = useState<WorkStoryEntry[]>(
    [],
  );
  const [lightboxEntry, setLightboxEntry] = useState<WorkStoryEntry | null>(
    null,
  );
  const lastPeriodicShotSecRef = useRef<number>(0);

  const [cloudAuth, setCloudAuth] =
    useState<CloudAuthState>(DEFAULT_CLOUD_AUTH);
  const [cloudEmailInput, setCloudEmailInput] = useState<string>("");
  const [cloudNameInput, setCloudNameInput] = useState<string>("");
  const [cloudTokenInput, setCloudTokenInput] = useState<string>("");
  const [cloudServerInput, setCloudServerInput] = useState<string>(
    DEFAULT_CLOUD_AUTH.serverUrl,
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [docsStatusMsg, setDocsStatusMsg] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Uygulama İçi Geri Bildirim (Feedback) & ADHD Öz-Farkındalık Verisi
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackCat, setFeedbackCat] = useState<FeedbackCategory>("feature");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCopied, setFeedbackCopied] = useState(false);
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

  // Zaman Damgası Referansları (24s Çizelge için)
  const workStartedAtRef = useRef<string | null>(null);
  const breakStartedAtRef = useRef<string | null>(null);
  const lastAlarmPlayRef = useRef<number>(0);

  // İstatistikler ve Özet verisi
  const [dayStats, setDayStats] = useState<ActiveDayStats>({
    dayId: 1,
    label: "Bugün",
    totalSec: 0,
    sessionCount: 0,
    avgSec: 0,
  });
  const [summaryDays, setSummaryDays] = useState<DaySummary[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(
    null,
  );
  const [summaryTab, setSummaryTab] = useState<SummaryTabType>("timeline");
  const [summaryReasonsTab, setSummaryReasonsTab] =
    useState<SummaryReasonsTabType>("work");
  const [summaryReasonsData, setSummaryReasonsData] =
    useState<SummaryReasonsData | null>(null);
  const [timelineSessions, setTimelineSessions] = useState<
    TimelineSessionItem[]
  >([]);
  const [hoveredTimelineItem, setHoveredTimelineItem] =
    useState<TimelineSessionItem | null>(null);
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [hoveredDay, setHoveredDay] = useState<DaySummary | null>(null);
  const [hoveredWeekDay, setHoveredWeekDay] = useState<WeekDayStat | null>(
    null,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [freqOnlyToday, setFreqOnlyToday] = useState(false);

  // Arka planda gizliyken bile sürenin şaşmaması için zaman referansı
  const lastTickRef = useRef<number>(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);

  // Renk ayarları ve uzaktan güncelleme
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const themeDirtyRef = useRef(false);
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
  };

  const distractPenaltyRef = useRef<number>(distractPenaltyMins);
  distractPenaltyRef.current = distractPenaltyMins;
  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;
  const freqOnlyTodayRef = useRef(freqOnlyToday);
  freqOnlyTodayRef.current = freqOnlyToday;

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
        const days = await getDaysSummary();
        const weekly = await getWeeklySummary(locale);
        const penalty = await loadDistractPenalty();
        const savedTheme = await loadThemeSettings();

        setLangPref(savedLang);
        setDayStats(stats);
        setSummaryDays(days);
        setWeeklySummary(weekly);
        setDistractPenaltyMins(penalty);
        setTheme(savedTheme);

        // Tag listelerini yükle
        const dTags = await getTags(
          "distraction",
          currentT.defaultDistractionTags,
        );
        const eTags = await getTags("ending", currentT.defaultEndingTags);
        const wTags = await getTags("work", currentT.defaultWorkTags);
        const boTags = await getTags(
          "break_overtime",
          currentT.defaultBreakOvertimeTags,
        );
        setDistractTags(dTags);
        setEndingTags(eTags);
        setWorkTags(wTags);
        setBreakOverdueTags(boTags);

        const defaultWorkTag =
          wTags[0]?.name || currentT.defaultWorkTags[0] || "Ders";
        setCurrentWorkTag(defaultWorkTag);
        setSelectedWorkTopicTag(defaultWorkTag);
        if (boTags.length > 0) setSelectedBreakOverdueTag(boTags[0].name);

        const savedAlwaysOnTop = await loadAlwaysOnTop();
        setAlwaysOnTop(savedAlwaysOnTop);
        await getCurrentWindow()
          .setAlwaysOnTop(savedAlwaysOnTop)
          .catch(() => {});

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

          if (savedRuntime.sessionActive) {
            setWorkSecondsLeft(
              saved.work_seconds_left || validPlan.workMins * 60,
            );
            setWorkElapsedSec(saved.work_elapsed_sec);
            setBreakSecondsLeft(saved.break_seconds_left);
            setIsRunning(true);
            const normalizedPage: NavPage =
              saved.page === "timer" ||
              saved.page === "work" ||
              saved.page === "break"
                ? "timer"
                : saved.page === "summary" || saved.page === "settings"
                  ? saved.page
                  : "menu";
            setPage(normalizedPage);
          } else {
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
        } else {
          // v0.1.9 veya öncesinden yükseltme: yarım kalmış bir çalışma/mola varsa koru
          const hadInProgressSession =
            saved.work_elapsed_sec > 0 || saved.page === "break";
          if (hadInProgressSession) {
            setSessionActive(true);
            setIsRunning(true);
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
            setPage(
              saved.page === "work" ||
                saved.page === "break" ||
                saved.page === "timer"
                ? "timer"
                : saved.page,
            );
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

        const timeline = await getTimelineSessions(stats.dayId);
        setTimelineSessions(timeline);

        const loadedSizes = await loadCustomWindowSizes();
        setCustomSizes(loadedSizes);
        setFeedbacks(await getFeedbacks());

        const loadedShortcuts = await loadGlobalShortcuts();
        setShortcuts(loadedShortcuts);
        invoke<ShortcutStatus>("update_global_shortcuts", {
          distractionShortcut: loadedShortcuts.distractionShortcut,
          contextShortcut: loadedShortcuts.contextShortcut,
        })
          .then(setShortcutStatus)
          .catch(() => {});

        setBreakParkingData(await getParkingLotData(false));
        setRecentContexts(await getRecentContexts(6));
        setWorkStoryEntries(await getWorkStoryEntries(false, 40));

        const loadedAuth = await loadCloudAuthState();
        setCloudAuth(loadedAuth);
        setCloudEmailInput(loadedAuth.email || "");
        setCloudNameInput(loadedAuth.name || "");
        setCloudTokenInput(loadedAuth.accessToken || "");
        setCloudServerInput(
          loadedAuth.serverUrl || DEFAULT_CLOUD_AUTH.serverUrl,
        );
        setPendingSyncCount(await getPendingSyncCount());

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

      setLoaded(true);
    })();
  }, []);

  // Çevrimiçi / Çevrimdışı takip ve internet geri geldiğinde kuyruğu otomatik sunucuya gönderme
  const triggerBackgroundCloudSync = async () => {
    try {
      const cnt = await getPendingSyncCount();
      setPendingSyncCount(cnt);
      const auth = await loadCloudAuthState();
      if (!auth.email) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        return;
      }
      const res = await syncWithCloudServer();
      setPendingSyncCount(res.pendingCount);
      if (res.ok) {
        setCloudAuth(await loadCloudAuthState());
      }
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    if (!loaded) return;
    const onOnline = () => {
      setIsOnline(true);
      triggerBackgroundCloudSync();
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    triggerBackgroundCloudSync();
    const syncTimer = setInterval(() => {
      triggerBackgroundCloudSync();
    }, 45_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(syncTimer);
    };
  }, [loaded]);

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
            await getWorkStoryEntries(freqOnlyTodayRef.current, 40),
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
        getParkingLotData(false)
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
    showShortBreakPrompt;

  // Sağ alt mini sayaç widget'ını konumlandırma ve kısa süreli Son Meşguliyet (Last Context) gösterimi
  const positionMiniDockWindow = async (withToast: boolean) => {
    try {
      const win = getCurrentWindow();
      const scale = await win.scaleFactor();
      const miniW = withToast ? 236 : 152;
      const miniH = withToast ? 66 : 44;
      await win.setSize(new LogicalSize(miniW, miniH));
      const mon = await currentMonitor();
      if (mon) {
        const physW = Math.round(miniW * scale);
        const physH = Math.round(miniH * scale);
        const targetX =
          mon.position.x + mon.size.width - physW - Math.round(14 * scale);
        const targetY =
          mon.position.y + mon.size.height - physH - Math.round(52 * scale);
        await win.setPosition(new PhysicalPosition(targetX, targetY));
      }
      await win.show();
    } catch (err) {
      console.error("Mini widget konumlandırılamadı:", err);
    }
  };

  const triggerMiniDockContextToast = (customText?: string) => {
    const rt = runtimeStateRef.current;
    const ctxText =
      customText?.trim() ||
      rt.currentContext.trim() ||
      (rt.workTag
        ? `${rt.workTag}${rt.workReason ? `: ${rt.workReason}` : ""}`
        : "");
    const displayToast = ctxText || t.qcContextNone;
    setMiniDockContextToast(displayToast);
    if (miniDockToastTimerRef.current) {
      clearTimeout(miniDockToastTimerRef.current);
    }
    positionMiniDockWindow(true);
    miniDockToastTimerRef.current = setTimeout(() => {
      setMiniDockContextToast(null);
      positionMiniDockWindow(false);
    }, 6500);
  };

  // Sağ alt mini sayaç widget'ına (saatin yanına) küçültme ve normal boyuta dönme
  const enterMiniDock = async () => {
    try {
      const win = getCurrentWindow();
      if (!isMiniDock) {
        const pos = await win.outerPosition();
        savedNormalPosRef.current = { x: pos.x, y: pos.y };
      }
      setIsMiniDock(true);
      triggerMiniDockContextToast();
    } catch (err) {
      console.error("Mini widget konumlandırılamadı:", err);
    }
  };

  const exitMiniDock = async () => {
    try {
      if (miniDockToastTimerRef.current) {
        clearTimeout(miniDockToastTimerRef.current);
        miniDockToastTimerRef.current = null;
      }
      setMiniDockContextToast(null);
      const win = getCurrentWindow();
      setIsMiniDock(false);
      await win.show();
      await win.unminimize().catch(() => {});
      if (savedNormalPosRef.current) {
        await win.setPosition(
          new PhysicalPosition(
            savedNormalPosRef.current.x,
            savedNormalPosRef.current.y,
          ),
        );
      }
      await win.setFocus().catch(() => {});
    } catch (err) {
      console.error("Pencere geri yüklenemedi:", err);
    }
  };

  // Mini-Dock modundayken dikkat dağılırsa veya context güncellenirse sağ altta kısa süreli göster
  useEffect(() => {
    if (!loaded || !isMiniDock || !reminderBanner) return;
    triggerMiniDockContextToast(reminderBanner.text);
  }, [reminderBanner, isMiniDock, loaded]);

  // Sistem tepsisi (Tray) ve pencere kapatma olaylarını dinle
  useEffect(() => {
    if (!loaded) return;
    let unlistenMini: (() => void) | null = null;
    let unlistenRestore: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    (async () => {
      unlistenMini = await listen("request-mini-dock", () => {
        enterMiniDock();
      });
      unlistenRestore = await listen("tray-restore", () => {
        exitMiniDock();
      });
      const win = getCurrentWindow();
      unlistenResize = await win.onResized(async () => {
        try {
          const factor = await win.scaleFactor();
          const size = await win.innerSize();
          setCurrentWinSize({
            w: Math.round(size.width / factor),
            h: Math.round(size.height / factor),
          });
        } catch {
          // ignore
        }
      });
    })();

    return () => {
      if (unlistenMini) unlistenMini();
      if (unlistenRestore) unlistenRestore();
      if (unlistenResize) unlistenResize();
    };
  }, [loaded, isMiniDock]);

  // Sayfaya, diyaloglara, mini widget durumuna ve kullanıcı özel boyutlarına göre pencere boyutunu ayarla
  useEffect(() => {
    if (!loaded || isMiniDock) return;
    const win = getCurrentWindow();
    if (anyModalOpen) {
      const isSsModal =
        showDistractBox && distractCategory === "screenshot_note";
      const modalW = isSsModal ? 390 : 325;
      const modalH = isSsModal ? 455 : 365;
      win.setSize(new LogicalSize(modalW, modalH));
      setCurrentWinSize({ w: modalW, h: modalH });
      return;
    }
    const targetPage = page as SizeTargetPage;
    const custom = customSizes[targetPage];
    const hasBreakParking =
      targetPage === "timer" &&
      sessionActive &&
      timerMode === "break" &&
      showBreakParking &&
      breakParkingData.totalTasks +
        breakParkingData.totalIdeas +
        breakParkingData.totalScreenshots >
        0;
    if (custom) {
      const w = hasBreakParking ? Math.max(custom.width, 345) : custom.width;
      const h = hasBreakParking ? Math.max(custom.height, 365) : custom.height;
      win.setSize(new LogicalSize(w, h));
      setCurrentWinSize({ w, h });
      return;
    }
    if (page === "menu") {
      const hasBanner =
        updateStatus.kind === "available" ||
        updateStatus.kind === "downloading";
      const h = hasBanner ? 395 : DEFAULT_WINDOW_SIZES.menu.height;
      win.setSize(new LogicalSize(DEFAULT_WINDOW_SIZES.menu.width, h));
      setCurrentWinSize({ w: DEFAULT_WINDOW_SIZES.menu.width, h });
    } else if (page === "dashboard") {
      win.setSize(
        new LogicalSize(
          DEFAULT_WINDOW_SIZES.dashboard.width,
          DEFAULT_WINDOW_SIZES.dashboard.height,
        ),
      );
      setCurrentWinSize({
        w: DEFAULT_WINDOW_SIZES.dashboard.width,
        h: DEFAULT_WINDOW_SIZES.dashboard.height,
      });
    } else if (page === "summary") {
      win.setSize(
        new LogicalSize(
          DEFAULT_WINDOW_SIZES.summary.width,
          DEFAULT_WINDOW_SIZES.summary.height,
        ),
      );
      setCurrentWinSize({
        w: DEFAULT_WINDOW_SIZES.summary.width,
        h: DEFAULT_WINDOW_SIZES.summary.height,
      });
    } else if (page === "settings") {
      win.setSize(
        new LogicalSize(
          DEFAULT_WINDOW_SIZES.settings.width,
          DEFAULT_WINDOW_SIZES.settings.height,
        ),
      );
      setCurrentWinSize({
        w: DEFAULT_WINDOW_SIZES.settings.width,
        h: DEFAULT_WINDOW_SIZES.settings.height,
      });
    } else {
      const hasBreakParking =
        sessionActive &&
        timerMode === "break" &&
        showBreakParking &&
        breakParkingData.totalTasks +
          breakParkingData.totalIdeas +
          breakParkingData.totalScreenshots >
          0;
      const w = hasBreakParking ? 345 : DEFAULT_WINDOW_SIZES.timer.width;
      const h = hasBreakParking ? 365 : DEFAULT_WINDOW_SIZES.timer.height;
      win.setSize(new LogicalSize(w, h));
      setCurrentWinSize({ w, h });
    }
  }, [
    page,
    anyModalOpen,
    showDistractBox,
    distractCategory,
    loaded,
    updateStatus.kind,
    isMiniDock,
    customSizes,
    sessionActive,
    timerMode,
    showBreakParking,
    breakParkingData.totalTasks,
    breakParkingData.totalIdeas,
    breakParkingData.totalScreenshots,
  ]);

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
    lastTickRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);
      if (delta < 1) return;
      lastTickRef.current += delta * 1000;

      const rt = runtimeStateRef.current;
      const appSt = appStateRef.current;

      if (rt.mode === "work") {
        setWorkSecondsLeft(Math.max(0, appSt.work_seconds_left - delta));
        setWorkElapsedSec(appSt.work_elapsed_sec + delta);
      } else {
        const prevLeft = appSt.break_seconds_left;
        if (prevLeft > 0) {
          if (prevLeft > delta) {
            setBreakSecondsLeft(prevLeft - delta);
            setBreakElapsedSec(rt.breakElapsedSec + delta);
          } else {
            // Mola tam bu adımda doldu: aşan kısmı gecikmeye yaz ve alarm çal
            const overflow = delta - prevLeft;
            setBreakSecondsLeft(0);
            setBreakElapsedSec(rt.breakElapsedSec + prevLeft);
            setBreakOverdueSec(rt.breakOverdueSec + overflow);
            if (rt.breakKind === "short" && rt.currentContext.trim()) {
              setReminderBanner({
                kind: "context",
                text: rt.currentContext.trim(),
              });
            }
            playAlarmChime();
            lastAlarmPlayRef.current = now;
          }
        } else {
          setBreakOverdueSec(rt.breakOverdueSec + delta);
          if (now - lastAlarmPlayRef.current >= 12000) {
            playAlarmChime();
            lastAlarmPlayRef.current = now;
          }
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isRunning, sessionActive]);

  // Çalışma süresi 0'a ulaştığında otomatik kaydet ve molaya geç
  useEffect(() => {
    if (!isRunning || !sessionActive) return;
    if (timerMode === "work" && workSecondsLeft === 0) {
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

      setIsCelebrating(true);
      playCelebrationFanfare();

      const nextCompleted = completedWorkCount + 1;
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

      // Bir sonraki çalışma için sayacı planın çalışma süresine hazırla
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      setCurrentSessionDistractions(0);
      setActiveContextLogId(null);
      setContextStartedAtElapsedSec(0);
      workStartedAtRef.current = null;

      // Otomatik molaya geç ve başlat
      setBreakKind(bKind);
      setTimerMode("break");
      setBreakSecondsLeft(bSec);
      setBreakTotalSec(bSec);
      setBreakElapsedSec(0);
      setBreakOverdueSec(0);
      setBreakOvertimeAccumSec(0);
      setIsRunning(true);
      playBreakChime();
      breakStartedAtRef.current = finishedEndedAt;

      (async () => {
        if (finishedCtxId) {
          await finalizeContextLog(finishedCtxId, finishedCtxDelta);
        }
        await recordWorkSession(
          finishedElapsed,
          finishedTag,
          finishedReason,
          finishedStartedAt,
          finishedEndedAt,
        );
        const locale = activeLang === "tr" ? "tr-TR" : "en-US";
        setDayStats(await getActiveDayStats(locale));
        setWeeklySummary(await getWeeklySummary(locale));
        setTimelineSessions(await getTimelineSessions());
        setBreakParkingData(await getParkingLotData(false));
      })();
    }
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
  ]);

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
    const w = Math.max(220, Math.round(size.width / factor));
    const h = Math.max(110, Math.round(size.height / factor));
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
    const win = getCurrentWindow();
    const targetPage = page as SizeTargetPage;
    const std = DEFAULT_WINDOW_SIZES[targetPage] || DEFAULT_WINDOW_SIZES.menu;
    await win.setSize(new LogicalSize(std.width, std.height));
    setCurrentWinSize({ w: std.width, h: std.height });
  };

  // Uygulama İçi Geri Bildirim (Feedback) İşlemleri
  const handleAddFeedbackItem = async () => {
    if (!feedbackText.trim()) return;
    await addFeedback(feedbackCat, feedbackText.trim());
    setFeedbackText("");
    setFeedbacks(await getFeedbacks());
  };

  const handleDeleteFeedbackItem = async (id: number) => {
    await deleteFeedback(id);
    setFeedbacks(await getFeedbacks());
  };

  const handleCopyAllFeedbacks = async () => {
    if (feedbacks.length === 0) return;
    const lines = feedbacks.map(
      (f, idx) =>
        `${idx + 1}. [${f.category.toUpperCase()}] (${f.created_at.slice(0, 10)})\n${f.message}`,
    );
    await navigator.clipboard.writeText(lines.join("\n\n")).catch(() => {});
    setFeedbackCopied(true);
    setTimeout(() => setFeedbackCopied(false), 1800);
  };

  const handleOpenGithubFeedback = async () => {
    const title = encodeURIComponent(
      `[Feedback] ${feedbackText.trim().slice(0, 50) || "Pomodoro Widget"}`,
    );
    const body = encodeURIComponent(
      feedbackText.trim() ||
        feedbacks.map((f) => `- **[${f.category}]** ${f.message}`).join("\n"),
    );
    await openUrl(
      `https://github.com/elyashan/tauri-pomodoro/issues/new?title=${title}&body=${body}`,
    ).catch(() => {});
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
      case "screenshot_note":
        return trObj.catScreenshotNote;
      case "internal":
        return trObj.catInternal;
      case "external":
        return trObj.catExternal;
      case "escape":
        return trObj.catEscape;
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

  // Hem Global Spotlight Hem Widget İçi Ortak Dikkat / Görev / Fikir / SS Notu İşleyici
  const processDistractionSubmission = async (params: {
    category: DistractionCategory;
    reasonText: string;
    tag?: string;
    activeApp: string;
    activeWindow: string;
    screenshotData?: string;
  }) => {
    const rt = runtimeStateRef.current;
    const appSt = appStateRef.current;
    const lang = activeLangRef.current;
    const trObj = translations[lang];
    const catLabel = getCategoryDisplayName(params.category, lang);
    const cleanText = params.reasonText.trim() || catLabel;
    const effectiveCtx =
      rt.currentContext.trim() ||
      (rt.workTag
        ? `${rt.workTag}${rt.workReason ? `: ${rt.workReason}` : ""}`
        : "");

    const addsPenalty = doesCategoryAddPenalty(params.category);
    const penaltyMins = distractPenaltyRef.current;
    let appliedPenaltySec = 0;

    if (
      addsPenalty &&
      rt.sessionActive &&
      rt.mode === "work" &&
      penaltyMins > 0
    ) {
      appliedPenaltySec = penaltyMins * 60;
      setWorkSecondsLeft((prev) => prev + appliedPenaltySec);
    }

    if (rt.sessionActive) {
      setCurrentSessionDistractions((prev) => prev + 1);
    }

    if (rt.activeContextLogId) {
      await incrementContextDistraction(rt.activeContextLogId);
    }

    // 1: Dürtüsel Görev, 2: Akla Gelen Fikir, 3: SS Notu -> Mola Otoparkına ekleme sırasına göre kaydedilir (süre eklenmez!)
    if (
      params.category === "impulsive_task" ||
      params.category === "idea" ||
      params.category === "screenshot_note"
    ) {
      await addParkingItem({
        itemType:
          params.category === "screenshot_note"
            ? "screenshot"
            : params.category === "impulsive_task"
              ? "task"
              : "idea",
        content: cleanText,
        activeApp: params.activeApp,
        activeWindow: params.activeWindow,
        contextText: effectiveCtx,
        screenshotData: params.screenshotData,
      });
      setBreakParkingData(await getParkingLotData(false));
      setSummaryParkingData(await getParkingLotData(freqOnlyTodayRef.current));
    }

    // SS Notu veya Ekran Görüntüsü varsa Çalışma Hikayesi galerisine de ekle
    if (params.category === "screenshot_note" || params.screenshotData) {
      await addWorkStoryEntry({
        entryType: "screenshot_note",
        screenshotData: params.screenshotData,
        activeApp: params.activeApp,
        activeWindow: params.activeWindow,
        contextText: effectiveCtx,
        workTag: rt.workTag,
        note: cleanText,
        elapsedWorkSec: rt.sessionActive ? appSt.work_elapsed_sec : 0,
      });
      setWorkStoryEntries(
        await getWorkStoryEntries(freqOnlyTodayRef.current, 40),
      );
    }

    await recordDistraction({
      reason: cleanText,
      tag: params.tag?.trim() || catLabel,
      elapsedWorkSec: rt.sessionActive ? appSt.work_elapsed_sec : 0,
      category: params.category,
      activeApp: params.activeApp,
      activeWindow: params.activeWindow,
      contextText: effectiveCtx,
      penaltySec: appliedPenaltySec,
    });

    triggerBackgroundCloudSync();

    // Sebebi yazdıktan sonra ekrana son kalınan meşguliyet (context) gelsin
    setReminderBanner({
      kind: "context",
      text: effectiveCtx || trObj.qcContextNone,
    });
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
      processDistractionSubmission({
        category: ev.category || "internal",
        reasonText: ev.text,
        activeApp: ev.activeApp,
        activeWindow: ev.activeWindow,
        screenshotData: ev.screenshotData,
      }).catch((err) => console.error("Hızlı yakalama kaydedilemedi:", err));
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
  // SEANS BAŞLATMA & SEANS BİTİRME (SESSION LIFECYCLE)
  // ---------------------------------------------------------------------------
  const handleStartSession = async () => {
    setPlanDropdownOpen(false);
    setIsCelebrating(false);

    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const freshStats = await beginSessionDay(locale);
    setDayStats(freshStats);
    setTimelineSessions(await getTimelineSessions(freshStats.dayId));

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
    setCurrentSessionDistractions(0);

    workStartedAtRef.current = nowIso;
    breakStartedAtRef.current = null;
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
    setIsRunning(false);
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    setShowDistractBox(false);
    setShowStopBox(false);
    setShowBreakOverdueBox(false);
    setShowWorkTopicBox(false);
    setShowShortBreakPrompt(false);

    const nowIso = new Date().toISOString();

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
    setCurrentSessionDistractions(0);
    setCompletedWorkCount(0);
    setSessionShortBreakCount(0);
    setCurrentContext("");
    setActiveContextLogId(null);
    setContextStartedAtElapsedSec(0);
    setReminderBanner(null);
    workStartedAtRef.current = null;
    breakStartedAtRef.current = null;

    await saveSessionCycleStats(0, 0);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const freshStats = await startNewDay(locale);
    setDayStats(freshStats);
    setWeeklySummary(await getWeeklySummary(locale));
    setTimelineSessions(await getTimelineSessions(freshStats.dayId));
    setBreakParkingData(await getParkingLotData(false));
    setPage("menu");
  };

  // ---------------------------------------------------------------------------
  // DİKKAT DAĞILMASI İŞLEMLERİ (6 KATEGORİ: 3. ŞIK SS NOTU + AÇIK SEKME + CONTEXT)
  // ---------------------------------------------------------------------------
  const handleDistractedClick = async () => {
    if (!sessionActive) return;

    const fg = await invoke<{ appName: string; windowTitle: string }>(
      "get_last_active_window",
    ).catch(() => ({ appName: "", windowTitle: "" }));
    setDetectedActiveApp(fg);

    captureScreenSnapshotRaw(false)
      .then((raw) => {
        if (raw?.dataUrl) {
          setDistractRawShot(raw.dataUrl);
          setDistractPreviewShot(raw.dataUrl);
        }
      })
      .catch(() => {});
    setDistractCropBox(null);

    const loadedTags = await getTags("distraction", t.defaultDistractionTags);
    setDistractTags(loadedTags);
    const initialTag = loadedTags[0]?.name || t.other;
    setSelectedDistractTag(initialTag);

    const prevReasons = await getPreviousReasons("distraction", initialTag);
    setDistractPreviousReasons(prevReasons);
    setDistractReasonText("");
    setDistractCategory("internal");
    setTagForm(null);
    setShowDistractBox(true);
  };

  const handleSelectDistractTag = async (tagName: string) => {
    setSelectedDistractTag(tagName);
    const prevReasons = await getPreviousReasons("distraction", tagName);
    setDistractPreviousReasons(prevReasons);
  };

  const handleRetakeDistractScreenshot = async () => {
    const raw = await captureScreenSnapshotRaw(false);
    if (raw?.dataUrl) {
      setDistractRawShot(raw.dataUrl);
      setDistractPreviewShot(raw.dataUrl);
      setDistractCropBox(null);
    }
  };

  const submitDistraction = async () => {
    const fallbackLabel =
      distractCategory === "impulsive_task" ||
      distractCategory === "idea" ||
      distractCategory === "screenshot_note"
        ? getCategoryDisplayName(distractCategory)
        : selectedDistractTag;
    const reason = distractReasonText.trim() || fallbackLabel;

    let finalShot: string | undefined = undefined;
    if (distractCategory === "screenshot_note") {
      if (distractRawShot) {
        finalShot = await compressAndCropDataUrl(
          distractRawShot,
          distractCropBox,
          760,
          0.72,
        );
      } else {
        const compressed = await captureScreenCompressed(
          false,
          distractCropBox,
          760,
          0.72,
        );
        finalShot = compressed.dataUrl || undefined;
      }
    }

    await processDistractionSubmission({
      category: distractCategory,
      reasonText: reason,
      tag: selectedDistractTag,
      activeApp: detectedActiveApp.appName,
      activeWindow: detectedActiveApp.windowTitle,
      screenshotData: finalShot,
    });
    setShowDistractBox(false);
    setDistractReasonText("");
    setDistractRawShot("");
    setDistractPreviewShot("");
    setDistractCropBox(null);
    setIsEditingDistractTags(false);
    setTagForm(null);
  };

  // ---------------------------------------------------------------------------
  // ERKEN BİTİRME (STOP) İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleStopSession = async () => {
    setIsRunning(false);
    if (timerMode === "work") {
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
      setIsRunning(true);
    }
  };

  const handleSelectEndingTag = async (tagName: string) => {
    setSelectedEndingTag(tagName);
    const prevReasons = await getPreviousReasons("ending", tagName);
    setEndingPreviousReasons(prevReasons);
  };

  const submitEnding = async (withTag = true) => {
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
    workStartedAtRef.current = null;
    setShowStopBox(false);
    setEndingReasonText("");
    setIsEditingEndingTags(false);
    setPage("menu");
  };

  // ---------------------------------------------------------------------------
  // MOLA, KISA MOLA, KONU SEÇİMİ, ALWAYS ON TOP & EXPORT
  // ---------------------------------------------------------------------------
  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    await saveAlwaysOnTop(next);
    await getCurrentWindow().setAlwaysOnTop(next).catch(() => {});
  };

  const handleTakeShortBreak = () => {
    if (!sessionActive) return;
    setShortBreakDraft(currentContext || "");
    setShowShortBreakPrompt(true);
  };

  const confirmStartShortBreak = async () => {
    if (!sessionActive) return;
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
  };

  const handleExtendBreak5m = () => {
    if (breakOverdueSec > 0) {
      setBreakOvertimeAccumSec((prev) => prev + breakOverdueSec);
      setBreakOverdueSec(0);
      setBreakSecondsLeft(5 * 60);
      setBreakTotalSec((prev) => prev + 5 * 60);
      setIsRunning(true);
    } else {
      setBreakSecondsLeft((prev) => prev + 5 * 60);
      setBreakTotalSec((prev) => prev + 5 * 60);
    }
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

  const handleOpenBreakOverdueBox = async () => {
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
    const totalOvertime = breakOvertimeAccumSec + breakOverdueSec;
    const actualBreakSec = breakElapsedSec + totalOvertime;
    const defaultTag =
      breakKind === "short"
        ? t.breakModeShortLabel
        : breakKind === "long"
          ? t.breakModeLongLabel
          : t.breakModeStdLabel;

    if (actualBreakSec >= 10) {
      const hasOvertimeReason = totalOvertime >= 10 && !skipReason;
      const tag = hasOvertimeReason ? selectedBreakOverdueTag : defaultTag;
      const reason = hasOvertimeReason
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
    setBreakElapsedSec(0);
    setBreakOverdueSec(0);
    setBreakOvertimeAccumSec(0);
    breakStartedAtRef.current = null;

    if (breakKind === "short") {
      setWorkSecondsLeft(savedWorkSecondsLeft);
      setWorkElapsedSec(savedWorkElapsedSec);
      setContextStartedAtElapsedSec(savedWorkElapsedSec);
      if (currentContext.trim()) {
        setReminderBanner({
          kind: "context",
          text: currentContext.trim(),
        });
      }
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
      workStartedAtRef.current = autoRunWork ? new Date().toISOString() : null;
      if (currentContext.trim() && autoRunWork) {
        const cId = await startContextLog({
          contextText: currentContext.trim(),
          workTag: currentWorkTag,
        });
        setActiveContextLogId(cId);
      }
    }

    setTimerMode("work");
    setPage("timer");
    setIsRunning(autoRunWork);
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
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const d = new Date().toISOString().slice(0, 10);
      a.download = `pomodoro-backup-${d}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
        setSelectedDistractTag(pickedName);
      } else if (kind === "ending") {
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
        if (kind === "distraction") {
          setDistractTags(
            await getTags("distraction", t.defaultDistractionTags),
          );
          if (selectedDistractTag === currentName) {
            setSelectedDistractTag(trimmed);
          }
        } else if (kind === "ending") {
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
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
      } else if (kind === "ending") {
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

  // ---------------------------------------------------------------------------
  // GOOGLE DOCS / DRIVE DEFTERİ & BULUT SENKRONİZASYON İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleSyncParkingToDocs = async () => {
    setDocsStatusMsg("...");
    try {
      const pData = await getParkingLotData(false);
      const res = await syncParkingToGoogleDocs(pData);
      setDocsStatusMsg(res.message);
      if (res.ok) {
        if (res.docUrl) {
          setCloudAuth((prev) => ({
            ...prev,
            googleDocUrl: res.docUrl || prev.googleDocUrl,
            googleDocId: res.documentId || prev.googleDocId,
          }));
        }
        const allIds = [
          ...pData.pendingTasks,
          ...pData.doneTasks,
          ...pData.unratedIdeas,
          ...pData.importantIdeas,
          ...pData.unimportantIdeas,
          ...pData.screenshotNotes,
        ].map((it) => it.id);
        await markParkingItemsKeepSynced(allIds, res.docUrl);
        await refreshParkingViews();
      }
      setTimeout(() => setDocsStatusMsg(null), 4000);
    } catch (err) {
      setDocsStatusMsg(String(err));
      setTimeout(() => setDocsStatusMsg(null), 4000);
    }
  };

  const handleSyncSingleItemToDocs = async (item: ParkingItem) => {
    setDocsStatusMsg("...");
    try {
      const singleData = buildSingleItemParkingData(item);
      const res = await syncParkingToGoogleDocs(singleData, {
        singleItem: item,
      });
      setDocsStatusMsg(res.message);
      if (res.ok) {
        if (res.docUrl) {
          setCloudAuth((prev) => ({
            ...prev,
            googleDocUrl: res.docUrl || prev.googleDocUrl,
            googleDocId: res.documentId || prev.googleDocId,
          }));
        }
        await markParkingItemsKeepSynced([item.id], res.docUrl);
        await refreshParkingViews();
      }
      setTimeout(() => setDocsStatusMsg(null), 4000);
    } catch (err) {
      setDocsStatusMsg(String(err));
      setTimeout(() => setDocsStatusMsg(null), 4000);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!cloudEmailInput.trim()) return;
    const res = await signInWithGoogleAccount({
      email: cloudEmailInput.trim(),
      name: cloudNameInput.trim() || undefined,
      accessToken: cloudTokenInput.trim() || undefined,
      serverUrl: cloudServerInput.trim() || undefined,
    });
    setCloudAuth(res.auth);
    setSyncStatusMsg(res.message);
    await triggerBackgroundCloudSync();
    setTimeout(() => setSyncStatusMsg(null), 2500);
  };

  const handleGoogleSignOut = async () => {
    const auth = await signOutGoogleAccount();
    setCloudAuth(auth);
    setCloudEmailInput("");
    setCloudNameInput("");
    setCloudTokenInput("");
    setSyncStatusMsg(null);
  };

  const handleSaveCloudToken = async () => {
    const nextAuth = { ...cloudAuth, accessToken: cloudTokenInput.trim() };
    await saveCloudAuthState(nextAuth);
    setCloudAuth(nextAuth);
    setSyncStatusMsg("Google Token kaydedildi!");
    setTimeout(() => setSyncStatusMsg(null), 3000);
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    setSyncStatusMsg(t.syncRunning);
    try {
      const res = await syncWithCloudServer();
      setPendingSyncCount(res.pendingCount);
      setSyncStatusMsg(res.message);
      setCloudAuth(await loadCloudAuthState());
      const pData = await getParkingLotData(freqOnlyTodayRef.current);
      setSummaryParkingData(pData);
      setBreakParkingData(await getParkingLotData(false));
      setWorkStoryEntries(
        await getWorkStoryEntries(freqOnlyTodayRef.current, 40),
      );
    } catch (err) {
      setSyncStatusMsg(String(err));
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setSyncStatusMsg(null), 3500);
    }
  };

  const openDashboard = async () => {
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const days = await getDaysSummary();
    const weekly = await getWeeklySummary(locale);
    const reasonsData = await getSummaryReasonsData(freqOnlyToday);
    const timeline = await getTimelineSessions();
    const insights = await getAdhdInsights(freqOnlyToday);
    const pData = await getParkingLotData(freqOnlyToday);
    const cStats = await getContextStatsSummary(freqOnlyToday);
    const aStats = await getAppDistractionSummary(freqOnlyToday);
    const wStory = await getWorkStoryEntries(freqOnlyToday, 40);

    setSummaryDays(days);
    setWeeklySummary(weekly);
    setSummaryReasonsData(reasonsData);
    setTimelineSessions(timeline);
    setAdhdInsights(insights);
    setSummaryParkingData(pData);
    setContextStats(cStats);
    setAppDistractions(aStats);
    setWorkStoryEntries(wStory);
    setPendingSyncCount(await getPendingSyncCount());
    setPage("dashboard");
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
    setTagForm(null);
    if (sessionActive) {
      setIsRunning(true);
    }
    setDayStats(
      await getActiveDayStats(activeLang === "tr" ? "tr-TR" : "en-US"),
    );
    setPage("menu");
  };

  const openSummary = async () => {
    setIsCelebrating(false);
    setPlanDropdownOpen(false);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const days = await getDaysSummary();
    const weekly = await getWeeklySummary(locale);
    const reasonsData = await getSummaryReasonsData(freqOnlyToday);
    const timeline = await getTimelineSessions();
    const insights = await getAdhdInsights(freqOnlyToday);
    const pData = await getParkingLotData(freqOnlyToday);
    const cStats = await getContextStatsSummary(freqOnlyToday);
    const aStats = await getAppDistractionSummary(freqOnlyToday);

    setSummaryDays(days);
    setWeeklySummary(weekly);
    setSummaryReasonsData(reasonsData);
    setTimelineSessions(timeline);
    setAdhdInsights(insights);
    setSummaryParkingData(pData);
    setContextStats(cStats);
    setAppDistractions(aStats);
    setHoveredDay(days[days.length - 1] ?? null);
    const todayWeekDay =
      weekly.days.find((d) => d.is_today) ??
      weekly.days[weekly.days.length - 1] ??
      null;
    setHoveredWeekDay(todayWeekDay);
    setShowResetConfirm(false);
    setPage("summary");
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
  };

  // Mola Otoparkı & Özet Otoparkı Etkileşimleri (Veritabanına Ekleme Sırasıyla Kaydedilir)
  const refreshParkingViews = async () => {
    setBreakParkingData(await getParkingLotData(false));
    setSummaryParkingData(await getParkingLotData(freqOnlyTodayRef.current));
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

  const handleDeleteWorkStoryItem = async (id: number) => {
    await deleteWorkStoryEntry(id);
    setLightboxEntry(null);
    setWorkStoryEntries(await getWorkStoryEntries(freqOnlyTodayRef.current, 40));
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

  const handleResetAllData = async () => {
    setIsRunning(false);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    await clearAllData(locale);
    const freshStats = await getActiveDayStats(locale);
    const freshDays = await getDaysSummary();
    const freshWeekly = await getWeeklySummary(locale);
    const freshReasons = await getSummaryReasonsData(false);
    const freshTimeline = await getTimelineSessions(freshStats.dayId);

    setSessionActive(false);
    setTimerMode("work");
    setWorkSecondsLeft(currentPlan.workMins * 60);
    setWorkElapsedSec(0);
    setBreakSecondsLeft(currentPlan.standardBreakMins * 60);
    setBreakTotalSec(currentPlan.standardBreakMins * 60);
    setBreakElapsedSec(0);
    setBreakOverdueSec(0);
    setBreakOvertimeAccumSec(0);
    setCurrentSessionDistractions(0);
    setCompletedWorkCount(0);
    setSessionShortBreakCount(0);
    setCurrentContext("");
    setActiveContextLogId(null);
    setContextStartedAtElapsedSec(0);
    setReminderBanner(null);
    setBreakParkingData(EMPTY_PARKING);
    setSummaryParkingData(EMPTY_PARKING);
    setContextStats([]);
    setAppDistractions([]);
    setRecentContexts([]);
    workStartedAtRef.current = null;
    breakStartedAtRef.current = null;

    setDayStats(freshStats);
    setSummaryDays(freshDays);
    setWeeklySummary(freshWeekly);
    setSummaryReasonsData(freshReasons);
    setTimelineSessions(freshTimeline);
    setHoveredDay(null);
    setHoveredWeekDay(null);
    setHoveredTimelineItem(null);
    setShowResetConfirm(false);
  };

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    themeDirtyRef.current = true;
    setTheme((prev) => ({ ...prev, ...patch }));
  };

  const handleLanguageChange = async (newPref: LangCode) => {
    setLangPref(newPref);
    await saveLanguagePreference(newPref);
    const newActive = resolveLanguage(newPref);
    const newT = translations[newActive];
    setDistractTags(await getTags("distraction", newT.defaultDistractionTags));
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
            ✕
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

  const isBreakAlarm =
    sessionActive && timerMode === "break" && breakOverdueSec > 0;
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

  const maxRecentHours = Math.max(
    1,
    ...summaryDays.map((d) => d.total_sec / 3600),
  );
  const maxWeeklyHours = Math.max(
    1,
    ...(weeklySummary?.days.map((d) => d.total_sec / 3600) ?? [1]),
  );

  const updateAvailable = updateStatus.kind === "available";
  const shellStyle = {
    "--shell-bg": hexToRgba(theme.bgColor, theme.bgOpacity / 100),
    "--shell-bg-solid": hexToRgba(theme.bgColor, theme.bgOpacity / 100 + 0.11),
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
        miniDockContextToast={miniDockContextToast}
        shellStyle={shellStyle}
        sessionActive={sessionActive}
        timerMode={timerMode}
        breakKind={breakKind}
        liveClockStr={liveClockStr}
        progressPct={progressPct}
        t={t}
        onMouseDown={handleMouseDown}
        onExitMiniDock={exitMiniDock}
        onHideToTray={hideToTray}
      />
    );
  }

  const breakParkingTotalCount =
    breakParkingData.totalTasks +
    breakParkingData.totalIdeas +
    breakParkingData.totalScreenshots;
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

      {isTimerAlarmView && (
        <div className="alarm-badge">
          {t.breakOverdueBadge(formatClock(breakOverdueSec))}
        </div>
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
                  ? "var(--timer-color, #fbbf24)"
                  : "#38bdf8",
            }}
          />
        </div>
      )}

      {/* =====================================================================
          ORTAK TAG & AÇIKLAMA DİYALOGLARI (Kısa Mola Notu, Konu, Dağılma, Erken Bitirme, Gecikme)
         ===================================================================== */}
      {showShortBreakPrompt ? (
        <ShortBreakPromptModal
          t={t}
          currentContext={currentContext}
          recentContexts={recentContexts}
          shortBreakDraft={shortBreakDraft}
          onChangeDraft={setShortBreakDraft}
          onConfirm={confirmStartShortBreak}
          onCancel={() => setShowShortBreakPrompt(false)}
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
          {...tagHandlers}
          t={t}
          currentContext={currentContext}
          fullTopicLabel={fullTopicLabel}
          detectedActiveApp={detectedActiveApp}
          distractCategory={distractCategory}
          distractPenaltyMins={distractPenaltyMins}
          distractPreviewShot={distractPreviewShot}
          distractCropBox={distractCropBox}
          distractTags={distractTags}
          selectedDistractTag={selectedDistractTag}
          distractPreviousReasons={distractPreviousReasons}
          distractReasonText={distractReasonText}
          isEditingDistractTags={isEditingDistractTags}
          getCategoryDisplayName={(cat) => getCategoryDisplayName(cat)}
          onChangeCategory={setDistractCategory}
          onChangeCropBox={setDistractCropBox}
          onRetakeScreenshot={handleRetakeDistractScreenshot}
          onToggleEditTags={() => {
            setIsEditingDistractTags(!isEditingDistractTags);
            setTagForm(null);
          }}
          onSelectTag={handleSelectDistractTag}
          onChangeReasonText={setDistractReasonText}
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
          totalOvertimeSec={breakOvertimeAccumSec + breakOverdueSec}
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
              currentWorkTag={currentWorkTag}
              fullTopicLabel={fullTopicLabel}
              currentContext={currentContext}
              shortcuts={shortcuts}
              currentCycleIndex={currentCycleIndex}
              sessionShortBreakCount={sessionShortBreakCount}
              currentSessionDistractions={currentSessionDistractions}
              currentBreakShortName={currentBreakShortName}
              currentBreakFullTooltip={currentBreakFullTooltip}
              breakParkingTotalCount={breakParkingTotalCount}
              hasBreakParkingView={hasBreakParkingView}
              breakParkingData={breakParkingData}
              docsStatusMsg={docsStatusMsg}
              alwaysOnTop={alwaysOnTop}
              updateAvailable={updateAvailable}
              isBreakAlarm={isBreakAlarm}
              breakOverdueSec={breakOverdueSec}
              activeSeconds={activeSeconds}
              hasPausedProgress={hasPausedProgress}
              workElapsedSec={workElapsedSec}
              distractPenaltyMins={distractPenaltyMins}
              reminderBanner={reminderBanner}
              onOpenWorkTopicBox={handleOpenWorkTopicBox}
              onOpenQuickCapture={openQuickCaptureFromUi}
              onToggleBreakParking={() => setShowBreakParking((p) => !p)}
              onToggleAlwaysOnTop={toggleAlwaysOnTop}
              onOpenMenu={openMenu}
              onEnterMiniDock={enterMiniDock}
              onDismissReminderBanner={() => setReminderBanner(null)}
              onSyncParkingToDocs={handleSyncParkingToDocs}
              onSyncSingleItemToDocs={handleSyncSingleItemToDocs}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onOpenLightbox={setLightboxEntry}
              onStartWorkFromBreak={handleStartWorkFromBreak}
              onExtendBreak5m={handleExtendBreak5m}
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
              alwaysOnTop={alwaysOnTop}
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
              currentContext={currentContext}
              shortcuts={shortcuts}
              getPlanDisplayName={getPlanDisplayName}
              onToggleAlwaysOnTop={toggleAlwaysOnTop}
              onOpenDashboard={openDashboard}
              onOpenSummary={openSummary}
              onOpenSettings={openSettings}
              onEnterMiniDock={enterMiniDock}
              onInstallUpdate={handleInstallUpdate}
              onTogglePlanDropdown={() => setPlanDropdownOpen((prev) => !prev)}
              onSelectPlan={handleSelectPlan}
              onOpenWorkTopicBox={handleOpenWorkTopicBox}
              onOpenQuickCapture={openQuickCaptureFromUi}
              onReturnToTimer={() => {
                setIsCelebrating(false);
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
              alwaysOnTop={alwaysOnTop}
              shortcuts={shortcuts}
              shortcutStatus={shortcutStatus}
              recordingShortcutFor={recordingShortcutFor}
              studyPlans={studyPlans}
              editingPlanId={editingPlanId}
              theme={theme}
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
              onToggleAlwaysOnTop={toggleAlwaysOnTop}
              onResetShortcuts={handleResetShortcuts}
              onSetRecordingShortcutFor={setRecordingShortcutFor}
              onApplyShortcuts={handleApplyShortcuts}
              onOpenQuickCapture={openQuickCaptureFromUi}
              onResetPlansDefault={handleResetPlansDefault}
              onSetEditingPlanId={setEditingPlanId}
              onUpdatePlanField={handleUpdatePlanField}
              onUpdateTheme={updateTheme}
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
            />
          )}

          {page === "summary" && (
            <SummaryPage
              t={t}
              activeLang={activeLang}
              summaryTab={summaryTab}
              summaryReasonsTab={summaryReasonsTab}
              summaryParkingData={summaryParkingData}
              workStoryEntries={workStoryEntries}
              showResetConfirm={showResetConfirm}
              hoveredTimelineItem={hoveredTimelineItem}
              timelineSessions={timelineSessions}
              weeklySummary={weeklySummary}
              summaryReasonsData={summaryReasonsData}
              hoveredWeekDay={hoveredWeekDay}
              maxWeeklyHours={maxWeeklyHours}
              hoveredDay={hoveredDay}
              summaryDays={summaryDays}
              maxRecentHours={maxRecentHours}
              adhdInsights={adhdInsights}
              freqOnlyToday={freqOnlyToday}
              docsStatusMsg={docsStatusMsg}
              contextStats={contextStats}
              appDistractions={appDistractions}
              expandedTags={expandedTags}
              onSetSummaryTab={setSummaryTab}
              onSetSummaryReasonsTab={setSummaryReasonsTab}
              onOpenDashboard={openDashboard}
              onOpenMenu={openMenu}
              onSetShowResetConfirm={setShowResetConfirm}
              onResetAllData={handleResetAllData}
              onSetHoveredTimelineItem={setHoveredTimelineItem}
              onSetHoveredWeekDay={setHoveredWeekDay}
              onSetHoveredDay={setHoveredDay}
              onToggleFreqFilter={toggleFreqFilter}
              onSyncParkingToDocs={handleSyncParkingToDocs}
              onSyncSingleItemToDocs={handleSyncSingleItemToDocs}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onOpenLightbox={setLightboxEntry}
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
              workStoryEntries={workStoryEntries}
              contextStats={contextStats}
              appDistractions={appDistractions}
              onToggleFreqFilter={toggleFreqFilter}
              onOpenSummary={openSummary}
              onOpenMenu={openMenu}
              onEnterMiniDock={enterMiniDock}
              onManualCloudSync={handleManualCloudSync}
              onGoogleSignOut={handleGoogleSignOut}
              onGoogleSignIn={handleGoogleSignIn}
              onSaveCloudToken={handleSaveCloudToken}
              onSetCloudEmailInput={setCloudEmailInput}
              onSetCloudNameInput={setCloudNameInput}
              onSetCloudTokenInput={setCloudTokenInput}
              onSetCloudServerInput={setCloudServerInput}
              onSyncParkingToDocs={handleSyncParkingToDocs}
              onSyncSingleItemToDocs={handleSyncSingleItemToDocs}
              onToggleParkingTask={handleToggleParkingTask}
              onRateParkingIdea={handleRateParkingIdea}
              onDeleteParkingEntry={handleDeleteParkingEntry}
              onOpenLightbox={setLightboxEntry}
            />
          )}

          {lightboxEntry && (
            <LightboxModal
              entry={lightboxEntry}
              t={t}
              onClose={() => setLightboxEntry(null)}
              onDelete={handleDeleteWorkStoryItem}
            />
          )}
        </>
      )}
    </div>
  );
}
