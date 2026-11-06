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
use renart_lib::capture::{overlay_geometry, selection_to_physical, MonitorInfo, RectBounds, Selection};

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
