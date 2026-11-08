# Bandeja do Sistema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o RenArt residente na barra de menus do macOS: fechar a janela mantém o app rodando, e a captura pode ser iniciada pelo menu da bandeja ou pelo atalho global sem mostrar a janela.

**Architecture:** `tray.rs` monta o ícone e o menu (modelo do menu puro e testável). A captura passa a ser iniciada no Rust por `start_capture`, usada pelo comando `begin_capture`, pela bandeja e pelo atalho global. Erros ao iniciar abrem a janela com o aviso via `capture-error`. O fechamento da janela principal vira "esconder" enquanto a bandeja estiver ativa.

**Tech Stack:** Rust (Tauri 2.12 com `tray-icon` e `image-png`), React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-system-tray-design.md`

## Regra de Git deste projeto

O usuário executa **todas** as ações de escrita no git (`add`, `commit`, `merge`, `push`, branches). O executor **não commita**: onde um plano normal teria "Commit", este plano tem um **Ponto de commit**: o executor mostra `git status`, um resumo do `git diff` e entrega os comandos prontos, com a mensagem sugerida, e **espera** o usuário confirmar antes de seguir para a próxima task. Leitura (`status`, `log`, `diff`, `branch`) é permitida.

## Global Constraints

- Menu (ids e rótulos, nesta ordem): submenu **"Nova Captura"** com `capture-region` "Área", `capture-window` "Janela", `capture-fullscreen` "Tela Inteira"; separador; `open` "Abrir RenArt"; separador; `quit` "Sair". Tooltip: "RenArt".
- Clique no ícone abre o menu (`show_menu_on_left_click(true)`). O ícone continua no Dock (não mexer na política de ativação do macOS).
- Fechar a janela (`CloseRequested` na `main`) esconde a janela **somente** se `TrayActive` for `true`; caso contrário o app fecha normalmente.
- Evento de erro: `capture-error`, com a **string do erro** como payload (por exemplo `screen-recording-denied`).
- O atalho global e a bandeja chamam `start_capture` direto; o atalho não mostra a janela e não emite mais `global-capture-shortcut`.
- Só macOS é validado; o código de `Reopen` e do ícone *template* fica isolado e marcado.
- Rust: `cargo test` em `src-tauri/` com `. "$HOME/.cargo/env"`. Vitest roda em ambiente node. Mensagens de commit sugeridas em português, `tipo(escopo): descrição`, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Janela escondida e captura pelo atalho ou pelo menu: nenhuma janela aparece durante a captura, e o resultado reaparece no editor (Tasks 2 e 3).
- Falha ao iniciar com a janela escondida (permissão negada): a janela abre e mostra o aviso explicando o caminho (Tasks 2 e 4).
- Falha ao criar a bandeja: fechar a janela encerra o app, para o usuário nunca ficar sem interface (Task 3).
- Atalho apertado duas vezes, ou menu e atalho juntos: o `BeginGuard` ignora o segundo pedido sem erro (Task 2).
- "Sair" ou `Cmd+Q` durante uma captura: o app encerra, sem overlays órfãos (Task 3).
- Clicar no Dock com a janela escondida a reabre; com a janela visível não faz nada além do normal (Task 3).

---

### Task 1: Modelo do menu, features e ícone da bandeja

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (apenas `pub mod tray;`)
- Create: `src-tauri/src/tray.rs` (só o modelo do menu e `TrayActive` por enquanto), `src-tauri/icons/tray.png`, `src-tauri/tests/tray_test.rs`

**Interfaces:**
- Produces:
  - `#[derive(Debug, Clone, Copy, PartialEq, Eq)] pub enum TrayAction { NewCapture(&'static str), OpenWindow, Quit }`.
  - `pub struct TrayItem { pub id: &'static str, pub label: &'static str }` e `pub fn tray_menu_items() -> Vec<TrayItem>` (ids e rótulos das Global Constraints, na ordem: região, janela, tela inteira, abrir, sair).
  - `pub fn parse_menu_id(id: &str) -> Option<TrayAction>`.
  - `#[derive(Default)] pub struct TrayActive(pub std::sync::atomic::AtomicBool);`
  - `src-tauri/icons/tray.png`: PNG RGBA 44×44, contorno da raposa **preto sobre transparente**.

