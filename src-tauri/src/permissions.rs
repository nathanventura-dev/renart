use crate::capture_session::DENIED_ERROR;

/// Converte "permissão concedida?" em `Result`, com o código de erro que o frontend entende.
pub fn ensure_screen_recording(allowed: bool) -> Result<(), String> {
    if allowed {
        Ok(())
    } else {
        Err(DENIED_ERROR.to_string())
    }
}

/// Consulta a permissão; se ainda não foi concedida, pede ao sistema. O pedido abre o diálogo do
/// macOS na primeira vez e faz o app aparecer na lista de Gravação de Tela.
pub fn allowed_with(preflight: impl Fn() -> bool, request: impl Fn() -> bool) -> bool {
    preflight() || request()
}

/// Informa se o app pode gravar a tela, pedindo a permissão ao macOS quando ainda não existe.
/// Nos demais sistemas não há permissão equivalente.
#[cfg(target_os = "macos")]
pub fn screen_recording_allowed() -> bool {
    let access = core_graphics::access::ScreenCaptureAccess;
    allowed_with(|| access.preflight(), || access.request())
}

#[cfg(not(target_os = "macos"))]
pub fn screen_recording_allowed() -> bool {
    true
}
