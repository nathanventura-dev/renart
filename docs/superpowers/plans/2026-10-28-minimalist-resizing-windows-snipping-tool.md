# Redimensionamento Minimalista Estilo Windows Snipping Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o modelo de redimensionamento e controles baseado na Ferramenta de Captura do Windows: 4 cantos livres sem distorção de borda e alça de rotação para formas 2D (retângulo e elipse), 2 âncoras pontuais para linhas e setas retas (suprimindo Transformer), escala fixa de pixels `2..10px` e remoção definitiva do modo "Auto".

**Architecture:** 
- `src/state/editorStore.ts` e `src/components/Toolbar.tsx`: define `STROKE_WIDTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10]`, remove `autoStrokeWidth` do estado e da barra de ferramentas, e sincroniza a alteração de espessura imediatamente com elementos selecionados via Undo/Redo.
- `src/utils/zoomAndCrop.ts`: atualiza `shouldAttachTransformer` para retornar `false` para todas as linhas e setas; implementa os utilitários de 2 pontos `updateTwoPointAnchor` e `getTwoPointAnchorPositions` com contenção aos limites da imagem.
- `src/components/CanvasEditor.tsx`:
  - Para `line` e `arrow` reta: renderiza 2 âncoras pontuais circulares (Origem e Ponta) com arraste a 60fps e Undo/Redo.
  - Para `rect` e `ellipse`: configura o Transformer com apenas 4 cantos (`top-left`, `top-right`, `bottom-left`, `bottom-right`), `strokeScaleEnabled={false}`, redimensionamento livre de proporção, e alça de rotação estilizada no topo no padrão escuro com ícone circular (`⟳`).

**Tech Stack:** React 19, TypeScript, Konva / react-konva, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-minimalist-resizing-windows-snipping-tool.md`

## Global Constraints

- A espessura do traço (`strokeWidth`) NUNCA deve ser distorcida ao redimensionar retângulos, círculos ou elipses (`strokeScaleEnabled={false}`).
- Nenhuma linha ou seta (reta ou curva) deve exibir caixa retangular Transformer; todas utilizam âncoras pontuais dedicadas (2 para linhas/setas retas, 3 para setas curvas).
- As formas 2D exibem exclusivamente 4 alças nos cantos (sem alças no meio das bordas).
- O seletor de espessura oferece os valores `[2, 3, 4, 5, 6, 7, 8, 9, 10]` para Retângulo, Círculo/Elipse, Linha e Setas.
- Todas as mensagens de commit e comunicação em português do Brasil.

## Review Focus

1. **Ausência de distorção de traço:** Ao redimensionar um retângulo ou elipse pequeno para grande, o `strokeWidth` visual e numérico deve se manter idêntico ao configurado.
2. **Redimensionamento livre nos 4 cantos:** Arrastar qualquer canto deve permitir alterar livremente largura e altura de forma independente.
3. **Estabilidade de linhas e setas retas:** O controle por 2 pontos deve permitir girar e esticar a linha com precisão cirúrgica sem gerar caixa 2D nem valores `NaN`.
4. **Contenção estrita de imagem:** Nenhuma âncora ou forma redimensionada deve ultrapassar os limites `0..canvasWidth` e `0..canvasHeight`.
5. **Undo/Redo consistente:** Cada redimensionamento ou alteração de espessura deve registrar snapshot limpo no histórico de desfeitas.

---

### Task 1: Pixel Stroke Width Scale and Removal of "Auto"

**Files:**
- Modify: `src/state/editorStore.ts`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - `export const STROKE_WIDTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;`
  - Removal of `autoStrokeWidth` from `EditorState`, `createEditorStore()`, `ToolbarProps`, `CanvasEditorProps`.
  - Default `strokeWidth: 4`.

- [ ] **Step 1: Write unit tests in `tests/editorStore.test.ts`**

Adicionar testes cobrindo:
- `STROKE_WIDTHS` exportado com valores `[2, 3, 4, 5, 6, 7, 8, 9, 10]`.
- `setStrokeWidth` atualiza a espessura no estado e, caso haja anotações selecionadas (`rect`, `ellipse`, `line`, `arrow`), atualiza o `strokeWidth` delas criando snapshot no histórico de Undo.
- Ausência de `autoStrokeWidth` no estado inicial.

- [ ] **Step 2: Run test to verify failure**

Run: `npm.cmd test tests/editorStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `src/state/editorStore.ts`, `src/components/Toolbar.tsx` and `src/App.tsx`**

