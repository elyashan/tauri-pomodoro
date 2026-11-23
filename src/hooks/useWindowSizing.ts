// @llm-index: Window DPI zoom & page/modal auto-sizing hook (custom preset + monitor clamping)
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CustomWindowSizes,
  DEFAULT_WINDOW_SIZES,
  ParkingLotData,
  SizeTargetPage,
  ThemeSettings,
  TimerMode,
  resetCustomWindowSizes,
  saveCustomWindowSizes,
} from "../db";
import type { NavPage } from "../constants";
import type { UpdateStatus } from "../updater";
import { applyMonitorClampedWindowSize } from "../lib/windowResize";

export interface UseWindowSizingParams {
  loaded: boolean;
  isMiniDock: boolean;
  page: NavPage;
  theme: ThemeSettings;
  anyModalOpen: boolean;
  showDistractBox: boolean;
  distractModalHeight: number;
  showStuckRescueBox: boolean;
  showShortBreakPrompt: boolean;
  showContextEditBox: boolean;
  showWorkTopicBox: boolean;
  isEditingWorkTags: boolean;
  hasTagForm: boolean;
  workPrevReasonsCount: number;
  currentContext: string;
  recentContextsCount: number;
  updateStatusKind: UpdateStatus["kind"];
  sessionActive: boolean;
  isRunning: boolean;
  hasWorkElapsed: boolean;
  hasWorkPauseStart: boolean;
  hasReminderBanner: boolean;
  hasHyperfocusOffer: boolean;
  canShowBreakEndMood: boolean;
  isBreakAlarm: boolean;
  isHyperfocus: boolean;
  timerMode: TimerMode;
  showBreakParking: boolean;
  breakParkingLayout: { openRows: number; sections: number };
  breakParkingData: ParkingLotData;
  breakChecklistCount: number;
}

