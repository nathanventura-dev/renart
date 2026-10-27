// src-tauri/tests/capture_test.rs

#[test]
fn test_crop_bounds_validation() {
    // Caso 1: Região válida dentro das dimensões da tela (1920x1080)
    let valid = ferramenta_captura_lib::capture::validate_bounds(100, 100, 800, 600, 1920, 1080);
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
    let zero_w = ferramenta_captura_lib::capture::validate_bounds(10, 10, 0, 100, 1920, 1080);
    assert!(zero_w.is_err(), "Largura zero deve retornar erro");

    let zero_h = ferramenta_captura_lib::capture::validate_bounds(10, 10, 100, 0, 1920, 1080);
    assert!(zero_h.is_err(), "Altura zero deve retornar erro");
}

#[test]
fn test_crop_bounds_clamping_or_rejecting_out_of_bounds() {
    // Caso 3: Coordenadas que ultrapassam a resolução da tela devem sofrer clamp seguro
    let clamped = ferramenta_captura_lib::capture::validate_bounds(1500, 900, 1000, 500, 1920, 1080);
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
    let neg = ferramenta_captura_lib::capture::validate_bounds(-50, -30, 200, 200, 1920, 1080);
    assert!(neg.is_ok());
    let bounds = neg.unwrap();
    assert_eq!(bounds.x, 0);
    assert_eq!(bounds.y, 0);
    assert_eq!(bounds.width, 150); // 200 - 50 = 150
    assert_eq!(bounds.height, 170); // 200 - 30 = 170
}
