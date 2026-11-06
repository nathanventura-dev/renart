# Captura Multi-Monitor (Ciclo 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar qualquer monitor com seleção de região livre e tela inteira com câmera, no macOS, sem depender do monitor onde o RenArt está aberto.

**Architecture:** O Rust congela todos os monitores numa sessão em memória e abre uma janela Tauri sem borda por monitor (`?overlay=<id>&mode=<m>`); cada overlay mostra o quadro do seu monitor (região via `CaptureOverlay`, tela inteira via `ScreenPicker`) e devolve o resultado por `finish_capture`. A janela principal recebe o evento `capture-complete` e adiciona à galeria. No navegador, o fluxo atual é mantido.

**Tech Stack:** Rust (Tauri 2.12, xcap 0.2.2, core-graphics 0.24, image), React 19, TypeScript, Vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-06-multi-monitor-capture-design.md`

## Global Constraints

- Um monitor por print; a seleção nunca atravessa monitores.
- Coordenadas da seleção são **lógicas** (pontos do monitor); o recorte usa a razão real `frame_físico / tamanho_lógico` de cada eixo (não o `scale_factor` nominal), para tolerar arredondamentos de 1px.
- Nomes de evento idênticos em Rust e TypeScript: `capture-complete`, `capture-cancelled`, `overlay-mode-changed`. Labels de janela: `capture-overlay-<id>`.
- Código de erro de permissão: `screen-recording-denied`.
- Janela principal tem label `main`; é escondida durante a captura e sempre restaurada ao concluir ou cancelar.
- Modo "Janela" fica desativado com a dica "Em breve" (Ciclo 2).
- Fora do Tauri o comportamento atual (overlay interno + `getDisplayMedia`) permanece intacto.
- Rust: `cargo test` roda em `src-tauri/` com `. "$HOME/.cargo/env"`; o `core-foundation` fica fixado em `=0.10.0`. Vitest roda em ambiente node (sem DOM): lógica testável fica em funções puras.
- Commits em português, formato `tipo(escopo): descrição`, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Monitor posicionado à esquerda/acima do principal (coordenadas **negativas**): o overlay precisa abrir exatamente sobre ele (Task 1, `overlay_geometry`).
- Dois monitores com escalas diferentes (1× externo + 2× interno): cada recorte usa a razão do próprio monitor (Task 1).
- Seleção que começa ou termina fora do monitor, ou com tamanho zero: é limitada ou rejeitada, nunca gera imagem vazia nem pânico (Task 1).
- `finish_capture`/`get_overlay_frame` com id inexistente ou sem sessão (overlay órfão): erro claro e a captura é cancelada, sem travar overlays na tela (Tasks 2 e 3).
- Atalho global apertado duas vezes ou captura iniciada com sessão aberta: a anterior é substituída e as janelas antigas fechadas (Tasks 2 e 3).
- Permissão de Gravação de Tela negada: aviso com o caminho em Ajustes do Sistema, nenhuma janela escondida ou overlay aberto (Tasks 2, 3 e 6).

---

### Task 1: Núcleo de monitores e conversão de seleção (Rust)

**Files:**
- Modify: `src-tauri/src/capture.rs`
- Test: `src-tauri/tests/capture_test.rs`

**Interfaces:**
- Produces:
  - `#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)] pub struct MonitorInfo { pub id: u32, pub name: String, pub x: i32, pub y: i32, pub width: u32, pub height: u32, pub scale_factor: f32, pub is_primary: bool }` (width/height lógicos).
  - `#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)] #[serde(tag = "kind", rename_all = "lowercase")] pub enum Selection { Fullscreen, Region { x: f64, y: f64, width: f64, height: f64 } }`.
  - `pub fn selection_to_physical(selection: &Selection, logical_w: u32, logical_h: u32, frame_w: u32, frame_h: u32) -> Result<RectBounds, String>`.
  - `pub fn overlay_geometry(m: &MonitorInfo) -> (f64, f64, f64, f64)` devolvendo `(x, y, width, height)` lógicos, preservando x/y negativos.
  - `pub fn list_monitors() -> Result<Vec<MonitorInfo>, String>` e `pub fn capture_monitor(id: u32) -> Result<image::RgbaImage, String>`.

