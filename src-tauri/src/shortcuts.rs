use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::active_window::inspect_external_foreground;
use crate::capture::{capture_screen_data_url, DEFAULT_CAPTURE_MAX_WIDTH};
use crate::{
    lock_state, now_ms, resize_and_center, show_and_focus, CaptureOpenPayload, SharedCaptureState,
    CAPTURE_DEFAULT_HEIGHT, CAPTURE_DEFAULT_WIDTH,
};

pub const DEFAULT_DISTRACTION_SHORTCUT: &str = "Ctrl+Shift+D";
pub const DEFAULT_CONTEXT_SHORTCUT: &str = "Ctrl+Alt+C";

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

pub fn trigger_capture_window(app: &AppHandle, mode: &str) {
    // Kısayola basıldığı salisede (henüz capture penceresi odak almadan önce!)
    // o an açık olan dış uygulama, sekme başlığını ve ekran görüntüsünü yakala.
    let fresh_fg = inspect_external_foreground();
    let pre_shot = if mode == "distraction" {
        capture_screen_data_url(DEFAULT_CAPTURE_MAX_WIDTH)
    } else {
        None
    };

    let payload = {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let mut guard = lock_state(&state);
        if let Some((info, hwnd)) = fresh_fg {
            guard.update_external(info, hwnd);
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
        resize_and_center(&cap_win, CAPTURE_DEFAULT_WIDTH, CAPTURE_DEFAULT_HEIGHT);
        show_and_focus(&cap_win);
        let _ = cap_win.emit("open-capture", payload);
    }
}

fn register_single_shortcut(
    app: &AppHandle,
    raw: &str,
) -> (bool, Option<String>, Option<Shortcut>) {
    if raw.is_empty() {
        return (false, None, None);
    }
    match Shortcut::from_str(raw) {
        Ok(sc) => match app.global_shortcut().register(sc) {
            Ok(_) => (true, None, Some(sc)),
            Err(e) => (false, Some(e.to_string()), None),
        },
        Err(e) => (false, Some(e.to_string()), None),
    }
}

pub fn apply_shortcuts(
    app: &AppHandle,
    distraction_str: String,
    context_str: String,
) -> ShortcutStatus {
    let _ = app.global_shortcut().unregister_all();

    let d_trimmed = distraction_str.trim().to_string();
    let c_trimmed = context_str.trim().to_string();

    let (d_ok, d_err, parsed_d) = register_single_shortcut(app, &d_trimmed);

    let (c_ok, c_err, parsed_c) =
        if !c_trimmed.is_empty() && c_trimmed.eq_ignore_ascii_case(&d_trimmed) {
            (false, Some("İki kısayol aynı olamaz.".to_string()), None)
        } else {
            register_single_shortcut(app, &c_trimmed)
        };

    {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let mut guard = lock_state(&state);
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

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state != ShortcutState::Pressed {
        return;
    }
    let target_mode = {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let guard = lock_state(&state);
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
}
