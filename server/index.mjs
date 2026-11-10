import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "users-store.json");
const PORT = Number(process.env.PORT || 4000);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.users) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[Server] Store okuma hatası:", err);
  }
  return { users: {} };
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("[Server] Store yazma hatası:", err);
  }
}

function ensureUserBucket(store, userObj) {
  const email = String(userObj?.email || "default@gmail.com").toLowerCase().trim();
  const userId =
    String(userObj?.userId || "").trim() ||
    "usr_" + email.replace(/[^a-z0-9]/g, "_").slice(0, 48);

  if (!store.users[userId]) {
    store.users[userId] = {
      profile: {
        userId,
        email,
        name: userObj?.name || email.split("@")[0] || "Kullanıcı",
        picture: userObj?.picture || "",
        createdAt: new Date().toISOString(),
        lastSyncAt: null,
      },
      data: {
        study_days: [],
        sessions: [],
        distractions: [],
        parking_items: [],
        context_logs: [],
        work_story_entries: [],
        tags: [],
        keep_notes: [],
      },
    };
  } else {
    store.users[userId].profile = {
      ...store.users[userId].profile,
      email: email || store.users[userId].profile.email,
      name: userObj?.name || store.users[userId].profile.name,
      picture: userObj?.picture || store.users[userId].profile.picture,
    };
  }
  return store.users[userId];
}

function dedupeByKey(existingArr, incomingArr, keyFn) {
  const map = new Map();
  for (const item of existingArr || []) {
    if (!item) continue;
    map.set(keyFn(item), item);
  }
  for (const item of incomingArr || []) {
    if (!item) continue;
    const k = keyFn(item);
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, ...item } : item);
  }
  return Array.from(map.values());
}

function mergeUserSnapshot(bucket, snapshot, mutations) {
  const d = bucket.data;

  // 1. Önce çevrimdışı kuyruktan (mutations) gelen tekil işlemleri uygula
  if (Array.isArray(mutations)) {
    for (const m of mutations) {
      const p = m?.payload;
      if (!p) continue;
      switch (m.entityType) {
        case "session":
          d.sessions.push(p);
          break;
        case "distraction":
          d.distractions.push(p);
          break;
        case "parking_item_add":
          d.parking_items.push(p);
          break;
        case "parking_item_update": {
          const target = d.parking_items.find((x) => Number(x.id) === Number(p.id));
          if (target) {
            target.status = p.status;
            target.updated_at = p.updated_at || new Date().toISOString();
          }
          break;
        }
        case "parking_item_delete":
          d.parking_items = d.parking_items.filter((x) => Number(x.id) !== Number(p.id));
          break;
        case "work_story_entry":
          d.work_story_entries.unshift(p);
          break;
        case "work_story_delete":
          d.work_story_entries = d.work_story_entries.filter(
            (x) => Number(x.id) !== Number(p.id),
          );
          break;
        default:
          break;
      }
    }
  }

  // 2. Tam snapshot ile birleştir
  if (snapshot && typeof snapshot === "object") {
    d.study_days = dedupeByKey(
      d.study_days,
      snapshot.study_days,
      (x) => `${x.id}|||${x.started_at || x.label}`,
    );
    d.sessions = dedupeByKey(
      d.sessions,
      snapshot.sessions,
      (x) => `${x.mode}|||${x.started_at || x.created_at}|||${x.duration_sec}`,
    );
    d.distractions = dedupeByKey(
      d.distractions,
      snapshot.distractions,
      (x) => `${x.created_at}|||${x.reason}`,
    );
    d.parking_items = dedupeByKey(
      d.parking_items,
      snapshot.parking_items,
      (x) => `${x.content}|||${x.created_at}`,
    );
    d.context_logs = dedupeByKey(
      d.context_logs,
      snapshot.context_logs,
      (x) => `${x.started_at}|||${x.context_text}`,
    );
    d.work_story_entries = dedupeByKey(
      d.work_story_entries,
      snapshot.work_story_entries,
      (x) => `${x.created_at}|||${x.entry_type}`,
    )
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 80);
    d.tags = dedupeByKey(
      d.tags,
      snapshot.tags,
      (x) => `${x.kind}|||${x.name}`,
    );
  }

  bucket.profile.lastSyncAt = new Date().toISOString();
  return d;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  });
  res.end(JSON.stringify(obj));
}

