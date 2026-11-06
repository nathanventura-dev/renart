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
        .invoke_handler(tauri::generate_handler![
            capture::tauri_capture_screen,
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
