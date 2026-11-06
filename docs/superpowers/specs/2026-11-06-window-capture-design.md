# Design Doc: Captura de Janela (Ciclo 2)

## 1. Objetivo
Completar o modo **Janela** da captura nativa: ao mover o mouse, a janela sob o cursor é destacada (como `Cmd+Shift+4` + `Espaço` no macOS e a Ferramenta de Captura do Windows) e o clique captura **aquela janela**, em qualquer monitor. Reaproveita a base do Ciclo 1 (overlays por monitor, rastreador de cursor do Rust, eventos).

## 2. Contexto e Problema
- Hoje o botão "Janela" aparece desativado ("Em breve") nos overlays, e o `App.tsx` ainda manda o modo `window` para o caminho antigo, que não funciona no app desktop (o Rust só conhece `fullscreen` e `region`).
- A biblioteca de captura (`xcap 0.2.2`) oferece `Window::all()`, que lista as janelas visíveis **da frente para trás** com `id`, `app_name`, `title`, `pid`, posição, tamanho e `is_minimized`, e `capture_image()`, que captura **a própria janela**, mesmo que outra esteja por cima. No macOS a lista inclui itens que não são janelas de verdade (barra de menus, Dock, janelas minúsculas) e precisa de filtro.
- Janelas de overlays sem foco não recebem eventos de mouse no webview do macOS (aprendido no Ciclo 1). Por isso a janela sob o cursor é descoberta no Rust, não na página.

## 3. Decisões Acordadas
- **Resultado:** a imagem da **janela inteira, limpa** (a própria janela, sem o que estiver por cima, cantos arredondados transparentes), como o macOS e a Ferramenta de Captura do Windows. Se essa captura falhar, o fallback recorta o quadro congelado no retângulo da janela.
- **Interação:** destaque ao passar o mouse + clique, funcionando nos dois monitores. Uma janela que ocupa dois monitores é destacada nos dois.
- **Barra de modos única:** a barra (Área / Janela / Tela Inteira / ✕) vira um componente compartilhado pelos três overlays. Hoje a Tela Inteira só tem "Área" e ✕; passa a ter os mesmos botões, e "Janela" deixa de ser "Em breve".
- **Escopo:** só macOS é validado. Fora: janelas de outros Spaces, janelas minimizadas, captura com rolagem.

## 4. Fluxo
1. `begin_capture('window')` (pelo botão, pelo menu ou trocando o modo na barra) captura os monitores como no Ciclo 1 e também lista as janelas (`list_windows`), já filtradas e na ordem da frente para trás. A lista fica na sessão.
2. O rastreador do cursor (já existente) passa a, no modo `window`, descobrir a janela no topo sob o cursor (`window_at`) e emitir `overlay-hover-window` quando muda (e a cada ~320ms, como o evento de monitor ativo). O payload leva `id`, `appName`, `title` e `rects`: o retângulo da janela **recortado e em coordenadas locais** de cada monitor que ela toca. `id` nulo significa "nenhuma janela".
3. Cada overlay mostra o quadro congelado escurecido, e o destaque (tint e borda na cor da marca) no retângulo que lhe cabe, com o rótulo "App — título".
4. O clique chama `finish_capture(id_do_monitor, { kind: 'window', id })`. O Rust captura a janela (`resolve_window_capture`); na falha, recorta o quadro congelado do monitor pelo retângulo recortado da janela.
5. O resultado entra na galeria como "Janela #N", e a imagem é copiada para o clipboard (como nos outros modos).
6. `Esc` cancela. Clique onde não há janela é ignorado.

## 5. Arquitetura

### 5.1 Rust (`src-tauri/src`)
- `capture.rs`:
  - `WindowInfo { id: u32, app_name: String, title: String, x: i32, y: i32, width: u32, height: u32 }` (lógicos, ordem da frente para trás).
  - `is_capturable_window(app_name: &str, width: u32, height: u32, minimized: bool, pid: u32, own_pid: u32) -> bool`: rejeita janelas do próprio app, minimizadas, menores que 80×40 e de apps de sistema que não são janelas de usuário (`Window Server`, `Dock`, `SystemUIServer`, `Control Center`, `Notification Center`, `Spotlight`).
  - `list_windows() -> Result<Vec<WindowInfo>, String>` (usa `xcap::Window::all()` e o filtro, com `std::process::id()` como `own_pid`).
  - `window_at(windows: &[WindowInfo], x: f64, y: f64) -> Option<u32>`: a primeira (topo) que contém o ponto, com a mesma convenção `[início, fim)` de `monitor_at`.
  - `local_rects_for(window: &WindowInfo, monitors: &[MonitorInfo]) -> Vec<(u32, UiRect)>`: interseção da janela com cada monitor, em coordenadas locais ao monitor (preserva origem negativa); monitores sem interseção ficam de fora.
  - `capture_window(id: u32) -> Result<RgbaImage, String>`.
  - `resolve_window_capture(frame: &RgbaImage, monitor: &MonitorInfo, window: &WindowInfo, capture: impl FnOnce(u32) -> Result<RgbaImage, String>) -> Result<RgbaImage, String>`: usa `capture(window.id)` e, se falhar, recorta `frame` pelo retângulo da janela recortado ao monitor (via `selection_to_physical`).
  - `Selection` ganha `Window { id: u32 }` (serde `kind: "window"`); `selection_to_physical` devolve erro para essa variante, pois ela é resolvida por `resolve_window_capture`.
