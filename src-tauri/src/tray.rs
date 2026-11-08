use crate::capture_session::{report_start_error, restore_main, start_capture};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, Wry};

/// O que cada item do menu da bandeja faz.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayAction {
    /// Inicia uma captura no modo indicado (`region`, `window` ou `fullscreen`).
    NewCapture(&'static str),
    /// Mostra e foca a janela principal.
    OpenWindow,
    /// Encerra o aplicativo.
    Quit,
}

/// Item do menu: identificador (usado pelo evento de clique) e rótulo exibido.
pub struct TrayItem {
    pub id: &'static str,
    pub label: &'static str,
}

/// Itens do menu, na ordem de exibição. Os três primeiros ficam no submenu "Nova Captura".
pub fn tray_menu_items() -> Vec<TrayItem> {
    vec![
        TrayItem { id: "capture-region", label: "Área" },
        TrayItem { id: "capture-window", label: "Janela" },
        TrayItem { id: "capture-fullscreen", label: "Tela Inteira" },
        TrayItem { id: "open", label: "Abrir RenArt" },
        TrayItem { id: "quit", label: "Sair" },
    ]
}

/// Converte o id de um item de menu na ação correspondente; ids desconhecidos viram `None`.
pub fn parse_menu_id(id: &str) -> Option<TrayAction> {
    match id {
        "capture-region" => Some(TrayAction::NewCapture("region")),
        "capture-window" => Some(TrayAction::NewCapture("window")),
        "capture-fullscreen" => Some(TrayAction::NewCapture("fullscreen")),
        "open" => Some(TrayAction::OpenWindow),
        "quit" => Some(TrayAction::Quit),
        _ => None,
    }
}

/// `true` só depois de a bandeja ter sido criada com sucesso. Fechar a janela só a esconde (em vez de
/// encerrar o app) quando a bandeja está ativa, para o usuário nunca ficar sem nenhuma interface.
#[derive(Default)]
pub struct TrayActive(pub AtomicBool);

/// Cria o ícone e o menu na barra de menus (macOS) / área de notificação. Um clique no ícone abre o menu.
/// A flag `TrayActive` só vira `true` depois de a bandeja ter sido criada com sucesso.
pub fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();
    let items = tray_menu_items();
    let entry = |item: &TrayItem| MenuItem::with_id(handle, item.id, item.label, true, None::<&str>);

    let capture_entries = items
        .iter()
        .filter(|item| item.id.starts_with("capture-"))
        .map(entry)
        .collect::<tauri::Result<Vec<_>>>()?;
    let capture_refs: Vec<&dyn IsMenuItem<Wry>> = capture_entries.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    let new_capture = Submenu::with_items(handle, "Nova Captura", true, &capture_refs)?;

    let open = entry(items.iter().find(|i| i.id == "open").expect("item open"))?;
    let quit = entry(items.iter().find(|i| i.id == "quit").expect("item quit"))?;
    let first_separator = PredefinedMenuItem::separator(handle)?;
    let second_separator = PredefinedMenuItem::separator(handle)?;
    let menu = Menu::with_items(
        handle,
        &[&new_capture, &first_separator, &open, &second_separator, &quit],
    )?;

    TrayIconBuilder::new()
        .icon(tauri::include_image!("icons/tray.png"))
        // macOS: imagem monocromática que o sistema pinta de claro ou escuro conforme o tema da barra de menus.
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("RenArt")
        .on_menu_event(|app, event| match parse_menu_id(event.id().as_ref()) {
            Some(TrayAction::NewCapture(mode)) => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = start_capture(&app, mode.to_string()).await {
                        report_start_error(&app, &error);
                    }
                });
            }
            Some(TrayAction::OpenWindow) => restore_main(app),
            Some(TrayAction::Quit) => app.exit(0),
            None => {}
        })
        .build(app)?;

    app.state::<TrayActive>().0.store(true, Ordering::SeqCst);
    Ok(())
}
