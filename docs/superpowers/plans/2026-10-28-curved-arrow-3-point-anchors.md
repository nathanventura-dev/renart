# Flecha Curva com 3 Pontos de Ajuste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 3 âncoras interativas de ajuste manual (cauda para origem/tamanho, meio para intensidade/lado da curva, e ponta para mira precisa) para a flecha curva selecionada, suprimindo a caixa retangular rígida do Transformer e integrando a manipulação com as barreiras da imagem e Undo/Redo.

**Architecture:** 
- `src/utils/zoomAndCrop.ts` fornece as funções puras de validação e cálculo vetorial das âncoras: `shouldAttachTransformer(toolType, arrowStyle)` para desativar a caixa retangular na flecha curva, e `updateCurvedArrowAnchor(points, anchorIndex, newX, newY, canvasWidth, canvasHeight)` para atualizar e conter as coordenadas de cada âncora dentro dos limites da imagem.
- `src/components/CanvasEditor.tsx` renderiza o componente de âncoras visuais interativas (3 círculos com preenchimento branco, borda azul macOS `#0071e3`, cursores `crosshair` e `grab`) sobre a flecha curva selecionada, sincronizando o traçado em tempo real durante o arrasto (`livePoints`) e salvando em `editorStore` ao soltar com suporte integral a Undo/Redo.

**Tech Stack:** React 19, TypeScript, Konva / react-konva, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-curved-arrow-3-point-anchors-design.md`

## Global Constraints

- O Transformer retangular existente DEVE permanecer inalterado para todas as outras formas (`rect`, `ellipse`, `image`, `text`) e para as flechas retas (`standard`, `thin`, `dashed`).
- Cada uma das 3 âncoras da flecha curva deve ser restrita aos limites totais da imagem de fundo (`0 <= x <= imgW`, `0 <= y <= imgH`).
- O corpo da flecha curva deve continuar permitindo arrastar o elemento inteiro pelo canvas mantendo a curvatura relativa.
- Todas as mensagens de commit e comunicação em português do Brasil.

## Review Focus

1. **Flecha curva com coordenadas locais relativas:** Se a flecha tiver deslocamento `x, y`, as posições absolutas das âncoras no canvas devem levar em conta `(ann.x + points[i], ann.y + points[i+1])` sem desvio de coordenadas.
2. **Arrasto da âncora sob diferentes níveis de Zoom:** A conversão de ponteiro e o `dragBoundFunc` das âncoras devem funcionar perfeitamente com zoom menor ou maior que 100%.
3. **Persistência de Undo/Redo:** Modificar cauda, curvatura ou ponta via âncora deve gerar snapshot no histórico de desfeitas, permitindo reverter com Ctrl+Z.
4. **Comprimento mínimo de flecha:** Se o usuário arrastar a cauda para muito perto da ponta, a flecha não deve quebrar nem colapsar com NaN.
5. **Multiseleção:** Se várias anotações forem selecionadas juntas (incluindo uma flecha curva), o comportamento de seleção em grupo não deve quebrar.

---

### Task 1: Anchor Geometry and Transformer Suppression Logic

**Files:**
- Modify: `src/utils/zoomAndCrop.ts`
- Modify: `src/utils/magnifierAndHover.ts`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - `export function shouldAttachTransformer(annotationType: ToolType, arrowStyle?: ArrowStyle): boolean;`
  - `export type CurvedArrowAnchorType = 'tail' | 'bend' | 'tip';`
  - `export function updateCurvedArrowAnchor(points: number[], anchorIndex: 0 | 1 | 2, newX: number, newY: number, canvasWidth: number, canvasHeight: number): number[];`
  - `export function getCurvedArrowAnchorPositions(points: number[]): { tail: { x: number; y: number }; bend: { x: number; y: number }; tip: { x: number; y: number } };`

- [ ] **Step 1: Write failing test in `tests/zoomAndCrop.test.ts`**

Adicionar testes cobrindo:
- `shouldAttachTransformer`: retorna `false` para `'arrow'` com `arrowStyle === 'curved'`, e `true` para `'arrow'` com `arrowStyle === 'standard'`, `'thin'`, `'dashed'`, e para `'rect'`, `'text'`, etc.
- `updateCurvedArrowAnchor`:
  - Atualizar âncora 0 (cauda) modifica apenas `points[0], points[1]`, mantendo bend e tip intactos, respeitando os limites da imagem.
  - Atualizar âncora 1 (arco/meio) modifica apenas `points[2], points[3]`, respeitando limites.
  - Atualizar âncora 2 (ponta) modifica apenas `points[4], points[5]`, respeitando limites.
- `getCurvedArrowAnchorPositions`: extrai os 3 pontos para manipulação.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/zoomAndCrop.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement helper functions in `src/utils/zoomAndCrop.ts` and `src/utils/magnifierAndHover.ts`**

Implementar as funções com contenção estrita de coordenadas e assinaturas tipadas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/zoomAndCrop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/zoomAndCrop.ts src/utils/magnifierAndHover.ts tests/zoomAndCrop.test.ts
git commit -m "feat(geometry): adicionar utilitarios de controle das 3 ancoras da flecha curva"
```

