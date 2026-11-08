pub mod capture;
pub mod capture_session;
pub mod permissions;
pub mod instance;
pub mod ocr;
pub mod shortcuts;
pub mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(capture_session::SessionState::default())
        .manage(capture_session::BeginGuard::default())
        .manage(tray::TrayActive::default())
        .invoke_handler(tauri::generate_handler![
            capture::tauri_capture_screen,
            capture_session::begin_capture,
            capture_session::get_overlay_frame,
            capture_session::overlay_ready,
            capture_session::get_window_image,
            capture_session::finish_capture,
            capture_session::cancel_capture,
            capture_session::set_overlay_mode,
            capture_session::set_overlay_ui_rect,
            ocr::detect_text_in_region
        ])
        .setup(|app| {
            if let Err(err) = shortcuts::register_global_shortcuts(app.handle()) {
                eprintln!("Não foi possível registrar o atalho global: {err}");
            }
            // Sem bandeja (ambiente sem suporte) o app segue sem ícone, e fechar a janela encerra o app.
            if let Err(err) = tray::setup_tray(app) {
                eprintln!("Não foi possível criar o ícone da bandeja: {err}");
            }
            // Com a bandeja ativa, fechar a janela só a esconde: o app e o atalho global continuam.
            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                let hidden = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if handle.state::<tray::TrayActive>().0.load(std::sync::atomic::Ordering::SeqCst) {
                            api.prevent_close();
                            let _ = hidden.hide();
                        }
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: clicar no ícone do Dock com a janela escondida a reabre.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { has_visible_windows: false, .. } = event {
                capture_session::restore_main(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
