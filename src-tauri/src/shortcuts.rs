use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::active_window::inspect_external_foreground;
use crate::{
    lock_state, now_ms, resize_and_center, show_and_focus, CaptureOpenPayload, SharedCaptureState,
    CAPTURE_DEFAULT_HEIGHT, CAPTURE_DEFAULT_WIDTH,
};

pub const DEFAULT_DISTRACTION_SHORTCUT: &str = "Ctrl+Alt+D";
pub const DEFAULT_CONTEXT_SHORTCUT: &str = "";

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
    // Capture the active external app/tab just before the capture window takes focus.
    let fresh_fg = inspect_external_foreground();

    let payload = {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let mut guard = lock_state(&state);
        if let Some((info, hwnd)) = fresh_fg {
            guard.update_external(info, hwnd);
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
        let scale = (payload.snapshot.ui_scale.max(100) as f64) / 100.0;
        resize_and_center(
            &cap_win,
            (CAPTURE_DEFAULT_WIDTH * scale).round(),
            (CAPTURE_DEFAULT_HEIGHT * scale).round(),
        );
        let _ = cap_win.set_zoom(scale);
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
    _context_str: String,
) -> ShortcutStatus {
    let _ = app.global_shortcut().unregister_all();

    let d_trimmed = distraction_str.trim().to_string();
    let (d_ok, d_err, parsed_d) = register_single_shortcut(app, &d_trimmed);

    let alt_str = if d_trimmed.eq_ignore_ascii_case("Ctrl+Alt+D") {
        Some("Ctrl+Shift+D")
    } else if d_trimmed.eq_ignore_ascii_case("Ctrl+Shift+D") {
        Some("Ctrl+Alt+D")
    } else {
        None
    };
    let parsed_d_alt = alt_str.and_then(|s| register_single_shortcut(app, s).2);

    {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let mut guard = lock_state(&state);
        guard.distraction_shortcut = d_trimmed.clone();
        guard.context_shortcut = String::new();
        guard.parsed_distraction = parsed_d;
        guard.parsed_distraction_alt = parsed_d_alt;
        guard.parsed_context = None;
    }

    ShortcutStatus {
        distraction_shortcut: d_trimmed,
        context_shortcut: String::new(),
        distraction_ok: d_ok,
        distraction_error: d_err,
        context_ok: false,
        context_error: None,
    }
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state != ShortcutState::Pressed {
        return;
    }
    let target_mode = {
        let state = app.state::<Mutex<SharedCaptureState>>();
        let guard = lock_state(&state);
        if guard.parsed_distraction.as_ref() == Some(shortcut)
            || guard.parsed_distraction_alt.as_ref() == Some(shortcut)
        {
            Some("distraction")
        } else {
            None
        }
    };
    if let Some(mode) = target_mode {
        trigger_capture_window(app, mode);
    }
}
