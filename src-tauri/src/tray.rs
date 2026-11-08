use std::sync::atomic::AtomicBool;

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
