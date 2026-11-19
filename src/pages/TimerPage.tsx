import type {
  BreakKind,
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
  fullTopicLabel: string;
  currentContext: string;
  currentCycleIndex: number;
  sessionShortBreakCount: number;
  currentBreakShortName: string;
  currentBreakFullTooltip: string;
  breakParkingTotalCount: number;
  hasBreakParkingView: boolean;
  breakParkingData: ParkingLotData;
  docsStatusMsg: string | null;
  updateAvailable: boolean;
  isBreakAlarm: boolean;
  isRunning: boolean;
  breakOverdueSec: number;
  activeSeconds: number;
  hasPausedProgress: boolean;
  workElapsedSec: number;
  workPausedLiveSec: number;
  distractPenaltyMins: number;
  reminderBanner: { kind?: "context" | "short_break"; text: string } | null;
  onToggleRunning: () => void;
  onOpenWorkTopicBox: () => void;
  onOpenContextBox: () => void;
  onToggleBreakParking: () => void;
  onOpenMenu: () => void;
  onEnterMiniDock: () => void;
  onHideToTray: () => void;
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
  fullTopicLabel,
  currentContext,
  currentCycleIndex,
  sessionShortBreakCount,
  currentBreakShortName,
  currentBreakFullTooltip,
  breakParkingTotalCount,
  hasBreakParkingView,
  breakParkingData,
  docsStatusMsg,
  updateAvailable,
  isBreakAlarm,
  isRunning,
  breakOverdueSec,
  activeSeconds,
  hasPausedProgress,
  workElapsedSec,
  workPausedLiveSec,
  distractPenaltyMins,
  reminderBanner,
  onToggleRunning,
  onOpenWorkTopicBox,
  onOpenContextBox,
  onToggleBreakParking,
  onOpenMenu,
  onEnterMiniDock,
  onHideToTray,
  onDismissReminderBanner,
  onSyncParkingToDocs,
  onSyncSingleItemToDocs,
  onToggleParkingTask,
  onRateParkingIdea,
  onDeleteParkingEntry,
  onOpenLightbox,
  onStartWorkFromBreak,
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
                  className="parking-toggle-badge"
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
            −
          </button>
          <button
            className="icon-btn"
            title={t.hideToTrayOnlyTooltip}
            onClick={onHideToTray}
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
          <div
            className="timer-display clickable-timer"
            onClick={onToggleRunning}
            title={isRunning ? t.timerPauseTooltip : t.timerResumeTooltip}
          >
            {formatClock(activeSeconds)}
          </div>
        )}

        {timerMode === "work" && (
          <div className="timer-meta-row">
            <button
              type="button"
              className="timer-meta-item topic-pill"
              onClick={onOpenWorkTopicBox}
              title={`${t.topicShortLabel}: ${fullTopicLabel}`}
            >
              <span className="timer-meta-value">{fullTopicLabel}</span>
            </button>
            <button
              type="button"
              className="timer-meta-item context-pill"
              onClick={onOpenContextBox}
              title={`${t.contextShortLabel}: ${currentContext || t.qcContextNone}`}
            >
              <span className="timer-meta-value">
                {currentContext || t.qcContextNone}
              </span>
            </button>
          </div>
        )}

        {(hasPausedProgress ||
          (!isRunning && timerMode === "work" && workPausedLiveSec > 0)) && (
          <div className="resume-hint">
            {t.resumeHint(
              Math.floor(workElapsedSec / 60),
              workPausedLiveSec >= 1
                ? formatClock(workPausedLiveSec)
                : undefined,
            )}
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
            hasBreakParkingView || !isRunning ? "btn-row" : "btn-row hover-reveal"
          }
        >
          {!isRunning && !isBreakAlarm && (
            <button
              className="primary-btn"
              onClick={onToggleRunning}
              title={t.timerResumeTooltip}
            >
              {t.resumeWorkBtn}
            </button>
          )}
          <button
            className={isRunning || isBreakAlarm ? "primary-btn" : ""}
            onClick={onStartWorkFromBreak}
            title={breakKind === "short" ? t.returnToWorkBtn : t.startWorkBtn}
          >
            {breakKind === "short"
              ? t.returnToWorkCompact
              : t.startWorkCompact}
          </button>
        </div>
      ) : (
        <div className={isRunning ? "btn-row hover-reveal" : "btn-row"}>
          {!isRunning && (
            <button
              className="primary-btn"
              onClick={onToggleRunning}
              title={t.timerResumeTooltip}
            >
              {t.resumeWorkBtn}
            </button>
          )}
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