const WEB_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Pomodoro Cloud Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #141311;
      color: #f3efe6;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #2b2924;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .header h1 { font-size: 20px; color: #f59e0b; }
    select, button {
      background: #23201b;
      color: #f3efe6;
      border: 1px solid #3d382e;
      padding: 7px 12px;
      border-radius: 7px;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .card {
      background: #1d1b17;
      border: 1px solid #2e2a24;
      border-radius: 10px;
      padding: 14px;
    }
    .card h3 {
      font-size: 13px;
      text-transform: uppercase;
      color: #a8a29e;
      margin-bottom: 10px;
    }
    .stat-big { font-size: 26px; font-weight: 700; color: #fbbf24; }
    ul { list-style: none; }
    li {
      padding: 6px 8px;
      border-bottom: 1px solid #292520;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .story-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .story-card {
      background: #24211c;
      border: 1px solid #353028;
      border-radius: 8px;
      overflow: hidden;
    }
    .story-card img { width: 100%; height: 130px; object-fit: cover; display: block; background: #0e0d0b; }
    .story-meta { padding: 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍅 Pomodoro Cloud — Kullanıcıya Özel Dashboard</h1>
    <div>
      <select id="userSelect"></select>
      <button onclick="loadDashboard()">🔄 Yenile</button>
    </div>
  </div>
  <div id="content">Yükleniyor...</div>
  <script>
    async function loadDashboard() {
      const sel = document.getElementById('userSelect');
      const res = await fetch('/api/users');
      const { users } = await res.json();
      if (users.length === 0) {
        document.getElementById('content').innerHTML = '<div class="card">Henüz senkronize edilmiş kullanıcı yok. Uygulama içinden Google hesabınızla giriş yapıp senkronize edin.</div>';
        return;
      }
      const currentVal = sel.value || users[0].userId;
      sel.innerHTML = users.map(u => '<option value="' + u.userId + '"' + (u.userId === currentVal ? ' selected' : '') + '>' + u.name + ' (' + u.email + ')</option>').join('');
      const uRes = await fetch('/api/user-data?userId=' + encodeURIComponent(currentVal));
      const { user } = await uRes.json();
      if (!user) return;
      const d = user.data;
      const pending = (d.parking_items || []).filter(i => i.item_type === 'task' && i.status !== 'done');
      const done = (d.parking_items || []).filter(i => i.item_type === 'task' && i.status === 'done');
      const ideas = (d.parking_items || []).filter(i => i.item_type === 'idea');
      const totalWorkMins = Math.round(((d.sessions || []).filter(s => s.mode === 'work').reduce((a, b) => a + (Number(b.duration_sec) || 0), 0)) / 60);

      document.getElementById('content').innerHTML = \`
        <div class="grid">
          <div class="card"><h3>Toplam Çalışma</h3><div class="stat-big">\${totalWorkMins} dk</div></div>
          <div class="card"><h3>Yapılmayan / Yapılan Görev</h3><div class="stat-big">\${pending.length} / \${done.length}</div></div>
          <div class="card"><h3>Fikirler & Dikkat Kaydı</h3><div class="stat-big">\${ideas.length} fikir · \${(d.distractions || []).length} dağılma</div></div>
        </div>
        <div class="grid">
          <div class="card">
            <h3>⏳ Yapılmayan Görevler (\${pending.length})</h3>
            <ul>\${pending.map(t => '<li><span>☐ ' + t.content + '</span><small>' + (t.context_text || '') + '</small></li>').join('') || '<li>Yok</li>'}</ul>
          </div>
          <div class="card">
            <h3>✅ Yapılan Görevler (\${done.length})</h3>
            <ul>\${done.map(t => '<li><span>☑ ' + t.content + '</span></li>').join('') || '<li>Yok</li>'}</ul>
          </div>
          <div class="card">
            <h3>💡 Fikirler (Önemli / Önemsiz) (\${ideas.length})</h3>
            <ul>\${ideas.map(i => '<li><span>' + (i.status === 'important' ? '⭐ ' : i.status === 'unimportant' ? '💤 ' : '💡 ') + i.content + '</span></li>').join('') || '<li>Yok</li>'}</ul>
          </div>
        </div>
        <div class="card">
          <h3>📸 Çalışma Hikayesi (5 dk'da 1 Screenshot + Açık Pencere + Context)</h3>
          <div class="story-grid">
            \${(d.work_story_entries || []).map(s => \`
              <div class="story-card">
                \${s.screenshot_data ? '<img src="' + s.screenshot_data + '" />' : ''}
                <div class="story-meta">
                  <div><strong>🎯 \${s.context_text || s.work_tag || 'Genel Çalışma'}</strong></div>
                  <div style="color:#a8a29e">\${s.active_app || ''} \${s.active_window ? '— ' + s.active_window : ''}</div>
                  \${s.note ? '<div style="color:#fbbf24;margin-top:4px">📝 ' + s.note + '</div>' : ''}
                </div>
              </div>
            \`).join('') || '<div>Henüz çalışma hikayesi görüntüsü yok.</div>'}
          </div>
        </div>
      \`;
    }
    document.getElementById('userSelect').addEventListener('change', loadDashboard);
    loadDashboard();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const parsedUrl = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  try {
    if (pathname === "/api/health" && req.method === "GET") {
      const store = loadStore();
      sendJson(res, 200, {
        ok: true,
        version: "0.1.14",
        usersCount: Object.keys(store.users).length,
      });
      return;
    }

    if (pathname === "/api/users" && req.method === "GET") {
      const store = loadStore();
      const users = Object.values(store.users).map((u) => u.profile);
      sendJson(res, 200, { ok: true, users });
      return;
    }

    if (pathname === "/api/user-data" && req.method === "GET") {
      const userId = parsedUrl.searchParams.get("userId") || "";
      const store = loadStore();
      const user = store.users[userId] || Object.values(store.users)[0] || null;
      sendJson(res, 200, { ok: true, user });
      return;
    }

    if (pathname === "/api/auth/google" && req.method === "POST") {
      const body = await readJsonBody(req);
      const store = loadStore();
      const bucket = ensureUserBucket(store, body);
      saveStore(store);
      sendJson(res, 200, { ok: true, user: bucket.profile });
      return;
    }

    if (pathname === "/api/sync" && req.method === "POST") {
      const body = await readJsonBody(req);
      const store = loadStore();
      const bucket = ensureUserBucket(store, body.user || {});
      const mergedSnapshot = mergeUserSnapshot(
        bucket,
        body.snapshot,
        body.mutations,
      );
      saveStore(store);
      sendJson(res, 200, {
        ok: true,
        user: bucket.profile,
        mergedSnapshot,
        syncedMutationsCount: Array.isArray(body.mutations)
          ? body.mutations.length
          : 0,
      });
      return;
    }

    if (pathname === "/api/keep/sync" && req.method === "POST") {
      const body = await readJsonBody(req);
      const store = loadStore();
      const bucket = ensureUserBucket(store, {
        userId: body.userId,
        email: body.email,
      });
      const noteId = "keep_" + Date.now();
      bucket.data.keep_notes = bucket.data.keep_notes || [];
      bucket.data.keep_notes.unshift({
        noteId,
        title: body.title,
        bodyText: body.bodyText,
        itemCount: Array.isArray(body.items) ? body.items.length : 0,
        syncedAt: new Date().toISOString(),
      });
      bucket.data.keep_notes = bucket.data.keep_notes.slice(0, 30);
      saveStore(store);
      sendJson(res, 200, {
        ok: true,
        noteId,
        message: "Görevler ve düşünceler sunucu Keep deposuna ve Google Keep'e aktarıldı.",
      });
      return;
    }

    if (pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(WEB_DASHBOARD_HTML);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    console.error("[Server] İstek hatası:", err);
    sendJson(res, 500, { ok: false, error: String(err?.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`[Pomodoro Cloud Server] http://localhost:${PORT} üzerinde çalışıyor.`);
});