- Em `editorStore.ts`:
  - Exportar `STROKE_WIDTHS`.
  - Remover `autoStrokeWidth` da interface `BaseAnnotation`, `EditorState` e do estado inicial.
  - No `setStrokeWidth`: atualizar anotações selecionadas (`type === 'rect' | 'ellipse' | 'line' | 'arrow'`) preservando Undo.
- Em `Toolbar.tsx`:
  - Remover botão "Auto".
  - Renderizar opções de `STROKE_WIDTHS.map(w => <option value={w}>{w}px</option>)`.
  - Remover props `autoStrokeWidth` e `onToggleAutoStrokeWidth`.
- Em `App.tsx`:
  - Remover passagem das props `autoStrokeWidth` e `onToggleAutoStrokeWidth`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm.cmd test tests/editorStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/editorStore.ts src/components/Toolbar.tsx src/App.tsx tests/editorStore.test.ts
git commit -m "feat(toolbar): unificar escala de espessura de 2 a 10px e remover modo auto"
```

---

### Task 2: Pure Geometry Helpers & Transformer Suppression for Lines and Arrows

**Files:**
- Modify: `src/utils/zoomAndCrop.ts`
- Modify: `src/utils/magnifierAndHover.ts`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - `export function shouldAttachTransformer(annotationType: ToolType, arrowStyle?: ArrowStyle): boolean;` (retorna `false` para `line` e `arrow`)
  - `export function updateTwoPointAnchor(points: number[], anchorIndex: 0 | 1, newX: number, newY: number, canvasWidth: number, canvasHeight: number): number[];`
  - `export function getTwoPointAnchorPositions(points: number[]): { start: { x: number; y: number }; end: { x: number; y: number } };`

- [ ] **Step 1: Write failing tests in `tests/zoomAndCrop.test.ts`**

Adicionar testes cobrindo:
- `shouldAttachTransformer`: retorna `false` para `'line'` e para `'arrow'` (qualquer `arrowStyle`), e `true` para `'rect'`, `'ellipse'`, `'image'`, `'text'`.
- `updateTwoPointAnchor`:
  - Atualizar âncora 0 (origem) altera `points[0], points[1]` com clamp em `[0..canvasWidth, 0..canvasHeight]`, mantendo `points[2], points[3]`.
  - Atualizar âncora 1 (ponta) altera `points[2], points[3]` com clamp, mantendo `points[0], points[1]`.
- `getTwoPointAnchorPositions`: extrai `{ start: { x, y }, end: { x, y } }`.

- [ ] **Step 2: Run test to verify failure**

Run: `npm.cmd test tests/zoomAndCrop.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement functions in `src/utils/zoomAndCrop.ts` and `src/utils/magnifierAndHover.ts`**

- `shouldAttachTransformer`:
  ```ts
  if (annotationType === 'select') return false;
  if (annotationType === 'line' || annotationType === 'arrow') return false;
  return true;
  ```
- `updateTwoPointAnchor` e `getTwoPointAnchorPositions` com contenção estrita `Math.max(0, Math.min(val, limit))`.

- [ ] **Step 4: Run test to verify pass**

Run: `npm.cmd test tests/zoomAndCrop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/zoomAndCrop.ts src/utils/magnifierAndHover.ts tests/zoomAndCrop.test.ts
git commit -m "feat(geometry): adicionar utilitarios de 2 pontos e suprimir transformer para linhas e setas"
```

---

### Task 3: 2-Point Interactive Anchors for Line & Straight Arrow on Canvas

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Consumes:
  - `updateTwoPointAnchor`, `getTwoPointAnchorPositions`, `shouldAttachTransformer` from `src/utils/zoomAndCrop.ts`
- Produces:
  - Renderização de 2 âncoras circulares interativas (Origem/Cauda e Destino/Ponta) quando uma única linha (`line`) ou seta reta (`standard`, `thin`, `dashed`) estiver selecionada.
  - Suporte a arraste a 60fps em tempo real e commit em `onUpdateAnnotation` com Undo/Redo.
  - Arraste do corpo da linha e da seta reta pelo canvas mantendo ângulo e tamanho.

- [ ] **Step 1: Write integration tests in `tests/integration.test.ts`**

Adicionar testes cobrindo:
- Atualização da âncora de cauda e de ponta de uma linha reta e de uma seta reta com persistência em `editorStore`.
- Histórico de Undo desfaz os ajustes e Redo reaplica.

- [ ] **Step 2: Run test to verify failure**

