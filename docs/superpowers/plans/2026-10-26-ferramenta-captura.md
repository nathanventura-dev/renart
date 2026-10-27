# Ferramenta de Captura Multiplataforma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desenvolver uma aplicação desktop leve e multiplataforma (Windows, macOS e Linux) de captura de tela com anotações vetoriais (formas, flechas, texto, lupa), galeria para até 10 capturas, limite de 2 instâncias, cópia automática imediata e documentação didática em `docs/`.

**Architecture:** Tauri v2 com backend nativo em Rust para captura de tela (`xcap`), controle de instâncias via socket IPC local e cópia imediata para área de transferência (`arboard`). Frontend em React 19 + TypeScript + Vite com motor Canvas 2D (`react-konva`) para anotações interativas com handles de redimensionamento e geração de PDF via `jspdf`.

**Tech Stack:** Tauri v2, Rust (2021 edition), React, TypeScript, Vite, Konva.js / react-konva, jspdf, Vitest, Lucide React.

**Spec:** `docs/superpowers/specs/2026-10-26-ferramenta-captura-multiplataforma-design.md`

## Global Constraints

- Plataformas suportadas: Windows 10/11, macOS (Intel e Apple Silicon), Linux (X11 e Wayland).
- Cópia automática imediata: ao finalizar o corte, a imagem é imediatamente copiada para o clipboard do SO.
- Limite de instâncias: no máximo 2 instâncias abertas simultaneamente; a 3ª tentativa deve focar a janela ativa existente e fechar.
- Limite de galeria: no máximo 10 capturas abertas na galeria com política FIFO para descartar a mais antiga não salva.
- Documentação obrigatória: 3 documentos didáticos gerados e atualizados em `docs/` (`arquitetura-e-tecnologias.md`, `guia-rust-e-backend.md` e `manual-de-funcionamento-e-fluxo.md`).

## Review Focus

1. **Wayland / Linux capture fallback:** Em ambientes Wayland sem PipeWire configurado, `xcap` pode retornar erro de permissão; o sistema deve capturar o erro amigavelmente e exibir mensagem de orientação sem travar.
2. **Monitores com DPI / Escala Diferente (Multi-Monitor):** Ao selecionar região em telas com escala de 125% ou 150%, as coordenadas devem ser normalizadas para que o recorte não fique deslocado.
3. **Limite da 11ª captura com edições não salvas:** Se todas as 10 capturas tiverem edições não salvas, a política FIFO deve solicitar confirmação antes de descartar a primeira.
4. **Fechamento de sockets IPC na saída forçada:** Na finalização abrupta de uma instância, o arquivo de socket/pipe deve ser liberado para que a contagem de instâncias não fique bloqueada.
5. **Geração de PDF com imagens de alta resolução:** A exportação em PDF deve manter a densidade de pixels da tela sem estourar o limite de memória ou distorcer a proporção da imagem.

---

### Task 1: Scaffolding do Projeto Tauri v2 + React e Documentação Inicial

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `docs/arquitetura-e-tecnologias.md`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: Estrutura inicial do projeto Tauri v2 configurada com scripts de build e teste Vitest.

- [ ] **Step 1: Write test verifying environment config and dependencies**
```typescript
// tests/scaffold.test.ts
import { describe, it, expect } from 'vitest';
import pkg from '../package.json';

describe('Project Scaffold', () => {
  it('defines required dependencies and scripts', () => {
    expect(pkg.scripts).toHaveProperty('build');
    expect(pkg.scripts).toHaveProperty('test');
    expect(pkg.dependencies).toHaveProperty('konva');
    expect(pkg.dependencies).toHaveProperty('react-konva');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd.exe /c npm test`
Expected: FAIL (missing package.json / vitest)

- [ ] **Step 3: Setup Tauri v2, React, TypeScript, Konva and Vitest configuration**
Configure `package.json`, `tsconfig.json`, `vite.config.ts`, `src-tauri/Cargo.toml`, and write initial `docs/arquitetura-e-tecnologias.md` documenting Tauri v2 architecture.

