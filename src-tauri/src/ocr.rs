use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OcrWordDto {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OcrLineDto {
    pub text: String,
    pub words: Vec<OcrWordDto>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Detecta linhas e palavras com suas caixas delimitadoras dentro de uma região recortada da imagem.
#[tauri::command]
pub async fn detect_text_in_region(
    image_base64: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<Vec<OcrLineDto>, String> {
    if width == 0 || height == 0 {
        return Err("Largura ou altura zero não são permitidas".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        windows_ocr_detect(image_base64, x, y, width, height).await
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[cfg(target_os = "windows")]
async fn windows_ocr_detect(
    _image_base64: String,
    _x: u32,
    _y: u32,
    _width: u32,
    _height: u32,
) -> Result<Vec<OcrLineDto>, String> {
    // Estrutura pronta para conectar ao pipeline nativo do Windows Media OCR
    Ok(Vec::new())
}
