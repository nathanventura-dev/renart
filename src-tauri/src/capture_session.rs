use crate::capture::{
    capture_monitor, capture_window, copy_image_to_clipboard, cursor_position, encode_rgba_blob, frame_to_bmp,
    image_to_png_bytes, local_window_rect,
    left_button_down, list_monitors, list_windows, local_point, local_rects_for, monitor_at, overlay_geometry,
    resolve_window_capture, selection_to_physical, window_at, MonitorInfo, Selection, WindowInfo,
};
use crate::permissions::{ensure_screen_recording, screen_recording_allowed};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::RgbaImage;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Eventos emitidos ao frontend (os mesmos nomes existem em `src/services/captureService.ts`).
pub const EVENT_CAPTURE_COMPLETE: &str = "capture-complete";
pub const EVENT_CAPTURE_CANCELLED: &str = "capture-cancelled";
pub const EVENT_OVERLAY_MODE: &str = "overlay-mode-changed";
pub const EVENT_ACTIVE_MONITOR: &str = "overlay-active-monitor";
pub const EVENT_HOVER_WINDOW: &str = "overlay-hover-window";
/// Erro ao iniciar uma captura (bandeja ou atalho global); o payload é o código do erro.
pub const EVENT_CAPTURE_ERROR: &str = "capture-error";

/// Código de erro devolvido quando a permissão de Gravação de Tela está negada.
pub const DENIED_ERROR: &str = "screen-recording-denied";

/// Label da janela de overlay de um monitor.
pub fn overlay_label(id: u32) -> String {
    format!("capture-overlay-{id}")
}

/// Quadros congelados de todos os monitores durante uma captura.
/// Retângulo da barra de opções do overlay, em pixels lógicos relativos ao monitor.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct UiRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl UiRect {
    /// `true` se o ponto está dentro do retângulo ampliado por `margin` (início inclusivo, fim exclusivo).
    pub fn contains(&self, px: f64, py: f64, margin: f64) -> bool {
        px >= self.x - margin
            && px < self.x + self.width + margin
            && py >= self.y - margin
            && py < self.y + self.height + margin
    }
}

static NEXT_GENERATION: AtomicU64 = AtomicU64::new(1);

pub struct CaptureSession {
    generation: u64,
    mode: String,
    monitors: Vec<MonitorInfo>,
    windows: Vec<WindowInfo>,
    frames: HashMap<u32, RgbaImage>,
    ui_rects: HashMap<u32, UiRect>,
    window_images: HashMap<u32, Arc<RgbaImage>>,
}

impl CaptureSession {
    pub fn new(
        mode: String,
        monitors: Vec<MonitorInfo>,
        windows: Vec<WindowInfo>,
        frames: HashMap<u32, RgbaImage>,
    ) -> Self {
        Self {
            generation: NEXT_GENERATION.fetch_add(1, Ordering::SeqCst),
            mode,
            monitors,
            windows,
            frames,
            ui_rects: HashMap::new(),
            window_images: HashMap::new(),
        }
    }

    /// Identifica a sessão: o rastreador do cursor e o temporizador de segurança só agem sobre a sua.
    pub fn generation(&self) -> u64 {
        self.generation
    }

    pub fn ui_rect(&self, id: u32) -> Option<UiRect> {
        self.ui_rects.get(&id).copied()
    }

    /// Imagem da janela já capturada para a pré-visualização (o clique reaproveita a mesma imagem).
    pub fn cached_window_image(&self, id: u32) -> Option<Arc<RgbaImage>> {
        self.window_images.get(&id).cloned()
    }

    pub fn cache_window_image(&mut self, id: u32, image: Arc<RgbaImage>) {
        self.window_images.insert(id, image);
    }

