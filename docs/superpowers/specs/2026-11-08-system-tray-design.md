# Design Doc: Bandeja do Sistema (System Tray / Barra de Menus)

## 1. Objetivo
Deixar o RenArt **disponível em segundo plano** com um ícone na barra de menus do macOS: o usuário captura sem abrir o editor, fecha a janela sem perder o atalho global e sai do app só quando quiser. É o último item em aberto da Fase 2 do roadmap.

## 2. Contexto
- Não existe bandeja hoje: o crate `tauri` está sem a feature `tray-icon`.
- Há uma única janela (`main`). Fechá-la encerra o app e, com isso, o atalho global `Cmd+Shift+S` deixa de funcionar.
- O atalho global hoje emite um evento ao frontend, que chama `begin_capture`; antes disso o handler em Rust **mostra a janela principal**. Com o app residente na bandeja, isso faria a janela aparecer e sumir a cada captura.
- `docs/acionamento-e-atalhos.md` (§1.2) descreve uma bandeja planejada, com um menu maior do que o necessário.

## 3. Decisões Acordadas
- **Fechar a janela mantém o app na bandeja:** o X vermelho e `Cmd+W` escondem a janela; o app, a bandeja e o atalho continuam. Sai-se por "Sair" no menu ou `Cmd+Q`.
- **Clique no ícone abre o menu** (padrão do macOS), em vez de iniciar uma captura.
- **O ícone continua no Dock** com a janela fechada; clicar nele reabre a janela. Não se altera a política de ativação do macOS, da qual o foco dos overlays de captura depende.
- **Foco no macOS:** só ele é validado. O código usa a API de bandeja do Tauri (portátil); o que é exclusivo do macOS (ícone monocromático em modo *template*) fica isolado e marcado. Windows e Linux compilam mas não são testados (no Linux a bandeja depende do ambiente; o GNOME, por exemplo, não mostra ícones de bandeja por padrão).
- **Menu enxuto:** o menu planejado em `acionamento-e-atalhos.md` perde "Configurações e Atalhos" (não existe tela de configurações) e "Galeria" / "Abrir Editor com a Última Captura" (a galeria já fica na janela, que abre com a última captura selecionada).
- **A captura é iniciada pelo Rust**, tanto pela bandeja quanto pelo atalho, sem passar pelo frontend nem mostrar a janela.

## 4. Menu
```
Nova Captura ▸  Área
                Janela
                Tela Inteira
─────────────
Abrir RenArt
─────────────
Sair
```
Tooltip do ícone: "RenArt".

## 5. Fluxos
1. **Nova Captura › modo:** o Rust chama `start_capture(app, modo)`. A janela principal, se estiver visível, é escondida pela própria captura (comportamento existente); ao concluir, ela reaparece com a imagem nova.
2. **Atalho global (`Cmd+Shift+S`):** chama `start_capture(app, "region")` direto, sem mostrar a janela e sem emitir evento ao frontend.
3. **Erro ao iniciar a captura** (permissão de Gravação de Tela negada, por exemplo): o Rust **mostra e foca a janela principal** e emite `capture-error` com o código do erro; o frontend mostra o aviso que já existe (`describeCaptureError`).
4. **Abrir RenArt:** mostra, tira da minimização e foca a janela principal.
5. **Fechar a janela:** `CloseRequested` na `main` → `prevent_close()` + `hide()`.
6. **Clicar no Dock com a janela escondida:** `RunEvent::Reopen { has_visible_windows: false }` → mostra e foca a janela.
7. **Sair:** `app.exit(0)` (também encerra qualquer captura em andamento).
8. **Captura já em andamento:** um novo pedido (menu ou atalho) é ignorado enquanto o `BeginGuard` está ocupado, e substitui a sessão aberta, como hoje.

## 6. Arquitetura

### 6.1 Rust (`src-tauri`)
- `Cargo.toml`: `tauri = { version = "2.0.0", features = ["tray-icon", "image-png"] }`.
- `src/tray.rs` (novo):
  - `pub enum TrayAction { NewCapture(&'static str), OpenWindow, Quit }`.
  - `pub struct TrayItem { pub id: &'static str, pub label: &'static str }` e `pub fn tray_menu_items() -> Vec<TrayItem>`: o modelo do menu (ids `capture-region`, `capture-window`, `capture-fullscreen`, `open`, `quit`), sem dependência do Tauri.
  - `pub fn parse_menu_id(id: &str) -> Option<TrayAction>`: `capture-region` → `NewCapture("region")`, `capture-window` → `NewCapture("window")`, `capture-fullscreen` → `NewCapture("fullscreen")`, `open` → `OpenWindow`, `quit` → `Quit`; qualquer outro → `None`.
  - `#[derive(Default)] pub struct TrayActive(pub std::sync::atomic::AtomicBool)`: estado gerenciado que fica `true` só depois de a bandeja ser criada com sucesso; o `CloseRequested` só esconde a janela (em vez de deixá-la fechar o app) quando ele é `true`.
  - `pub fn setup_tray(app: &tauri::App) -> tauri::Result<()>`: monta o menu (submenu "Nova Captura"), o `TrayIconBuilder` com o ícone `icons/tray.png` em modo *template* e o tooltip, e liga os cliques do menu a `parse_menu_id`.
