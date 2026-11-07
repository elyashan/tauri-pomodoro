import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getVersion } from "@tauri-apps/api/app";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
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
} from "./db";
import { UpdateStatus, checkForUpdate, installUpdate } from "./updater";
import { translations, resolveLanguage } from "./i18n";
import { ConfettiCanvas } from "./Confetti";
import "./App.css";

type NavPage = "menu" | "timer" | "summary" | "settings";

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

  // Dikkatim Dağıldı Kutusu
  const [showDistractBox, setShowDistractBox] = useState(false);
  const [distractTags, setDistractTags] = useState<TagItem[]>([]);
  const [selectedDistractTag, setSelectedDistractTag] = useState<string>("Diğer");
  const [distractPreviousReasons, setDistractPreviousReasons] = useState<string[]>([]);
  const [distractReasonText, setDistractReasonText] = useState("");
  const [isEditingDistractTags, setIsEditingDistractTags] = useState(false);

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
  const [summaryTab, setSummaryTab] = useState<"timeline" | "weekly" | "recent">("timeline");
  const [summaryReasonsTab, setSummaryReasonsTab] = useState<
    "work" | "overtime" | "distractions" | "endings"
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
  };

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
    showStopBox || showDistractBox || showBreakOverdueBox || showWorkTopicBox;

  // Sayfaya ve diyaloglara göre pencere boyutunu ayarla
  useEffect(() => {
    if (!loaded) return;
    const win = getCurrentWindow();
    if (anyModalOpen) {
      win.setSize(new LogicalSize(315, 336));
    } else if (page === "menu") {
      const hasBanner =
        updateStatus.kind === "available" ||
        updateStatus.kind === "downloading";
      win.setSize(new LogicalSize(315, hasBanner ? 395 : 362));
    } else if (page === "summary") {
      win.setSize(new LogicalSize(385, 480));
    } else if (page === "settings") {
      win.setSize(new LogicalSize(320, 480));
    } else {
      win.setSize(new LogicalSize(284, 138));
    }
  }, [page, anyModalOpen, loaded, updateStatus.kind]);

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
        "button, input, select, option, .no-drag, .clickable-timer, .bar-col, .accordion-header, .timeline-block",
      )
    ) {
      return;
    }
    getCurrentWindow().startDragging();
  };

  const hideToTray = () => {
    getCurrentWindow().hide();
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

    const nowIso = new Date().toISOString();

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
    workStartedAtRef.current = null;
    breakStartedAtRef.current = null;

    await saveSessionCycleStats(0, 0);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const freshStats = await startNewDay(locale);
    setDayStats(freshStats);
    setWeeklySummary(await getWeeklySummary(locale));
    setTimelineSessions(await getTimelineSessions(freshStats.dayId));
    setPage("menu");
  };

  // ---------------------------------------------------------------------------
  // DİKKAT DAĞILMASI İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleDistractedClick = async () => {
    if (!sessionActive) return;
    if (distractPenaltyMins > 0) {
      setWorkSecondsLeft((prev) => prev + distractPenaltyMins * 60);
    }
    setCurrentSessionDistractions((prev) => prev + 1);

    const loadedTags = await getTags("distraction", t.defaultDistractionTags);
    setDistractTags(loadedTags);
    const initialTag = loadedTags[0]?.name || t.other;
    setSelectedDistractTag(initialTag);

    const prevReasons = await getPreviousReasons("distraction", initialTag);
    setDistractPreviousReasons(prevReasons);
    setDistractReasonText("");
    setShowDistractBox(true);
  };

  const handleSelectDistractTag = async (tagName: string) => {
    setSelectedDistractTag(tagName);
    const prevReasons = await getPreviousReasons("distraction", tagName);
    setDistractPreviousReasons(prevReasons);
  };

  const submitDistraction = async () => {
    const reason = distractReasonText.trim() || selectedDistractTag;
    await recordDistraction(reason, selectedDistractTag);
    setShowDistractBox(false);
    setDistractReasonText("");
    setIsEditingDistractTags(false);
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

  const handleTakeShortBreak = async () => {
    if (!sessionActive) return;
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
    } else {
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      workStartedAtRef.current = autoRunWork ? new Date().toISOString() : null;
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
  // TAG YÖNETİMİ (EKLE, DÜZENLE, SİL)
  // ---------------------------------------------------------------------------
  const handleAddNewTag = async (kind: TagKind) => {
    const newName = window.prompt(t.newTagPrompt);
    if (newName && newName.trim()) {
      const added = await addTag(newName.trim(), kind);
      const pickedName = added?.name || newName.trim();
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
    }
  };

  const handleEditTagItem = async (
    tagId: number,
    currentName: string,
    kind: TagKind,
  ) => {
    const newName = window.prompt(t.editTagPrompt(currentName), currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      await updateTag(tagId, newName.trim(), kind);
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
      } else if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
        if (currentWorkTag === currentName) {
          setCurrentWorkTag(newName.trim());
        }
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(
          await getTags("break_overtime", t.defaultBreakOvertimeTags),
        );
      }
    }
  };

  const handleDeleteTagItem = async (
    tagId: number,
    name: string,
    kind: TagKind,
  ) => {
    if (window.confirm(t.deleteTagConfirm(name))) {
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

    setSummaryDays(days);
    setWeeklySummary(weekly);
    setSummaryReasonsData(reasonsData);
    setTimelineSessions(timeline);
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
    setPage("settings");
  };

  const toggleFreqFilter = async () => {
    const nextVal = !freqOnlyToday;
    setFreqOnlyToday(nextVal);
    setSummaryReasonsData(await getSummaryReasonsData(nextVal));
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

  return (
    <div
      className={`widget-shell ${
        page !== "timer" || anyModalOpen ? "solid-bg" : ""
      } ${isLightColor(theme.bgColor) ? "light-theme" : ""} ${
        isCelebrating ? "celebrating-shell" : ""
      } ${isTimerAlarmView ? "alarm-shell" : ""}`}
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
          ORTAK TAG & AÇIKLAMA DİYALOGLARI (Konu, Dağılma, Erken Bitirme, Gecikme)
         ===================================================================== */}
      {showWorkTopicBox ? (
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
                onClick={() => setIsEditingWorkTags(!isEditingWorkTags)}
              >
                {isEditingWorkTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>

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
            <input
              className="distract-input"
              placeholder={t.workTopicPlaceholder}
              value={workTopicReasonText}
              autoFocus
              onChange={(e) => setWorkTopicReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitWorkTopic();
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
            <button onClick={() => setShowWorkTopicBox(false)}>
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
                onClick={() => setIsEditingDistractTags(!isEditingDistractTags)}
              >
                {isEditingDistractTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>

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
            <input
              className="distract-input"
              placeholder={t.distractExplanationPlaceholder}
              value={distractReasonText}
              autoFocus
              onChange={(e) => setDistractReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitDistraction();
                if (e.key === "Escape") setShowDistractBox(false);
              }}
            />
            <button className="primary-btn" onClick={submitDistraction}>
              {t.saveAndAddMin(distractPenaltyMins)}
            </button>
          </div>

          <div className="stop-box-actions">
            <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
              Tag: <b>{selectedDistractTag}</b>
            </span>
            <button onClick={() => setShowDistractBox(false)}>
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
                onClick={() => setIsEditingEndingTags(!isEditingEndingTags)}
              >
                {isEditingEndingTags ? t.doneEditing : t.editTags}
              </button>
            </div>
          </div>
          <div className="stop-box-hint">
            {t.earlyStopWorkedTime(Math.floor(workElapsedSec / 60))}
          </div>

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
            <input
              className="distract-input"
              placeholder={t.endingExplanationPlaceholder}
              value={endingReasonText}
              autoFocus
              onChange={(e) => setEndingReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEnding(true);
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
                onClick={() =>
                  setIsEditingBreakOverdueTags(!isEditingBreakOverdueTags)
                }
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
            <input
              className="distract-input"
              placeholder={t.distractExplanationPlaceholder}
              value={breakOverdueReasonText}
              autoFocus
              onChange={(e) => setBreakOverdueReasonText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitBreakOverdue(false);
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
              <div className="top-bar hover-reveal">
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
                    title={t.hideToTray}
                    onClick={hideToTray}
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
              </div>

              {timerMode === "break" ? (
                <div className="btn-row hover-reveal">
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
                    title={t.summaryTitle}
                    onClick={openSummary}
                  >
                    📊 {t.summary}
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
                    title={t.hideToTray}
                    onClick={hideToTray}
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
                  <button
                    type="button"
                    className="work-topic-badge menu-topic"
                    onClick={handleOpenWorkTopicBox}
                    title={`${t.changeWorkTopic} — ${fullTopicLabel}`}
                  >
                    🏷️ {fullTopicLabel}
                  </button>

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
                  </div>
                </div>
                <button className="ghost-btn" onClick={openMenu}>
                  ← {t.home}
                </button>
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
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
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
                      className={`subtab-btn ${summaryReasonsTab === "overtime" ? "active" : ""}`}
                      onClick={() => setSummaryReasonsTab("overtime")}
                      title={t.breakOvertimeTab}
                    >
                      ⏰ {t.breakOvertimeShortTab} (
                      {summaryReasonsData?.totalBreakOvertimes ?? 0})
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
                                    <span>
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
        </>
      )}
    </div>
  );
}
