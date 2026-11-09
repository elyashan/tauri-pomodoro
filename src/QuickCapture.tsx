import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  DistractionCategory,
  doesCategoryAddPenalty,
} from "./db";
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
}

const CATEGORIES_ORDER: DistractionCategory[] = [
  "impulsive_task",
  "idea",
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
  if (k === "3" || k === "i" || k === "ı" || k === "n") return "internal";
  if (k === "4" || k === "d" || k === "e") return "external";
  if (k === "5" || k === "z" || k === "k" || k === "s") return "escape";
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

  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const applyOpenPayload = (next: CaptureOpenPayload) => {
    if (reminderTimerRef.current) {
      window.clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    setPayload(next);
    setText("");
    setRecentIdx(-1);
    if (next.mode === "context") {
      setStage("input");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      setCategory("impulsive_task");
      setStage("select");
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
      // Salisede pencereyi kapat ve önceki uygulamaya dön
      closeAndRestore();
      await emitTo("main", "capture-submitted", msg).catch(() => {});
      return;
    }

    // Distraction / Görev / Fikir modu
    const fallbackReason = getCategoryLabel(category);
    const msg: CaptureSubmittedEvent = {
      mode: "distraction",
      category,
      text: finalVal || fallbackReason,
      activeApp: payload.activeApp,
      activeWindow: payload.activeWindow,
    };
    await emitTo("main", "capture-submitted", msg).catch(() => {});

    // Sebebi yazdıktan sonra ekrana son kalınan meşguliyet (context) gelsin
    setStage("reminder");
    reminderTimerRef.current = window.setTimeout(() => {
      closeAndRestore();
    }, 2400);
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

          {/* 5 Kategori Seçici (1-5 veya Harfler: G, F, İ, D, Z) */}
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
