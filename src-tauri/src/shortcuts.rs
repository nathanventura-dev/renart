use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Nome do evento emitido ao frontend quando o atalho global de captura é acionado.
pub const CAPTURE_SHORTCUT_EVENT: &str = "global-capture-shortcut";

/// Atalho padrão de captura: `Cmd+Shift+S` no macOS e `Ctrl+Shift+S` nos demais sistemas.
pub fn default_capture_shortcut() -> Shortcut {
    let primary = if cfg!(target_os = "macos") {
        Modifiers::SUPER
    } else {
        Modifiers::CONTROL
    };
    Shortcut::new(Some(primary | Modifiers::SHIFT), Code::KeyS)
}

/// Registra os atalhos globais da aplicação e avisa o frontend via evento.
pub fn register_global_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(default_capture_shortcut(), |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                // Traz a janela para frente para a captura não abrir escondida atrás de outro app.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let _ = app.emit(CAPTURE_SHORTCUT_EVENT, ());
            }
        })
        .map_err(|e| e.to_string())
}
