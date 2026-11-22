import { useEffect, useRef, useState } from "react";
import type React from "react";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import type { RuntimeState } from "../db";
import { bumpWindowResizeSeq } from "../lib/windowResize";

export interface UseMiniDockOptions {
  loaded: boolean;
  uiScale: number;
  reminderBanner: { kind?: string; text: string } | null;
  runtimeStateRef: React.MutableRefObject<RuntimeState>;
  contextFallbackLabel: string;
  onRevealTimerPage: () => void;
}

export function useMiniDock({
  loaded,
  uiScale,
  reminderBanner,
  runtimeStateRef,
  contextFallbackLabel,
  onRevealTimerPage,
}: UseMiniDockOptions) {
  const [isMiniDock, setIsMiniDock] = useState(false);
  const isMiniDockRef = useRef<boolean>(false);
  isMiniDockRef.current = isMiniDock;
  const miniDockUserDraggedRef = useRef<boolean>(false);
  const [miniDockContextToast, setMiniDockContextToast] = useState<
    string | null
  >(null);
  const miniDockToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const savedNormalPosRef = useRef<{ x: number; y: number } | null>(null);

  const positionMiniDockWindow = async (withToast: boolean) => {
    try {
      bumpWindowResizeSeq();
      const win = getCurrentWindow();
      const scale = await win.scaleFactor();
      const uiMult = Math.max(1, (uiScale || 100) / 100);
      const miniW = Math.round((withToast ? 236 : 152) * uiMult);
      const miniH = Math.round((withToast ? 66 : 44) * uiMult);
      await win.setSize(new LogicalSize(miniW, miniH));
      const mon = await currentMonitor();
      if (mon) {
        const physW = Math.round(miniW * scale);
        const physH = Math.round(miniH * scale);
        if (!miniDockUserDraggedRef.current) {
          const targetX =
            mon.position.x + mon.size.width - physW - Math.round(14 * scale);
          const targetY =
            mon.position.y + mon.size.height - physH - Math.round(52 * scale);
          await win.setPosition(new PhysicalPosition(targetX, targetY));
        } else {
          const pos = await win.outerPosition();
          const minX = mon.position.x;
          const minY = mon.position.y;
          const maxX = Math.max(minX, mon.position.x + mon.size.width - physW);
          const maxY = Math.max(
            minY,
            mon.position.y + mon.size.height - physH,
          );
          const clampedX = Math.min(Math.max(pos.x, minX), maxX);
          const clampedY = Math.min(Math.max(pos.y, minY), maxY);
          if (clampedX !== pos.x || clampedY !== pos.y) {
            await win.setPosition(new PhysicalPosition(clampedX, clampedY));
          }
        }
      }
      await win.show();
    } catch (err) {
      console.error("Mini widget konumlandırılamadı:", err);
    }
  };

  const triggerMiniDockContextToast = (customText?: string) => {
    const rt = runtimeStateRef.current;
    const ctxText =
      customText?.trim() ||
      rt.currentContext.trim() ||
      (rt.workTag
        ? `${rt.workTag}${rt.workReason ? `: ${rt.workReason}` : ""}`
        : "");
    const displayToast = ctxText || contextFallbackLabel;
    setMiniDockContextToast(displayToast);
    if (miniDockToastTimerRef.current) {
      clearTimeout(miniDockToastTimerRef.current);
    }
    void positionMiniDockWindow(true);
    miniDockToastTimerRef.current = setTimeout(() => {
      setMiniDockContextToast(null);
      void positionMiniDockWindow(false);
    }, 6500);
  };

  const enterMiniDock = async () => {
    try {
      const win = getCurrentWindow();
      if (!isMiniDock) {
        const pos = await win.outerPosition();
        savedNormalPosRef.current = { x: pos.x, y: pos.y };
      }
      miniDockUserDraggedRef.current = false;
      setIsMiniDock(true);
      triggerMiniDockContextToast();
    } catch (err) {
      console.error("Mini widget konumlandırılamadı:", err);
    }
  };

  const exitMiniDock = async () => {
    try {
      if (miniDockToastTimerRef.current) {
        clearTimeout(miniDockToastTimerRef.current);
        miniDockToastTimerRef.current = null;
      }
      setMiniDockContextToast(null);
      miniDockUserDraggedRef.current = false;
      const win = getCurrentWindow();
      setIsMiniDock(false);
      await win.show();
      await win.unminimize().catch(() => {});
      if (savedNormalPosRef.current) {
        await win.setPosition(
          new PhysicalPosition(
            savedNormalPosRef.current.x,
            savedNormalPosRef.current.y,
          ),
        );
      }
      await win.setFocus().catch(() => {});
    } catch (err) {
      console.error("Pencere geri yüklenemedi:", err);
    }
  };

  const revealExpandedWindow = async () => {
    try {
      if (isMiniDockRef.current) {
        await exitMiniDock();
      } else {
        const win = getCurrentWindow();
        await win.show().catch(() => {});
        await win.unminimize().catch(() => {});
      }
      if (runtimeStateRef.current.sessionActive) {
        onRevealTimerPage();
      }
    } catch {
      // Ignore
    }
  };

  const revealExpandedWindowRef =
    useRef<() => Promise<void>>(revealExpandedWindow);
  revealExpandedWindowRef.current = revealExpandedWindow;

  useEffect(() => {
    if (!loaded || !isMiniDock || !reminderBanner) return;
    triggerMiniDockContextToast(reminderBanner.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderBanner, isMiniDock, loaded]);

  return {
    isMiniDock,
    isMiniDockRef,
    miniDockUserDraggedRef,
    miniDockContextToast,
    triggerMiniDockContextToast,
    enterMiniDock,
    exitMiniDock,
    revealExpandedWindow,
    revealExpandedWindowRef,
  };
}
