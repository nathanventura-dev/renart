use serde::{Deserialize, Serialize};
use std::io::Cursor;
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RectBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Valida e normaliza as coordenadas de corte da tela com tratamento seguro de limites.
pub fn validate_bounds(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    screen_width: u32,
    screen_height: u32,
) -> Result<RectBounds, String> {
    if width == 0 || height == 0 {
        return Err("Largura ou altura zero não são permitidas".to_string());
    }

    // Trata coordenadas iniciais negativas (arraste parcial fora da tela)
    let (adj_x, adj_w) = if x < 0 {
        let neg = x.unsigned_abs();
        if neg >= width {
            return Err("Região totalmente fora da tela à esquerda".to_string());
        }
        (0u32, width - neg)
    } else {
        (x as u32, width)
    };

    let (adj_y, adj_h) = if y < 0 {
        let neg = y.unsigned_abs();
        if neg >= height {
            return Err("Região totalmente fora da tela no topo".to_string());
        }
        (0u32, height - neg)
    } else {
        (y as u32, height)
    };

    if adj_x >= screen_width || adj_y >= screen_height {
        return Err("Coordenadas iniciais fora dos limites da tela".to_string());
    }

    // Clamp para não ultrapassar a resolução do monitor
    let clamped_w = std::cmp::min(adj_w, screen_width - adj_x);
    let clamped_h = std::cmp::min(adj_h, screen_height - adj_y);

    if clamped_w == 0 || clamped_h == 0 {
        return Err("Região resultante com dimensão zero após ajuste".to_string());
    }

    Ok(RectBounds {
        x: adj_x,
        y: adj_y,
        width: clamped_w,
        height: clamped_h,
    })
}

/// Informações de um monitor. `width`/`height`/`x`/`y` são lógicos (pontos), não pixels físicos.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f32,
    pub is_primary: bool,
}

/// Seleção feita num overlay, em pixels lógicos relativos ao monitor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Selection {
    Fullscreen,
    Region { x: f64, y: f64, width: f64, height: f64 },
    /// Janela inteira, resolvida por `resolve_window_capture` (não tem retângulo físico próprio).
    Window { id: u32 },
}

/// Converte a seleção lógica em pixels físicos do quadro capturado.
/// Usa a razão real `quadro / lógico` de cada eixo, tolerando arredondamentos de 1px.
pub fn selection_to_physical(
    selection: &Selection,
    logical_w: u32,
    logical_h: u32,
    frame_w: u32,
    frame_h: u32,
) -> Result<RectBounds, String> {
    match selection {
        Selection::Fullscreen => Ok(RectBounds { x: 0, y: 0, width: frame_w, height: frame_h }),
        Selection::Window { .. } => Err("Seleção de janela não tem retângulo próprio".to_string()),
        Selection::Region { x, y, width, height } => {
            if logical_w == 0 || logical_h == 0 {
                return Err("Monitor com dimensão lógica zero".to_string());
            }
            if ![*x, *y, *width, *height].iter().all(|v| v.is_finite()) {
                return Err("Seleção com valores inválidos".to_string());
            }
            if *width <= 0.0 || *height <= 0.0 {
                return Err("Largura ou altura zero não são permitidas".to_string());
            }
            let rx = frame_w as f64 / logical_w as f64;
            let ry = frame_h as f64 / logical_h as f64;
            validate_bounds(
                (x * rx).round() as i32,
                (y * ry).round() as i32,
                (width * rx).round() as u32,
                (height * ry).round() as u32,
                frame_w,
                frame_h,
            )
        }
    }
}

/// Posição e tamanho lógicos da janela de overlay de um monitor: `(x, y, largura, altura)`.
/// Preserva origem negativa (monitores à esquerda ou acima do principal).
pub fn overlay_geometry(m: &MonitorInfo) -> (f64, f64, f64, f64) {
    (m.x as f64, m.y as f64, m.width as f64, m.height as f64)
}