- [ ] **Step 1: Escrever os testes que falham** em `src-tauri/tests/capture_test.rs`:
  - `test_selection_fullscreen_covers_whole_frame`: `Selection::Fullscreen` com frame 2880×1800 → `RectBounds{0,0,2880,1800}`.
  - `test_selection_region_scales_by_real_ratio_2x`: lógico 1440×900, frame 2880×1800, `Region{x:100.0,y:50.0,width:300.0,height:200.0}` → `{200,100,600,400}`.
  - `test_selection_region_scales_1x`: lógico 1920×1080, frame 1920×1080, mesma região → `{100,50,300,200}`.
  - `test_selection_uses_per_axis_ratio_when_frame_is_off_by_one_pixel`: lógico 1440×900, frame 2879×1800, região em x=0,width=1440 → largura física ≤ 2879 e sem erro.
  - `test_selection_region_clamped_when_partly_outside`: lógico 1000×800, 1×, `Region{x:900.0,y:700.0,width:300.0,height:300.0}` → `{900,700,100,100}`.
  - `test_selection_region_rejects_zero_size_and_fully_outside`: largura 0 → `Err`; `x:1200.0` num monitor de 1000 → `Err`.
  - `test_overlay_geometry_keeps_negative_origin`: `MonitorInfo{x:-1920,y:-200,width:1920,height:1080,..}` → `(-1920.0,-200.0,1920.0,1080.0)`.
