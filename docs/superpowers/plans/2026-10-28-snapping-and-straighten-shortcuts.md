# Snapping e Atalhos para Linhas Retas e Reset Horizontal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar atalhos intuitivos no padrão da indústria para travar linhas e retângulos horizontalmente: suporte à tecla Shift para travar linhas/setas retas na horizontal/vertical/45°, Shift para quadrados perfeitos 1:1, Shift para rotação em passos de 15°, e duplo-clique no ícone de rotação 360° para resetar instantaneamente a rotação para 0° (reto horizontal).

**Architecture:** 
1. Funções utilitárias puras em `src/utils/zoomAndCrop.ts`: `snapAngleToStep` para arredondar ângulos em passos de 15°, `snapLinePointsWithShift` para travar linhas e setas retas no eixo horizontal (`dy = 0`), vertical (`dx = 0`) ou diagonal de 45°, e `snapRectWithShift` para travar proporção 1:1 (quadrado).
2. Integração no `CanvasEditor.tsx`:
   - Detecção de `e.evt.shiftKey` durante a criação de retângulos e linhas/setas em `handleMouseMove`.
   - Detecção de `e.shiftKey` durante o ajuste de rotação 360° (snapping para passos de 15° facilitando atingir 0°, 90°, 180°, 270°).
   - Evento `onDblClick` no badge de rotação `<Group name="four-corner-rotater">` para resetar a rotação para 0°.
   - Detecção de `shiftKey` ao arrastar âncoras de 2 pontos de retas/setas.

**Tech Stack:** React, Konva / react-konva, TypeScript, Vitest.

**Spec:** Baseado na solicitação do usuário e no padrão universal da ferramenta de captura do Windows, Figma e Photoshop: tecla `Shift` para travar ângulos e proporções retas, e duplo-clique na alça de rotação para restaurar a horizontalidade (0°).

## Global Constraints
- Sem bibliotecas externas adicionais.
- Preservar todas as convenções existentes e os 111 testes passando.
- Operações de clamping e limites da imagem sempre respeitados.
- Undo/redo e histórico funcionais para resets e ajustes com Shift.

## Review Focus
- Travar na horizontal deve gerar `y2 === y1` exato sem oscilações de 1px.
- Duplo-clique no badge de rotação ⟳ deve resetar `rotation` para 0 e salvar no histórico.
- Soltar o Shift no meio do arraste deve alternar suavemente entre modo livre e travado.
- Tecla Shift ao girar deve permitir cravar 0° facilmente mesmo com movimentos rápidos.
- Duplo-clique não deve disparar arrasto indevido da rotação.

---

### Task 1: Utilitários Matemáticos de Snapping e Testes Unitários

**Files:**
- Modify: `src/utils/zoomAndCrop.ts`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - `snapAngleToStep(angleDeg: number, stepDeg?: number): number`
  - `snapLinePointsWithShift(startX: number, startY: number, currentX: number, currentY: number): { x: number; y: number }`
  - `snapRectWithShift(startX: number, startY: number, currentX: number, currentY: number): { width: number; height: number }`

- [ ] **Step 1: Escrever testes unitários que falham** em `tests/zoomAndCrop.test.ts`:
  - Testar `snapAngleToStep`: `358° -> 0°`, `2° -> 0°`, `14° -> 15°`, `88° -> 90°`.
  - Testar `snapLinePointsWithShift`:
    - Movimento predominantemente horizontal (`dx = 100, dy = 12`) -> `y === startY` (horizontal perfeita).
    - Movimento predominantemente vertical (`dx = 8, dy = 120`) -> `x === startX` (vertical perfeita).
    - Movimento diagonal próximo a 45° (`dx = 100, dy = 92`) -> `abs(dx) === abs(dy)`.
  - Testar `snapRectWithShift`:
    - Criar retângulo com `width = 120, height = 80` -> gera quadrado `width = 120, height = 120` mantendo o sinal da direção.

- [ ] **Step 2: Executar testes para verificar falha (RED)**:
  - Comando: `npm.cmd test tests/zoomAndCrop.test.ts`
  - Esperado: FAIL com `snapAngleToStep is not a function`.

- [ ] **Step 3: Implementar funções em `src/utils/zoomAndCrop.ts`**:
  - Implementar `snapAngleToStep`.
  - Implementar `snapLinePointsWithShift`.
  - Implementar `snapRectWithShift`.