    pub fn set_ui_rect(&mut self, id: u32, rect: UiRect) -> Result<(), String> {
        self.monitor(id)?;
        self.ui_rects.insert(id, rect);
        Ok(())
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

    pub fn windows(&self) -> &[WindowInfo] {
        &self.windows
    }

    pub fn window(&self, id: u32) -> Result<&WindowInfo, String> {
        self.windows
            .iter()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Janela {id} não encontrada na sessão de captura"))
    }

    /// Resolve a seleção feita no monitor `id`. Janela: captura limpa (com fallback para o recorte do quadro).
    pub fn capture_selection(
        &self,
        id: u32,
        selection: &Selection,
        capture_window: impl FnOnce(u32) -> Result<RgbaImage, String>,
    ) -> Result<RgbaImage, String> {
        match selection {
            Selection::Window { id: window_id } => {
                resolve_window_capture(self.frame(id)?, self.monitor(id)?, self.window(*window_id)?, capture_window)
            }
            _ => self.crop(id, selection),
        }
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

/// Nome do tipo de captura enviado ao frontend.
pub fn capture_kind(selection: &Selection) -> &'static str {
    match selection {
        Selection::Fullscreen => "fullscreen",
        Selection::Region { .. } => "region",
        Selection::Window { .. } => "window",
    }
}

/// Retângulo (local ao monitor) do destaque de uma janela.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HoverRect {
    pub monitor_id: u32,
    /// Parte visível da janela neste monitor (recortada).
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// Retângulo completo da janela, local a este monitor e sem recorte (pode sair da tela).
    pub full_x: f64,
    pub full_y: f64,
    pub full_width: f64,
    pub full_height: f64,
}

/// Janela sob o cursor, enviada a todos os overlays (sem janela: `id` nulo e nenhum retângulo).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HoverWindowPayload {
    pub id: Option<u32>,
    pub app_name: String,
    pub title: String,
    pub rects: Vec<HoverRect>,
}