- [ ] **Step 1: Escrever os testes que falham** em `src-tauri/tests/tray_test.rs`:
  - `test_tray_menu_has_the_agreed_items_in_order`: ids `["capture-region","capture-window","capture-fullscreen","open","quit"]` e rótulos `["Área","Janela","Tela Inteira","Abrir RenArt","Sair"]`.
  - `test_menu_ids_are_unique_and_parse_to_the_right_action`: `capture-region` → `NewCapture("region")`, `capture-window` → `NewCapture("window")`, `capture-fullscreen` → `NewCapture("fullscreen")`, `open` → `OpenWindow`, `quit` → `Quit`; `"qualquer"` e `""` → `None`; todos os ids de `tray_menu_items()` fazem parse com `Some`.
  - `test_tray_active_starts_false`: `TrayActive::default().0.load(...) == false`.
  - `test_cargo_enables_the_tray_features`: `Cargo.toml` contém `tray-icon` e `image-png`.
  - `test_tray_icon_is_a_black_template_image_with_transparency`: `image::open("icons/tray.png")` (caminho a partir de `CARGO_MANIFEST_DIR`) é 44×44; tem pixels com alfa 0 e pixels com alfa > 200 cujo RGB é ≤ 40 em cada canal; nenhum pixel opaco é claro (todo pixel com alfa > 200 tem RGB ≤ 40).
- [ ] **Step 2: Rodar `cd src-tauri && . "$HOME/.cargo/env" && cargo test --test tray_test`.** Expected: FAIL (não compila).
- [ ] **Step 3: Implementar.** `Cargo.toml`: `tauri = { version = "2.0.0", features = ["tray-icon", "image-png"] }`. `tray.rs` com o modelo acima e `pub mod tray;` em `lib.rs`. Gerar `tray.png` com um script Python em `/private/tmp/.../scratchpad` (fora do repositório): partir de `public/mascot-light.png` (256×256), calcular o alfa a partir do escurecimento das linhas (fundo branco → alfa 0), engrossar levemente as linhas antes de reduzir, reduzir para 44×44 com LANCZOS e gravar RGB preto com esse alfa. Conferir visualmente o resultado sobre fundo claro e escuro, lendo a imagem.
- [ ] **Step 4: Rodar `cargo test --test tray_test` e `cargo check --all-targets`.** Expected: PASS.
- [ ] **Step 5: Ponto de commit.** Mostrar `git status` e entregar:
```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/src/tray.rs src-tauri/icons/tray.png src-tauri/tests/tray_test.rs
git commit -m "feat(tray): modelo do menu da bandeja, features do Tauri e icone monocromatico"
```

---

### Task 2: `start_capture`, `capture-error` e atalho direto no Rust

**Files:**
- Modify: `src-tauri/src/capture_session.rs`, `src-tauri/src/shortcuts.rs`
- Test: `src-tauri/tests/session_test.rs`

**Interfaces:**
- Produces:
  - `pub const EVENT_CAPTURE_ERROR: &str = "capture-error";` em `capture_session.rs`.
  - `pub async fn start_capture(app: &AppHandle, mode: String) -> Result<(), String>`: o corpo atual de `begin_capture` (valida o modo, adquire o `BeginGuard` e ignora o pedido se já ocupado, checa a permissão, esconde a `main`, congela os monitores, abre os overlays, inicia rastreador e temporizador). Obtém `SessionState` e `BeginGuard` por `app.state::<...>()`.
  - `#[tauri::command] pub async fn begin_capture(app: AppHandle, mode: String) -> Result<(), String>`: só chama `start_capture(&app, mode).await` (a chamada do frontend não muda).
  - `pub fn report_start_error(app: &AppHandle, error: &str)`: mostra, tira da minimização e foca a `main`, e emite `EVENT_CAPTURE_ERROR` com `error` como payload.
  - `shortcuts.rs`: o handler, depois da checagem de `BeginGuard::is_busy`, faz `tauri::async_runtime::spawn` de `start_capture(&app, "region".into())` e, em `Err(e)`, chama `report_start_error(&app, &e)`. Remove `CAPTURE_SHORTCUT_EVENT`, o `emit` e o `show`/`unminimize`/`set_focus` da `main`; `default_capture_shortcut` e `register_global_shortcuts` ficam.

