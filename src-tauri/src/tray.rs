use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager, WebviewWindow,
};

use crate::shortcuts::trigger_capture_window;
use crate::show_and_focus;

const MAIN_TRAY_ID: &str = "main-tray";

fn restore_main_window(win: &WebviewWindow) {
    show_and_focus(win);
    let _ = win.emit("tray-restore", ());
}

pub fn set_tray_tooltip(app: &AppHandle, tooltip: String) {
    if let Some(tray) = app.tray_by_id(MAIN_TRAY_ID) {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let restore_i = MenuItem::with_id(app, "restore", "Pencereyi Aç", true, None::<&str>)?;
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
    let minidock_i =
        MenuItem::with_id(app, "minidock", "Sağ Alt Mini Sayaç", true, None::<&str>)?;
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

    let mut tray_builder = TrayIconBuilder::with_id(MAIN_TRAY_ID)
        .tooltip("Pomodoro Zamanlayıcı")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "restore" => {
                if let Some(win) = app.get_webview_window("main") {
                    restore_main_window(&win);
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
                        restore_main_window(&win);
                    }
                }
            }
            "quit" => {
                crate::focus_mode::restore_focus_mode_on_exit();
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
                if let Some(win) = tray.app_handle().get_webview_window("main") {
                    restore_main_window(&win);
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}
