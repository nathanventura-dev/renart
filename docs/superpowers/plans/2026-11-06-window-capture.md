# Captura de Janela (Ciclo 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o modo Janela da captura nativa: destacar a janela sob o cursor em qualquer monitor e capturá-la, inteira e limpa, ao clicar.

**Architecture:** Na `begin_capture` o Rust também lista as janelas visíveis (filtradas, da frente para trás) e as guarda na sessão. O rastreador de cursor (Ciclo 1) descobre a janela no topo sob o mouse e emite `overlay-hover-window` com o retângulo já recortado por monitor; cada overlay desenha o destaque. O clique envia `{ kind: 'window', id }` a `finish_capture`, que captura só aquela janela via `xcap` (fallback: recorte do quadro congelado).

**Tech Stack:** Rust (Tauri 2.12, xcap 0.2.2, image), React 19, TypeScript, Vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-06-window-capture-design.md`

## Global Constraints

- Coordenadas de janelas são **lógicas** (pontos), a mesma unidade e origem de `MonitorInfo`; ordem da lista: frente para trás.
- Convenção de bordas `[início, fim)` (a mesma de `monitor_at`).
- Filtro de janelas: rejeita as do próprio processo (`std::process::id()`), minimizadas, menores que 80×40 e de apps `Window Server`, `Dock`, `SystemUIServer`, `Control Center`, `Notification Center`, `Spotlight`.
- Nomes iguais em Rust e TypeScript: evento `overlay-hover-window`; seleção `{"kind":"window","id":N}`; `kind` do resultado: `"region" | "fullscreen" | "window"` (o campo `fullscreen` do payload continua existindo).
- `CaptureSession::new` ganha um quarto parâmetro `windows: Vec<WindowInfo>`; todos os testes e chamadas existentes são atualizados junto.
- Falha ao listar janelas nunca impede a captura: lista vazia e os outros modos seguem.
- Só macOS é validado. Fora do Tauri o fluxo atual do navegador é preservado.
- Rust: `cargo test` em `src-tauri/` com `. "$HOME/.cargo/env"`. Vitest roda em ambiente node. Commits em português, `tipo(escopo): descrição`, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Janela que ocupa dois monitores, ou monitor com origem negativa: o retângulo local de cada monitor está recortado e correto (Task 1).
- Janelas sobrepostas: vence a do topo; ponto sobre o desktop devolve nenhuma janela (Task 1).
- Janela maior que o monitor ou parcialmente fora dele: o retângulo recortado nunca passa do quadro (Task 1).
- Janela some entre o hover e o clique: cai no recorte do quadro; se também não couber, erro claro e a captura é cancelada sem deixar overlays na tela (Tasks 1 e 2).
- Falha ao listar janelas: lista vazia, modos Área e Tela Inteira continuam funcionando (Task 2).
- Clique sem janela destacada é ignorado e o `Esc` cancela em qualquer overlay (Task 4).

---

### Task 1: Núcleo de janelas (Rust)

**Files:**
- Modify: `src-tauri/src/capture.rs`
- Test: `src-tauri/tests/capture_test.rs`

**Interfaces:**
- Consumes: `MonitorInfo`, `Selection`, `selection_to_physical`, `validate_bounds`, `RectBounds` (existentes). `UiRect` vive em `capture_session.rs`; para evitar dependência circular, `local_rects_for` devolve `(u32, RectF)` com `pub struct RectF { pub x: f64, pub y: f64, pub width: f64, pub height: f64 }` definida em `capture.rs` (`Debug, Clone, Copy, PartialEq, Serialize, Deserialize`).
- Produces:
  - `pub struct WindowInfo { pub id: u32, pub app_name: String, pub title: String, pub x: i32, pub y: i32, pub width: u32, pub height: u32 }` (`Debug, Clone, PartialEq, Serialize, Deserialize`).
  - `pub fn is_capturable_window(app_name: &str, width: u32, height: u32, minimized: bool, pid: u32, own_pid: u32) -> bool`.
  - `pub fn list_windows() -> Result<Vec<WindowInfo>, String>` e `pub fn capture_window(id: u32) -> Result<image::RgbaImage, String>`.
  - `pub fn window_at(windows: &[WindowInfo], x: f64, y: f64) -> Option<u32>`.
  - `pub fn local_rects_for(window: &WindowInfo, monitors: &[MonitorInfo]) -> Vec<(u32, RectF)>`.
  - `pub fn resolve_window_capture(frame: &RgbaImage, monitor: &MonitorInfo, window: &WindowInfo, capture: impl FnOnce(u32) -> Result<RgbaImage, String>) -> Result<RgbaImage, String>`.
  - `Selection::Window { id: u32 }` (serde `kind: "window"`); `selection_to_physical` devolve `Err` para ela.

- [ ] **Step 1: Escrever os testes que falham** em `capture_test.rs`:
  - `test_is_capturable_window_rejects_system_own_minimized_and_tiny`: aceita `("Safari", 1200, 800, false, 10, 99)`; rejeita app `"Dock"` e `"Window Server"`, `minimized = true`, `pid == own_pid`, `width 79` e `height 39`.
  - `test_window_at_returns_the_topmost_window_under_the_point`: janelas `[A(0,0,100x100), B(50,50,100x100)]` na ordem frente→trás; `(60,60)` → id de A (primeira da lista); `(120,120)` → B; `(500,500)` → `None`; borda `x = 100` de A não pertence a A.
  - `test_local_rects_for_clips_to_each_monitor`: monitores `M1 (0,0,1000x800)` e `M2 (1000,0,1000x800)`; janela `(900,100,300x200)` → `[(1, {x:900,y:100,width:100,height:200}), (2, {x:0,y:100,width:200,height:200})]`.
  - `test_local_rects_for_handles_negative_origin_and_no_intersection`: monitor `(-1920,-200,1920x1080)`, janela `(-1900,-100,400x300)` → retângulo `(20,100,400,300)`; janela totalmente fora de todos os monitores → vetor vazio; janela maior que o monitor → recortada ao tamanho dele.
  - `test_resolve_window_capture_prefers_the_clean_window_image`: `capture` devolve imagem 10×10 azul → resultado 10×10 azul, sem tocar no quadro.
  - `test_resolve_window_capture_falls_back_to_cropping_the_frozen_frame`: `capture` devolve `Err`; quadro 100×100 vermelho (monitor 1×), janela `(10,10,30x20)` → resultado 30×20 vermelho.
  - `test_resolve_window_capture_errors_when_window_is_outside_the_frame`: janela fora do monitor e `capture` com `Err` → `Err`.
  - `test_window_selection_serializes_with_kind_and_has_no_physical_rect`: `serde_json::to_string(&Selection::Window{id:7})` contém `"kind":"window"` e `"id":7`; `selection_to_physical(&Selection::Window{id:7}, ..)` é `Err`.
- [ ] **Step 2: Rodar `cd src-tauri && . "$HOME/.cargo/env" && cargo test --test capture_test`.** Expected: FAIL (não compila).
- [ ] **Step 3: Implementar** os tipos e funções em `capture.rs`. `local_rects_for` calcula a interseção com cada monitor e converte para coordenadas locais; `resolve_window_capture` chama `capture(window.id)` e, em erro, recorta o quadro pelo retângulo local da janela no monitor passado, usando `selection_to_physical` com `Selection::Region`. `list_windows` usa `xcap::Window::all()` e `is_capturable_window` com `std::process::id()`; `capture_window` localiza por `id()` e chama `capture_image()`.
- [ ] **Step 4: Rodar `cargo test --test capture_test` e `cargo check --all-targets`.** Expected: PASS e sem erros novos.
- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/capture.rs src-tauri/tests/capture_test.rs
git commit -m "feat(capture): listar janelas, achar a do topo sob o cursor e capturar a janela limpa"
```

