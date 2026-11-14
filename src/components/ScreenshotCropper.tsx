import React, { useRef, useState } from "react";
import type { CropRegionPct } from "../screenshot";

export function computePointerPct(
  e: React.MouseEvent<HTMLElement>,
  rect: DOMRect,
): { x: number; y: number } {
  const x = Math.max(
    0,
    Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
  );
  const y = Math.max(
    0,
    Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
  );
  return { x, y };
}

export function computeDragCropBox(
  start: { x: number; y: number },
  current: { x: number; y: number },
): CropRegionPct {
  return {
    xPct: Math.min(start.x, current.x),
    yPct: Math.min(start.y, current.y),
    wPct: Math.abs(current.x - start.x),
    hPct: Math.abs(current.y - start.y),
  };
}

export interface ScreenshotCropperProps {
  previewUrl: string;
  cropBox: CropRegionPct | null;
  onChangeCropBox: (next: CropRegionPct | null) => void;
  onRetake: () => void;
  cropHint: string;
  resetCropLabel: string;
  retakeLabel: string;
  emptyPlaceholder?: React.ReactNode;
  minCropPct?: number;
  onCropEnd?: () => void;
}

export function ScreenshotCropper({
  previewUrl,
  cropBox,
  onChangeCropBox,
  onRetake,
  cropHint,
  resetCropLabel,
  retakeLabel,
  emptyPlaceholder,
  minCropPct = 3.5,
  onCropEnd,
}: ScreenshotCropperProps) {
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = previewWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const pt = computePointerPct(e, rect);
    setDragStart(pt);
    onChangeCropBox({ xPct: pt.x, yPct: pt.y, wPct: 0, hPct: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const rect = previewWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const cur = computePointerPct(e, rect);
    onChangeCropBox(computeDragCropBox(dragStart, cur));
  };

  const handleMouseUp = () => {
    if (!dragStart) return;
    setDragStart(null);
    if (cropBox && (cropBox.wPct < minCropPct || cropBox.hPct < minCropPct)) {
      onChangeCropBox(null);
    }
    onCropEnd?.();
  };

  return (
    <div className="qc-ss-box">
      <div className="qc-ss-toolbar">
        <span className="qc-ss-hint">{cropHint}</span>
        <div className="qc-ss-actions" style={{ display: "flex", gap: "4px" }}>
          {cropBox && (
            <button
              type="button"
              className="qc-mini-btn"
              onClick={() => onChangeCropBox(null)}
            >
              {resetCropLabel}
            </button>
          )}
          <button type="button" className="qc-mini-btn" onClick={onRetake}>
            {retakeLabel}
          </button>
        </div>
      </div>

      {previewUrl ? (
        <div
          ref={previewWrapRef}
          className="qc-ss-preview-wrap"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={previewUrl}
            alt="Screenshot preview"
            className="qc-ss-img"
            draggable={false}
          />
          {cropBox && cropBox.wPct > 1 && cropBox.hPct > 1 && (
            <div
              className="qc-ss-crop-rect"
              style={{
                left: `${cropBox.xPct}%`,
                top: `${cropBox.yPct}%`,
                width: `${cropBox.wPct}%`,
                height: `${cropBox.hPct}%`,
              }}
            />
          )}
        </div>
      ) : (
        emptyPlaceholder || <div className="qc-ss-empty">📸 ...</div>
      )}
    </div>
  );
}