- `src/capture_session.rs`: o corpo de `begin_capture` vira `pub async fn start_capture(app: &AppHandle, mode: String) -> Result<(), String>` (usa `app.state` para a sessão e o `BeginGuard`); o comando `begin_capture` passa a chamá-la. Nova função `pub fn report_start_error(app: &AppHandle, error: &str)`: mostra e foca a `main` e emite `capture-error`. Nova constante `EVENT_CAPTURE_ERROR = "capture-error"`.
- `src/shortcuts.rs`: no handler, em vez de mostrar a janela e emitir `global-capture-shortcut`, dispara `start_capture(app, "region")` em `tauri::async_runtime::spawn` e chama `report_start_error` se falhar. A constante `CAPTURE_SHORTCUT_EVENT` e o evento deixam de existir.
- `src/lib.rs`: `setup_tray` no `setup`; troca `.run(context)` por `.build(context)?.run(callback)` para tratar `RunEvent::Reopen`; `on_window_event` na `main` esconde a janela em `CloseRequested`.
- `icons/tray.png` (novo, 44×44, preto sobre transparente) gerado a partir do contorno da raposa; carregado com `tauri::include_image!`.
- `capabilities/default.json`: sem mudança (a bandeja é criada no Rust).

### 6.2 Frontend (`src`)
- `services/captureService.ts`: `EVENT_CAPTURE_ERROR` e `onCaptureError(cb: (message: string) => void)`.
- `App.tsx`: assina `onCaptureError` e mostra `describeCaptureError(message)` no aviso existente; **remove** o `useEffect` e a ref do atalho global em JavaScript.
- Removidos: `services/shortcutService.ts` e `tests/shortcutService.test.ts`; `tests/shortcutWiring.test.ts` perde os testes do ouvinte no `App` e mantém o da capability.

## 7. Tratamento de Erros
- **Permissão negada ao iniciar pela bandeja ou pelo atalho:** a janela abre com o aviso explicando o caminho em Ajustes do Sistema (mesma mensagem de hoje).
- **Falha ao criar a bandeja** (ambiente sem suporte): `setup_tray` registra o erro e o app segue sem ícone; fechar a janela passa a encerrar o app, para o usuário nunca ficar sem nenhuma interface (a flag "bandeja ativa" decide o comportamento do `CloseRequested`).
- **Janela principal ausente** ao abrir ou reabrir: ignora sem pânico.

## 8. Fora do Escopo
Tela de configurações, atalho configurável, esconder o ícone do Dock, validação em Windows/Linux, notificações do sistema.

## 9. Testes
- **Rust (`cargo test`):** `tray_menu_items` (ordem, rótulos e ids únicos); `parse_menu_id` (cada id e um id desconhecido); `EVENT_CAPTURE_ERROR` igual ao literal do frontend; testes de fonte (padrão já usado): `lib.rs` contém `prevent_close`, `CloseRequested`, `RunEvent::Reopen` e `setup_tray`; `shortcuts.rs` chama `start_capture`, não contém `.show()` nem `CAPTURE_SHORTCUT_EVENT`; `Cargo.toml` tem a feature `tray-icon`; `icons/tray.png` existe, é PNG RGBA e tem pixels transparentes e pretos (decodificação com o helper de testes).
- **Vitest:** `onCaptureError` (assina o evento e repassa a mensagem; fora do Tauri não assina); o nome do evento bate com o Rust; `App.tsx` assina `onCaptureError` e não importa mais `shortcutService`.
- **Validação manual (sua):** ícone na barra de menus claro e escuro; menu e cada item de "Nova Captura"; fechar a janela e capturar com `Cmd+Shift+S` e pelo menu sem a janela aparecer; capturar e a janela reaparecer com a imagem; clicar no Dock reabre; "Abrir RenArt"; "Sair" e `Cmd+Q`; permissão negada mostra o aviso.

## 10. Documentação
`docs/acionamento-e-atalhos.md` §1.2 (menu e comportamento reais), `docs/manual-de-funcionamento-e-fluxo.md` (fechar a janela mantém o app na bandeja), `docs/guia-rust-e-backend.md` (`tray.rs`, `start_capture`, `capture-error`) e README (recurso e roadmap da Fase 2 concluída).
