use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

use crate::{lock_state, SharedCaptureState};

const SLEEP_GAP_THRESHOLD_MS: u64 = 25_000;
static LAST_AWAKE_BEAT_MS: AtomicU64 = AtomicU64::new(0);
static LAST_OS_SLEEP_AT_MS: AtomicU64 = AtomicU64::new(0);

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

/// Returns true if the native watcher thread observed an OS sleep/suspend gap
/// (>25s between 1.2s ticks) since `since_ms` or has not ticked in >25s.
pub fn did_os_sleep_since(since_ms: u64) -> bool {
    let now = current_epoch_ms();
    if LAST_OS_SLEEP_AT_MS.load(Ordering::Relaxed) > since_ms {
        return true;
    }
    let last_beat = LAST_AWAKE_BEAT_MS.load(Ordering::Relaxed);
    last_beat > 0 && now.saturating_sub(last_beat) > SLEEP_GAP_THRESHOLD_MS
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveAppInfo {
    pub app_name: String,
    pub window_title: String,
}

pub fn clean_app_and_tab(raw_exe_stem: &str, raw_title: &str) -> ActiveAppInfo {
    let lower = raw_exe_stem.trim().to_ascii_lowercase();
    let app_name = match lower.as_str() {
        "chrome" => "Chrome".to_string(),
        "msedge" => "Edge".to_string(),
        "brave" => "Brave".to_string(),
        "firefox" => "Firefox".to_string(),
        "opera" => "Opera".to_string(),
        "vivaldi" => "Vivaldi".to_string(),
        "arc" => "Arc".to_string(),
        "code" => "VS Code".to_string(),
        "cursor" => "Cursor".to_string(),
        "windsurf" => "Windsurf".to_string(),
        "antigravity" => "Antigravity".to_string(),
        "idea64" | "idea" => "IntelliJ IDEA".to_string(),
        "pycharm64" | "pycharm" => "PyCharm".to_string(),
        "webstorm64" | "webstorm" => "WebStorm".to_string(),
        "obsidian" => "Obsidian".to_string(),
        "notion" => "Notion".to_string(),
        "discord" => "Discord".to_string(),
        "slack" => "Slack".to_string(),
        "telegram" => "Telegram".to_string(),
        "whatsapp" => "WhatsApp".to_string(),
        "spotify" => "Spotify".to_string(),
        "winword" => "Word".to_string(),
        "excel" => "Excel".to_string(),
        "powerpnt" => "PowerPoint".to_string(),
        "onenote" => "OneNote".to_string(),
        "acrord32" | "acrobat" => "Adobe PDF".to_string(),
        "sumatrapdf" => "SumatraPDF".to_string(),
        "windowsterminal" => "Terminal".to_string(),
        "powershell" | "pwsh" => "PowerShell".to_string(),
        "explorer" => "Explorer".to_string(),
        other if !other.is_empty() => {
            let mut chars = other.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        }
        _ => String::new(),
    };

    let mut title = raw_title.trim().to_string();
    let suffixes = [
        " - Google Chrome",
        " — Google Chrome",
        " - Microsoft\u{200b} Edge",
        " - Microsoft Edge",
        " - Brave",
        " — Mozilla Firefox",
        " - Mozilla Firefox",
        " - Opera",
        " - Vivaldi",
        " - Visual Studio Code",
        " - Cursor",
        " - Obsidian",
    ];
    for suf in suffixes {
        if let Some(stripped) = title.strip_suffix(suf) {
            title = stripped.trim().to_string();
            break;
        }
    }

    ActiveAppInfo {
        app_name,
        window_title: title,
    }
}

pub fn inspect_external_foreground() -> Option<(ActiveAppInfo, isize)> {
    platform::inspect_external_foreground()
}

pub fn restore_hwnd(hwnd: isize) {
    platform::restore_hwnd(hwnd)
}

pub fn get_system_idle_secs() -> u64 {
    platform::get_system_idle_secs()
}

pub fn spawn_foreground_watcher(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        let mut prev_ms = current_epoch_ms();
        LAST_AWAKE_BEAT_MS.store(prev_ms, Ordering::Relaxed);

        loop {
            std::thread::sleep(Duration::from_millis(1200));
            let now = current_epoch_ms();
            if prev_ms > 0 && now.saturating_sub(prev_ms) > SLEEP_GAP_THRESHOLD_MS {
                LAST_OS_SLEEP_AT_MS.store(now, Ordering::Relaxed);
            }
            LAST_AWAKE_BEAT_MS.store(now, Ordering::Relaxed);
            prev_ms = now;

            #[cfg(target_os = "windows")]
            if let Some((info, hwnd)) = inspect_external_foreground() {
                let state = handle.state::<Mutex<SharedCaptureState>>();
                lock_state(&state).update_external(info, hwnd);
            }
            #[cfg(not(target_os = "windows"))]
            let _ = &handle;
        }
    });
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{clean_app_and_tab, ActiveAppInfo};
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::Path;

    type HWND = isize;
    type DWORD = u32;
    type BOOL = i32;
    type HANDLE = isize;

    const PROCESS_QUERY_LIMITED_INFORMATION: DWORD = 0x1000;

    #[repr(C)]
    struct LASTINPUTINFO {
        cb_size: u32,
        dw_time: DWORD,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetForegroundWindow() -> HWND;
        fn GetWindowTextW(hWnd: HWND, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowThreadProcessId(hWnd: HWND, lpdwProcessId: *mut DWORD) -> DWORD;
        fn SetForegroundWindow(hWnd: HWND) -> BOOL;
        fn IsWindow(hWnd: HWND) -> BOOL;
        fn GetLastInputInfo(plii: *mut LASTINPUTINFO) -> BOOL;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(
            dwDesiredAccess: DWORD,
            bInheritHandle: BOOL,
            dwProcessId: DWORD,
        ) -> HANDLE;
        fn QueryFullProcessImageNameW(
            hProcess: HANDLE,
            dwFlags: DWORD,
            lpExeName: *mut u16,
            lpdwSize: *mut DWORD,
        ) -> BOOL;
        fn CloseHandle(hObject: HANDLE) -> BOOL;
        fn GetTickCount() -> DWORD;
    }

    fn wide_to_string(slice: &[u16]) -> String {
        OsString::from_wide(slice).to_string_lossy().into_owned()
    }

    pub fn inspect_external_foreground() -> Option<(ActiveAppInfo, isize)> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == 0 {
                return None;
            }
            let mut pid: DWORD = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 || pid == std::process::id() {
                return None;
            }

            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
            let raw_title = if title_len > 0 {
                wide_to_string(&title_buf[..title_len as usize])
            } else {
                String::new()
            };

            let trimmed_title = raw_title.trim();
            if trimmed_title.is_empty()
                || trimmed_title == "Program Manager"
                || trimmed_title == "Windows Default Lock Screen"
            {
                return None;
            }

            let mut exe_stem = String::new();
            let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h_proc != 0 {
                let mut path_buf = [0u16; 1024];
                let mut path_len: DWORD = path_buf.len() as DWORD;
                if QueryFullProcessImageNameW(h_proc, 0, path_buf.as_mut_ptr(), &mut path_len) != 0
                    && path_len > 0
                {
                    let full_path = wide_to_string(&path_buf[..path_len as usize]);
                    if let Some(stem) = Path::new(&full_path).file_stem() {
                        exe_stem = stem.to_string_lossy().into_owned();
                    }
                }
                let _ = CloseHandle(h_proc);
            }

            if exe_stem.eq_ignore_ascii_case("pomodoro-widget") {
                return None;
            }

            Some((clean_app_and_tab(&exe_stem, trimmed_title), hwnd))
        }
    }

    pub fn restore_hwnd(hwnd: isize) {
        if hwnd == 0 {
            return;
        }
        unsafe {
            if IsWindow(hwnd) != 0 {
                let _ = SetForegroundWindow(hwnd);
            }
        }
    }

    pub fn get_system_idle_secs() -> u64 {
        unsafe {
            let mut lii = LASTINPUTINFO {
                cb_size: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dw_time: 0,
            };
            if GetLastInputInfo(&mut lii) != 0 {
                let now = GetTickCount();
                let elapsed_ms = now.wrapping_sub(lii.dw_time);
                // Guard against minor clock skew where dw_time slightly leads GetTickCount
                if elapsed_ms > 0x8000_0000 {
                    return 0;
                }
                return (elapsed_ms / 1000) as u64;
            }
        }
        0
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{clean_app_and_tab, ActiveAppInfo};
    use std::process::Command;

    pub fn inspect_external_foreground() -> Option<(ActiveAppInfo, isize)> {
        let script = r#"tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            set winTitle to ""
            try
                set winTitle to name of front window of frontApp
            end try
            return appName & "|||" & winTitle
        end tell"#;
        let out = Command::new("osascript").arg("-e").arg(script).output().ok()?;
        if !out.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let mut parts = text.splitn(2, "|||");
        let app_raw = parts.next().unwrap_or("").trim();
        let title_raw = parts.next().unwrap_or("").trim();
        if app_raw.is_empty() || app_raw.to_ascii_lowercase().contains("pomodoro") {
            return None;
        }
        Some((clean_app_and_tab(app_raw, title_raw), 0))
    }

    pub fn restore_hwnd(_hwnd: isize) {}

    pub fn get_system_idle_secs() -> u64 {
        0
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::{clean_app_and_tab, ActiveAppInfo};
    use std::process::Command;

    pub fn inspect_external_foreground() -> Option<(ActiveAppInfo, isize)> {
        let out = Command::new("xdotool")
            .args(["getactivewindow", "getwindowname"])
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        let title = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if title.is_empty() || title.to_ascii_lowercase().contains("pomodoro") {
            return None;
        }
        Some((clean_app_and_tab("", &title), 0))
    }

    pub fn restore_hwnd(_hwnd: isize) {}

    pub fn get_system_idle_secs() -> u64 {
        0
    }
}
