# Design Doc: Captura Multi-Monitor (Ciclo 1 — Região livre e Tela inteira com câmera)

## 1. Objetivo
Permitir que o usuário capture qualquer monitor, escolhendo livremente onde tirar o print, com o comportamento do macOS (`Cmd+Shift+5`):
- **Região:** seleção em qualquer monitor, não só no monitor onde o RenArt está aberto.
- **Tela inteira:** cada monitor mostra uma **câmera** ao passar o mouse; o clique captura aquele monitor.

É o item "janelas multi-monitores sem bordas" da Fase 2 do roadmap. A **captura de janela** é o Ciclo 2 e fica fora deste spec.

## 2. Problemas Diagnosticados (código atual)
1. `capture_fullscreen` e `capture_region` em `src-tauri/src/capture.rs` usam `monitors.find(|m| m.is_primary())`: só o monitor principal é capturado.
2. A seleção de região é um overlay **dentro da janela do RenArt** (1100×720) sobre o quadro congelado; só funciona onde a janela está.
3. O modo `window` não existe no Rust (`tauri_capture_screen` devolve "Modo de captura desconhecido") e o fallback `getDisplayMedia` não existe no webview do macOS, então nada aparece.
4. Sem a permissão de Gravação de Tela, o macOS entrega só o papel de parede e as janelas do próprio app, e o app não avisa.

## 3. Decisões Acordadas
- **Dois ciclos.** Ciclo 1 (este): monitores, região livre, tela inteira com câmera. Ciclo 2: captura de janela (lista, destaque ao passar o mouse, clique para capturar), reaproveitando a base do Ciclo 1.
- **Um monitor por print.** A seleção de região fica restrita ao monitor onde o usuário começou a arrastar (como no macOS). Não há costura entre telas com escalas diferentes.
- **Abordagem: uma janela de seleção por monitor** (janelas Tauri sem borda). Uma janela única cobrindo todas as telas foi descartada porque o macOS não permite janelas atravessando telas com Spaces separados (padrão). Manter a seleção dentro do app foi descartado por não resolver o problema.

## 4. Fluxo
1. O usuário aciona a captura (botão "Nova Captura", menu ou `Cmd/Ctrl+Shift+S`) no modo **região** ou **tela inteira**.
2. No Tauri, o frontend chama `begin_capture(mode)`:
   - Verifica a permissão de Gravação de Tela; se negada, retorna erro `screen-recording-denied` (ver seção 7).
   - **Esconde a janela principal** (para não aparecer no quadro).
   - Captura **todos** os monitores de uma vez e guarda os quadros em memória na sessão.
   - Abre uma janela por monitor: label `capture-overlay-<id>`, URL `index.html?overlay=<id>&mode=<region|fullscreen>`, sem borda, em primeiro plano, visível em todos os Spaces, com posição e tamanho exatos do monitor (coordenadas lógicas).
3. Cada overlay chama `get_overlay_frame(id)`, recebe o quadro do seu monitor e mostra a UI do modo.
4. Ao concluir, o overlay chama `finish_capture(id, selection)`:
   - `selection` é `{ kind: 'fullscreen' }` ou `{ kind: 'region', x, y, width, height }` em pixels lógicos do monitor.
   - O Rust converte para pixels físicos pela escala do monitor, recorta, copia para o clipboard (função existente `copy_to_clipboard`), fecha todos os overlays, mostra a janela principal e emite `capture-complete` com o `dataUrl` PNG.
5. `Esc` em qualquer overlay chama `cancel_capture()`: fecha os overlays, descarta a sessão, mostra a janela principal e emite `capture-cancelled`.
6. A janela principal recebe `capture-complete` e adiciona a captura à galeria pelo mesmo caminho de hoje (título "Captura #N" ou "Tela Inteira #N").

No navegador (fora do Tauri) o comportamento atual (overlay interno + `getDisplayMedia`) permanece.

## 5. Interface dos Overlays
- **Região:** reaproveita `CaptureOverlay` (arraste, redimensionamento, barra flutuante), agora ocupando a janela inteira do monitor. A seleção não sai do monitor porque cada janela só enxerga o seu quadro. A barra de modos mostra "Janela" desativado com a dica "Em breve".
- **Tela inteira:** novo componente `ScreenPicker`. Cada monitor aparece levemente escurecido; ao passar o mouse sobre um, ele clareia e mostra uma **câmera** (ícone `Camera`) no centro com o texto "Clique para capturar esta tela". O clique captura aquele monitor. `Esc` cancela.
- **Troca de modo** (região ↔ tela inteira) pela barra: o overlay emite `overlay-mode-changed` e todos os overlays trocam de UI juntos.

## 6. Arquitetura