/// Converte o quadro em BMP 24 bits, de cima para baixo, sem compressão.
/// Evita codificar PNG/JPEG (segundos em telas grandes): o overlay só precisa exibir o quadro.
pub fn frame_to_bmp(img: &image::RgbaImage) -> Vec<u8> {
    let (w, h) = (img.width() as usize, img.height() as usize);
    let stride = (w * 3 + 3) & !3;
    let pixel_bytes = stride * h;
    let mut out = vec![0u8; 54 + pixel_bytes];

    out[0..2].copy_from_slice(b"BM");
    out[2..6].copy_from_slice(&((54 + pixel_bytes) as u32).to_le_bytes());
    out[10..14].copy_from_slice(&54u32.to_le_bytes());
    out[14..18].copy_from_slice(&40u32.to_le_bytes());
    out[18..22].copy_from_slice(&(w as i32).to_le_bytes());
    out[22..26].copy_from_slice(&(-(h as i32)).to_le_bytes());
    out[26..28].copy_from_slice(&1u16.to_le_bytes());
    out[28..30].copy_from_slice(&24u16.to_le_bytes());
    out[34..38].copy_from_slice(&(pixel_bytes as u32).to_le_bytes());
    out[38..42].copy_from_slice(&2835i32.to_le_bytes());
    out[42..46].copy_from_slice(&2835i32.to_le_bytes());

    for (y, row) in img.as_raw().chunks_exact(w * 4).enumerate() {
        let dst = &mut out[54 + y * stride..54 + y * stride + w * 3];
        for (px, d) in row.chunks_exact(4).zip(dst.chunks_exact_mut(3)) {
            d[0] = px[2];
            d[1] = px[1];
            d[2] = px[0];
        }
    }
    out
}

/// Id do monitor que contém o ponto `(x, y)` (coordenadas globais lógicas); bordas são `[início, fim)`.
pub fn monitor_at(monitors: &[MonitorInfo], x: f64, y: f64) -> Option<u32> {
    monitors
        .iter()
        .find(|m| {
            x >= m.x as f64 && x < m.x as f64 + m.width as f64 && y >= m.y as f64 && y < m.y as f64 + m.height as f64
        })
        .map(|m| m.id)
}

/// Converte um ponto global em coordenadas locais ao monitor (origem no canto superior esquerdo dele).
pub fn local_point(m: &MonitorInfo, x: f64, y: f64) -> (f64, f64) {
    (x - m.x as f64, y - m.y as f64)
}

/// Posição global do cursor em coordenadas lógicas (a mesma origem de `MonitorInfo`). Só no macOS.
#[cfg(target_os = "macos")]
pub fn cursor_position() -> Option<(f64, f64)> {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState).ok()?;
    let point = CGEvent::new(source).ok()?.location();
    Some((point.x, point.y))
}

#[cfg(not(target_os = "macos"))]
pub fn cursor_position() -> Option<(f64, f64)> {
    None
}

