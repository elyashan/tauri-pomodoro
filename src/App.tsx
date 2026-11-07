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

const PENALTY_OPTIONS = [1, 2, 3, 5];

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

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.12;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 350);
  } catch {
    // Ses cihazı meşgulse sessizce geç
  }
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<PageType>("work");

  // Dil durumu
  const [langPref, setLangPref] = useState<LangCode>("auto");
  const activeLang = resolveLanguage(langPref);
  const t = translations[activeLang];

  const [workSecondsLeft, setWorkSecondsLeft] = useState(DEFAULT_WORK_SEC);
  const [workElapsedSec, setWorkElapsedSec] = useState(0);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(DEFAULT_BREAK_SEC);

  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState("50");
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
  const [summaryTab, setSummaryTab] = useState<"weekly" | "recent">("weekly");
  const [summaryReasonsTab, setSummaryReasonsTab] = useState<"distractions" | "endings">(
    "distractions",
  );
  const [summaryReasonsData, setSummaryReasonsData] = useState<SummaryReasonsData | null>(
    null,
  );
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
        setDistractTags(dTags);
        setEndingTags(eTags);
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
      win.setSize(new LogicalSize(310, hasBanner ? 346 : 312));
    } else if (page === "summary") {
      win.setSize(new LogicalSize(360, 450));
    } else if (page === "settings") {
      win.setSize(new LogicalSize(310, 450));
    } else if (showStopBox || showDistractBox) {
      win.setSize(new LogicalSize(310, 310));
    } else {
      win.setSize(new LogicalSize(240, 124));
    }
  }, [page, showDistractBox, showStopBox, loaded, updateStatus.kind]);

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
          setBreakSecondsLeft((prev) => Math.max(0, prev - delta));
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isRunning, page]);

  // Süre bittiğinde otomatik seans kaydı
  useEffect(() => {
    if (!isRunning) return;
    if (page === "work" && workSecondsLeft === 0) {
      setIsRunning(false);
      playBeep();
      (async () => {
        await recordWorkSession(workElapsedSec);
        setWorkSecondsLeft(DEFAULT_WORK_SEC);
        setWorkElapsedSec(0);
        setCurrentSessionDistractions(0);
        const locale = activeLang === "tr" ? "tr-TR" : "en-US";
        setDayStats(await getActiveDayStats(locale));
        setWeeklySummary(await getWeeklySummary(locale));
      })();
    } else if (page === "break" && breakSecondsLeft === 0) {
      setIsRunning(false);
      playBeep();
      setBreakSecondsLeft(DEFAULT_BREAK_SEC);
    }
  }, [isRunning, page, workSecondsLeft, breakSecondsLeft, workElapsedSec, activeLang]);

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

  const handleSaveEditedTime = () => {
    const mins = parseInt(editMinutes, 10);
    if (!isNaN(mins) && mins > 0) {
      if (page === "work") {
        setWorkSecondsLeft(mins * 60);
        setWorkElapsedSec(0);
      } else {
        setBreakSecondsLeft(mins * 60);
      }
    }
    setIsEditing(false);
  };

  // ---------------------------------------------------------------------------
  // DİKKAT DAĞILMASI İŞLEMLERİ
  // ---------------------------------------------------------------------------
  const handleDistractedClick = async () => {
    // Süreye ayarlanan ceza süresini ekle
    setWorkSecondsLeft((prev) => prev + distractPenaltyMins * 60);
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
      setBreakSecondsLeft(DEFAULT_BREAK_SEC);
    }
  };

  const handleSelectEndingTag = async (tagName: string) => {
    setSelectedEndingTag(tagName);
    const prevReasons = await getPreviousReasons("ending", tagName);
    setEndingPreviousReasons(prevReasons);
  };

  const submitEnding = async (withTag = true) => {
    if (workElapsedSec >= 15) {
      const tag = withTag ? selectedEndingTag : undefined;
      const reason = withTag ? (endingReasonText.trim() || selectedEndingTag) : undefined;
      await recordWorkSession(workElapsedSec, tag, reason);
      const locale = activeLang === "tr" ? "tr-TR" : "en-US";
      setDayStats(await getActiveDayStats(locale));
      setWeeklySummary(await getWeeklySummary(locale));
    }
    setWorkSecondsLeft(DEFAULT_WORK_SEC);
    setWorkElapsedSec(0);
    setCurrentSessionDistractions(0);
    setShowStopBox(false);
    setEndingReasonText("");
    setIsEditingEndingTags(false);
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
      } else {
        const updated = await getTags("ending", t.defaultEndingTags);
        setEndingTags(updated);
        setSelectedEndingTag(newName.trim());
      }
    }
  };

  const handleEditTagItem = async (tagId: number, currentName: string, kind: TagKind) => {
    const newName = window.prompt(t.editTagPrompt(currentName), currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      await updateTag(tagId, newName.trim(), kind);
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
      } else {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      }
    }
  };

  const handleDeleteTagItem = async (tagId: number, name: string, kind: TagKind) => {
    if (window.confirm(t.deleteTagConfirm(name))) {
      await deleteTag(tagId);
      if (kind === "distraction") {
        setDistractTags(await getTags("distraction", t.defaultDistractionTags));
      } else {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      }
    }
  };

  // ---------------------------------------------------------------------------
  // MENÜ VE ÖZET SAYFASI
  // ---------------------------------------------------------------------------
  const openMenu = async () => {
    setIsRunning(false);
    setShowDistractBox(false);
    setShowStopBox(false);
    setDayStats(await getActiveDayStats(activeLang === "tr" ? "tr-TR" : "en-US"));
    setPage("menu");
  };

  const openSummary = async () => {
    setIsRunning(false);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const days = await getDaysSummary();
    const weekly = await getWeeklySummary(locale);
    const reasonsData = await getSummaryReasonsData(freqOnlyToday);

    setSummaryDays(days);
    setWeeklySummary(weekly);
    setSummaryReasonsData(reasonsData);
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

    setDayStats(freshStats);
    setSummaryDays(freshDays);
    setWeeklySummary(freshWeekly);
    setSummaryReasonsData(freshReasons);
    setHoveredDay(null);
    setHoveredWeekDay(null);
    setShowResetConfirm(false);
  };

  const handleStartNewDay = async () => {
    setIsRunning(false);
    if (workElapsedSec >= 60) {
      await recordWorkSession(workElapsedSec);
    }
    setWorkSecondsLeft(DEFAULT_WORK_SEC);
    setWorkElapsedSec(0);
    setBreakSecondsLeft(DEFAULT_BREAK_SEC);
    setCurrentSessionDistractions(0);
    const locale = activeLang === "tr" ? "tr-TR" : "en-US";
    const freshStats = await startNewDay(locale);
    setDayStats(freshStats);
    setWeeklySummary(await getWeeklySummary(locale));
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
        showStopBox
          ? "solid-bg"
          : ""
      } ${isLightColor(theme.bgColor) ? "light-theme" : ""}`}
      style={shellStyle}
      onMouseDown={handleMouseDown}
    >
      {/* ÇALIŞMA VE MOLA EKRANI */}
      {(page === "work" || page === "break") && (
        <>
          <div className="top-bar hover-reveal">
            <span className="badge">
              ⠿ {page === "work" ? t.work : t.break}
              {page === "work" && currentSessionDistractions > 0 && (
                <span style={{ fontSize: "9px", color: "#fbbf24", marginLeft: "4px" }}>
                  ({currentSessionDistractions}x)
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
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
            {isEditing ? (
              <input
                className="timer-input"
                type="number"
                value={editMinutes}
                autoFocus
                onChange={(e) => setEditMinutes(e.target.value)}
                onBlur={handleSaveEditedTime}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEditedTime()}
              />
            ) : (
              <div
                className={`timer-display ${!isRunning ? "clickable-timer" : ""}`}
                title={!isRunning ? t.clickToEditTime : ""}
                onClick={() => {
                  if (!isRunning) {
                    setEditMinutes(Math.ceil(activeSeconds / 60).toString());
                    setIsEditing(true);
                  }
                }}
              >
                {formatClock(activeSeconds)}
              </div>
            )}

            {hasPausedProgress && !showDistractBox && !showStopBox && (
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
          ) : (
            <div className="btn-row hover-reveal">
              <button
                className="primary-btn"
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning
                  ? t.pause
                  : hasPausedProgress
                    ? t.resume
                    : t.start}
              </button>
              <button onClick={handleStopSession}>{t.stop}</button>
              {page === "work" && (
                <button className="warn-btn" onClick={handleDistractedClick}>
                  {t.distractedBtnText(distractPenaltyMins)}
                </button>
              )}
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

          <div className="menu-actions">
            <button className="primary-btn" onClick={() => setPage("work")}>
              {t.switchToWork}
            </button>
            <button onClick={() => setPage("break")}>{t.switchToBreak}</button>
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
                  +{mins} {activeLang === "tr" ? "dk" : "m"}
                </button>
              ))}
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

              {/* DİKKAT DAĞILMA & ERKEN BİTİRME KATEGORİ KIRILIMI */}
              <div className="summary-subtabs">
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
                {summaryReasonsTab === "distractions" ? (
                  (summaryReasonsData?.distractionTags.length ?? 0) > 0 ? (
                    summaryReasonsData?.distractionTags.map((item) => {
                      const isExpanded = !!expandedTags[item.tag];
                      const total = summaryReasonsData.totalDistractions;
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
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
                              {item.count} {t.timesCount(item.count, pct).split(" ")[1] || "kez"} (%{pct})
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
                                  <span className="explanation-badge">{exp.count}x</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: "10px", color: "#a1a1aa", padding: "6px" }}>
                      {t.noDistractions}
                    </div>
                  )
                ) : (summaryReasonsData?.endingTags.length ?? 0) > 0 ? (
                  summaryReasonsData?.endingTags.map((item) => {
                    const isExpanded = !!expandedTags[item.tag];
                    const total = summaryReasonsData.totalEndings;
                    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
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
                                <span className="explanation-badge">{exp.count}x</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: "10px", color: "#a1a1aa", padding: "6px" }}>
                    {t.noEndingReasons}
                  </div>
                )}
              </div>

              {/* VERİLERİ SIFIRLAMA BUTONU */}
              <div className="summary-bottom-row">
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
