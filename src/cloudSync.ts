import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CloudAuthState,
  ParkingItem,
  ParkingLotData,
  exportUserCloudSnapshot,
  getPendingSyncCount,
  getPendingSyncQueue,
  loadCloudAuthState,
  markParkingItemsKeepSynced,
  mergeRemoteSnapshotToLocal,
  removeSyncedQueueIds,
  saveCloudAuthState,
} from "./db";

export interface SyncStatusResult {
  ok: boolean;
  offline: boolean;
  pendingCount: number;
  syncedCount: number;
  lastSyncAt: string | null;
  message: string;
}

export interface DocsSyncResult {
  ok: boolean;
  syncedCount: number;
  method: "google_docs_api" | "web_bridge";
  message: string;
  docUrl?: string;
  documentId?: string;
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

async function googleJsonFetch(
  url: string,
  accessToken: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  let body: string | undefined;
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  return fetch(url, {
    method: init?.method || "GET",
    headers,
    body,
  });
}

/**
 * Google OAuth Access Token ile Google kullanıcı bilgilerini doğrular
 * veya hızlı Google hesabı girişi yapar ve sunucuda oturum açar.
 */
export async function signInWithGoogleAccount(params: {
  email?: string;
  name?: string;
  accessToken?: string;
  serverUrl?: string;
  googleClientId?: string;
}): Promise<{ ok: boolean; auth: CloudAuthState; message: string }> {
  const current = await loadCloudAuthState();
  const serverUrl = (params.serverUrl || current.serverUrl || "http://localhost:4000")
    .trim()
    .replace(/\/+$/, "");
  const accessToken = (params.accessToken ?? current.accessToken ?? "").trim();

  let email = (params.email ?? current.email ?? "").trim().toLowerCase();
  let name = (params.name ?? current.name ?? "").trim();
  let picture = current.picture || "";
  let googleSub = "";

  if (accessToken) {
    try {
      const resp = await googleJsonFetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        accessToken,
      );
      if (resp.ok) {
        const info = await resp.json();
        if (info.email) email = String(info.email).toLowerCase();
        if (info.name) name = String(info.name);
        if (info.picture) picture = String(info.picture);
        if (info.sub) googleSub = String(info.sub);
      }
    } catch {
      // İnternet yoksa yerel bilgiyle devam et
    }
  }

  if (!email) {
    return {
      ok: false,
      auth: current,
      message: "Lütfen Google e-posta adresinizi veya OAuth Access Token girin.",
    };
  }

  if (!name) {
    const localPart = email.split("@")[0] || "Kullanıcı";
    name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  const userId =
    googleSub ||
    "usr_" +
      email
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 48);

  const nextAuth: CloudAuthState = {
    ...current,
    userId,
    email,
    name,
    picture,
    accessToken,
    serverUrl,
    googleClientId: params.googleClientId ?? current.googleClientId ?? "",
  };

