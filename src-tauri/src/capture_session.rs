use crate::capture::{
    capture_monitor, copy_to_clipboard, cursor_position, frame_to_bmp, image_to_png_bytes, left_button_down,
    list_monitors, monitor_at, overlay_geometry, selection_to_physical, MonitorInfo, Selection,
};
use crate::permissions::{ensure_screen_recording, screen_recording_allowed};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::RgbaImage;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Eventos emitidos ao frontend (os mesmos nomes existem em `src/services/captureService.ts`).
pub const EVENT_CAPTURE_COMPLETE: &str = "capture-complete";
pub const EVENT_CAPTURE_CANCELLED: &str = "capture-cancelled";
pub const EVENT_OVERLAY_MODE: &str = "overlay-mode-changed";
pub const EVENT_ACTIVE_MONITOR: &str = "overlay-active-monitor";

/// Código de erro devolvido quando a permissão de Gravação de Tela está negada.
pub const DENIED_ERROR: &str = "screen-recording-denied";

/// Label da janela de overlay de um monitor.
pub fn overlay_label(id: u32) -> String {
    format!("capture-overlay-{id}")
}

/// Quadros congelados de todos os monitores durante uma captura.
static NEXT_GENERATION: AtomicU64 = AtomicU64::new(1);

pub struct CaptureSession {
    generation: u64,
    mode: String,
    monitors: Vec<MonitorInfo>,
    frames: HashMap<u32, RgbaImage>,
}

impl CaptureSession {
    pub fn new(mode: String, monitors: Vec<MonitorInfo>, frames: HashMap<u32, RgbaImage>) -> Self {
        Self { generation: NEXT_GENERATION.fetch_add(1, Ordering::SeqCst), mode, monitors, frames }
    }

    /// Identifica a sessão: o rastreador do cursor e o temporizador de segurança só agem sobre a sua.
    pub fn generation(&self) -> u64 {
        self.generation
    }

    pub fn set_mode(&mut self, mode: String) {
        self.mode = mode;
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

/// Impede que duas capturas comecem ao mesmo tempo (ex.: atalho global apertado duas vezes).
#[derive(Default)]
pub struct BeginGuard(AtomicBool);

/// Permissão de iniciar uma captura; libera o `BeginGuard` quando sai de escopo.
pub struct BeginPermit<'a>(&'a AtomicBool);

impl BeginGuard {
    pub fn try_acquire(&self) -> Option<BeginPermit<'_>> {
        if self.0.swap(true, Ordering::SeqCst) {
            None
        } else {
            Some(BeginPermit(&self.0))
        }
    }

    pub fn is_busy(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

impl Drop for BeginPermit<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Copia o quadro sob o lock e converte fora dele, para outros comandos (Esc, finish) não esperarem.
pub fn frame_bytes_with(
    state: &SessionState,
    id: u32,
    convert: impl FnOnce(&RgbaImage) -> Result<Vec<u8>, String>,
) -> Result<Vec<u8>, String> {
    let frame = {
        let guard = state.lock().unwrap();
        let session = guard
            .as_ref()
            .ok_or_else(|| "Nenhuma captura em andamento".to_string())?;
        session.frame(id)?.clone()
    };
    convert(&frame)
}

/// Cursor que os overlays devem mostrar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverlayCursor {
    Crosshair,
    Default,
}

/// Mira (+) para selecionar uma área; cursor normal na tela inteira (a câmera é desenhada na página).
pub fn cursor_for_mode(mode: &str) -> OverlayCursor {
    if mode == "region" {
        OverlayCursor::Crosshair
    } else {
        OverlayCursor::Default
    }
}

/// Define o cursor do sistema. O webview de uma janela sem foco não recebe movimento do mouse e, com
/// isso, não aplica o `cursor: crosshair` da página; por isso o Rust reaplica a cada tick.
/// `NSCursor` só pode ser alterado na thread principal.
#[cfg(target_os = "macos")]
fn apply_overlay_cursor(app: &AppHandle, cursor: OverlayCursor) {
    let _ = app.run_on_main_thread(move || {
        use objc2_app_kit::NSCursor;
        let ns_cursor = match cursor {
            OverlayCursor::Crosshair => NSCursor::crosshairCursor(),
            OverlayCursor::Default => NSCursor::arrowCursor(),
        };
        ns_cursor.set();
    });
}

#[cfg(not(target_os = "macos"))]
fn apply_overlay_cursor(_app: &AppHandle, _cursor: OverlayCursor) {}

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

#[derive(Clone, Serialize)]
struct ActiveMonitorPayload {
    id: u32,
}

const MAIN_WINDOW: &str = "main";

fn show_overlays(app: &AppHandle, monitors: &[MonitorInfo]) {
    for m in monitors {
        if let Some(window) = app.get_webview_window(&overlay_label(m.id)) {
            let _ = window.show();
        }
    }
}

/// Segurança: se algum overlay não avisar que está pronto, mostra todos após 3s para o app não ficar invisível.
fn spawn_show_fallback(app: AppHandle, generation: u64, monitors: Vec<MonitorInfo>) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        let same = {
            let state = app.state::<SessionState>();
            let guard = state.lock().unwrap();
            guard.as_ref().map(|s| s.generation()) == Some(generation)
        };
        if same {
            show_overlays(&app, &monitors);
        }
    });
}

