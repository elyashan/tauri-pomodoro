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
  method: "google_docs_api" | "server_docs" | "web_bridge";
  message: string;
  docUrl?: string;
  documentId?: string;
}

export type KeepSyncResult = DocsSyncResult;

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

  // Eğer Google OAuth Access Token girilmişse doğrudan Google UserInfo API'den doğrula
  if (accessToken) {
    try {
      const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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

  // Sunucuya da kayıt / giriş bildir
  try {
    const res = await fetch(`${serverUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        name,
        picture,
        accessToken,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.user?.userId) {
        nextAuth.userId = data.user.userId;
      }
    }
  } catch {
    // Sunucu şu an kapalı veya internet yoksa çevrimdışı oturum açılır, internet gelince senkronize olur
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
      let parsed: any = {};
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
    const updatedAuth: CloudAuthState = {
      ...auth,
      lastSyncAt: nowIso,
    };
    await saveCloudAuthState(updatedAuth);

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
 * Görevleri, fikirleri ve ekran notlarını Google Docs için okunaklı, profesyonel bir
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
      ? (singleItem.status === "done" ? "✅ TAMAMLANAN GÖREV" : "⚡ YAPILACAK DÜRTÜSEL GÖREV")
      : isSS
        ? "📸 EKRAN GÖRÜNTÜSÜ NOTU"
        : (singleItem.status === "important" ? "⭐ ÖNEMLİ FİKİR" : "💡 AKLA GELEN FİKİR");

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

export const formatParkingForGoogleKeep = formatParkingForGoogleDocs;

/**
 * Base64 JPEG/PNG ekran görüntüsünü Google Drive'a multipart upload ile yükler.
 * Dokümanda tıklanabilir veya gömülebilir Drive görüntü bağlantısı oluşturur.
 */
export async function uploadScreenshotToGoogleDrive(
  accessToken: string,
  screenshotDataUrl: string,
  title: string,
): Promise<{ fileId: string; webViewLink: string; webContentLink?: string } | null> {
  try {
    const parts = screenshotDataUrl.split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = parts[1];

    const safeTitle = (title || "pomodoro_ss")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 40);
    const filename = `${safeTitle}_${Date.now()}.${mimeType.includes("png") ? "png" : "jpg"}`;

    const metadata = {
      name: filename,
      mimeType,
      description: "Pomodoro Odak Defteri ekran görüntüsü notu",
    };

    const boundary = "-------PomodoroDriveBoundary" + Math.random().toString(36).substring(2);
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

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
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    );

    if (!res.ok) {
      return null;
    }

    const file = await res.json();
    const fileId = file.id;
    const webViewLink = file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    // Dosyayı kullanıcı oturumu veya bağlantısı olan herkes için okunabilir yap
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch {
      // İzin verilemezse bile bağlantı kalır
    }

    return {
      fileId,
      webViewLink,
      webContentLink: file.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
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

  // 1. Önce önbellekteki docId geçerli mi kontrol et
  if (cachedDocId) {
    try {
      const checkResp = await fetch(
        `https://docs.googleapis.com/v1/documents/${cachedDocId}?fields=documentId,title`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
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

  // 2. Google Drive'da ara
  try {
    const q = encodeURIComponent(`name='${docTitle}' and mimeType='application/vnd.google-apps.document' and trashed=false`);
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
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

  // 3. Bulunamadıysa yeni Google Doc oluştur
  const createResp = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: docTitle }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    throw new Error(`Google Docs oluşturulamadı (${createResp.status}): ${errText}`);
  }

  const newDoc = await createResp.json();
  const documentId = newDoc.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // Yeni dokümana başlık ve hoş geldiniz metni ekle
  try {
    const welcomeText =
      "🎯 POMODORO ODAK & FİKİR DEFTERİ\n" +
      "Bu doküman, Pomodoro Widget tarafından çalışma seanslarınızda aldığınız dürtüsel görevleri,\n" +
      "akla gelen fikirleri ve ekran görüntüsü notlarını canlı olarak depolar.\n\n";

    await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              endOfSegmentLocation: { segmentId: "" },
              text: welcomeText,
            },
          },
        ],
      }),
    });
  } catch {
    // Başlık eklenemese bile doküman oluşturuldu
  }

  return {
    documentId,
    docUrl,
    isNew: true,
  };
}