- [ ] **Step 1: Escrever/atualizar os testes que falham** em `session_test.rs`:
  - Em `test_event_names_match_the_frontend_contract`, incluir `EVENT_CAPTURE_ERROR == "capture-error"`.
  - Substituir `test_global_shortcut_does_not_touch_the_main_window_while_a_capture_is_starting` por `test_global_shortcut_starts_the_capture_in_rust_without_showing_the_window`: `shortcuts.rs` contém `is_busy`, `start_capture` e `report_start_error`; **não** contém `.show()`, `set_focus` nem `CAPTURE_SHORTCUT_EVENT`.
  - `test_start_capture_is_shared_by_the_command_and_reports_errors_to_the_window`: `capture_session.rs` contém `pub async fn start_capture`, `pub fn report_start_error` e `EVENT_CAPTURE_ERROR`; o comando `begin_capture` chama `start_capture`.
- [ ] **Step 2: Rodar `cargo test --test session_test`.** Expected: FAIL.
- [ ] **Step 3: Implementar** o refactor sem mudar o comportamento de `begin_capture` (os testes existentes continuam passando) e a mudança do `shortcuts.rs`.
- [ ] **Step 4: Rodar `cargo test` e `cargo check --all-targets`.** Expected: PASS e sem avisos novos além dos de `ocr.rs`.
- [ ] **Step 5: Ponto de commit.**
```bash
git add src-tauri/src/capture_session.rs src-tauri/src/shortcuts.rs src-tauri/tests/session_test.rs
git commit -m "refactor(capture): start_capture compartilhado, capture-error e atalho global iniciando a captura no Rust"
```

---

### Task 3: Bandeja, fechar esconde e reabrir pelo Dock

**Files:**
- Modify: `src-tauri/src/tray.rs`, `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/tray_test.rs`

**Interfaces:**
- Consumes: `TrayAction`, `parse_menu_id`, `TrayActive` (Task 1); `start_capture`, `report_start_error` (Task 2).
- Produces: `pub fn setup_tray(app: &tauri::App) -> tauri::Result<()>` em `tray.rs`: monta o submenu "Nova Captura" e os itens a partir de `tray_menu_items()`, cria o `TrayIconBuilder` com `tauri::include_image!("icons/tray.png")`, `.icon_as_template(true)` (macOS), `.show_menu_on_left_click(true)`, `.tooltip("RenArt")` e `.on_menu_event` que usa `parse_menu_id`: `NewCapture(modo)` → `spawn` de `start_capture` (com `report_start_error` em erro); `OpenWindow` → mostrar, tirar da minimização e focar a `main`; `Quit` → `app.exit(0)`. Só depois de criar a bandeja com sucesso marca `TrayActive` como `true`; em erro, registra com `eprintln!` e segue.
- `lib.rs`: `.manage(tray::TrayActive::default())`; no `setup`, chama `setup_tray` e instala `on_window_event` na `main`: em `WindowEvent::CloseRequested { api, .. }`, se `TrayActive` for `true`, `api.prevent_close()` e `hide()`; troca `.run(context)` por `.build(context).expect(..).run(|app, event| ...)` tratando `RunEvent::Reopen { has_visible_windows: false, .. }` (`#[cfg(target_os = "macos")]`) para mostrar e focar a `main`.

- [ ] **Step 1: Escrever os testes que falham** (testes de fonte, padrão do projeto) em `tray_test.rs`: `tray.rs` contém `icon_as_template(true)`, `show_menu_on_left_click(true)`, `include_image!("icons/tray.png")`, `tooltip("RenArt")`, `parse_menu_id`, `start_capture`, `report_start_error` e `exit(0)`; `lib.rs` contém `setup_tray`, `TrayActive`, `CloseRequested`, `prevent_close`, `RunEvent::Reopen` e `.build(`; o `Reopen` está dentro de um bloco `cfg(target_os = "macos")`.
- [ ] **Step 2: Rodar `cargo test --test tray_test`.** Expected: FAIL.
- [ ] **Step 3: Implementar** conforme as interfaces.
- [ ] **Step 4: Rodar `cargo test` e `cargo check --all-targets`.** Expected: PASS.
- [ ] **Step 5: Ponto de commit.**
```bash
git add src-tauri/src/tray.rs src-tauri/src/lib.rs src-tauri/tests/tray_test.rs
git commit -m "feat(tray): icone e menu na barra de menus, fechar a janela mantem o app e Dock reabre"
```