---

### Task 2: Interactive Anchors on Canvas & Transformer Suppression

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Consumes:
  - `shouldAttachTransformer`, `updateCurvedArrowAnchor`, `getCurvedArrowAnchorPositions` from `src/utils/zoomAndCrop.ts`
- Produces:
  - Supressão do Transformer quando uma flecha curva única estiver selecionada.
  - Renderização das 3 âncoras circulares interativas sobre a flecha curva.
  - Suporte ao arrasto individual em tempo real com clamp e persistência em `onUpdateAnnotation` ao soltar com Undo/Redo.

- [ ] **Step 1: Write integration test for curved arrow anchor update and undo/redo in `tests/integration.test.ts`**

Testar que:
- Atualizar a cauda, arco ou ponta de uma flecha curva persiste a nova coordenada na anotação.
- O histórico de Undo reverte para os pontos anteriores e o Redo reaplica os novos pontos.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/integration.test.ts`

- [ ] **Step 3: Implement anchors rendering and dragging in `src/components/CanvasEditor.tsx`**

- No `useEffect` do Transformer:
  Utilizar `shouldAttachTransformer(ann.type, ann.arrowStyle)` para não incluir a flecha curva no Transformer.
- Renderizar as 3 âncoras circulares (`tail`, `bend`, `tip`) quando `ann.type === 'arrow' && ann.arrowStyle === 'curved'` estiver selecionada e `!isLocked`.
  - Estilo: `radius={6}`, `fill="#ffffff"`, `stroke="#0071e3"`, `strokeWidth={2}`, `shadowBlur={3}`, `hitStrokeWidth={16}`.
  - Cursores: `crosshair` para ponta e cauda; `grab` para a curva.
  - `dragBoundFunc`: restringe dentro da imagem.
  - `onDragMove`: atualiza as coordenadas locais da curva na tela em tempo real.
  - `onDragEnd`: grava os novos pontos via `onUpdateAnnotation(ann.id, { points: nextPoints })`.

- [ ] **Step 4: Run all tests and verify TypeScript**

Run: `npm.cmd test && npx.cmd tsc --noEmit`
Expected: All tests pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasEditor.tsx tests/integration.test.ts
git commit -m "feat(canvas): implementar 3 ancoras de ajuste manual para flecha curva"
```

---

### Task 3: Final Verification & Integration

- [ ] **Step 1: Execute complete test suite**
Run: `npm.cmd test`
Expected: 100% tests passing.

- [ ] **Step 2: Execute production build**
Run: `npm.cmd run build`
Expected: `tsc && vite build` completes with exit code 0.

- [ ] **Step 3: Commit and summarize for user**
