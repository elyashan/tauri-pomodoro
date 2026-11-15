import { invoke } from "@tauri-apps/api/core";

export interface RawScreenshotPayload {
  dataUrl: string;
  activeApp: string;
  activeWindow: string;
}

/**
 * Rust tarafından yakalanan BMP/JPEG DataURL görüntüsünü HTML5 Canvas ile
 * hafif JPEG DataURL formatına sıkıştırır.
 */
export async function compressDataUrl(
  rawDataUrl: string,
  maxWidth = 800,
  quality = 0.72
): Promise<string> {
  if (!rawDataUrl) return "";
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sw = img.naturalWidth || img.width || 800;
        const sh = img.naturalHeight || img.height || 450;

        let targetW = sw;
        let targetH = sh;
        if (targetW > maxWidth) {
          targetH = Math.max(1, Math.round((sh * maxWidth) / sw));
          targetW = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, sw, sh, 0, 0, targetW, targetH);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed || rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve("");
    img.src = rawDataUrl;
  });
}

export async function captureScreenSnapshotRaw(
  fresh: boolean
): Promise<RawScreenshotPayload> {
  try {
    const res = await invoke<RawScreenshotPayload>("capture_screen_snapshot", { fresh });
    return {
      dataUrl: res?.dataUrl || "",
      activeApp: res?.activeApp || "",
      activeWindow: res?.activeWindow || "",
    };
  } catch {
    return { dataUrl: "", activeApp: "", activeWindow: "" };
  }
}

export async function captureScreenCompressed(
  fresh: boolean,
  _crop?: unknown,
  maxWidth = 760,
  quality = 0.7
): Promise<RawScreenshotPayload> {
  const raw = await captureScreenSnapshotRaw(fresh);
  if (!raw.dataUrl) return raw;
  const compressed = await compressDataUrl(raw.dataUrl, maxWidth, quality);
  return {
    dataUrl: compressed,
    activeApp: raw.activeApp,
    activeWindow: raw.activeWindow,
  };
}
