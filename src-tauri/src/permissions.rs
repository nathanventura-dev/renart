use crate::capture_session::DENIED_ERROR;

/// Converte "permissão concedida?" em `Result`, com o código de erro que o frontend entende.
pub fn ensure_screen_recording(allowed: bool) -> Result<(), String> {
    if allowed {
        Ok(())
    } else {
        Err(DENIED_ERROR.to_string())
    }
}

/// Informa se o app pode gravar a tela. No macOS consulta o CoreGraphics sem exibir diálogo;
/// nos demais sistemas não há permissão equivalente.
#[cfg(target_os = "macos")]
pub fn screen_recording_allowed() -> bool {
    core_graphics::access::ScreenCaptureAccess.preflight()
}

#[cfg(not(target_os = "macos"))]
pub fn screen_recording_allowed() -> bool {
    true
}
