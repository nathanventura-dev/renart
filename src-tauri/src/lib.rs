pub mod capture;
pub mod instance;
pub mod ocr;
pub mod shortcuts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            capture::tauri_capture_screen,
            ocr::detect_text_in_region
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
