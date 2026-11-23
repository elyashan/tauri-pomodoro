import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import {
  AppState,
  RuntimeState,
  saveAppState,
  saveRuntimeState,
} from "../db";

export function persistSnapshots(
  appState: AppState,
  runtimeState: RuntimeState,
): void {
  saveAppState(appState).catch((err) =>
    console.error("Durum kaydedilemedi:", err),
  );
  saveRuntimeState(runtimeState).catch((err) =>
    console.error("Çalışma zamanı durumu kaydedilemedi:", err),
  );
}

let latestWindowResizeSeq = 0;

export function bumpWindowResizeSeq(): number {
  latestWindowResizeSeq += 1;
  return latestWindowResizeSeq;
}

/**
 * Scales the main window by uiScale, clamps it to fit cleanly on the current
 * monitor (at most 85% width and 80% height), and nudges it onscreen if needed.
 */
export async function applyMonitorClampedWindowSize(
  baseW: number,
  baseH: number,
  scaleMult: number,
): Promise<void> {
  const seq = bumpWindowResizeSeq();
  const win = getCurrentWindow();
  let targetW = Math.round(baseW * scaleMult);
  let targetH = Math.round(baseH * scaleMult);
  try {
    const [mon, factor, curInner] = await Promise.all([
      currentMonitor(),
      win.scaleFactor(),
      win.innerSize(),
    ]);
    if (seq !== latestWindowResizeSeq) return;
    if (mon) {
      const monLogW = mon.size.width / factor;
      const monLogH = mon.size.height / factor;
      const maxW = Math.max(280, Math.floor(monLogW * 0.85));
      const maxH = Math.max(180, Math.floor(monLogH * 0.8));
      targetW = Math.min(targetW, maxW);
      targetH = Math.min(targetH, maxH);
      const curLogW = Math.round(curInner.width / factor);
      const curLogH = Math.round(curInner.height / factor);
      if (Math.abs(curLogW - targetW) <= 1 && Math.abs(curLogH - targetH) <= 1) {
        return;
      }
      await win.setSize(new LogicalSize(targetW, targetH));
      if (seq !== latestWindowResizeSeq) return;
      const pos = await win.outerPosition();
      if (seq !== latestWindowResizeSeq) return;
      const physW = Math.round(targetW * factor);
      const physH = Math.round(targetH * factor);
      const minX = mon.position.x;
      const minY = mon.position.y;
      const maxX = Math.max(minX, mon.position.x + mon.size.width - physW);
      const maxY = Math.max(minY, mon.position.y + mon.size.height - physH);
      const clampedX = Math.min(Math.max(pos.x, minX), maxX);
      const clampedY = Math.min(Math.max(pos.y, minY), maxY);
      if (clampedX !== pos.x || clampedY !== pos.y) {
        await win.setPosition(new PhysicalPosition(clampedX, clampedY));
      }
      return;
    }
    await win.setSize(new LogicalSize(targetW, targetH));
  } catch {
    if (seq === latestWindowResizeSeq) {
      win.setSize(new LogicalSize(targetW, targetH)).catch(() => {});
    }
  }
}
