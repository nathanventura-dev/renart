use crate::capture::{selection_to_physical, MonitorInfo, Selection};
use image::RgbaImage;
use std::collections::HashMap;
use std::sync::Mutex;

/// Eventos emitidos ao frontend (os mesmos nomes existem em `src/services/captureService.ts`).
pub const EVENT_CAPTURE_COMPLETE: &str = "capture-complete";
pub const EVENT_CAPTURE_CANCELLED: &str = "capture-cancelled";
pub const EVENT_OVERLAY_MODE: &str = "overlay-mode-changed";

/// Código de erro devolvido quando a permissão de Gravação de Tela está negada.
pub const DENIED_ERROR: &str = "screen-recording-denied";

/// Label da janela de overlay de um monitor.
pub fn overlay_label(id: u32) -> String {
    format!("capture-overlay-{id}")
}

/// Quadros congelados de todos os monitores durante uma captura.
pub struct CaptureSession {
    mode: String,
    monitors: Vec<MonitorInfo>,
    frames: HashMap<u32, RgbaImage>,
}

impl CaptureSession {
    pub fn new(mode: String, monitors: Vec<MonitorInfo>, frames: HashMap<u32, RgbaImage>) -> Self {
        Self { mode, monitors, frames }
    }

    pub fn mode(&self) -> &str {
        &self.mode
    }

    pub fn monitors(&self) -> &[MonitorInfo] {
        &self.monitors
    }

    pub fn monitor(&self, id: u32) -> Result<&MonitorInfo, String> {
        self.monitors
            .iter()
            .find(|m| m.id == id)
            .ok_or_else(|| format!("Monitor {id} não encontrado na sessão de captura"))
    }

    pub fn frame(&self, id: u32) -> Result<&RgbaImage, String> {
        self.frames
            .get(&id)
            .ok_or_else(|| format!("Quadro do monitor {id} não encontrado na sessão de captura"))
    }

    /// Recorta o quadro do monitor `id` conforme a seleção lógica.
    pub fn crop(&self, id: u32, selection: &Selection) -> Result<RgbaImage, String> {
        let monitor = self.monitor(id)?;
        let frame = self.frame(id)?;
        let rect = selection_to_physical(selection, monitor.width, monitor.height, frame.width(), frame.height())?;
        Ok(image::imageops::crop_imm(frame, rect.x, rect.y, rect.width, rect.height).to_image())
    }
}

pub type SessionState = Mutex<Option<CaptureSession>>;

/// Guarda a nova sessão e devolve a anterior, se existia.
pub fn replace_session(state: &SessionState, session: CaptureSession) -> Option<CaptureSession> {
    state.lock().unwrap().replace(session)
}

/// Retira a sessão atual, deixando o estado vazio.
pub fn take_session(state: &SessionState) -> Option<CaptureSession> {
    state.lock().unwrap().take()
}
