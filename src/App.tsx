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
  syncParkingToGoogleKeep,
} from "./cloudSync";
import { UpdateStatus, checkForUpdate, installUpdate } from "./updater";
import { translations, resolveLanguage } from "./i18n";
import { ConfettiCanvas } from "./Confetti";
import type { CaptureSubmittedEvent } from "./QuickCapture";
import "./App.css";

interface ShortcutStatus {
  distractionShortcut: string;
  contextShortcut: string;
  distractionOk: boolean;
  distractionError: string | null;
  contextOk: boolean;
  contextError: string | null;
}

const DISTRACT_CATEGORIES: DistractionCategory[] = [
  "impulsive_task",
  "idea",
  "screenshot_note",
  "internal",
  "external",
  "escape",
];

function formatKeyCombo(e: React.KeyboardEvent): string | null {
  const ignore = new Set(["Control", "Shift", "Alt", "Meta"]);
  if (ignore.has(e.key)) return null;

  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (mods.length === 0) return null;

  let keyToken = "";
  if (e.code.startsWith("Key")) {
    keyToken = e.code.slice(3).toUpperCase();
  } else if (e.code.startsWith("Digit")) {
    keyToken = e.code.slice(5);
  } else if (e.code === "Space" || e.key === " ") {
    keyToken = "Space";
  } else if (/^F([1-9]|1[0-2])$/i.test(e.key)) {
    keyToken = e.key.toUpperCase();
  } else if (e.code === "Backquote") {
    keyToken = "Backquote";
  } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
    keyToken = e.key.toUpperCase();
  }

  if (!keyToken) return null;
  return [...mods, keyToken].join("+");
}

const EMPTY_PARKING: ParkingLotData = {
  pendingTasks: [],
  doneTasks: [],
  unratedIdeas: [],
  importantIdeas: [],
  unimportantIdeas: [],
  screenshotNotes: [],
  totalTasks: 0,
  totalIdeas: 0,
  totalScreenshots: 0,
};

type NavPage = "menu" | "timer" | "summary" | "settings" | "dashboard";

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 saat

const BG_PRESETS = [
  "#1a1814",
  "#0f172a",
  "#1e1b4b",
  "#052e16",
  "#3f0d12",
  "#27272a",
  "#e7e5e4",
];
const TIMER_PRESETS = [
  "#ffffff",
  "#fbbf24",
  "#60a5fa",
  "#4ade80",
  "#f87171",
  "#c084fc",
  "#18181b",
];

const PENALTY_OPTIONS = [0, 1, 2, 3, 5];

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

function isLightColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function persistSnapshots(appState: AppState, runtimeState: RuntimeState) {
  saveAppState(appState).catch((err) =>
    console.error("Durum kaydedilemedi:", err),
  );
  saveRuntimeState(runtimeState).catch((err) =>
    console.error("Çalışma zamanı durumu kaydedilemedi:", err),
  );
}

function playCelebrationFanfare() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.16 }, // C5
      { freq: 659.25, time: 0.13, dur: 0.16 }, // E5
      { freq: 783.99, time: 0.26, dur: 0.2 }, // G5
      { freq: 1046.5, time: 0.42, dur: 0.45 }, // C6
      { freq: 1318.51, time: 0.58, dur: 0.7 }, // E6
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.05);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch {
    // Ses cihazı meşgulse sessizce geç
  }
}

function playBreakChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 587.33, time: 0.0, dur: 0.22 }, // D5
      { freq: 880.0, time: 0.16, dur: 0.4 }, // A5
    ];
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.05);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ses cihazı meşgulse sessizce geç
  }
}

function playAlarmChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 880.0, time: 0.0, dur: 0.12 },
      { freq: 880.0, time: 0.15, dur: 0.18 },
    ];
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.04);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ses cihazı meşgulse sessizce geç
  }
}