/// Acompanha o cursor (~60Hz): descobre o monitor sob ele, avisa os overlays e passa o foco para o
/// overlay daquele monitor, porque o webview de uma janela sem foco não recebe eventos de mouse.
/// Com o botão pressionado o foco não muda, para não interromper um arrasto.
fn spawn_cursor_tracker(app: AppHandle, generation: u64, monitors: Vec<MonitorInfo>) {
    std::thread::spawn(move || {
        let mut desired: Option<u32> = None;
        let mut focused: Option<u32> = None;
        let mut tick: u32 = 0;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(16));
            tick = tick.wrapping_add(1);
            let mode = {
                let state = app.state::<SessionState>();
                let guard = state.lock().unwrap();
                guard
                    .as_ref()
                    .filter(|s| s.generation() == generation)
                    .map(|s| s.mode().to_string())
            };
            let Some(mode) = mode else {
                apply_overlay_cursor(&app, OverlayCursor::Default);
                break;
            };
            let Some((x, y)) = cursor_position() else { break };
            apply_overlay_cursor(&app, cursor_for_mode(&mode));
            if let Some(id) = monitor_at(&monitors, x, y) {
                // Reenvia a cada ~320ms: um overlay que acabou de abrir ainda pode não estar ouvindo.
                if desired != Some(id) || tick % 20 == 0 {
                    let _ = app.emit(EVENT_ACTIVE_MONITOR, ActiveMonitorPayload { id });
                }
                desired = Some(id);
            }
            if let Some(id) = desired {
                if focused != Some(id) && !left_button_down() {
                    if let Some(window) = app.get_webview_window(&overlay_label(id)) {
                        if window.is_visible().unwrap_or(false) && window.set_focus().is_ok() {
                            focused = Some(id);
                        }
                    }
                }
            }
        }
    });
}

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
    guard: State<'_, BeginGuard>,
    mode: String,
) -> Result<(), String> {
    validate_mode(&mode)?;
    // Segundo pedido enquanto o primeiro ainda está congelando as telas: ignora, em vez de derrubar o primeiro.
    let Some(_permit) = guard.try_acquire() else {
        return Ok(());
    };
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
        .visible(false)
        .accept_first_mouse(true)
        .build();
        match built {
            Ok(window) => {
                // Se o sistema fechar um overlay (Cmd+W, Alt+F4), encerra a captura e devolve a janela principal.
                let handle = app.clone();
                window.on_window_event(move |event| {
                    if matches!(event, WindowEvent::CloseRequested { .. }) {
                        let handle = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            end_session(&handle, &handle.state::<SessionState>());
                            let _ = handle.emit(EVENT_CAPTURE_CANCELLED, ());
                        });
                    }
                });
            }
            Err(e) => {
                end_session(&app, &state);
                return Err(format!("Falha ao abrir o overlay do monitor {}: {}", m.id, e));
            }
        }
    }

    let generation = state.lock().unwrap().as_ref().map(|s| s.generation());
    if let Some(generation) = generation {
        spawn_show_fallback(app.clone(), generation, monitors.clone());
        spawn_cursor_tracker(app.clone(), generation, monitors);
    }
    Ok(())
}

/// Devolve o quadro congelado de um monitor como BMP cru (resposta binária, sem base64 nem codificação).
#[tauri::command]
pub async fn get_overlay_frame(app: AppHandle, id: u32) -> Result<tauri::ipc::Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SessionState>();
        frame_bytes_with(&state, id, |frame| Ok(frame_to_bmp(frame)))
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

/// O overlay avisa que o quadro já foi decodificado; só então a janela aparece (sem tela preta).
#[tauri::command]
pub async fn overlay_ready(app: AppHandle, id: u32) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&overlay_label(id)) {
        window.show().map_err(|e| e.to_string())?;
    }
    Ok(())
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
pub async fn set_overlay_mode(
    app: AppHandle,
    state: State<'_, SessionState>,
    mode: String,
) -> Result<(), String> {
    validate_mode(&mode)?;
    if let Some(session) = state.lock().unwrap().as_mut() {
        session.set_mode(mode.clone());
    }
    app.emit(EVENT_OVERLAY_MODE, mode).map_err(|e| e.to_string())
}
