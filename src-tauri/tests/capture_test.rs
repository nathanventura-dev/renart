// src-tauri/tests/capture_test.rs

#[test]
fn test_crop_bounds_validation() {
    // Caso 1: Região válida dentro das dimensões da tela (1920x1080)
    let valid = renart_lib::capture::validate_bounds(100, 100, 800, 600, 1920, 1080);
    assert!(valid.is_ok(), "Bounds válidos deveriam ser aceitos");
    let bounds = valid.unwrap();
    assert_eq!(bounds.x, 100);
    assert_eq!(bounds.y, 100);
    assert_eq!(bounds.width, 800);
    assert_eq!(bounds.height, 600);
}

#[test]
fn test_crop_bounds_rejects_zero_dimension() {
    // Caso 2: Largura ou altura zero deve retornar erro explícito
    let zero_w = renart_lib::capture::validate_bounds(10, 10, 0, 100, 1920, 1080);
    assert!(zero_w.is_err(), "Largura zero deve retornar erro");

    let zero_h = renart_lib::capture::validate_bounds(10, 10, 100, 0, 1920, 1080);
    assert!(zero_h.is_err(), "Altura zero deve retornar erro");
}

#[test]
fn test_crop_bounds_clamping_or_rejecting_out_of_bounds() {
    // Caso 3: Coordenadas que ultrapassam a resolução da tela devem sofrer clamp seguro
    let clamped = renart_lib::capture::validate_bounds(1500, 900, 1000, 500, 1920, 1080);
    assert!(clamped.is_ok(), "Deve realizar clamp automático nas bordas da tela");
    let bounds = clamped.unwrap();
    assert_eq!(bounds.x, 1500);
    assert_eq!(bounds.y, 900);
    assert_eq!(bounds.width, 420); // 1920 - 1500 = 420
    assert_eq!(bounds.height, 180); // 1080 - 900 = 180
}

#[test]
fn test_crop_bounds_negative_coordinates() {
    // Caso 4: Coordenadas negativas devem ser ajustadas ou rejeitadas com segurança
    let neg = renart_lib::capture::validate_bounds(-50, -30, 200, 200, 1920, 1080);
    assert!(neg.is_ok());
    let bounds = neg.unwrap();
    assert_eq!(bounds.x, 0);
    assert_eq!(bounds.y, 0);
    assert_eq!(bounds.width, 150); // 200 - 50 = 150
    assert_eq!(bounds.height, 170); // 200 - 30 = 170
}

// ---- Captura multi-monitor: conversão de seleção lógica em pixels físicos ----
use renart_lib::capture::{frame_to_bmp, monitor_at, overlay_geometry, selection_to_physical, MonitorInfo, RectBounds, Selection};

fn region(x: f64, y: f64, width: f64, height: f64) -> Selection {
    Selection::Region { x, y, width, height }
}

#[test]
fn test_selection_fullscreen_covers_whole_frame() {
    let r = selection_to_physical(&Selection::Fullscreen, 1440, 900, 2880, 1800).unwrap();
    assert_eq!(r, RectBounds { x: 0, y: 0, width: 2880, height: 1800 });
}

#[test]
fn test_selection_region_scales_by_real_ratio_2x() {
    let r = selection_to_physical(&region(100.0, 50.0, 300.0, 200.0), 1440, 900, 2880, 1800).unwrap();
    assert_eq!(r, RectBounds { x: 200, y: 100, width: 600, height: 400 });
}

#[test]
fn test_selection_region_scales_1x() {
    let r = selection_to_physical(&region(100.0, 50.0, 300.0, 200.0), 1920, 1080, 1920, 1080).unwrap();
    assert_eq!(r, RectBounds { x: 100, y: 50, width: 300, height: 200 });
}

#[test]
fn test_selection_uses_per_axis_ratio_when_frame_is_off_by_one_pixel() {
    let r = selection_to_physical(&region(0.0, 0.0, 1440.0, 900.0), 1440, 900, 2879, 1800).unwrap();
    assert!(r.x + r.width <= 2879, "não pode ultrapassar o quadro: {:?}", r);
    assert!(r.width >= 2878);
}

#[test]
fn test_selection_region_clamped_when_partly_outside() {
    let r = selection_to_physical(&region(900.0, 700.0, 300.0, 300.0), 1000, 800, 1000, 800).unwrap();
    assert_eq!(r, RectBounds { x: 900, y: 700, width: 100, height: 100 });
}

