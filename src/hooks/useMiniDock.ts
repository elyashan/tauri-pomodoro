import { useRef, useState } from "react";
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

export function useMiniDock(options: UseMiniDockOptions) {
  const { uiScale, runtimeStateRef, onRevealTimerPage } = options;
  const [isMiniDock, setIsMiniDock] = useState(false);
  const isMiniDockRef = useRef<boolean>(false);
  isMiniDockRef.current = isMiniDock;
  const miniDockUserDraggedRef = useRef<boolean>(false);
  const savedNormalPosRef = useRef<{ x: number; y: number } | null>(null);

  const positionMiniDockWindow = async () => {
    try {
      bumpWindowResizeSeq();
      const win = getCurrentWindow();
      const scale = await win.scaleFactor();
      if (!isMiniDockRef.current) return;
      const uiMult = Math.max(1, (uiScale || 100) / 100);
      const miniW = Math.round(112 * uiMult);
      const miniH = Math.round(38 * uiMult);
      await win.setSize(new LogicalSize(miniW, miniH));
      if (!isMiniDockRef.current) return;
      const mon = await currentMonitor();
      if (!isMiniDockRef.current) return;
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
          if (!isMiniDockRef.current) return;
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
      if (!isMiniDockRef.current) return;
      await win.show();
    } catch (err) {
      console.error("Mini widget konumlandırılamadı:", err);
    }
  };

  const triggerMiniDockContextToast = (_customText?: string) => {
    // Mini-dock intentionally displays only the minimal timer pill without toast popups.
  };

  const enterMiniDock = async () => {
    try {
      const win = getCurrentWindow();
      if (!isMiniDockRef.current) {
        const pos = await win.outerPosition();
        savedNormalPosRef.current = { x: pos.x, y: pos.y };
      }
      miniDockUserDraggedRef.current = false;
      isMiniDockRef.current = true;
      setIsMiniDock(true);
      void positionMiniDockWindow();
    } catch (err) {
      console.error("Mini widget konumlandırılamadı:", err);
    }
  };

  const exitMiniDock = async () => {
    try {
      bumpWindowResizeSeq();
      miniDockUserDraggedRef.current = false;
      isMiniDockRef.current = false;
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

  return {
    isMiniDock,
    isMiniDockRef,
    miniDockUserDraggedRef,
    miniDockContextToast: null as string | null,
    triggerMiniDockContextToast,
    enterMiniDock,
    exitMiniDock,
    revealExpandedWindow,
    revealExpandedWindowRef,
  };
}