### 6.1 Rust (`src-tauri/src`)
- `capture.rs`:
  - `MonitorInfo { id: u32, name: String, x: i32, y: i32, width: u32, height: u32, scale_factor: f32, is_primary: bool }` (serializável; width/height lógicos).
  - `list_monitors() -> Result<Vec<MonitorInfo>, String>` e `capture_monitor(id: u32) -> Result<RgbaImage, String>`.
  - `selection_to_physical(selection: &Selection, scale: f32, frame_width: u32, frame_height: u32) -> Result<RectBounds, String>`: função pura que converte pixels lógicos em físicos e valida/limita com `validate_bounds`.
  - `capture_fullscreen` e `capture_region` deixam de depender de `is_primary` e recebem o `monitor_id`.
- `capture_session.rs` (novo): `CaptureSession { frames: HashMap<u32, RgbaImage>, monitors: Vec<MonitorInfo>, mode }` guardada em `tauri::State<Mutex<Option<CaptureSession>>>`.
- Comandos Tauri (async): `begin_capture(mode)`, `get_overlay_frame(id)` (PNG como data URL), `finish_capture(id, selection)`, `cancel_capture()`.
- `permissions.rs` (novo): `screen_recording_allowed()` com `core_graphics::access::ScreenCaptureAccess` no macOS; `true` nos demais sistemas.
- `lib.rs`: registra o estado e os comandos.
- `capabilities/default.json`: `windows` passa a incluir `capture-overlay-*`, com `core:default` e as permissões de janela necessárias.

### 6.2 Frontend (`src`)
- `main.tsx`: lê `?overlay=<id>&mode=<m>`; com o parâmetro renderiza `OverlayApp`, sem ele renderiza `App`.
- `src/utils/overlayParams.ts` (novo): `parseOverlayParams(search: string)` devolvendo `{ monitorId: number; mode: 'region' | 'fullscreen' } | null`.
- `src/components/OverlayApp.tsx` (novo): carrega o quadro via `get_overlay_frame`, escolhe `CaptureOverlay` ou `ScreenPicker`, chama `finish_capture`/`cancel_capture`, escuta `overlay-mode-changed`.
- `src/components/ScreenPicker.tsx` (novo): UI da câmera.
- `src/services/captureService.ts` (novo): wrappers tipados dos comandos e eventos Tauri (`beginCapture`, `onCaptureComplete`, `onCaptureCancelled`), com a convenção "fora do Tauri não faz nada" já usada em `shortcutService.ts`.
- `App.tsx`: em `handleStartCapture`, no Tauri, chama `beginCapture` em vez do overlay interno; um `useEffect` assina `capture-complete` e adiciona à galeria (reaproveitando a lógica de `handleCaptureComplete`).

## 7. Tratamento de Erros
- **Permissão negada:** `begin_capture` retorna `screen-recording-denied`. O app mostra um aviso com o caminho "Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela" e não abre overlays.
- **Falha ao capturar um monitor:** a sessão é descartada, a janela principal volta e o erro é mostrado; nenhum overlay fica aberto.
- **Overlay fechado pelo sistema ou sessão inexistente** em `finish_capture`/`get_overlay_frame`: retorna erro, e o overlay cancela a captura.
- **Troca de monitores durante a captura:** a sessão usa a lista capturada em `begin_capture`; um novo `begin_capture` substitui qualquer sessão anterior.
- **Segundo `begin_capture` com sessão aberta:** cancela a anterior e inicia a nova (cobre o atalho global apertado duas vezes).

## 8. Fora do Escopo
- Captura de janela (Ciclo 2).
- Seleção atravessando dois monitores.
- Atalho global configurável, bandeja do sistema (Tray).
- Windows e Linux: o código usa `xcap` e janelas Tauri genéricas, mas só o macOS será validado.
- Gravação de vídeo.

## 9. Testes
- **Rust (`cargo test`):** `selection_to_physical` com escalas 1× e 2× (inclui seleção parcialmente fora do monitor e dimensão zero); sessão guarda e devolve o quadro certo por id; id inexistente retorna erro; segundo `begin_capture` substitui a sessão; `permissions` negada gera o erro `screen-recording-denied` (permissão injetável).
- **Vitest:** `parseOverlayParams` (válido, ausente, `mode` inválido, id não numérico); `captureService` fora do Tauri não chama nada e dentro do Tauri assina `capture-complete`; `ScreenPicker` destaca o monitor sob o mouse e chama o callback ao clicar; `App.tsx` usa `beginCapture` no Tauri; nome dos eventos idêntico entre TypeScript e Rust (como em `shortcutService`).
- **Validação manual (sua):** dois monitores, com a janela do RenArt em cada um; região em cada tela; tela inteira com a câmera; `Esc`; permissão negada; atalho `Cmd+Shift+S` com o RenArt em segundo plano.

## 10. Documentação
- README: marcar captura multi-monitor no roadmap e atualizar a contagem de testes.
- `docs/manual-de-funcionamento-e-fluxo.md` e `docs/guia-rust-e-backend.md`: descrever o fluxo novo e os comandos `begin_capture`, `get_overlay_frame`, `finish_capture`, `cancel_capture`.