---

### Task 2: Sessão, rastreador e comandos (Rust)

**Files:**
- Modify: `src-tauri/src/capture_session.rs`, `src-tauri/src/lib.rs` (só se necessário)
- Test: `src-tauri/tests/session_test.rs`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `CaptureSession::new(mode: String, monitors: Vec<MonitorInfo>, windows: Vec<WindowInfo>, frames: HashMap<u32, RgbaImage>)` (parâmetro `windows` inserido antes de `frames`), com `pub fn windows(&self) -> &[WindowInfo]` e `pub fn window(&self, id: u32) -> Result<&WindowInfo, String>`.
  - `validate_mode` aceita `"window"`; `cursor_for_mode("window")` continua `OverlayCursor::Default`.
  - `pub const EVENT_HOVER_WINDOW: &str = "overlay-hover-window";`
  - `#[derive(Clone, Serialize)] #[serde(rename_all = "camelCase")] pub struct HoverRect { pub monitor_id: u32, pub x: f64, pub y: f64, pub width: f64, pub height: f64 }` e `pub struct HoverWindowPayload { pub id: Option<u32>, pub app_name: String, pub title: String, pub rects: Vec<HoverRect> }`.
  - `pub fn build_hover_payload(window: Option<&WindowInfo>, monitors: &[MonitorInfo]) -> HoverWindowPayload` (sem janela: `id: None`, `rects` vazio).
  - `pub fn capture_kind(selection: &Selection) -> &'static str` (`"fullscreen"`, `"region"`, `"window"`); `CaptureCompletePayload` ganha `pub kind: String` e `build_complete_payload` ganha o parâmetro `kind: &str` antes de `copy` (mantendo `fullscreen`).
  - `CaptureSession::crop` continua só para `Fullscreen`/`Region`; nova `pub fn capture_selection(&self, id: u32, selection: &Selection, capture_window: impl FnOnce(u32) -> Result<RgbaImage, String>) -> Result<RgbaImage, String>` que resolve também `Window` com `resolve_window_capture` (monitor e janela vêm da sessão).
  - O rastreador, no modo `window`, emite `overlay-hover-window` quando a janela sob o cursor muda e a cada ~320ms.

