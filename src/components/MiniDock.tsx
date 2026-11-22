import type React from "react";
import { useEffect, useRef } from "react";
import type { BreakKind, TimerMode } from "../db";
import type { Translations } from "../i18n";
import {
  IconBellAlert,
  IconBriefcase,
  IconCoffee,
  IconExpand,
  IconGrip,
  IconPause,
  IconSparkles,
  IconTrayHide,
} from "./Icons";

export interface MiniDockProps {
  isLight: boolean;
  modeClass: string;
  isBreakAlarm: boolean;
  isCelebrating: boolean;
  isRunning: boolean;
  miniDockContextToast: string | null;
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

export function MiniDock({
  isLight,
  modeClass,
  isBreakAlarm,
  isCelebrating,
  isRunning,
  miniDockContextToast,
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
}: MiniDockProps) {
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

  const isPaused = sessionActive && !isRunning && !isBreakAlarm;

  return (
    <div
      className={`widget-shell mini-dock-shell ${
        isLight ? "light-theme" : ""
      } ${modeClass} ${isBreakAlarm ? "alarm-shell" : ""} ${
        isCelebrating ? "celebrating-shell" : ""
      } ${miniDockContextToast ? "has-toast" : ""}`}
      style={shellStyle}
      onMouseDown={handleShellMouseDown}
    >
      {miniDockContextToast && (
        <div
          className="mini-dock-context-toast"
          title={`${t.qcCurrentContextLabel}: ${miniDockContextToast} (${t.miniDockDragTooltip})`}
        >
          🎯 {miniDockContextToast}
        </div>
      )}

      <div className="mini-dock-row">
        <div className="mini-dock-left" title={t.miniDockDragTooltip}>
          <span
            className={`mini-dock-icon ${isBreakAlarm ? "alarm" : isPaused ? "paused" : ""}`}
          >
            {!sessionActive ? (
              <IconGrip size={13} />
            ) : isBreakAlarm ? (
              <IconBellAlert size={13} />
            ) : !isRunning ? (
              <IconPause size={13} />
            ) : timerMode === "work" ? (
              <IconBriefcase size={13} />
            ) : breakKind === "long" ? (
              <IconSparkles size={13} />
            ) : (
              <IconCoffee size={13} />
            )}
          </span>
          <span className={`mini-dock-clock ${isBreakAlarm ? "alarm" : ""}`}>
            {liveClockStr}
          </span>
        </div>

        <div className="mini-dock-actions no-drag">
          <button
            className="mini-dock-btn"
            onClick={onExitMiniDock}
            title={t.restoreWindowTooltip}
          >
            <IconExpand size={12} />
          </button>
          <button
            className="mini-dock-btn"
            onClick={onHideToTray}
            title={t.hideToTrayOnlyTooltip}
          >
            <IconTrayHide size={12} />
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
