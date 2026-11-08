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

// ---- Bandeja, fechar esconde e Dock reabre (testes de fonte, padrão do projeto) ----

#[test]
fn test_tray_is_built_with_a_template_icon_and_opens_the_menu_on_click() {
    let src = read("src/tray.rs");
    for needle in [
        "icon_as_template(true)",
        "show_menu_on_left_click(true)",
        "include_image!(\"icons/tray.png\")",
        "tooltip(\"RenArt\")",
        "tray_menu_items()",
        "parse_menu_id",
    ] {
        assert!(src.contains(needle), "tray.rs deve conter {needle}");
    }
}

#[test]
fn test_tray_menu_actions_start_captures_open_the_window_and_quit() {
    let src = read("src/tray.rs");
    assert!(src.contains("start_capture"), "Nova Captura inicia a captura direto no Rust");
    assert!(src.contains("report_start_error"), "erro ao iniciar abre a janela com o aviso");
    assert!(src.contains("restore_main"), "Abrir RenArt mostra e foca a janela principal");
    assert!(src.contains("exit(0)"), "Sair encerra o app");
}

#[test]
fn test_tray_is_marked_active_only_after_it_was_created() {
    let src = read("src/tray.rs");
    let built = src.find(".build(app)").expect("tray.rs cria o ícone com .build(app)");
    let active = src.find("TrayActive").expect("tray.rs marca a bandeja como ativa");
    let store = src[active..].find("store(true").expect("marca true");
    assert!(active + store > built, "a flag só vira true depois de a bandeja ser criada com sucesso");
}

#[test]
fn test_closing_the_main_window_hides_it_only_when_the_tray_is_active() {
    let src = read("src/lib.rs");
    for needle in ["TrayActive", "CloseRequested", "prevent_close", "hide()", "setup_tray"] {
        assert!(src.contains(needle), "lib.rs deve conter {needle}");
    }
    let close = src.find("CloseRequested").unwrap();
    let guard = src[close..].find("TrayActive").or_else(|| src[..close].rfind("TrayActive"));
    assert!(guard.is_some(), "só esconde quando a bandeja está ativa");
}

#[test]
fn test_dock_click_reopens_the_hidden_window_on_macos_only() {
    let src = read("src/lib.rs");
    let reopen = src.find("RunEvent::Reopen").expect("lib.rs trata o clique no Dock");
    assert!(src[..reopen].rfind("cfg(target_os = \"macos\")").is_some(), "Reopen existe só no macOS");
    assert!(src.contains(".build(tauri::generate_context!())"), "run com callback exige build() antes");
}
