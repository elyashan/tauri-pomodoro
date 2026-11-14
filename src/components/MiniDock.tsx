import type React from "react";
import type { BreakKind, TimerMode } from "../db";
import type { Translations } from "../i18n";

export interface MiniDockProps {
  isLight: boolean;
  modeClass: string;
  isBreakAlarm: boolean;
  miniDockContextToast: string | null;
  shellStyle: React.CSSProperties;
  sessionActive: boolean;
  timerMode: TimerMode;
  breakKind: BreakKind;
  liveClockStr: string;
  progressPct: number;
  t: Translations;
  onMouseDown: (e: React.MouseEvent) => void;
  onExitMiniDock: () => void;
  onHideToTray: () => void;
}

export function MiniDock({
  isLight,
  modeClass,
  isBreakAlarm,
  miniDockContextToast,
  shellStyle,
  sessionActive,
  timerMode,
  breakKind,
  liveClockStr,
  progressPct,
  t,
  onMouseDown,
  onExitMiniDock,
  onHideToTray,
}: MiniDockProps) {
  return (
    <div
      className={`widget-shell mini-dock-shell ${
        isLight ? "light-theme" : ""
      } ${modeClass} ${isBreakAlarm ? "alarm-shell" : ""} ${
        miniDockContextToast ? "has-toast" : ""
      }`}
      style={shellStyle}
      onMouseDown={onMouseDown}
      onDoubleClick={onExitMiniDock}
    >
      {miniDockContextToast && (
        <div
          className="mini-dock-context-toast no-drag"
          title={`${t.qcCurrentContextLabel}: ${miniDockContextToast}`}
          onClick={onExitMiniDock}
        >
          🎯 {miniDockContextToast}
        </div>
      )}

      <div className="mini-dock-row">
        <div
          className="mini-dock-left no-drag"
          onClick={onExitMiniDock}
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
            ↗
          </button>
          <button
            className="mini-dock-btn"
            onClick={onHideToTray}
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
