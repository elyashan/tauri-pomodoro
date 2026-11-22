import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;
const BUMP_KINDS = new Set(["patch", "minor", "major"]);

function fail(msg) {
  console.error(`\n[HATA] ${msg}`);
  process.exit(1);
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
  });
}

function gitTagExists(tagName) {
  try {
    runGit(["rev-parse", "--verify", "--quiet", `refs/tags/${tagName}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  let dryRun = false;
  const positional = [];

  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "-n") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Kullanım:
  node scripts/release.mjs                              # patch artır (1.0.3 -> 1.0.4)
  node scripts/release.mjs "kısa açıklama"              # patch artır + özel mesaj
  node scripts/release.mjs minor "açıklama"             # minor artır (1.0.3 -> 1.1.0)
  node scripts/release.mjs major "açıklama"             # major artır (1.0.3 -> 2.0.0)
  node scripts/release.mjs 1.2.0 "özel sürüm"           # belirtilen sürüme geç
  node scripts/release.mjs --dry-run [diğer argümanlar] # değişiklik yapmadan önizle
`);
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }

  let bumpOrVersion = "patch";
  let message = "";

  if (positional.length > 0) {
    const first = positional[0].trim();
    if (BUMP_KINDS.has(first) || SEMVER_RE.test(first)) {
      bumpOrVersion = first;
      message = positional.slice(1).join(" ").trim();
    } else {
      message = positional.join(" ").trim();
    }
  }

  return { dryRun, bumpOrVersion, message };
}

function computeNextVersion(current, bumpOrVersion) {
  const curMatch = current.match(SEMVER_RE);
  if (!curMatch) {
    fail(`Geçersiz mevcut sürüm formatı (package.json): "${current}"`);
  }
  const major = Number(curMatch[1]);
  const minor = Number(curMatch[2]);
  const patch = Number(curMatch[3]);

  if (bumpOrVersion === "patch") return `${major}.${minor}.${patch + 1}`;
  if (bumpOrVersion === "minor") return `${major}.${minor + 1}.0`;
  if (bumpOrVersion === "major") return `${major + 1}.0.0`;

  const explicit = bumpOrVersion.match(SEMVER_RE);
  if (!explicit) {
    fail(`Geçersiz sürüm argümanı: "${bumpOrVersion}"`);
  }
  return `${Number(explicit[1])}.${Number(explicit[2])}.${Number(explicit[3])}`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  const { dryRun, bumpOrVersion, message } = parseArgs(process.argv.slice(2));

  const pkgPath = path.join(ROOT, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const currentVersion = String(pkgJson.version || "").trim();
  const nextVersion = computeNextVersion(currentVersion, bumpOrVersion);

  if (nextVersion === currentVersion) {
    fail(`Hedef sürüm zaten mevcut sürümle aynı (${currentVersion}).`);
  }

  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  if (!branch || branch === "HEAD") {
    fail("Detached HEAD durumundasın. Önce bir branch'e (örn. main) geç.");
  }

  const tagName = `v${nextVersion}`;
  if (gitTagExists(tagName)) {
    fail(`Git tag zaten mevcut: ${tagName}`);
  }

  const targets = [
    {
      relPath: "package.json",
      pattern: /^(\s*"version"\s*:\s*")([^"]+)(")/m,
    },
    {
      relPath: "src-tauri/tauri.conf.json",
      pattern: /^(\s*"version"\s*:\s*")([^"]+)(")/m,
    },
    {
      relPath: "src-tauri/Cargo.toml",
      pattern: /(\[package\][\s\S]*?\r?\nversion\s*=\s*")([^"]+)(")/,
    },
    {
      relPath: "src-tauri/Cargo.lock",
      pattern: new RegExp(
        `(\\[\\[package\\]\\]\\r?\\nname\\s*=\\s*"${escapeRegExp(pkgJson.name || "pomodoro-widget")}"\\r?\\nversion\\s*=\\s*")([^"]+)(")`,
      ),
    },
  ];

  const updates = targets.map(({ relPath, pattern }) => {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      fail(`Dosya bulunamadı: ${relPath}`);
    }
    const before = fs.readFileSync(absPath, "utf8");
    const match = before.match(pattern);
    if (!match) {
      fail(`Sürüm alanı eşleşmedi: ${relPath}`);
    }
    const foundVersion = match[2];
    const after = before.replace(pattern, `$1${nextVersion}$3`);
    return { relPath, absPath, foundVersion, after };
  });

  const commitMsg = message ? `${message} (${tagName})` : `release: ${tagName}`;

  if (dryRun) {
    console.log("== DRY RUN (Hiçbir dosya veya git kaydı değiştirilmedi) ==");
    console.log(`Branch       : ${branch}`);
    console.log(`Sürüm        : ${currentVersion} -> ${nextVersion}`);
    console.log(`Tag          : ${tagName}`);
    console.log(`Commit mesajı: ${commitMsg}`);
    console.log("Güncellenecek dosyalar:");
    for (const u of updates) {
      console.log(`  - ${u.relPath} (${u.foundVersion} -> ${nextVersion})`);
    }
    console.log("Çalıştırılacak komutlar:");
    console.log("  1. git add -A");
    console.log(`  2. git commit -m "${commitMsg}"`);
    console.log(`  3. git push origin ${branch}`);
    console.log(`  4. git tag ${tagName}`);
    console.log(`  5. git push origin ${tagName}`);
    return;
  }

  for (const u of updates) {
    fs.writeFileSync(u.absPath, u.after, "utf8");
    console.log(`[OK] ${u.relPath}: ${u.foundVersion} -> ${nextVersion}`);
  }

  const gitSteps = [
    ["add", "-A"],
    ["commit", "-m", commitMsg],
    ["push", "origin", branch],
    ["tag", tagName],
    ["push", "origin", tagName],
  ];

  for (const args of gitSteps) {
    console.log(`\n> git ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
    runGit(args, { stdio: "inherit" });
  }

  console.log(`\n[TAMAM] ${tagName} GitHub'a gönderildi ve Actions tetiklendi!`);
  console.log("Takip: https://github.com/elyashan/tauri-pomodoro/actions");
}

main();