- [ ] **Step 1: Atualizar e escrever os testes que falham** em `session_test.rs`: ajustar `sample_session` e todas as chamadas de `CaptureSession::new` para o novo parâmetro `windows` (vetor vazio onde não importa). Novos testes:
  - `test_session_exposes_windows_by_id`: `window(id)` encontra; id inexistente → `Err` citando o id.
  - `test_validate_mode_accepts_window`.
  - `test_build_hover_payload_has_one_rect_per_touched_monitor`: janela entre dois monitores → dois `rects` com os `monitor_id` certos; sem janela → `id None` e `rects` vazio.
  - `test_capture_kind_names_match_the_frontend`: `"fullscreen"`, `"region"`, `"window"`.
  - `test_complete_payload_carries_the_kind`: `build_complete_payload(&img, "window", ...)` → `payload.kind == "window"` e `payload.fullscreen == false`; para `"fullscreen"` → `fullscreen == true`.
  - `test_capture_selection_window_uses_the_clean_capture_and_falls_back`: sessão com janela; `capture_window` ok devolve a imagem limpa; `capture_window` com `Err` devolve o recorte do quadro; id de janela inexistente → `Err`.
  - Em `test_event_names_match_the_frontend_contract`, incluir `EVENT_HOVER_WINDOW == "overlay-hover-window"`.
  - `test_tracker_emits_hover_window_events_in_window_mode` (teste de fonte, como os existentes): `capture_session.rs` contém `EVENT_HOVER_WINDOW`, `window_at` e `list_windows`.
- [ ] **Step 2: Rodar `cargo test`.** Expected: FAIL (não compila).
- [ ] **Step 3: Implementar** os itens acima em `capture_session.rs`: `begin_capture` chama `list_windows()` (erro → `Vec::new()`), passa à sessão e valida `window`; `finish_capture` usa `capture_selection` com `capture_window` real, `capture_kind` e o novo `build_complete_payload`; o rastreador guarda a última janela emitida e, em modo `window`, usa `window_at` e `build_hover_payload`; fora do modo `window`, não emite.
- [ ] **Step 4: Rodar `cargo test` e `cargo check --all-targets`.** Expected: PASS e sem avisos novos além dos de `ocr.rs`.
- [ ] **Step 5: Commit**
```bash
git add src-tauri
git commit -m "feat(capture): sessao com janelas, destaque via rastreador e captura limpa no finish_capture"
```

