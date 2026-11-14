import type React from "react";
import type {
  ActiveDayStats,
  GlobalShortcutSettings,
  StudyPlan,
  TimerMode,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import type { UpdateStatus } from "../updater";

export interface MenuPageProps {
  t: Translations;
  activeLang: ActiveLang;
  dayStats: ActiveDayStats;
  alwaysOnTop: boolean;
  updateAvailable: boolean;
  updateStatus: UpdateStatus;
  sessionActive: boolean;
  isBreakAlarm: boolean;
  isRunning: boolean;
  timerMode: TimerMode;
  currentBreakShortName: string;
  fullTopicLabel: string;
  sessionShortBreakCount: number;
  currentCycleIndex: number;
  currentPlan: StudyPlan;
  studyPlans: StudyPlan[];
  activePlanId: string;
  planDropdownOpen: boolean;
  planDropdownRef: React.RefObject<HTMLDivElement | null>;
  liveClockStr: string;
  currentContext: string;
  shortcuts: GlobalShortcutSettings;
  getPlanDisplayName: (plan: StudyPlan) => string;
  onToggleAlwaysOnTop: () => void;
  onOpenDashboard: () => void;
  onOpenSummary: () => void;
  onOpenSettings: () => void;
  onEnterMiniDock: () => void;
  onInstallUpdate: () => void;
  onTogglePlanDropdown: () => void;
  onSelectPlan: (planId: string) => void;
  onOpenWorkTopicBox: () => void;
  onOpenQuickCapture: (mode: "distraction" | "context") => void;
  onReturnToTimer: () => void;
  onFinishSession: () => void;
  onStartSession: () => void;
}

export function MenuPage({
  t,
  activeLang,
  dayStats,
  alwaysOnTop,
  updateAvailable,
  updateStatus,
  sessionActive,
  isBreakAlarm,
  isRunning,
  timerMode,
  currentBreakShortName,
  fullTopicLabel,
  sessionShortBreakCount,
  currentCycleIndex,
  currentPlan,
  studyPlans,
  activePlanId,
  planDropdownOpen,
  planDropdownRef,
  liveClockStr,
  currentContext,
  shortcuts,
  getPlanDisplayName,
  onToggleAlwaysOnTop,
  onOpenDashboard,
  onOpenSummary,
  onOpenSettings,
  onEnterMiniDock,
  onInstallUpdate,
  onTogglePlanDropdown,
  onSelectPlan,
  onOpenWorkTopicBox,
  onOpenQuickCapture,
  onReturnToTimer,
  onFinishSession,
  onStartSession,
}: MenuPageProps) {
  return (
    <>
      <div className="top-bar">
        <span className="badge">⠿ {dayStats.label}</span>
        <div className="top-bar-right">
          <button
            className={`icon-btn pin-btn ${alwaysOnTop ? "pinned" : ""}`}
            title={t.alwaysOnTopTooltip(alwaysOnTop)}
            onClick={onToggleAlwaysOnTop}
          >
            📌
          </button>
          <button
            className="ghost-btn"
            title={t.dashboardBtn}
            onClick={onOpenDashboard}
          >
            📊 {t.dashboardBtn}
          </button>
          <button
            className="ghost-btn"
            title={t.summaryTitle}
            onClick={onOpenSummary}
          >
            📈 {t.summary}
          </button>
          <button
            className="icon-btn"
            title={t.settings}
            onClick={onOpenSettings}
          >
            ⚙
            {updateAvailable && <span className="update-dot" />}
          </button>
          <button
            className="icon-btn"
            title={t.miniDockTooltip}
            onClick={onEnterMiniDock}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" title={t.totalWork}>
          <div className="stat-val">{t.formatDuration(dayStats.totalSec)}</div>
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
        <div className="session-status-bar" title={t.sessionIdleTooltip}>
          <div className="session-status-left">
            <span className="status-dot" />
            <span style={{ color: "#a1a1aa" }}>{t.sessionIdleLabel}</span>
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
              <button className="primary-btn" onClick={onInstallUpdate}>
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
                onTogglePlanDropdown();
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
              {!sessionActive && <span>{planDropdownOpen ? "▴" : "▾"}</span>}
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
                    onClick={() => onSelectPlan(p.id)}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              minWidth: 0,
              flex: 1,
            }}
          >
            <button
              type="button"
              className="work-topic-badge menu-topic"
              onClick={onOpenWorkTopicBox}
              title={`${t.changeWorkTopic} — ${fullTopicLabel}`}
            >
              🏷️ {fullTopicLabel}
            </button>

            <button
              type="button"
              className="context-badge"
              onClick={() => onOpenQuickCapture("context")}
              title={`${t.qcContextHeader} (${shortcuts.contextShortcut}) — ${
                currentContext || t.qcContextNone
              }`}
            >
              🎯 {currentContext || t.setContextBadgePlaceholder}
            </button>
          </div>

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
            <button className="primary-btn" onClick={onReturnToTimer}>
              {timerMode === "work"
                ? t.returnToWorkMenuBtn
                : t.returnToBreakMenuBtn}
            </button>
            <button
              className="warn-btn"
              onClick={onFinishSession}
              title={t.finishSessionTooltip}
            >
              {t.finishSessionBtn}
            </button>
          </>
        ) : (
          <button
            className="primary-btn full-width"
            onClick={onStartSession}
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
  );
}