/// `true` enquanto o botão esquerdo do mouse está pressionado.
#[cfg(target_os = "macos")]
pub fn left_button_down() -> bool {
    extern "C" {
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    // 0 = kCGEventSourceStateCombinedSessionState, 0 = kCGMouseButtonLeft
    unsafe { CGEventSourceButtonState(0, 0) }
}

#[cfg(not(target_os = "macos"))]
pub fn left_button_down() -> bool {
    false
}

/// Retângulo em coordenadas lógicas.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct RectF {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Janela visível de outro app (coordenadas lógicas, mesma origem de `MonitorInfo`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: u32,
    pub app_name: String,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Apps do sistema que aparecem na lista de janelas mas não são janelas que o usuário queira capturar.
const SYSTEM_APPS: [&str; 6] = [
    "Window Server",
    "Dock",
    "SystemUIServer",
    "Control Center",
    "Notification Center",
    "Spotlight",
];

/// Decide se uma janela da lista do sistema é uma janela de usuário capturável.
pub fn is_capturable_window(
    app_name: &str,
    width: u32,
    height: u32,
    minimized: bool,
    pid: u32,
    own_pid: u32,
) -> bool {
    !minimized && pid != own_pid && width >= 80 && height >= 40 && !SYSTEM_APPS.contains(&app_name)
}

/// Id da janela no topo sob o ponto; `windows` vem da frente para trás e as bordas são `[início, fim)`.
pub fn window_at(windows: &[WindowInfo], x: f64, y: f64) -> Option<u32> {
    windows
        .iter()
        .find(|w| {
            x >= w.x as f64
                && x < w.x as f64 + w.width as f64
                && y >= w.y as f64
                && y < w.y as f64 + w.height as f64
        })
        .map(|w| w.id)
}

/// Retângulo da janela recortado por cada monitor que ela toca, em coordenadas locais ao monitor.
pub fn local_rects_for(window: &WindowInfo, monitors: &[MonitorInfo]) -> Vec<(u32, RectF)> {
    let (wl, wt) = (window.x as f64, window.y as f64);
    let (wr, wb) = (wl + window.width as f64, wt + window.height as f64);
    monitors
        .iter()
        .filter_map(|m| {
            let (ml, mt) = (m.x as f64, m.y as f64);
            let (mr, mb) = (ml + m.width as f64, mt + m.height as f64);
            let (l, t, r, b) = (wl.max(ml), wt.max(mt), wr.min(mr), wb.min(mb));
            if r > l && b > t {
                Some((m.id, RectF { x: l - ml, y: t - mt, width: r - l, height: b - t }))
            } else {
                None
            }
        })
        .collect()
}

/// Imagem da janela: a captura limpa da própria janela e, se ela falhar (janela fechada, por exemplo),
/// o recorte do quadro congelado do monitor no retângulo da janela.
pub fn resolve_window_capture(
    frame: &image::RgbaImage,
    monitor: &MonitorInfo,
    window: &WindowInfo,
    capture: impl FnOnce(u32) -> Result<image::RgbaImage, String>,
) -> Result<image::RgbaImage, String> {
    if let Ok(clean) = capture(window.id) {
        return Ok(clean);
    }
    let (_, rect) = local_rects_for(window, std::slice::from_ref(monitor))
        .into_iter()
        .next()
        .ok_or_else(|| "A janela não está neste monitor".to_string())?;
    let bounds = selection_to_physical(
        &Selection::Region { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        monitor.width,
        monitor.height,
        frame.width(),
        frame.height(),
    )?;
    Ok(image::imageops::crop_imm(frame, bounds.x, bounds.y, bounds.width, bounds.height).to_image())
}

/// Mantém só as janelas cujo id está no conjunto de janelas "normais" (camada 0 do sistema), na mesma ordem.
/// Sem o conjunto (a consulta de camadas falhou) a lista passa inteira, para nenhuma janela sumir.
pub fn filter_normal_layer(
    windows: Vec<WindowInfo>,
    normal: Option<&std::collections::HashSet<u32>>,
) -> Vec<WindowInfo> {
    match normal {
        Some(ids) => windows.into_iter().filter(|w| ids.contains(&w.id)).collect(),
        None => windows,
    }
}

/// Ids das janelas da camada normal (layer 0). Barra de menus, Dock, Central de Controle, banners de
/// notificação e painéis flutuantes ficam em outras camadas, e o nome do app (localizado) não é confiável.
#[cfg(target_os = "macos")]
fn normal_window_ids() -> Option<std::collections::HashSet<u32>> {
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowLayer, kCGWindowListExcludeDesktopElements,
        kCGWindowListOptionOnScreenOnly, kCGWindowNumber,
    };

    let array = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )?;
    let layer_key = unsafe { CFString::wrap_under_get_rule(kCGWindowLayer) };
    let number_key = unsafe { CFString::wrap_under_get_rule(kCGWindowNumber) };

    let mut ids = std::collections::HashSet::new();
    for item in array.iter() {
        let dict: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(*item as CFDictionaryRef) };
        let layer = dict.find(&layer_key).and_then(|v| v.downcast::<CFNumber>()).and_then(|n| n.to_i32());
        let number = dict.find(&number_key).and_then(|v| v.downcast::<CFNumber>()).and_then(|n| n.to_i32());
        if let (Some(0), Some(id)) = (layer, number) {
            ids.insert(id as u32);
        }
    }
    Some(ids)
}

#[cfg(not(target_os = "macos"))]
fn normal_window_ids() -> Option<std::collections::HashSet<u32>> {
    None
}

/// Lista as janelas visíveis dos outros apps, da frente para trás.
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    let own_pid = std::process::id();
    let windows = xcap::Window::all().map_err(|e| format!("Erro ao listar janelas: {}", e))?;
    let listed: Vec<WindowInfo> = windows
        .iter()
        .filter(|w| {
            is_capturable_window(w.app_name(), w.width(), w.height(), w.is_minimized(), w.pid(), own_pid)
        })
        .map(|w| WindowInfo {
            id: w.id(),
            app_name: w.app_name().to_string(),
            title: w.title().to_string(),
            x: w.x(),
            y: w.y(),
            width: w.width(),
            height: w.height(),
        })
        .collect();
    Ok(filter_normal_layer(listed, normal_window_ids().as_ref()))
}

/// Captura apenas a janela `id` (a imagem dela mesma, mesmo que outra esteja por cima).
pub fn capture_window(id: u32) -> Result<image::RgbaImage, String> {
    let windows = xcap::Window::all().map_err(|e| format!("Erro ao listar janelas: {}", e))?;
    let window = windows
        .into_iter()
        .find(|w| w.id() == id)
        .ok_or_else(|| format!("Janela {} não encontrada", id))?;
    window
        .capture_image()
        .map_err(|e| format!("Erro ao capturar a janela {}: {}", id, e))
}