#[test]
fn test_selection_region_rejects_zero_size_and_fully_outside() {
    assert!(selection_to_physical(&region(10.0, 10.0, 0.0, 50.0), 1000, 800, 1000, 800).is_err());
    assert!(selection_to_physical(&region(1200.0, 10.0, 50.0, 50.0), 1000, 800, 1000, 800).is_err());
}

#[test]
fn test_overlay_geometry_keeps_negative_origin() {
    let m = MonitorInfo {
        id: 7,
        name: "Externo".into(),
        x: -1920,
        y: -200,
        width: 1920,
        height: 1080,
        scale_factor: 1.0,
        is_primary: false,
    };
    assert_eq!(overlay_geometry(&m), (-1920.0, -200.0, 1920.0, 1080.0));
}

// ---- Quadro cru (BMP) e monitor sob o cursor ----

fn mon(id: u32, x: i32, y: i32, w: u32, h: u32) -> MonitorInfo {
    MonitorInfo { id, name: format!("M{id}"), x, y, width: w, height: h, scale_factor: 1.0, is_primary: id == 1 }
}

#[test]
fn test_bmp_header_and_pixel_order() {
    let mut img = image::RgbaImage::new(2, 2);
    img.put_pixel(0, 0, image::Rgba([255, 0, 0, 255])); // vermelho
    img.put_pixel(1, 0, image::Rgba([0, 255, 0, 255])); // verde
    img.put_pixel(0, 1, image::Rgba([0, 0, 255, 255])); // azul
    img.put_pixel(1, 1, image::Rgba([10, 20, 30, 255]));
    let bmp = frame_to_bmp(&img);

    assert_eq!(&bmp[0..2], b"BM");
    assert_eq!(u32::from_le_bytes(bmp[2..6].try_into().unwrap()) as usize, bmp.len());
    assert_eq!(u32::from_le_bytes(bmp[10..14].try_into().unwrap()), 54, "offset dos pixels");
    assert_eq!(i32::from_le_bytes(bmp[18..22].try_into().unwrap()), 2, "largura");
    assert_eq!(i32::from_le_bytes(bmp[22..26].try_into().unwrap()), -2, "altura negativa = de cima para baixo");
    assert_eq!(u16::from_le_bytes(bmp[28..30].try_into().unwrap()), 24, "bits por pixel");
    // linha com 2 pixels = 6 bytes + 2 de preenchimento = 8
    assert_eq!(bmp.len(), 54 + 8 * 2);
    assert_eq!(&bmp[54..57], &[0, 0, 255], "vermelho vira BGR");
    assert_eq!(&bmp[57..60], &[0, 255, 0], "verde");
    assert_eq!(&bmp[62..65], &[255, 0, 0], "azul na segunda linha");
    assert_eq!(&bmp[60..62], &[0, 0], "preenchimento zerado");
}

#[test]
fn test_bmp_row_padding_for_one_pixel_wide_image() {
    let img = image::RgbaImage::from_pixel(1, 3, image::Rgba([1, 2, 3, 255]));
    assert_eq!(frame_to_bmp(&img).len(), 54 + 4 * 3, "1 pixel = 3 bytes + 1 de preenchimento por linha");
}

#[test]
fn test_bmp_of_a_4k_frame_is_built_quickly() {
    let img = image::RgbaImage::from_pixel(4096, 2304, image::Rgba([40, 90, 200, 255]));
    let t = std::time::Instant::now();
    let bmp = frame_to_bmp(&img);
    assert!(t.elapsed() < std::time::Duration::from_millis(1500), "montar o BMP levou {:?}", t.elapsed());
    assert_eq!(bmp.len(), 54 + 4096 * 3 * 2304);
}

#[test]
fn test_monitor_at_finds_the_monitor_under_the_cursor() {
    let monitors = vec![mon(1, 0, 0, 1280, 800), mon(2, 1280, 0, 2048, 1152), mon(3, -1920, -200, 1920, 1080)];
    assert_eq!(monitor_at(&monitors, 100.0, 100.0), Some(1));
    assert_eq!(monitor_at(&monitors, 1279.9, 799.9), Some(1));
    assert_eq!(monitor_at(&monitors, 1280.0, 0.0), Some(2), "a borda direita pertence ao monitor seguinte");
    assert_eq!(monitor_at(&monitors, -1.0, 10.0), Some(3), "monitor à esquerda, coordenadas negativas");
    assert_eq!(monitor_at(&monitors, -1920.0, -200.0), Some(3));
    assert_eq!(monitor_at(&monitors, 5000.0, 5000.0), None);
    assert_eq!(monitor_at(&monitors, 0.0, -300.0), None);
}

