use crate::capture::{
    capture_monitor, copy_to_clipboard, image_to_png_bytes, list_monitors, overlay_geometry,
    selection_to_physical, MonitorInfo, Selection,
};
use crate::permissions::{ensure_screen_recording, screen_recording_allowed};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::RgbaImage;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

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

/// URL (relativa ao frontend) carregada por cada janela de overlay.
pub fn build_overlay_url(id: u32, mode: &str) -> String {
    format!("index.html?overlay={id}&mode={mode}")
}

/// Aceita apenas os modos suportados neste ciclo (captura de janela é o ciclo 2).
pub fn validate_mode(mode: &str) -> Result<(), String> {
    match mode {
        "region" | "fullscreen" => Ok(()),
        other => Err(format!("Modo de captura desconhecido: {other}")),
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureCompletePayload {
    data_url: String,
    fullscreen: bool,
}

const MAIN_WINDOW: &str = "main";

fn restore_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn close_overlays(app: &AppHandle, monitors: &[MonitorInfo]) {
    for m in monitors {
        if let Some(window) = app.get_webview_window(&overlay_label(m.id)) {
            let _ = window.destroy();
        }
    }
}

/// Encerra a sessão atual (se houver): fecha os overlays e devolve a janela principal.
fn end_session(app: &AppHandle, state: &SessionState) {
    if let Some(session) = take_session(state) {
        close_overlays(app, session.monitors());
    }
    restore_main(app);
}

fn to_data_url(image: &RgbaImage) -> Result<String, String> {
    let png = image_to_png_bytes(image)?;
    Ok(format!("data:image/png;base64,{}", BASE64.encode(png)))
}

/// Congela todos os monitores e abre uma janela de seleção por monitor.
#[tauri::command]
pub async fn begin_capture(
    app: AppHandle,
    state: State<'_, SessionState>,
    mode: String,
) -> Result<(), String> {
    validate_mode(&mode)?;
    ensure_screen_recording(screen_recording_allowed())?;

    // Uma captura nova substitui qualquer sessão anterior (ex.: atalho apertado duas vezes).
    if let Some(previous) = take_session(&state) {
        close_overlays(&app, previous.monitors());
    }

    // Esconde a janela principal e dá tempo ao sistema de removê-la antes de congelar as telas.
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
    let captured = tauri::async_runtime::spawn_blocking(|| {
        std::thread::sleep(std::time::Duration::from_millis(220));
        let monitors = list_monitors()?;
        let mut frames = HashMap::new();
        for m in &monitors {
            frames.insert(m.id, capture_monitor(m.id)?);
        }
        Ok::<_, String>((monitors, frames))
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);

    let (monitors, frames) = match captured {
        Ok(v) => v,
        Err(e) => {
            restore_main(&app);
            return Err(e);
        }
    };

    replace_session(&state, CaptureSession::new(mode.clone(), monitors.clone(), frames));

    for m in &monitors {
        let (x, y, w, h) = overlay_geometry(m);
        let built = WebviewWindowBuilder::new(
            &app,
            overlay_label(m.id),
            WebviewUrl::App(build_overlay_url(m.id, &mode).into()),
        )
        .title("RenArt — Captura")
        .position(x, y)
        .inner_size(w, h)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(true)
        .build();
        if let Err(e) = built {
            end_session(&app, &state);
            return Err(format!("Falha ao abrir o overlay do monitor {}: {}", m.id, e));
        }
    }
    Ok(())
}

/// Devolve o quadro congelado de um monitor como data URL PNG.
#[tauri::command]
pub async fn get_overlay_frame(state: State<'_, SessionState>, id: u32) -> Result<String, String> {
    let guard = state.lock().unwrap();
    let session = guard
        .as_ref()
        .ok_or_else(|| "Nenhuma captura em andamento".to_string())?;
    to_data_url(session.frame(id)?)
}

/// Recorta a seleção, copia para o clipboard, fecha os overlays e entrega o resultado à janela principal.
#[tauri::command]
pub async fn finish_capture(
    app: AppHandle,
    state: State<'_, SessionState>,
    id: u32,
    selection: Selection,
) -> Result<(), String> {
    let session = take_session(&state).ok_or_else(|| "Nenhuma captura em andamento".to_string())?;
    let monitors = session.monitors().to_vec();

    let result = session
        .crop(id, &selection)
        .and_then(|img| image_to_png_bytes(&img).map(|png| (img, png)));

    close_overlays(&app, &monitors);
    restore_main(&app);

    match result {
        Ok((img, png)) => {
            let _ = copy_to_clipboard(&png);
            let payload = CaptureCompletePayload {
                data_url: to_data_url(&img)?,
                fullscreen: matches!(selection, Selection::Fullscreen),
            };
            app.emit(EVENT_CAPTURE_COMPLETE, payload).map_err(|e| e.to_string())
        }
        Err(e) => {
            let _ = app.emit(EVENT_CAPTURE_CANCELLED, ());
            Err(e)
        }
    }
}

/// Cancela a captura (idempotente): fecha os overlays e devolve a janela principal.
#[tauri::command]
pub async fn cancel_capture(app: AppHandle, state: State<'_, SessionState>) -> Result<(), String> {
    end_session(&app, &state);
    app.emit(EVENT_CAPTURE_CANCELLED, ()).map_err(|e| e.to_string())
}

/// Troca o modo (região ↔ tela inteira) em todos os overlays abertos.
#[tauri::command]
pub async fn set_overlay_mode(app: AppHandle, mode: String) -> Result<(), String> {
    validate_mode(&mode)?;
    app.emit(EVENT_OVERLAY_MODE, mode).map_err(|e| e.to_string())
}