export default function App() {
  const [loaded, setLoaded] = useState(false);

  // Navigasyon sayfası ("menu" | "timer" | "summary" | "settings") ile
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
  const [savedWorkSecondsLeft, setSavedWorkSecondsLeft] = useState<number>(DEFAULT_WORK_SEC);
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
  const [selectedBreakOverdueTag, setSelectedBreakOverdueTag] = useState<string>("Telefon");
  const [breakOverduePrevReasons, setBreakOverduePrevReasons] = useState<string[]>([]);
  const [breakOverdueReasonText, setBreakOverdueReasonText] = useState("");
  const [isEditingBreakOverdueTags, setIsEditingBreakOverdueTags] = useState(false);

  // Çalışma Konusu (Subject / Task)
  const [currentWorkTag, setCurrentWorkTag] = useState<string>("Ders");
  const [currentWorkReason, setCurrentWorkReason] = useState<string>("");
  const [showWorkTopicBox, setShowWorkTopicBox] = useState(false);
  const [workTags, setWorkTags] = useState<TagItem[]>([]);
  const [selectedWorkTopicTag, setSelectedWorkTopicTag] = useState<string>("Ders");
  const [workTopicReasonText, setWorkTopicReasonText] = useState("");
  const [workPrevReasons, setWorkPrevReasons] = useState<string[]>([]);
  const [isEditingWorkTags, setIsEditingWorkTags] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [autoStartOn, setAutoStartOn] = useState(false);

  // Dikkat Dağılma Ek Süresi (Dakika) ve Seans İçi Dağılma Sayacı
  const [distractPenaltyMins, setDistractPenaltyMins] = useState(1);
  const [currentSessionDistractions, setCurrentSessionDistractions] = useState(0);

  // Dikkatim Dağıldı Kutusu (5 Kategori + Açık Sekme Yakalama)
  const [showDistractBox, setShowDistractBox] = useState(false);
  const [distractTags, setDistractTags] = useState<TagItem[]>([]);
  const [selectedDistractTag, setSelectedDistractTag] = useState<string>("Diğer");
  const [distractPreviousReasons, setDistractPreviousReasons] = useState<string[]>([]);
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
  const [tagForm, setTagForm] = useState<{
    mode: "add" | "edit" | "delete";
    kind: TagKind;
    tagId?: number;
    currentName?: string;
    value: string;
  } | null>(null);

  // Çalışma <-> Mola Geçiş Animasyonu
  const [isModeSwitching, setIsModeSwitching] = useState(false);
  const prevTimerModeRef = useRef<TimerMode>("work");

  // Sağ Alt Mini Sayaç Widget (isMiniDock) & Özel Pencere Boyutları
  const [isMiniDock, setIsMiniDock] = useState(false);
  const [miniDockContextToast, setMiniDockContextToast] = useState<string | null>(
    null,
  );
  const miniDockToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const savedNormalPosRef = useRef<{ x: number; y: number } | null>(null);
  const [customSizes, setCustomSizes] = useState<CustomWindowSizes>({});
  const [currentWinSize, setCurrentWinSize] = useState<{ w: number; h: number }>({
    w: 315,
    h: 362,
  });
  const [sizeSavedFlash, setSizeSavedFlash] = useState(false);

  // Distracted İçi (3·S) Mini Screenshot Önizleme & Bölge Kırpıcı + 5dk Çalışma Hikayesi + Bulut & Google Keep
  const [distractRawShot, setDistractRawShot] = useState<string>("");
  const [distractPreviewShot, setDistractPreviewShot] = useState<string>("");
  const [distractCropBox, setDistractCropBox] = useState<CropRegionPct | null>(
    null,
  );
  const [distractDragStart, setDistractDragStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const distractPreviewRef = useRef<HTMLDivElement | null>(null);

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
  const [keepStatusMsg, setKeepStatusMsg] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Uygulama İçi Geri Bildirim (Feedback) & ADHD Öz-Farkındalık Verisi
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackCat, setFeedbackCat] = useState<FeedbackCategory>("feature");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCopied, setFeedbackCopied] = useState(false);
  const [adhdInsights, setAdhdInsights] = useState<AdhdInsightsData | null>(null);

  // Erken Durdurma Kutusu
  const [showStopBox, setShowStopBox] = useState(false);
  const [endingTags, setEndingTags] = useState<TagItem[]>([]);
  const [selectedEndingTag, setSelectedEndingTag] = useState<string>("Diğer");
  const [endingPreviousReasons, setEndingPreviousReasons] = useState<string[]>([]);
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
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [summaryTab, setSummaryTab] = useState<
    "timeline" | "weekly" | "recent" | "parking" | "story" | "adhd"
  >("timeline");
  const [summaryReasonsTab, setSummaryReasonsTab] = useState<
    "work" | "contexts" | "apps" | "overtime" | "distractions" | "endings"
  >("work");
  const [summaryReasonsData, setSummaryReasonsData] = useState<SummaryReasonsData | null>(
    null,
  );
  const [timelineSessions, setTimelineSessions] = useState<TimelineSessionItem[]>([]);
  const [hoveredTimelineItem, setHoveredTimelineItem] = useState<TimelineSessionItem | null>(null);
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [hoveredDay, setHoveredDay] = useState<DaySummary | null>(null);
  const [hoveredWeekDay, setHoveredWeekDay] = useState<WeekDayStat | null>(null);
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
        const dTags = await getTags("distraction", currentT.defaultDistractionTags);
        const eTags = await getTags("ending", currentT.defaultEndingTags);
        const wTags = await getTags("work", currentT.defaultWorkTags);
        const boTags = await getTags("break_overtime", currentT.defaultBreakOvertimeTags);
        setDistractTags(dTags);
        setEndingTags(eTags);
        setWorkTags(wTags);
        setBreakOverdueTags(boTags);

        const defaultWorkTag = wTags[0]?.name || currentT.defaultWorkTags[0] || "Ders";
        setCurrentWorkTag(defaultWorkTag);
        setSelectedWorkTopicTag(defaultWorkTag);
        if (boTags.length > 0) setSelectedBreakOverdueTag(boTags[0].name);

        const savedAlwaysOnTop = await loadAlwaysOnTop();
        setAlwaysOnTop(savedAlwaysOnTop);
        await getCurrentWindow().setAlwaysOnTop(savedAlwaysOnTop).catch(() => {});

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
            setWorkSecondsLeft(saved.work_seconds_left || validPlan.workMins * 60);
            setWorkElapsedSec(saved.work_elapsed_sec);
            setBreakSecondsLeft(saved.break_seconds_left);
            setIsRunning(true);
            const normalizedPage: NavPage =
              saved.page === "timer" || saved.page === "work" || saved.page === "break"
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
              Math.max(saved.break_seconds_left, validPlan.standardBreakMins * 60),
            );
            setPage(
              saved.page === "work" || saved.page === "break" || saved.page === "timer"
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
      saveSessionCycleStats(nextCompleted, sessionShortBreakCount).catch(() => {});

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

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
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

    if (addsPenalty && rt.sessionActive && rt.mode === "work" && penaltyMins > 0) {
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

  const captureHandlerRef = useRef<(ev: CaptureSubmittedEvent) => void>(() => {});
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
    const current =
      fresh.find((p) => p.id === activePlanId) || fresh[0];
    if (!isRunning && workElapsedSec === 0 && timerMode === "work") {
      setWorkSecondsLeft(current.workMins * 60);
    }
  };

  const handleOpenBreakOverdueBox = async () => {
    const loadedTags = await getTags("break_overtime", t.defaultBreakOvertimeTags);
    setBreakOverdueTags(loadedTags);
    const initial = loadedTags[0]?.name || t.defaultBreakOvertimeTags[0] || t.other;
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
    const initial = currentWorkTag || loadedTags[0]?.name || t.defaultWorkTags[0];
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

  const handleDeleteTagItem = (
    tagId: number,
    name: string,
    kind: TagKind,
  ) => {
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
          if (selectedDistractTag === currentName) setSelectedDistractTag(trimmed);
        } else if (kind === "ending") {
          setEndingTags(await getTags("ending", t.defaultEndingTags));
          if (selectedEndingTag === currentName) setSelectedEndingTag(trimmed);
        } else if (kind === "work") {
          setWorkTags(await getTags("work", t.defaultWorkTags));
          if (currentWorkTag === currentName) setCurrentWorkTag(trimmed);
          if (selectedWorkTopicTag === currentName) setSelectedWorkTopicTag(trimmed);
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

  const renderInlineTagForm = (kind: TagKind) => {
    if (!tagForm || tagForm.kind !== kind) return null;
    if (tagForm.mode === "delete") {
      return (
        <div className="inline-tag-form delete-mode">
          <span
            className="inline-tag-label"
            title={t.deleteTagConfirm(tagForm.currentName || "")}
          >
            🗑 {t.deleteTagConfirm(tagForm.currentName || "")}
          </span>
          <button className="warn-btn" onClick={submitTagForm}>
            ✓
          </button>
          <button onClick={() => setTagForm(null)}>{t.cancel}</button>
        </div>
      );
    }
    return (
      <div className="inline-tag-form">
        <input
          className="inline-tag-input"
          placeholder={
            tagForm.mode === "add"
              ? t.newTagPrompt
              : t.editTagPrompt(tagForm.currentName || "")
          }
          value={tagForm.value}
          autoFocus
          onChange={(e) => setTagForm({ ...tagForm, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitTagForm();
            if (e.key === "Escape") setTagForm(null);
          }}
        />
        <button className="primary-btn" onClick={submitTagForm}>
          {tagForm.mode === "add" ? t.add : t.doneEditing}
        </button>
        <button onClick={() => setTagForm(null)}>{t.cancel}</button>
      </div>
    );
  };

  // Mola Otoparkı & Özet Otoparkı Ortak Render Yardımcısı (Görevler Ekleme Sırasıyla + Fikirler Önemli/Önemsiz + SS Notları + Keep Butonu)
  const renderParkingItemTooltip = (item: ParkingItem): string => {
    const parts: string[] = [];
    if (item.context_text) {
      parts.push(`🎯 ${item.context_text}`);
    }
    if (item.active_app || item.active_window) {
      parts.push(
        `🌐 ${item.active_app || ""}${
          item.active_window ? ` — ${item.active_window}` : ""
        }`,
      );
    }
    return parts.join(" • ");
  };

  const renderParkingLotContent = (
    data: ParkingLotData,
    isBreakView: boolean,
  ) => {
    const renderTaskRow = (item: ParkingItem, isDone: boolean) => (
      <div
        key={item.id}
        className="parking-todo-row"
        title={renderParkingItemTooltip(item)}
      >
        <label className="parking-todo-left">
          <input
            type="checkbox"
            checked={isDone}
            onChange={() => handleToggleParkingTask(item.id, !isDone)}
          />
          <span className={`parking-todo-text ${isDone ? "done" : ""}`}>
            {item.content}
          </span>
        </label>
        <div className="parking-row-right">
          <button
            type="button"
            className={`keep-chip-btn ${item.keep_synced ? "synced" : ""}`}
            onClick={() => handleSyncSingleItemToKeep(item)}
            title={item.keep_synced ? t.keepSyncedBadge : "Google Keep"}
          >
            {item.keep_synced ? "✓" : "🟨"}
          </button>
          <button
            type="button"
            className="tag-icon-btn del-btn"
            onClick={() => handleDeleteParkingEntry(item.id)}
            title={t.cancel}
          >
            ✕
          </button>
        </div>
      </div>
    );

    const renderIdeaRow = (item: ParkingItem) => (
      <div
        key={item.id}
        className="parking-idea-row"
        title={renderParkingItemTooltip(item)}
      >
        <span className="parking-todo-text">{item.content}</span>
        <div className="parking-idea-actions">
          <button
            type="button"
            className={`idea-rate-btn ${
              item.status === "important" ? "active-imp" : ""
            }`}
            onClick={() =>
              handleRateParkingIdea(
                item.id,
                item.status === "important" ? "unrated" : "important",
              )
            }
          >
            {t.parkingMarkImportant}
          </button>
          <button
            type="button"
            className={`idea-rate-btn ${
              item.status === "unimportant" ? "active-unimp" : ""
            }`}
            onClick={() =>
              handleRateParkingIdea(
                item.id,
                item.status === "unimportant" ? "unrated" : "unimportant",
              )
            }
          >
            {t.parkingMarkUnimportant}
          </button>
          <button
            type="button"
            className={`keep-chip-btn ${item.keep_synced ? "synced" : ""}`}
            onClick={() => handleSyncSingleItemToKeep(item)}
            title={item.keep_synced ? t.keepSyncedBadge : "Google Keep"}
          >
            {item.keep_synced ? "✓" : "🟨"}
          </button>
          <button
            type="button"
            className="tag-icon-btn del-btn"
            onClick={() => handleDeleteParkingEntry(item.id)}
            title={t.cancel}
          >
            ✕
          </button>
        </div>
      </div>
    );

    const renderScreenshotRow = (item: ParkingItem) => (
      <div
        key={item.id}
        className="parking-ss-row"
        title={renderParkingItemTooltip(item)}
      >
        {item.screenshot_data && (
          <img
            src={item.screenshot_data}
            alt="ss"
            className="parking-ss-thumb"
            onClick={() =>
              setLightboxEntry({
                id: item.id,
                day_id: item.day_id,
                entry_type: "screenshot_note",
                screenshot_data: item.screenshot_data,
                active_app: item.active_app,
                active_window: item.active_window,
                context_text: item.context_text,
                work_tag: "",
                note: item.content,
                created_at: item.created_at,
                elapsed_work_sec: 0,
              })
            }
          />
        )}
        <span className="parking-todo-text">{item.content}</span>
        <div className="parking-row-right">
          <button
            type="button"
            className={`keep-chip-btn ${item.keep_synced ? "synced" : ""}`}
            onClick={() => handleSyncSingleItemToKeep(item)}
            title={item.keep_synced ? t.keepSyncedBadge : "Google Keep"}
          >
            {item.keep_synced ? "✓" : "🟨"}
          </button>
          <button
            type="button"
            className="tag-icon-btn del-btn"
            onClick={() => handleDeleteParkingEntry(item.id)}
            title={t.cancel}
          >
            ✕
          </button>
        </div>
      </div>
    );

    const totalAllCount =
      data.totalTasks + data.totalIdeas + data.totalScreenshots;

    return (
      <>
        <div className="parking-header-bar">
          {isBreakView ? (
            <div className="parking-banner-title">
              {t.parkingBreakBannerTitle}
            </div>
          ) : (
            <span className="section-subhead">
              {t.parkingTab} ({totalAllCount})
            </span>
          )}
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {keepStatusMsg && (
              <span className="keep-status-pill">{keepStatusMsg}</span>
            )}
            <button
              type="button"
              className="keep-sync-btn"
              onClick={handleSyncParkingToKeep}
              title={t.keepSyncAllBtn}
            >
              🟨 Keep
            </button>
          </div>
        </div>

        {totalAllCount === 0 ? (
          <div
            style={{
              fontSize: "9.5px",
              color: "#a1a1aa",
              padding: "4px 2px",
              textAlign: "center",
            }}
          >
            {t.parkingEmpty}
          </div>
        ) : (
          <>
            {data.pendingTasks.length > 0 && (
              <>
                <div className="parking-section-title">
                  {t.parkingPendingTasks} ({data.pendingTasks.length})
                </div>
                {data.pendingTasks.map((it) => renderTaskRow(it, false))}
              </>
            )}

            {data.doneTasks.length > 0 && (
              <>
                <div className="parking-section-title">
                  {t.parkingDoneTasks} ({data.doneTasks.length})
                </div>
                {data.doneTasks.map((it) => renderTaskRow(it, true))}
              </>
            )}

            {data.unratedIdeas.length > 0 && (
              <>
                <div className="parking-section-title">
                  {t.parkingUnratedIdeas} ({data.unratedIdeas.length})
                </div>
                {data.unratedIdeas.map((it) => renderIdeaRow(it))}
              </>
            )}

            {data.importantIdeas.length > 0 && (
              <>
                <div className="parking-section-title">
                  {t.parkingImportantIdeas} ({data.importantIdeas.length})
                </div>
                {data.importantIdeas.map((it) => renderIdeaRow(it))}
              </>
            )}

            {data.unimportantIdeas.length > 0 && (
              <>
                <div className="parking-section-title">
                  {t.parkingUnimportantIdeas} ({data.unimportantIdeas.length})
                </div>
                {data.unimportantIdeas.map((it) => renderIdeaRow(it))}
              </>
            )}

            {data.screenshotNotes.length > 0 && (
              <>
                <div className="parking-section-title">
                  {t.parkingScreenshotNotes} ({data.screenshotNotes.length})
                </div>
                {data.screenshotNotes.map((it) => renderScreenshotRow(it))}
              </>
            )}
          </>
        )}
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // GOOGLE KEEP & BULUT SENKRONİZASYON İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleSyncParkingToKeep = async () => {
    setKeepStatusMsg("...");
    try {
      const pData = await getParkingLotData(false);
      const res = await syncParkingToGoogleKeep(pData);
      setKeepStatusMsg(res.message);
      if (res.ok) {
        const allIds = [
          ...pData.pendingTasks,
          ...pData.doneTasks,
          ...pData.unratedIdeas,
          ...pData.importantIdeas,
          ...pData.unimportantIdeas,
          ...pData.screenshotNotes,
        ].map((it) => it.id);
        await markParkingItemsKeepSynced(allIds);
        await refreshParkingViews();
      }
      setTimeout(() => setKeepStatusMsg(null), 3500);
    } catch (err) {
      setKeepStatusMsg(String(err));
      setTimeout(() => setKeepStatusMsg(null), 3500);
    }
  };

  const handleSyncSingleItemToKeep = async (item: ParkingItem) => {
    setKeepStatusMsg("...");
    try {
      const singleData: ParkingLotData = {
        totalTasks: item.item_type === "task" ? 1 : 0,
        totalIdeas: item.item_type === "idea" ? 1 : 0,
        totalScreenshots: item.item_type === "screenshot" ? 1 : 0,
        pendingTasks:
          item.item_type === "task" && item.status !== "done" ? [item] : [],
        doneTasks:
          item.item_type === "task" && item.status === "done" ? [item] : [],
        unratedIdeas:
          item.item_type === "idea" && item.status === "unrated" ? [item] : [],
        importantIdeas:
          item.item_type === "idea" && item.status === "important"
            ? [item]
            : [],
        unimportantIdeas:
          item.item_type === "idea" && item.status === "unimportant"
            ? [item]
            : [],
        screenshotNotes: item.item_type === "screenshot" ? [item] : [],
      };
      const res = await syncParkingToGoogleKeep(singleData, {
        singleItem: item,
      });
      setKeepStatusMsg(res.message);
      if (res.ok) {
        await markParkingItemsKeepSynced([item.id]);
        await refreshParkingViews();
      }
      setTimeout(() => setKeepStatusMsg(null), 3500);
    } catch (err) {
      setKeepStatusMsg(String(err));
      setTimeout(() => setKeepStatusMsg(null), 3500);
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

  const isBreakAlarm = sessionActive && timerMode === "break" && breakOverdueSec > 0;
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

  const activeSeconds = timerMode === "work" ? workSecondsLeft : breakSecondsLeft;
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
      ? t.shortBreakBadge(Math.round(breakTotalSec / 60), sessionShortBreakCount)
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
      <div
        className={`widget-shell mini-dock-shell ${
          isLightColor(theme.bgColor) ? "light-theme" : ""
        } ${modeClass} ${isBreakAlarm ? "alarm-shell" : ""} ${
          miniDockContextToast ? "has-toast" : ""
        }`}
        style={shellStyle}
        onMouseDown={handleMouseDown}
        onDoubleClick={exitMiniDock}
      >
        {miniDockContextToast && (
          <div
            className="mini-dock-context-toast no-drag"
            title={`${t.qcCurrentContextLabel}: ${miniDockContextToast}`}
            onClick={exitMiniDock}
          >
            🎯 {miniDockContextToast}
          </div>
        )}

        <div className="mini-dock-row">
          <div
            className="mini-dock-left no-drag"
            onClick={exitMiniDock}
            title={t.restoreWindowTooltip}
          >
            <span className="mini-dock-icon">
              {!sessionActive
                ? "⠿"
                : isBreakAlarm
                  ? "🚨"
                  : timerMode === "work"
                    ? "💼"
                    : breakKind === "long"
                      ? "🎉"
                      : "☕"}
            </span>
            <span
              className={`mini-dock-clock ${isBreakAlarm ? "alarm" : ""}`}
            >
              {liveClockStr}
            </span>
          </div>

          <div className="mini-dock-actions no-drag">
            <button
              className="mini-dock-btn"
              onClick={exitMiniDock}
              title={t.restoreWindowTooltip}
            >
              ↗
            </button>
            <button
              className="mini-dock-btn"
              onClick={hideToTray}
              title={t.hideToTrayOnlyTooltip}
            >
              ▾
            </button>
          </div>
        </div>

        {sessionActive && (
          <div
            className="progress-bar-container"
            style={{ bottom: 2, left: 10, right: 10, height: 2 }}
          >
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
      </div>
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

  return (
    <div
      className={`widget-shell ${
        page !== "timer" || anyModalOpen || hasBreakParkingView ? "solid-bg" : ""
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
        <div className="stop-box">
          <div className="stop-box-header">
            <span className="stop-box-title">{t.shortBreakPromptTitle}</span>
          </div>
          <div className="stop-box-hint">{t.shortBreakPromptHint}</div>

          {(currentContext || recentContexts.length > 0) && (
            <div className="previous-reasons-box">
              <div className="previous-reasons-chips">
                {currentContext && (
                  <button
                    type="button"
                    className={`reason-suggestion-chip ${
                      shortBreakDraft === currentContext ? "selected" : ""
                    }`}
                    onClick={() => setShortBreakDraft(currentContext)}
                  >
                    🎯 {currentContext}
                  </button>
                )}
                {recentContexts
                  .filter((rc) => rc !== currentContext)
                  .slice(0, 4)
                  .map((rc) => (
                    <button
                      key={rc}
                      type="button"
                      className={`reason-suggestion-chip ${
                        shortBreakDraft === rc ? "selected" : ""
                      }`}
                      onClick={() => setShortBreakDraft(rc)}
                    >
                      {rc}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="new-reason-row">
            <textarea
              className="distract-textarea"
              rows={2}
              placeholder={t.shortBreakPromptPlaceholder}
              value={shortBreakDraft}
              autoFocus
              onChange={(e) => setShortBreakDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  confirmStartShortBreak();
                }
                if (e.key === "Escape") setShowShortBreakPrompt(false);
              }}
            />
          </div>

          <div className="stop-box-actions">
            <button className="primary-btn" onClick={confirmStartShortBreak}>
              {t.shortBreakStartBtn}
            </button>
            <button onClick={() => setShowShortBreakPrompt(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : showWorkTopicBox ? (
        <div className="stop-box">
          <div className="stop-box-header">
            <span className="stop-box-title">{t.whatAreYouWorkingOn}</span>
            <div style={{ display: "flex", gap: "3px" }}>
              <button
                className="ghost-btn"
                onClick={() => handleAddNewTag("work")}
                title={t.newTagPrompt}
              >
                + Tag
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setIsEditingWorkTags(!isEditingWorkTags);
                  setTagForm(null);
                }}
              >
                {isEditingWorkTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>

          {renderInlineTagForm("work")}

          <div className="section-subhead">{t.selectTagHint}</div>
          <div className="reason-chips stop-chips">
            {workTags.map((tag) => {
              const isSelected = selectedWorkTopicTag === tag.name;
              return (
                <div
                  key={tag.id}
                  className={`tag-chip-wrap ${isSelected ? "selected" : ""}`}
                >
                  <button
                    className="tag-chip-btn"
                    onClick={() => handleSelectWorkTopicTag(tag.name)}
                  >
                    {tag.name}
                  </button>
                  {isEditingWorkTags && (
                    <span className="tag-actions">
                      <button
                        className="tag-icon-btn"
                        onClick={() =>
                          handleEditTagItem(tag.id, tag.name, "work")
                        }
                      >
                        ✎
                      </button>
                      <button
                        className="tag-icon-btn del-btn"
                        onClick={() =>
                          handleDeleteTagItem(tag.id, tag.name, "work")
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {workPrevReasons.length > 0 && (
            <div className="previous-reasons-box">
              <div className="section-subhead">{t.previousReasons}</div>
              <div className="previous-reasons-chips">
                {workPrevReasons.map((r) => (
                  <button
                    key={r}
                    className="reason-suggestion-chip"
                    onClick={() => setWorkTopicReasonText(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="new-reason-row">
            <textarea
              className="distract-textarea"
              rows={2}
              placeholder={t.workTopicPlaceholder}
              value={workTopicReasonText}
              autoFocus
              onChange={(e) => setWorkTopicReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitWorkTopic();
                }
                if (e.key === "Escape") setShowWorkTopicBox(false);
              }}
            />
            <button className="primary-btn" onClick={submitWorkTopic}>
              {t.doneEditing}
            </button>
          </div>

          <div className="stop-box-actions">
            <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
              Tag: <b>{selectedWorkTopicTag}</b>
            </span>
            <button
              onClick={() => {
                setShowWorkTopicBox(false);
                setTagForm(null);
              }}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : showDistractBox ? (
        <div className="stop-box">
          <div className="stop-box-header">
            <span className="stop-box-title">{t.distractionTitle}</span>
            <div style={{ display: "flex", gap: "3px" }}>
              <button
                className="ghost-btn"
                onClick={() => handleAddNewTag("distraction")}
                title={t.newTagPrompt}
              >
                + Tag
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setIsEditingDistractTags(!isEditingDistractTags);
                  setTagForm(null);
                }}
              >
                {isEditingDistractTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>

          {renderInlineTagForm("distraction")}

          {/* Son Kalınan Context & Son Açık Uygulama / Sekme Şeridi */}
          <div className="active-app-strip">
            <div
              className="active-app-strip-row"
              title={`${t.qcCurrentContextLabel}: ${
                currentContext || fullTopicLabel
              }`}
            >
              🎯 <b>{t.qcCurrentContextLabel}:</b>{" "}
              {currentContext || fullTopicLabel}
            </div>
            {(detectedActiveApp.appName || detectedActiveApp.windowTitle) && (
              <div
                className="active-app-strip-row"
                title={`${detectedActiveApp.appName}${
                  detectedActiveApp.windowTitle
                    ? ` — ${detectedActiveApp.windowTitle}`
                    : ""
                }`}
              >
                🌐 <b>{t.qcActiveTabLabel}:</b> {detectedActiveApp.appName}
                {detectedActiveApp.windowTitle
                  ? ` — ${detectedActiveApp.windowTitle}`
                  : ""}
              </div>
            )}
          </div>

          {/* 6 Kategori Seçici (1·G Dürtüsel Görev, 2·F Fikir, 3·S SS Notu -> +0dk Otopark | 4·İ, 5·D, 6·Z -> Ceza Süresi) */}
          <div className="cat5-grid">
            {DISTRACT_CATEGORIES.map((cat) => {
              const isSel = distractCategory === cat;
              const addsPen = doesCategoryAddPenalty(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`cat5-btn ${isSel ? "active" : ""} ${
                    addsPen ? "has-pen" : "zero-pen"
                  }`}
                  onClick={() => setDistractCategory(cat)}
                  title={`${t.catKeyHints[cat]} ${getCategoryDisplayName(cat)} (${
                    addsPen
                      ? t.addsPenaltyBadge(distractPenaltyMins)
                      : t.noPenaltyParkingBadge
                  })`}
                >
                  <span className="cat5-key">{t.catKeyHints[cat]}</span>
                  <span className="cat5-lbl">
                    {getCategoryDisplayName(cat)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3·S Ekran Görüntüsü Notu Modu İçin Kompakt Önizleme & Bölge Kırpıcı */}
          {distractCategory === "screenshot_note" && (
            <div className="qc-ss-box">
              <div className="qc-ss-toolbar">
                <span className="qc-ss-hint">{t.ssCropHint}</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {distractCropBox && (
                    <button
                      type="button"
                      className="qc-mini-btn"
                      onClick={() => setDistractCropBox(null)}
                    >
                      {t.ssResetCropBtn}
                    </button>
                  )}
                  <button
                    type="button"
                    className="qc-mini-btn"
                    onClick={async () => {
                      const raw = await captureScreenSnapshotRaw(false);
                      if (raw?.dataUrl) {
                        setDistractRawShot(raw.dataUrl);
                        setDistractPreviewShot(raw.dataUrl);
                        setDistractCropBox(null);
                      }
                    }}
                  >
                    🔄
                  </button>
                </div>
              </div>

              {distractPreviewShot ? (
                <div
                  ref={distractPreviewRef}
                  className="qc-ss-preview-wrap"
                  onMouseDown={(e) => {
                    const rect =
                      distractPreviewRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const xPct = Math.max(
                      0,
                      Math.min(
                        100,
                        ((e.clientX - rect.left) / rect.width) * 100,
                      ),
                    );
                    const yPct = Math.max(
                      0,
                      Math.min(
                        100,
                        ((e.clientY - rect.top) / rect.height) * 100,
                      ),
                    );
                    setDistractDragStart({ x: xPct, y: yPct });
                    setDistractCropBox({
                      xPct,
                      yPct,
                      wPct: 0,
                      hPct: 0,
                    });
                  }}
                  onMouseMove={(e) => {
                    if (!distractDragStart || !distractPreviewRef.current)
                      return;
                    const rect =
                      distractPreviewRef.current.getBoundingClientRect();
                    const curX = Math.max(
                      0,
                      Math.min(
                        100,
                        ((e.clientX - rect.left) / rect.width) * 100,
                      ),
                    );
                    const curY = Math.max(
                      0,
                      Math.min(
                        100,
                        ((e.clientY - rect.top) / rect.height) * 100,
                      ),
                    );
                    const left = Math.min(distractDragStart.x, curX);
                    const top = Math.min(distractDragStart.y, curY);
                    const width = Math.abs(curX - distractDragStart.x);
                    const height = Math.abs(curY - distractDragStart.y);
                    setDistractCropBox({
                      xPct: left,
                      yPct: top,
                      wPct: width,
                      hPct: height,
                    });
                  }}
                  onMouseUp={() => {
                    if (
                      distractCropBox &&
                      (distractCropBox.wPct < 3 ||
                        distractCropBox.hPct < 3)
                    ) {
                      setDistractCropBox(null);
                    }
                    setDistractDragStart(null);
                  }}
                >
                  <img
                    src={distractPreviewShot}
                    alt="preview"
                    className="qc-ss-img"
                    draggable={false}
                  />
                  {distractCropBox && (
                    <div
                      className="qc-ss-crop-rect"
                      style={{
                        left: `${distractCropBox.xPct}%`,
                        top: `${distractCropBox.yPct}%`,
                        width: `${distractCropBox.wPct}%`,
                        height: `${distractCropBox.hPct}%`,
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "9px",
                    color: "#a1a1aa",
                    textAlign: "center",
                    padding: "6px",
                  }}
                >
                  {t.ssCaptureActive}
                </div>
              )}
            </div>
          )}

          <div className="section-subhead">{t.selectTagHint}</div>
          <div className="reason-chips stop-chips">
            {distractTags.map((tag) => {
              const isSelected = selectedDistractTag === tag.name;
              return (
                <div
                  key={tag.id}
                  className={`tag-chip-wrap ${isSelected ? "selected" : ""}`}
                >
                  <button
                    className="tag-chip-btn"
                    onClick={() => handleSelectDistractTag(tag.name)}
                  >
                    {tag.name}
                  </button>
                  {isEditingDistractTags && (
                    <span className="tag-actions">
                      <button
                        className="tag-icon-btn"
                        onClick={() =>
                          handleEditTagItem(tag.id, tag.name, "distraction")
                        }
                      >
                        ✎
                      </button>
                      <button
                        className="tag-icon-btn del-btn"
                        onClick={() =>
                          handleDeleteTagItem(tag.id, tag.name, "distraction")
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {distractPreviousReasons.length > 0 && (
            <div className="previous-reasons-box">
              <div className="section-subhead">{t.previousReasons}</div>
              <div className="previous-reasons-chips">
                {distractPreviousReasons.map((r) => (
                  <button
                    key={r}
                    className="reason-suggestion-chip"
                    onClick={() => setDistractReasonText(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="new-reason-row">
            <textarea
              className="distract-textarea"
              rows={2}
              placeholder={t.qcInputPlaceholders[distractCategory]}
              value={distractReasonText}
              autoFocus
              onChange={(e) => setDistractReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const idx = DISTRACT_CATEGORIES.indexOf(distractCategory);
                  const next =
                    DISTRACT_CATEGORIES[
                      (idx +
                        (e.shiftKey ? DISTRACT_CATEGORIES.length - 1 : 1)) %
                        DISTRACT_CATEGORIES.length
                    ];
                  setDistractCategory(next);
                  return;
                }
                if (e.altKey && ["1", "2", "3", "4", "5", "6"].includes(e.key)) {
                  e.preventDefault();
                  setDistractCategory(
                    DISTRACT_CATEGORIES[Number(e.key) - 1],
                  );
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitDistraction();
                }
                if (e.key === "Escape") setShowDistractBox(false);
              }}
            />
            <button className="primary-btn" onClick={submitDistraction}>
              {doesCategoryAddPenalty(distractCategory)
                ? t.saveAndAddMin(distractPenaltyMins)
                : `${t.feedbackSaveBtn} (${t.noPenaltyParkingBadge})`}
            </button>
          </div>

          <div className="stop-box-actions">
            <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
              Tag: <b>{selectedDistractTag}</b>
            </span>
            <button
              onClick={() => {
                setShowDistractBox(false);
                setTagForm(null);
              }}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : showStopBox ? (
        <div className="stop-box">
          <div className="stop-box-header">
            <span className="stop-box-title">{t.earlyStopTitle}</span>
            <div style={{ display: "flex", gap: "3px" }}>
              <button
                className="ghost-btn"
                onClick={() => handleAddNewTag("ending")}
                title={t.newTagPrompt}
              >
                + Tag
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setIsEditingEndingTags(!isEditingEndingTags);
                  setTagForm(null);
                }}
              >
                {isEditingEndingTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>
          <div className="stop-box-hint">
            {t.earlyStopWorkedTime(Math.floor(workElapsedSec / 60))}
          </div>

          {renderInlineTagForm("ending")}

          <div className="reason-chips stop-chips">
            {endingTags.map((tag) => {
              const isSelected = selectedEndingTag === tag.name;
              return (
                <div
                  key={tag.id}
                  className={`tag-chip-wrap ${isSelected ? "selected" : ""}`}
                >
                  <button
                    className="tag-chip-btn"
                    onClick={() => handleSelectEndingTag(tag.name)}
                  >
                    {tag.name}
                  </button>
                  {isEditingEndingTags && (
                    <span className="tag-actions">
                      <button
                        className="tag-icon-btn"
                        onClick={() =>
                          handleEditTagItem(tag.id, tag.name, "ending")
                        }
                      >
                        ✎
                      </button>
                      <button
                        className="tag-icon-btn del-btn"
                        onClick={() =>
                          handleDeleteTagItem(tag.id, tag.name, "ending")
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {endingPreviousReasons.length > 0 && (
            <div className="previous-reasons-box">
              <div className="section-subhead">{t.previousReasons}</div>
              <div className="previous-reasons-chips">
                {endingPreviousReasons.map((r) => (
                  <button
                    key={r}
                    className="reason-suggestion-chip"
                    onClick={() => setEndingReasonText(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="new-reason-row">
            <textarea
              className="distract-textarea"
              rows={2}
              placeholder={t.endingExplanationPlaceholder}
              value={endingReasonText}
              autoFocus
              onChange={(e) => setEndingReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEnding(true);
                }
                if (e.key === "Escape") cancelStopBox();
              }}
            />
            <button className="primary-btn" onClick={() => submitEnding(true)}>
              {t.addAndFinish}
            </button>
          </div>

          <div className="stop-box-actions">
            <button className="ghost-btn" onClick={() => submitEnding(false)}>
              {t.finishWithoutTag}
            </button>
            <button onClick={cancelStopBox}>
              {t.cancelReturn}
            </button>
          </div>
        </div>
      ) : showBreakOverdueBox ? (
        <div className="stop-box">
          <div className="stop-box-header">
            <span className="stop-box-title">{t.breakOverdueTitle}</span>
            <div style={{ display: "flex", gap: "3px" }}>
              <button
                className="ghost-btn"
                onClick={() => handleAddNewTag("break_overtime")}
                title={t.newTagPrompt}
              >
                + Tag
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setIsEditingBreakOverdueTags(!isEditingBreakOverdueTags);
                  setTagForm(null);
                }}
              >
                {isEditingBreakOverdueTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>

          <div className="stop-box-hint">
            {t.breakOverdueDesc(
              formatClock(breakOvertimeAccumSec + breakOverdueSec),
            )}
          </div>

          {renderInlineTagForm("break_overtime")}

          <div className="reason-chips stop-chips">
            {breakOverdueTags.map((tag) => {
              const isSelected = selectedBreakOverdueTag === tag.name;
              return (
                <div
                  key={tag.id}
                  className={`tag-chip-wrap ${isSelected ? "selected" : ""}`}
                >
                  <button
                    className="tag-chip-btn"
                    onClick={() => handleSelectBreakOverdueTag(tag.name)}
                  >
                    {tag.name}
                  </button>
                  {isEditingBreakOverdueTags && (
                    <span className="tag-actions">
                      <button
                        className="tag-icon-btn"
                        onClick={() =>
                          handleEditTagItem(
                            tag.id,
                            tag.name,
                            "break_overtime",
                          )
                        }
                      >
                        ✎
                      </button>
                      <button
                        className="tag-icon-btn del-btn"
                        onClick={() =>
                          handleDeleteTagItem(
                            tag.id,
                            tag.name,
                            "break_overtime",
                          )
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {breakOverduePrevReasons.length > 0 && (
            <div className="previous-reasons-box">
              <div className="section-subhead">{t.previousReasons}</div>
              <div className="previous-reasons-chips">
                {breakOverduePrevReasons.map((r) => (
                  <button
                    key={r}
                    className="reason-suggestion-chip"
                    onClick={() => setBreakOverdueReasonText(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="new-reason-row">
            <textarea
              className="distract-textarea"
              rows={2}
              placeholder={t.distractExplanationPlaceholder}
              value={breakOverdueReasonText}
              autoFocus
              onChange={(e) => setBreakOverdueReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitBreakOverdue(false);
                }
                if (e.key === "Escape") submitBreakOverdue(true);
              }}
            />
          </div>

          <div className="stop-box-actions">
            <button
              className="primary-btn"
              onClick={() => submitBreakOverdue(false)}
            >
              {t.saveAndStartWork}
            </button>
            <button onClick={() => submitBreakOverdue(true)}>
              {t.skipAndStartWork}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* =================================================================
              SAYAÇ EKRANI (ÇALIŞMA & MOLA — Kompakt, Tek Satır, Hover Detaylı)
             ================================================================= */}
          {page === "timer" && sessionActive && (
            <>
              <div
                className={
                  hasBreakParkingView ? "top-bar" : "top-bar hover-reveal"
                }
              >
                <div className="top-bar-left">
                  {timerMode === "work" ? (
                    <>
                      <span
                        className="badge"
                        title={`${t.work} (${getPlanDisplayName(currentPlan)} • ${currentPlan.workMins} ${activeLang === "tr" ? "dk" : "min"})`}
                      >
                        💼
                      </span>

                      <button
                        className="work-topic-badge"
                        onClick={handleOpenWorkTopicBox}
                        title={`${t.changeWorkTopic} — ${fullTopicLabel}`}
                      >
                        🏷️ {currentWorkTag || t.selectWorkTopic}
                      </button>

                      <button
                        type="button"
                        className="context-badge"
                        onClick={() => openQuickCaptureFromUi("context")}
                        title={`${t.qcContextHeader} (${shortcuts.contextShortcut}) — ${
                          currentContext || t.qcContextNone
                        }`}
                      >
                        🎯 {currentContext || t.setContextBadgePlaceholder}
                      </button>

                      <span
                        className="cycle-badge"
                        title={t.cycleTooltip(
                          currentCycleIndex,
                          currentPlan.longBreakInterval,
                          currentPlan.longBreakMins,
                        )}
                      >
                        🔄{" "}
                        {t.cycleProgressBadge(
                          currentCycleIndex,
                          currentPlan.longBreakInterval,
                        )}
                      </span>

                      {sessionShortBreakCount > 0 && (
                        <span
                          className="short-break-chip"
                          title={t.shortBreaksCountBadge(
                            sessionShortBreakCount,
                          )}
                        >
                          ☕ {sessionShortBreakCount}
                        </span>
                      )}

                      {currentSessionDistractions > 0 && (
                        <span
                          className="distract-chip"
                          title={t.distractionsCountTooltip(
                            currentSessionDistractions,
                          )}
                        >
                          ⚡ {currentSessionDistractions}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="badge" title={currentBreakFullTooltip}>
                        {breakKind === "short"
                          ? "☕"
                          : breakKind === "long"
                            ? "🎉"
                            : "🌴"}{" "}
                        {currentBreakShortName}
                      </span>
                      <span
                        className="cycle-badge"
                        title={t.cycleTooltip(
                          currentCycleIndex,
                          currentPlan.longBreakInterval,
                          currentPlan.longBreakMins,
                        )}
                      >
                        🔄{" "}
                        {t.cycleProgressBadge(
                          currentCycleIndex,
                          currentPlan.longBreakInterval,
                        )}
                      </span>
                      {breakParkingTotalCount > 0 && (
                        <button
                          type="button"
                          className="context-badge"
                          onClick={() => setShowBreakParking((p) => !p)}
                          title={t.parkingBreakBannerTitle}
                        >
                          {t.parkingToggleBtn(breakParkingTotalCount)}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="top-bar-right">
                  <button
                    className={`icon-btn pin-btn ${alwaysOnTop ? "pinned" : ""}`}
                    title={t.alwaysOnTopTooltip(alwaysOnTop)}
                    onClick={toggleAlwaysOnTop}
                  >
                    📌
                  </button>
                  <button
                    className="icon-btn"
                    onClick={openMenu}
                    title={
                      updateAvailable
                        ? `${t.menu} (${t.updateAvailableHint})`
                        : t.menu
                    }
                  >
                    ☰
                    {updateAvailable && <span className="update-dot" />}
                  </button>
                  <button
                    className="icon-btn"
                    title={t.miniDockTooltip}
                    onClick={enterMiniDock}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="timer-wrap">
                {isBreakAlarm ? (
                  <div className="timer-display alarm-timer">
                    -{formatClock(breakOverdueSec)}
                  </div>
                ) : (
                  <div className="timer-display">
                    {formatClock(activeSeconds)}
                  </div>
                )}

                {hasPausedProgress && (
                  <div className="resume-hint">
                    {t.resumeHint(Math.floor(workElapsedSec / 60))}
                  </div>
                )}

                {reminderBanner && (
                  <div
                    className="reminder-banner no-drag"
                    title={`${t.contextReminderPrefix} ${reminderBanner.text}`}
                  >
                    <span className="reminder-banner-text">
                      {t.contextReminderPrefix} <b>{reminderBanner.text}</b>
                    </span>
                    <button
                      type="button"
                      className="tag-icon-btn"
                      onClick={() => setReminderBanner(null)}
                      title={t.cancel}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {hasBreakParkingView && (
                <div className="parking-panel no-drag">
                  {renderParkingLotContent(breakParkingData, true)}
                </div>
              )}

              {timerMode === "break" ? (
                <div
                  className={
                    hasBreakParkingView ? "btn-row" : "btn-row hover-reveal"
                  }
                >
                  <button
                    className="primary-btn"
                    onClick={handleStartWorkFromBreak}
                    title={
                      breakKind === "short" ? t.returnToWorkBtn : t.startWorkBtn
                    }
                  >
                    {breakKind === "short"
                      ? t.returnToWorkCompact
                      : t.startWorkCompact}
                  </button>
                  <button
                    onClick={handleExtendBreak5m}
                    title={t.extendBreakTooltip}
                  >
                    {t.extendBreakCompact}
                  </button>
                  <button
                    onClick={handleStopSession}
                    title={t.stopBtnTooltip}
                  >
                    {t.stop}
                  </button>
                </div>
              ) : (
                <div className="btn-row hover-reveal">
                  <button
                    className="short-break-btn"
                    onClick={handleTakeShortBreak}
                    title={t.shortBreakBtnTooltip(currentPlan.shortBreakMins)}
                  >
                    {t.shortBreakBtn(currentPlan.shortBreakMins)}
                  </button>
                  <button
                    onClick={handleStopSession}
                    title={t.stopBtnTooltip}
                  >
                    {t.stop}
                  </button>
                  <button
                    className="warn-btn"
                    onClick={handleDistractedClick}
                    title={t.distractedBtnTooltip(distractPenaltyMins)}
                  >
                    {t.distractedBtnCompact(distractPenaltyMins)}
                  </button>
                </div>
              )}
            </>
          )}

          {/* =================================================================
              ANA MENÜ (Canlı Seans Durumu, Özel Dropdown, Seans Başlat / Bitir)
             ================================================================= */}
          {page === "menu" && (
            <>
              <div className="top-bar">
                <span className="badge">⠿ {dayStats.label}</span>
                <div className="top-bar-right">
                  <button
                    className={`icon-btn pin-btn ${alwaysOnTop ? "pinned" : ""}`}
                    title={t.alwaysOnTopTooltip(alwaysOnTop)}
                    onClick={toggleAlwaysOnTop}
                  >
                    📌
                  </button>
                  <button
                    className="ghost-btn"
                    title={t.dashboardBtn}
                    onClick={openDashboard}
                  >
                    📊 {t.dashboardBtn}
                  </button>
                  <button
                    className="ghost-btn"
                    title={t.summaryTitle}
                    onClick={openSummary}
                  >
                    📈 {t.summary}
                  </button>
                  <button
                    className="icon-btn"
                    title={t.settings}
                    onClick={openSettings}
                  >
                    ⚙
                    {updateAvailable && <span className="update-dot" />}
                  </button>
                  <button
                    className="icon-btn"
                    title={t.miniDockTooltip}
                    onClick={enterMiniDock}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card" title={t.totalWork}>
                  <div className="stat-val">
                    {t.formatDuration(dayStats.totalSec)}
                  </div>
                  <div className="stat-lbl">{t.totalWork}</div>
                </div>
                <div className="stat-card" title={t.sessions}>
                  <div className="stat-val">{dayStats.sessionCount}</div>
                  <div className="stat-lbl">{t.sessions}</div>
                </div>
                <div className="stat-card" title={t.average}>
                  <div className="stat-val">
                    {Math.round(dayStats.avgSec / 60)}{" "}
                    {activeLang === "tr" ? "dk" : "m"}
                  </div>
                  <div className="stat-lbl">{t.average}</div>
                </div>
              </div>

              {/* CANLI SEANS DURUM ÇUBUĞU */}
              {sessionActive ? (
                <div
                  className={`session-status-bar ${
                    isBreakAlarm
                      ? "active-alarm"
                      : timerMode === "work"
                        ? "active-work"
                        : "active-break"
                  }`}
                  title={t.sessionActiveTooltip(
                    timerMode === "work" ? t.work : currentBreakShortName,
                    fullTopicLabel,
                    sessionShortBreakCount,
                  )}
                >
                  <div className="session-status-left">
                    <span
                      className={`status-dot ${
                        isBreakAlarm
                          ? "alarm"
                          : !isRunning
                            ? "paused"
                            : timerMode === "work"
                              ? "work"
                              : "break"
                      }`}
                    />
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      {timerMode === "work"
                        ? `💼 ${t.work}`
                        : `☕ ${currentBreakShortName}`}
                    </span>
                    <span className="session-state-tag">
                      {isRunning ? t.statusRunning : t.statusPaused}
                    </span>
                  </div>
                  <div className="session-status-right">
                    <span
                      className="cycle-badge"
                      title={t.cycleTooltip(
                        currentCycleIndex,
                        currentPlan.longBreakInterval,
                        currentPlan.longBreakMins,
                      )}
                    >
                      🔄 {currentCycleIndex}/{currentPlan.longBreakInterval}
                    </span>
                    <span className="session-clock-pill">{liveClockStr}</span>
                  </div>
                </div>
              ) : (
                <div
                  className="session-status-bar"
                  title={t.sessionIdleTooltip}
                >
                  <div className="session-status-left">
                    <span className="status-dot" />
                    <span style={{ color: "#a1a1aa" }}>
                      {t.sessionIdleLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: "10px", color: "#71717a" }}>
                    {getPlanDisplayName(currentPlan)} • {currentPlan.workMins}
                    {activeLang === "tr" ? "dk" : "m"}
                  </span>
                </div>
              )}

              {(updateStatus.kind === "available" ||
                updateStatus.kind === "downloading") && (
                <div className="update-banner">
                  {updateStatus.kind === "available" ? (
                    <>
                      <span>{t.newVersionReady(updateStatus.version)}</span>
                      <button
                        className="primary-btn"
                        onClick={handleInstallUpdate}
                      >
                        {t.installVersion(updateStatus.version)}
                      </button>
                    </>
                  ) : (
                    <span>{t.updateDownloading(updateStatus.percent)}</span>
                  )}
                </div>
              )}

              {/* ÖZEL ÇALIŞMA PLANI SEÇİCİ & KONU SATIRI */}
              <div className="plan-picker-box no-drag">
                <div className="plan-dropdown-wrap" ref={planDropdownRef}>
                  <button
                    type="button"
                    className={`plan-dropdown-trigger ${
                      planDropdownOpen ? "open" : ""
                    }`}
                    disabled={sessionActive}
                    onClick={() => {
                      if (!sessionActive) {
                        setPlanDropdownOpen((prev) => !prev);
                      }
                    }}
                    title={
                      sessionActive
                        ? t.planLockedDuringSession
                        : t.planDetailTooltip(
                            getPlanDisplayName(currentPlan),
                            currentPlan.workMins,
                            currentPlan.shortBreakMins,
                            currentPlan.standardBreakMins,
                            currentPlan.longBreakMins,
                            currentPlan.longBreakInterval,
                          )
                    }
                  >
                    <span>📋 {getPlanDisplayName(currentPlan)}</span>
                    <span className="plan-trigger-meta">
                      <span>
                        {currentPlan.workMins}/{currentPlan.standardBreakMins}
                        {activeLang === "tr" ? "dk" : "m"} •{" "}
                        {currentPlan.longBreakInterval}+1
                      </span>
                      {!sessionActive && (
                        <span>{planDropdownOpen ? "▴" : "▾"}</span>
                      )}
                    </span>
                  </button>

                  {planDropdownOpen && !sessionActive && (
                    <div className="plan-dropdown-list">
                      {studyPlans.map((p) => {
                        const pName = getPlanDisplayName(p);
                        const isSelected = p.id === activePlanId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`plan-dropdown-item ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() => handleSelectPlan(p.id)}
                            title={t.planDetailTooltip(
                              pName,
                              p.workMins,
                              p.shortBreakMins,
                              p.standardBreakMins,
                              p.longBreakMins,
                              p.longBreakInterval,
                            )}
                          >
                            <span>{pName}</span>
                            <span className="plan-item-meta">
                              {p.workMins}/{p.standardBreakMins}
                              {activeLang === "tr" ? "dk" : "m"} •{" "}
                              {p.longBreakInterval}+1
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="plan-meta-row">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <button
                      type="button"
                      className="work-topic-badge menu-topic"
                      onClick={handleOpenWorkTopicBox}
                      title={`${t.changeWorkTopic} — ${fullTopicLabel}`}
                    >
                      🏷️ {fullTopicLabel}
                    </button>

                    <button
                      type="button"
                      className="context-badge"
                      onClick={() => openQuickCaptureFromUi("context")}
                      title={`${t.qcContextHeader} (${shortcuts.contextShortcut}) — ${
                        currentContext || t.qcContextNone
                      }`}
                    >
                      🎯 {currentContext || t.setContextBadgePlaceholder}
                    </button>
                  </div>

                  <div className="plan-chips-row">
                    <span
                      className="plan-chip highlight"
                      title={`${t.planWorkMins}: ${currentPlan.workMins}`}
                    >
                      💼{currentPlan.workMins}
                    </span>
                    <span
                      className="plan-chip"
                      title={`${t.planShortBreakMins}: ${currentPlan.shortBreakMins}`}
                    >
                      ☕{currentPlan.shortBreakMins}
                    </span>
                    <span
                      className="plan-chip"
                      title={`${t.planStandardBreakMins}: ${currentPlan.standardBreakMins}`}
                    >
                      🌴{currentPlan.standardBreakMins}
                    </span>
                    <span
                      className="plan-chip"
                      title={`${t.planLongBreakMins}: ${currentPlan.longBreakMins} (${t.planLongBreakIntervalDesc(currentPlan.longBreakInterval)})`}
                    >
                      🎉{currentPlan.longBreakMins}
                    </span>
                  </div>
                </div>
              </div>

              {/* SEANS AKSİYON BUTONLARI */}
              <div className="menu-actions">
                {sessionActive ? (
                  <>
                    <button
                      className="primary-btn"
                      onClick={() => {
                        setIsCelebrating(false);
                        setPage("timer");
                      }}
                    >
                      {timerMode === "work"
                        ? t.returnToWorkMenuBtn
                        : t.returnToBreakMenuBtn}
                    </button>
                    <button
                      className="warn-btn"
                      onClick={handleFinishSession}
                      title={t.finishSessionTooltip}
                    >
                      {t.finishSessionBtn}
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-btn full-width"
                    onClick={handleStartSession}
                    title={t.startSessionTooltip}
                  >
                    {t.startSessionBtn}
                  </button>
                )}
              </div>

              <div className="credits-bar">
                Credits by <b>Elyas</b>
              </div>
            </>
          )}

          {/* =================================================================
              AYARLAR SAYFASI
             ================================================================= */}
          {page === "settings" && (
            <>
              <div className="top-bar">
                <span className="badge">{t.settingsTitle}</span>
                <button className="ghost-btn" onClick={openMenu}>
                  ← {t.home}
                </button>
              </div>

              {/* DİL SEÇİMİ */}
              <div className="settings-section">
                <div className="settings-label">{t.langLabel}</div>
                <div className="lang-switcher">
                  <button
                    className={`lang-btn ${langPref === "auto" ? "active" : ""}`}
                    onClick={() => handleLanguageChange("auto")}
                  >
                    {t.langAuto}
                  </button>
                  <button
                    className={`lang-btn ${langPref === "tr" ? "active" : ""}`}
                    onClick={() => handleLanguageChange("tr")}
                  >
                    {t.langTr}
                  </button>
                  <button
                    className={`lang-btn ${langPref === "en" ? "active" : ""}`}
                    onClick={() => handleLanguageChange("en")}
                  >
                    {t.langEn}
                  </button>
                </div>
              </div>

              {/* DİKKAT DAĞILMA CEZA SÜRESİ */}
              <div className="settings-section">
                <div className="settings-label">{t.distractPenaltySetting}</div>
                <div
                  className="penalty-selector"
                  style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
                >
                  {PENALTY_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      className={`penalty-btn ${distractPenaltyMins === mins ? "active" : ""}`}
                      onClick={() => handlePenaltyChange(mins)}
                    >
                      {mins === 0
                        ? "0"
                        : `+${mins}${activeLang === "tr" ? "dk" : "m"}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* HER ZAMAN ÜSTTE (ALWAYS ON TOP) */}
              <div className="settings-section">
                <div className="settings-label">{t.alwaysOnTop}</div>
                <button
                  className={`penalty-btn ${alwaysOnTop ? "active" : ""}`}
                  onClick={toggleAlwaysOnTop}
                >
                  {alwaysOnTop
                    ? activeLang === "tr"
                      ? "Açık (📌 Üstte)"
                      : "Enabled (📌 On Top)"
                    : activeLang === "tr"
                      ? "Kapalı"
                      : "Disabled"}
                </button>
              </div>

              {/* GLOBAL KISAYOLLAR (EKRAN ORTASINDA HIZLI TEK SATIR INPUT) */}
              <div className="settings-section no-drag">
                <div
                  className="settings-label"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{t.shortcutsSectionTitle}</span>
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{ fontSize: "9px", padding: "2px 6px" }}
                    onClick={handleResetShortcuts}
                  >
                    {t.shortcutResetBtn}
                  </button>
                </div>

                <div className="shortcut-setting-row">
                  <span
                    className="shortcut-lbl"
                    title={t.shortcutDistractLabel}
                  >
                    {t.shortcutDistractLabel}
                  </span>
                  <button
                    type="button"
                    className={`shortcut-record-btn ${
                      recordingShortcutFor === "distraction" ? "recording" : ""
                    }`}
                    onClick={() =>
                      setRecordingShortcutFor(
                        recordingShortcutFor === "distraction"
                          ? null
                          : "distraction",
                      )
                    }
                    onBlur={() =>
                      setRecordingShortcutFor((cur) =>
                        cur === "distraction" ? null : cur,
                      )
                    }
                    onKeyDown={(e) => {
                      if (recordingShortcutFor !== "distraction") return;
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setRecordingShortcutFor(null);
                        return;
                      }
                      const combo = formatKeyCombo(e);
                      if (combo) {
                        e.preventDefault();
                        setRecordingShortcutFor(null);
                        handleApplyShortcuts({
                          ...shortcuts,
                          distractionShortcut: combo,
                        });
                      }
                    }}
                    title={t.shortcutRecordPressKeys}
                  >
                    {recordingShortcutFor === "distraction"
                      ? "..."
                      : shortcuts.distractionShortcut}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => openQuickCaptureFromUi("distraction")}
                  >
                    {t.shortcutTestBtn}
                  </button>
                </div>

                <div className="shortcut-setting-row">
                  <span className="shortcut-lbl" title={t.shortcutContextLabel}>
                    {t.shortcutContextLabel}
                  </span>
                  <button
                    type="button"
                    className={`shortcut-record-btn ${
                      recordingShortcutFor === "context" ? "recording" : ""
                    }`}
                    onClick={() =>
                      setRecordingShortcutFor(
                        recordingShortcutFor === "context" ? null : "context",
                      )
                    }
                    onBlur={() =>
                      setRecordingShortcutFor((cur) =>
                        cur === "context" ? null : cur,
                      )
                    }
                    onKeyDown={(e) => {
                      if (recordingShortcutFor !== "context") return;
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setRecordingShortcutFor(null);
                        return;
                      }
                      const combo = formatKeyCombo(e);
                      if (combo) {
                        e.preventDefault();
                        setRecordingShortcutFor(null);
                        handleApplyShortcuts({
                          ...shortcuts,
                          contextShortcut: combo,
                        });
                      }
                    }}
                    title={t.shortcutRecordPressKeys}
                  >
                    {recordingShortcutFor === "context"
                      ? "..."
                      : shortcuts.contextShortcut}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => openQuickCaptureFromUi("context")}
                  >
                    {t.shortcutTestBtn}
                  </button>
                </div>

                {recordingShortcutFor && (
                  <div style={{ fontSize: "9px", color: "#fbbf24" }}>
                    {t.shortcutRecordPressKeys}
                  </div>
                )}

                {shortcutStatus &&
                  (!shortcutStatus.distractionOk ||
                    !shortcutStatus.contextOk) && (
                    <div style={{ fontSize: "9px", color: "#fca5a5" }}>
                      {shortcutStatus.distractionError ||
                        shortcutStatus.contextError}
                    </div>
                  )}
              </div>

              {/* ÇALIŞMA PLANLARI & MOLA AYARLARI */}
              <div className="settings-section">
                <div
                  className="settings-label"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{t.editPlansTitle}</span>
                  <button
                    className="ghost-btn"
                    style={{ fontSize: "9px", padding: "2px 6px" }}
                    onClick={handleResetPlansDefault}
                  >
                    {t.resetPlansDefault}
                  </button>
                </div>

                <div className="plans-settings-wrapper">
                  <div className="plans-selector-tabs">
                    {studyPlans.map((p) => (
                      <button
                        key={p.id}
                        className={`plan-tab-btn ${editingPlanId === p.id ? "active" : ""}`}
                        onClick={() => setEditingPlanId(p.id)}
                      >
                        {getPlanDisplayName(p)}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const currentEditPlan =
                      studyPlans.find((p) => p.id === editingPlanId) ||
                      studyPlans[0] ||
                      DEFAULT_STUDY_PLANS[0];
                    return (
                      <div className="plans-editor-card">
                        <div className="plan-field-row">
                          <span className="plan-field-label">
                            {t.planNameLabel}
                          </span>
                          <input
                            className="plan-text-input"
                            placeholder={
                              t.planNames[currentEditPlan.id] ||
                              t.planNamePlaceholder
                            }
                            value={currentEditPlan.name}
                            onChange={(e) =>
                              handleUpdatePlanField(
                                currentEditPlan.id,
                                "name",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="plan-field-row">
                          <span className="plan-field-label">
                            💼 {t.planWorkMins}
                          </span>
                          <input
                            type="number"
                            className="plan-number-input"
                            min={1}
                            max={240}
                            value={currentEditPlan.workMins}
                            onChange={(e) =>
                              handleUpdatePlanField(
                                currentEditPlan.id,
                                "workMins",
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              )
                            }
                          />
                        </div>

                        <div className="plan-field-row">
                          <span className="plan-field-label">
                            ☕ {t.planShortBreakMins}
                          </span>
                          <input
                            type="number"
                            className="plan-number-input"
                            min={1}
                            max={60}
                            value={currentEditPlan.shortBreakMins}
                            onChange={(e) =>
                              handleUpdatePlanField(
                                currentEditPlan.id,
                                "shortBreakMins",
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              )
                            }
                          />
                        </div>

                        <div className="plan-field-row">
                          <span className="plan-field-label">
                            🌴 {t.planStandardBreakMins}
                          </span>
                          <input
                            type="number"
                            className="plan-number-input"
                            min={1}
                            max={90}
                            value={currentEditPlan.standardBreakMins}
                            onChange={(e) =>
                              handleUpdatePlanField(
                                currentEditPlan.id,
                                "standardBreakMins",
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              )
                            }
                          />
                        </div>

                        <div className="plan-field-row">
                          <span className="plan-field-label">
                            🎉 {t.planLongBreakMins}
                          </span>
                          <input
                            type="number"
                            className="plan-number-input"
                            min={1}
                            max={180}
                            value={currentEditPlan.longBreakMins}
                            onChange={(e) =>
                              handleUpdatePlanField(
                                currentEditPlan.id,
                                "longBreakMins",
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              )
                            }
                          />
                        </div>

                        <div className="plan-field-row">
                          <span className="plan-field-label">
                            🔄 {t.planLongBreakInterval}
                          </span>
                          <input
                            type="number"
                            className="plan-number-input"
                            min={1}
                            max={12}
                            value={currentEditPlan.longBreakInterval}
                            onChange={(e) =>
                              handleUpdatePlanField(
                                currentEditPlan.id,
                                "longBreakInterval",
                                Math.max(1, parseInt(e.target.value, 10) || 1),
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ARKA PLAN RENK & OPAKLIK */}
              <div className="settings-section">
                <div className="settings-label">{t.bgColorLabel}</div>
                <div className="swatch-row">
                  {BG_PRESETS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${theme.bgColor === c ? "selected" : ""}`}
                      style={{ background: c }}
                      title={c}
                      onClick={() => updateTheme({ bgColor: c })}
                    />
                  ))}
                  <input
                    type="color"
                    className="color-input"
                    title={t.customColorTitle}
                    value={theme.bgColor}
                    onChange={(e) => updateTheme({ bgColor: e.target.value })}
                  />
                </div>
                <div className="settings-label slider-label">
                  <span>{t.opacityLabel}</span>
                  <span>%{theme.bgOpacity}</span>
                </div>
                <input
                  type="range"
                  className="range-input"
                  min={30}
                  max={100}
                  value={theme.bgOpacity}
                  onChange={(e) =>
                    updateTheme({ bgOpacity: Number(e.target.value) })
                  }
                />
              </div>

              {/* SAYAÇ RENGİ */}
              <div className="settings-section">
                <div className="settings-label slider-label">
                  <span>{t.timerColorLabel}</span>
                  <span className="timer-preview">50:00</span>
                </div>
                <div className="swatch-row">
                  {TIMER_PRESETS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${theme.timerColor === c ? "selected" : ""}`}
                      style={{ background: c }}
                      title={c}
                      onClick={() => updateTheme({ timerColor: c })}
                    />
                  ))}
                  <input
                    type="color"
                    className="color-input"
                    title={t.customColorTitle}
                    value={theme.timerColor}
                    onChange={(e) =>
                      updateTheme({ timerColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="settings-actions">
                <button
                  title={t.autoStartOnBoot(autoStartOn)}
                  onClick={toggleAutoStart}
                >
                  {t.autoStartOnBoot(autoStartOn)}
                </button>
                <button onClick={() => updateTheme({ ...DEFAULT_THEME })}>
                  {t.resetDefaultColors}
                </button>
              </div>

              {/* PENCERE BOYUTU ÖZELLEŞTİRME & STANDART BOYUTA DÖN */}
              <div className="settings-section">
                <div
                  className="settings-label"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>📐 {t.windowSizeTitle}</span>
                  {sizeSavedFlash && (
                    <span
                      style={{
                        fontSize: "9px",
                        color: "#4ade80",
                        fontWeight: 700,
                      }}
                    >
                      {t.sizeSavedBadge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "9.5px", color: "#a1a1aa" }}>
                  {t.windowSizeHint(currentWinSize.w, currentWinSize.h)}
                </div>
                <div className="settings-actions">
                  <button
                    className="primary-btn"
                    onClick={handleSaveCurrentWindowSize}
                  >
                    {t.saveCurrentSizeBtn}
                  </button>
                  <button onClick={handleResetStandardSizes}>
                    {t.resetStandardSizeBtn}
                  </button>
                </div>
              </div>

              {/* UYGULAMA İÇİ GERİ BİLDİRİM (FEEDBACK) BÖLÜMÜ */}
              <div className="settings-section no-drag">
                <div
                  className="settings-label"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>💬 {t.feedbackSectionTitle}</span>
                  {feedbackCopied && (
                    <span
                      style={{
                        fontSize: "9px",
                        color: "#4ade80",
                        fontWeight: 700,
                      }}
                    >
                      {t.feedbackCopiedMsg}
                    </span>
                  )}
                </div>

                <div className="feedback-cat-row">
                  <button
                    type="button"
                    className={`feedback-cat-btn ${
                      feedbackCat === "bug" ? "active" : ""
                    }`}
                    onClick={() => setFeedbackCat("bug")}
                  >
                    {t.feedbackCatBug}
                  </button>
                  <button
                    type="button"
                    className={`feedback-cat-btn ${
                      feedbackCat === "feature" ? "active" : ""
                    }`}
                    onClick={() => setFeedbackCat("feature")}
                  >
                    {t.feedbackCatFeature}
                  </button>
                  <button
                    type="button"
                    className={`feedback-cat-btn ${
                      feedbackCat === "ui" ? "active" : ""
                    }`}
                    onClick={() => setFeedbackCat("ui")}
                  >
                    {t.feedbackCatUi}
                  </button>
                </div>

                <div className="new-reason-row">
                  <textarea
                    className="distract-textarea"
                    rows={2}
                    placeholder={t.feedbackPlaceholder}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddFeedbackItem();
                      }
                    }}
                  />
                  <button
                    className="primary-btn"
                    onClick={handleAddFeedbackItem}
                  >
                    {t.feedbackSaveBtn}
                  </button>
                </div>

                <div className="settings-actions">
                  <button
                    className="ghost-btn"
                    disabled={feedbacks.length === 0}
                    onClick={handleCopyAllFeedbacks}
                  >
                    {t.feedbackCopyAllBtn} ({feedbacks.length})
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={handleOpenGithubFeedback}
                  >
                    {t.feedbackGithubBtn}
                  </button>
                </div>

                <div className="feedback-list">
                  {feedbacks.length === 0 ? (
                    <div
                      style={{
                        fontSize: "9.5px",
                        color: "#a1a1aa",
                        textAlign: "center",
                        padding: "4px",
                      }}
                    >
                      {t.feedbackEmpty}
                    </div>
                  ) : (
                    feedbacks.map((f) => (
                      <div key={f.id} className="feedback-item">
                        <div className="feedback-item-text">
                          <b>
                            {f.category === "bug"
                              ? "🐛"
                              : f.category === "feature"
                                ? "💡"
                                : "🎨"}
                          </b>{" "}
                          {f.message}
                        </div>
                        <button
                          className="tag-icon-btn del-btn"
                          onClick={() => handleDeleteFeedbackItem(f.id)}
                          title={t.cancel}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="update-row">
                <span>{t.versionLabel(appVersion)}</span>
                {updateStatus.kind === "available" ? (
                  <button className="primary-btn" onClick={handleInstallUpdate}>
                    {t.installVersion(updateStatus.version)}
                  </button>
                ) : updateStatus.kind === "downloading" ? (
                  <span>{t.updateDownloading(updateStatus.percent)}</span>
                ) : (
                  <button
                    className="ghost-btn"
                    disabled={updateStatus.kind === "checking"}
                    onClick={handleCheckUpdate}
                  >
                    {updateStatus.kind === "checking"
                      ? t.checkingUpdates
                      : updateStatus.kind === "up-to-date"
                        ? t.upToDate
                        : updateStatus.kind === "error"
                          ? t.checkErrorRetry
                          : t.checkUpdates}
                  </button>
                )}
              </div>
              {updateStatus.kind === "error" && (
                <div className="update-error" title={updateStatus.message}>
                  {updateStatus.message}
                </div>
              )}

              <div className="credits-bar">
                Credits by <b>Elyas</b>
              </div>
            </>
          )}

          {/* =================================================================
              ÖZET SAYFASI
             ================================================================= */}
          {page === "summary" && (
            <>
              <div className="top-bar">
                <div className="top-bar-left" style={{ gap: "6px" }}>
                  <span className="badge">⠿ {t.summary}</span>
                  <div className="summary-tab-group">
                    <button
                      className={`tab-btn ${summaryTab === "timeline" ? "active" : ""}`}
                      onClick={() => setSummaryTab("timeline")}
                    >
                      {t.timelineTab}
                    </button>
                    <button
                      className={`tab-btn ${summaryTab === "weekly" ? "active" : ""}`}
                      onClick={() => setSummaryTab("weekly")}
                    >
                      {t.viewWeekly}
                    </button>
                    <button
                      className={`tab-btn ${summaryTab === "recent" ? "active" : ""}`}
                      onClick={() => setSummaryTab("recent")}
                    >
                      {t.viewRecentDays}
                    </button>
                    <button
                      className={`tab-btn ${summaryTab === "parking" ? "active" : ""}`}
                      onClick={() => setSummaryTab("parking")}
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
                      onClick={() => setSummaryTab("story")}
                      title={`${t.workStoryTitle} (${workStoryEntries.length})`}
                    >
                      📸 {t.workStoryTab}
                    </button>
                    <button
                      className={`tab-btn ${summaryTab === "adhd" ? "active" : ""}`}
                      onClick={() => setSummaryTab("adhd")}
                    >
                      {t.adhdTab}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    className="ghost-btn"
                    onClick={openDashboard}
                    title={t.dashboardBtn}
                  >
                    📊 {t.dashboardBtn}
                  </button>
                  <button className="ghost-btn" onClick={openMenu}>
                    ← {t.home}
                  </button>
                </div>
              </div>

              {showResetConfirm ? (
                <div className="reset-confirm-box">
                  <div className="reset-confirm-title">
                    {t.resetConfirmTitle}
                  </div>
                  <div className="reset-confirm-desc">{t.resetConfirmDesc}</div>
                  <div className="btn-row" style={{ marginTop: "8px" }}>
                    <button className="warn-btn" onClick={handleResetAllData}>
                      {t.resetConfirmYes}
                    </button>
                    <button onClick={() => setShowResetConfirm(false)}>
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
                                {hoveredTimelineItem.mode === "work"
                                  ? t.work
                                  : t.break}
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
                              {t.formatDuration(
                                hoveredTimelineItem.durationSec,
                              )}
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
                                  onMouseEnter={() => setHoveredTimelineItem(s)}
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
                                  hoveredTimelineItem?.id === s.id
                                    ? "active-row"
                                    : ""
                                }`}
                                onMouseEnter={() => setHoveredTimelineItem(s)}
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
                                    {s.tag ||
                                      (s.mode === "work" ? t.work : t.break)}
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
                                      +
                                      {Math.max(
                                        1,
                                        Math.round(s.overtimeSec / 60),
                                      )}
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
                          const isHovered =
                            hoveredWeekDay?.dayIndex === d.dayIndex;
                          return (
                            <div
                              key={d.dayIndex}
                              className="bar-col"
                              onMouseEnter={() => setHoveredWeekDay(d)}
                            >
                              <span className="bar-hours">
                                {hours.toFixed(1)}
                                {activeLang === "tr" ? "s" : "h"}
                              </span>
                              <div
                                className={`bar-fill ${isHovered ? "active-bar" : ""}`}
                                style={{
                                  height: `${heightPct}%`,
                                  borderColor: d.is_today
                                    ? "#fbbf24"
                                    : undefined,
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
                      <div
                        className="tooltip-banner"
                        style={{ marginTop: "6px" }}
                      >
                        {hoveredDay ? (
                          (() => {
                            const hours = (hoveredDay.total_sec / 3600).toFixed(
                              1,
                            );
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
                              onMouseEnter={() => setHoveredDay(d)}
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
                          <div className="adhd-card-title">
                            🌅 {t.adhdChronoTitle}
                          </div>
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

                  {/* MOLA & FİKİR OTOPARKI GÖRÜNÜMÜ (Ekleme Sırasıyla Görevler & Önemli/Önemsiz Fikirler + SS Notları) */}
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
                          onClick={toggleFreqFilter}
                          title={freqOnlyToday ? t.filterToday : t.filterAll}
                        >
                          {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
                        </button>
                      </div>
                      {renderParkingLotContent(summaryParkingData, false)}
                    </div>
                  )}

                  {/* ÇALIŞMA HİKAYESİ GÖRÜNÜMÜ (5dk Periyodik SS'ler & Dağılma SS Notları) */}
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
                          onClick={toggleFreqFilter}
                          title={freqOnlyToday ? t.filterToday : t.filterAll}
                        >
                          {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
                        </button>
                      </div>
                      {workStoryEntries.length === 0 ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#a1a1aa",
                            textAlign: "center",
                            padding: "12px",
                          }}
                        >
                          {t.workStoryEmpty}
                        </div>
                      ) : (
                        <div className="work-story-grid">
                          {workStoryEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="work-story-card"
                              onClick={() => setLightboxEntry(entry)}
                            >
                              <img
                                src={entry.screenshot_data || ""}
                                alt="screenshot"
                                className="work-story-thumb"
                                loading="lazy"
                              />
                              <div className="work-story-meta">
                                <span className="work-story-time">
                                  {entry.created_at.slice(11, 16)} •{" "}
                                  {entry.entry_type === "periodic"
                                    ? "⏱ 5dk"
                                    : "📸 SS"}
                                </span>
                                {entry.active_app && (
                                  <span
                                    className="work-story-app"
                                    title={
                                      entry.active_window || entry.active_app
                                    }
                                  >
                                    🌐 {entry.active_app}
                                  </span>
                                )}
                                {entry.context_text && (
                                  <span
                                    className="work-story-ctx"
                                    title={entry.context_text}
                                  >
                                    🎯 {entry.context_text}
                                  </span>
                                )}
                                {entry.note && (
                                  <span
                                    className="work-story-note"
                                    title={entry.note}
                                  >
                                    {entry.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* KOMPAKT KATEGORİ KIRILIMI (Üzerine gelince detaylı açıklama) */}
                  <div className="summary-subtabs">
                    <button
                      className={`subtab-btn ${summaryReasonsTab === "work" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("work")}
                      title={t.workTagsTab}
                    >
                      💼 {t.workTagsShortTab} (
                      {summaryReasonsData?.totalWorkSubjects ?? 0})
                    </button>
                    <button
                      className={`subtab-btn ${summaryReasonsTab === "contexts" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("contexts")}
                      title={t.contextFullTab}
                    >
                      🎯 {t.contextShortTab} ({contextStats.length})
                    </button>
                    <button
                      className={`subtab-btn ${summaryReasonsTab === "apps" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("apps")}
                      title={t.appsFullTab}
                    >
                      🌐 {t.appsShortTab} (
                      {appDistractions.reduce(
                        (acc, g) => acc + g.totalCount,
                        0,
                      )}
                      )
                    </button>
                    <button
                      className={`subtab-btn ${summaryReasonsTab === "distractions" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("distractions")}
                      title={t.distractionReasonsTab}
                    >
                      ⚡ {t.distractionShortTab} (
                      {summaryReasonsData?.totalDistractions ?? 0})
                    </button>
                    <button
                      className={`subtab-btn ${summaryReasonsTab === "overtime" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("overtime")}
                      title={t.breakOvertimeTab}
                    >
                      ⏰ {t.breakOvertimeShortTab} (
                      {summaryReasonsData?.totalBreakOvertimes ?? 0})
                    </button>
                    <button
                      className={`subtab-btn ${summaryReasonsTab === "endings" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("endings")}
                      title={t.endingReasonsTab}
                    >
                      ⏹ {t.endingShortTab} (
                      {summaryReasonsData?.totalEndings ?? 0})
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={toggleFreqFilter}
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
                            <div
                              key={ctx.contextText}
                              className="accordion-card"
                            >
                              <div
                                className="accordion-header"
                                onClick={() => toggleAccordionTag(expandKey)}
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
                              ? Math.round(
                                  (grp.totalCount / totalAppDist) * 100,
                                )
                              : 0;
                          return (
                            <div key={grp.appName} className="accordion-card">
                              <div
                                className="accordion-header"
                                onClick={() => toggleAccordionTag(expandKey)}
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
                                        <span className="explanation-bullet">
                                          •
                                        </span>
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
                                        {d.contextText
                                          ? ` (🎯 ${d.contextText})`
                                          : ""}
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
                              onClick={() => toggleAccordionTag(expandKey)}
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
                                      <span className="explanation-bullet">
                                        •
                                      </span>
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
                      onClick={handleExportData}
                      title={t.exportDataBtn}
                    >
                      {t.exportDataBtn}
                    </button>
                    <button
                      className="ghost-btn reset-data-btn"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      🗑 {t.resetAllData}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* =================================================================
              DASHBOARD SAYFASI (Google Auth, Bulut Senkronizasyonu, Detaylı Görselleştirme,
              Yapılan/Yapılmayan Görevler, Fikirler ve Çalışma Hikayesi)
             ================================================================= */}
          {page === "dashboard" && (
            <div className="dashboard-container">
              <div className="top-bar">
                <div className="top-bar-left" style={{ gap: "6px" }}>
                  <span className="badge">📊 {t.dashboardTitle}</span>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={toggleFreqFilter}
                    title={freqOnlyToday ? t.filterToday : t.filterAll}
                  >
                    {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
                  </button>
                </div>
                <div className="top-bar-right">
                  <button
                    className="ghost-btn"
                    onClick={openSummary}
                    title={t.summaryTitle}
                  >
                    📈 {t.summary}
                  </button>
                  <button className="ghost-btn" onClick={openMenu}>
                    ← {t.home}
                  </button>
                  <button
                    className="icon-btn"
                    title={t.miniDockTooltip}
                    onClick={enterMiniDock}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="dashboard-scroll">
                {/* BULUT VE GOOGLE AUTH ÇUBUĞU */}
                <div className="cloud-auth-bar">
                  {cloudAuth.email ? (
                    <div className="cloud-auth-logged">
                      <div className="cloud-user-meta">
                        <span className="cloud-online-dot" />
                        <span className="cloud-user-name">
                          🟢 <b>{cloudAuth.email}</b>
                          {cloudAuth.name ? ` (${cloudAuth.name})` : ""}
                        </span>
                        <span className="cloud-sync-meta">
                          {isOnline ? "🌐 Online" : "📴 Offline"} •{" "}
                          {t.pendingSyncQueueBadge(pendingSyncCount)}
                          {cloudAuth.lastSyncAt && (
                            <>
                              {" "}
                              • {t.lastSyncLabel}:{" "}
                              {cloudAuth.lastSyncAt.slice(11, 16)}
                            </>
                          )}
                        </span>
                      </div>
                      <div className="cloud-auth-actions">
                        {syncStatusMsg && (
                          <span className="keep-status-pill">
                            {syncStatusMsg}
                          </span>
                        )}
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={isSyncingCloud}
                          onClick={handleManualCloudSync}
                        >
                          🔄{" "}
                          {isSyncingCloud ? t.syncRunning : t.manualSyncBtn}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={handleGoogleSignOut}
                        >
                          {t.cloudAuthSignOut}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cloud-auth-signin-box">
                      <div className="cloud-signin-header">
                        <span style={{ fontWeight: 600, fontSize: "11px" }}>
                          ☁️ {t.cloudAuthTitle}
                        </span>
                        <span className="cloud-sync-meta">
                          {isOnline ? "🌐 Çevrimiçi" : "📴 Çevrimdışı (Kuyruk Aktif)"} •{" "}
                          {t.pendingSyncQueueBadge(pendingSyncCount)}
                        </span>
                      </div>
                      <div className="cloud-signin-fields">
                        <input
                          type="email"
                          className="cloud-input"
                          placeholder={t.cloudEmailPlaceholder}
                          value={cloudEmailInput}
                          onChange={(e) => setCloudEmailInput(e.target.value)}
                        />
                        <input
                          type="text"
                          className="cloud-input"
                          placeholder={t.cloudNamePlaceholder}
                          value={cloudNameInput}
                          onChange={(e) => setCloudNameInput(e.target.value)}
                        />
                        <input
                          type="text"
                          className="cloud-input"
                          placeholder={t.cloudServerPlaceholder}
                          value={cloudServerInput}
                          onChange={(e) => setCloudServerInput(e.target.value)}
                        />
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleGoogleSignIn}
                        >
                          {t.cloudAuthSignIn}
                        </button>
                      </div>
                      <div style={{ fontSize: "9px", color: "#a1a1aa", marginTop: "2px" }}>
                        {t.cloudAuthHint}
                      </div>
                    </div>
                  )}
                </div>

                {/* KPI KARTLARI */}
                <div className="dashboard-kpi-grid">
                  <div className="stat-card">
                    <div className="stat-val">
                      {t.formatDuration(dayStats.totalSec)}
                    </div>
                    <div className="stat-lbl">{t.totalWork}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{dayStats.sessionCount}</div>
                    <div className="stat-lbl">{t.sessions}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">
                      {summaryParkingData.pendingTasks.length}
                    </div>
                    <div className="stat-lbl">
                      {t.dashboardUnfinishedTasks}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">
                      {summaryParkingData.doneTasks.length}
                    </div>
                    <div className="stat-lbl">{t.dashboardFinishedTasks}</div>
                  </div>
                </div>

                {/* ÇİFT KOLONLU GÖSTERGE ALANI */}
                <div className="dashboard-split-grid">
                  {/* SOL KOLON: GÖREVLER & FİKİRLER */}
                  <div className="dashboard-col">
                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          ⏳ {t.dashboardUnfinishedTasks} (
                          {summaryParkingData.pendingTasks.length})
                        </span>
                        <button
                          type="button"
                          className="keep-sync-btn"
                          onClick={handleSyncParkingToKeep}
                          title={t.keepSyncAllBtn}
                        >
                          🟨 Keep
                        </button>
                      </div>
                      <div className="dashboard-list">
                        {summaryParkingData.pendingTasks.length === 0 ? (
                          <div className="dashboard-empty-msg">
                            {t.noUnfinishedTasks}
                          </div>
                        ) : (
                          summaryParkingData.pendingTasks.map((it) => (
                            <div
                              key={it.id}
                              className="parking-todo-row"
                              title={renderParkingItemTooltip(it)}
                            >
                              <label className="parking-todo-left">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() =>
                                    handleToggleParkingTask(it.id, true)
                                  }
                                />
                                <span className="parking-todo-text">
                                  {it.content}
                                </span>
                              </label>
                              <div className="parking-row-right">
                                <button
                                  type="button"
                                  className={`keep-chip-btn ${
                                    it.keep_synced ? "synced" : ""
                                  }`}
                                  onClick={() =>
                                    handleSyncSingleItemToKeep(it)
                                  }
                                  title="Google Keep"
                                >
                                  {it.keep_synced ? "✓" : "🟨"}
                                </button>
                                <button
                                  type="button"
                                  className="tag-icon-btn del-btn"
                                  onClick={() =>
                                    handleDeleteParkingEntry(it.id)
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          ✅ {t.dashboardFinishedTasks} (
                          {summaryParkingData.doneTasks.length})
                        </span>
                      </div>
                      <div className="dashboard-list">
                        {summaryParkingData.doneTasks.length === 0 ? (
                          <div className="dashboard-empty-msg">
                            {t.noFinishedTasks}
                          </div>
                        ) : (
                          summaryParkingData.doneTasks.map((it) => (
                            <div
                              key={it.id}
                              className="parking-todo-row"
                              title={renderParkingItemTooltip(it)}
                            >
                              <label className="parking-todo-left">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  onChange={() =>
                                    handleToggleParkingTask(it.id, false)
                                  }
                                />
                                <span className="parking-todo-text done">
                                  {it.content}
                                </span>
                              </label>
                              <div className="parking-row-right">
                                <button
                                  type="button"
                                  className={`keep-chip-btn ${
                                    it.keep_synced ? "synced" : ""
                                  }`}
                                  onClick={() =>
                                    handleSyncSingleItemToKeep(it)
                                  }
                                  title="Google Keep"
                                >
                                  {it.keep_synced ? "✓" : "🟨"}
                                </button>
                                <button
                                  type="button"
                                  className="tag-icon-btn del-btn"
                                  onClick={() =>
                                    handleDeleteParkingEntry(it.id)
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          ⭐ {t.dashboardImportantIdeas} (
                          {summaryParkingData.importantIdeas.length})
                        </span>
                      </div>
                      <div className="dashboard-list">
                        {summaryParkingData.importantIdeas.length === 0 ? (
                          <div className="dashboard-empty-msg">
                            {t.noImportantIdeas}
                          </div>
                        ) : (
                          summaryParkingData.importantIdeas.map((it) => (
                            <div
                              key={it.id}
                              className="parking-idea-row"
                              title={renderParkingItemTooltip(it)}
                            >
                              <span className="parking-todo-text">
                                {it.content}
                              </span>
                              <div className="parking-idea-actions">
                                <button
                                  type="button"
                                  className="idea-rate-btn active-imp"
                                  onClick={() =>
                                    handleRateParkingIdea(it.id, "unrated")
                                  }
                                >
                                  {t.parkingMarkImportant}
                                </button>
                                <button
                                  type="button"
                                  className={`keep-chip-btn ${
                                    it.keep_synced ? "synced" : ""
                                  }`}
                                  onClick={() =>
                                    handleSyncSingleItemToKeep(it)
                                  }
                                  title="Google Keep"
                                >
                                  {it.keep_synced ? "✓" : "🟨"}
                                </button>
                                <button
                                  type="button"
                                  className="tag-icon-btn del-btn"
                                  onClick={() =>
                                    handleDeleteParkingEntry(it.id)
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          💤 {t.dashboardUnimportantIdeas} (
                          {summaryParkingData.unimportantIdeas.length +
                            summaryParkingData.unratedIdeas.length}
                          )
                        </span>
                      </div>
                      <div className="dashboard-list">
                        {[
                          ...summaryParkingData.unratedIdeas,
                          ...summaryParkingData.unimportantIdeas,
                        ].length === 0 ? (
                          <div className="dashboard-empty-msg">
                            {t.noUnimportantIdeas}
                          </div>
                        ) : (
                          [
                            ...summaryParkingData.unratedIdeas,
                            ...summaryParkingData.unimportantIdeas,
                          ].map((it) => (
                            <div
                              key={it.id}
                              className="parking-idea-row"
                              title={renderParkingItemTooltip(it)}
                            >
                              <span className="parking-todo-text">
                                {it.content}
                              </span>
                              <div className="parking-idea-actions">
                                <button
                                  type="button"
                                  className={`idea-rate-btn ${
                                    it.status === "important"
                                      ? "active-imp"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleRateParkingIdea(it.id, "important")
                                  }
                                >
                                  {t.parkingMarkImportant}
                                </button>
                                <button
                                  type="button"
                                  className={`keep-chip-btn ${
                                    it.keep_synced ? "synced" : ""
                                  }`}
                                  onClick={() =>
                                    handleSyncSingleItemToKeep(it)
                                  }
                                  title="Google Keep"
                                >
                                  {it.keep_synced ? "✓" : "🟨"}
                                </button>
                                <button
                                  type="button"
                                  className="tag-icon-btn del-btn"
                                  onClick={() =>
                                    handleDeleteParkingEntry(it.id)
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SAĞ KOLON: ÇALIŞMA HİKAYESİ & MEŞGULİYET / SEKME ANALİZİ */}
                  <div className="dashboard-col">
                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          📸 {t.workStoryTitle} ({workStoryEntries.length})
                        </span>
                        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
                          {t.workStoryDesc}
                        </span>
                      </div>
                      {workStoryEntries.length === 0 ? (
                        <div className="dashboard-empty-msg">
                          {t.workStoryEmpty}
                        </div>
                      ) : (
                        <div className="work-story-grid">
                          {workStoryEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="work-story-card"
                              onClick={() => setLightboxEntry(entry)}
                            >
                              <img
                                src={entry.screenshot_data || ""}
                                alt="screenshot"
                                className="work-story-thumb"
                                loading="lazy"
                              />
                              <div className="work-story-meta">
                                <span className="work-story-time">
                                  {entry.created_at.slice(11, 16)} •{" "}
                                  {entry.entry_type === "periodic"
                                    ? "⏱ 5dk"
                                    : "📸 SS"}
                                </span>
                                {entry.active_app && (
                                  <span
                                    className="work-story-app"
                                    title={
                                      entry.active_window || entry.active_app
                                    }
                                  >
                                    🌐 {entry.active_app}
                                  </span>
                                )}
                                {entry.context_text && (
                                  <span
                                    className="work-story-ctx"
                                    title={entry.context_text}
                                  >
                                    🎯 {entry.context_text}
                                  </span>
                                )}
                                {entry.note && (
                                  <span
                                    className="work-story-note"
                                    title={entry.note}
                                  >
                                    {entry.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          🎯 {t.contextStatsTitle} ({contextStats.length})
                        </span>
                      </div>
                      <div className="dashboard-list">
                        {contextStats.length === 0 ? (
                          <div className="dashboard-empty-msg">
                            {t.noContextStats}
                          </div>
                        ) : (
                          contextStats.map((ctx) => (
                            <div
                              key={ctx.contextText}
                              className="dashboard-stat-row"
                            >
                              <div className="dashboard-stat-main">
                                <span style={{ fontWeight: 600 }}>
                                  🎯 {ctx.contextText}
                                </span>
                                <span className="dashboard-stat-sub">
                                  {ctx.lastWorkTag && `💼 ${ctx.lastWorkTag} `}
                                  {ctx.topApp && `• 🌐 ${ctx.topApp}`}
                                </span>
                              </div>
                              <span className="dashboard-stat-badge">
                                {t.formatDuration(ctx.totalDurationSec)} • ⚡
                                {ctx.distractionCount}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="dashboard-section-card">
                      <div className="dashboard-section-header">
                        <span className="dashboard-card-title">
                          🌐 {t.appDistractionTitle} (
                          {appDistractions.reduce(
                            (acc, g) => acc + g.totalCount,
                            0,
                          )}
                          )
                        </span>
                      </div>
                      <div className="dashboard-list">
                        {appDistractions.length === 0 ? (
                          <div className="dashboard-empty-msg">
                            {t.noAppDistractions}
                          </div>
                        ) : (
                          appDistractions.map((grp) => (
                            <div
                              key={grp.appName}
                              className="dashboard-stat-row"
                            >
                              <div className="dashboard-stat-main">
                                <span style={{ fontWeight: 600 }}>
                                  🌐 {grp.appName}
                                </span>
                                {grp.details[0]?.windowTitle && (
                                  <span className="dashboard-stat-sub">
                                    {grp.details[0].windowTitle}
                                  </span>
                                )}
                              </div>
                              <span className="dashboard-stat-badge">
                                {grp.totalCount}x
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EKRAN GÖRÜNTÜSÜ BÜYÜTÜCÜ MODAL (LIGHTBOX) */}
          {lightboxEntry && (
            <div
              className="lightbox-overlay no-drag"
              onClick={() => setLightboxEntry(null)}
            >
              <div
                className="lightbox-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="lightbox-header">
                  <span className="lightbox-title">
                    📸{" "}
                    {lightboxEntry.entry_type === "periodic"
                      ? "5dk Periyodik Ekran Kaydı"
                      : "📸 Ekran Alıntısı Notu"}{" "}
                    • {lightboxEntry.created_at.replace("T", " ").slice(0, 16)}
                  </span>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="tag-icon-btn del-btn"
                      onClick={async () => {
                        await deleteWorkStoryEntry(lightboxEntry.id);
                        setLightboxEntry(null);
                        setWorkStoryEntries(
                          await getWorkStoryEntries(freqOnlyTodayRef.current, 40),
                        );
                      }}
                      title={t.cancel}
                    >
                      🗑
                    </button>
                    <button
                      type="button"
                      className="tag-icon-btn"
                      onClick={() => setLightboxEntry(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="lightbox-img-wrap">
                  <img
                    src={lightboxEntry.screenshot_data || ""}
                    alt="full screenshot"
                    className="lightbox-img"
                  />
                </div>
                <div className="lightbox-footer">
                  {lightboxEntry.context_text && (
                    <div className="lightbox-meta-item">
                      🎯 <b>Meşguliyet:</b> {lightboxEntry.context_text}
                    </div>
                  )}
                  {lightboxEntry.active_app && (
                    <div className="lightbox-meta-item">
                      🌐 <b>Uygulama / Sekme:</b> {lightboxEntry.active_app}
                      {lightboxEntry.active_window
                        ? ` — ${lightboxEntry.active_window}`
                        : ""}
                    </div>
                  )}
                  {lightboxEntry.note && (
                    <div className="lightbox-meta-item">
                      📝 <b>Not:</b> {lightboxEntry.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