// ---- Valores extremos vindos do IPC não podem derrubar o app ----

#[test]
fn test_validate_bounds_does_not_overflow_on_extreme_negative_coordinates() {
    assert!(renart_lib::capture::validate_bounds(i32::MIN, 0, 100, 100, 1920, 1080).is_err());
    assert!(renart_lib::capture::validate_bounds(0, i32::MIN, 100, 100, 1920, 1080).is_err());
    assert!(renart_lib::capture::validate_bounds(i32::MIN, i32::MIN, u32::MAX, u32::MAX, 1920, 1080).is_ok(),
        "uma região enorme que começa muito antes da tela ainda cobre a tela inteira");
}

#[test]
fn test_selection_with_absurd_values_is_an_error_or_clamped_never_a_panic() {
    assert!(selection_to_physical(&region(-1e30, -1e30, 50.0, 50.0), 1000, 800, 1000, 800).is_err());
    assert!(selection_to_physical(&region(1e30, 0.0, 50.0, 50.0), 1000, 800, 1000, 800).is_err());
    let huge = selection_to_physical(&region(0.0, 0.0, 1e30, 1e30), 1000, 800, 1000, 800).unwrap();
    assert_eq!(huge, RectBounds { x: 0, y: 0, width: 1000, height: 800 });
}

#[test]
fn test_selection_rejects_non_finite_numbers() {
    assert!(selection_to_physical(&region(f64::NAN, 0.0, 10.0, 10.0), 1000, 800, 1000, 800).is_err());
    assert!(selection_to_physical(&region(0.0, 0.0, f64::INFINITY, 10.0), 1000, 800, 1000, 800).is_err());
}

// ---- Captura de janela: filtro, topo sob o cursor, recorte por monitor e captura limpa ----
use renart_lib::capture::{
    filter_normal_layer, is_capturable_window, local_rects_for, resolve_window_capture, window_at, RectF,
    WindowInfo,
};

fn win(id: u32, x: i32, y: i32, w: u32, h: u32) -> WindowInfo {
    WindowInfo { id, app_name: "App".into(), title: format!("Janela {id}"), x, y, width: w, height: h }
}

#[test]
fn test_is_capturable_window_rejects_system_own_minimized_and_tiny() {
    assert!(is_capturable_window("Safari", 1200, 800, false, 10, 99));
    assert!(!is_capturable_window("Dock", 1200, 800, false, 10, 99));
    assert!(!is_capturable_window("Window Server", 1200, 800, false, 10, 99));
    assert!(!is_capturable_window("Safari", 1200, 800, true, 10, 99), "minimizada");
    assert!(!is_capturable_window("RenArt", 1200, 800, false, 99, 99), "janela do próprio app");
    assert!(!is_capturable_window("Safari", 79, 800, false, 10, 99), "estreita demais");
    assert!(!is_capturable_window("Safari", 1200, 39, false, 10, 99), "baixa demais");
}

#[test]
fn test_window_at_returns_the_topmost_window_under_the_point() {
    let windows = vec![win(1, 0, 0, 100, 100), win(2, 50, 50, 100, 100)]; // frente -> trás
    assert_eq!(window_at(&windows, 60.0, 60.0), Some(1), "na sobreposição vence a do topo");
    assert_eq!(window_at(&windows, 120.0, 120.0), Some(2));
    assert_eq!(window_at(&windows, 500.0, 500.0), None, "sobre o desktop não há janela");
    assert_eq!(window_at(&windows, 100.0, 10.0), None, "a borda de fim (x = 100) não pertence à janela 1");
}

#[test]
fn test_local_rects_for_clips_to_each_monitor() {
    let monitors = vec![mon(1, 0, 0, 1000, 800), mon(2, 1000, 0, 1000, 800)];
    let rects = local_rects_for(&win(5, 900, 100, 300, 200), &monitors);
    assert_eq!(
        rects,
        vec![
            (1, RectF { x: 900.0, y: 100.0, width: 100.0, height: 200.0 }),
            (2, RectF { x: 0.0, y: 100.0, width: 200.0, height: 200.0 }),
        ]
    );
}

