import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "downloading"; percent: number | null }
  | { kind: "error"; message: string };

// Bulunan güncelleme nesnesini sakla; kullanıcı "Güncelle" dediğinde tekrar sormaya gerek kalmasın
let pendingUpdate: Update | null = null;

export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const update = await check();
    if (!update) {
      pendingUpdate = null;
      return { kind: "up-to-date" };
    }
    pendingUpdate = update;
    return {
      kind: "available",
      version: update.version,
      notes: update.body ?? undefined,
    };
  } catch (err) {
    return { kind: "error", message: String(err) };
  }
}

/**
 * Güncellemeyi indirir, kurar ve uygulamayı yeniden başlatır.
 * `beforeInstall` kurulumdan hemen önce çağrılır (durumu kaydetmek için).
 * Windows'ta kurulum başladığında uygulama zaten kapanır, relaunch diğer
 * platformlar için yedektir.
 */
export async function installUpdate(
  onProgress: (status: UpdateStatus) => void,
  beforeInstall: () => Promise<void>,
): Promise<void> {
  if (!pendingUpdate) {
    const status = await checkForUpdate();
    if (status.kind !== "available") {
      onProgress(status);
      return;
    }
  }
  const update = pendingUpdate!;

  let total = 0;
  let downloaded = 0;
  onProgress({ kind: "downloading", percent: null });

  try {
    await update.download((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        onProgress({
          kind: "downloading",
          percent: total > 0 ? Math.round((downloaded / total) * 100) : null,
        });
      }
    });

    await beforeInstall();
    await update.install();
    await relaunch();
  } catch (err) {
    onProgress({ kind: "error", message: String(err) });
  }
}