pub fn build_hover_payload(window: Option<&WindowInfo>, monitors: &[MonitorInfo]) -> HoverWindowPayload {
    match window {
        Some(w) => HoverWindowPayload {
            id: Some(w.id),
            app_name: w.app_name.clone(),
            title: w.title.clone(),
            rects: local_rects_for(w, monitors)
                .into_iter()
                .filter_map(|(monitor_id, r)| {
                    let monitor = monitors.iter().find(|m| m.id == monitor_id)?;
                    let full = local_window_rect(w, monitor);
                    Some(HoverRect {
                        monitor_id,
                        x: r.x,
                        y: r.y,
                        width: r.width,
                        height: r.height,
                        full_x: full.x,
                        full_y: full.y,
                        full_width: full.width,
                        full_height: full.height,
                    })
                })
                .collect(),
        },
        None => HoverWindowPayload { id: None, app_name: String::new(), title: String::new(), rects: Vec::new() },
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

/// A mira só é forçada fora da barra de opções; sobre ela a página mostra o cursor normal
/// (forçar também ali brigava com a página e fazia o cursor piscar entre seta e cruz).
pub fn should_force_crosshair(mode: &str, over_ui: bool) -> bool {
    cursor_for_mode(mode) == OverlayCursor::Crosshair && !over_ui
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

/// Imagem da janela para a pré-visualização: captura uma vez e guarda no cache da sessão.
/// A captura roda fora do lock, e só entra no cache se a sessão ainda for a mesma.
pub fn window_image_with(
    state: &SessionState,
    id: u32,
    capture: impl FnOnce(u32) -> Result<RgbaImage, String>,
) -> Result<Arc<RgbaImage>, String> {
    let generation = {
        let guard = state.lock().unwrap();
        let session = guard
            .as_ref()
            .ok_or_else(|| "Nenhuma captura em andamento".to_string())?;
        session.window(id)?;
        if let Some(image) = session.cached_window_image(id) {
            return Ok(image);
        }
        session.generation()
    };
    let image = Arc::new(capture(id)?);
    if let Some(session) = state.lock().unwrap().as_mut() {
        if session.generation() == generation {
            session.cache_window_image(id, Arc::clone(&image));
        }
    }
    Ok(image)
}

/// URL (relativa ao frontend) carregada por cada janela de overlay.
pub fn build_overlay_url(id: u32, mode: &str) -> String {
    format!("index.html?overlay={id}&mode={mode}")
}

/// Aceita apenas os modos suportados neste ciclo (captura de janela é o ciclo 2).
pub fn validate_mode(mode: &str) -> Result<(), String> {
    match mode {
        "region" | "fullscreen" | "window" => Ok(()),
        other => Err(format!("Modo de captura desconhecido: {other}")),
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureCompletePayload {
    pub data_url: String,
    pub fullscreen: bool,
    pub kind: String,
}

/// Monta o resultado enviado ao editor: copia a imagem crua para o clipboard (uma falha ali não impede
/// o resultado) e codifica o PNG **uma única vez**, só para o editor.
pub fn build_complete_payload(
    img: &RgbaImage,
    kind: &str,
    copy: impl FnOnce(&RgbaImage) -> Result<(), String>,
    encode: impl FnOnce(&RgbaImage) -> Result<Vec<u8>, String>,
) -> Result<CaptureCompletePayload, String> {
    let _ = copy(img);
    let png = encode(img)?;
    Ok(CaptureCompletePayload {
        data_url: format!("data:image/png;base64,{}", BASE64.encode(png)),
        fullscreen: kind == "fullscreen",
        kind: kind.to_string(),
    })
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
fn spawn_cursor_tracker(
    app: AppHandle,
    generation: u64,
    monitors: Vec<MonitorInfo>,
    windows: Vec<WindowInfo>,
) {
    std::thread::spawn(move || {
        let mut desired: Option<u32> = None;
        let mut focused: Option<u32> = None;
        let mut tick: u32 = 0;
        let mut forcing = false;
        let mut last_hover: Option<u32> = None;
        let mut hover_sent = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(16));
            tick = tick.wrapping_add(1);
            let pos = cursor_position();
            let under_cursor = pos.and_then(|(x, y)| monitor_at(&monitors, x, y));
            let snapshot = {
                let state = app.state::<SessionState>();
                let guard = state.lock().unwrap();
                guard
                    .as_ref()
                    .filter(|s| s.generation() == generation)
                    .map(|s| (s.mode().to_string(), under_cursor.and_then(|id| s.ui_rect(id))))
            };
            let Some((mode, ui_rect)) = snapshot else {
                if forcing {
                    apply_overlay_cursor(&app, OverlayCursor::Default);
                }
                break;
            };
            let Some((x, y)) = pos else { break };
            let over_ui = match (under_cursor, ui_rect) {
                (Some(id), Some(rect)) => monitors
                    .iter()
                    .find(|m| m.id == id)
                    .map(|m| {
                        let (lx, ly) = local_point(m, x, y);
                        rect.contains(lx, ly, 4.0)
                    })
                    .unwrap_or(false),
                _ => false,
            };
            let force = should_force_crosshair(&mode, over_ui);
            if force {
                apply_overlay_cursor(&app, cursor_for_mode(&mode));
            } else if forcing {
                // Saiu da mira forçada (entrou na barra ou trocou de modo): devolve o cursor à página.
                apply_overlay_cursor(&app, OverlayCursor::Default);
            }
            forcing = force;

            // Modo Janela: descobre a janela no topo sob o cursor e avisa os overlays quando muda
            // (e a cada ~320ms, pois um overlay recém-aberto pode ainda não estar ouvindo).
            if mode == "window" {
                let hover = window_at(&windows, x, y);
                if hover != last_hover || !hover_sent || tick % 20 == 0 {
                    let window = hover.and_then(|id| windows.iter().find(|w| w.id == id));
                    let _ = app.emit(EVENT_HOVER_WINDOW, build_hover_payload(window, &monitors));
                    last_hover = hover;
                    hover_sent = true;
                }
            } else if hover_sent {
                // Saiu do modo Janela: apaga o destaque.
                let _ = app.emit(EVENT_HOVER_WINDOW, build_hover_payload(None, &monitors));
                last_hover = None;
                hover_sent = false;
            }
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

/// Mostra, tira da minimização e foca a janela principal.
pub fn restore_main(app: &AppHandle) {
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

/// Congela todos os monitores e abre uma janela de seleção por monitor.
/// Usada pelo comando `begin_capture`, pela bandeja do sistema e pelo atalho global.
pub async fn start_capture(app: &AppHandle, mode: String) -> Result<(), String> {
    let state = app.state::<SessionState>();
    let guard = app.state::<BeginGuard>();
    validate_mode(&mode)?;
    // Segundo pedido enquanto o primeiro ainda está congelando as telas: ignora, em vez de derrubar o primeiro.
    let Some(_permit) = guard.try_acquire() else {
        return Ok(());
    };
    ensure_screen_recording(screen_recording_allowed())?;

    // Uma captura nova substitui qualquer sessão anterior (ex.: atalho apertado duas vezes).
    if let Some(previous) = take_session(&state) {
        close_overlays(app, previous.monitors());
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
        // Falha ao listar janelas não impede os outros modos: segue com a lista vazia.
        let windows = list_windows().unwrap_or_default();
        Ok::<_, String>((monitors, windows, frames))
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);

    let (monitors, windows, frames) = match captured {
        Ok(v) => v,
        Err(e) => {
            restore_main(app);
            return Err(e);
        }
    };

    replace_session(&state, CaptureSession::new(mode.clone(), monitors.clone(), windows.clone(), frames));

    for m in &monitors {
        let (x, y, w, h) = overlay_geometry(m);
        let built = WebviewWindowBuilder::new(
            app,
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
                end_session(app, &state);
                return Err(format!("Falha ao abrir o overlay do monitor {}: {}", m.id, e));
            }
        }
    }

    let generation = state.lock().unwrap().as_ref().map(|s| s.generation());
    if let Some(generation) = generation {
        spawn_show_fallback(app.clone(), generation, monitors.clone());
        spawn_cursor_tracker(app.clone(), generation, monitors, windows);
    }
    Ok(())
}


/// Comando chamado pelo frontend; a lógica fica em `start_capture`.
#[tauri::command]
pub async fn begin_capture(app: AppHandle, mode: String) -> Result<(), String> {
    start_capture(&app, mode).await
}

/// Erro ao iniciar uma captura sem o usuário ter usado a janela (bandeja ou atalho): mostra a janela
/// principal e envia o código do erro para ela exibir o aviso.
pub fn report_start_error(app: &AppHandle, error: &str) {
    restore_main(app);
    let _ = app.emit(EVENT_CAPTURE_ERROR, error.to_string());
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

/// Pixels crus (cabeçalho de tamanho + RGBA) da janela `id`, para o overlay mostrá-la à frente das demais.
#[tauri::command]
pub async fn get_window_image(app: AppHandle, id: u32) -> Result<tauri::ipc::Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SessionState>();
        window_image_with(&state, id, capture_window).map(|image| encode_rgba_blob(&image))
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

    // O clique reaproveita a imagem que o usuário viu na pré-visualização; sem ela, captura agora.
    let previewed = match &selection {
        Selection::Window { id: window_id } => session.cached_window_image(*window_id),
        _ => None,
    };
    let cropped = session.capture_selection(id, &selection, |window_id| match previewed {
        Some(image) => Ok((*image).clone()),
        None => capture_window(window_id),
    });

    close_overlays(&app, &monitors);
    restore_main(&app);

    match cropped {
        Ok(img) => {
            let payload = build_complete_payload(
                &img,
                capture_kind(&selection),
                copy_image_to_clipboard,
                image_to_png_bytes,
            )?;
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

/// O overlay informa onde fica a barra de opções, para o Rust não forçar a mira por cima dela.
#[tauri::command]
pub async fn set_overlay_ui_rect(
    state: State<'_, SessionState>,
    id: u32,
    rect: UiRect,
) -> Result<(), String> {
    let mut guard = state.lock().unwrap();
    let session = guard
        .as_mut()
        .ok_or_else(|| "Nenhuma captura em andamento".to_string())?;
    session.set_ui_rect(id, rect)
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