---

### Task 4: Aviso de erro no frontend e remoção do ouvinte do atalho

**Files:**
- Modify: `src/services/captureService.ts`, `src/App.tsx`, `tests/captureService.test.ts`, `tests/shortcutWiring.test.ts`
- Delete: `src/services/shortcutService.ts`, `tests/shortcutService.test.ts`

**Interfaces:**
- Produces: `export const EVENT_CAPTURE_ERROR = 'capture-error'` e `onCaptureError(cb: (message: string) => void, deps?: ServiceDeps): Promise<() => void>` em `captureService.ts`. `App.tsx` assina `onCaptureError` e chama `setCaptureNotice(describeCaptureError(message))`; remove o `useEffect` do atalho global, `handleStartCaptureRef`, `isCapturingRef` e o import de `shortcutService`.

- [ ] **Step 1: Atualizar e escrever os testes que falham.** `captureService.test.ts`: `onCaptureError` assina `capture-error` e repassa a string; fora do Tauri não assina; o nome do evento bate com `EVENT_CAPTURE_ERROR` lido de `capture_session.rs`. `shortcutWiring.test.ts`: remover o teste do `App` com `listenForCaptureShortcut` e o do `shortcuts.rs` antigo (substituído na Task 2), mantendo o teste da capability; adicionar `App.tsx` assina `onCaptureError`, usa `describeCaptureError` e **não** contém `shortcutService`. Apagar `tests/shortcutService.test.ts`.
- [ ] **Step 2: Rodar `npx vitest run`.** Expected: FAIL.
- [ ] **Step 3: Implementar** e apagar `src/services/shortcutService.ts`.
- [ ] **Step 4: Rodar `npx vitest run && npx tsc --noEmit && npx vite build`.** Expected: PASS.
- [ ] **Step 5: Ponto de commit.** Mostrar o `git status` (incluindo os arquivos apagados) e entregar:
```bash
git add -A src/services src/App.tsx tests
git commit -m "feat(tray): mostrar o aviso de erro de captura iniciado pelo Rust e remover o ouvinte do atalho em JS"
```

---

### Task 5: Documentação e validação

**Files:**
- Modify: `docs/acionamento-e-atalhos.md`, `docs/manual-de-funcionamento-e-fluxo.md`, `docs/guia-rust-e-backend.md`, `README.md`, `tests/readmeStructure.test.ts`
- Test: `tests/readmeStructure.test.ts`

- [ ] **Step 1: Escrever o teste que falha:** o README contém `Bandeja do sistema` e a linha da Fase 2 do roadmap marca a bandeja como concluída (`bandeja do sistema ✅`).
- [ ] **Step 2: Rodar `npx vitest run tests/readmeStructure.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Atualizar a documentação:** `acionamento-e-atalhos.md` §1.2 com o menu e o comportamento reais (clique abre o menu; itens; fechar a janela mantém o app); manual (fechar mantém o app na barra de menus; "Sair" ou `Cmd+Q`); guia do Rust (`tray.rs`, `start_capture`, `report_start_error`, `capture-error`, fechar esconde, `Reopen`); README (recurso "Bandeja do sistema" e roadmap), com o aviso de que foi validada apenas no macOS; contagem de testes do README com o total real do Vitest.
- [ ] **Step 4: Verificação completa:** `npx vitest run && npx tsc --noEmit && npx vite build` e, em `src-tauri/`, `cargo test && cargo check --all-targets`. Expected: tudo verde.
- [ ] **Step 5: Validação manual com `npm run tauri dev` (pelo usuário):** ícone na barra de menus em tema claro e escuro; menu e cada item de "Nova Captura"; fechar a janela (X e `Cmd+W`) e capturar com `Cmd+Shift+S` e pelo menu **sem a janela aparecer**; a janela reaparece com a imagem; clicar no Dock reabre; "Abrir RenArt"; "Sair" e `Cmd+Q`; permissão negada mostra o aviso. Ajustar o que falhar.
- [ ] **Step 6: Ponto de commit.**
```bash
git add -A docs README.md tests
git commit -m "docs(tray): documentar a bandeja do sistema e concluir a Fase 2 do roadmap"
```