  try {
    const res = await fetch(`${serverUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, name, picture, accessToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.user?.userId) {
        nextAuth.userId = data.user.userId;
      }
    }
  } catch {
    // Sunucu kapalı veya internet yoksa çevrimdışı oturum açılır
  }

  await saveCloudAuthState(nextAuth);
  return {
    ok: true,
    auth: nextAuth,
    message: `${email} ile giriş yapıldı.`,
  };
}

export async function signOutGoogleAccount(): Promise<CloudAuthState> {
  const current = await loadCloudAuthState();
  const cleared: CloudAuthState = {
    ...current,
    userId: "",
    email: "",
    name: "",
    picture: "",
    accessToken: "",
  };
  await saveCloudAuthState(cleared);
  return cleared;
}

/**
 * İnternet yokken SQLite `sync_queue` tablosunda biriken tüm verileri ve
 * kullanıcı anlık görüntüsünü sunucuya (`POST /api/sync`) gönderir,
 * sunucudaki kullanıcı verileriyle birleştirir.
 */
export async function syncWithCloudServer(): Promise<SyncStatusResult> {
  const auth = await loadCloudAuthState();
  const pendingQueue = await getPendingSyncQueue(200);

  if (!auth.userId || !auth.email) {
    return {
      ok: false,
      offline: false,
      pendingCount: pendingQueue.length,
      syncedCount: 0,
      lastSyncAt: auth.lastSyncAt,
      message: "Sunucu senkronizasyonu için önce Google hesabınızla giriş yapın.",
    };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      offline: true,
      pendingCount: pendingQueue.length,
      syncedCount: 0,
      lastSyncAt: auth.lastSyncAt,
      message: `Çevrimdışı: ${pendingQueue.length} kayıt kuyrukta, internet gelince otomatik gönderilecek.`,
    };
  }

  try {
    const snapshot = await exportUserCloudSnapshot();
    const mutations = pendingQueue.map((q) => {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(q.payload_json);
      } catch {
        parsed = {};
      }
      return {
        queueId: q.id,
        entityType: q.entity_type,
        payload: parsed,
        createdAt: q.created_at,
      };
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    const resp = await fetch(`${auth.serverUrl}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": auth.userId,
      },
      body: JSON.stringify({
        user: {
          userId: auth.userId,
          email: auth.email,
          name: auth.name,
          picture: auth.picture,
        },
        mutations,
        snapshot,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const result = await resp.json();
    const syncedIds = pendingQueue.map((q) => q.id);
    if (syncedIds.length > 0) {
      await removeSyncedQueueIds(syncedIds);
    }

    if (result?.mergedSnapshot) {
      await mergeRemoteSnapshotToLocal(result.mergedSnapshot);
    }

    const nowIso = new Date().toISOString();
    await saveCloudAuthState({ ...auth, lastSyncAt: nowIso });

    const remaining = await getPendingSyncCount();
    return {
      ok: true,
      offline: false,
      pendingCount: remaining,
      syncedCount: syncedIds.length,
      lastSyncAt: nowIso,
      message:
        syncedIds.length > 0
          ? `${syncedIds.length} bekleyen kayıt sunucuya senkronize edildi.`
          : "Tüm veriler sunucu ile güncel.",
    };
  } catch {
    return {
      ok: false,
      offline: true,
      pendingCount: pendingQueue.length,
      syncedCount: 0,
      lastSyncAt: auth.lastSyncAt,
      message: `Sunucuya ulaşılamadı (${pendingQueue.length} kayıt çevrimdışı kuyrukta bekliyor).`,
    };
  }
}

/**
 * Görevleri, fikirleri ve ekran notlarını Google Docs için okunaklı bir
 * odak günlüğü metnine dönüştürür.
 */
export function formatParkingForGoogleDocs(
  parking: ParkingLotData,
  singleItem?: ParkingItem,
): { title: string; bodyText: string; items: ParkingItem[]; hasScreenshots: boolean } {
  const dateStr = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const divider = "────────────────────────────────────────────────────────────";

  if (singleItem) {
    const isTask = singleItem.item_type === "task";
    const isSS = singleItem.item_type === "screenshot";
    const headerTitle = isTask
      ? singleItem.status === "done"
        ? "✅ TAMAMLANAN GÖREV"
        : "⚡ YAPILACAK DÜRTÜSEL GÖREV"
      : isSS
        ? "📸 EKRAN GÖRÜNTÜSÜ NOTU"
        : singleItem.status === "important"
          ? "⭐ ÖNEMLİ FİKİR"
          : "💡 AKLA GELEN FİKİR";

    const lines: string[] = [
      divider,
      `📅 ${dateStr}, ${timeStr} — ${headerTitle}`,
      divider,
      `${isTask ? (singleItem.status === "done" ? "☑ [X]" : "☐ [ ]") : "•"} ${singleItem.content}`,
    ];

    if (singleItem.context_text) {
      lines.push(`   🎯 Meşguliyet (Context): ${singleItem.context_text}`);
    }
    if (singleItem.active_app || singleItem.active_window) {
      lines.push(
        `   🪟 Aktif Pencere: ${[singleItem.active_app, singleItem.active_window].filter(Boolean).join(" — ")}`,
      );
    }
    lines.push("");

    return {
      title: `🎯 Pomodoro Odak Kaydı (${dateStr})`,
      bodyText: lines.join("\n"),
      items: [singleItem],
      hasScreenshots: Boolean(singleItem.screenshot_data),
    };
  }

  const lines: string[] = [
    divider,
    `📅 ${dateStr}, ${timeStr} — POMODORO ODAK & FİKİR KAYDI`,
    divider,
    "",
  ];
  const allItems: ParkingItem[] = [];

  if (parking.pendingTasks.length > 0) {
    lines.push("⏳ YAPILACAK GÖREVLER (Unfinished Tasks):");
    for (const t of parking.pendingTasks) {
      const ctx = t.context_text ? ` [🎯 ${t.context_text}]` : "";
      const win = t.active_app ? ` (🪟 ${t.active_app})` : "";
      lines.push(`  ☐ ${t.content}${ctx}${win}`);
      allItems.push(t);
    }
    lines.push("");
  }

  if (parking.doneTasks.length > 0) {
    lines.push("✅ TAMAMLANAN GÖREVLER (Finished Tasks):");
    for (const t of parking.doneTasks) {
      lines.push(`  ☑ ${t.content}`);
      allItems.push(t);
    }
    lines.push("");
  }

  const allIdeas = [
    ...parking.importantIdeas,
    ...parking.unratedIdeas,
    ...parking.unimportantIdeas,
  ];
  if (allIdeas.length > 0) {
    lines.push("💡 AKLA GELEN FİKİRLER & DÜŞÜNCELER:");
    for (const idea of allIdeas) {
      const badge =
        idea.status === "important"
          ? "⭐ [ÖNEMLİ] "
          : idea.status === "unimportant"
            ? "💤 [Önemsiz] "
            : "💡 ";
      const ctx = idea.context_text ? ` [🎯 ${idea.context_text}]` : "";
      lines.push(`  • ${badge}${idea.content}${ctx}`);
      allItems.push(idea);
    }
    lines.push("");
  }

  let hasScreenshots = false;
  if (parking.screenshotNotes && parking.screenshotNotes.length > 0) {
    hasScreenshots = true;
    lines.push("📸 EKRAN GÖRÜNTÜSÜ NOTLARI:");
    for (const s of parking.screenshotNotes) {
      const win = [s.active_app, s.active_window].filter(Boolean).join(" — ");
      lines.push(`  • 📸 ${s.content}${win ? ` [🪟 ${win}]` : ""}`);
      allItems.push(s);
    }
    lines.push("");
  }

  return {
    title: `🎯 Pomodoro Odak & Fikir Defteri (${dateStr})`,
    bodyText: lines.join("\n").trim() + "\n\n",
    items: allItems,
    hasScreenshots,
  };
}

/**
 * Base64 JPEG/PNG ekran görüntüsünü kullanıcının kendi Google Drive'ına
 * özel (private) olarak multipart upload ile yükler.
 */
export async function uploadScreenshotToGoogleDrive(
  accessToken: string,
  screenshotDataUrl: string,
  title: string,
): Promise<{ fileId: string; webViewLink: string } | null> {
  try {
    const parts = screenshotDataUrl.split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = parts[1];

    const safeTitle = (title || "pomodoro_ss")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const filename = `${safeTitle}_${Date.now()}.${mimeType.includes("png") ? "png" : "jpg"}`;

    const metadata = {
      name: filename,
      mimeType,
      description: "Pomodoro Odak Defteri ekran görüntüsü notu",
    };

    const boundary = "-------PomodoroDriveBoundary" + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      base64Data +
      closeDelim;

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    );

    if (!res.ok) return null;

    const file = await res.json();
    const fileId = file.id;
    return {
      fileId,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    };
  } catch (err) {
    console.error("[GoogleDrive] Ekran görüntüsü yüklenemedi:", err);
    return null;
  }
}

/**
 * Kullanıcının Google Drive'ında "🎯 Pomodoro Odak & Fikir Defteri" adında
 * bir doküman arar. Varsa id'sini döner, yoksa yeni oluşturur.
 */
export async function findOrCreateGoogleDoc(
  accessToken: string,
  cachedDocId?: string | null,
): Promise<{ documentId: string; docUrl: string; isNew: boolean }> {
  const docTitle = "🎯 Pomodoro Odak & Fikir Defteri";

  if (cachedDocId) {
    try {
      const checkResp = await googleJsonFetch(
        `https://docs.googleapis.com/v1/documents/${cachedDocId}?fields=documentId,title`,
        accessToken,
      );
      if (checkResp.ok) {
        const checkData = await checkResp.json();
        if (checkData.documentId) {
          return {
            documentId: checkData.documentId,
            docUrl: `https://docs.google.com/document/d/${checkData.documentId}/edit`,
            isNew: false,
          };
        }
      }
    } catch {
      // Önbellek geçerli değil, Drive aramasından devam et
    }
  }

  try {
    const q = encodeURIComponent(
      `name='${docTitle}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
    );
    const searchResp = await googleJsonFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=1`,
      accessToken,
    );

    if (searchResp.ok) {
      const searchData = await searchResp.json();
      if (Array.isArray(searchData.files) && searchData.files.length > 0) {
        const found = searchData.files[0];
        return {
          documentId: found.id,
          docUrl: found.webViewLink || `https://docs.google.com/document/d/${found.id}/edit`,
          isNew: false,
        };
      }
    }
  } catch {
    // Drive araması başarısız olursa oluşturmayı dene
  }

  const createResp = await googleJsonFetch(
    "https://docs.googleapis.com/v1/documents",
    accessToken,
    { method: "POST", body: { title: docTitle } },
  );

  if (!createResp.ok) {
    throw new Error(`Google Docs API hatası (HTTP ${createResp.status})`);
  }

  const newDoc = await createResp.json();
  const documentId = newDoc.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  try {
    const welcomeText =
      "🎯 POMODORO ODAK & FİKİR DEFTERİ\n" +
      "Bu doküman, Pomodoro Widget tarafından çalışma seanslarınızda aldığınız dürtüsel görevleri,\n" +
      "akla gelen fikirleri ve ekran görüntüsü notlarını canlı olarak depolar.\n\n";

    await googleJsonFetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      accessToken,
      {
        method: "POST",
        body: {
          requests: [
            {
              insertText: {
                endOfSegmentLocation: { segmentId: "" },
                text: welcomeText,
              },
            },
          ],
        },
      },
    );
  } catch {
    // Başlık eklenemese bile doküman oluşturuldu
  }