export function useWindowSizing({
  loaded,
  isMiniDock,
  page,
  theme,
  anyModalOpen,
  showDistractBox,
  distractModalHeight,
  showStuckRescueBox,
  showShortBreakPrompt,
  showContextEditBox,
  showWorkTopicBox,
  isEditingWorkTags,
  hasTagForm,
  workPrevReasonsCount,
  currentContext,
  recentContextsCount,
  updateStatusKind,
  sessionActive,
  isRunning,
  hasWorkElapsed,
  hasWorkPauseStart,
  hasReminderBanner,
  hasHyperfocusOffer,
  canShowBreakEndMood,
  isBreakAlarm,
  isHyperfocus,
  timerMode,
  showBreakParking,
  breakParkingLayout,
  breakParkingData,
  breakChecklistCount,
}: UseWindowSizingParams) {
  const [customSizes, setCustomSizes] = useState<CustomWindowSizes>({});
  const [currentWinSize, setCurrentWinSize] = useState<{
    w: number;
    h: number;
  }>({
    w: 315,
    h: 362,
  });
  const [sizeSavedFlash, setSizeSavedFlash] = useState(false);

  useEffect(() => {
    document.documentElement.style.zoom = "";
    if (!loaded) return;
    const scaleMult = Math.max(1, (theme.uiScale || 100) / 100);
    invoke("set_window_zoom", { zoom: scaleMult }).catch(() => {});
  }, [theme.uiScale, loaded]);

  useEffect(() => {
    if (!loaded || isMiniDock) return;
    const scaleMult = Math.max(1, (theme.uiScale || 100) / 100);
    const applyScaledSize = (baseW: number, baseH: number) => {
      void applyMonitorClampedWindowSize(baseW, baseH, scaleMult);
      setCurrentWinSize({ w: baseW, h: baseH });
    };

    if (anyModalOpen) {
      let modalW = 325;
      let modalH = 340;
      if (showDistractBox) {
        modalW = 370;
        modalH = distractModalHeight;
      } else if (showStuckRescueBox) {
        modalW = 340;
        modalH = 325;
      } else if (showShortBreakPrompt || showContextEditBox) {
        const hasChips = Boolean(currentContext || recentContextsCount > 0);
        modalW = 325;
        modalH = showContextEditBox
          ? hasChips
            ? 205
            : 165
          : hasChips
            ? 230
            : 190;
      } else if (showWorkTopicBox) {
        modalW = 330;
        modalH = hasTagForm
          ? 345
          : isEditingWorkTags
            ? 310
            : workPrevReasonsCount > 0
              ? 285
              : 248;
      }
      applyScaledSize(modalW, modalH);
      return;
    }

    const targetPage = page as SizeTargetPage;
    const custom = customSizes[targetPage];
    const hasBreakParking =
      targetPage === "timer" &&
      sessionActive &&
      timerMode === "break" &&
      showBreakParking &&
      breakParkingData.pendingTasks.length > 0;
    const hasPausedHint =
      targetPage === "timer" &&
      sessionActive &&
      !isRunning &&
      timerMode === "work" &&
      (hasWorkElapsed || hasWorkPauseStart);
    const hasTimerReminder = targetPage === "timer" && hasReminderBanner;

    const showHyperfocusStrip = timerMode === "break" && hasHyperfocusOffer;
    const showMoodStrip =
      timerMode === "break" && !showHyperfocusStrip && canShowBreakEndMood;
    const showChecklistStrip =
      timerMode === "break" &&
      !isBreakAlarm &&
      !showHyperfocusStrip &&
      !showMoodStrip &&
      breakChecklistCount > 0;
    const breakAuxStripH = showHyperfocusStrip
      ? 38
      : showMoodStrip
        ? 88
        : showChecklistStrip
          ? 28
          : 0;

    const timerMinW = DEFAULT_WINDOW_SIZES.timer.width;
    const timerMinH =
      DEFAULT_WINDOW_SIZES.timer.height +
      (theme.timerStyle !== "digital" ? 42 : 0) +
      (hasPausedHint ? 18 : 0) +
      (hasTimerReminder ? 26 : 0) +
      (timerMode === "work" && isHyperfocus ? 24 : 0) +
      breakAuxStripH +
      (isBreakAlarm ? 24 : 0);
    const breakPanelH =
      156 +
      Math.max(1, breakParkingLayout.sections) * 26 +
      Math.min(5, breakParkingLayout.openRows) * 33 +
      breakAuxStripH +
      (isBreakAlarm ? 24 : 0);

    if (custom) {
      const w = hasBreakParking
        ? Math.max(custom.width, 345)
        : targetPage === "timer"
          ? Math.max(custom.width, timerMinW)
          : custom.width;
      const h = hasBreakParking
        ? Math.max(custom.height, breakPanelH)
        : targetPage === "timer"
          ? Math.max(custom.height, timerMinH)
          : custom.height;
      applyScaledSize(w, h);
      return;
    }

    if (page === "menu") {
      const hasBanner =
        updateStatusKind === "available" || updateStatusKind === "downloading";
      const baseMenuH = sessionActive
        ? DEFAULT_WINDOW_SIZES.menu.height - 84
        : DEFAULT_WINDOW_SIZES.menu.height;
      const h = hasBanner ? baseMenuH + 35 : baseMenuH;
      applyScaledSize(DEFAULT_WINDOW_SIZES.menu.width, h);
    } else if (page === "dashboard") {
      applyScaledSize(
        DEFAULT_WINDOW_SIZES.dashboard.width,
        DEFAULT_WINDOW_SIZES.dashboard.height,
      );
    } else if (page === "summary") {
      applyScaledSize(
        DEFAULT_WINDOW_SIZES.summary.width,
        DEFAULT_WINDOW_SIZES.summary.height,
      );
    } else if (page === "settings") {
      applyScaledSize(
        DEFAULT_WINDOW_SIZES.settings.width,
        DEFAULT_WINDOW_SIZES.settings.height,
      );
    } else {
      const w = hasBreakParking ? 345 : timerMinW;
      const h = hasBreakParking ? breakPanelH : timerMinH;
      applyScaledSize(w, h);
    }
  }, [
    page,
    anyModalOpen,
    showDistractBox,
    distractModalHeight,
    showStuckRescueBox,
    showShortBreakPrompt,
    showContextEditBox,
    showWorkTopicBox,
    isEditingWorkTags,
    hasTagForm,
    workPrevReasonsCount,
    currentContext,
    recentContextsCount,
    loaded,
    updateStatusKind,
    isMiniDock,
    customSizes,
    sessionActive,
    isRunning,
    hasWorkElapsed,
    hasWorkPauseStart,
    hasReminderBanner,
    hasHyperfocusOffer,
    canShowBreakEndMood,
    isBreakAlarm,
    isHyperfocus,
    timerMode,
    showBreakParking,
    breakParkingLayout.openRows,
    breakParkingLayout.sections,
    breakParkingData.pendingTasks.length,
    breakParkingData.unratedIdeas.length,
    breakChecklistCount,
    theme.uiScale,
    theme.timerStyle,
  ]);

  const handleSaveCurrentWindowSize = async () => {
    const win = getCurrentWindow();
    const factor = await win.scaleFactor();
    const size = await win.innerSize();
    const mult = Math.max(1, (theme.uiScale || 100) / 100);
    const w = Math.max(220, Math.round(size.width / factor / mult));
    const h = Math.max(110, Math.round(size.height / factor / mult));
    const targetPage = page as SizeTargetPage;
    const updated: CustomWindowSizes = {
      ...customSizes,
      [targetPage]: { width: w, height: h },
    };
    setCustomSizes(updated);
    setCurrentWinSize({ w, h });
    await saveCustomWindowSizes(updated);
    setSizeSavedFlash(true);
    setTimeout(() => setSizeSavedFlash(false), 1800);
  };

  const handleResetStandardSizes = async () => {
    setCustomSizes({});
    await resetCustomWindowSizes();
    const targetPage = page as SizeTargetPage;
    const std = DEFAULT_WINDOW_SIZES[targetPage] || DEFAULT_WINDOW_SIZES.menu;
    const mult = Math.max(1, (theme.uiScale || 100) / 100);
    await applyMonitorClampedWindowSize(std.width, std.height, mult);
    setCurrentWinSize({ w: std.width, h: std.height });
  };

  return {
    customSizes,
    setCustomSizes,
    currentWinSize,
    setCurrentWinSize,
    sizeSavedFlash,
    handleSaveCurrentWindowSize,
    handleResetStandardSizes,
  };
}
