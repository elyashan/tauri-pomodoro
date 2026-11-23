// @llm-index: OS integrations: Focus Assist, tray tooltip, 5m periodic story capture, spotlight snapshot & Tauri events
import { useEffect, useRef, type MutableRefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  RuntimeState,
  TimerMode,
  WorkStoryEntry,
  addWorkStoryEntry,
  getWorkStoryEntries,
  toLocalDateStr,
} from "../db";
import type { ActiveLang } from "../i18n";
import { formatClock } from "../constants";
import { isLightColor } from "../lib/color";
import { captureScreenCompressed } from "../screenshot";

const STALE_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export interface UseSystemWatchersParams {
  loaded: boolean;
  sessionActive: boolean;
  isRunning: boolean;
  timerMode: TimerMode;
  workSecondsLeft: number;
  breakSecondsLeft: number;
  workElapsedSec: number;
  currentContext: string;
  currentWorkTag: string;
  currentWorkReason: string;
  distractPenaltyMins: number;
  activeLang: ActiveLang;
  bgColor: string;
  uiScale: number;
  recentContexts: string[];
  isMiniDock: boolean;
  qcContextNoneLabel: string;
  runtimeStateRef: MutableRefObject<RuntimeState>;
  isRunningRef: MutableRefObject<boolean>;
  lastTickRef: MutableRefObject<number>;
  lastActiveAtRef: MutableRefObject<number | null>;
  workPauseStartedAtRef: MutableRefObject<number | null>;
  freqOnlyTodayRef: MutableRefObject<boolean>;
  autoCloseStaleSessionRef: MutableRefObject<
    (effectiveEndMs: number) => Promise<void>
  >;
  revealExpandedWindowRef: MutableRefObject<() => Promise<void>>;
  enterMiniDock: () => Promise<void>;
  exitMiniDock: () => Promise<void>;
  setIsRunning: (v: boolean) => void;
  setWorkPauseStartedAtMs: (ms: number | null) => void;
  setCurrentWinSize: (size: { w: number; h: number }) => void;
  setWorkStoryEntries: (entries: WorkStoryEntry[]) => void;
  triggerBackgroundCloudSync: () => void;
}