- `capture_session.rs`:
  - `CaptureSession` guarda `windows: Vec<WindowInfo>` (parâmetro novo de `new`), com `windows()` e `window(id)`.
  - `validate_mode` aceita `window`; `cursor_for_mode("window")` é `Default`.
  - Nova constante `EVENT_HOVER_WINDOW = "overlay-hover-window"`; o rastreador, no modo `window`, emite o payload `{ id, appName, title, rects: [{ monitorId, x, y, width, height }] }`.
  - `finish_capture` trata `Selection::Window`; o payload de `capture-complete` ganha o campo `kind` (`"region" | "fullscreen" | "window"`), mantendo `fullscreen`.
- `begin_capture` chama `list_windows` junto com a captura dos monitores (falha em listar janelas não impede os outros modos: a lista fica vazia).

### 5.2 Frontend (`src`)
- `utils/overlayParams.ts`: `OverlayMode` e `parseOverlayParams` aceitam `window`.
- `services/captureService.ts`: `CaptureSelection` ganha `{ kind: 'window'; id: number }`; `EVENT_HOVER_WINDOW`; `onHoverWindowChanged(cb)`; `CaptureResult` ganha `kind`.
- `utils/captureTitle.ts`: `captureTitle(kind, count)` com "Captura", "Tela Inteira" e "Janela".
- `components/CaptureModeBar.tsx` (novo): a barra de modos extraída de `CaptureOverlay`, com as props `mode`, `onSwitchMode`, `onCancel`; usada por `CaptureOverlay`, `ScreenPicker` e `WindowPicker`. Mantém `data-capture-ui` e `cursor: default`.
- `components/WindowPicker.tsx` (novo): quadro congelado escurecido, retângulo de destaque e rótulo; função pura `resolveWindowHighlight(hover, monitorId)` devolve o retângulo local ou `null`.
- `components/OverlayApp.tsx`: no modo `window` renderiza `WindowPicker`, assina `onHoverWindowChanged` e chama `finishCapture(monitorId, { kind: 'window', id })` no clique.
- `App.tsx`: `handleStartCapture` passa `window` ao `beginCapture`; o título da galeria usa `captureTitle(kind, count)`.

## 6. Tratamento de Erros
- Falha ao listar janelas: lista vazia; o modo Janela mostra o quadro sem destaque e o usuário pode trocar de modo.
- Janela some entre o hover e o clique: `capture_window` falha e o fallback recorta o quadro congelado; se o retângulo estiver fora do quadro, erro e a captura é cancelada (comportamento do Ciclo 1).
- Permissão de Gravação de Tela negada: mesmo aviso do Ciclo 1 (títulos de janela também dependem dela).

## 7. Testes
- **Rust:** `is_capturable_window` (cada motivo de exclusão e um caso aceito); `window_at` (sobreposição escolhe a do topo, bordas `[início, fim)`, fora de todas); `local_rects_for` (janela em um monitor, janela entre dois monitores, monitor com origem negativa, sem interseção); `resolve_window_capture` (usa a captura limpa quando existe, cai no recorte quando falha, erro quando o retângulo está fora do quadro); `Selection::Window` serializa como `{"kind":"window","id":N}`; `validate_mode("window")`; nomes de evento e payload.
- **Vitest:** `parseOverlayParams` com `mode=window`; `captureService` (seleção, evento e `kind` do resultado); `captureTitle` com os três tipos; `resolveWindowHighlight`; `CaptureModeBar` usada pelos três overlays e sem o texto "Em breve"; `App.tsx` envia `window` ao `beginCapture`.
- **Validação manual (sua):** dois monitores; destaque seguindo o mouse e trocando de monitor; janela entre dois monitores; janela parcialmente coberta (sai inteira e limpa); `Esc`; troca de modo pela barra; resultado na galeria e no clipboard.

## 8. Documentação
README (recurso e roadmap: captura de janela entregue), `docs/manual-de-funcionamento-e-fluxo.md` (modo Janela) e `docs/guia-rust-e-backend.md` (novos comandos, evento e funções).
