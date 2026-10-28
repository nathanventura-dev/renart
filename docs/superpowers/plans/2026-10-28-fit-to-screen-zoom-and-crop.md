# Plano de Implementação: Ajuste Automático à Tela, Zoom Multiplataforma (Teclado, Mouse e Trackpad) e Recorte Estilo Windows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o ajuste automático da imagem à tela (sem barras de rolagem iniciais ao colar/abrir imagens grandes), controles de Zoom In/Out na barra superior com atalhos de teclado (`Ctrl/Cmd +`, `-`, `0`), suporte a `Ctrl + Scroll Wheel` do mouse e pinch-to-zoom do trackpad, e a ferramenta de Recorte (Crop) com moldura redimensionável e botões Check/X com Undo/Redo.

**Architecture:**
- **Geometria e Lógica de Zoom / Recorte (`src/utils/zoomAndCrop.ts`):** Funções puras para cálculo de escala de ajuste à tela (`calculateFitToScreenScale`), passos discretos de zoom [25% a 400%] (`clampZoomLevel`, `getNextZoomStep`), e recorte de imagem base via Canvas com translação e filtro de anotações (`applyCropToImageAndAnnotations`).
- **Barra de Ferramentas (`src/components/Toolbar.tsx`):** Adiciona grupo de zoom `| [-] [ 100% ] [+]` ao lado de Desfazer/Refazer e novo botão `Crop` no grupo de ferramentas; no modo de corte, exibe contextualmente as ações Check e Cancelar (X).
- **Editor do Canvas (`src/components/CanvasEditor.tsx`):** Gerencia a escala visual do palco do Konva mantendo a precisão de coordenadas de desenho/clique; adiciona listener não passivo para `Ctrl + Scroll` e pinch do trackpad com `e.preventDefault()`; renderiza a moldura de corte com 8 alças e máscara escurecida no modo de recorte.
- **Histórico e Estado (`src/state/editorStore.ts`):** Suporte a atualizar a imagem de fundo e anotações com histórico Undo/Redo (`Ctrl+Z`).

