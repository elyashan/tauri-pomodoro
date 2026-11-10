use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// ============================================================================
// Aktif Uygulama & Açık Sekme Yakalama (Cross-Platform)
// ============================================================================

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveAppInfo {
    pub app_name: String,
    pub window_title: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotCapturePayload {
    pub data_url: String,
    pub active_app: String,
    pub active_window: String,
}

fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[((triple >> 18) & 0x3F) as usize]);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize]);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3F) as usize]);
        } else {
            out.push(b'=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3F) as usize]);
        } else {
            out.push(b'=');
        }
    }
    // SAFETY: TABLE and '=' are valid ASCII bytes
    unsafe { String::from_utf8_unchecked(out) }
}

fn clean_app_and_tab(raw_exe_stem: &str, raw_title: &str) -> ActiveAppInfo {
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

#[cfg(target_os = "windows")]
mod platform_fg {
    use super::{clean_app_and_tab, encode_base64, ActiveAppInfo};
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::Path;

    type HWND = isize;
    type HDC = isize;
    type HGDIOBJ = isize;
    type HBITMAP = isize;
    type DWORD = u32;
    type BOOL = i32;
    type HANDLE = isize;

    const PROCESS_QUERY_LIMITED_INFORMATION: DWORD = 0x1000;
    const SRCCOPY: DWORD = 0x00CC0020;
    const HALFTONE: i32 = 4;
    const DESKTOPVERTRES: i32 = 117;
    const DESKTOPHORZRES: i32 = 118;

    #[repr(C)]
    struct BitmapInfoHeader {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetForegroundWindow() -> HWND;
        fn GetWindowTextW(hWnd: HWND, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowThreadProcessId(hWnd: HWND, lpdwProcessId: *mut DWORD) -> DWORD;
        fn SetForegroundWindow(hWnd: HWND) -> BOOL;
        fn IsWindow(hWnd: HWND) -> BOOL;
        fn GetDC(hWnd: HWND) -> HDC;
        fn ReleaseDC(hWnd: HWND, hDC: HDC) -> i32;
        fn GetSystemMetrics(nIndex: i32) -> i32;
    }

    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn GetDeviceCaps(hdc: HDC, index: i32) -> i32;
        fn CreateCompatibleDC(hdc: HDC) -> HDC;
        fn CreateCompatibleBitmap(hdc: HDC, cx: i32, cy: i32) -> HBITMAP;
        fn SelectObject(hdc: HDC, h: HGDIOBJ) -> HGDIOBJ;
        fn SetStretchBltMode(hdc: HDC, mode: i32) -> i32;
        fn StretchBlt(
            hdcDest: HDC,
            xDest: i32,
            yDest: i32,
            wDest: i32,
            hDest: i32,
            hdcSrc: HDC,
            xSrc: i32,
            ySrc: i32,
            wSrc: i32,
            hSrc: i32,
            rop: DWORD,
        ) -> BOOL;
        fn GetDIBits(
            hdc: HDC,
            hbmp: HBITMAP,
            start: u32,
            cLines: u32,
            lpvBits: *mut u8,
            lpbmi: *mut BitmapInfoHeader,
            usage: u32,
        ) -> i32;
        fn DeleteObject(ho: HGDIOBJ) -> BOOL;
        fn DeleteDC(hdc: HDC) -> BOOL;
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
                OsString::from_wide(&title_buf[..title_len as usize])
                    .to_string_lossy()
                    .into_owned()
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
                    let full_path = OsString::from_wide(&path_buf[..path_len as usize])
                        .to_string_lossy()
                        .into_owned();
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

    pub fn capture_screen_data_url(max_width: i32) -> Option<String> {
        unsafe {
            let hdc_screen = GetDC(0);
            if hdc_screen == 0 {
                return None;
            }

            let mut src_w = GetDeviceCaps(hdc_screen, DESKTOPHORZRES);
            let mut src_h = GetDeviceCaps(hdc_screen, DESKTOPVERTRES);
            if src_w <= 0 || src_h <= 0 {
                src_w = GetSystemMetrics(0);
                src_h = GetSystemMetrics(1);
            }
            if src_w <= 0 || src_h <= 0 {
                let _ = ReleaseDC(0, hdc_screen);
                return None;
            }

            let target_w = max_width.clamp(320, 1280).min(src_w);
            let target_h = ((src_h as i64 * target_w as i64) / src_w as i64).max(180) as i32;

            let hdc_mem = CreateCompatibleDC(hdc_screen);
            if hdc_mem == 0 {
                let _ = ReleaseDC(0, hdc_screen);
                return None;
            }

            let hbm = CreateCompatibleBitmap(hdc_screen, target_w, target_h);
            if hbm == 0 {
                let _ = DeleteDC(hdc_mem);
                let _ = ReleaseDC(0, hdc_screen);
                return None;
            }

            let old_obj = SelectObject(hdc_mem, hbm);
            let _ = SetStretchBltMode(hdc_mem, HALFTONE);
            let ok_blt = StretchBlt(
                hdc_mem,
                0,
                0,
                target_w,
                target_h,
                hdc_screen,
                0,
                0,
                src_w,
                src_h,
                SRCCOPY,
            );

            if ok_blt == 0 {
                let _ = SelectObject(hdc_mem, old_obj);
                let _ = DeleteObject(hbm);
                let _ = DeleteDC(hdc_mem);
                let _ = ReleaseDC(0, hdc_screen);
                return None;
            }

            let row_stride = ((target_w as usize * 3 + 3) / 4) * 4;
            let image_size = row_stride * target_h as usize;
            let total_size = 54 + image_size;
            let mut bmp_buf = vec![0u8; total_size];

            // 14-byte BITMAPFILEHEADER
            bmp_buf[0] = b'B';
            bmp_buf[1] = b'M';
            bmp_buf[2..6].copy_from_slice(&(total_size as u32).to_le_bytes());
            bmp_buf[10..14].copy_from_slice(&54u32.to_le_bytes());

            let mut bmi = BitmapInfoHeader {
                bi_size: 40,
                bi_width: target_w,
                bi_height: target_h, // bottom-up standard BMP
                bi_planes: 1,
                bi_bit_count: 24,
                bi_compression: 0,
                bi_size_image: image_size as u32,
                bi_x_pels_per_meter: 0,
                bi_y_pels_per_meter: 0,
                bi_clr_used: 0,
                bi_clr_important: 0,
            };

            let lines = GetDIBits(
                hdc_mem,
                hbm,
                0,
                target_h as u32,
                bmp_buf[54..].as_mut_ptr(),
                &mut bmi,
                0,
            );

            // Copy BITMAPINFOHEADER into bytes 14..54
            bmp_buf[14..18].copy_from_slice(&bmi.bi_size.to_le_bytes());
            bmp_buf[18..22].copy_from_slice(&bmi.bi_width.to_le_bytes());
            bmp_buf[22..26].copy_from_slice(&bmi.bi_height.to_le_bytes());
            bmp_buf[26..28].copy_from_slice(&bmi.bi_planes.to_le_bytes());
            bmp_buf[28..30].copy_from_slice(&bmi.bi_bit_count.to_le_bytes());
            bmp_buf[30..34].copy_from_slice(&bmi.bi_compression.to_le_bytes());
            bmp_buf[34..38].copy_from_slice(&(image_size as u32).to_le_bytes());

            let _ = SelectObject(hdc_mem, old_obj);
            let _ = DeleteObject(hbm);
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(0, hdc_screen);

            if lines <= 0 {
                return None;
            }

            Some(format!("data:image/bmp;base64,{}", encode_base64(&bmp_buf)))
        }
    }
}

#[cfg(target_os = "macos")]
mod platform_fg {
    use super::{clean_app_and_tab, encode_base64, ActiveAppInfo};
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

    pub fn capture_screen_data_url(_max_width: i32) -> Option<String> {
        let tmp = std::env::temp_dir().join("pomodoro_cap_tmp.jpg");
        let status = Command::new("screencapture")
            .args(["-x", "-t", "jpg"])
            .arg(&tmp)
            .status()
            .ok()?;
        if !status.success() {
            return None;
        }
        let bytes = std::fs::read(&tmp).ok()?;
        let _ = std::fs::remove_file(&tmp);
        Some(format!("data:image/jpeg;base64,{}", encode_base64(&bytes)))
    }
}

#[cfg(target_os = "linux")]
mod platform_fg {
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

    pub fn capture_screen_data_url(_max_width: i32) -> Option<String> {
        None
    }
}

// ============================================================================
// Paylaşılan Yakalama Durumu (Main <-> Capture Penceresi Köprüsü)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendContextSnapshot {
    pub current_context: String,
    pub work_tag: String,
    pub work_reason: String,
    pub session_active: bool,
    pub timer_mode: String,
    pub distract_penalty_mins: u32,
    pub lang: String,
    pub bg_color: String,
    pub recent_contexts: Vec<String>,
}

impl Default for FrontendContextSnapshot {
    fn default() -> Self {
        Self {
            current_context: String::new(),
            work_tag: "Ders".to_string(),
            work_reason: String::new(),
            session_active: false,
            timer_mode: "work".to_string(),
            distract_penalty_mins: 1,
            lang: "tr".to_string(),
            bg_color: "#1a1814".to_string(),
            recent_contexts: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureOpenPayload {
    pub mode: String, // "distraction" | "context"
    pub open_seq: u64,
    pub active_app: String,
    pub active_window: String,
    pub snapshot: FrontendContextSnapshot,
}

impl Default for CaptureOpenPayload {
    fn default() -> Self {
        Self {
            mode: "distraction".to_string(),
            open_seq: 0,
            active_app: String::new(),
            active_window: String::new(),
            snapshot: FrontendContextSnapshot::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutStatus {
    pub distraction_shortcut: String,
    pub context_shortcut: String,
    pub distraction_ok: bool,
    pub distraction_error: Option<String>,
    pub context_ok: bool,
    pub context_error: Option<String>,
}

struct SharedCaptureState {
    last_external: ActiveAppInfo,
    last_external_hwnd: isize,
    last_screenshot_data_url: String,
    capture_opened_at_ms: u128,
    open_seq: u64,
    distraction_shortcut: String,
    context_shortcut: String,
    parsed_distraction: Option<Shortcut>,
    parsed_context: Option<Shortcut>,
    snapshot: FrontendContextSnapshot,
    active_payload: CaptureOpenPayload,
}

impl Default for SharedCaptureState {
    fn default() -> Self {
        let d_str = "Ctrl+Shift+D".to_string();
        let c_str = "Ctrl+Alt+C".to_string();
        Self {
            last_external: ActiveAppInfo::default(),
            last_external_hwnd: 0,
            last_screenshot_data_url: String::new(),
            capture_opened_at_ms: 0,
            open_seq: 0,
            parsed_distraction: Shortcut::from_str(&d_str).ok(),
            parsed_context: Shortcut::from_str(&c_str).ok(),
            distraction_shortcut: d_str,
            context_shortcut: c_str,
            snapshot: FrontendContextSnapshot::default(),
            active_payload: CaptureOpenPayload::default(),
        }
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn trigger_capture_window(app: &AppHandle, mode: &str) {
    // Kısayola basıldığı salisede (henüz capture penceresi odak almadan önce!)
    // o an açık olan dış uygulama, sekme başlığını ve ekran görüntüsünü yakala.
    let fresh_fg = platform_fg::inspect_external_foreground();
    let pre_shot = if mode == "distraction" {
        platform_fg::capture_screen_data_url(840)
    } else {
        None
    };

    let payload = {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let mut guard = match state.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if let Some((info, hwnd)) = fresh_fg {
            guard.last_external = info;
            if hwnd != 0 {
                guard.last_external_hwnd = hwnd;
            }
        }
        if let Some(shot) = pre_shot {
            guard.last_screenshot_data_url = shot;
        }
        guard.open_seq = guard.open_seq.wrapping_add(1);
        guard.capture_opened_at_ms = now_ms();
        let p = CaptureOpenPayload {
            mode: mode.to_string(),
            open_seq: guard.open_seq,
            active_app: guard.last_external.app_name.clone(),
            active_window: guard.last_external.window_title.clone(),
            snapshot: guard.snapshot.clone(),
        };
        guard.active_payload = p.clone();
        p
    };

    if let Some(cap_win) = app.get_webview_window("capture") {
        let _ = cap_win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(540.0, 205.0)));
        let _ = cap_win.center();
        let _ = cap_win.show();
        let _ = cap_win.unminimize();
        let _ = cap_win.set_focus();
        let _ = cap_win.emit("open-capture", payload);
    }
}

fn apply_shortcuts_internal(
    app: &AppHandle,
    distraction_str: String,
    context_str: String,
) -> ShortcutStatus {
    let _ = app.global_shortcut().unregister_all();

    let d_trimmed = distraction_str.trim().to_string();
    let c_trimmed = context_str.trim().to_string();

    let mut d_ok = false;
    let mut d_err = None;
    let mut parsed_d = None;

    if !d_trimmed.is_empty() {
        match Shortcut::from_str(&d_trimmed) {
            Ok(sc) => match app.global_shortcut().register(sc) {
                Ok(_) => {
                    d_ok = true;
                    parsed_d = Some(sc);
                }
                Err(e) => d_err = Some(e.to_string()),
            },
            Err(e) => d_err = Some(e.to_string()),
        }
    }

    let mut c_ok = false;
    let mut c_err = None;
    let mut parsed_c = None;

    if !c_trimmed.is_empty() {
        if c_trimmed.eq_ignore_ascii_case(&d_trimmed) {
            c_err = Some("İki kısayol aynı olamaz.".to_string());
        } else {
            match Shortcut::from_str(&c_trimmed) {
                Ok(sc) => match app.global_shortcut().register(sc) {
                    Ok(_) => {
                        c_ok = true;
                        parsed_c = Some(sc);
                    }
                    Err(e) => c_err = Some(e.to_string()),
                },
                Err(e) => c_err = Some(e.to_string()),
            }
        }
    }

    {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let mut guard = match state.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.distraction_shortcut = d_trimmed.clone();
        guard.context_shortcut = c_trimmed.clone();
        guard.parsed_distraction = parsed_d;
        guard.parsed_context = parsed_c;
    }

    ShortcutStatus {
        distraction_shortcut: d_trimmed,
        context_shortcut: c_trimmed,
        distraction_ok: d_ok,
        distraction_error: d_err,
        context_ok: c_ok,
        context_error: c_err,
    }
}

// ============================================================================
// Tauri Frontend Komutları
// ============================================================================

#[tauri::command]
fn get_last_active_window(state: State<'_, Mutex<SharedCaptureState>>) -> ActiveAppInfo {
    if let Some((fresh, hwnd)) = platform_fg::inspect_external_foreground() {
        let mut guard = match state.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.last_external = fresh.clone();
        if hwnd != 0 {
            guard.last_external_hwnd = hwnd;
        }
        return fresh;
    }
    let guard = match state.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    guard.last_external.clone()
}

#[tauri::command]
fn sync_capture_snapshot(
    snapshot: FrontendContextSnapshot,
    state: State<'_, Mutex<SharedCaptureState>>,
) {
    let mut guard = match state.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    guard.snapshot = snapshot;
}

#[tauri::command]
fn get_capture_open_payload(state: State<'_, Mutex<SharedCaptureState>>) -> CaptureOpenPayload {
    let guard = match state.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    guard.active_payload.clone()
}

#[tauri::command]
fn open_quick_capture_manual(app: AppHandle, mode: String) {
    let m = if mode == "context" {
        "context"
    } else {
        "distraction"
    };
    trigger_capture_window(&app, m);
}

#[tauri::command]
fn close_capture_and_restore_focus(app: AppHandle, state: State<'_, Mutex<SharedCaptureState>>) {
    if let Some(cap_win) = app.get_webview_window("capture") {
        let _ = cap_win.hide();
        let _ = cap_win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(540.0, 205.0)));
    }
    let prev_hwnd = {
        let guard = match state.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.last_external_hwnd
    };
    platform_fg::restore_hwnd(prev_hwnd);
}

#[tauri::command]
fn update_global_shortcuts(
    app: AppHandle,
    distraction_shortcut: String,
    context_shortcut: String,
) -> ShortcutStatus {
    apply_shortcuts_internal(&app, distraction_shortcut, context_shortcut)
}

#[tauri::command]
fn capture_screen_snapshot(
    state: State<'_, Mutex<SharedCaptureState>>,
    fresh: bool,
) -> ScreenshotCapturePayload {
    if fresh {
        let fresh_fg = platform_fg::inspect_external_foreground();
        let shot = platform_fg::capture_screen_data_url(840).unwrap_or_default();
        let mut guard = match state.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if let Some((info, hwnd)) = fresh_fg {
            guard.last_external = info;
            if hwnd != 0 {
                guard.last_external_hwnd = hwnd;
            }
        }
        if !shot.is_empty() {
            guard.last_screenshot_data_url = shot.clone();
        }
        return ScreenshotCapturePayload {
            data_url: shot,
            active_app: guard.last_external.app_name.clone(),
            active_window: guard.last_external.window_title.clone(),
        };
    }

    let (cached_shot, app_name, win_title) = {
        let guard = match state.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        (
            guard.last_screenshot_data_url.clone(),
            guard.last_external.app_name.clone(),
            guard.last_external.window_title.clone(),
        )
    };

    if !cached_shot.is_empty() {
        return ScreenshotCapturePayload {
            data_url: cached_shot,
            active_app: app_name,
            active_window: win_title,
        };
    }

    let shot = platform_fg::capture_screen_data_url(840).unwrap_or_default();
    if !shot.is_empty() {
        if let Ok(mut guard) = state.lock() {
            guard.last_screenshot_data_url = shot.clone();
        }
    }
    ScreenshotCapturePayload {
        data_url: shot,
        active_app: app_name,
        active_window: win_title,
    }
}

#[tauri::command]
fn set_capture_window_size(app: AppHandle, width: f64, height: f64) {
    if let Some(cap_win) = app.get_webview_window("capture") {
        let _ = cap_win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)));
        let _ = cap_win.center();
    }
}

#[tauri::command]
fn update_tray_tooltip(app: AppHandle, tooltip: String) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SharedCaptureState::default()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let target_mode = {
                        let state = app.state::<Mutex<SharedCaptureState>>();
                        let guard = match state.lock() {
                            Ok(g) => g,
                            Err(p) => p.into_inner(),
                        };
                        if guard.parsed_distraction.as_ref() == Some(shortcut) {
                            Some("distraction")
                        } else if guard.parsed_context.as_ref() == Some(shortcut) {
                            Some("context")
                        } else {
                            None
                        }
                    };
                    if let Some(mode) = target_mode {
                        trigger_capture_window(app, mode);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_last_active_window,
            sync_capture_snapshot,
            get_capture_open_payload,
            open_quick_capture_manual,
            close_capture_and_restore_focus,
            update_global_shortcuts,
            capture_screen_snapshot,
            set_capture_window_size,
            update_tray_tooltip,
        ])
        .setup(|app| {
            // Varsayılan kısayolları başlat (React açılınca kullanıcının kayıtlı kısayollarıyla günceller)
            let _ = apply_shortcuts_internal(
                app.handle(),
                "Ctrl+Shift+D".to_string(),
                "Ctrl+Alt+C".to_string(),
            );

            // Windows'ta arka planda son aktif dış pencere/sekme bilgisini hafifçe takip et
            // (Böylece kullanıcı fareyle widget üzerindeki "Dağıldım" butonuna tıkladığında bile
            // az önce hangi sekmede olduğu kesin olarak bilinir!)
            #[cfg(target_os = "windows")]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(Duration::from_millis(1200));
                    if let Some((info, hwnd)) = platform_fg::inspect_external_foreground() {
                        let state = handle.state::<Mutex<SharedCaptureState>>();
                        if let Ok(mut guard) = state.lock() {
                            guard.last_external = info;
                            if hwnd != 0 {
                                guard.last_external_hwnd = hwnd;
                            }
                        };
                    }
                });
            }

            let restore_i =
                MenuItem::with_id(app, "restore", "Pencereyi Aç", true, None::<&str>)?;
            let quick_dist_i = MenuItem::with_id(
                app,
                "quick_distract",
                "⚡ Hızlı Yakala (Dikkat / Görev)",
                true,
                None::<&str>,
            )?;
            let quick_ctx_i = MenuItem::with_id(
                app,
                "quick_context",
                "🎯 Meşguliyet (Context) Yaz",
                true,
                None::<&str>,
            )?;
            let minidock_i = MenuItem::with_id(
                app,
                "minidock",
                "Sağ Alt Mini Sayaç",
                true,
                None::<&str>,
            )?;
            let toggle_i =
                MenuItem::with_id(app, "toggle", "Tepsiye Gizle / Göster", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Tamamen Çık", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &restore_i,
                    &quick_dist_i,
                    &quick_ctx_i,
                    &minidock_i,
                    &toggle_i,
                    &quit_i,
                ],
            )?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .tooltip("Pomodoro Zamanlayıcı")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "restore" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                            let _ = win.emit("tray-restore", ());
                        }
                    }
                    "quick_distract" => {
                        trigger_capture_window(app, "distraction");
                    }
                    "quick_context" => {
                        trigger_capture_window(app, "context");
                    }
                    "minidock" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.emit("request-mini-dock", ());
                        }
                    }
                    "toggle" => {
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.unminimize();
                                let _ = win.set_focus();
                                let _ = win.emit("tray-restore", ());
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                            let _ = win.emit("tray-restore", ());
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label();
            if label == "capture" {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    WindowEvent::Focused(false) => {
                        let elapsed = {
                            let state = window.app_handle().state::<Mutex<SharedCaptureState>>();
                            state
                                .lock()
                                .map(|g| now_ms().saturating_sub(g.capture_opened_at_ms))
                                .unwrap_or(1000)
                        };
                        if elapsed > 350 {
                            let _ = window.hide();
                        }
                    }
                    _ => {}
                }
                return;
            }

            // Ana pencere: Çarpıya veya Alt+F4'e basıldığında uygulamayı kapatma; sağ alt mini sayaç moduna geçir
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.show();
                let _ = window.emit("request-mini-dock", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
