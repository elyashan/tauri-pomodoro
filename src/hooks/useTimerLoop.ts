// @llm-index: Wall-clock tick loop, OS sleep/idle guards, pause clock, milestones & mode transitions
import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AppState,
  ParkingLotData,
  RuntimeState,
  TimerMode,
  getBreakParkingLotData,
  toLocalDateStr,
} from "../db";
import type { Translations } from "../i18n";
import { getFinalStretchSec, getWarmupDurationSec } from "../constants";
import { playAlarmChime, playSubtleMilestoneChime } from "../lib/audio";

export const STALE_SESSION_TIMEOUT_SEC = 60 * 60; // 60 min
export const STALE_SESSION_TIMEOUT_MS = STALE_SESSION_TIMEOUT_SEC * 1000;

export interface UseTimerLoopParams {
  loaded: boolean;
  sessionActive: boolean;
  isRunning: boolean;
  timerMode: TimerMode;
  isHyperfocus: boolean;
  workElapsedSec: number;
  workSecondsLeft: number;
  workPlanMins: number;
  workPauseStartedAtMs: number | null;
  showBreakOverdueBox: boolean;
  milestonePulse: boolean;
  t: Translations;
  lastTickRef: MutableRefObject<number>;
  lastActiveAtRef: MutableRefObject<number | null>;
  lastAlarmPlayRef: MutableRefObject<number>;
  workPauseStartedAtRef: MutableRefObject<number | null>;
  isRunningRef: MutableRefObject<boolean>;
  isMiniDockRef: MutableRefObject<boolean>;
  appStateRef: MutableRefObject<AppState>;
  runtimeStateRef: MutableRefObject<RuntimeState>;
  autoCloseStaleSessionRef: MutableRefObject<
    (effectiveEndMs: number) => Promise<void>
  >;
  revealExpandedWindowRef: MutableRefObject<() => Promise<void>>;
  firedMilestonesRef: MutableRefObject<{
    warmupDone: boolean;
    halfway: boolean;
    finalStretch: boolean;
  }>;
  setWorkSecondsLeft: Dispatch<SetStateAction<number>>;
  setWorkElapsedSec: Dispatch<SetStateAction<number>>;
  setBreakSecondsLeft: Dispatch<SetStateAction<number>>;
  setBreakElapsedSec: Dispatch<SetStateAction<number>>;
  setBreakOverdueSec: Dispatch<SetStateAction<number>>;
  setIsRunning: Dispatch<SetStateAction<boolean>>;
  setWorkPauseStartedAtMs: Dispatch<SetStateAction<number | null>>;
  setWorkPausedLiveSec: Dispatch<SetStateAction<number>>;
  setMilestonePulse: Dispatch<SetStateAction<boolean>>;
  setReminderBanner: Dispatch<
    SetStateAction<{
      kind?: "context" | "short_break" | "milestone";
      text: string;
    } | null>
  >;
  setIsModeSwitching: Dispatch<SetStateAction<boolean>>;
  setShowBreakParking: Dispatch<SetStateAction<boolean>>;
  setBreakParkingData: Dispatch<SetStateAction<ParkingLotData>>;
  triggerMiniDockContextToast: (msg: string) => void;
}

