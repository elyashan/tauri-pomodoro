import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  DistractionCategory,
  doesCategoryAddPenalty,
} from "./db";
import {
  CropRegionPct,
  captureScreenSnapshotRaw,
  compressAndCropDataUrl,
} from "./screenshot";
import { ActiveLang, translations } from "./i18n";
import "./App.css";

interface FrontendContextSnapshot {
  currentContext: string;
  workTag: string;
  workReason: string;
  sessionActive: boolean;
  timerMode: string;
  distractPenaltyMins: number;
  lang: string;
  bgColor: string;
  recentContexts: string[];
}

interface CaptureOpenPayload {
  mode: "distraction" | "context";
  openSeq: number;
  activeApp: string;
  activeWindow: string;
  snapshot: FrontendContextSnapshot;
}

export interface CaptureSubmittedEvent {
  mode: "distraction" | "context";
  category?: DistractionCategory;
  text: string;
  activeApp: string;
  activeWindow: string;
  screenshotData?: string;
}

const CATEGORIES_ORDER: DistractionCategory[] = [
  "impulsive_task",
  "idea",
  "screenshot_note",
  "internal",
  "external",
  "escape",
];

function isLightHex(hex: string): boolean {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return false;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function matchCategoryKey(key: string): DistractionCategory | null {
  const k = key.toLocaleLowerCase("tr-TR");
  if (k === "1" || k === "g" || k === "t") return "impulsive_task";
  if (k === "2" || k === "f") return "idea";
  if (k === "3" || k === "s") return "screenshot_note";
  if (k === "4" || k === "i" || k === "ı" || k === "n") return "internal";
  if (k === "5" || k === "d" || k === "e") return "external";
  if (k === "6" || k === "z" || k === "k") return "escape";
  return null;
}

export default function QuickCapture() {
  const [payload, setPayload] = useState<CaptureOpenPayload>({
    mode: "distraction",
    openSeq: 0,
    activeApp: "",
    activeWindow: "",
    snapshot: {
      currentContext: "",
      workTag: "Ders",
      workReason: "",
      sessionActive: false,
      timerMode: "work",
      distractPenaltyMins: 1,
      lang: "tr",
      bgColor: "#1a1814",
      recentContexts: [],
    },
  });

  const [stage, setStage] = useState<"select" | "input" | "reminder">("select");
  const [category, setCategory] =
    useState<DistractionCategory>("impulsive_task");
  const [text, setText] = useState("");
  const [recentIdx, setRecentIdx] = useState<number>(-1);

  // 3. Şık (3·S): Ufak Ekran Görüntüsü Önizleme & Bölge Kırpma (Crop) durumu
  const [rawShotUrl, setRawShotUrl] = useState<string>("");
  const [previewShotUrl, setPreviewShotUrl] = useState<string>("");
  const [cropBox, setCropBox] = useState<CropRegionPct | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const reminderTimerRef = useRef<number | null>(null);

  const lang: ActiveLang = payload.snapshot.lang === "en" ? "en" : "tr";
  const t = translations[lang];

  const closeAndRestore = () => {
    if (reminderTimerRef.current) {
      window.clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    invoke("close_capture_and_restore_focus").catch(() => {});
  };

  const loadScreenshotPreview = async (fresh: boolean) => {
    const res = await captureScreenSnapshotRaw(fresh);
    if (res.dataUrl) {
      setRawShotUrl(res.dataUrl);
      const compressed = await compressAndCropDataUrl(res.dataUrl, null, 760, 0.72);
      setPreviewShotUrl(compressed);
      setCropBox(null);
    }
  };

  const applyOpenPayload = (next: CaptureOpenPayload) => {
    if (reminderTimerRef.current) {
      window.clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    setPayload(next);
    setText("");
    setRecentIdx(-1);
    setCropBox(null);
    setDragStart(null);
    if (next.mode === "context") {
      setStage("input");
      invoke("set_capture_window_size", { width: 540, height: 205 }).catch(() => {});
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      setCategory("impulsive_task");
      setStage("select");
      invoke("set_capture_window_size", { width: 540, height: 205 }).catch(() => {});
      // Arka planda kısayol basıldığı andaki ekran görüntüsünü hazırla
      loadScreenshotPreview(false);
      requestAnimationFrame(() => {
        shellRef.current?.focus();
      });
    }
  };

  useEffect(() => {
    invoke<CaptureOpenPayload>("get_capture_open_payload")
      .then((initial) => {
        applyOpenPayload(initial);
      })
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    listen<CaptureOpenPayload>("open-capture", (ev) => {
      applyOpenPayload(ev.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
      if (reminderTimerRef.current) {
        window.clearTimeout(reminderTimerRef.current);
      }
    };
  }, []);

  // 3. şık (screenshot_note) seçildiğinde pencereyi önizleme için büyüt, diğerlerinde küçült
  useEffect(() => {
    if (payload.mode === "distraction" && stage !== "reminder") {
      if (category === "screenshot_note") {
        invoke("set_capture_window_size", { width: 560, height: 390 }).catch(() => {});
        if (!previewShotUrl) {
          loadScreenshotPreview(false);
        }
      } else {
        invoke("set_capture_window_size", { width: 540, height: 205 }).catch(() => {});
      }
    }
  }, [category, stage, payload.mode]);

  useEffect(() => {
    if (stage === "input") {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else if (stage === "select" || stage === "reminder") {
      requestAnimationFrame(() => {
        shellRef.current?.focus();
      });
    }
  }, [stage]);

  const getCategoryLabel = (cat: DistractionCategory): string => {
    switch (cat) {
      case "impulsive_task":
        return t.catImpulsiveTask;
      case "idea":
        return t.catIdea;
      case "screenshot_note":
        return t.catScreenshotNote;
      case "internal":
        return t.catInternal;
      case "external":
        return t.catExternal;
      case "escape":
        return t.catEscape;
    }
  };

  const effectiveContext =
    payload.snapshot.currentContext.trim() ||
    (payload.snapshot.workTag
      ? `${payload.snapshot.workTag}${
          payload.snapshot.workReason ? `: ${payload.snapshot.workReason}` : ""
        }`
      : "");

  const submitCapture = async (overrideText?: string) => {
    const finalVal = (overrideText !== undefined ? overrideText : text).trim();
    if (payload.mode === "context") {
      if (!finalVal) {
        closeAndRestore();
        return;
      }
      const msg: CaptureSubmittedEvent = {
        mode: "context",
        text: finalVal,
        activeApp: payload.activeApp,
        activeWindow: payload.activeWindow,
      };
      closeAndRestore();
      await emitTo("main", "capture-submitted", msg).catch(() => {});
      return;
    }

    // Distraction / Görev / Fikir / SS Notu modu
    let finalScreenshotData: string | undefined;
    if (category === "screenshot_note") {
      const srcUrl = rawShotUrl || previewShotUrl;
      if (srcUrl) {
        finalScreenshotData = await compressAndCropDataUrl(
          srcUrl,
          cropBox,
          760,
          0.72,
        );
      }
    }

    const fallbackReason = getCategoryLabel(category);
    const msg: CaptureSubmittedEvent = {
      mode: "distraction",
      category,
      text: finalVal || fallbackReason,
      activeApp: payload.activeApp,
      activeWindow: payload.activeWindow,
      screenshotData: finalScreenshotData,
    };
    await emitTo("main", "capture-submitted", msg).catch(() => {});

    // Sebebi yazdıktan sonra ekrana son kalınan meşguliyet (context) gelsin
    invoke("set_capture_window_size", { width: 540, height: 205 }).catch(() => {});
    setStage("reminder");
    reminderTimerRef.current = window.setTimeout(() => {
      closeAndRestore();
    }, 2400);
  };

  const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = previewWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setDragStart({ x: xPct, y: yPct });
    setCropBox({ xPct, yPct, wPct: 0, hPct: 0 });
  };

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const rect = previewWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const curX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const curY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const xPct = Math.min(dragStart.x, curX);
    const yPct = Math.min(dragStart.y, curY);
    const wPct = Math.abs(curX - dragStart.x);
    const hPct = Math.abs(curY - dragStart.y);
    setCropBox({ xPct, yPct, wPct, hPct });
  };

  const handlePreviewMouseUp = () => {
    if (!dragStart) return;
    setDragStart(null);
    if (cropBox && (cropBox.wPct < 4 || cropBox.hPct < 4)) {
      setCropBox(null);
    }
    inputRef.current?.focus();
  };

  const handleShellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndRestore();
      return;
    }

    if (stage === "reminder") {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closeAndRestore();
      }
      return;
    }

    if (payload.mode === "distraction" && stage === "select") {
      const matched = matchCategoryKey(e.key);
      if (matched) {
        e.preventDefault();
        setCategory(matched);
        setStage("input");
        return;
      }
      if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        const idx = CATEGORIES_ORDER.indexOf(category);
        const next =
          CATEGORIES_ORDER[
            (idx + (e.shiftKey ? CATEGORIES_ORDER.length - 1 : 1)) %
              CATEGORIES_ORDER.length
          ];
        setCategory(next);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = CATEGORIES_ORDER.indexOf(category);
        const prev =
          CATEGORIES_ORDER[
            (idx + CATEGORIES_ORDER.length - 1) % CATEGORIES_ORDER.length
          ];
        setCategory(prev);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setStage("input");
        return;
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndRestore();
      return;
    }

    if (payload.mode === "distraction") {
      if (e.altKey) {
        const matched = matchCategoryKey(e.key);
        if (matched) {
          e.preventDefault();
          setCategory(matched);
          return;
        }
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const idx = CATEGORIES_ORDER.indexOf(category);
        const next =
          CATEGORIES_ORDER[
            (idx + (e.shiftKey ? CATEGORIES_ORDER.length - 1 : 1)) %
              CATEGORIES_ORDER.length
          ];
        setCategory(next);
        return;
      }
      if (e.key === "Backspace" && text.length === 0) {
        e.preventDefault();
        setStage("select");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submitCapture();
      }
      return;
    }

    // Context mode
    const recents = payload.snapshot.recentContexts || [];
    if (e.key === "ArrowDown" && recents.length > 0) {
      e.preventDefault();
      const nextIdx = (recentIdx + 1) % recents.length;
      setRecentIdx(nextIdx);
      setText(recents[nextIdx]);
      return;
    }
    if (e.key === "ArrowUp" && recents.length > 0) {
      e.preventDefault();
      const prevIdx =
        recentIdx <= 0 ? recents.length - 1 : (recentIdx - 1) % recents.length;
      setRecentIdx(prevIdx);
      setText(recents[prevIdx]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submitCapture();
    }
  };

  const isLight = isLightHex(payload.snapshot.bgColor);
  const addsPenalty = doesCategoryAddPenalty(category);
  const penaltyMins = payload.snapshot.distractPenaltyMins;
  const activeTabDisplay =
    payload.activeApp && payload.activeWindow
      ? `${payload.activeApp} — ${payload.activeWindow}`
      : payload.activeApp || payload.activeWindow || "—";

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={handleShellKeyDown}
      className={`qc-shell ${isLight ? "light-theme" : ""}`}
      style={
        {
          "--qc-bg": payload.snapshot.bgColor || "#1a1814",
        } as React.CSSProperties
      }
    >
      {stage === "reminder" ? (
        <div className="qc-reminder-card" onClick={closeAndRestore}>
          <div className="qc-reminder-header">{t.qcReminderTitle}</div>
          <div className="qc-reminder-context">
            {effectiveContext || t.qcContextNone}
          </div>
          {activeTabDisplay !== "—" && (
            <div className="qc-reminder-sub">🌐 {activeTabDisplay}</div>
          )}
          <div className="qc-reminder-hint">{t.qcReminderCloseHint}</div>
        </div>
      ) : payload.mode === "distraction" ? (
        <>
          {/* Üst Bilgi Şeridi: Son Kalınan Context & Açık Uygulama/Sekme */}
          <div className="qc-top-strip">
            <div className="qc-context-pill" title={effectiveContext}>
              <span className="qc-muted">🎯 {t.qcCurrentContextLabel}:</span>{" "}
              <b>{effectiveContext || t.qcContextNone}</b>
            </div>
            <div className="qc-tab-pill" title={activeTabDisplay}>
              🌐 {activeTabDisplay}
            </div>
          </div>

          {/* 6 Kategori Seçici (1-6 veya Harfler: G, F, S [SS Notu], İ, D, Z) */}
          <div className="qc-cat-row">
            {CATEGORIES_ORDER.map((cat) => {
              const selected = category === cat;
              const isZeroPenalty = !doesCategoryAddPenalty(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`qc-cat-pill ${selected ? "selected" : ""} ${
                    isZeroPenalty ? "zero-penalty" : "has-penalty"
                  }`}
                  onClick={() => {
                    setCategory(cat);
                    setStage("input");
                  }}
                >
                  <span className="qc-key-badge">{t.catKeyHints[cat]}</span>
                  <span className="qc-cat-name">{getCategoryLabel(cat)}</span>
                </button>
              );
            })}
          </div>

          {/* 3. Şık (3·S): Ufak Ekran Görüntüsü Penceresi & Bölge Kırpıcı */}
          {category === "screenshot_note" && (
            <div className="qc-ss-box">
              <div className="qc-ss-toolbar">
                <span className="qc-ss-hint">{t.ssCropHint}</span>
                <div className="qc-ss-actions">
                  {cropBox && (
                    <button
                      type="button"
                      className="qc-mini-btn"
                      onClick={() => setCropBox(null)}
                    >
                      {t.ssResetCropBtn}
                    </button>
                  )}
                  <button
                    type="button"
                    className="qc-mini-btn"
                    onClick={() => loadScreenshotPreview(true)}
                  >
                    {t.ssRetakeBtn}
                  </button>
                </div>
              </div>
              <div
                ref={previewWrapRef}
                className="qc-ss-preview-wrap"
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseUp}
              >
                {previewShotUrl ? (
                  <img
                    src={previewShotUrl}
                    alt="Screenshot preview"
                    className="qc-ss-img"
                    draggable={false}
                  />
                ) : (
                  <div className="qc-ss-empty">📸 ...</div>
                )}
                {cropBox && cropBox.wPct > 1 && cropBox.hPct > 1 && (
                  <div
                    className="qc-ss-crop-rect"
                    style={{
                      left: `${cropBox.xPct}%`,
                      top: `${cropBox.yPct}%`,
                      width: `${cropBox.wPct}%`,
                      height: `${cropBox.hPct}%`,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Tek Satır Hızlı Input */}
          <div className="qc-input-row">
            <input
              ref={inputRef}
              type="text"
              className={`qc-single-input ${
                stage === "select" ? "waiting-cat" : ""
              }`}
              value={text}
              onFocus={() => {
                if (stage === "select") setStage("input");
              }}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={
                stage === "select"
                  ? t.qcSelectKeyHint
                  : t.qcInputPlaceholders[category]
              }
            />
            <span
              className={`qc-penalty-tag ${
                addsPenalty ? "penalty" : "no-penalty"
              }`}
            >
              {addsPenalty
                ? t.addsPenaltyBadge(penaltyMins)
                : t.noPenaltyParkingBadge}
            </span>
          </div>

          <div className="qc-footer-hint">
            <span>
              {stage === "select" ? t.qcSelectKeyHint : t.qcSwitchCatHint}
            </span>
            <button
              type="button"
              className="qc-close-btn"
              onClick={closeAndRestore}
            >
              Esc
            </button>
          </div>
        </>
      ) : (
        /* MEŞGULİYET (CONTEXT) HIZLI GİRİŞ MODU */
        <>
          <div className="qc-top-strip">
            <div className="qc-context-pill">
              <b>{t.qcContextHeader}</b>
            </div>
            <div className="qc-tab-pill" title={activeTabDisplay}>
              🌐 {activeTabDisplay}
            </div>
          </div>

          <div className="qc-input-row">
            <input
              ref={inputRef}
              type="text"
              className="qc-single-input"
              value={text}
              autoFocus
              onChange={(e) => {
                setText(e.target.value);
                setRecentIdx(-1);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={
                payload.snapshot.currentContext
                  ? `${t.qcCurrentContextLabel}: ${payload.snapshot.currentContext}`
                  : t.qcContextPlaceholder
              }
            />
            <button
              type="button"
              className="primary-btn"
              onClick={() => submitCapture()}
            >
              Enter ↵
            </button>
          </div>

          {payload.snapshot.recentContexts.length > 0 ? (
            <div className="qc-recent-row">
              <span className="qc-muted">{t.qcRecentContextsLabel}</span>
              <div className="qc-recent-chips">
                {payload.snapshot.recentContexts.slice(0, 5).map((rc, idx) => (
                  <button
                    key={rc}
                    type="button"
                    className={`qc-recent-chip ${
                      recentIdx === idx ? "active" : ""
                    }`}
                    onClick={() => submitCapture(rc)}
                  >
                    {rc}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="qc-footer-hint">
              <span>{t.qcContextPlaceholder}</span>
              <button
                type="button"
                className="qc-close-btn"
                onClick={closeAndRestore}
              >
                Esc
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
