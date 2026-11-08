use crate::capture_session::{report_start_error, start_capture, BeginGuard};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Atalho padrão de captura: `Cmd+Shift+S` no macOS e `Ctrl+Shift+S` nos demais sistemas.
pub fn default_capture_shortcut() -> Shortcut {
    let primary = if cfg!(target_os = "macos") {
        Modifiers::SUPER
    } else {
        Modifiers::CONTROL
    };
    Shortcut::new(Some(primary | Modifiers::SHIFT), Code::KeyS)
}

/// Registra os atalhos globais. O atalho inicia a captura de área direto no Rust, sem mostrar a janela
/// principal (com o app na bandeja ela deve continuar escondida). Se falhar, a janela abre com o aviso.
pub fn register_global_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(default_capture_shortcut(), |app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            // Uma captura ainda congelando as telas: ignora o segundo pedido.
            if app.state::<BeginGuard>().is_busy() {
                return;
            }
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = start_capture(&app, "region".to_string()).await {
                    report_start_error(&app, &error);
                }
            });
        })
        .map_err(|e| e.to_string())
}