Run: `npm.cmd test tests/integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement 2-point anchors in `src/components/CanvasEditor.tsx`**

- No `CanvasEditor.tsx`:
  - Detectar `selectedTwoPointAnnotation` quando `effectiveSelectedIds.length === 1 && !isLocked && !isCropping && !isDrawing`:
    - `ann.type === 'line' || (ann.type === 'arrow' && ann.arrowStyle !== 'curved')`.
  - Renderizar 2 círculos Konva (`name="two-point-anchor-start"`, `name="two-point-anchor-end"`):
    - `radius={6}`, `fill="#ffffff"`, `stroke="#0071e3"`, `strokeWidth={2}`, `shadowBlur={3}`, `hitStrokeWidth={16}`, cursor `crosshair`.
    - `dragBoundFunc` contido aos limites da imagem.
    - `onDragMove`: atualiza `liveTwoPointPoints`.
    - `onDragEnd`: persiste via `onUpdateAnnotation(id, { x: 0, y: 0, points: finalPoints })`.
  - No `<Line ...>` e `<Arrow ...>` da tela:
    - Renderizar com `displayPoints` (usando `liveTwoPointPoints` durante o arraste da âncora).
    - Desativar o arraste do corpo enquanto uma âncora estiver sendo arrastada.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm.cmd test tests/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasEditor.tsx tests/integration.test.ts
git commit -m "feat(canvas): implementar 2 ancoras de ajuste para linhas e setas retas"
```

---

### Task 4: Minimalist 4-Corner Resizing & Rotation Badge for 2D Shapes

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `tests/integration.test.ts`

**Interfaces:**
- Produces:
  - 4 alças de canto no `<Transformer>` para retângulos e elipses (`top-left`, `top-right`, `bottom-left`, `bottom-right`).
  - Redimensionamento livre com proporção independente e `strokeScaleEnabled={false}` (borda não engrossa nem afina).
  - Alça de rotação customizada no topo com badge escuro (`#262626`) e ícone circular (`⟳`).
  - `handleTransformEnd` atualiza `width/height` (ou `radiusX/radiusY`) com `strokeWidth` intacto.

- [ ] **Step 1: Write integration tests in `tests/integration.test.ts`**

Adicionar teste cobrindo:
- Redimensionamento de retângulo: altera largura e altura sem modificar a propriedade `strokeWidth`.
- Redimensionamento de elipse: altera raios sem modificar a propriedade `strokeWidth`.

- [ ] **Step 2: Run test to verify failure**

Run: `npm.cmd test tests/integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement 4-corner resizing and rotation badge in `src/components/CanvasEditor.tsx`**

- No `<Transformer ...>`:
  - `enabledAnchors`: `['top-left', 'top-right', 'bottom-left', 'bottom-right']` (exceto crop).
  - `keepRatio={false}` para permitir redimensionamento livre de cantos.
  - `anchorSize={10}`, `anchorCornerRadius={5}`, `anchorFill="#ffffff"`, `anchorStroke="#71717a"`, `anchorStrokeWidth={1.5}`.
  - `rotateAnchorOffset={28}` com cursor `grab`/`grabbing`.
  - Badge de rotação escuro com ícone de giro circular (`⟳`) renderizado acima do elemento selecionado (retângulo ou elipse) quando ativo.
- No `handleTransformEnd`:
  - Para `rect`: `nextW = Math.max(10, Math.round(ann.width * sx))`, `nextH = Math.max(10, Math.round(ann.height * sy))`, `strokeWidth` inalterado.
  - Para `ellipse`: `nextRx = Math.max(5, Math.round(ann.radiusX * sx))`, `nextRy = Math.max(5, Math.round(ann.radiusY * sy))`, `strokeWidth` inalterado.
  - Nos nós Konva: `strokeScaleEnabled={false}` para `Rect` e `Ellipse`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm.cmd test tests/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasEditor.tsx tests/integration.test.ts
git commit -m "feat(canvas): implementar redimensionamento de 4 cantos livres e alca de rotacao estilo snipping tool"
```

---

### Task 5: Final Verification & Integration

- [ ] **Step 1: Execute complete test suite**
Run: `npm.cmd test`
Expected: 100% test files and test cases passing (95+ tests).

- [ ] **Step 2: Execute TypeScript compilation check**
Run: `npx.cmd tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Execute production build**
Run: `npm.cmd run build`
Expected: `tsc && vite build` completes with exit code 0.

- [ ] **Step 4: Commit and summarize for user**
Comunicação completa e concisa em português.