- [ ] **Step 2: Rodar `cd src-tauri && . "$HOME/.cargo/env" && cargo test --test capture_test`.** Expected: FAIL (itens não existem).
- [ ] **Step 3: Implementar** os tipos e funções acima em `capture.rs`. `selection_to_physical` calcula `rx = frame_w / logical_w` e `ry = frame_h / logical_h` por eixo, converte com `round()` e delega a `validate_bounds`. `list_monitors` mapeia `xcap::Monitor::all()`; `capture_monitor` localiza por `id()` e chama `capture_image()`. `capture_fullscreen`/`capture_region` existentes continuam funcionando (monitor principal) para `tauri_capture_screen`.
- [ ] **Step 4: Rodar `cargo test --test capture_test` e `cargo check --all-targets`.** Expected: PASS e sem erros.
- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/capture.rs src-tauri/tests/capture_test.rs
git commit -m "feat(capture): listar monitores e converter selecao logica em pixels fisicos"
```

---

### Task 2: Sessão de captura e permissão (Rust)

**Files:**
- Create: `src-tauri/src/capture_session.rs`, `src-tauri/src/permissions.rs`
- Modify: `src-tauri/src/lib.rs` (apenas `pub mod capture_session; pub mod permissions;`)
- Test: `src-tauri/tests/session_test.rs`

**Interfaces:**
- Consumes: `MonitorInfo`, `Selection`, `selection_to_physical` (Task 1).
- Produces:
  - Constantes `pub const EVENT_CAPTURE_COMPLETE: &str = "capture-complete"; EVENT_CAPTURE_CANCELLED = "capture-cancelled"; EVENT_OVERLAY_MODE = "overlay-mode-changed"; pub const DENIED_ERROR: &str = "screen-recording-denied";` e `pub fn overlay_label(id: u32) -> String` (`capture-overlay-<id>`).
  - `pub struct CaptureSession` com `pub fn new(mode: String, monitors: Vec<MonitorInfo>, frames: HashMap<u32, image::RgbaImage>) -> Self`, `pub fn monitor(&self, id: u32) -> Result<&MonitorInfo, String>`, `pub fn frame(&self, id: u32) -> Result<&image::RgbaImage, String>`, `pub fn crop(&self, id: u32, selection: &Selection) -> Result<image::RgbaImage, String>` e `pub fn mode(&self) -> &str`.
  - `pub type SessionState = std::sync::Mutex<Option<CaptureSession>>;` e `pub fn replace_session(state: &SessionState, session: CaptureSession) -> Option<CaptureSession>` (devolve a anterior, se houver) e `pub fn take_session(state: &SessionState) -> Option<CaptureSession>`.
  - `permissions::ensure_screen_recording(allowed: bool) -> Result<(), String>` (Err = `DENIED_ERROR`) e `permissions::screen_recording_allowed() -> bool` (macOS via `core_graphics::access::ScreenCaptureAccess.preflight()`, `true` nos demais).

- [ ] **Step 1: Escrever os testes que falham** em `src-tauri/tests/session_test.rs`, com monitores e quadros sintéticos (imagens `RgbaImage::from_pixel` de cores distintas por monitor):
  - `test_session_returns_frame_and_monitor_by_id` e `test_unknown_id_is_an_error` (mensagem menciona o id).
  - `test_crop_uses_each_monitors_own_ratio`: monitor 1 (1×, quadro 100×100 vermelho) e monitor 2 (2×, quadro 400×400 azul, lógico 200×200); recorte `Region` em cada um devolve imagem com a cor e o tamanho esperados.
  - `test_crop_fullscreen_returns_whole_frame`.
  - `test_replace_session_returns_previous_one`: o segundo `replace_session` devolve a primeira; `take_session` esvazia o estado.
  - `test_overlay_label_format` e `test_event_names_match_the_frontend_contract` (os três nomes literais).
  - `test_denied_permission_maps_to_error_code`: `ensure_screen_recording(false) == Err("screen-recording-denied")`, `true` → `Ok(())`.
- [ ] **Step 2: Rodar `cargo test --test session_test`.** Expected: FAIL.
- [ ] **Step 3: Implementar** os dois módulos. `crop` obtém monitor e quadro, calcula `selection_to_physical` com `monitor.width/height` e as dimensões do quadro, e usa `image::imageops::crop_imm(...).to_image()`.
- [ ] **Step 4: Rodar `cargo test` completo e `cargo check --all-targets`.** Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/capture_session.rs src-tauri/src/permissions.rs src-tauri/src/lib.rs src-tauri/tests/session_test.rs
git commit -m "feat(capture): adicionar sessao de captura multi-monitor e checagem de permissao"
```

---

### Task 3: Comandos Tauri e janelas de overlay (Rust)