**Tech Stack:** React 19, TypeScript, Konva.js (`react-konva`), Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-fit-to-screen-zoom-and-crop-design.md`

## Global Constraints

- Imagens maiores que a janela devem abrir 100% visíveis sem barras de rolagem iniciais.
- Imagens menores que a janela devem abrir centralizadas em seu tamanho nativo 100%.
- Atalhos compatíveis com Windows, Linux (`Ctrl`) e macOS (`Cmd`).
- `Ctrl + Scroll Wheel` do mouse e pinch-to-zoom do trackpad devem interceptar o zoom do navegador e aplicar o zoom no canvas da imagem.
- O recorte deve permitir desfazer com `Ctrl+Z` restaurando a imagem e as anotações originais.
- Commits e documentação sempre em português.

## Review Focus

1. Imagem colada muito grande (ex: 4K / 3840x2160) em tela de 13"/14": deve abrir perfeitamente ajustada à janela com zoom calculado (ex: 35%) sem scrollbars.
2. Zoom In além da tela: scrollbars devem surgir suavemente para permitir alcançar os cantos.
3. Pinch do trackpad e `Ctrl + roda do mouse`: não deve fazer zoom na página inteira (navbar/interface), apenas na imagem.
4. Recorte de imagem com anotações: anotações dentro da área de corte são transladadas corretamente para a nova posição; anotações fora do corte são removidas; `Ctrl+Z` restaura tudo perfeitamente.
5. Cancelar recorte (X ou ESC): descarta a moldura e mantém o canvas inalterado.

---

### Task 1: Funções Puras de Geometria de Zoom, Ajuste de Tela e Recorte

**Files:**
- Create: `src/utils/zoomAndCrop.ts`
- Create: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - `calculateFitToScreenScale(imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number, padding?: number): number`
  - `clampZoomLevel(zoom: number, minZoom?: number, maxZoom?: number): number`
  - `getNextZoomStep(currentZoom: number, direction: 'in' | 'out'): number`
  - `calculateCropBounds(cropBox: { x: number; y: number; width: number; height: number }, imageWidth: number, imageHeight: number): { x: number; y: number; width: number; height: number }`
  - `adjustAnnotationsForCrop(annotations: Annotation[], cropOffset: { x: number; y: number }, cropSize: { width: number; height: number }): Annotation[]`

- [ ] **Step 1: Escrever testes unitários em `tests/zoomAndCrop.test.ts` (RED)**
- [ ] **Step 2: Executar testes para confirmar falha (`cmd.exe /c npm test tests/zoomAndCrop.test.ts`)**
- [ ] **Step 3: Implementar funções em `src/utils/zoomAndCrop.ts` (GREEN)**
- [ ] **Step 4: Executar testes para validar aprovação (`cmd.exe /c npm test tests/zoomAndCrop.test.ts`)**
- [ ] **Step 5: Gravar alterações e realizar commit em português**

---

### Task 2: Controles de Zoom na Toolbar com Teclado, Mouse Wheel e Trackpad

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `src/App.tsx`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - Propriedades de zoom na `Toolbar`: `zoomLevel: number`, `onZoomIn: () => void`, `onZoomOut: () => void`, `onResetZoom: () => void`.
  - Tratamento global de teclado para `Ctrl/Cmd +`, `Ctrl/Cmd -`, `Ctrl/Cmd 0`.
  - Tratamento de `WheelEvent` com `e.ctrlKey || e.metaKey` no container do canvas com `{ passive: false }` e `e.preventDefault()`.

- [ ] **Step 1: Adicionar testes de cálculo de passos de zoom e atalhos em `tests/zoomAndCrop.test.ts`**
- [ ] **Step 2: Adicionar botões de Zoom `| [-] [ 100% ] [+]` na `Toolbar.tsx`**
- [ ] **Step 3: Implementar listeners de teclado e `Ctrl + wheel` / trackpad pinch em `CanvasEditor.tsx` e `App.tsx`**
- [ ] **Step 4: Executar testes de regressão e validação (`npm test`)**
- [ ] **Step 5: Gravar alterações e realizar commit em português**

---

### Task 3: Ajuste Automático à Tela (Fit to Screen) sem Scrollbar Inicial

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `src/App.tsx`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - Cálculo automático de `fitScale` ao abrir ou colar qualquer imagem.
  - Se imagem for maior que a janela: inicializa com `zoomLevel = fitScale` (sem barras de rolagem).
  - Se imagem for menor: inicializa com `zoomLevel = 1.0` (centralizada).
  - Scroll suave habilitado somente quando `zoomLevel > fitScale`.

- [ ] **Step 1: Implementar medição do container e cálculo de escala inicial no `CanvasEditor.tsx`**
- [ ] **Step 2: Sincronizar o estado de zoom com a `Toolbar.tsx`**
- [ ] **Step 3: Validar que imagens 4K abrem 100% visíveis sem scrollbar e imagens pequenas permanecem nativas**
- [ ] **Step 4: Executar suíte de testes (`npm test`)**
- [ ] **Step 5: Gravar alterações e realizar commit em português**

---

### Task 4: Ferramenta de Recorte (Crop Mode) Estilo Windows com Check e X

**Files:**
- Modify: `src/state/editorStore.ts`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `src/App.tsx`
- Test: `tests/zoomAndCrop.test.ts`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - Ferramenta `crop` e estado `isCropping: boolean` no editor.
  - Moldura de recorte com alças de canto/laterais e máscara externa escurecida.
  - Botões de confirmação `[✓ Check]` e cancelamento `[✕ Cancelar]` (e tecla `ESC`).
  - Função de recorte de imagem via Canvas HTML5 gerando nova base64 e transladando anotações com suporte a Undo/Redo.

- [ ] **Step 1: Escrever testes unitários para a ação de recorte com Undo/Redo em `tests/zoomAndCrop.test.ts` e `tests/editorStore.test.ts`**
- [ ] **Step 2: Implementar ferramenta de corte e ações na `Toolbar.tsx`**
- [ ] **Step 3: Implementar moldura de recorte visual interativa no `CanvasEditor.tsx`**
- [ ] **Step 4: Implementar `confirmCrop` e `cancelCrop` com persistência na galeria e Undo/Redo**
- [ ] **Step 5: Executar testes e validação completa (`npm test` e `npm run build`)**
- [ ] **Step 6: Atualizar documentação e realizar commit em português**
