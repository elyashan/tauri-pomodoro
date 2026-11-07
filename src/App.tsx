import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getVersion } from "@tauri-apps/api/app";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  PageType,
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
  loadThemeSettings,
  saveThemeSettings,
  loadLanguagePreference,
  saveLanguagePreference,
  loadDistractPenalty,
  saveDistractPenalty,
  getActiveDayStats,
  startNewDay,
  recordWorkSession,
  recordBreakSession,
  getTimelineSessions,
  TimelineSessionItem,
  exportAllData,
  loadAlwaysOnTop,
  saveAlwaysOnTop,
  loadDefaultBreakMins,
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

function persistState(state: AppState) {
  saveAppState(state).catch((err) =>
    console.error("Durum kaydedilemedi:", err),
  );
}

function playCelebrationFanfare() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    // Ascending arpeggio with celebratory harmonic chime: C5, E5, G5, C6, E6
    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.16 }, // C5
      { freq: 659.25, time: 0.13, dur: 0.16 }, // E5
      { freq: 783.99, time: 0.26, dur: 0.2 }, // G5
      { freq: 1046.5, time: 0.42, dur: 0.45 }, // C6
      { freq: 1318.51, time: 0.58, dur: 0.7 }, // E6 sparkle finish
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
  const [page, setPage] = useState<PageType>("work");

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
  const [breakKind, setBreakKind] = useState<"standard" | "long" | "short">("standard");
  const savedWorkSecondsLeftRef = useRef<number>(DEFAULT_WORK_SEC);
  const savedWorkElapsedSecRef = useRef<number>(0);

  const currentPlan =
    studyPlans.find((p) => p.id === activePlanId) ||
    studyPlans[0] ||
    DEFAULT_STUDY_PLANS[0];

  const [workSecondsLeft, setWorkSecondsLeft] = useState(DEFAULT_WORK_SEC);
  const [workElapsedSec, setWorkElapsedSec] = useState(0);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(DEFAULT_BREAK_SEC);

  // Mola ayarları ve gecikme (overtime) takibi
  const [defaultBreakMins, setDefaultBreakMins] = useState(10);
  const [breakTotalSec, setBreakTotalSec] = useState(10 * 60);
  const [breakOverdueSec, setBreakOverdueSec] = useState(0);
  const [showBreakOverdueBox, setShowBreakOverdueBox] = useState(false);
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
  const workStartedAtRef = useRef<string>(new Date().toISOString());
  const breakStartedAtRef = useRef<string>(new Date().toISOString());
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

  const stateRef = useRef<AppState>({
    page: "work",
    work_seconds_left: DEFAULT_WORK_SEC,
    work_elapsed_sec: 0,
    break_seconds_left: DEFAULT_BREAK_SEC,
  });
  stateRef.current = {
    page,
    work_seconds_left: workSecondsLeft,
    work_elapsed_sec: workElapsedSec,
    break_seconds_left: breakSecondsLeft,
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await loadAppState();
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
        setPage(saved.page);
        setWorkSecondsLeft(saved.work_seconds_left);
        setWorkElapsedSec(saved.work_elapsed_sec);
        setBreakSecondsLeft(saved.break_seconds_left);
        setDayStats(stats);
        setSummaryDays(days);
        setWeeklySummary(weekly);
        setDistractPenaltyMins(penalty);
        setTheme(savedTheme);

        // Varsayılan tag'leri yükle
        const dTags = await getTags("distraction", currentT.defaultDistractionTags);
        const eTags = await getTags("ending", currentT.defaultEndingTags);
        const wTags = await getTags("work", currentT.defaultWorkTags);
        const boTags = await getTags("break_overtime", currentT.defaultBreakOvertimeTags);
        setDistractTags(dTags);
        setEndingTags(eTags);
        setWorkTags(wTags);
        setBreakOverdueTags(boTags);
        if (wTags.length > 0) setSelectedWorkTopicTag(wTags[0].name);
        if (boTags.length > 0) setSelectedBreakOverdueTag(boTags[0].name);

        const savedAlwaysOnTop = await loadAlwaysOnTop();
        setAlwaysOnTop(savedAlwaysOnTop);
        await getCurrentWindow().setAlwaysOnTop(savedAlwaysOnTop).catch(() => {});

        const savedBreakMins = await loadDefaultBreakMins();
        setDefaultBreakMins(savedBreakMins);
        setBreakTotalSec(savedBreakMins * 60);

        const loadedPlans = await loadStudyPlans();
        const loadedPlanId = await loadActivePlanId();
        const loadedCycles = await loadSessionCycleStats();
        setStudyPlans(loadedPlans);
        setActivePlanId(loadedPlanId);
        setEditingPlanId(loadedPlanId);
        setCompletedWorkCount(loadedCycles.completedWorkCount);
        setSessionShortBreakCount(loadedCycles.shortBreakCount);

        const foundPlan =
          loadedPlans.find((p) => p.id === loadedPlanId) ||
          loadedPlans[0] ||
          DEFAULT_STUDY_PLANS[0];

        // Eğer henüz başlanmamış tertemiz bir durumdaysa süreyi aktif plana eşitle
        if (saved.work_elapsed_sec === 0 && saved.work_seconds_left === DEFAULT_WORK_SEC) {
          setWorkSecondsLeft(foundPlan.workMins * 60);
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

  // Sayfaya ve diyaloglara göre pencere boyutunu ayarla
  useEffect(() => {
    if (!loaded) return;
    const win = getCurrentWindow();
    if (page === "menu") {
      const hasBanner =
        updateStatus.kind === "available" ||
        updateStatus.kind === "downloading";
      win.setSize(new LogicalSize(310, hasBanner ? 390 : 355));
    } else if (page === "summary") {
      win.setSize(new LogicalSize(380, 480));
    } else if (page === "settings") {
      win.setSize(new LogicalSize(315, 480));
    } else if (
      showStopBox ||
      showDistractBox ||
      showBreakOverdueBox ||
      showWorkTopicBox
    ) {
      win.setSize(new LogicalSize(310, 330));
    } else {
      win.setSize(new LogicalSize(260, 134));
    }
  }, [
    page,
    showDistractBox,
    showStopBox,
    showBreakOverdueBox,
    showWorkTopicBox,
    loaded,
    updateStatus.kind,
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

  // Durum kaydı
  useEffect(() => {
    if (!loaded || isRunning) return;
    persistState(stateRef.current);
  }, [
    loaded,
    isRunning,
    page,
    workSecondsLeft,
    workElapsedSec,
    breakSecondsLeft,
  ]);

  // Sayaç çalışırken 5 saniyede bir yedekle
  useEffect(() => {
    if (!loaded || !isRunning) return;
    persistState(stateRef.current);
    const backup = setInterval(() => persistState(stateRef.current), 5000);
    return () => clearInterval(backup);
  }, [loaded, isRunning]);

  // Sistem saatine dayalı sayaç döngüsü
  useEffect(() => {
    if (!isRunning) return;
    lastTickRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);
      if (delta >= 1) {
        lastTickRef.current += delta * 1000;
        if (page === "work") {
          setWorkSecondsLeft((prev) => Math.max(0, prev - delta));
          setWorkElapsedSec((prev) => prev + delta);
        } else if (page === "break") {
          setBreakSecondsLeft((prev) => {
            if (prev > 0) {
              const next = prev - delta;
              if (next <= 0) {
                // Mola süresi doldu! Gecikme sayacını başlat ve alarm çal
                setBreakOverdueSec(Math.abs(next));
                playAlarmChime();
                lastAlarmPlayRef.current = Date.now();
                return 0;
              }
              return next;
            } else {
              // Mola aşımı devam ediyor (alarm durumu)
              setBreakOverdueSec((o) => o + delta);
              if (Date.now() - lastAlarmPlayRef.current >= 12000) {
                playAlarmChime();
                lastAlarmPlayRef.current = Date.now();
              }
              return 0;
            }
          });
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isRunning, page]);

  // Süre bittiğinde otomatik seans kaydı
  useEffect(() => {
    if (!isRunning) return;
    if (page === "work" && workSecondsLeft === 0) {
      setIsCelebrating(true);
      playCelebrationFanfare();
      (async () => {
        await recordWorkSession(
          workElapsedSec,
          currentWorkTag,
          currentWorkReason,
          workStartedAtRef.current,
          new Date().toISOString(),
        );
        setWorkSecondsLeft(DEFAULT_WORK_SEC);
        setWorkElapsedSec(0);
        setCurrentSessionDistractions(0);
        const locale = activeLang === "tr" ? "tr-TR" : "en-US";
        setDayStats(await getActiveDayStats(locale));
        setWeeklySummary(await getWeeklySummary(locale));
        setTimelineSessions(await getTimelineSessions());
      })();

      // Seans döngüsünü arttır ve uzun mola mı standart mola mı belirle
      const nextCompleted = completedWorkCount + 1;
      setCompletedWorkCount(nextCompleted);
      saveSessionCycleStats(nextCompleted, sessionShortBreakCount).catch(() => {});

      const isLong = nextCompleted % currentPlan.longBreakInterval === 0;
      const bKind = isLong ? ("long" as const) : ("standard" as const);
      const bMins = isLong
        ? currentPlan.longBreakMins
        : currentPlan.standardBreakMins;
      const bSec = bMins * 60;

      // Çalışma bitince otomatik olarak molaya geç ve başlat
      setBreakKind(bKind);
      setPage("break");
      setBreakSecondsLeft(bSec);
      setBreakTotalSec(bSec);
      setBreakOverdueSec(0);
      setIsRunning(true);
      playBreakChime();
      breakStartedAtRef.current = new Date().toISOString();
      workStartedAtRef.current = new Date().toISOString();
    }
  }, [
    isRunning,
    page,
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
    if (target.closest("button, input, .clickable-timer, .bar-col, .accordion-header")) return;
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
  // DİKKAT DAĞILMASI İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleDistractedClick = async () => {
    // Süreye ayarlanan ceza süresini ekle (0 ise ekleme yapma)
    if (distractPenaltyMins > 0) {
      setWorkSecondsLeft((prev) => prev + distractPenaltyMins * 60);
    }
    setCurrentSessionDistractions((prev) => prev + 1);

    const loadedTags = await getTags("distraction", t.defaultDistractionTags);
    setDistractTags(loadedTags);
    const initialTag = loadedTags[0]?.name || "Diğer";
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
    if (page === "work") {
      if (workElapsedSec >= 15) {
        const loadedTags = await getTags("ending", t.defaultEndingTags);
        setEndingTags(loadedTags);
        const initialTag = loadedTags[0]?.name || "Diğer";
        setSelectedEndingTag(initialTag);

        const prevReasons = await getPreviousReasons("ending", initialTag);
        setEndingPreviousReasons(prevReasons);
        setEndingReasonText("");
        setShowStopBox(true);
        return;
      }
      setWorkSecondsLeft(DEFAULT_WORK_SEC);
      setWorkElapsedSec(0);
      setCurrentSessionDistractions(0);
    } else {
      if (breakOverdueSec >= 10) {
        await handleOpenBreakOverdueBox();
        return;
      }
      setBreakSecondsLeft(defaultBreakMins * 60);
      setBreakOverdueSec(0);
    }
  };

  const handleSelectEndingTag = async (tagName: string) => {
    setSelectedEndingTag(tagName);
    const prevReasons = await getPreviousReasons("ending", tagName);
    setEndingPreviousReasons(prevReasons);
  };

  const submitEnding = async (withTag = true) => {
    if (workElapsedSec >= 15) {
      const tag = withTag ? selectedEndingTag : currentWorkTag;
      const reason = withTag
        ? endingReasonText.trim() || selectedEndingTag
        : currentWorkReason;
      await recordWorkSession(
        workElapsedSec,
        tag,
        reason,
        workStartedAtRef.current,
        new Date().toISOString(),
      );
      const locale = activeLang === "tr" ? "tr-TR" : "en-US";
      setDayStats(await getActiveDayStats(locale));
      setWeeklySummary(await getWeeklySummary(locale));
      setTimelineSessions(await getTimelineSessions());
    }
    setWorkSecondsLeft(currentPlan.workMins * 60);
    setWorkElapsedSec(0);
    setCurrentSessionDistractions(0);
    setShowStopBox(false);
    setEndingReasonText("");
    setIsEditingEndingTags(false);
  };

  // ---------------------------------------------------------------------------
  // MOLA AŞIMI (OVERDUE) & ÇALIŞMA KONUSU & ALWAYS ON TOP & EXPORT
  // ---------------------------------------------------------------------------
  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    await saveAlwaysOnTop(next);
    await getCurrentWindow().setAlwaysOnTop(next).catch(() => {});
  };

  const handleTakeShortBreak = async () => {
    savedWorkSecondsLeftRef.current = workSecondsLeft;
    savedWorkElapsedSecRef.current = workElapsedSec;
    const nextShort = sessionShortBreakCount + 1;
    setSessionShortBreakCount(nextShort);
    await saveSessionCycleStats(completedWorkCount, nextShort);

    const bSec = currentPlan.shortBreakMins * 60;
    setBreakKind("short");
    setBreakTotalSec(bSec);
    setBreakSecondsLeft(bSec);
    setBreakOverdueSec(0);
    setPage("break");
    setIsRunning(true);
    playBreakChime();
    breakStartedAtRef.current = new Date().toISOString();
  };

  const handleSelectPlan = async (planId: string) => {
    setActivePlanId(planId);
    await saveActivePlanId(planId);
    const chosen = studyPlans.find((p) => p.id === planId);
    if (chosen && !isRunning && workElapsedSec === 0) {
      setWorkSecondsLeft(chosen.workMins * 60);
    }
  };

  const handleStartSessionWithPlan = (plan: StudyPlan) => {
    setIsCelebrating(false);
    setActivePlanId(plan.id);
    saveActivePlanId(plan.id).catch(() => {});
    setWorkSecondsLeft(plan.workMins * 60);
    setWorkElapsedSec(0);
    setPage("work");
    setIsRunning(true);
    workStartedAtRef.current = new Date().toISOString();
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
      workElapsedSec === 0
    ) {
      setWorkSecondsLeft(Number(value) * 60);
    }
  };

  const handleResetPlansDefault = async () => {
    setStudyPlans(DEFAULT_STUDY_PLANS);
    await saveStudyPlans(DEFAULT_STUDY_PLANS);
    const current =
      DEFAULT_STUDY_PLANS.find((p) => p.id === activePlanId) ||
      DEFAULT_STUDY_PLANS[0];
    if (!isRunning && workElapsedSec === 0) {
      setWorkSecondsLeft(current.workMins * 60);
    }
  };

  const handleOpenBreakOverdueBox = async () => {
    const loadedTags = await getTags("break_overtime", t.defaultBreakOvertimeTags);
    setBreakOverdueTags(loadedTags);
    const initial = loadedTags[0]?.name || "Telefon";
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

  const submitBreakOverdue = async (skipReason = false) => {
    const totalBreakSec = breakTotalSec + breakOverdueSec;
    const defaultTag =
      breakKind === "short"
        ? "Kısa Mola"
        : breakKind === "long"
          ? "Uzun Mola"
          : "Standart Mola";
    const tag = skipReason ? defaultTag : selectedBreakOverdueTag;
    const reason = skipReason
      ? undefined
      : breakOverdueReasonText.trim() || selectedBreakOverdueTag;

    await recordBreakSession(
      totalBreakSec,
      tag,
      reason,
      breakOverdueSec,
      breakStartedAtRef.current,
      new Date().toISOString(),
    );

    setShowBreakOverdueBox(false);
    setBreakOverdueSec(0);

    if (breakKind === "short") {
      setWorkSecondsLeft(savedWorkSecondsLeftRef.current);
      setWorkElapsedSec(savedWorkElapsedSecRef.current);
    } else {
      setWorkSecondsLeft(currentPlan.workMins * 60);
      setWorkElapsedSec(0);
      workStartedAtRef.current = new Date().toISOString();
    }

    // Çalışmaya geç
    setPage("work");
    setIsRunning(true);
  };

  const handleStartWorkFromBreak = async () => {
    if (breakOverdueSec >= 10) {
      await handleOpenBreakOverdueBox();
    } else {
      await submitBreakOverdue(true);
    }
  };

  const handleOpenWorkTopicBox = async () => {
    const loadedTags = await getTags("work", t.defaultWorkTags);
    setWorkTags(loadedTags);
    const initial = currentWorkTag || loadedTags[0]?.name || "Ders";
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
      await addTag(newName.trim(), kind);
      if (kind === "distraction") {
        const updated = await getTags("distraction", t.defaultDistractionTags);
        setDistractTags(updated);
        setSelectedDistractTag(newName.trim());
      } else if (kind === "ending") {
        const updated = await getTags("ending", t.defaultEndingTags);
        setEndingTags(updated);
        setSelectedEndingTag(newName.trim());
      } else if (kind === "work") {
        const updated = await getTags("work", t.defaultWorkTags);
        setWorkTags(updated);
        setSelectedWorkTopicTag(newName.trim());
      } else if (kind === "break_overtime") {
        const updated = await getTags("break_overtime", t.defaultBreakOvertimeTags);
        setBreakOverdueTags(updated);
        setSelectedBreakOverdueTag(newName.trim());
      }
    }
  };

  const handleEditTagItem = async (tagId: number, currentName: string, kind: TagKind) => {
    const newName = window.prompt(t.editTagPrompt(currentName), currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      await updateTag(tagId, newName.trim(), kind);
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
      } else if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(await getTags("break_overtime", t.defaultBreakOvertimeTags));
      }
    }
  };

  const handleDeleteTagItem = async (tagId: number, name: string, kind: TagKind) => {
    if (window.confirm(t.deleteTagConfirm(name))) {
      await deleteTag(tagId);
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
      } else if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(await getTags("break_overtime", t.defaultBreakOvertimeTags));
      }
    }
  };

  // ---------------------------------------------------------------------------
  // MENÜ VE ÖZET SAYFASI
  // ---------------------------------------------------------------------------
  const openMenu = async () => {
    setIsCelebrating(false);
    setIsRunning(false);
    setShowDistractBox(false);
    setShowStopBox(false);
    setDayStats(await getActiveDayStats(activeLang === "tr" ? "tr-TR" : "en-US"));
    setPage("menu");
  };

  const openSummary = async () => {
    setIsCelebrating(false);
    setIsRunning(false);
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
      weekly.days.find((d) => d.is_today) ?? weekly.days[weekly.days.length - 1] ?? null;
    setHoveredWeekDay(todayWeekDay);
    setShowResetConfirm(false);
    setPage("summary");
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
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    await clearAllData(locale);
    const freshStats = await getActiveDayStats(locale);
    const freshDays = await getDaysSummary();
    const freshWeekly = await getWeeklySummary(locale);
    const freshReasons = await getSummaryReasonsData(false);
    const freshTimeline = await getTimelineSessions(freshStats.dayId);

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

  const handleStartNewDay = async () => {
    setIsRunning(false);
    if (workElapsedSec >= 60) {
      await recordWorkSession(
        workElapsedSec,
        currentWorkTag,
        currentWorkReason,
        workStartedAtRef.current,
        new Date().toISOString(),
      );
    }
    setWorkSecondsLeft(currentPlan.workMins * 60);
    setWorkElapsedSec(0);
    setBreakSecondsLeft(currentPlan.standardBreakMins * 60);
    setBreakOverdueSec(0);
    setCurrentSessionDistractions(0);
    setCompletedWorkCount(0);
    setSessionShortBreakCount(0);
    await saveSessionCycleStats(0, 0);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const freshStats = await startNewDay(locale);
    setDayStats(freshStats);
    setWeeklySummary(await getWeeklySummary(locale));
    setTimelineSessions(await getTimelineSessions(freshStats.dayId));
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
    setBreakOverdueTags(await getTags("break_overtime", newT.defaultBreakOvertimeTags));
  };

  const handlePenaltyChange = async (mins: number) => {
    setDistractPenaltyMins(mins);
    await saveDistractPenalty(mins);
  };

  const openSettings = () => {
    setIsRunning(false);
    setPage("settings");
  };

  const handleCheckUpdate = async () => {
    setUpdateStatus({ kind: "checking" });
    setUpdateStatus(await checkForUpdate());
  };

  const handleInstallUpdate = async () => {
    setIsRunning(false);
    await installUpdate(setUpdateStatus, async () => {
      await saveAppState(stateRef.current).catch(() => {});
      await saveThemeSettings(theme).catch(() => {});
    });
  };

  if (!loaded) return null;

  if (loadError) {
    return (
      <div className="widget-shell solid-bg" onMouseDown={handleMouseDown}>
        <div className="top-bar">
          <span className="badge">⠿ Error</span>
          <button className="ghost-btn" onClick={hideToTray}>
            ✕
          </button>
        </div>
        <div style={{ fontSize: "10px", color: "#fca5a5", wordBreak: "break-word" }}>
          {loadError}
        </div>
      </div>
    );
  }

  const isAlarm = page === "break" && breakOverdueSec > 0;
  const progressPct =
    isAlarm
      ? 100
      : page === "work"
        ? Math.min(
            100,
            Math.max(
              0,
              (workElapsedSec / Math.max(1, workElapsedSec + workSecondsLeft)) * 100,
            ),
          )
        : Math.min(
            100,
            Math.max(
              0,
              ((breakTotalSec - breakSecondsLeft) / Math.max(1, breakTotalSec)) * 100,
            ),
          );

  const activeSeconds = page === "work" ? workSecondsLeft : breakSecondsLeft;
  const hasPausedProgress = !isRunning && page === "work" && workElapsedSec > 0;
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
        page === "menu" ||
        page === "summary" ||
        page === "settings" ||
        showDistractBox ||
        showStopBox ||
        showBreakOverdueBox ||
        showWorkTopicBox
          ? "solid-bg"
          : ""
      } ${isLightColor(theme.bgColor) ? "light-theme" : ""} ${
        isCelebrating ? "celebrating-shell" : ""
      } ${isAlarm ? "alarm-shell" : ""}`}
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

      {isAlarm && (
        <div className="alarm-badge">
          {t.breakOverdueBadge(formatClock(breakOverdueSec))}
        </div>
      )}

      {/* İnce İlerleme Çizgisi (Progress Bar) */}
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{
            width: `${progressPct}%`,
            backgroundColor:
              isAlarm
                ? "#ef4444"
                : page === "work"
                  ? "var(--timer-color, #fbbf24)"
                  : "#38bdf8",
          }}
        />
      </div>

      {/* ÇALIŞMA VE MOLA EKRANI */}
      {(page === "work" || page === "break") && (
        <>
          <div className="top-bar hover-reveal">
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span className="badge">
                {page === "work" ? (
                  <>
                    💼 {t.work}
                    {currentSessionDistractions > 0 && (
                      <span
                        style={{
                          fontSize: "9px",
                          color: "#fbbf24",
                          marginLeft: "3px",
                        }}
                      >
                        ({currentSessionDistractions}x)
                      </span>
                    )}
                  </>
                ) : breakKind === "short" ? (
                  t.shortBreakBadge(
                    Math.round(breakTotalSec / 60),
                    sessionShortBreakCount,
                  )
                ) : breakKind === "long" ? (
                  t.longBreakBadge(
                    Math.round(breakTotalSec / 60),
                    completedWorkCount,
                  )
                ) : (
                  t.standardBreakBadge(
                    Math.round(breakTotalSec / 60),
                    (completedWorkCount % currentPlan.longBreakInterval) ||
                      currentPlan.longBreakInterval,
                    currentPlan.longBreakInterval,
                  )
                )}
              </span>

              {page === "work" && (
                <>
                  <button
                    className="work-topic-badge"
                    onClick={handleOpenWorkTopicBox}
                    title={t.changeWorkTopic}
                  >
                    🏷️ {currentWorkTag || t.selectWorkTopic}
                    {currentWorkReason ? `: ${currentWorkReason}` : ""}
                  </button>

                  <span
                    className="cycle-badge"
                    title={t.planLongBreakIntervalDesc(
                      currentPlan.longBreakInterval,
                    )}
                  >
                    {t.cycleProgressBadge(
                      completedWorkCount % currentPlan.longBreakInterval,
                      currentPlan.longBreakInterval,
                    )}
                  </span>

                  {sessionShortBreakCount > 0 && (
                    <span
                      className="short-break-chip"
                      title={t.shortBreaksCountBadge(sessionShortBreakCount)}
                    >
                      {t.shortBreaksCountBadge(sessionShortBreakCount)}
                    </span>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <button
                className={`ghost-btn pin-btn ${alwaysOnTop ? "pinned" : ""}`}
                title={t.alwaysOnTopTooltip(alwaysOnTop)}
                onClick={toggleAlwaysOnTop}
              >
                📌
              </button>
              <button
                className="ghost-btn"
                onClick={openMenu}
                title={updateAvailable ? t.updateAvailableHint : ""}
              >
                {t.menu}
                {updateAvailable && <span className="update-dot" />}
              </button>
              <button
                className="ghost-btn"
                title={t.hideToTray}
                onClick={hideToTray}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="timer-wrap">
            {isAlarm ? (
              <div className="timer-display alarm-timer">
                -{formatClock(breakOverdueSec)}
              </div>
            ) : (
              <div className="timer-display">
                {formatClock(activeSeconds)}
              </div>
            )}

            {hasPausedProgress &&
              !showDistractBox &&
              !showStopBox &&
              !showBreakOverdueBox &&
              !showWorkTopicBox && (
                <div className="resume-hint">
                  {t.resumeHint(Math.floor(workElapsedSec / 60))}
                </div>
              )}
          </div>

          {/* DİKKAT DAĞILMASI DİYALOĞU */}
          {showDistractBox ? (
            <div className="stop-box">
              <div className="stop-box-header">
                <span className="stop-box-title">{t.distractionTitle}</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  <button
                    className="ghost-btn"
                    onClick={() => handleAddNewTag("distraction")}
                    title="+ Tag Ekle"
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

              {/* Tag Seçimi */}
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

              {/* Önceki Açıklamalar */}
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

              {/* Açıklama Inputu */}
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
                <button onClick={() => setShowDistractBox(false)}>{t.cancel}</button>
              </div>
            </div>
          ) : showStopBox ? (
            /* ERKEN DURDURMA DİYALOĞU */
            <div className="stop-box">
              <div className="stop-box-header">
                <span className="stop-box-title">{t.earlyStopTitle}</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  <button
                    className="ghost-btn"
                    onClick={() => handleAddNewTag("ending")}
                    title="+ Tag Ekle"
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

              {/* Ending Tag Seçimi */}
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

              {/* Önceki Açıklamalar */}
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

              {/* Açıklama Inputu */}
              <div className="new-reason-row">
                <input
                  className="distract-input"
                  placeholder={t.endingExplanationPlaceholder}
                  value={endingReasonText}
                  autoFocus
                  onChange={(e) => setEndingReasonText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEnding(true);
                    if (e.key === "Escape") setShowStopBox(false);
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
                <button onClick={() => setShowStopBox(false)}>
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
                    title="+ Tag Ekle"
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
                {t.breakOverdueDesc(formatClock(breakOverdueSec))}
              </div>

              {/* Overtime Tag Seçimi */}
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
                              handleEditTagItem(tag.id, tag.name, "break_overtime")
                            }
                          >
                            ✎
                          </button>
                          <button
                            className="tag-icon-btn del-btn"
                            onClick={() =>
                              handleDeleteTagItem(tag.id, tag.name, "break_overtime")
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

              {/* Önceki Açıklamalar */}
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

              {/* Açıklama Inputu */}
              <div className="new-reason-row">
                <input
                  className="distract-input"
                  placeholder={t.workTopicPlaceholder}
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
          ) : showWorkTopicBox ? (
            <div className="stop-box">
              <div className="stop-box-header">
                <span className="stop-box-title">{t.whatAreYouWorkingOn}</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  <button
                    className="ghost-btn"
                    onClick={() => handleAddNewTag("work")}
                    title="+ Tag Ekle"
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
                  {t.add}
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
          ) : isAlarm ? (
            <div className="btn-row hover-reveal">
              <button className="primary-btn" onClick={handleStartWorkFromBreak}>
                🟢 {breakKind === "short" ? t.returnToWorkBtn : t.startWorkBtn}
              </button>
              <button
                onClick={() => {
                  setBreakSecondsLeft(5 * 60);
                  setBreakTotalSec((prev) => prev + 5 * 60);
                  setBreakOverdueSec(0);
                }}
              >
                {t.extendBreak5m}
              </button>
              <button onClick={handleStopSession}>{t.stop}</button>
            </div>
          ) : page === "break" ? (
            <div className="btn-row hover-reveal">
              <button className="primary-btn" onClick={handleStartWorkFromBreak}>
                🟢 {breakKind === "short" ? t.returnToWorkBtn : t.startWorkBtn}
              </button>
              <button
                onClick={() => {
                  setBreakSecondsLeft((prev) => prev + 5 * 60);
                  setBreakTotalSec((prev) => prev + 5 * 60);
                }}
              >
                {t.extendBreak5m}
              </button>
              <button onClick={handleStopSession}>{t.stop}</button>
            </div>
          ) : (
            <div className="btn-row hover-reveal">
              <button
                className="primary-btn"
                onClick={() => {
                  setIsCelebrating(false);
                  setIsRunning(!isRunning);
                }}
              >
                {isRunning
                  ? t.pause
                  : hasPausedProgress
                    ? t.resume
                    : t.start}
              </button>
              <button
                className="short-break-btn"
                onClick={handleTakeShortBreak}
                title={`Kısa mola (${currentPlan.shortBreakMins} dk)`}
              >
                {t.shortBreakBtn(currentPlan.shortBreakMins)}
              </button>
              <button onClick={handleStopSession}>{t.stop}</button>
              <button className="warn-btn" onClick={handleDistractedClick}>
                {t.distractedBtnText(distractPenaltyMins)}
              </button>
            </div>
          )}
        </>
      )}

      {/* ANA MENÜ */}
      {page === "menu" && (
        <>
          <div className="top-bar">
            <span className="badge">
              ⠿ {t.menu} • {dayStats.label}
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                className={`ghost-btn pin-btn ${alwaysOnTop ? "pinned" : ""}`}
                title={t.alwaysOnTopTooltip(alwaysOnTop)}
                onClick={toggleAlwaysOnTop}
              >
                📌
              </button>
              <button
                className="ghost-btn"
                title={t.settings}
                onClick={openSettings}
              >
                ⚙ {t.settings}
              </button>
              <button className="ghost-btn" onClick={openSummary}>
                {t.summary} →
              </button>
              <button
                className="ghost-btn"
                title={t.hideToTray}
                onClick={hideToTray}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="stats-grid">
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
                {Math.round(dayStats.avgSec / 60)} {activeLang === "tr" ? "dk" : "min"}
              </div>
              <div className="stat-lbl">{t.average}</div>
            </div>
          </div>

          <div className="last-pos-bar">
            {t.lastState(formatClock(workSecondsLeft), formatClock(breakSecondsLeft))}
          </div>

          {(updateStatus.kind === "available" ||
            updateStatus.kind === "downloading") && (
            <div className="update-banner">
              {updateStatus.kind === "available" ? (
                <>
                  <span>{t.newVersionReady(updateStatus.version)}</span>
                  <button className="primary-btn" onClick={handleInstallUpdate}>
                    {t.installVersion(updateStatus.version)}
                  </button>
                </>
              ) : (
                <span>{t.updateDownloading(updateStatus.percent)}</span>
              )}
            </div>
          )}

          {/* ÇALIŞMA PLANI SEÇİCİ */}
          <div className="plan-picker-box">
            <div className="plan-picker-header">
              <span>{t.plansTitle}</span>
              <span className="cycle-badge">
                {t.cycleProgressBadge(
                  completedWorkCount % currentPlan.longBreakInterval,
                  currentPlan.longBreakInterval,
                )}
              </span>
            </div>
            <select
              className="plan-dropdown-select"
              value={activePlanId}
              onChange={(e) => handleSelectPlan(e.target.value)}
            >
              {studyPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.workMins} dk / {p.standardBreakMins} dk • {p.longBreakInterval}+1)
                </option>
              ))}
            </select>
            <div className="plan-chips-row">
              <span className="plan-chip highlight">💼 {currentPlan.workMins} dk</span>
              <span className="plan-chip">☕ {currentPlan.shortBreakMins} dk kısa</span>
              <span className="plan-chip">🌴 {currentPlan.standardBreakMins} dk standart</span>
              <span className="plan-chip">🎉 {currentPlan.longBreakMins} dk uzun ({currentPlan.longBreakInterval}+1)</span>
              {sessionShortBreakCount > 0 && (
                <span className="plan-chip" style={{ color: "#38bdf8" }}>
                  ☕ {sessionShortBreakCount} kısa mola
                </span>
              )}
            </div>
          </div>

          <div className="menu-actions">
            {hasPausedProgress ? (
              <button
                className="primary-btn"
                onClick={() => {
                  setIsCelebrating(false);
                  setPage("work");
                }}
              >
                🟢 {t.resume} ({formatClock(workSecondsLeft)})
              </button>
            ) : (
              <button
                className="primary-btn"
                onClick={() => handleStartSessionWithPlan(currentPlan)}
              >
                {t.startSessionWithPlan(currentPlan.name)}
              </button>
            )}
            <button className="warn-btn full-width" onClick={handleStartNewDay}>
              {t.startNewDay}
            </button>
          </div>

          <div className="credits-bar">
            Credits by <b>Elyas</b>
          </div>
        </>
      )}

      {/* AYARLAR SAYFASI */}
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
            <div className="penalty-selector">
              {PENALTY_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  className={`penalty-btn ${distractPenaltyMins === mins ? "active" : ""}`}
                  onClick={() => handlePenaltyChange(mins)}
                >
                  {mins === 0
                    ? activeLang === "tr"
                      ? "0 dk (Ekleme)"
                      : "0 m (None)"
                    : `+${mins} ${activeLang === "tr" ? "dk" : "m"}`}
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
                style={{ fontSize: "8px", padding: "1px 5px" }}
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
                    {p.name}
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
                      <span className="plan-field-label">{t.planNameLabel}</span>
                      <input
                        className="plan-text-input"
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
                      <span className="plan-field-label">💼 {t.planWorkMins}</span>
                      <input
                        type="number"
                        className="plan-number-input"
                        min={1}
                        max={180}
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
                      <span className="plan-field-label">☕ {t.planShortBreakMins}</span>
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
                      <span className="plan-field-label">🌴 {t.planStandardBreakMins}</span>
                      <input
                        type="number"
                        className="plan-number-input"
                        min={1}
                        max={60}
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
                      <span className="plan-field-label">🎉 {t.planLongBreakMins}</span>
                      <input
                        type="number"
                        className="plan-number-input"
                        min={1}
                        max={120}
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
                        max={10}
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
                onChange={(e) => updateTheme({ timerColor: e.target.value })}
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

      {/* ÖZET SAYFASI */}
      {page === "summary" && (
        <>
          <div className="top-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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

          {/* SIFIRLAMA ONAY KUTUSU */}
          {showResetConfirm ? (
            <div className="reset-confirm-box">
              <div className="reset-confirm-title">{t.resetConfirmTitle}</div>
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
                              ? activeLang === "tr"
                                ? "Çalışma"
                                : "Work"
                              : activeLang === "tr"
                                ? "Mola"
                                : "Break"}
                          </b>
                          :{" "}
                          {hoveredTimelineItem.tag ||
                            (hoveredTimelineItem.mode === "work"
                              ? "Ders"
                              : "Mola")}
                          {hoveredTimelineItem.reason
                            ? ` (${hoveredTimelineItem.reason})`
                            : ""}
                        </span>
                        <span>
                          {hoveredTimelineItem.timeRangeLabel} •{" "}
                          {t.formatDuration(hoveredTimelineItem.durationSec)}
                          {hoveredTimelineItem.overtimeSec > 0
                            ? ` (+${Math.round(hoveredTimelineItem.overtimeSec / 60)} dk ${activeLang === "tr" ? "gecikme" : "overdue"})`
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
                            0.8,
                            ((s.endHour - s.startHour) / 24) * 100,
                          );
                          return (
                            <div
                              key={s.id}
                              className={`timeline-block ${s.mode} ${hoveredTimelineItem?.id === s.id ? "active-bar" : ""}`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                              onMouseEnter={() => setHoveredTimelineItem(s)}
                              title={`${s.mode === "work" ? "Çalışma" : "Mola"}: ${s.timeRangeLabel}`}
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
                            className={`timeline-session-row ${s.mode}`}
                            onMouseEnter={() => setHoveredTimelineItem(s)}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <span className="timeline-session-time">
                                {s.timeRangeLabel}
                              </span>
                              <span className="timeline-session-tag">
                                {s.mode === "work" ? "💼" : "☕"}{" "}
                                {s.tag ||
                                  (s.mode === "work" ? "Ders" : "Mola")}
                              </span>
                              {s.reason && (
                                <span
                                  style={{
                                    color: "#a1a1aa",
                                    fontSize: "8px",
                                  }}
                                >
                                  ({s.reason})
                                </span>
                              )}
                              {s.overtimeSec > 0 ? (
                                <span className="overtime-badge">
                                  +{Math.round(s.overtimeSec / 60)} dk
                                </span>
                              ) : null}
                            </div>
                            <span
                              style={{
                                color: "#71717a",
                                fontFamily: "monospace",
                              }}
                            >
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
                          <b>{hoveredWeekDay.shortLabel}</b> ({hoveredWeekDay.dateLabel}):{" "}
                          {(hoveredWeekDay.total_sec / 3600).toFixed(1)} {activeLang === "tr" ? "sa" : "h"}
                        </span>
                        <span>
                          {hoveredWeekDay.session_count} {t.sessions.toLowerCase()} • {t.formatDuration(hoveredWeekDay.total_sec)}
                        </span>
                      </>
                    ) : (
                      <span>{t.summaryHoverHint}</span>
                    )}
                  </div>

                  <div className="chart-area">
                    {weeklySummary?.days.map((d) => {
                      const hours = d.total_sec / 3600;
                      const heightPct = Math.max(6, (hours / maxWeeklyHours) * 85);
                      const isHovered = hoveredWeekDay?.dayIndex === d.dayIndex;
                      return (
                        <div
                          key={d.dayIndex}
                          className="bar-col"
                          onMouseEnter={() => setHoveredWeekDay(d)}
                        >
                          <span className="bar-hours">
                            {hours.toFixed(1)}{activeLang === "tr" ? "s" : "h"}
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
                            {d.shortLabel}{d.is_today ? "•" : ""}
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
                                hoveredDay.total_sec / hoveredDay.session_count / 60,
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
                      const heightPct = Math.max(6, (hours / maxRecentHours) * 85);
                      return (
                        <div
                          key={d.id}
                          className="bar-col"
                          onMouseEnter={() => setHoveredDay(d)}
                        >
                          <span className="bar-hours">
                            {hours.toFixed(1)}{activeLang === "tr" ? "s" : "h"}
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

              {/* KATEGORİ KIRILIMI */}
              <div className="summary-subtabs">
                <button
                  className={`subtab-btn ${summaryReasonsTab === "work" ? "active" : ""}`}
                  onClick={() => setSummaryReasonsTab("work")}
                >
                  {t.workTagsTab} ({summaryReasonsData?.totalWorkSubjects ?? 0})
                </button>
                <button
                  className={`subtab-btn ${summaryReasonsTab === "overtime" ? "active" : ""}`}
                  onClick={() => setSummaryReasonsTab("overtime")}
                >
                  {t.breakOvertimeTab} ({summaryReasonsData?.totalBreakOvertimes ?? 0})
                </button>
                <button
                  className={`subtab-btn ${summaryReasonsTab === "distractions" ? "active" : ""}`}
                  onClick={() => setSummaryReasonsTab("distractions")}
                >
                  {t.distractionReasonsTab} ({summaryReasonsData?.totalDistractions ?? 0})
                </button>
                <button
                  className={`subtab-btn ${summaryReasonsTab === "endings" ? "active" : ""}`}
                  onClick={() => setSummaryReasonsTab("endings")}
                >
                  {t.endingReasonsTab} ({summaryReasonsData?.totalEndings ?? 0})
                </button>
                <button className="ghost-btn" onClick={toggleFreqFilter}>
                  {freqOnlyToday ? t.filterToday : t.filterAll}
                </button>
              </div>

              <div className="accordion-list">
                {summaryReasonsTab === "work" ? (
                  (summaryReasonsData?.workTags.length ?? 0) > 0 ? (
                    summaryReasonsData?.workTags.map((item) => {
                      const isExpanded = !!expandedTags[item.tag];
                      const total = summaryReasonsData.totalWorkSubjects;
                      const pct =
                        total > 0
                          ? Math.round((item.count / total) * 100)
                          : 0;
                      return (
                        <div key={item.tag} className="accordion-card">
                          <div
                            className="accordion-header"
                            onClick={() => toggleAccordionTag(item.tag)}
                          >
                            <div className="accordion-title">
                              <span className="accordion-arrow">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <span>{item.tag}</span>
                            </div>
                            <span className="accordion-count">
                              {item.count}{" "}
                              {t.timesCount(item.count, pct).split(" ")[1] ||
                                "kez"}{" "}
                              (%{pct})
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="accordion-body">
                              {item.explanations.map((exp, idx) => (
                                <div key={idx} className="explanation-row">
                                  <span>
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
                  ) : (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#a1a1aa",
                        padding: "6px",
                      }}
                    >
                      {activeLang === "tr"
                        ? "Henüz çalışma konusu kaydedilmedi."
                        : "No work topics recorded yet."}
                    </div>
                  )
                ) : summaryReasonsTab === "overtime" ? (
                  (summaryReasonsData?.breakOvertimeTags.length ?? 0) > 0 ? (
                    summaryReasonsData?.breakOvertimeTags.map((item) => {
                      const isExpanded = !!expandedTags[item.tag];
                      const total = summaryReasonsData.totalBreakOvertimes;
                      const pct =
                        total > 0
                          ? Math.round((item.count / total) * 100)
                          : 0;
                      return (
                        <div key={item.tag} className="accordion-card">
                          <div
                            className="accordion-header"
                            onClick={() => toggleAccordionTag(item.tag)}
                          >
                            <div className="accordion-title">
                              <span className="accordion-arrow">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <span>{item.tag}</span>
                            </div>
                            <span className="accordion-count">
                              {item.count}{" "}
                              {t.timesCount(item.count, pct).split(" ")[1] ||
                                "kez"}{" "}
                              (%{pct})
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="accordion-body">
                              {item.explanations.map((exp, idx) => (
                                <div key={idx} className="explanation-row">
                                  <span>
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
                  ) : (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#a1a1aa",
                        padding: "6px",
                      }}
                    >
                      {activeLang === "tr"
                        ? "Henüz mola gecikmesi kaydedilmedi."
                        : "No break overtime recorded yet."}
                    </div>
                  )
                ) : summaryReasonsTab === "distractions" ? (
                  (summaryReasonsData?.distractionTags.length ?? 0) > 0 ? (
                    summaryReasonsData?.distractionTags.map((item) => {
                      const isExpanded = !!expandedTags[item.tag];
                      const total = summaryReasonsData.totalDistractions;
                      const pct =
                        total > 0
                          ? Math.round((item.count / total) * 100)
                          : 0;
                      return (
                        <div key={item.tag} className="accordion-card">
                          <div
                            className="accordion-header"
                            onClick={() => toggleAccordionTag(item.tag)}
                          >
                            <div className="accordion-title">
                              <span className="accordion-arrow">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <span>{item.tag}</span>
                            </div>
                            <span className="accordion-count">
                              {item.count}{" "}
                              {t.timesCount(item.count, pct).split(" ")[1] ||
                                "kez"}{" "}
                              (%{pct})
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="accordion-body">
                              {item.explanations.map((exp, idx) => (
                                <div key={idx} className="explanation-row">
                                  <span>
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
                  ) : (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#a1a1aa",
                        padding: "6px",
                      }}
                    >
                      {t.noDistractions}
                    </div>
                  )
                ) : (summaryReasonsData?.endingTags.length ?? 0) > 0 ? (
                  summaryReasonsData?.endingTags.map((item) => {
                    const isExpanded = !!expandedTags[item.tag];
                    const total = summaryReasonsData.totalEndings;
                    const pct =
                      total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div key={item.tag} className="accordion-card">
                        <div
                          className="accordion-header"
                          onClick={() => toggleAccordionTag(item.tag)}
                        >
                          <div className="accordion-title">
                            <span className="accordion-arrow">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span>{item.tag}</span>
                          </div>
                          <span className="accordion-count">
                            {item.count} kez (%{pct})
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="accordion-body">
                            {item.explanations.map((exp, idx) => (
                              <div key={idx} className="explanation-row">
                                <span>
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
                ) : (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#a1a1aa",
                      padding: "6px",
                    }}
                  >
                    {t.noEndingReasons}
                  </div>
                )}
              </div>

              {/* VERİLERİ SIFIRLAMA & DIŞA AKTARMA BUTONLARI */}
              <div className="summary-bottom-row">
                <button
                  className="ghost-btn"
                  onClick={handleExportData}
                  title={t.exportDataBtn}
                >
                  📥 {t.exportDataBtn}
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
    </div>
  );
}