**Files:**
- Modify: `src-tauri/src/capture_session.rs` (comandos), `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Test: `src-tauri/tests/session_test.rs` (acréscimos pequenos)

**Interfaces:**
- Consumes: Tasks 1 e 2.
- Produces (comandos Tauri `async`, registrados em `lib.rs`; o estado `SessionState` é gerenciado com `.manage(...)`):
  - `begin_capture(app: AppHandle, state: State<SessionState>, mode: String) -> Result<(), String>`: valida `mode ∈ {region, fullscreen}`; `ensure_screen_recording(screen_recording_allowed())?`; fecha overlays da sessão anterior (se houver); captura todos os monitores **antes** de esconder nada além da janela `main`; esconde `main`; guarda a sessão; abre um `WebviewWindowBuilder` por monitor com label `overlay_label(id)`, URL `WebviewUrl::App("index.html?overlay=<id>&mode=<mode>")`, posição/tamanho de `overlay_geometry`, `decorations(false)`, `always_on_top(true)`, `resizable(false)`, `skip_taskbar(true)`, `visible_on_all_workspaces(true)`. Em qualquer falha restaura a `main` e descarta a sessão.
  - `get_overlay_frame(state, id: u32) -> Result<String, String>`: PNG do quadro como `data:image/png;base64,...`.
  - `finish_capture(app, state, id: u32, selection: Selection) -> Result<(), String>`: recorta, copia para o clipboard (`copy_to_clipboard`), fecha todos os overlays, mostra e foca `main`, emite `capture-complete` com payload `{ "dataUrl": "...", "fullscreen": <bool> }`, descarta a sessão.
  - `cancel_capture(app, state) -> Result<(), String>`: fecha overlays, mostra `main`, emite `capture-cancelled`, descarta a sessão (idempotente).
  - `set_overlay_mode(app, mode: String) -> Result<(), String>`: emite `overlay-mode-changed` com o novo modo para todos os overlays.
  - Função pura `pub fn build_overlay_url(id: u32, mode: &str) -> String` (testável).

- [ ] **Step 1: Escrever os testes que falham** em `session_test.rs`: `test_build_overlay_url_has_id_and_mode` (`index.html?overlay=3&mode=fullscreen`) e `test_begin_capture_rejects_unknown_mode` para a função pura de validação `validate_mode(&str) -> Result<(), String>`.
- [ ] **Step 2: Rodar `cargo test --test session_test`.** Expected: FAIL.
- [ ] **Step 3: Implementar** `build_overlay_url`, `validate_mode` e os cinco comandos; registrar em `lib.rs` (`.manage(SessionState::default())`, `invoke_handler`); em `capabilities/default.json` ampliar `windows` para `["main", "capture-overlay-*"]` e manter `core:default`. Encapsular o fechamento de overlays e a restauração da `main` numa função interna única usada por `finish_capture`, `cancel_capture` e pelos caminhos de erro.
- [ ] **Step 4: Rodar `cargo test` e `cargo check --all-targets`.** Expected: PASS e sem erros novos (os avisos de `ocr.rs` já existiam).
- [ ] **Step 5: Commit**
```bash
git add src-tauri
git commit -m "feat(capture): comandos begin/finish/cancel e janelas de overlay por monitor"
```

---

### Task 4: Roteamento por URL e serviço de captura (frontend)

**Files:**
- Create: `src/utils/overlayParams.ts`, `src/services/captureService.ts`
- Modify: `src/main.tsx`
- Test: `tests/overlayParams.test.ts`, `tests/captureService.test.ts`

**Interfaces:**
- Produces:
  - `parseOverlayParams(search: string): { monitorId: number; mode: 'region' | 'fullscreen' } | null`.
  - `captureService.ts`: constantes `EVENT_CAPTURE_COMPLETE`, `EVENT_CAPTURE_CANCELLED`, `EVENT_OVERLAY_MODE`; tipo `CaptureSelection = { kind: 'fullscreen' } | { kind: 'region'; x: number; y: number; width: number; height: number }`; `isTauri(): boolean`; `beginCapture(mode: 'region' | 'fullscreen', deps?: ServiceDeps): Promise<void>`; `getOverlayFrame(id: number, deps?): Promise<string>`; `finishCapture(id: number, selection: CaptureSelection, deps?): Promise<void>`; `cancelCapture(deps?): Promise<void>`; `setOverlayMode(mode, deps?): Promise<void>`; `onCaptureComplete(cb: (r: { dataUrl: string; fullscreen: boolean }) => void, deps?): Promise<() => void>`; `onCaptureCancelled(cb, deps?)`; `onOverlayModeChanged(cb: (mode) => void, deps?)`. `ServiceDeps = { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>; listen?: ListenFn; isTauri?: boolean }`. Fora do Tauri, `beginCapture`/`cancelCapture`/`finishCapture` rejeitam com `Error('capture-unavailable')` e os `on*` devolvem `() => {}` sem assinar.
  - `main.tsx` renderiza `OverlayApp` (Task 5) quando `parseOverlayParams(window.location.search)` não é `null`, senão `App`.

- [ ] **Step 1: Escrever os testes que falham.**
  - `overlayParams.test.ts`: `?overlay=2&mode=region` → `{monitorId:2,mode:'region'}`; `?overlay=0&mode=fullscreen` → id 0 válido; sem `overlay` → `null`; `mode=window` ou ausente → `null`; `overlay=abc` → `null`; `overlay=-1` → `null`.
  - `captureService.test.ts` com `invoke`/`listen` injetados: `beginCapture('region')` chama `begin_capture` com `{ mode: 'region' }`; `finishCapture(3, {kind:'region',x:1,y:2,width:3,height:4})` chama `finish_capture` com `{ id: 3, selection: {...} }`; `onCaptureComplete` assina `capture-complete` e repassa `{dataUrl, fullscreen}`; fora do Tauri os `on*` não chamam `listen` e `beginCapture` rejeita com `capture-unavailable`; os três nomes de evento e `denied` (`screen-recording-denied`) batem com os literais de `capture_session.rs` lidos do arquivo.
- [ ] **Step 2: Rodar `npx vitest run tests/overlayParams.test.ts tests/captureService.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implementar** os dois módulos e o ajuste em `main.tsx` (import dinâmico não é necessário; `OverlayApp` é importado estaticamente, e o componente é criado na Task 5 — nesta task, criar `src/components/OverlayApp.tsx` mínimo exportando um componente que renderiza `null`, para o `tsc` passar).
- [ ] **Step 4: Rodar `npx vitest run && npx tsc --noEmit`.** Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/utils/overlayParams.ts src/services/captureService.ts src/main.tsx src/components/OverlayApp.tsx tests
git commit -m "feat(capture): roteamento por URL do overlay e servico de captura multi-monitor"
```

---

### Task 5: Overlays — ScreenPicker e OverlayApp (frontend)

**Files:**
- Create: `src/components/ScreenPicker.tsx`
- Modify: `src/components/OverlayApp.tsx`, `src/components/CaptureOverlay.tsx`
- Test: `tests/screenPicker.test.ts`

**Interfaces:**
- Consumes: `captureService` e `parseOverlayParams` (Task 4).
- Produces:
  - Função pura `resolvePickerState(hovered: boolean): { dimmed: boolean; showCamera: boolean; hint: string }` em `ScreenPicker.tsx`: não hover → `{dimmed:true, showCamera:false, hint:''}`; hover → `{dimmed:false, showCamera:true, hint:'Clique para capturar esta tela'}`.
  - `ScreenPicker: React.FC<{ frameDataUrl: string; onPick: () => void; onCancel: () => void; onSwitchMode: (m: 'region') => void }>`: quadro de fundo, escurecimento conforme `resolvePickerState`, câmera (`Camera` do lucide) centralizada no hover, clique chama `onPick`, `Esc` chama `onCancel`.
  - `CaptureOverlay` ganha a prop opcional `windowDisabled?: boolean`; quando verdadeira, o botão "Janela" fica desabilitado com `title="Em breve"`. Comportamento padrão inalterado.
  - `OverlayApp`: lê os parâmetros, carrega o quadro com `getOverlayFrame`; modo `region` renderiza `CaptureOverlay` (`windowDisabled`, `onComplete` converte `RectBounds` em `{kind:'region',...}` e chama `finishCapture`, `onCancel` chama `cancelCapture`, `onSwitchMode('fullscreen')` chama `setOverlayMode('fullscreen')`); modo `fullscreen` renderiza `ScreenPicker` (`onPick` → `finishCapture(id, {kind:'fullscreen'})`); escuta `onOverlayModeChanged` para trocar de UI; se `getOverlayFrame`/`finishCapture` falharem, chama `cancelCapture`.

- [ ] **Step 1: Escrever os testes que falham** em `tests/screenPicker.test.ts`: os dois estados de `resolvePickerState`; que `ScreenPicker.tsx` importa `Camera` de `lucide-react` e trata `Escape`; que `CaptureOverlay.tsx` expõe `windowDisabled` e usa o texto `Em breve`; que `OverlayApp.tsx` usa `finishCapture`, `cancelCapture` e `setOverlayMode`.
- [ ] **Step 2: Rodar `npx vitest run tests/screenPicker.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implementar** os componentes conforme as interfaces; o `OverlayApp` usa `useTheme` apenas se precisar de cores (o overlay é escuro por natureza e não depende do tema).
- [ ] **Step 4: Rodar `npx vitest run && npx tsc --noEmit && npx vite build`.** Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src tests
git commit -m "feat(capture): adicionar ScreenPicker com camera e OverlayApp por monitor"
```

---

### Task 6: Integração no App, avisos de permissão, docs e validação

**Files:**
- Modify: `src/App.tsx`, `README.md`, `docs/manual-de-funcionamento-e-fluxo.md`, `docs/guia-rust-e-backend.md`
- Test: `tests/multiMonitorWiring.test.ts`, `tests/readmeStructure.test.ts`

**Interfaces:**
- Consumes: `beginCapture`, `onCaptureComplete`, `onCaptureCancelled`, `isTauri` (Task 4); `handleStartCapture` existente.
- Produces:
  - Função pura `captureTitle(fullscreen: boolean, count: number): string` em `src/utils/captureTitle.ts` (`Captura #N` / `Tela Inteira #N`, com N = `count + 1`).
  - `describeCaptureError(err: unknown): string` em `src/services/captureService.ts`: para `screen-recording-denied` devolve `Permissão de Gravação de Tela negada. Libere em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e reabra o RenArt.`; para outros erros `Não foi possível iniciar a captura.`.
  - `App.tsx`: no Tauri, `handleStartCapture('region' | 'fullscreen')` chama `beginCapture` (o `window` continua no caminho atual); uma assinatura `onCaptureComplete` adiciona a captura à galeria com `captureTitle` e chama `editorStore.switchCapture`/`setImageBase64` como hoje; erros de `beginCapture` aparecem num aviso discreto (estado local `captureNotice`) com `describeCaptureError`; fora do Tauri o fluxo atual é preservado.

