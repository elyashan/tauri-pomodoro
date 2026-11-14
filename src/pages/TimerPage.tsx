import type {
  BreakKind,
  GlobalShortcutSettings,
  ParkingItem,
  ParkingLotData,
  StudyPlan,
  TimerMode,
  WorkStoryEntry,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import { formatClock } from "../constants";
import { ParkingLotPanel } from "../components/ParkingLot";

export interface TimerPageProps {
  t: Translations;
  activeLang: ActiveLang;
  timerMode: TimerMode;
  breakKind: BreakKind;
  currentPlan: StudyPlan;
  planDisplayName: string;
  currentWorkTag: string;
  fullTopicLabel: string;
  currentContext: string;
  shortcuts: GlobalShortcutSettings;
  currentCycleIndex: number;
  sessionShortBreakCount: number;
  currentSessionDistractions: number;
  currentBreakShortName: string;
  currentBreakFullTooltip: string;
  breakParkingTotalCount: number;
  hasBreakParkingView: boolean;
  breakParkingData: ParkingLotData;
  docsStatusMsg: string | null;
  alwaysOnTop: boolean;
  updateAvailable: boolean;
  isBreakAlarm: boolean;
  breakOverdueSec: number;
  activeSeconds: number;
  hasPausedProgress: boolean;
  workElapsedSec: number;
  distractPenaltyMins: number;
  reminderBanner: { kind?: "context" | "short_break"; text: string } | null;
  onOpenWorkTopicBox: () => void;
  onOpenQuickCapture: (mode: "distraction" | "context") => void;
  onToggleBreakParking: () => void;
  onToggleAlwaysOnTop: () => void;
  onOpenMenu: () => void;
  onEnterMiniDock: () => void;
  onDismissReminderBanner: () => void;
  onSyncParkingToDocs: () => void;
  onSyncSingleItemToDocs: (item: ParkingItem) => void;
  onToggleParkingTask: (id: number, done: boolean) => void;
  onRateParkingIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteParkingEntry: (id: number) => void;
  onOpenLightbox: (entry: WorkStoryEntry) => void;
  onStartWorkFromBreak: () => void;
  onExtendBreak5m: () => void;
  onStopSession: () => void;
  onTakeShortBreak: () => void;
  onDistractedClick: () => void;
}

export function TimerPage({
  t,
  activeLang,
  timerMode,
  breakKind,
  currentPlan,
  planDisplayName,
  currentWorkTag,
  fullTopicLabel,
  currentContext,
  shortcuts,
  currentCycleIndex,
  sessionShortBreakCount,
  currentSessionDistractions,
  currentBreakShortName,
  currentBreakFullTooltip,
  breakParkingTotalCount,
  hasBreakParkingView,
  breakParkingData,
  docsStatusMsg,
  alwaysOnTop,
  updateAvailable,
  isBreakAlarm,
  breakOverdueSec,
  activeSeconds,
  hasPausedProgress,
  workElapsedSec,
  distractPenaltyMins,
  reminderBanner,
  onOpenWorkTopicBox,
  onOpenQuickCapture,
  onToggleBreakParking,
  onToggleAlwaysOnTop,
  onOpenMenu,
  onEnterMiniDock,
  onDismissReminderBanner,
  onSyncParkingToDocs,
  onSyncSingleItemToDocs,
  onToggleParkingTask,
  onRateParkingIdea,
  onDeleteParkingEntry,
  onOpenLightbox,
  onStartWorkFromBreak,
  onExtendBreak5m,
  onStopSession,
  onTakeShortBreak,
  onDistractedClick,
}: TimerPageProps) {
  return (
    <>
      <div className={hasBreakParkingView ? "top-bar" : "top-bar hover-reveal"}>
        <div className="top-bar-left">
          {timerMode === "work" ? (
            <>
              <span
                className="badge"
                title={`${t.work} (${planDisplayName} • ${currentPlan.workMins} ${activeLang === "tr" ? "dk" : "min"})`}
              >
                💼
              </span>

              <button
                className="work-topic-badge"
                onClick={onOpenWorkTopicBox}
                title={`${t.changeWorkTopic} — ${fullTopicLabel}`}
              >
                🏷️ {currentWorkTag || t.selectWorkTopic}
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

              <span
                className="cycle-badge"
                title={t.cycleTooltip(
                  currentCycleIndex,
                  currentPlan.longBreakInterval,
                  currentPlan.longBreakMins,
                )}
              >
                🔄{" "}
                {t.cycleProgressBadge(
                  currentCycleIndex,
                  currentPlan.longBreakInterval,
                )}
              </span>

              {sessionShortBreakCount > 0 && (
                <span
                  className="short-break-chip"
                  title={t.shortBreaksCountBadge(sessionShortBreakCount)}
                >
                  ☕ {sessionShortBreakCount}
                </span>
              )}

              {currentSessionDistractions > 0 && (
                <span
                  className="distract-chip"
                  title={t.distractionsCountTooltip(currentSessionDistractions)}
                >
                  ⚡ {currentSessionDistractions}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="badge" title={currentBreakFullTooltip}>
                {breakKind === "short"
                  ? "☕"
                  : breakKind === "long"
                    ? "🎉"
                    : "🌴"}{" "}
                {currentBreakShortName}
              </span>
              <span
                className="cycle-badge"
                title={t.cycleTooltip(
                  currentCycleIndex,
                  currentPlan.longBreakInterval,
                  currentPlan.longBreakMins,
                )}
              >
                🔄{" "}
                {t.cycleProgressBadge(
                  currentCycleIndex,
                  currentPlan.longBreakInterval,
                )}
              </span>
              {breakParkingTotalCount > 0 && (
                <button
                  type="button"
                  className="context-badge"
                  onClick={onToggleBreakParking}
                  title={t.parkingBreakBannerTitle}
                >
                  {t.parkingToggleBtn(breakParkingTotalCount)}
                </button>
              )}
            </>
          )}
        </div>

        <div className="top-bar-right">
          <button
            className={`icon-btn pin-btn ${alwaysOnTop ? "pinned" : ""}`}
            title={t.alwaysOnTopTooltip(alwaysOnTop)}
            onClick={onToggleAlwaysOnTop}
          >
            📌
          </button>
          <button
            className="icon-btn"
            onClick={onOpenMenu}
            title={
              updateAvailable
                ? `${t.menu} (${t.updateAvailableHint})`
                : t.menu
            }
          >
            ☰
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

      <div className="timer-wrap">
        {isBreakAlarm ? (
          <div className="timer-display alarm-timer">
            -{formatClock(breakOverdueSec)}
          </div>
        ) : (
          <div className="timer-display">{formatClock(activeSeconds)}</div>
        )}

        {hasPausedProgress && (
          <div className="resume-hint">
            {t.resumeHint(Math.floor(workElapsedSec / 60))}
          </div>
        )}

        {reminderBanner && (
          <div
            className="reminder-banner no-drag"
            title={`${t.contextReminderPrefix} ${reminderBanner.text}`}
          >
            <span className="reminder-banner-text">
              {t.contextReminderPrefix} <b>{reminderBanner.text}</b>
            </span>
            <button
              type="button"
              className="tag-icon-btn"
              onClick={onDismissReminderBanner}
              title={t.cancel}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {hasBreakParkingView && (
        <div className="parking-panel no-drag">
          <ParkingLotPanel
            data={breakParkingData}
            isBreakView={true}
            t={t}
            docsStatusMsg={docsStatusMsg}
            onSyncAllToDocs={onSyncParkingToDocs}
            onSyncSingleToDocs={onSyncSingleItemToDocs}
            onToggleTask={onToggleParkingTask}
            onRateIdea={onRateParkingIdea}
            onDeleteEntry={onDeleteParkingEntry}
            onOpenLightbox={onOpenLightbox}
          />
        </div>
      )}

      {timerMode === "break" ? (
        <div
          className={
            hasBreakParkingView ? "btn-row" : "btn-row hover-reveal"
          }
        >
          <button
            className="primary-btn"
            onClick={onStartWorkFromBreak}
            title={breakKind === "short" ? t.returnToWorkBtn : t.startWorkBtn}
          >
            {breakKind === "short"
              ? t.returnToWorkCompact
              : t.startWorkCompact}
          </button>
          <button onClick={onExtendBreak5m} title={t.extendBreakTooltip}>
            {t.extendBreakCompact}
          </button>
          <button onClick={onStopSession} title={t.stopBtnTooltip}>
            {t.stop}
          </button>
        </div>
      ) : (
        <div className="btn-row hover-reveal">
          <button
            className="short-break-btn"
            onClick={onTakeShortBreak}
            title={t.shortBreakBtnTooltip(currentPlan.shortBreakMins)}
          >
            {t.shortBreakBtn(currentPlan.shortBreakMins)}
          </button>
          <button onClick={onStopSession} title={t.stopBtnTooltip}>
            {t.stop}
          </button>
          <button
            className="warn-btn"
            onClick={onDistractedClick}
            title={t.distractedBtnTooltip(distractPenaltyMins)}
          >
            {t.distractedBtnCompact(distractPenaltyMins)}
          </button>
        </div>
      )}
    </>
  );
}