export function useSystemWatchers({
  loaded,
  sessionActive,
  isRunning,
  timerMode,
  workSecondsLeft,
  breakSecondsLeft,
  workElapsedSec,
  currentContext,
  currentWorkTag,
  currentWorkReason,
  distractPenaltyMins,
  activeLang,
  bgColor,
  uiScale,
  recentContexts,
  isMiniDock,
  qcContextNoneLabel,
  runtimeStateRef,
  isRunningRef,
  lastTickRef,
  lastActiveAtRef,
  workPauseStartedAtRef,
  freqOnlyTodayRef,
  autoCloseStaleSessionRef,
  revealExpandedWindowRef,
  enterMiniDock,
  exitMiniDock,
  setIsRunning,
  setWorkPauseStartedAtMs,
  setCurrentWinSize,
  setWorkStoryEntries,
  triggerBackgroundCloudSync,
}: UseSystemWatchersParams) {
  const lastPeriodicShotSecRef = useRef<number>(0);

  // Çalışma sayacı aktifken Windows Focus Moduna (Rahatsız Etmeyin / Bildirimleri Gizle) gir
  useEffect(() => {
    if (!loaded) return;
    const shouldSuppress =
      sessionActive && isRunning && timerMode === "work";
    invoke("set_windows_focus_mode", { enabled: shouldSuppress }).catch(
      () => {},
    );
  }, [loaded, sessionActive, isRunning, timerMode]);

  // Sağ alt sistem tepsisi (System Tray) simgesi tooltip güncellemesi
  useEffect(() => {
    if (!loaded) return;
    const ctxLabel =
      currentContext.trim() ||
      (currentWorkTag
        ? `${currentWorkTag}${currentWorkReason ? `: ${currentWorkReason}` : ""}`
        : qcContextNoneLabel);
    const clk = formatClock(
      timerMode === "work" ? workSecondsLeft : breakSecondsLeft,
    );
    const modeTitle = !sessionActive
      ? "Pomodoro Widget"
      : timerMode === "work"
        ? `💼 ${clk}`
        : `☕ ${clk}`;
    invoke("update_tray_tooltip", {
      tooltip: `${modeTitle} • 🎯 ${ctxLabel}`,
    }).catch(() => {});
  }, [
    loaded,
    sessionActive,
    timerMode,
    workSecondsLeft,
    breakSecondsLeft,
    currentContext,
    currentWorkTag,
    currentWorkReason,
    qcContextNoneLabel,
  ]);

  // 5 Dakikada 1 Otomatik Ekran Görüntüsü + Açık Pencere İsmi + Context = Çalışma Hikayesi
  useEffect(() => {
    if (!loaded || !sessionActive || !isRunning || timerMode !== "work") {
      if (!sessionActive || timerMode !== "work") {
        lastPeriodicShotSecRef.current = 0;
      }
      return;
    }
    const currentBucket = Math.floor(workElapsedSec / 300);
    const prevBucket = Math.floor(lastPeriodicShotSecRef.current / 300);
    if (workElapsedSec >= 300 && currentBucket > prevBucket) {
      lastPeriodicShotSecRef.current = workElapsedSec;
      (async () => {
        try {
          const shot = await captureScreenCompressed(true, null, 720, 0.68);
          if (!shot.dataUrl) return;
          const fg =
            shot.activeApp || shot.activeWindow
              ? { appName: shot.activeApp, windowTitle: shot.activeWindow }
              : await invoke<{ appName: string; windowTitle: string }>(
                  "get_last_active_window",
                ).catch(() => ({ appName: "", windowTitle: "" }));
          const rt = runtimeStateRef.current;
          const ctxText =
            rt.currentContext.trim() ||
            (rt.workTag
              ? `${rt.workTag}${rt.workReason ? `: ${rt.workReason}` : ""}`
              : "");
          await addWorkStoryEntry({
            entryType: "periodic",
            screenshotData: shot.dataUrl,
            activeApp: fg.appName,
            activeWindow: fg.windowTitle,
            contextText: ctxText,
            workTag: rt.workTag,
            note: `${Math.floor(workElapsedSec / 60)} dk • ${fg.appName || rt.workTag || "Çalışma"}`,
            elapsedWorkSec: workElapsedSec,
          });
          setWorkStoryEntries(
            await getWorkStoryEntries(freqOnlyTodayRef.current, 80),
          );
          triggerBackgroundCloudSync();
        } catch (err) {
          console.error("5dk çalışma hikayesi kaydedilemedi:", err);
        }
      })();
    }
  }, [loaded, sessionActive, isRunning, timerMode, workElapsedSec]);

  // Spotlight Yakalama Penceresi için Rust arka planına anlık durum senkronizasyonu
  useEffect(() => {
    if (!loaded) return;
    invoke("sync_capture_snapshot", {
      snapshot: {
        currentContext,
        workTag: currentWorkTag,
        workReason: currentWorkReason,
        sessionActive,
        timerMode,
        distractPenaltyMins,
        lang: activeLang,
        bgColor: isLightColor(bgColor) ? "#efefef" : "#0c0d0e",
        recentContexts,
        uiScale,
      },
    }).catch(() => {});
  }, [
    loaded,
    currentContext,
    currentWorkTag,
    currentWorkReason,
    sessionActive,
    timerMode,
    distractPenaltyMins,
    activeLang,
    bgColor,
    uiScale,
    recentContexts,
  ]);

  // Sistem tepsisi (Tray), OS uyanma ve pencere yeniden boyutlandırma olaylarını dinle
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let unlistenMini: (() => void) | null = null;
    let unlistenRestore: (() => void) | null = null;
    let unlistenOsResumed: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    (async () => {
      const fMini = await listen("request-mini-dock", () => {
        void enterMiniDock();
      });
      if (cancelled) {
        fMini();
        return;
      }
      unlistenMini = fMini;

      const fRestore = await listen("tray-restore", () => {
        void exitMiniDock();
      });
      if (cancelled) {
        fRestore();
        return;
      }
      unlistenRestore = fRestore;

      const fResumed = await listen("os-resumed", () => {
        const rt = runtimeStateRef.current;
        const anchorMs =
          lastTickRef.current || lastActiveAtRef.current || Date.now();
        if (
          rt.sessionActive &&
          (Date.now() - anchorMs >= STALE_SESSION_TIMEOUT_MS ||
            toLocalDateStr(new Date(anchorMs)) !== toLocalDateStr())
        ) {
          void autoCloseStaleSessionRef.current(anchorMs);
          void revealExpandedWindowRef.current();
          return;
        }
        if (rt.sessionActive && rt.mode === "work" && isRunningRef.current) {
          if (!workPauseStartedAtRef.current) {
            setWorkPauseStartedAtMs(lastTickRef.current || Date.now());
          }
          lastTickRef.current = Date.now();
          setIsRunning(false);
        }
        void revealExpandedWindowRef.current();
      });
      if (cancelled) {
        fResumed();
        return;
      }
      unlistenOsResumed = fResumed;

      const win = getCurrentWindow();
      const fResize = await win.onResized(async () => {
        try {
          const factor = await win.scaleFactor();
          const size = await win.innerSize();
          const mult = Math.max(1, (uiScale || 100) / 100);
          setCurrentWinSize({
            w: Math.round(size.width / factor / mult),
            h: Math.round(size.height / factor / mult),
          });
        } catch {
          // ignore
        }
      });
      if (cancelled) {
        fResize();
        return;
      }
      unlistenResize = fResize;
    })();

    return () => {
      cancelled = true;
      if (unlistenMini) unlistenMini();
      if (unlistenRestore) unlistenRestore();
      if (unlistenOsResumed) unlistenOsResumed();
      if (unlistenResize) unlistenResize();
    };
  }, [loaded, isMiniDock, uiScale]);
}