export function useTimerLoop({
  loaded,
  sessionActive,
  isRunning,
  timerMode,
  isHyperfocus,
  workElapsedSec,
  workSecondsLeft,
  workPlanMins,
  workPauseStartedAtMs,
  showBreakOverdueBox,
  milestonePulse,
  t,
  lastTickRef,
  lastActiveAtRef,
  lastAlarmPlayRef,
  workPauseStartedAtRef,
  isRunningRef,
  isMiniDockRef,
  appStateRef,
  runtimeStateRef,
  autoCloseStaleSessionRef,
  revealExpandedWindowRef,
  firedMilestonesRef,
  setWorkSecondsLeft,
  setWorkElapsedSec,
  setBreakSecondsLeft,
  setBreakElapsedSec,
  setBreakOverdueSec,
  setIsRunning,
  setWorkPauseStartedAtMs,
  setWorkPausedLiveSec,
  setMilestonePulse,
  setReminderBanner,
  setIsModeSwitching,
  setShowBreakParking,
  setBreakParkingData,
  triggerMiniDockContextToast,
}: UseTimerLoopParams) {
  const prevTimerModeRef = useRef<TimerMode>("work");

  // Çalışma <-> Mola geçişlerinde yumuşak görsel geçiş animasyonu ve mola otoparkı yenileme
  useEffect(() => {
    if (!loaded) {
      prevTimerModeRef.current = timerMode;
      return;
    }
    if (prevTimerModeRef.current !== timerMode) {
      prevTimerModeRef.current = timerMode;
      setIsModeSwitching(true);
      if (timerMode === "break") {
        setShowBreakParking(false);
        getBreakParkingLotData()
          .then(setBreakParkingData)
          .catch(() => {});
      }
      const timer = setTimeout(() => setIsModeSwitching(false), 680);
      return () => clearTimeout(timer);
    }
  }, [timerMode, loaded]);

  // Çalışma sırasında duraklatıldığında geçen ara süresini canlı say
  useEffect(() => {
    if (
      !loaded ||
      !sessionActive ||
      isRunning ||
      timerMode !== "work" ||
      workPauseStartedAtMs === null ||
      showBreakOverdueBox
    ) {
      setWorkPausedLiveSec(0);
      return;
    }
    const updatePauseClock = () => {
      const pausedSec = Math.max(
        0,
        Math.floor((Date.now() - workPauseStartedAtMs) / 1000),
      );
      if (
        pausedSec >= STALE_SESSION_TIMEOUT_SEC ||
        toLocalDateStr(new Date(workPauseStartedAtMs)) !== toLocalDateStr()
      ) {
        void autoCloseStaleSessionRef.current(workPauseStartedAtMs);
        return;
      }
      setWorkPausedLiveSec(pausedSec);
    };
    updatePauseClock();
    const tmr = setInterval(updatePauseClock, 1000);
    return () => clearInterval(tmr);
  }, [
    loaded,
    sessionActive,
    isRunning,
    timerMode,
    workPauseStartedAtMs,
    showBreakOverdueBox,
  ]);

  // Sistem saatine dayalı sayaç döngüsü (StrictMode güvenli — iç içe setState yok)
  useEffect(() => {
    if (!isRunning || !sessionActive) return;
    let disposed = false;
    let sleepCheckInFlight = false;
    lastTickRef.current = Date.now();

    const applyDelta = (delta: number, now: number) => {
      lastTickRef.current += delta * 1000;
      lastActiveAtRef.current = now;

      const rt = runtimeStateRef.current;
      const appSt = appStateRef.current;

      if (rt.mode === "work") {
        const applied = Math.min(delta, appSt.work_seconds_left);
        if (applied > 0) {
          setWorkSecondsLeft((prev) => Math.max(0, prev - applied));
          setWorkElapsedSec((prev) => prev + applied);
        }
        return;
      }

      const prevLeft = appSt.break_seconds_left;
      if (prevLeft > 0) {
        if (prevLeft > delta) {
          setBreakSecondsLeft(prevLeft - delta);
          setBreakElapsedSec(rt.breakElapsedSec + delta);
        } else {
          // Mola tam bu adımda doldu: aşan kısmı gecikmeye yaz ve alarm çal
          const overflow = delta - prevLeft;
          const nextOverdue = rt.breakOverdueSec + overflow;
          if (
            nextOverdue + rt.breakOvertimeAccumSec >=
            STALE_SESSION_TIMEOUT_SEC
          ) {
            void autoCloseStaleSessionRef.current(now - nextOverdue * 1000);
            return;
          }
          setBreakSecondsLeft(0);
          setBreakElapsedSec(rt.breakElapsedSec + prevLeft);
          setBreakOverdueSec(nextOverdue);
          playAlarmChime();
          if (isMiniDockRef.current) {
            triggerMiniDockContextToast(t.breakOverAlert);
            setTimeout(() => {
              invoke("alert_break_started").catch(() => {});
            }, 90);
          } else {
            invoke("alert_break_started").catch(() => {});
          }
          lastAlarmPlayRef.current = now;
        }
      } else {
        const nextOverdue = rt.breakOverdueSec + delta;
        if (
          nextOverdue + rt.breakOvertimeAccumSec >=
          STALE_SESSION_TIMEOUT_SEC
        ) {
          void autoCloseStaleSessionRef.current(now - nextOverdue * 1000);
          return;
        }
        setBreakOverdueSec(nextOverdue);
        if (now - lastAlarmPlayRef.current >= 12000) {
          playAlarmChime();
          lastAlarmPlayRef.current = now;
        }
      }
    };

    const runTick = async () => {
      if (disposed || sleepCheckInFlight) return;
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);
      if (delta < 1) return;

      if (delta <= 15) {
        applyDelta(delta, now);
        return;
      }

      const tickAnchor = lastTickRef.current;
      const crossedDay =
        toLocalDateStr(new Date(tickAnchor)) !== toLocalDateStr();

      if (runtimeStateRef.current.mode === "break") {
        const rt = runtimeStateRef.current;
        const remBreak = appStateRef.current.break_seconds_left;
        const projectedOverdue =
          rt.breakOvertimeAccumSec +
          rt.breakOverdueSec +
          Math.max(0, delta - remBreak);
        if (crossedDay || projectedOverdue >= STALE_SESSION_TIMEOUT_SEC) {
          void autoCloseStaleSessionRef.current(
            tickAnchor + Math.min(delta, remBreak) * 1000,
          );
          return;
        }
        applyDelta(delta, now);
        return;
      }

      // WebView2 throttling durumunda gerçek OS uykusu olup olmadığını Rust'tan kontrol et
      sleepCheckInFlight = true;
      try {
        const osSlept = await invoke<boolean>("did_os_sleep_since", {
          sinceMs: tickAnchor,
        }).catch(() => delta > 300);
        if (disposed) return;
        if (osSlept) {
          const sleptLong =
            Date.now() - tickAnchor >= STALE_SESSION_TIMEOUT_MS;
          if (crossedDay || sleptLong) {
            void autoCloseStaleSessionRef.current(tickAnchor);
            void revealExpandedWindowRef.current();
            return;
          }
          if (!workPauseStartedAtRef.current) {
            setWorkPauseStartedAtMs(tickAnchor);
          }
          lastTickRef.current = Date.now();
          setIsRunning(false);
          void revealExpandedWindowRef.current();
          return;
        }
        const latestNow = Date.now();
        const latestDelta = Math.floor(
          (latestNow - lastTickRef.current) / 1000,
        );
        if (latestDelta >= 1) {
          applyDelta(latestDelta, latestNow);
        }
      } finally {
        sleepCheckInFlight = false;
      }
    };

    const onWakeCheck = () => {
      if (document.visibilityState === "visible") {
        void runTick();
      }
    };

    const timer = setInterval(() => {
      void runTick();
    }, 500);
    window.addEventListener("focus", onWakeCheck);
    document.addEventListener("visibilitychange", onWakeCheck);

    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", onWakeCheck);
      document.removeEventListener("visibilitychange", onWakeCheck);
    };
  }, [isRunning, sessionActive]);

  // Ekran kapalı / PC başından 5 dk ayrılma durumunda çalışmayı duraklat
  useEffect(() => {
    if (!isRunning || !sessionActive) return;
    let disposed = false;
    const pollIdle = setInterval(async () => {
      const idleSecs = await invoke<number>("get_system_idle_secs").catch(
        () => 0,
      );
      if (disposed) return;
      const rt = runtimeStateRef.current;
      if (
        rt.sessionActive &&
        isRunningRef.current &&
        rt.mode === "work" &&
        idleSecs >= 300
      ) {
        const rewindSec = Math.min(
          idleSecs,
          appStateRef.current.work_elapsed_sec,
        );
        if (rewindSec > 0) {
          setWorkElapsedSec((prev) => Math.max(0, prev - rewindSec));
          setWorkSecondsLeft((prev) => prev + rewindSec);
        }
        if (!workPauseStartedAtRef.current) {
          setWorkPauseStartedAtMs(Date.now() - rewindSec * 1000);
        }
        setIsRunning(false);
        void revealExpandedWindowRef.current();
      }
    }, 10000);
    return () => {
      disposed = true;
      clearInterval(pollIdle);
    };
  }, [isRunning, sessionActive]);

  // Isınma bitişi, yarı zaman ve son dakikalarda hafif faz bildirimi (+-5sn penceresi)
  useEffect(() => {
    if (!isRunning || !sessionActive || timerMode !== "work" || isHyperfocus) {
      return;
    }
    const warmupSec = getWarmupDurationSec(workPlanMins);
    const finalSec = getFinalStretchSec(workPlanMins);

    if (
      warmupSec > 0 &&
      Math.abs(workElapsedSec - warmupSec) <= 5 &&
      !firedMilestonesRef.current.warmupDone &&
      workSecondsLeft > finalSec
    ) {
      firedMilestonesRef.current.warmupDone = true;
      playSubtleMilestoneChime("warmup_done");
      setMilestonePulse(true);
      setReminderBanner({ kind: "milestone", text: t.warmupDoneBanner });
    }

    const totalRoundSec = workElapsedSec + workSecondsLeft;
    if (
      totalRoundSec >= 240 &&
      workSecondsLeft > finalSec &&
      Math.abs(workElapsedSec - Math.floor(totalRoundSec / 2)) <= 5 &&
      !firedMilestonesRef.current.halfway
    ) {
      firedMilestonesRef.current.halfway = true;
      playSubtleMilestoneChime("halfway");
      setMilestonePulse(true);
      setReminderBanner({ kind: "milestone", text: t.halfwayBanner });
    }

    if (
      workElapsedSec >= 60 &&
      workSecondsLeft > 0 &&
      Math.abs(workSecondsLeft - finalSec) <= 5 &&
      !firedMilestonesRef.current.finalStretch
    ) {
      firedMilestonesRef.current.finalStretch = true;
      playSubtleMilestoneChime("final");
      setMilestonePulse(true);
      setReminderBanner({
        kind: "milestone",
        text: t.finalStretchBanner(Math.max(1, Math.ceil(finalSec / 60))),
      });
    }
  }, [
    isRunning,
    sessionActive,
    timerMode,
    isHyperfocus,
    workElapsedSec,
    workSecondsLeft,
    workPlanMins,
    t,
  ]);

  useEffect(() => {
    if (!milestonePulse) return;
    const id = setTimeout(() => setMilestonePulse(false), 2500);
    return () => clearTimeout(id);
  }, [milestonePulse]);
}
