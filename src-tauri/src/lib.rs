use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let restore_i =
                MenuItem::with_id(app, "restore", "Pencereyi Aç", true, None::<&str>)?;
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
            let menu = Menu::with_items(app, &[&restore_i, &minidock_i, &toggle_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
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
        // Çarpıya veya Alt+F4'e basıldığında uygulamayı kapatma; sağ alt mini sayaç moduna geçir
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.show();
                let _ = window.emit("request-mini-dock", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