---

### Task 3: Serviço, parâmetros e título (frontend)

**Files:**
- Modify: `src/utils/overlayParams.ts`, `src/services/captureService.ts`, `src/utils/captureTitle.ts`, `src/App.tsx` (só a chamada de `captureTitle`)
- Test: `tests/overlayParams.test.ts`, `tests/captureService.test.ts`, `tests/multiMonitorWiring.test.ts`

**Interfaces:**
- Produces:
  - `OverlayMode = 'region' | 'fullscreen' | 'window'`; `parseOverlayParams('?overlay=1&mode=window')` → `{ monitorId: 1, mode: 'window' }`.
  - `CaptureSelection` ganha `{ kind: 'window'; id: number }`; `CaptureResult` ganha `kind: 'region' | 'fullscreen' | 'window'`.
  - `export const EVENT_HOVER_WINDOW = 'overlay-hover-window'`; `export interface HoverWindow { id: number | null; appName: string; title: string; rects: { monitorId: number; x: number; y: number; width: number; height: number }[] }`; `onHoverWindowChanged(cb: (h: HoverWindow) => void, deps?: ServiceDeps)`.
  - `captureTitle(kind: 'region' | 'fullscreen' | 'window', count: number): string` → "Captura #N", "Tela Inteira #N", "Janela #N" (N = `count + 1`).

- [ ] **Step 1: Atualizar e escrever os testes que falham:** `overlayParams` (`mode=window` válido); `captureService` (assina `overlay-hover-window` e repassa o payload; `finishCapture` aceita a seleção de janela; o evento bate com o literal de `capture_session.rs` no teste de contrato); `multiMonitorWiring` (`captureTitle('region',0) === 'Captura #1'`, `('fullscreen',4) === 'Tela Inteira #5'`, `('window',2) === 'Janela #3'`; `App.tsx` usa `captureTitle(kind`).
- [ ] **Step 2: Rodar `npx vitest run tests/overlayParams.test.ts tests/captureService.test.ts tests/multiMonitorWiring.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implementar.** No `App.tsx`, `onCaptureComplete` passa `kind` (com fallback `fullscreen ? 'fullscreen' : 'region'` caso `kind` venha ausente).
- [ ] **Step 4: Rodar `npx vitest run && npx tsc --noEmit`.** Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src tests
git commit -m "feat(capture): modo janela no servico de captura, parametros do overlay e titulo da galeria"
```

---

### Task 4: Barra única e WindowPicker (frontend)

**Files:**
- Create: `src/components/CaptureModeBar.tsx`, `src/components/WindowPicker.tsx`
- Modify: `src/components/CaptureOverlay.tsx`, `src/components/ScreenPicker.tsx`, `src/components/OverlayApp.tsx`
- Test: `tests/screenPicker.test.ts` (atualizar), `tests/windowPicker.test.ts` (novo)

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `CaptureModeBar: React.FC<{ mode: 'region' | 'window' | 'fullscreen'; onSwitchMode: (mode: 'region' | 'window' | 'fullscreen') => void; onCancel: () => void }>`: a barra extraída de `CaptureOverlay` (botões Área, Janela, Tela Inteira e ✕), com `data-capture-ui` e `cursor: 'default'`; o botão Janela fica habilitado e o texto "Em breve" deixa de existir.
  - `resolveWindowHighlight(hover: HoverWindow | null, monitorId: number): { rect: { x: number; y: number; width: number; height: number }; label: string } | null` em `WindowPicker.tsx`: `null` se não há janela (`id === null`) ou se ela não toca esse monitor; senão o retângulo local daquele monitor e o rótulo `"App — título"` (só `"App"` se o título for vazio).
  - `WindowPicker: React.FC<{ frameDataUrl: string; monitorId: number; hover: HoverWindow | null; onPick: (windowId: number) => void; onCancel: () => void; onSwitchMode: (m: 'region' | 'window' | 'fullscreen') => void }>`: quadro escurecido, destaque (tint e borda `#d3551d`), rótulo, clique chama `onPick(hover.id)` somente quando há janela, `Esc` chama `onCancel`, usa `CaptureModeBar`.
  - `CaptureOverlay` perde a prop `windowDisabled` e usa `CaptureModeBar`; `ScreenPicker` troca a mini-barra por `CaptureModeBar` (`mode="fullscreen"`).
  - `OverlayApp`: modo `window` renderiza `WindowPicker`, assina `onHoverWindowChanged`, e `onPick` chama `finishCapture(monitorId, { kind: 'window', id })`; `onSwitchMode` de qualquer overlay chama `setOverlayMode(next)`.