- [ ] **Step 4: Executar testes para verificar aprovação (GREEN)**:
  - Comando: `npm.cmd test tests/zoomAndCrop.test.ts`
  - Esperado: PASS em todos os 37+ testes.

- [ ] **Step 5: Commit**:
  - `git add src/utils/zoomAndCrop.ts tests/zoomAndCrop.test.ts`
  - `git commit -m "feat(canvas): adicionar funcoes de snapping com shift para linhas, retangulos e angulos"`

---

### Task 2: Snapping com Shift ao Desenhar Linhas, Setas e Retângulos

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/zoomAndCrop.test.ts` e `tests/integration.test.ts`

**Interfaces:**
- Consumes: `snapLinePointsWithShift`, `snapRectWithShift` de `src/utils/zoomAndCrop.ts`.

- [ ] **Step 1: Integrar suporte a `e.evt.shiftKey` em `handleMouseMove` (criação de anotações)**:
  - Para `rect`: se `e.evt.shiftKey`, aplicar `snapRectWithShift(newAnnotation.x, newAnnotation.y, clampedDrawingX, clampedDrawingY)`.
  - Para `line` e `arrow` (estilo padrão ou fino): se `e.evt.shiftKey`, aplicar `snapLinePointsWithShift(startX, startY, clampedDrawingX, clampedDrawingY)`.
- [ ] **Step 2: Suporte a `shiftKey` ao arrastar âncoras de 2 pontos (linha/seta reta)**:
  - Ao arrastar a ponta ou cauda da linha/seta, se `e.evt.shiftKey` estiver pressionado, travar a posição final em linha reta horizontal, vertical ou 45° relativa à âncora fixa oposta.
- [ ] **Step 3: Verificar testes e compilação**:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd test`
- [ ] **Step 4: Commit**:
  - `git add src/components/CanvasEditor.tsx`
  - `git commit -m "feat(canvas): travar linhas retas e quadrados com tecla Shift durante desenho"`

---

### Task 3: Snapping com Shift na Rotação 360° e Duplo-Clique para Resetar a 0°

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Consumes: `snapAngleToStep` de `src/utils/zoomAndCrop.ts`.

- [ ] **Step 1: Adicionar suporte a `e.shiftKey` durante a rotação da forma**:
  - No listener de `window.addEventListener('mousemove', ...)` de rotação, verificar `e.shiftKey`.
  - Se `e.shiftKey` estiver ativo, aplicar `snapAngleToStep(newRot, 15)`.
  - Isso permite que o usuário gire e sinta "ímãs" a cada 15° (especialmente fácil travar em 0°, 90°, 180°, 270°).
- [ ] **Step 2: Adicionar duplo-clique para resetar rotação para 0°**:
  - No `<Group name="four-corner-rotater">`, adicionar `onDblClick={(e) => { e.cancelBubble = true; onUpdateAnnotation(selectedFourCornerAnnotation.id, { rotation: 0 }); setLiveRotation(null); }}`.
  - Ao dar duplo-clique no ícone de giro ⟳, o elemento fica imediatamente alinhado na horizontal (rotação 0°).
- [ ] **Step 3: Testar manualmente e verificar tipo TypeScript**:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd test`
- [ ] **Step 4: Commit**:
  - `git add src/components/CanvasEditor.tsx`
  - `git commit -m "feat(canvas): suporte a Shift para travar rotacao em 15 graus e duplo clique para resetar a 0 graus"`

---

### Task 4: Testes de Integração End-to-End e Verificação Completa

**Files:**
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Escrever testes de integração em `tests/integration.test.ts`**:
  - Verificar que linha desenhada com Shift trava com precisão horizontal (`y1 === y2`).
  - Verificar que retângulo desenhado com Shift trava em quadrado perfeito (`abs(width) === abs(height)`).
  - Verificar que rotação com Shift snapa para múltiplos de 15° e permite atingir 0° com precisão.
  - Verificar que resetar rotação para 0° com duplo-clique atualiza a anotação e mantém suporte a undo/redo.
- [ ] **Step 2: Executar toda a suíte de testes**:
  - `npm.cmd test`
- [ ] **Step 3: Executar build de produção**:
  - `npm.cmd run build`
- [ ] **Step 4: Commit**:
  - `git add tests/integration.test.ts`
  - `git commit -m "test(integration): adicionar testes para atalhos Shift e reset horizontal"`
