pub mod capture;
pub mod capture_session;
pub mod permissions;
pub mod instance;
pub mod ocr;
pub mod shortcuts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(capture_session::SessionState::default())
        .invoke_handler(tauri::generate_handler![
            capture::tauri_capture_screen,
            capture_session::begin_capture,
            capture_session::get_overlay_frame,
            capture_session::finish_capture,
            capture_session::cancel_capture,
            capture_session::set_overlay_mode,
            ocr::detect_text_in_region
        ])
        .setup(|app| {
            if let Err(err) = shortcuts::register_global_shortcuts(app.handle()) {
                eprintln!("Não foi possível registrar o atalho global: {err}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