- [ ] **Step 1: Escrever os testes que falham.** `multiMonitorWiring.test.ts`: `captureTitle(false,0) === 'Captura #1'` e `captureTitle(true,4) === 'Tela Inteira #5'`; `describeCaptureError(new Error('screen-recording-denied'))` e `describeCaptureError('screen-recording-denied')` contêm "Gravação de Tela"; erro genérico devolve a mensagem padrão; `App.tsx` contém `beginCapture`, `onCaptureComplete` e `describeCaptureError`. `readmeStructure.test.ts`: README contém `Captura multi-monitor`.
- [ ] **Step 2: Rodar `npx vitest run tests/multiMonitorWiring.test.ts tests/readmeStructure.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implementar** `captureTitle`, `describeCaptureError`, a integração no `App.tsx`, e atualizar README (recurso "Captura multi-monitor" e roadmap da Fase 2, mantendo "Janela" como Ciclo 2) e os dois documentos técnicos descrevendo o fluxo e os comandos `begin_capture`, `get_overlay_frame`, `finish_capture`, `cancel_capture`.
- [ ] **Step 4: Verificação completa:** `npx vitest run && npx tsc --noEmit && npx vite build` e, em `src-tauri/`, `cargo test && cargo check --all-targets`. Atualizar a contagem de testes do README com o total real. Expected: tudo verde.
- [ ] **Step 5: Validação manual com `npm run tauri dev`** (executada pelo usuário com dois monitores): região em cada monitor com o RenArt aberto no outro; tela inteira com a câmera em cada tela; `Esc` em qualquer overlay restaura a janela; permissão negada mostra o aviso; atalho `Cmd+Shift+S` com o RenArt em segundo plano; monitor posicionado à esquerda/acima do principal. Registrar o resultado e ajustar o que falhar.
- [ ] **Step 6: Commit**
```bash
git add -A src tests README.md docs
git commit -m "feat(capture): integrar captura multi-monitor ao App e documentar o novo fluxo"
```
