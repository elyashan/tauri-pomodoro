import { useEffect, useState } from "react";
import type {
  BreakKind,
  MoodType,
  ParkingBucket,
  ParkingLotData,
  StudyPlan,
  TimerMode,
  TimerVisualStyle,
  WorkStoryEntry,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import { MOOD_TYPES, formatClock } from "../constants";
import { ParkingLotPanel } from "../components/ParkingLot";
import { VisualTimer } from "../components/VisualTimer";
import {
  IconBriefcase,
  IconCheck,
  IconClose,
  IconCoffee,
  IconCompass,
  IconFlame,
  IconMenu,
  IconMinimize,
  IconPlay,
  IconRepeat,
  IconSparkles,
  IconStop,
  IconZap,
} from "../components/Icons";

export type WorkPhase = "warmup" | "focus" | "final" | "hyperfocus";

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
  breakChecklistItems: string[];
  updateAvailable: boolean;
  isBreakAlarm: boolean;
  isRunning: boolean;
  breakOverdueSec: number;
  activeSeconds: number;
  remainingRatio: number;
  timerStyle: TimerVisualStyle;
  timerColor: string;
  hasPausedProgress: boolean;
  workElapsedSec: number;
  workPausedLiveSec: number;
  distractPenaltyMins: number;
  reminderBanner: { kind?: "context" | "short_break" | "milestone"; text: string } | null;
  workPhase?: WorkPhase;
  warmupLeftSec?: number;
  showStuckBtn?: boolean;
  hyperfocusOfferLeftSec?: number;
  canLogBreakEndMood?: boolean;
  onToggleRunning: () => void;
  onOpenWorkTopicBox: () => void;
  onOpenContextBox: () => void;
  onOpenStuckRescue?: () => void;
  onExtendHyperfocus?: (extraMins: number) => void;
  onSelectBreakEndMood?: (mood: MoodType) => void;
  onDismissBreakEndMood?: () => void;
  onToggleBreakParking: () => void;
  onOpenMenu: () => void;
  onEnterMiniDock: () => void;
  onHideToTray: () => void;
  onDismissReminderBanner: () => void;
  onToggleParkingTask: (id: number, done: boolean) => void;
  onRateParkingIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteParkingEntry: (id: number) => void;
  onChangeParkingBucket?: (id: number, bucket: ParkingBucket) => void;
  onBreakParkingLayoutChange?: (openRows: number, sections: number) => void;
  onOpenLightbox: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
    source?: "story" | "parking",
  ) => void;
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
  breakChecklistItems,
  updateAvailable,
  isBreakAlarm,
  isRunning,
  breakOverdueSec,
  activeSeconds,
  remainingRatio,
  timerStyle,
  timerColor,
  hasPausedProgress,
  workElapsedSec,
  workPausedLiveSec,
  distractPenaltyMins,
  reminderBanner,
  workPhase = "focus",
  warmupLeftSec = 0,
  showStuckBtn = false,
  hyperfocusOfferLeftSec = 0,
  canLogBreakEndMood = false,
  onToggleRunning,
  onOpenWorkTopicBox,
  onOpenContextBox,
  onOpenStuckRescue,
  onExtendHyperfocus,
  onSelectBreakEndMood,
  onDismissBreakEndMood,
  onToggleBreakParking,
  onOpenMenu,
  onEnterMiniDock,
  onHideToTray,
  onDismissReminderBanner,
  onToggleParkingTask,
  onRateParkingIdea,
  onDeleteParkingEntry,
  onChangeParkingBucket,
  onBreakParkingLayoutChange,
  onOpenLightbox,
  onStartWorkFromBreak,
  onStopSession,
  onTakeShortBreak,
  onDistractedClick,
}: TimerPageProps) {
  const [hfMins, setHfMins] = useState<number>(10);
  const [checkedReminders, setCheckedReminders] = useState<
    Record<string, boolean>
  >({});
  useEffect(() => {
    if (timerMode !== "break") {
      setCheckedReminders({});
    }
  }, [timerMode]);
  const hideUntilHover = !hasBreakParkingView && !isBreakAlarm;
  const accentColor = timerColor || "#f2f4f8";
  const showHyperfocusOffer =
    timerMode === "break" &&
    hyperfocusOfferLeftSec > 0 &&
    Boolean(onExtendHyperfocus);
  const showBreakMoodPrompt =
    timerMode === "break" &&
    !showHyperfocusOffer &&
    Boolean(canLogBreakEndMood && onSelectBreakEndMood);
  const showBreakChecklist =
    timerMode === "break" &&
    !isBreakAlarm &&
    !showHyperfocusOffer &&
    !showBreakMoodPrompt &&
    breakChecklistItems.length > 0;

  return (
    <>
      <div className={hideUntilHover ? "top-bar hover-reveal" : "top-bar"}>
        <div className="top-bar-left">
          {timerMode === "work" ? (
            <>
              <span
                className="timer-mode-badge"
                title={`${t.work} (${planDisplayName} • ${currentPlan.workMins} ${activeLang === "tr" ? "dk" : "min"})`}
              >
                <IconBriefcase size={11} />
              </span>

              <span
                className="cycle-badge"
                title={t.cycleTooltip(
                  currentCycleIndex,
                  currentPlan.longBreakInterval,
                  currentPlan.longBreakMins,
                )}
              >
                <IconRepeat size={10} />
                <span>
                  {t.cycleProgressBadge(
                    currentCycleIndex,
                    currentPlan.longBreakInterval,
                  )}
                </span>
              </span>

              {workPhase === "warmup" && (
                <span className="phase-chip warmup">
                  {t.phaseWarmup} ·{" "}
                  {Math.max(1, Math.ceil(warmupLeftSec / 60))}
                  {activeLang === "tr" ? "dk" : "m"}
                </span>
              )}
              {workPhase === "final" && (
                <span className="phase-chip final">{t.phaseFinal}</span>
              )}
              {workPhase === "hyperfocus" && (
                <span className="phase-chip hyperfocus">
                  <IconFlame size={9} />
                  <span>{t.phaseHyperfocus}</span>
                </span>
              )}

              {sessionShortBreakCount > 0 && (
                <span
                  className="short-break-chip"
                  title={t.shortBreaksCountBadge(sessionShortBreakCount)}
                >
                  <IconCoffee size={10} />
                  <span>{sessionShortBreakCount}</span>
                </span>
              )}
            </>
          ) : (
            <>
              <span className="timer-mode-badge" title={currentBreakFullTooltip}>
                {breakKind === "long" ? (
                  <IconSparkles size={11} />
                ) : (
                  <IconCoffee size={11} />
                )}
                <span>{currentBreakShortName}</span>
              </span>
              {(() => {
                const breakCycleIndex =
                  breakKind === "long"
                    ? currentPlan.longBreakInterval
                    : currentCycleIndex;
                return (
                  <span
                    className="cycle-badge"
                    title={t.cycleTooltip(
                      breakCycleIndex,
                      currentPlan.longBreakInterval,
                      currentPlan.longBreakMins,
                    )}
                  >
                    <IconRepeat size={10} />
                    <span>
                      {t.cycleProgressBadge(
                        breakCycleIndex,
                        currentPlan.longBreakInterval,
                      )}
                    </span>
                  </span>
                );
              })()}
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
            <IconMenu size={13} />
            {updateAvailable && <span className="update-dot" />}
          </button>
          <button
            className="icon-btn"
            title={t.miniDockTooltip}
            onClick={onEnterMiniDock}
          >
            <IconMinimize size={13} />
          </button>
          <button
            className="icon-btn"
            title={t.hideToTrayOnlyTooltip}
            onClick={onHideToTray}
          >
            <IconClose size={12} />
          </button>
        </div>
      </div>

      <div className="timer-wrap">
        <VisualTimer
          style={timerStyle}
          clockText={
            isBreakAlarm
              ? `-${formatClock(breakOverdueSec)}`
              : formatClock(activeSeconds)
          }
          remainingRatio={remainingRatio}
          accentColor={accentColor}
          isRunning={isRunning}
          isBreakAlarm={isBreakAlarm}
        />
        {isBreakAlarm && (
          <div className="alarm-badge">
            {t.breakOverdueBadge(formatClock(breakOverdueSec))}
          </div>
        )}

        {timerMode === "work" && workPhase === "hyperfocus" && (
          <div className="hyperfocus-live-pill">
            <IconFlame size={10} />
            <span>{t.phaseHyperfocus}</span>
          </div>
        )}

        {timerMode === "work" && (
          <div
            className={
              hideUntilHover
                ? "timer-meta-row hover-reveal hover-collapse"
                : "timer-meta-row"
            }
          >
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
              title={`${t.contextShortLabel}: ${currentContext || t.timerContextAddBtn}`}
            >
              <span className="timer-meta-value">
                {currentContext || t.timerContextAddBtn}
              </span>
            </button>
          </div>
        )}

        {timerMode === "work" && showStuckBtn && onOpenStuckRescue && (
          <button
            type="button"
            className={
              hideUntilHover
                ? "stuck-rescue-btn hover-reveal hover-collapse no-drag"
                : "stuck-rescue-btn no-drag"
            }
            onClick={onOpenStuckRescue}
          >
            <IconCompass size={11} />
            <span>{t.stuckBtnLabel}</span>
          </button>
        )}

        {(hasPausedProgress ||
          (!isRunning && timerMode === "work" && workPausedLiveSec > 0)) && (
          <div
            className={
              hideUntilHover
                ? "resume-hint hover-reveal hover-collapse"
                : "resume-hint"
            }
          >
            {t.resumeHint(
              Math.floor(workElapsedSec / 60),
              workPausedLiveSec >= 1
                ? formatClock(workPausedLiveSec)
                : undefined,
            )}
          </div>
        )}

        {showHyperfocusOffer && onExtendHyperfocus && (
          <div className="hyperfocus-offer-bar no-drag">
            <button
              type="button"
              className="hf-step-btn"
              disabled={hfMins <= 5}
              onClick={() => setHfMins((m) => Math.max(5, m - 5))}
              title="-5"
            >
              −
            </button>
            <button
              type="button"
              className="hf-main-btn"
              onClick={() => onExtendHyperfocus(hfMins)}
              title={t.hyperfocusSectionTitle}
            >
              <IconFlame size={10} />
              <span>{t.hyperfocusBtnLabel(hfMins)}</span>
              <span className="hf-countdown-badge">
                {hyperfocusOfferLeftSec}s
              </span>
            </button>
            <button
              type="button"
              className="hf-step-btn"
              disabled={hfMins >= 20}
              onClick={() => setHfMins((m) => Math.min(20, m + 5))}
              title="+5"
            >
              +
            </button>
          </div>
        )}

        {showBreakMoodPrompt && onSelectBreakEndMood && (
          <div className="break-mood-card no-drag">
            <div className="break-mood-header">
              <span className="break-mood-prompt">{t.moodPromptEnd}</span>
              {onDismissBreakEndMood && (
                <button
                  type="button"
                  className="tag-icon-btn del-btn break-mood-dismiss"
                  onClick={onDismissBreakEndMood}
                  title={t.cancel}
                >
                  <IconClose size={9} />
                </button>
              )}
            </div>
            <div className="break-mood-pills">
              {MOOD_TYPES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="mood-pill-btn compact"
                  onClick={() => onSelectBreakEndMood(m)}
                  title={`${t.moodPromptEnd}: ${t.moodLabels[m]}`}
                >
                  <span className={`mood-dot mood-${m}`} />
                  <span>{t.moodLabels[m]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showBreakChecklist && (
          <div
            className={
              hideUntilHover
                ? "break-reminders-strip hover-reveal hover-collapse no-drag"
                : "break-reminders-strip no-drag"
            }
          >
            {breakChecklistItems.map((note, idx) => {
              const checkKey = `${idx}:${note}`;
              const isDone = Boolean(checkedReminders[checkKey]);
              return (
                <button
                  key={checkKey}
                  type="button"
                  className={`break-reminder-note-pill ${isDone ? "checked" : ""}`}
                  onClick={() =>
                    setCheckedReminders((prev) => ({
                      ...prev,
                      [checkKey]: !prev[checkKey],
                    }))
                  }
                >
                  <span className="break-check-box" aria-hidden="true">
                    {isDone && <IconCheck size={7} />}
                  </span>
                  <span>{note}</span>
                </button>
              );
            })}
          </div>
        )}

        {reminderBanner && reminderBanner.kind === "milestone" && (
          <div
            className="reminder-banner no-drag milestone"
            title={reminderBanner.text}
          >
            <span className="reminder-banner-text">{reminderBanner.text}</span>
            <button
              type="button"
              className="tag-icon-btn"
              onClick={onDismissReminderBanner}
              title={t.cancel}
            >
              <IconClose size={10} />
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
            onToggleTask={onToggleParkingTask}
            onRateIdea={onRateParkingIdea}
            onDeleteEntry={onDeleteParkingEntry}
            onChangeBucket={onChangeParkingBucket}
            onBreakLayoutChange={onBreakParkingLayoutChange}
            onOpenLightbox={onOpenLightbox}
          />
        </div>
      )}

      {timerMode === "break" ? (
        <div className={hideUntilHover ? "btn-row hover-reveal" : "btn-row"}>
          {!isRunning && !isBreakAlarm && (
            <button
              className="primary-btn"
              onClick={onToggleRunning}
              title={t.timerResumeTooltip}
            >
              <IconPlay size={11} />
              <span>{t.resumeWorkBtn}</span>
            </button>
          )}
          <button
            className={isRunning || isBreakAlarm ? "primary-btn" : ""}
            onClick={onStartWorkFromBreak}
            title={
              breakKind === "long"
                ? t.finishSessionTooltip
                : breakKind === "short"
                  ? t.returnToWorkBtn
                  : t.startWorkBtn
            }
          >
            {breakKind === "long" ? (
              <IconCheck size={11} />
            ) : (
              <IconPlay size={11} />
            )}
            <span>
              {breakKind === "long"
                ? t.finishSessionBtn
                : breakKind === "short"
                  ? t.returnToWorkCompact
                  : t.startWorkCompact}
            </span>
          </button>
        </div>
      ) : (
        <div className={hideUntilHover ? "btn-row hover-reveal" : "btn-row"}>
          {!isRunning && (
            <button
              className="primary-btn"
              onClick={onToggleRunning}
              title={t.timerResumeTooltip}
            >
              <IconPlay size={11} />
              <span>{t.resumeWorkBtn}</span>
            </button>
          )}
          <button
            className="short-break-btn"
            onClick={onTakeShortBreak}
            title={t.shortBreakBtnTooltip(currentPlan.shortBreakMins)}
          >
            <IconCoffee size={12} />
            <span>{t.shortBreakBtn(currentPlan.shortBreakMins)}</span>
          </button>
          <button onClick={onStopSession} title={t.stopBtnTooltip}>
            <IconStop size={11} />
            <span>{t.stop}</span>
          </button>
          <button
            className="warn-btn"
            onClick={onDistractedClick}
            title={t.distractedBtnTooltip(distractPenaltyMins)}
          >
            <IconZap size={12} />
            {t.distractedBtnCompact(distractPenaltyMins) ? (
              <span>{t.distractedBtnCompact(distractPenaltyMins)}</span>
            ) : null}
          </button>
        </div>
      )}
    </>
  );
}