/// Lista todos os monitores conectados.
pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Erro ao listar monitores: {}", e))?;
    Ok(monitors
        .iter()
        .map(|m| MonitorInfo {
            id: m.id(),
            name: m.name().to_string(),
            x: m.x(),
            y: m.y(),
            width: m.width(),
            height: m.height(),
            scale_factor: m.scale_factor(),
            is_primary: m.is_primary(),
        })
        .collect())
}

/// Captura o monitor com o `id` informado.
pub fn capture_monitor(id: u32) -> Result<image::RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Erro ao listar monitores: {}", e))?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.id() == id)
        .ok_or_else(|| format!("Monitor {} não encontrado", id))?;
    monitor
        .capture_image()
        .map_err(|e| format!("Erro ao capturar o monitor {}: {}", id, e))
}

/// Copia uma imagem RGBA diretamente para a área de transferência (sem passar por PNG).
pub fn copy_image_to_clipboard(img: &image::RgbaImage) -> Result<(), String> {
    let img_data = arboard::ImageData {
        width: img.width() as usize,
        height: img.height() as usize,
        bytes: std::borrow::Cow::Borrowed(img.as_raw()),
    };

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Falha ao acessar área de transferência: {}", e))?;

    clipboard.set_image(img_data)
        .map_err(|e| format!("Falha ao gravar imagem na área de transferência: {}", e))?;

    Ok(())
}

/// Copia os bytes da imagem PNG para a área de transferência do SO de forma imediata.
pub fn copy_to_clipboard(png_bytes: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Falha ao decodificar imagem para clipboard: {}", e))?
        .to_rgba8();
    copy_image_to_clipboard(&img)
}

/// Converte um RgbaImage em vetor de bytes PNG em memória
pub fn image_to_png_bytes(img: &image::RgbaImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let encoder = PngEncoder::new(Cursor::new(&mut buf));
    encoder.write_image(
        img.as_raw(),
        img.width(),
        img.height(),
        image::ExtendedColorType::Rgba8,
    ).map_err(|e| format!("Erro ao codificar PNG: {}", e))?;
    Ok(buf)
}

/// Captura a tela inteira do monitor principal
pub fn capture_fullscreen() -> Result<Vec<u8>, String> {
    let monitors = xcap::Monitor::all()
        .map_err(|e| format!("Erro ao listar monitores: {}", e))?;

    let primary = monitors.into_iter().find(|m| m.is_primary())
        .ok_or_else(|| "Nenhum monitor primário encontrado".to_string())?;

    let image = primary.capture_image()
        .map_err(|e| format!("Erro ao capturar tela: {}", e))?;

    let png_bytes = image_to_png_bytes(&image)?;
    let _ = copy_to_clipboard(&png_bytes);
    Ok(png_bytes)
}

/// Captura uma região recortada da tela
pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<Vec<u8>, String> {
    let monitors = xcap::Monitor::all()
        .map_err(|e| format!("Erro ao listar monitores: {}", e))?;

    let primary = monitors.into_iter().find(|m| m.is_primary())
        .ok_or_else(|| "Nenhum monitor primário encontrado".to_string())?;

    let bounds = validate_bounds(x, y, width, height, primary.width(), primary.height())?;

    let image = primary.capture_image()
        .map_err(|e| format!("Erro ao capturar tela: {}", e))?;

    let cropped = image::imageops::crop_imm(&image, bounds.x, bounds.y, bounds.width, bounds.height).to_image();
    let png_bytes = image_to_png_bytes(&cropped)?;
    let _ = copy_to_clipboard(&png_bytes);
    Ok(png_bytes)
}

/// Comando Tauri exposto ao Frontend
#[tauri::command]
pub fn tauri_capture_screen(
    mode: String,
    x: Option<i32>,
    y: Option<i32>,
    w: Option<u32>,
    h: Option<u32>,
) -> Result<String, String> {
    let bytes = match mode.as_str() {
        "fullscreen" => capture_fullscreen()?,
        "region" => {
            let rx = x.unwrap_or(0);
            let ry = y.unwrap_or(0);
            let rw = w.unwrap_or(400);
            let rh = h.unwrap_or(300);
            capture_region(rx, ry, rw, rh)?
        }
        _ => return Err(format!("Modo de captura desconhecido: {}", mode)),
    };

    let base64_str = BASE64.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", base64_str))
}
