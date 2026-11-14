mod active_window;
mod capture;
mod shortcuts;
mod tray;

use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, Size, State, WebviewWindow, Window, WindowEvent};
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
pub(crate) const CAPTURE_DEFAULT_HEIGHT: f64 = 205.0;

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

pub(crate) struct SharedCaptureState {
    pub last_external: ActiveAppInfo,
    pub last_external_hwnd: isize,
    pub last_screenshot_data_url: String,
    pub capture_opened_at_ms: u128,
    pub open_seq: u64,
    pub distraction_shortcut: String,
    pub context_shortcut: String,
    pub parsed_distraction: Option<Shortcut>,
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
    if let Some(cap_win) = app.get_webview_window("capture") {
        let _ = cap_win.hide();
        let _ = cap_win.set_size(Size::Logical(LogicalSize::new(
            CAPTURE_DEFAULT_WIDTH,
            CAPTURE_DEFAULT_HEIGHT,
        )));
    }
    let prev_hwnd = lock_state(&state).last_external_hwnd;
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
        resize_and_center(&cap_win, width, height);
    }
}

#[tauri::command]
fn update_tray_tooltip(app: AppHandle, tooltip: String) {
    set_tray_tooltip(&app, tooltip);
}

fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() == "capture" {
        match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) => {
                let state = window.app_handle().state::<Mutex<SharedCaptureState>>();
                let elapsed = now_ms().saturating_sub(lock_state(&state).capture_opened_at_ms);
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
