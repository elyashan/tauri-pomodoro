import { invoke } from "@tauri-apps/api/core";

export interface CropRegionPct {
  xPct: number; // 0..100
  yPct: number; // 0..100
  wPct: number; // 0..100
  hPct: number; // 0..100
}

export interface RawScreenshotPayload {
  dataUrl: string;
  activeApp: string;
  activeWindow: string;
}

/**
 * Rust tarafından yakalanan BMP/JPEG DataURL görüntüsünü HTML5 Canvas ile
 * isteğe bağlı kırpma (crop) uygulayarak hafif JPEG DataURL formatına sıkıştırır.
 */
export async function compressAndCropDataUrl(
  rawDataUrl: string,
  crop?: CropRegionPct | null,
  maxWidth = 800,
  quality = 0.72
): Promise<string> {
  if (!rawDataUrl) return "";
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width || 800;
        const srcH = img.naturalHeight || img.height || 450;

        let sx = 0;
        let sy = 0;
        let sw = srcW;
        let sh = srcH;

        if (
          crop &&
          crop.wPct > 2 &&
          crop.hPct > 2 &&
          (crop.xPct > 0.5 || crop.yPct > 0.5 || crop.wPct < 99.5 || crop.hPct < 99.5)
        ) {
          sx = Math.max(0, Math.min(srcW - 1, Math.round((crop.xPct / 100) * srcW)));
          sy = Math.max(0, Math.min(srcH - 1, Math.round((crop.yPct / 100) * srcH)));
          sw = Math.max(16, Math.min(srcW - sx, Math.round((crop.wPct / 100) * srcW)));
          sh = Math.max(16, Math.min(srcH - sy, Math.round((crop.hPct / 100) * srcH)));
        }

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
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
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

/**
 * Rust backend'den ekran görüntüsü + aktif pencere bilgisini alır ve JPEG olarak sıkıştırır.
 * @param fresh true ise o an yeni ekran görüntüsü alır, false ise kısayola basıldığı salisedeki önbelleği kullanır.
 */
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
  crop?: CropRegionPct | null,
  maxWidth = 760,
  quality = 0.7
): Promise<RawScreenshotPayload> {
  const raw = await captureScreenSnapshotRaw(fresh);
  if (!raw.dataUrl) return raw;
  const compressed = await compressAndCropDataUrl(raw.dataUrl, crop, maxWidth, quality);
  return {
    dataUrl: compressed,
    activeApp: raw.activeApp,
    activeWindow: raw.activeWindow,
  };
}