/**
 * Görevleri, fikirleri ve SS ekran görüntülerini resmi Google Docs ve Drive REST API
 * aracılığıyla kullanıcının "🎯 Pomodoro Odak & Fikir Defteri" dokümanına otomatik kaydeder.
 *
 * 1) Google OAuth Access Token varsa:
 *    - Google Drive'da "🎯 Pomodoro Odak & Fikir Defteri" dokümanını bulur veya oluşturur.
 *    - Varsa ekran görüntülerini doğrudan Google Drive'a yükler ve bağlantılarını ekler.
 *    - Görevleri (yapılacak/yapılan) ve fikirleri (önemli/önemsiz) dokümana ekler.
 *    - Tarayıcıda bu canlı dokümanı doğrudan açar.
 * 2) Token yoksa sunucu köprüsü (`/api/docs/sync`) veya panoya kopyalayıp Google Docs açma modunu kullanır.
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

  // Panoya her durumda yedek olarak kopyala
  try {
    await navigator.clipboard.writeText(`${formatted.title}\n\n${formatted.bodyText}`);
  } catch {
    // clipboard izni yoksa devam et
  }

  // 1. Resmi Google Docs & Drive REST API Entegrasyonu
  if (auth.accessToken) {
    try {
      const { documentId, docUrl } = await findOrCreateGoogleDoc(
        auth.accessToken,
        auth.googleDocId,
      );

      // Ekran görüntüleri varsa Google Drive'a yükle ve bağlantılarını metne ekle
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

      // Google Docs batchUpdate ile dokümanın sonuna ekle
      const updateResp = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  endOfSegmentLocation: { segmentId: "" },
                  text: appendText,
                },
              },
            ],
          }),
        },
      );

      if (updateResp.ok) {
        // Durumu ve doküman ID'sini kaydet
        const nextAuth: CloudAuthState = {
          ...auth,
          googleDocId: documentId,
          googleDocUrl: docUrl,
          lastSyncAt: new Date().toISOString(),
        };
        await saveCloudAuthState(nextAuth);
        await markParkingItemsKeepSynced(itemIds, docUrl);

        if (options?.openDocument !== false) {
          try {
            await openUrl(docUrl);
          } catch {
            window.open(docUrl, "_blank");
          }
        }

        return {
          ok: true,
          syncedCount: itemIds.length,
          method: "google_docs_api",
          documentId,
          docUrl,
          message: `Google Docs "🎯 Pomodoro Odak & Fikir Defteri"ne ${itemIds.length} kayıt ve ekran resimleri kaydedildi!`,
        };
      }
    } catch (err: any) {
      console.warn("[GoogleDocs] Doğrudan API çağrısı başarısız, sunucuya geçiliyor:", err);
    }
  }

  // 2. Sunucu Köprüsü (`/api/docs/sync`)
  if (auth.serverUrl) {
    try {
      const sResp = await fetch(`${auth.serverUrl}/api/docs/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.userId || "local_user",
          email: auth.email,
          accessToken: auth.accessToken,
          title: formatted.title,
          textToAppend: formatted.bodyText,
          items: formatted.items,
        }),
      });

      if (sResp.ok) {
        const sData = await sResp.json();
        const docUrl = sData.docUrl || auth.googleDocUrl || "https://docs.google.com/";
        await markParkingItemsKeepSynced(itemIds, docUrl);

        if (options?.openDocument !== false && docUrl) {
          try {
            await openUrl(docUrl);
          } catch {
            window.open(docUrl, "_blank");
          }
        }

        return {
          ok: true,
          syncedCount: itemIds.length,
          method: "server_docs",
          docUrl,
          message:
            sData.message ||
            `${itemIds.length} kayıt sunucu ve Google Docs Odak Defteri'ne aktarıldı.`,
        };
      }
    } catch {
      // Sunucuya ulaşılamazsa web köprüsüne geç
    }
  }

  // 3. Web Köprüsü: Not panoya kopyalandı + Google Docs aç
  const createDocUrl = "https://docs.google.com/document/create";
  await markParkingItemsKeepSynced(itemIds, "docs_clipboard_bridge");

  if (options?.openBrowserIfNoToken !== false) {
    try {
      await openUrl(createDocUrl);
    } catch {
      window.open(createDocUrl, "_blank");
    }
  }

  return {
    ok: true,
    syncedCount: itemIds.length,
    method: "web_bridge",
    docUrl: createDocUrl,
    message:
      "Görevler, fikirler ve notlar panoya kopyalandı ve Google Docs açıldı (Ctrl+V ile yapıştırabilirsiniz). Doğrudan otomatik kayıt için Ayarlar'dan Google OAuth Access Token ekleyin.",
  };
}

/**
 * Geriye uyumluluk için alias
 */
export const syncParkingToGoogleKeep = syncParkingToGoogleDocs;