#[test]
fn test_local_rects_for_handles_negative_origin_and_no_intersection() {
    let monitors = vec![mon(3, -1920, -200, 1920, 1080)];
    assert_eq!(
        local_rects_for(&win(1, -1900, -100, 400, 300), &monitors),
        vec![(3, RectF { x: 20.0, y: 100.0, width: 400.0, height: 300.0 })]
    );
    assert!(local_rects_for(&win(2, 5000, 5000, 100, 100), &monitors).is_empty());
    let big = local_rects_for(&win(3, -3000, -500, 9000, 9000), &monitors);
    assert_eq!(big, vec![(3, RectF { x: 0.0, y: 0.0, width: 1920.0, height: 1080.0 })], "recortada ao monitor");
}

#[test]
fn test_resolve_window_capture_prefers_the_clean_window_image() {
    let frame = image::RgbaImage::from_pixel(100, 100, image::Rgba([255, 0, 0, 255]));
    let clean = image::RgbaImage::from_pixel(10, 10, image::Rgba([0, 0, 255, 255]));
    let out = resolve_window_capture(&frame, &mon(1, 0, 0, 100, 100), &win(9, 10, 10, 30, 20), |_| Ok(clean.clone())).unwrap();
    assert_eq!(out.dimensions(), (10, 10));
    assert_eq!(*out.get_pixel(0, 0), image::Rgba([0, 0, 255, 255]));
}

#[test]
fn test_resolve_window_capture_falls_back_to_cropping_the_frozen_frame() {
    let frame = image::RgbaImage::from_pixel(100, 100, image::Rgba([255, 0, 0, 255]));
    let out = resolve_window_capture(&frame, &mon(1, 0, 0, 100, 100), &win(9, 10, 10, 30, 20), |_| Err("sumiu".into())).unwrap();
    assert_eq!(out.dimensions(), (30, 20));
    assert_eq!(*out.get_pixel(0, 0), image::Rgba([255, 0, 0, 255]));
}

#[test]
fn test_resolve_window_capture_errors_when_window_is_outside_the_frame() {
    let frame = image::RgbaImage::from_pixel(100, 100, image::Rgba([255, 0, 0, 255]));
    let r = resolve_window_capture(&frame, &mon(1, 0, 0, 100, 100), &win(9, 500, 500, 30, 20), |_| Err("sumiu".into()));
    assert!(r.is_err());
}

#[test]
fn test_window_selection_serializes_with_kind_and_has_no_physical_rect() {
    let json = serde_json::to_string(&Selection::Window { id: 7 }).unwrap();
    assert!(json.contains("\"kind\":\"window\"") && json.contains("\"id\":7"), "{json}");
    assert!(selection_to_physical(&Selection::Window { id: 7 }, 1000, 800, 1000, 800).is_err());
}

// ---- Filtro por camada: só janelas normais (layer 0) entram na lista ----

#[test]
fn test_filter_normal_layer_keeps_only_windows_from_the_normal_layer() {
    let windows = vec![win(1, 0, 0, 500, 400), win(2, 0, 0, 500, 400), win(3, 0, 0, 500, 400)];
    let normal: std::collections::HashSet<u32> = [1, 3].into_iter().collect();
    let kept = filter_normal_layer(windows, Some(&normal));
    assert_eq!(kept.iter().map(|w| w.id).collect::<Vec<_>>(), vec![1, 3], "mantém a ordem frente -> trás");
}

#[test]
fn test_filter_normal_layer_keeps_everything_when_the_layer_lookup_failed() {
    let windows = vec![win(1, 0, 0, 500, 400), win(2, 0, 0, 500, 400)];
    assert_eq!(filter_normal_layer(windows, None).len(), 2, "sem a consulta de camadas não pode sumir janela");
}

#[test]
fn test_filter_normal_layer_with_no_normal_windows_returns_nothing() {
    let windows = vec![win(1, 0, 0, 500, 400)];
    let none: std::collections::HashSet<u32> = std::collections::HashSet::new();
    assert!(filter_normal_layer(windows, Some(&none)).is_empty());
}

#[test]
fn test_list_windows_filters_by_layer_instead_of_relying_on_english_app_names() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/capture.rs")).unwrap();
    assert!(src.contains("normal_window_ids"), "list_windows consulta as camadas do sistema");
    assert!(src.contains("kCGWindowLayer"), "lê a camada (kCGWindowLayer) de cada janela");
    assert!(src.contains("filter_normal_layer("), "e aplica o filtro à lista do xcap");
}
