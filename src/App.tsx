import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  PageType,
  AppState,
  ActiveDayStats,
  DaySummary,
  DistractionFrequency,
  DEFAULT_WORK_SEC,
  DEFAULT_BREAK_SEC,
  loadAppState,
  saveAppState,
  getActiveDayStats,
  startNewDay,
  recordWorkSession,
  recordDistraction,
  getDaysSummary,
  getReasonChoices,
  getDistractionFrequencies,
} from "./db";
import "./App.css";

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

        setPage(saved.page);
        setWorkSecondsLeft(saved.work_seconds_left);
        setWorkElapsedSec(saved.work_elapsed_sec);
        setBreakSecondsLeft(saved.break_seconds_left);
        setDayStats(stats);
        setSummaryDays(days);
        setReasonChoices(choices);
        setDistractFreqs(freqs);
      } catch (err) {
        console.error("Veritabanı yüklenemedi:", err);
        setLoadError(String(err));
      }

      // Otomatik başlatma hatası uygulamanın açılmasını engellemesin
      try {
        if (!import.meta.env.DEV) {
          const firstRunDone = localStorage.getItem("autostart_initialized");
          if (!firstRunDone) {
            await enable();
            localStorage.setItem("autostart_initialized", "1");
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
      win.setSize(new LogicalSize(310, 290));
    } else if (page === "summary") {
      win.setSize(new LogicalSize(360, 390));
    } else if (showDistractBox) {
      win.setSize(new LogicalSize(285, 235));
    } else {
      win.setSize(new LogicalSize(240, 124));
    }
  }, [page, showDistractBox, loaded]);

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

  return (
    <div
      className={`widget-shell ${
        page === "menu" || page === "summary" || showDistractBox
          ? "solid-bg"
          : ""
      }`}
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
              <button className="ghost-btn" onClick={openMenu}>
                Menü
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
                title="Bilgisayar açıldığında otomatik başlat"
                onClick={toggleAutoStart}
              >
                {autoStartOn ? "Oto: Açık" : "Oto: Kapalı"}
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
