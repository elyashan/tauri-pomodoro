mod active_window;
mod capture;
mod focus_mode;
mod shortcuts;
mod tray;

use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, Position, Size, State, UserAttentionType,
    WebviewWindow, Window, WindowEvent,
};

static SHAKE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::Shortcut;

use active_window::{inspect_external_foreground, restore_hwnd, spawn_foreground_watcher, ActiveAppInfo};
use capture::{capture_snapshot, ScreenshotCapturePayload};
use shortcuts::{
    apply_shortcuts, handle_shortcut_event, trigger_capture_window, ShortcutStatus,
    DEFAULT_CONTEXT_SHORTCUT, DEFAULT_DISTRACTION_SHORTCUT,
};
use tray::{set_tray_tooltip, setup_tray};

pub(crate) const CAPTURE_DEFAULT_WIDTH: f64 = 540.0;
pub(crate) const CAPTURE_DEFAULT_HEIGHT: f64 = 290.0;

// ============================================================================
// Paylaşılan Yakalama Durumu (Main <-> Capture Penceresi Köprüsü)
// ============================================================================

fn default_ui_scale() -> u32 {
    100
}

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
    #[serde(default = "default_ui_scale")]
    pub ui_scale: u32,
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
            ui_scale: 100,
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

pub(crate) struct SharedCaptureState {
    pub last_external: ActiveAppInfo,
    pub last_external_hwnd: isize,
    pub last_screenshot_data_url: String,
    pub capture_opened_at_ms: u128,
    pub open_seq: u64,
    pub distraction_shortcut: String,
    pub context_shortcut: String,
    pub parsed_distraction: Option<Shortcut>,
    pub parsed_distraction_alt: Option<Shortcut>,
    pub parsed_context: Option<Shortcut>,
    pub snapshot: FrontendContextSnapshot,
    pub active_payload: CaptureOpenPayload,
}

impl Default for SharedCaptureState {
    fn default() -> Self {
        let d_str = DEFAULT_DISTRACTION_SHORTCUT.to_string();
        let c_str = DEFAULT_CONTEXT_SHORTCUT.to_string();
        Self {
            last_external: ActiveAppInfo::default(),
            last_external_hwnd: 0,
            last_screenshot_data_url: String::new(),
            capture_opened_at_ms: 0,
            open_seq: 0,
            parsed_distraction: Shortcut::from_str(&d_str).ok(),
            parsed_distraction_alt: Shortcut::from_str("Ctrl+Shift+D").ok(),
            parsed_context: Shortcut::from_str(&c_str).ok(),
            distraction_shortcut: d_str,
            context_shortcut: c_str,
            snapshot: FrontendContextSnapshot::default(),
            active_payload: CaptureOpenPayload::default(),
        }
    }
}

impl SharedCaptureState {
    pub fn update_external(&mut self, info: ActiveAppInfo, hwnd: isize) {
        self.last_external = info;
        if hwnd != 0 {
            self.last_external_hwnd = hwnd;
        }
    }
}

pub(crate) fn lock_state(mutex: &Mutex<SharedCaptureState>) -> MutexGuard<'_, SharedCaptureState> {
    mutex.lock().unwrap_or_else(|p| p.into_inner())
}

pub(crate) fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub(crate) fn show_and_focus(win: &WebviewWindow) {
    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_focus();
}

pub(crate) fn resize_and_center(win: &WebviewWindow, width: f64, height: f64) {
    let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));
    let _ = win.center();
}

// ============================================================================
// Tauri Frontend Komutları
// ============================================================================

#[tauri::command]
fn get_last_active_window(state: State<'_, Mutex<SharedCaptureState>>) -> ActiveAppInfo {
    if let Some((fresh, hwnd)) = inspect_external_foreground() {
        let mut guard = lock_state(&state);
        guard.update_external(fresh.clone(), hwnd);
        return fresh;
    }
    lock_state(&state).last_external.clone()
}

#[tauri::command]
fn sync_capture_snapshot(
    snapshot: FrontendContextSnapshot,
    state: State<'_, Mutex<SharedCaptureState>>,
) {
    lock_state(&state).snapshot = snapshot;
}

#[tauri::command]
fn set_window_zoom(caller: WebviewWindow, app: AppHandle, zoom: f64) {
    let safe_zoom = zoom.clamp(0.5, 2.5);
    if caller.label() == "main" {
        for label in ["main", "capture"] {
            if let Some(win) = app.get_webview_window(label) {
                let _ = win.set_zoom(safe_zoom);
            }
        }
    } else {
        let _ = caller.set_zoom(safe_zoom);
    }
}

#[tauri::command]
fn get_capture_open_payload(state: State<'_, Mutex<SharedCaptureState>>) -> CaptureOpenPayload {
    lock_state(&state).active_payload.clone()
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
    let (prev_hwnd, scale) = {
        let guard = lock_state(&state);
        (
            guard.last_external_hwnd,
            (guard.snapshot.ui_scale.max(100) as f64) / 100.0,
        )
    };
    if let Some(cap_win) = app.get_webview_window("capture") {
        let _ = cap_win.hide();
        let _ = cap_win.set_size(Size::Logical(LogicalSize::new(
            (CAPTURE_DEFAULT_WIDTH * scale).round(),
            (CAPTURE_DEFAULT_HEIGHT * scale).round(),
        )));
    }
    restore_hwnd(prev_hwnd);
}