- [ ] **Step 4: Run test to verify it passes**
Run: `cmd.exe /c npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add package.json vite.config.ts tsconfig.json src-tauri/ docs/ tests/
git commit -m "chore: scaffold tauri v2 + react project and initial docs"
```

---

### Task 2: Serviço de Captura de Tela Nativo e Cópia para Clipboard em Rust

**Files:**
- Create: `src-tauri/src/capture.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/capture_test.rs`
- Create: `docs/guia-rust-e-backend.md`

**Interfaces:**
- Produces:
  - `pub fn capture_fullscreen() -> Result<Vec<u8>, String>`
  - `pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<Vec<u8>, String>`
  - `pub fn copy_to_clipboard(png_bytes: &[u8]) -> Result<(), String>`
  - Tauri command `tauri_capture_screen(mode: String, x: Option<i32>, y: Option<i32>, w: Option<u32>, h: Option<u32>) -> Result<String, String>` (retorna Base64 dataURL e copia para o clipboard).

- [ ] **Step 1: Write Rust unit test for crop calculation and buffer validation**
```rust
// src-tauri/tests/capture_test.rs
#[test]
fn test_crop_bounds_validation() {
    let result = ferramenta_captura_lib::capture::validate_bounds(10, 10, 100, 100, 1920, 1080);
    assert!(result.is_ok());
    let invalid = ferramenta_captura_lib::capture::validate_bounds(-5, -5, 0, 0, 1920, 1080);
    assert!(invalid.is_err());
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --test capture_test`
Expected: FAIL (module or function missing)

- [ ] **Step 3: Implement `capture.rs` with `xcap` and `arboard`**
Implement screen capture across displays, crop logic, automatic clipboard copy with `arboard`, and expose Tauri commands.
Write didactic explanation of every block in `docs/guia-rust-e-backend.md`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --test capture_test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/capture.rs src-tauri/src/lib.rs src-tauri/tests/ docs/guia-rust-e-backend.md
git commit -m "feat(rust): implement native screen capture and clipboard service"
```

---

### Task 3: Gerenciador de Instâncias (Máx 2) e Atalhos Globais

**Files:**
- Create: `src-tauri/src/instance.rs`
- Create: `src-tauri/src/shortcuts.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `docs/guia-rust-e-backend.md`
- Test: `src-tauri/tests/instance_test.rs`

**Interfaces:**
- Produces:
  - `pub fn init_instance_tracker() -> Result<InstanceGuard, String>`
  - `pub fn register_global_shortcuts(app: &tauri::AppHandle) -> Result<(), String>`

- [ ] **Step 1: Write unit test for instance count limit**
```rust
// src-tauri/tests/instance_test.rs
#[test]
fn test_instance_counter_limit() {
    let mut tracker = ferramenta_captura_lib::instance::InstanceCounter::new(2);
    assert_eq!(tracker.register_instance(1001), Ok(1));
    assert_eq!(tracker.register_instance(1002), Ok(2));
    assert!(tracker.register_instance(1003).is_err());
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --test instance_test`
Expected: FAIL

- [ ] **Step 3: Implement instance tracking via local socket and shortcuts**
Implement socket IPC to reject 3rd instance and focus existing window. Register default shortcut (`Ctrl+Shift+S` / `Cmd+Shift+S`).
Update `docs/guia-rust-e-backend.md` explaining IPC socket logic.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --test instance_test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/instance.rs src-tauri/src/shortcuts.rs src-tauri/src/main.rs docs/guia-rust-e-backend.md
git commit -m "feat(rust): implement dual-instance limiter and global shortcuts"
```

---

### Task 4: Overlay de Seleção de Captura (Região, Formato Livre e Tela Inteira)

**Files:**
- Create: `src/components/CaptureOverlay.tsx`
- Create: `src/utils/geometry.ts`
- Create: `src/types/capture.ts`
- Test: `tests/geometry.test.ts`

**Interfaces:**
- Consumes: `tauri_capture_screen`
- Produces:
  - `calculateNormalizedRect(start: Point, current: Point): RectBounds`
  - `simplifyFreeformPath(points: Point[]): Point[]`
  - React component `<CaptureOverlay mode={mode} onComplete={handleCaptureComplete} onCancel={handleCancel} />`

- [ ] **Step 1: Write failing tests for geometry calculations**
```typescript
// tests/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNormalizedRect } from '../src/utils/geometry';

