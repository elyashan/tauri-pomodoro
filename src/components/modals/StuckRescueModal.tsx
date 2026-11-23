import { useEffect, useMemo, useState } from "react";
import type { RescueExerciseSettings } from "../../db";
import type { Translations } from "../../i18n";
import { playSubtleMilestoneChime } from "../../lib/audio";

export interface StuckRescueModalProps {
  t: Translations;
  enabledExercises: RescueExerciseSettings;
  onResume: () => void;
  onTakeShortBreak: () => void;
  onCancel: () => void;
}

type RescueModeKey = "breathing" | "gaze" | "physical";

const BREATH_CYCLE_MS = 12000;
const BREATH_MAX_CYCLES = 4;
const BREATH_TOTAL_MS = BREATH_CYCLE_MS * BREATH_MAX_CYCLES; // 48s
const GAZE_TOTAL_MS = 60000;
const PHYSICAL_TOTAL_MS = 30000;

export function StuckRescueModal({
  t,
  enabledExercises,
  onResume,
  onTakeShortBreak,
  onCancel,
}: StuckRescueModalProps) {
  const availableModes = useMemo(
    () =>
      (["breathing", "gaze", "physical"] as RescueModeKey[]).filter(
        (k) => enabledExercises[k],
      ),
    [
      enabledExercises.breathing,
      enabledExercises.gaze,
      enabledExercises.physical,
    ],
  );

  const [activeMode, setActiveMode] = useState<RescueModeKey>(
    availableModes[0] ?? "breathing",
  );
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completed, setCompleted] = useState(false);

  const targetTotalMs =
    activeMode === "breathing"
      ? BREATH_TOTAL_MS
      : activeMode === "gaze"
        ? GAZE_TOTAL_MS
        : PHYSICAL_TOTAL_MS;

  useEffect(() => {
    if (!availableModes.includes(activeMode) && availableModes.length > 0) {
      setActiveMode(availableModes[0]);
      setRunning(false);
      setElapsedMs(0);
      setCompleted(false);
    }
  }, [activeMode, availableModes]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsedMs((prev) => Math.min(targetTotalMs, prev + 100));
    }, 100);
    return () => window.clearInterval(id);
  }, [running, targetTotalMs]);

  useEffect(() => {
    if (running && elapsedMs >= targetTotalMs) {
      setRunning(false);
      setCompleted(true);
      playSubtleMilestoneChime("warmup_done");
    }
  }, [running, elapsedMs, targetTotalMs]);

  const switchMode = (m: RescueModeKey) => {
    setActiveMode(m);
    setRunning(false);
    setElapsedMs(0);
    setCompleted(false);
  };

  const toggleRun = () => {
    if (running) {
      setRunning(false);
      setElapsedMs(0);
    } else {
      setCompleted(false);
      setElapsedMs(0);
      setRunning(true);
    }
  };

  const curCycle = Math.min(
    BREATH_MAX_CYCLES,
    Math.floor(elapsedMs / BREATH_CYCLE_MS) + 1,
  );
  const msInCycle = elapsedMs % BREATH_CYCLE_MS;
  const breathPhase =
    msInCycle < 4000
      ? {
          label: t.stuckBreathIn,
          rem: Math.max(1, Math.ceil((4000 - msInCycle) / 1000)),
          pct: (msInCycle / 4000) * 100,
          cls: "inhale",
        }
      : msInCycle < 8000
        ? {
            label: t.stuckBreathHold,
            rem: Math.max(1, Math.ceil((8000 - msInCycle) / 1000)),
            pct: 100,
            cls: "hold",
          }
        : {
            label: t.stuckBreathOut,
            rem: Math.max(1, Math.ceil((12000 - msInCycle) / 1000)),
            pct: Math.max(0, ((12000 - msInCycle) / 4000) * 100),
            cls: "exhale",
          };

  const gazeLeftSec = Math.max(
    0,
    Math.ceil((GAZE_TOTAL_MS - elapsedMs) / 1000),
  );
  const gazePct = Math.min(100, (elapsedMs / GAZE_TOTAL_MS) * 100);

  const physStepIdx = Math.min(2, Math.floor(elapsedMs / 10000));
  const physLeftSec = Math.max(
    0,
    Math.ceil((PHYSICAL_TOTAL_MS - elapsedMs) / 1000),
  );
  const physPct = Math.min(100, (elapsedMs / PHYSICAL_TOTAL_MS) * 100);

  return (
    <div className="stop-box no-drag stuck-rescue-box">
      <div className="stop-box-title">{t.stuckModalTitle}</div>
      <div className="stuck-sub">{t.stuckModalSub}</div>

      {availableModes.length === 0 ? (
        <div className="stuck-empty-note">{t.rescueNoneEnabledHint}</div>
      ) : (
        <>
          {availableModes.length > 1 && (
            <div className="rescue-tabs">
              {availableModes.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rescue-tab-btn ${activeMode === m ? "active" : ""}`}
                  onClick={() => switchMode(m)}
                >
                  {t.rescueExerciseNames[m]}
                </button>
              ))}
            </div>
          )}

          {activeMode === "breathing" && (
            <div className="stuck-breath-card">
              <div className="stuck-breath-head">
                <span className="stuck-breath-title">
                  {t.stuckBreathTitle} ·{" "}
                  {t.rescueBreathCycle(curCycle, BREATH_MAX_CYCLES)}
                </span>
                <button
                  type="button"
                  className={`stuck-breath-toggle ${running ? "active" : ""}`}
                  onClick={toggleRun}
                >
                  {running
                    ? t.stuckBreathStop
                    : completed
                      ? t.rescueRestartBtn
                      : t.stuckBreathStart}
                </button>
              </div>
              {running ? (
                <div className="stuck-breath-live">
                  <div className="stuck-breath-meta">
                    <span className={`stuck-phase-txt ${breathPhase.cls}`}>
                      {breathPhase.label}
                    </span>
                    <span className="stuck-phase-count">
                      {breathPhase.rem}s
                    </span>
                  </div>
                  <div className="stuck-breath-bar-bg">
                    <div
                      className={`stuck-breath-bar-fill ${breathPhase.cls}`}
                      style={{ width: `${breathPhase.pct}%` }}
                    />
                  </div>
                </div>
              ) : (
                completed && (
                  <div className="rescue-done-banner">{t.rescueDoneLabel}</div>
                )
              )}
            </div>
          )}

          {activeMode === "gaze" && (
            <div className="rescue-exercise-card">
              <div className="stuck-breath-head">
                <span className="stuck-breath-title">{t.rescueGazeTitle}</span>
                <button
                  type="button"
                  className={`stuck-breath-toggle ${running ? "active" : ""}`}
                  onClick={toggleRun}
                >
                  {running
                    ? t.stuckBreathStop
                    : completed
                      ? t.rescueRestartBtn
                      : t.rescueGazeStart}
                </button>
              </div>
              <div className="rescue-exercise-hint">{t.rescueGazeHint}</div>
              {running ? (
                <div className="stuck-breath-live">
                  <div className="stuck-breath-meta">
                    <span className="stuck-phase-txt inhale">
                      {t.rescueExerciseNames.gaze}
                    </span>
                    <span className="stuck-phase-count">{gazeLeftSec}s</span>
                  </div>
                  <div className="stuck-breath-bar-bg">
                    <div
                      className="stuck-breath-bar-fill inhale"
                      style={{ width: `${gazePct}%` }}
                    />
                  </div>
                </div>
              ) : (
                completed && (
                  <div className="rescue-done-banner">{t.rescueDoneLabel}</div>
                )
              )}
            </div>
          )}

          {activeMode === "physical" && (
            <div className="rescue-exercise-card">
              <div className="stuck-breath-head">
                <span className="stuck-breath-title">
                  {t.rescuePhysicalTitle}
                </span>
                <button
                  type="button"
                  className={`stuck-breath-toggle ${running ? "active" : ""}`}
                  onClick={toggleRun}
                >
                  {running
                    ? t.stuckBreathStop
                    : completed
                      ? t.rescueRestartBtn
                      : t.rescuePhysicalStart}
                </button>
              </div>
              {running ? (
                <div className="stuck-breath-live">
                  <div className="stuck-breath-meta">
                    <span className="stuck-phase-txt exhale">
                      {t.rescuePhysicalSteps[physStepIdx]}
                    </span>
                    <span className="stuck-phase-count">{physLeftSec}s</span>
                  </div>
                  <div className="stuck-breath-bar-bg">
                    <div
                      className="stuck-breath-bar-fill exhale"
                      style={{ width: `${physPct}%` }}
                    />
                  </div>
                </div>
              ) : completed ? (
                <div className="rescue-done-banner">{t.rescueDoneLabel}</div>
              ) : (
                <div className="rescue-physical-preview">
                  {t.rescuePhysicalSteps.map((s, idx) => (
                    <div key={idx} className="rescue-preview-line">
                      {idx + 1}. {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="stop-box-actions stuck-actions">
        <button
          type="button"
          className="ghost-btn"
          onClick={onTakeShortBreak}
        >
          {t.stuckTakeShortBreakBtn}
        </button>
        <div className="stuck-actions-right">
          <button type="button" onClick={onCancel}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={onResume}
          >
            {t.stuckResumeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