- [ ] **Step 1: Atualizar e escrever os testes que falham.** `windowPicker.test.ts`: `resolveWindowHighlight` (nenhuma janela → `null`; janela que não toca o monitor → `null`; retângulo e rótulo com e sem título); `WindowPicker.tsx` trata `Escape` e só chama `onPick` com janela; `CaptureModeBar.tsx` contém `data-capture-ui`, `cursor: 'default'` e não contém "Em breve"; os três overlays (`CaptureOverlay`, `ScreenPicker`, `WindowPicker`) importam `CaptureModeBar`; `OverlayApp.tsx` usa `WindowPicker` e `onHoverWindowChanged`. Em `screenPicker.test.ts`, remover/ajustar as asserções sobre `windowDisabled`, "Em breve" e a mini-barra do `ScreenPicker`, e manter as demais (câmera só por evento, `Escape`, barra com `cursor: 'default'`, medição por `[data-capture-ui]`).
- [ ] **Step 2: Rodar `npx vitest run tests/windowPicker.test.ts tests/screenPicker.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implementar** a extração da barra sem mudar o visual atual, o `WindowPicker` e a ligação no `OverlayApp` (incluindo o relato do retângulo da barra por `setOverlayUiRect`, que continua valendo para o modo região).
- [ ] **Step 4: Rodar `npx vitest run && npx tsc --noEmit && npx vite build`.** Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src tests
git commit -m "feat(capture): barra de modos unica e WindowPicker com destaque da janela"
```

---

### Task 5: Integração, documentação e validação

**Files:**
- Modify: `src/App.tsx`, `README.md`, `docs/manual-de-funcionamento-e-fluxo.md`, `docs/guia-rust-e-backend.md`, `tests/readmeStructure.test.ts`
- Test: `tests/multiMonitorWiring.test.ts`, `tests/readmeStructure.test.ts`

**Interfaces:**
- Consumes: Tasks 1 a 4.
- Produces: o modo `window` do Tauri entra pelo mesmo `beginCapture` dos outros.

- [ ] **Step 1: Escrever os testes que falham:** `App.tsx` envia `window` ao `beginCapture` (a condição `mode === 'region' || mode === 'fullscreen'` passa a incluir `'window'`, e o caminho antigo `captureDesktopFrame('window')` fica só para o navegador); o README contém `Captura de janela` e deixa de dizer que a janela "chega no próximo ciclo".
- [ ] **Step 2: Rodar `npx vitest run tests/multiMonitorWiring.test.ts tests/readmeStructure.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implementar** a condição no `App.tsx`; atualizar README (recurso e roadmap), o manual (modo Janela: destaque e clique, janela entre dois monitores, `Esc`) e o guia do Rust (novas funções, evento e comandos); atualizar a contagem de testes do README com o total real.
- [ ] **Step 4: Verificação completa:** `npx vitest run && npx tsc --noEmit && npx vite build` e, em `src-tauri/`, `cargo test && cargo check --all-targets`. Expected: tudo verde.
- [ ] **Step 5: Validação manual com `npm run tauri dev`** (pelo usuário, com dois monitores): destaque seguindo o mouse e trocando de monitor; janela entre dois monitores destacada nos dois; janela parcialmente coberta (sai inteira e limpa, com cantos transparentes); clique fora de qualquer janela ignorado; `Esc`; trocar de modo pela barra nos três overlays; resultado como "Janela #N" na galeria e no clipboard. Ajustar o que falhar.
- [ ] **Step 6: Commit**
```bash
git add -A src tests README.md docs
git commit -m "feat(capture): integrar a captura de janela ao App e documentar o novo modo"
```