  return { documentId, docUrl, isNew: true };
}

/**
 * Görevleri, fikirleri ve SS ekran görüntülerini resmi Google Docs ve Drive REST API
 * aracılığıyla kullanıcının "🎯 Pomodoro Odak & Fikir Defteri" dokümanına otomatik kaydeder.
 */
export async function syncParkingToGoogleDocs(
  parking: ParkingLotData,
  options?: {
    singleItem?: ParkingItem;
    openBrowserIfNoToken?: boolean;
    openDocument?: boolean;
  },
): Promise<DocsSyncResult> {
  const auth = await loadCloudAuthState();
  const formatted = formatParkingForGoogleDocs(parking, options?.singleItem);
  const itemIds = formatted.items.map((i) => i.id);

  try {
    await navigator.clipboard.writeText(`${formatted.title}\n\n${formatted.bodyText}`);
  } catch {
    // clipboard izni yoksa devam et
  }

  if (auth.accessToken) {
    try {
      const { documentId, docUrl } = await findOrCreateGoogleDoc(
        auth.accessToken,
        auth.googleDocId,
      );

      let appendText = formatted.bodyText;
      for (const item of formatted.items) {
        if (item.screenshot_data) {
          const driveFile = await uploadScreenshotToGoogleDrive(
            auth.accessToken,
            item.screenshot_data,
            `SS_${item.content.slice(0, 24)}`,
          );
          if (driveFile) {
            appendText += `📸 Ekran Notu ("${item.content}") Google Drive Bağlantısı:\n   🔗 ${driveFile.webViewLink}\n\n`;
          }
        }
      }

      const updateResp = await googleJsonFetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        auth.accessToken,
        {
          method: "POST",
          body: {
            requests: [
              {
                insertText: {
                  endOfSegmentLocation: { segmentId: "" },
                  text: appendText,
                },
              },
            ],
          },
        },
      );

      if (!updateResp.ok) {
        throw new Error(`HTTP ${updateResp.status}`);
      }

      await saveCloudAuthState({
        ...auth,
        googleDocId: documentId,
        googleDocUrl: docUrl,
        lastSyncAt: new Date().toISOString(),
      });
      await markParkingItemsKeepSynced(itemIds, docUrl);

      if (options?.openDocument !== false) {
        await openExternalUrl(docUrl);
      }

      return {
        ok: true,
        syncedCount: itemIds.length,
        method: "google_docs_api",
        documentId,
        docUrl,
        message: `Google Docs "🎯 Pomodoro Odak & Fikir Defteri"ne ${itemIds.length} kayıt eklendi!`,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        syncedCount: 0,
        method: "google_docs_api",
        message: `Google Docs API hatası (${reason}). İçerik panoya kopyalandı; Access Token süresini kontrol edin.`,
      };
    }
  }

  const createDocUrl = "https://docs.google.com/document/create";
  if (options?.openBrowserIfNoToken !== false) {
    await openExternalUrl(createDocUrl);
  }

  return {
    ok: false,
    syncedCount: 0,
    method: "web_bridge",
    docUrl: createDocUrl,
    message:
      "Google OAuth Access Token girilmediği için içerik panoya kopyalandı ve Google Docs açıldı (Ctrl+V). Otomatik kayıt için Dashboard'dan Access Token ekleyin.",
  };
}
