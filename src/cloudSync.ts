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

export interface KeepSyncResult {
  ok: boolean;
  syncedCount: number;
  method: "keep_api" | "tasks_api" | "server_keep" | "web_bridge";
  message: string;
  noteUrl?: string;
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
 * Görevleri ve düşünceleri (Parking Lot) Google Keep için okunaklı bir not/kontrol listesi metnine dönüştürür.
 */
export function formatParkingForGoogleKeep(
  parking: ParkingLotData,
  singleItem?: ParkingItem,
): { title: string; bodyText: string; items: ParkingItem[] } {
  const dateStr = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (singleItem) {
    const typeLabel =
      singleItem.item_type === "task"
        ? "⚡ Dürtüsel Görev"
        : singleItem.item_type === "screenshot"
          ? "📸 Ekran Notu"
          : "💡 Fikir / Düşünce";
    const lines: string[] = [
      `${singleItem.item_type === "task" ? (singleItem.status === "done" ? "☑" : "☐") : "•"} ${singleItem.content}`,
    ];
    if (singleItem.context_text) {
      lines.push(`🎯 Meşguliyet (Context): ${singleItem.context_text}`);
    }
    if (singleItem.active_app || singleItem.active_window) {
      lines.push(
        `🪟 Açık Pencere: ${[singleItem.active_app, singleItem.active_window].filter(Boolean).join(" — ")}`,
      );
    }
    return {
      title: `Pomodoro ${typeLabel} (${dateStr})`,
      bodyText: lines.join("\n"),
      items: [singleItem],
    };
  }

  const lines: string[] = [];
  const allItems: ParkingItem[] = [];

  if (parking.pendingTasks.length > 0) {
    lines.push("⏳ YAPILACAK GÖREVLER (Unfinished Tasks):");
    for (const t of parking.pendingTasks) {
      const ctx = t.context_text ? ` [🎯 ${t.context_text}]` : "";
      lines.push(`☐ ${t.content}${ctx}`);
      allItems.push(t);
    }
    lines.push("");
  }

  if (parking.doneTasks.length > 0) {
    lines.push("✅ TAMAMLANAN GÖREVLER (Finished Tasks):");
    for (const t of parking.doneTasks) {
      lines.push(`☑ ${t.content}`);
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
          ? "⭐ [Önemli] "
          : idea.status === "unimportant"
            ? "💤 [Önemsiz] "
            : "💡 ";
      const ctx = idea.context_text ? ` (🎯 ${idea.context_text})` : "";
      lines.push(`• ${badge}${idea.content}${ctx}`);
      allItems.push(idea);
    }
    lines.push("");
  }

  if (parking.screenshotNotes && parking.screenshotNotes.length > 0) {
    lines.push("📸 EKRAN GÖRÜNTÜSÜ NOTLARI:");
    for (const s of parking.screenshotNotes) {
      lines.push(`• 📸 ${s.content}${s.active_app ? ` [${s.active_app}]` : ""}`);
      allItems.push(s);
    }
  }

  return {
    title: `🍅 Pomodoro Görevler & Düşünceler (${dateStr})`,
    bodyText: lines.join("\n").trim() || "Henüz kayıtlı görev veya düşünce yok.",
    items: allItems,
  };
}

/**
 * Görevleri ve düşünceleri Google Keep'e (ve Google yan panelindeki Google Tasks'a) kaydeder.
 * 1) Eğer OAuth Access Token varsa:
 *    - Resmi Google Keep API (`https://keep.googleapis.com/v1/notes`) üzerinden not oluşturur.
 *    - Kişisel Gmail hesapları için aynı zamanda Google Tasks API (`https://tasks.googleapis.com/v1/lists/@default/tasks`)
 *      ve Sunucu Keep Köprüsü (`/api/keep/sync`) üzerinden senkronize eder.
 * 2) Ayrıca her durumda panoya Keep formatında kopyalar ve istenirse `keep.google.com`'u açar.
 */
export async function syncParkingToGoogleKeep(
  parking: ParkingLotData,
  options?: { singleItem?: ParkingItem; openBrowserIfNoToken?: boolean },
): Promise<KeepSyncResult> {
  const auth = await loadCloudAuthState();
  const formatted = formatParkingForGoogleKeep(parking, options?.singleItem);
  const itemIds = formatted.items.map((i) => i.id);

  // Panoya her zaman temiz Keep formatını kopyala (kullanıcı Keep'te Ctrl+V de yapabilsin)
  try {
    await navigator.clipboard.writeText(`${formatted.title}\n\n${formatted.bodyText}`);
  } catch {
    // clipboard izni yoksa yoksay
  }

  // 1. OAuth Access Token varsa doğrudan Google Keep REST API dene
  if (auth.accessToken) {
    try {
      const keepPayload = {
        title: formatted.title,
        body: {
          text: {
            text: formatted.bodyText,
          },
        },
      };
      const keepResp = await fetch("https://keep.googleapis.com/v1/notes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(keepPayload),
      });

      if (keepResp.ok) {
        const keepData = await keepResp.json();
        await markParkingItemsKeepSynced(itemIds, keepData?.name || "keep_api");
        return {
          ok: true,
          syncedCount: itemIds.length,
          method: "keep_api",
          message: `Google Keep API ile ${itemIds.length} kayıt doğrudan Google Keep'e kaydedildi!`,
          noteUrl: "https://keep.google.com/",
        };
      }

      // Kişisel Gmail hesaplarında Keep REST API yerine Google Workspace sağ panelindeki Tasks API açıktır
      const unsyncedItems = formatted.items.filter((i) => !i.keep_synced);
      const targets = unsyncedItems.length > 0 ? unsyncedItems : formatted.items;
      let tasksCreated = 0;
      for (const item of targets.slice(0, 15)) {
        const tResp = await fetch(
          "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: `${item.item_type === "idea" ? "💡 " : "⚡ "}${item.content}`,
              notes: [
                item.context_text ? `🎯 Context: ${item.context_text}` : "",
                item.active_app ? `🪟 Uygulama: ${item.active_app} (${item.active_window || ""})` : "",
              ]
                .filter(Boolean)
                .join("\n"),
              status: item.status === "done" ? "completed" : "needsAction",
            }),
          },
        );
        if (tResp.ok) tasksCreated++;
      }

      if (tasksCreated > 0) {
        await markParkingItemsKeepSynced(itemIds, "google_tasks_keep_panel");
        return {
          ok: true,
          syncedCount: tasksCreated,
          method: "tasks_api",
          message: `${tasksCreated} kayıt Google hesabınıza (Keep / Yan Panel Görevler) senkronize edildi!`,
          noteUrl: "https://keep.google.com/",
        };
      }
    } catch {
      // Sunucu üzerinden devam et
    }
  }

  // 2. Sunucu Keep Senkronizasyon uç noktasını dene (`/api/keep/sync`)
  if (auth.serverUrl) {
    try {
      const sResp = await fetch(`${auth.serverUrl}/api/keep/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.userId || "local_user",
          email: auth.email,
          accessToken: auth.accessToken,
          title: formatted.title,
          bodyText: formatted.bodyText,
          items: formatted.items,
        }),
      });
      if (sResp.ok) {
        const sData = await sResp.json();
        await markParkingItemsKeepSynced(itemIds, sData?.noteId || "server_keep");
        if (options?.openBrowserIfNoToken && !auth.accessToken) {
          try {
            await openUrl("https://keep.google.com/");
          } catch {
            window.open("https://keep.google.com/", "_blank");
          }
        }
        return {
          ok: true,
          syncedCount: itemIds.length,
          method: "server_keep",
          message:
            sData?.message ||
            `${itemIds.length} kayıt Google Keep senkronizasyonuna aktarıldı (Panoya da kopyalandı).`,
          noteUrl: "https://keep.google.com/",
        };
      }
    } catch {
      // Web köprüsüne düş
    }
  }

  // 3. Web Köprüsü: Panoya kopyalandı + Google Keep'i aç
  await markParkingItemsKeepSynced(itemIds, "keep_web_bridge");
  if (options?.openBrowserIfNoToken !== false) {
    try {
      await openUrl("https://keep.google.com/");
    } catch {
      window.open("https://keep.google.com/", "_blank");
    }
  }

  return {
    ok: true,
    syncedCount: itemIds.length,
    method: "web_bridge",
    message:
      "Görev ve düşünceler Google Keep formatında panoya kopyalandı ve Google Keep açıldı (Ctrl+V ile yapıştırabilirsiniz).",
    noteUrl: "https://keep.google.com/",
  };
}
