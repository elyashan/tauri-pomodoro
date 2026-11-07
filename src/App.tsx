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
  DistractionFrequency,
  ThemeSettings,
  DEFAULT_THEME,
  DEFAULT_WORK_SEC,
  DEFAULT_BREAK_SEC,
  loadAppState,
  saveAppState,
  loadThemeSettings,
  saveThemeSettings,
  getActiveDayStats,
  startNewDay,
  recordWorkSession,
  recordDistraction,
  getDaysSummary,
  getReasonChoices,
  getDistractionFrequencies,
} from "./db";
import { UpdateStatus, checkForUpdate, installUpdate } from "./updater";
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

// "#rrggbb" + saydamlık(%) -> "rgba(r, g, b, a)"
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

// Açık renkli arka planlarda yazıların okunabilmesi için
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

  const [workSecondsLeft, setWorkSecondsLeft] = useState(DEFAULT_WORK_SEC);
  const [workElapsedSec, setWorkElapsedSec] = useState(0);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(DEFAULT_BREAK_SEC);

  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState("50");
  const [autoStartOn, setAutoStartOn] = useState(false);

  // Dikkatim dağıldı şıkları ve yeni neden girişi
  const [showDistractBox, setShowDistractBox] = useState(false);
  const [distractReason, setDistractReason] = useState("");
  const [reasonChoices, setReasonChoices] = useState<string[]>([]);

  // İstatistikler ve Özet verisi
  const [dayStats, setDayStats] = useState<ActiveDayStats>({
    dayId: 1,
    label: "Bugün",
    totalSec: 0,
    sessionCount: 0,
    avgSec: 0,
  });
  const [summaryDays, setSummaryDays] = useState<DaySummary[]>([]);
  const [hoveredDay, setHoveredDay] = useState<DaySummary | null>(null);
  const [freqOnlyToday, setFreqOnlyToday] = useState(false);
  const [distractFreqs, setDistractFreqs] = useState<DistractionFrequency[]>(
    [],
  );

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

  // Periyodik yedekleme her saniye yeniden kurulmasın diye güncel durumu ref'te tut
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
        const stats = await getActiveDayStats();
        const days = await getDaysSummary();
        const choices = await getReasonChoices();
        const freqs = await getDistractionFrequencies(false);
        const savedTheme = await loadThemeSettings();

        setPage(saved.page);
        setWorkSecondsLeft(saved.work_seconds_left);
        setWorkElapsedSec(saved.work_elapsed_sec);
        setBreakSecondsLeft(saved.break_seconds_left);
        setDayStats(stats);
        setSummaryDays(days);
        setReasonChoices(choices);
        setDistractFreqs(freqs);
        setTheme(savedTheme);
      } catch (err) {
        console.error("Veritabanı yüklenemedi:", err);
        setLoadError(String(err));
      }

      getVersion()
        .then(setAppVersion)
        .catch(() => {});

      // Otomatik başlatma hatası uygulamanın açılmasını engellemesin
      try {
        if (!import.meta.env.DEV) {
          const firstRunDone = localStorage.getItem("autostart_initialized");
          if (!firstRunDone) {
            await enable();
            localStorage.setItem("autostart_initialized", "1");
          } else if (await isEnabled()) {
            // Exe taşındıysa veya güncellemeyle yeri değiştiyse kayıttaki yolu tazele
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

  // Sayfaya göre pencere boyutunu ayarla
  useEffect(() => {
    if (!loaded) return;
    const win = getCurrentWindow();
    if (page === "menu") {
      const hasBanner =
        updateStatus.kind === "available" ||
        updateStatus.kind === "downloading";
      win.setSize(new LogicalSize(310, hasBanner ? 326 : 290));
    } else if (page === "summary") {
      win.setSize(new LogicalSize(360, 390));
    } else if (page === "settings") {
      win.setSize(new LogicalSize(310, 330));
    } else if (showDistractBox) {
      win.setSize(new LogicalSize(285, 235));
    } else {
      win.setSize(new LogicalSize(240, 124));
    }
  }, [page, showDistractBox, loaded, updateStatus.kind]);

  // Renk ayarları değişince kaydet (renk seçici sürüklenirken her an yazmamak için gecikmeli)
  useEffect(() => {
    if (!loaded || !themeDirtyRef.current) return;
    const t = setTimeout(() => {
      saveThemeSettings(theme).catch((err) =>
        console.error("Renk ayarları kaydedilemedi:", err),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [theme, loaded]);

  // Açılışta ve 6 saatte bir sessizce güncelleme kontrolü (geliştirme modunda kapalı)
  useEffect(() => {
    if (!loaded || import.meta.env.DEV) return;
    const runCheck = async () => {
      const result = await checkForUpdate();
      // Arka plan kontrolünde hata/güncel durumunu gösterme; sadece yeni sürüm varsa bildir
      if (result.kind === "available") setUpdateStatus(result);
    };
    const first = setTimeout(runCheck, 10_000);
    const interval = setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [loaded]);

  // Durum kaydı: sayaç durmuşken her değişiklikte (süre düzenleme, durdur,
  // sayfa değişimi vb.) hemen kaydet
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

  // Sayaç çalışırken 5 saniyede bir yedekle (ref sayesinde interval sıfırlanmaz)
  useEffect(() => {
    if (!loaded || !isRunning) return;
    persistState(stateRef.current);
    const backup = setInterval(() => persistState(stateRef.current), 5000);
    return () => clearInterval(backup);
  }, [loaded, isRunning]);

  // Sistem saatine dayalı kaymaz sayaç döngüsü
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
        setDayStats(await getActiveDayStats());
      })();
    } else if (page === "break" && breakSecondsLeft === 0) {
      setIsRunning(false);
      playBeep();
      setBreakSecondsLeft(DEFAULT_BREAK_SEC);
    }
  }, [isRunning, page, workSecondsLeft, breakSecondsLeft, workElapsedSec]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, .clickable-timer, .bar-col")) return;
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

  const formatDurationText = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.round((sec % 3600) / 60);
    if (hrs === 0) return `${mins} dk`;
    return `${hrs}s ${mins}dk`;
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

  const handleStopSession = async () => {
    setIsRunning(false);
    if (page === "work") {
      if (workElapsedSec >= 60) {
        await recordWorkSession(workElapsedSec);
        setDayStats(await getActiveDayStats());
      }
      setWorkSecondsLeft(DEFAULT_WORK_SEC);
      setWorkElapsedSec(0);
    } else {
      setBreakSecondsLeft(DEFAULT_BREAK_SEC);
    }
  };

  const handleDistractedClick = async () => {
    setWorkSecondsLeft((prev) => prev + 60);
    setReasonChoices(await getReasonChoices());
    setShowDistractBox(true);
  };

  const submitDistractionReason = async (reasonText: string) => {
    await recordDistraction(reasonText);
    setDistractReason("");
    setShowDistractBox(false);
    setReasonChoices(await getReasonChoices());
  };

  const openMenu = async () => {
    setIsRunning(false);
    setShowDistractBox(false);
    setDayStats(await getActiveDayStats());
    setPage("menu");
  };

  const openSummary = async () => {
    setIsRunning(false);
    const days = await getDaysSummary();
    const freqs = await getDistractionFrequencies(freqOnlyToday);
    setSummaryDays(days);
    setHoveredDay(days[days.length - 1] ?? null);
    setDistractFreqs(freqs);
    setPage("summary");
  };

  const toggleFreqFilter = async () => {
    const nextVal = !freqOnlyToday;
    setFreqOnlyToday(nextVal);
    setDistractFreqs(await getDistractionFrequencies(nextVal));
  };

  const handleStartNewDay = async () => {
    setIsRunning(false);
    if (workElapsedSec >= 60) {
      await recordWorkSession(workElapsedSec);
    }
    setWorkSecondsLeft(DEFAULT_WORK_SEC);
    setWorkElapsedSec(0);
    setBreakSecondsLeft(DEFAULT_BREAK_SEC);
    const freshStats = await startNewDay();
    setDayStats(freshStats);
  };

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    themeDirtyRef.current = true;
    setTheme((prev) => ({ ...prev, ...patch }));
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
      // Kurulum uygulamayı kapatacağı için son durumu ve renkleri kaydet
      await saveAppState(stateRef.current).catch(() => {});
      await saveThemeSettings(theme).catch(() => {});
    });
  };

  if (!loaded) return null;

  if (loadError) {
    return (
      <div className="widget-shell solid-bg" onMouseDown={handleMouseDown}>
        <div className="top-bar">
          <span className="badge">⠿ Veritabanı hatası</span>
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
  const maxSummaryHours = Math.max(
    1,
    ...summaryDays.map((d) => d.total_sec / 3600),
  );
  const totalDistractions = distractFreqs.reduce(
    (acc, item) => acc + item.count,
    0,
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
        showDistractBox
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
              ⠿ {page === "work" ? "Çalışma" : "Mola"}
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                className="ghost-btn"
                onClick={openMenu}
                title={updateAvailable ? "Yeni sürüm mevcut" : ""}
              >
                Menü{updateAvailable && <span className="update-dot" />}
              </button>
              <button
                className="ghost-btn"
                title="Arka plana (sağ alt tepsiye) gizle"
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
                title={!isRunning ? "Dakikayı ayarlamak için tıkla" : ""}
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

            {hasPausedProgress && !showDistractBox && (
              <div className="resume-hint">
                Kaldığın yer ({Math.floor(workElapsedSec / 60)} dk çalışıldı)
              </div>
            )}
          </div>

          {showDistractBox ? (
            <div className="distract-box">
              <div className="reason-chips">
                {reasonChoices.map((choice) => (
                  <button
                    key={choice}
                    className="reason-chip"
                    onClick={() => submitDistractionReason(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <div className="new-reason-row">
                <input
                  className="distract-input"
                  placeholder="Veya yeni neden yaz..."
                  value={distractReason}
                  autoFocus
                  onChange={(e) => setDistractReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && distractReason.trim()) {
                      submitDistractionReason(distractReason);
                    }
                    if (e.key === "Escape") setShowDistractBox(false);
                  }}
                />
                <button
                  className="primary-btn"
                  onClick={() =>
                    submitDistractionReason(distractReason || "Diğer")
                  }
                >
                  Ekle
                </button>
                <button onClick={() => setShowDistractBox(false)}>İptal</button>
              </div>
            </div>
          ) : (
            <div className="btn-row hover-reveal">
              <button
                className="primary-btn"
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning
                  ? "Duraklat"
                  : hasPausedProgress
                    ? "Devam Et"
                    : "Başlat"}
              </button>
              <button onClick={handleStopSession}>Durdur</button>
              {page === "work" && (
                <button className="warn-btn" onClick={handleDistractedClick}>
                  +1dk Dağıldım
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
            <span className="badge">⠿ Menü • {dayStats.label}</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                className="ghost-btn"
                title="Renkler, otomatik başlatma ve güncellemeler"
                onClick={openSettings}
              >
                ⚙ Ayarlar
              </button>
              <button className="ghost-btn" onClick={openSummary}>
                Özet →
              </button>
              <button
                className="ghost-btn"
                title="Tepsiye gizle"
                onClick={hideToTray}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-val">
                {formatDurationText(dayStats.totalSec)}
              </div>
              <div className="stat-lbl">Toplam Çalışma</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">{dayStats.sessionCount}</div>
              <div className="stat-lbl">Seans</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">
                {Math.round(dayStats.avgSec / 60)} dk
              </div>
              <div className="stat-lbl">Ortalama</div>
            </div>
          </div>

          <div className="last-pos-bar">
            Son durum: Çalışma <b>{formatClock(workSecondsLeft)}</b> • Mola{" "}
            <b>{formatClock(breakSecondsLeft)}</b>
          </div>

          {(updateStatus.kind === "available" ||
            updateStatus.kind === "downloading") && (
            <div className="update-banner">
              {updateStatus.kind === "available" ? (
                <>
                  <span>Yeni sürüm hazır: v{updateStatus.version}</span>
                  <button className="primary-btn" onClick={handleInstallUpdate}>
                    Güncelle
                  </button>
                </>
              ) : (
                <span>
                  Güncelleme indiriliyor
                  {updateStatus.percent !== null
                    ? ` %${updateStatus.percent}`
                    : "..."}
                </span>
              )}
            </div>
          )}

          <div className="menu-actions">
            <button className="primary-btn" onClick={() => setPage("work")}>
              Çalışmaya Geç
            </button>
            <button onClick={() => setPage("break")}>Molaya Geç</button>
            <button className="warn-btn full-width" onClick={handleStartNewDay}>
              Yeni Günü Başlat (Eski Günü Bitir)
            </button>
          </div>
        </>
      )}

      {/* AYARLAR SAYFASI */}
      {page === "settings" && (
        <>
          <div className="top-bar">
            <span className="badge">⠿ Ayarlar</span>
            <button className="ghost-btn" onClick={openMenu}>
              ← Ana Sayfa
            </button>
          </div>

          <div className="settings-section">
            <div className="settings-label">Arka plan rengi</div>
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
                title="Özel renk seç"
                value={theme.bgColor}
                onChange={(e) => updateTheme({ bgColor: e.target.value })}
              />
            </div>
            <div className="settings-label slider-label">
              <span>Opaklık</span>
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

          <div className="settings-section">
            <div className="settings-label slider-label">
              <span>Sayaç rengi</span>
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
                title="Özel renk seç"
                value={theme.timerColor}
                onChange={(e) => updateTheme({ timerColor: e.target.value })}
              />
            </div>
          </div>

          <div className="settings-actions">
            <button
              title="Bilgisayar açıldığında otomatik başlat"
              onClick={toggleAutoStart}
            >
              Açılışta başlat: {autoStartOn ? "Açık" : "Kapalı"}
            </button>
            <button onClick={() => updateTheme({ ...DEFAULT_THEME })}>
              Varsayılan renkler
            </button>
          </div>

          <div className="update-row">
            <span>Sürüm v{appVersion || "?"}</span>
            {updateStatus.kind === "available" ? (
              <button className="primary-btn" onClick={handleInstallUpdate}>
                v{updateStatus.version} yükle
              </button>
            ) : updateStatus.kind === "downloading" ? (
              <span>
                İndiriliyor
                {updateStatus.percent !== null
                  ? ` %${updateStatus.percent}`
                  : "..."}
              </span>
            ) : (
              <button
                className="ghost-btn"
                disabled={updateStatus.kind === "checking"}
                onClick={handleCheckUpdate}
              >
                {updateStatus.kind === "checking"
                  ? "Denetleniyor..."
                  : updateStatus.kind === "up-to-date"
                    ? "Güncel ✓"
                    : updateStatus.kind === "error"
                      ? "Hata, tekrar dene"
                      : "Güncellemeleri denetle"}
              </button>
            )}
          </div>
          {updateStatus.kind === "error" && (
            <div className="update-error" title={updateStatus.message}>
              {updateStatus.message}
            </div>
          )}
        </>
      )}

      {/* ÖZET SAYFASI */}
      {page === "summary" && (
        <>
          <div className="top-bar">
            <span className="badge">⠿ Çalışma ve Odak Özeti</span>
            <button className="ghost-btn" onClick={openMenu}>
              ← Ana Sayfa
            </button>
          </div>

          <div className="tooltip-banner">
            {hoveredDay ? (
              <>
                <span>
                  <b>{hoveredDay.label}</b>:{" "}
                  {(hoveredDay.total_sec / 3600).toFixed(1)} sa
                </span>
                <span>
                  {hoveredDay.session_count} seans • Ort:{" "}
                  {hoveredDay.session_count > 0
                    ? `${Math.round(hoveredDay.total_sec / hoveredDay.session_count / 60)} dk`
                    : "0 dk"}
                </span>
              </>
            ) : (
              <span>Detay görmek için gün çubuklarının üzerine gel</span>
            )}
          </div>

          <div className="chart-area">
            {summaryDays.map((d) => {
              const hours = d.total_sec / 3600;
              const heightPct = Math.max(6, (hours / maxSummaryHours) * 85);
              return (
                <div
                  key={d.id}
                  className="bar-col"
                  onMouseEnter={() => setHoveredDay(d)}
                >
                  <span className="bar-hours">{hours.toFixed(1)}s</span>
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

          <div className="freq-header">
            <span>Dikkat Dağılma Sıklığı ({totalDistractions})</span>
            <button className="ghost-btn" onClick={toggleFreqFilter}>
              {freqOnlyToday ? "Filtre: Bugün" : "Filtre: Genel"}
            </button>
          </div>

          <div className="freq-list">
            {distractFreqs.length > 0 ? (
              distractFreqs.map((item) => {
                const pct =
                  totalDistractions > 0
                    ? Math.round((item.count / totalDistractions) * 100)
                    : 0;
                return (
                  <div key={item.reason} className="freq-item">
                    <div className="freq-label-row">
                      <span>{item.reason}</span>
                      <span>
                        {item.count} kez (%{pct})
                      </span>
                    </div>
                    <div className="freq-bar-bg">
                      <div
                        className="freq-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: "10px", color: "#a1a1aa" }}>
                Henüz kayıtlı dikkat dağılma nedeni yok.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