describe('Geometry Utils', () => {
  it('normalizes drag rectangle when dragging bottom-right to top-left', () => {
    const rect = calculateNormalizedRect({ x: 200, y: 150 }, { x: 50, y: 30 });
    expect(rect).toEqual({ x: 50, y: 30, width: 150, height: 120 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd.exe /c npm test tests/geometry.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement geometry calculations and `CaptureOverlay.tsx`**
Implement coordinate normalization, lasso point simplification, and responsive drag-to-select overlay UI.

- [ ] **Step 4: Run test to verify it passes**
Run: `cmd.exe /c npm test tests/geometry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/CaptureOverlay.tsx src/utils/geometry.ts src/types/capture.ts tests/geometry.test.ts
git commit -m "feat: implement screen capture overlay with region and freeform selection"
```

---

### Task 5: Motor de Canvas e Ferramentas de Anotação (Konva.js)

**Files:**
- Create: `src/components/CanvasEditor.tsx`
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/tools/ShapeTool.tsx`
- Create: `src/components/tools/ArrowTool.tsx`
- Create: `src/components/tools/TextTool.tsx`
- Create: `src/components/tools/MagnifierTool.tsx`
- Create: `src/state/editorStore.ts`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - `editorStore`: State management for annotations list, active tool, stroke color, font size, zoom lens position, and undo/redo history.
  - `<CanvasEditor imageBase64={image} annotations={annotations} activeTool={tool} />`

- [ ] **Step 1: Write failing tests for editor store undo/redo and annotations**
```typescript
// tests/editorStore.test.ts
import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/state/editorStore';

describe('Editor Store', () => {
  it('adds an annotation and supports undo/redo', () => {
    const store = createEditorStore();
    store.addAnnotation({ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50, color: '#ff0000' });
    expect(store.getState().annotations.length).toBe(1);
    store.undo();
    expect(store.getState().annotations.length).toBe(0);
    store.redo();
    expect(store.getState().annotations.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd.exe /c npm test tests/editorStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Konva canvas, annotation tools, magnifier lens, and store**
Implement `<CanvasEditor />`, resizable shapes with `Transformer`, vector arrows with `Konva.Arrow`, double-click inline text editing, magnifier zoom lens circle, and undo/redo history stack.

- [ ] **Step 4: Run test to verify it passes**
Run: `cmd.exe /c npm test tests/editorStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/CanvasEditor.tsx src/components/Toolbar.tsx src/components/tools/ src/state/editorStore.ts tests/editorStore.test.ts
git commit -m "feat: implement konva annotation canvas with shapes, arrows, text and magnifier"
```

---

### Task 6: Galeria Lateral de Capturas (Limite Estrito de 10 Itens com FIFO)

**Files:**
- Create: `src/components/GallerySidebar.tsx`
- Create: `src/state/galleryStore.ts`
- Test: `tests/galleryStore.test.ts`

**Interfaces:**
- Produces:
  - `galleryStore`: Add capture, select active, remove capture, enforce max 10 with FIFO eviction.
  - `<GallerySidebar captures={items} activeId={id} onSelect={select} onClose={close} />`

- [ ] **Step 1: Write failing tests for gallery 10-item limit and FIFO eviction**
```typescript
// tests/galleryStore.test.ts
import { describe, it, expect } from 'vitest';
import { createGalleryStore } from '../src/state/galleryStore';

describe('Gallery Store', () => {
  it('maintains a maximum of 10 items and evicts oldest via FIFO', () => {
    const store = createGalleryStore();
    for (let i = 1; i <= 11; i++) {
      store.addCapture({ id: `cap-${i}`, title: `Captura ${i}`, dataUrl: 'data:...', createdAt: Date.now() });
    }
    const state = store.getState();
    expect(state.captures.length).toBe(10);
    expect(state.captures.find(c => c.id === 'cap-1')).toBeUndefined();
    expect(state.captures[9].id).toBe('cap-11');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd.exe /c npm test tests/galleryStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `galleryStore.ts` and `<GallerySidebar.tsx>`**
Implement thumbnail list, counter badge (`N / 10`), close buttons, and FIFO eviction order.

- [ ] **Step 4: Run test to verify it passes**
Run: `cmd.exe /c npm test tests/galleryStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/GallerySidebar.tsx src/state/galleryStore.ts tests/galleryStore.test.ts
git commit -m "feat: implement captures gallery sidebar with strict 10-item limit and FIFO eviction"
```

---

### Task 7: Serviço de Exportação (PNG, JPEG, JPG, PDF) e Cópia Sob Demanda

**Files:**
- Create: `src/services/exportService.ts`
- Modify: `src/components/Toolbar.tsx`
- Test: `tests/exportService.test.ts`

**Interfaces:**
- Produces:
  - `exportCanvasAsImage(stage: Konva.Stage, format: 'png' | 'jpeg'): Promise<Blob>`
  - `exportCanvasAsPdf(stage: Konva.Stage, filename: string): Promise<void>`
  - `copyCanvasToClipboard(stage: Konva.Stage): Promise<void>`

- [ ] **Step 1: Write failing tests for export format validation and PDF dimensions**
```typescript
// tests/exportService.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePdfPageDimensions } from '../src/services/exportService';

describe('Export Service', () => {
  it('computes matching PDF page dimensions from canvas aspect ratio', () => {
    const dims = calculatePdfPageDimensions(1920, 1080);
    expect(dims.orientation).toBe('landscape');
    expect(dims.width / dims.height).toBeCloseTo(1920 / 1080, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd.exe /c npm test tests/exportService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `exportService.ts` with `jspdf` and clipboard integration**
Implement image Blob generation, `jspdf` document builder, and clipboard copy action.

- [ ] **Step 4: Run test to verify it passes**
Run: `cmd.exe /c npm test tests/exportService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/services/exportService.ts src/components/Toolbar.tsx tests/exportService.test.ts
git commit -m "feat: implement export service for PNG, JPEG, JPG, PDF and clipboard"
```

---

### Task 8: Manual do Usuário e Finalização dos 3 Documentos Didáticos

**Files:**
- Create: `docs/manual-de-funcionamento-e-fluxo.md`
- Modify: `docs/arquitetura-e-tecnologias.md`
- Modify: `docs/guia-rust-e-backend.md`
- Create: `src/App.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Produces:
  - Aplicação completa integrada em `src/App.tsx`.
  - Guia funcional `docs/manual-de-funcionamento-e-fluxo.md` com instruções detalhadas de atalhos, ferramentas de edição, galeria e exportação.
  - Revisão completa dos 3 documentos didáticos para garantir clareza e comentários explicativos linha a linha.

- [ ] **Step 1: Write integration test verifying full application workflow**
```typescript
// tests/integration.test.ts
import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/state/editorStore';
import { createGalleryStore } from '../src/state/galleryStore';

describe('Full Integration Workflow', () => {
  it('connects gallery capture to editor store seamlessly', () => {
    const gallery = createGalleryStore();
    const editor = createEditorStore();
    gallery.addCapture({ id: 'cap-1', title: 'Tela 1', dataUrl: 'data:image/png;base64,mock', createdAt: Date.now() });
    expect(gallery.getState().activeId).toBe('cap-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd.exe /c npm test tests/integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Integrate components in `App.tsx` and write complete documentation guides**
Connect Toolbar, CanvasEditor, GallerySidebar, and Overlay in `src/App.tsx`.
Write `docs/manual-de-funcionamento-e-fluxo.md` and enrich `docs/arquitetura-e-tecnologias.md` and `docs/guia-rust-e-backend.md`.

- [ ] **Step 4: Run all tests and verify build**
Run: `cmd.exe /c npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**
```bash
git add src/App.tsx docs/ tests/integration.test.ts
git commit -m "docs: finalize user manual and 3 didactic guide documents"
```
