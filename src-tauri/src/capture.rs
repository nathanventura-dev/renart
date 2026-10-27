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
        let neg = (-x) as u32;
        if neg >= width {
            return Err("Região totalmente fora da tela à esquerda".to_string());
        }
        (0u32, width - neg)
    } else {
        (x as u32, width)
    };

    let (adj_y, adj_h) = if y < 0 {
        let neg = (-y) as u32;
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

/// Copia os bytes da imagem PNG para a área de transferência do SO de forma imediata.
pub fn copy_to_clipboard(png_bytes: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Falha ao decodificar imagem para clipboard: {}", e))?
        .to_rgba8();

    let (w, h) = img.dimensions();
    let img_data = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Borrowed(img.as_raw()),
    };

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Falha ao acessar área de transferência: {}", e))?;

    clipboard.set_image(img_data)
        .map_err(|e| format!("Falha ao gravar imagem na área de transferência: {}", e))?;

    Ok(())
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
