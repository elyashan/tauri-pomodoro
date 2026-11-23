import type React from "react";
import { useEffect, useRef } from "react";
import type { BreakKind, TimerMode } from "../db";
import type { Translations } from "../i18n";
import { IconClose, IconCoffee, IconSparkles } from "./Icons";

export interface MiniDockProps {
  isLight: boolean;
  progressColor?: string;
  workPhase?: "warmup" | "focus" | "final" | "hyperfocus";
  modeClass: string;
  isBreakAlarm: boolean;
  isCelebrating: boolean;
  isRunning: boolean;
  miniDockContextToast?: string | null;
  shellStyle: React.CSSProperties;
  sessionActive: boolean;
  timerMode: TimerMode;
  breakKind: BreakKind;
  liveClockStr: string;
  progressPct: number;
  t: Translations;
  onStartDrag: () => void;
  onExitMiniDock: () => void;
  onHideToTray: () => void;
}

const DRAG_THRESHOLD_PX = 5;

export function MiniDock(props: MiniDockProps) {
  const {
    isLight,
    progressColor,
    modeClass,
    isBreakAlarm,
    isCelebrating,
    shellStyle,
    sessionActive,
    timerMode,
    breakKind,
    liveClockStr,
    progressPct,
    t,
    onStartDrag,
    onExitMiniDock,
    onHideToTray,
  } = props;

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const handleShellMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, .no-drag")) return;

    cleanupRef.current?.();

    const startX = e.clientX;
    const startY = e.clientY;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      if (cleanupRef.current === cleanup) {
        cleanupRef.current = null;
      }
    };

    const handleMove = (mv: MouseEvent) => {
      if (settled) return;
      const dist = Math.hypot(mv.clientX - startX, mv.clientY - startY);
      if (dist >= DRAG_THRESHOLD_PX) {
        settled = true;
        cleanup();
        onStartDrag();
      }
    };

    const handleUp = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onExitMiniDock();
    };

    cleanupRef.current = cleanup;
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const barColor =
    progressColor ||
    (isBreakAlarm
      ? "var(--accent-danger)"
      : timerMode === "work"
        ? "var(--accent-primary)"
        : breakKind === "long"
          ? "var(--accent-long-break)"
          : "var(--accent-break)");

  return (
    <div
      className={`widget-shell mini-dock-shell ${
        isLight ? "light-theme" : ""
      } ${modeClass} ${isBreakAlarm ? "alarm-shell" : ""} ${
        isCelebrating ? "celebrating-shell" : ""
      }`}
      style={shellStyle}
      onMouseDown={handleShellMouseDown}
      title={`${t.restoreWindowTooltip} · ${t.miniDockDragTooltip}`}
    >
      <div className="mini-dock-center">
        <span className={`mini-dock-clock ${isBreakAlarm ? "alarm" : ""}`}>
          {sessionActive && timerMode === "break" && (
            <span className="mini-dock-mode-icon">
              {breakKind === "long" ? (
                <IconSparkles size={11} />
              ) : (
                <IconCoffee size={11} />
              )}
            </span>
          )}
          <span>{liveClockStr}</span>
        </span>
      </div>

      <button
        type="button"
        className="mini-dock-close-hover no-drag"
        onClick={onHideToTray}
        title={t.hideToTrayOnlyTooltip}
      >
        <IconClose size={10} />
      </button>

      {sessionActive && (
        <div
          className="progress-bar-container"
          style={{ bottom: 2, left: 14, right: 14, height: 2 }}
        >
          <div
            className="progress-bar-fill"
            style={{
              width: `${progressPct}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      )}
    </div>
  );
}
