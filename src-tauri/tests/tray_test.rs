use renart_lib::tray::{parse_menu_id, tray_menu_items, TrayAction, TrayActive};
use std::collections::HashSet;
use std::sync::atomic::Ordering;

fn read(rel: &str) -> String {
    std::fs::read_to_string(format!("{}/{}", env!("CARGO_MANIFEST_DIR"), rel)).unwrap()
}

#[test]
fn test_tray_menu_has_the_agreed_items_in_order() {
    let items = tray_menu_items();
    assert_eq!(
        items.iter().map(|i| i.id).collect::<Vec<_>>(),
        vec!["capture-region", "capture-window", "capture-fullscreen", "open", "quit"]
    );
    assert_eq!(
        items.iter().map(|i| i.label).collect::<Vec<_>>(),
        vec!["Área", "Janela", "Tela Inteira", "Abrir RenArt", "Sair"]
    );
}

#[test]
fn test_menu_ids_are_unique_and_parse_to_the_right_action() {
    let items = tray_menu_items();
    let unique: HashSet<_> = items.iter().map(|i| i.id).collect();
    assert_eq!(unique.len(), items.len(), "ids repetidos");
    assert!(items.iter().all(|i| parse_menu_id(i.id).is_some()), "todo item do menu tem uma ação");

    assert_eq!(parse_menu_id("capture-region"), Some(TrayAction::NewCapture("region")));
    assert_eq!(parse_menu_id("capture-window"), Some(TrayAction::NewCapture("window")));
    assert_eq!(parse_menu_id("capture-fullscreen"), Some(TrayAction::NewCapture("fullscreen")));
    assert_eq!(parse_menu_id("open"), Some(TrayAction::OpenWindow));
    assert_eq!(parse_menu_id("quit"), Some(TrayAction::Quit));
    assert_eq!(parse_menu_id("qualquer"), None);
    assert_eq!(parse_menu_id(""), None);
}

#[test]
fn test_tray_active_starts_false() {
    assert!(!TrayActive::default().0.load(Ordering::SeqCst));
}

#[test]
fn test_cargo_enables_the_tray_features() {
    let cargo = read("Cargo.toml");
    assert!(cargo.contains("tray-icon"));
    assert!(cargo.contains("image-png"));
}

#[test]
fn test_tray_icon_is_a_black_template_image_with_transparency() {
    let img = image::open(format!("{}/icons/tray.png", env!("CARGO_MANIFEST_DIR"))).unwrap().to_rgba8();
    assert_eq!(img.dimensions(), (44, 44));
    let transparent = img.pixels().filter(|p| p[3] == 0).count();
    let solid_black = img.pixels().filter(|p| p[3] > 200 && p[0] <= 40 && p[1] <= 40 && p[2] <= 40).count();
    let opaque_light = img.pixels().filter(|p| p[3] > 200 && (p[0] > 40 || p[1] > 40 || p[2] > 40)).count();
    assert!(transparent > 400, "o fundo precisa ser transparente (achou {transparent})");
    assert!(solid_black > 60, "o desenho precisa ter traços pretos (achou {solid_black})");
    assert_eq!(opaque_light, 0, "template: nenhum pixel opaco pode ser colorido ou claro");
}