#[tauri::command]
fn update_global_shortcuts(
    app: AppHandle,
    distraction_shortcut: String,
    context_shortcut: String,
) -> ShortcutStatus {
    apply_shortcuts(&app, distraction_shortcut, context_shortcut)
}

#[tauri::command]
fn capture_screen_snapshot(
    state: State<'_, Mutex<SharedCaptureState>>,
    fresh: bool,
) -> ScreenshotCapturePayload {
    capture_snapshot(&state, fresh)
}

#[tauri::command]
fn set_capture_window_size(app: AppHandle, width: f64, height: f64) {
    if let Some(cap_win) = app.get_webview_window("capture") {
        let _ = cap_win.set_size(Size::Logical(LogicalSize::new(width, height)));
    }
}

#[tauri::command]
fn update_tray_tooltip(app: AppHandle, tooltip: String) {
    set_tray_tooltip(&app, tooltip);
}

#[tauri::command]
fn set_windows_focus_mode(enabled: bool) {
    focus_mode::set_focus_mode(enabled);
}

#[tauri::command]
fn get_system_idle_secs() -> u64 {
    active_window::get_system_idle_secs()
}

#[tauri::command]
fn did_os_sleep_since(since_ms: u64) -> bool {
    active_window::did_os_sleep_since(since_ms)
}

struct ShakeResetGuard;
impl Drop for ShakeResetGuard {
    fn drop(&mut self) {
        SHAKE_IN_PROGRESS.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
fn alert_break_started(app: AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.request_user_attention(Some(UserAttentionType::Critical));

    if SHAKE_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    std::thread::spawn(move || {
        let _guard = ShakeResetGuard;
        let Ok(orig) = win.outer_position() else {
            return;
        };

        let mut expected_x = orig.x;
        let expected_y = orig.y;
        let mut run_burst = |offsets: &[i32]| -> bool {
            for &dx in offsets {
                if let Ok(cur) = win.outer_position() {
                    if (cur.x - expected_x).abs() > 24 || (cur.y - expected_y).abs() > 24 {
                        return false;
                    }
                }
                let nx = orig.x + dx;
                if win
                    .set_position(Position::Physical(PhysicalPosition::new(nx, orig.y)))
                    .is_err()
                {
                    return false;
                }
                expected_x = nx;
                std::thread::sleep(std::time::Duration::from_millis(28));
            }
            true
        };

        if !run_burst(&[-10, 10, -8, 8, -5, 5, -2, 2, 0]) {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(320));
        if !run_burst(&[-7, 7, -4, 4, 0]) {
            return;
        }
        let _ = win.set_position(Position::Physical(orig));
    });
}

fn resolve_backup_dir(app: &AppHandle) -> std::path::PathBuf {
    if let Ok(dir) = app.path().download_dir() {
        return dir;
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let dl = std::path::PathBuf::from(profile).join("Downloads");
        if dl.exists() {
            return dl;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
}

#[tauri::command]
fn get_backup_export_dir(app: AppHandle) -> String {
    resolve_backup_dir(&app).to_string_lossy().to_string()
}

#[tauri::command]
fn save_backup_json(app: AppHandle, filename: String, content: String) -> Result<String, String> {
    let dir = resolve_backup_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("pomodoro-backup.json");
    let full_path = dir.join(safe_name);
    std::fs::write(&full_path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(full_path.to_string_lossy().to_string())
}

fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() == "capture" {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
        return;
    }

    // Ana pencere: Çarpıya veya Alt+F4'e basıldığında uygulamayı kapatma; sistem tepsisine (tray) gizle
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
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
                .with_handler(handle_shortcut_event)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_last_active_window,
            sync_capture_snapshot,
            set_window_zoom,
            get_capture_open_payload,
            open_quick_capture_manual,
            close_capture_and_restore_focus,
            update_global_shortcuts,
            capture_screen_snapshot,
            set_capture_window_size,
            update_tray_tooltip,
            set_windows_focus_mode,
            get_system_idle_secs,
            did_os_sleep_since,
            alert_break_started,
            get_backup_export_dir,
            save_backup_json,
        ])
        .setup(|app| {
            // Varsayılan kısayolları başlat (React açılınca kullanıcının kayıtlı kısayollarıyla günceller)
            let _ = apply_shortcuts(
                app.handle(),
                DEFAULT_DISTRACTION_SHORTCUT.to_string(),
                DEFAULT_CONTEXT_SHORTCUT.to_string(),
            );

            // Windows'ta arka planda son aktif dış pencere/sekme bilgisini hafifçe takip et
            // (Böylece kullanıcı fareyle widget üzerindeki "Dağıldım" butonuna tıkladığında bile
            // az önce hangi sekmede olduğu kesin olarak bilinir!)
            spawn_foreground_watcher(app.handle());

            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
