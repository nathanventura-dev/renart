# Flechas com Variantes e Redimensionamento em Degraus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 4 variantes de flechas (Padrão, Fina, Pontilhada e Curva), redimensionamento proporcional em degraus discretos de 2px a 8px (iniciando em 4px por padrão) sem distorção das pontas e corpos, e seletor segmentado na barra superior seguindo o molde dos controles de Lupa e Recorte.

**Architecture:** 
- `editorStore.ts` gerencia o estado `arrowStyle` ('standard' | 'thin' | 'dashed' | 'curved') e `arrowCurveDirection` ('left' | 'right'), propagando para novas flechas e flechas selecionadas com suporte completo a Undo/Redo.
- `zoomAndCrop.ts` e `magnifierAndHover.ts` fornecem funções puras de geometria para cálculo de curvatura (`calculateCurvedArrowPoints`, `invertCurvedArrowPoints`), proporções de ponta (`getArrowHeadDimensions`), degraus de espessura (`ARROW_STROKE_STEPS = [2, 3, 4, 6, 8]`, `calculateResizedArrowStroke`) e contenção do Transformer (`clampArrowResizeBox`).
- `Toolbar.tsx` exibe o controle segmentado estilo pill quando a ferramenta de flecha está ativa ou uma flecha está selecionada, com o botão "Inverter arco" para flechas curvas.
- `CanvasEditor.tsx` renderiza as variantes no canvas principal e na lente de aumento com Konva `<Arrow>` (`dash`, `tension`, `pointerLength`, `pointerWidth`), além de sincronizar a escala em degraus no Transformer e garantir o respeito às barreiras da imagem.

**Tech Stack:** React 19, TypeScript, Konva / react-konva, Lucide Icons, Vitest.

**Spec:** Abordagem 1 aprovada pelo usuário na conversa anterior (Pill segmentado com 4 modos na Toolbar + arco suave automático com inversão + redimensionamento em passos 2px-8px).

## Global Constraints

- Espessura inicial padrão da flecha: 4px (`ARROW_DEFAULT_STROKE = 4`), exceto na fina que inicia em 2px.
- Degraus de redimensionamento estritamente no intervalo de 2px a 8px: `ARROW_STROKE_STEPS = [2, 3, 4, 6, 8]`.
- As dimensões da ponta (`pointerLength` e `pointerWidth`) devem sempre acompanhar a espessura para evitar pontas deformadas ou desproporcionais.
- Manter a flecha atual (`standard`) como o tipo padrão selecionado.
- Padrão visual dos controles na barra superior idêntico aos pills existentes (Lupa `Sem foco / Com foco` e Crop).
- Respeito integral aos limites e barreiras da imagem ao desenhar, arrastar e transformar flechas normais e curvas.
- Todas as mensagens de commit e comunicação em português do Brasil.

## Review Focus

1. **Flechas curvas com comprimento mínimo ou zero:** Ao clicar sem arrastar, o cálculo do arco não deve gerar `NaN` ou `Infinity`. Deve retornar pontos válidos com fallback.
2. **Inversão de curvatura em flechas já desenhadas:** Ao alternar a direção da curva, os pontos do arco devem ser espelhados em relação à corda sem alterar os pontos inicial e final.
3. **Redimensionamento por Transformer em extremos:** Ao tentar diminuir além de 2px ou aumentar além de 8px, o Transformer deve travar firmemente nos limites 2px e 8px sem distorcer o elemento.
4. **Respeito às barreiras da imagem:** O arco da flecha curva (`midX, midY`) e suas pontas devem ser contidos dentro da área útil da imagem durante drag e transform.
5. **Histórico e persistência:** Trocas de estilo de flecha e inversão de arco em flechas selecionadas devem registrar snapshots no histórico de Undo/Redo.

---

### Task 1: Arrow Models and State Management

**Files:**
- Modify: `src/state/editorStore.ts`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - `export type ArrowStyle = 'standard' | 'thin' | 'dashed' | 'curved';`
  - `export type ArrowCurveDirection = 'left' | 'right';`
  - `ArrowAnnotation` extended with `arrowStyle?: ArrowStyle; curveDirection?: ArrowCurveDirection;`
  - `EditorState` extended with `arrowStyle: ArrowStyle; arrowCurveDirection: ArrowCurveDirection;`
  - `setArrowStyle(style: ArrowStyle): void`
  - `toggleArrowCurveDirection(id?: string): void`
  - `shouldShowArrowControls(activeTool: ToolType, selectedAnnotations: Annotation[]): boolean`

- [ ] **Step 1: Write the failing test for arrow state and actions in `tests/editorStore.test.ts`**

Adicionar testes verificando:
- `editorStore` inicia com `arrowStyle === 'standard'` e `arrowCurveDirection === 'right'`.
- `setArrowStyle('curved')` atualiza o estado global e, caso haja uma flecha selecionada, atualiza seu `arrowStyle` registrando snapshot no undo.
- `toggleArrowCurveDirection()` alterna a direção da curva entre `'left'` e `'right'` na flecha selecionada registrando snapshot no undo.
- `shouldShowArrowControls` retorna `true` quando `activeTool === 'arrow'` ou quando há anotação do tipo `'arrow'` selecionada.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/editorStore.test.ts`
Expected: FAIL indicando que tipos/funções não existem.

- [ ] **Step 3: Implement `ArrowStyle`, `ArrowCurveDirection`, `setArrowStyle`, `toggleArrowCurveDirection` and `shouldShowArrowControls` in `src/state/editorStore.ts`**

Implementar os tipos, propriedades no `EditorState`, inicialização com `'standard'` e `'right'`, e as funções de manipulação com suporte a undo/redo para anotações selecionadas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/editorStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/editorStore.ts tests/editorStore.test.ts
git commit -m "feat(store): adicionar modelos de estilos de flecha e ações de estado"
```

---

### Task 2: Arrow Math, Head Dimensions and Stepped Resizing Utilities

**Files:**
- Modify: `src/utils/zoomAndCrop.ts`
- Modify: `src/utils/magnifierAndHover.ts`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  - `export const ARROW_STROKE_STEPS = [2, 3, 4, 6, 8] as const;`
  - `export const ARROW_DEFAULT_STROKE = 4;`
  - `export function snapToArrowStrokeStep(rawStroke: number): number;`
  - `export function calculateResizedArrowStroke(baseStroke: number, scaleFactor: number): number;`
  - `export function getArrowHeadDimensions(strokeWidth: number, arrowStyle?: ArrowStyle): { pointerLength: number; pointerWidth: number };`
  - `export function calculateCurvedArrowPoints(x1: number, y1: number, x2: number, y2: number, direction?: 'left' | 'right', curvatureFactor?: number): number[];`
  - `export function invertCurvedArrowPoints(points: number[]): number[];`
  - `export function clampArrowResizeBox(oldBox: TransformerBoundBox, newBox: TransformerBoundBox, baseStrokeWidth: number, baseWidth: number, baseHeight: number): TransformerBoundBox;`

- [ ] **Step 1: Write the failing tests in `tests/zoomAndCrop.test.ts`**

Adicionar testes cobrindo:
- `snapToArrowStrokeStep` com valores abaixo de 2, acima de 8 e intermediários.
- `calculateResizedArrowStroke` aplicando fatores de escala em 4px, 2px e 8px.
- `getArrowHeadDimensions` para estilo `thin` (proporção mais sutil) vs `standard`/`dashed`/`curved` (proporção áurea de ponta).
- `calculateCurvedArrowPoints` gerando 6 pontos com offset perpendicular correto para `'left'` e `'right'`.
- `invertCurvedArrowPoints` espelhando a curvatura em relação à corda mantendo início e fim.
- `clampArrowResizeBox` travando nos limites 2px e 8px e mantendo aspect ratio sem distorcer.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/zoomAndCrop.test.ts`
Expected: FAIL com funções não encontradas.

- [ ] **Step 3: Implement math functions in `src/utils/zoomAndCrop.ts` and `src/utils/magnifierAndHover.ts`**

Implementar cálculos de curvatura vetorial normalizada, degraus de traço e caixa delimitadora com clamp de limites.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/zoomAndCrop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/zoomAndCrop.ts src/utils/magnifierAndHover.ts tests/zoomAndCrop.test.ts
git commit -m "feat(geometry): adicionar utilitários matemáticos de arco, proporção e redimensionamento de flecha"
```

---

### Task 3: Toolbar Arrow Selector UI & App Wiring

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/appFeatures.test.ts`

**Interfaces:**
- Consumes:
  - `ArrowStyle`, `ArrowCurveDirection`, `shouldShowArrowControls` from `src/state/editorStore.ts`
- Produces:
  - Toolbar pill segmentado com botões `Padrão`, `Fina`, `Pontilhada`, `Curva`
  - Botão contextual `Inverter arco` (com ícone `RotateCw`) quando o estilo selecionado for `curved`
  - Conexão no `App.tsx` das propriedades `arrowStyle`, `onSelectArrowStyle`, `onToggleCurveDirection`

- [ ] **Step 1: Write unit/component tests in `tests/appFeatures.test.ts`**

Verificar que:
- O seletor de flechas é renderizado quando `activeTool === 'arrow'`.
- Os 4 botões estão presentes com labels `Padrão`, `Fina`, `Pontilhada` e `Curva`.
- Ao selecionar `Curva`, o botão `Inverter arco` é exibido.
- Clicar nas opções invoca os callbacks correspondentes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/appFeatures.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement UI in `src/components/Toolbar.tsx` and wire in `src/App.tsx`**

Integrar o seletor estilo pill idêntico aos de lupa e recorte, adicionar o botão de inverter arco e conectar com o store no `App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/appFeatures.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/App.tsx tests/appFeatures.test.ts
git commit -m "feat(ui): adicionar seletor de estilos de flechas e inversão de arco na toolbar"
```

---

### Task 4: Canvas Rendering, Drawing, and Stepped Arrow Transformation

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/zoomAndCrop.test.ts` (ou teste de integração)

**Interfaces:**
- Consumes:
  - `ArrowStyle`, `ArrowCurveDirection` from `src/state/editorStore.ts`
  - `calculateCurvedArrowPoints`, `getArrowHeadDimensions`, `calculateResizedArrowStroke`, `ARROW_STROKE_STEPS`, `clampArrowResizeBox` from `src/utils/zoomAndCrop.ts` & `src/utils/magnifierAndHover.ts`

- [ ] **Step 1: Write test for arrow rendering props and stepped resizing calculation**

Garantir testes cobrindo o dimensionamento da ponta para cada estilo, espessuras padrão correspondentes e clamp das coordenadas curvas.

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npm.cmd test`

- [ ] **Step 3: Implement drawing, rendering and transform logic in `src/components/CanvasEditor.tsx`**

- Na criação (`handleMouseDown` / `handleMouseMove` / `handleMouseUp`):
  - Definir espessura inicial: 2px para `thin`, 4px para `standard`, `dashed` e `curved`.
  - Se `arrowStyle === 'curved'`, gerar 6 pontos dinamicamente via `calculateCurvedArrowPoints`.
  - Salvar `arrowStyle` e `curveDirection` na anotação.
- Na renderização do Canvas principal e da lente da lupa:
  - Renderizar `<Arrow>` com `dash={ann.arrowStyle === 'dashed' ? [6, 4] : undefined}`.
  - Se `curved`, usar `tension={0.4}`.
  - Aplicar `pointerLength` e `pointerWidth` via `getArrowHeadDimensions(strokeWidth, arrowStyle)`.
- No Transformer (`boundBoxFunc`, `handleTransform`, `handleTransformEnd`):
  - Utilizar `clampArrowResizeBox` no `boundBoxFunc`.
  - No `handleTransform`, sincronizar escala proporcional para o degrau discretizado de espessura mais próximo.
  - No `handleTransformEnd`, gravar o novo `strokeWidth` discretizado em `[2, 3, 4, 6, 8]`, aplicar a escala proporcional nos pontos e redefinir `scaleX = 1, scaleY = 1`.
  - Garantir que `clampLinePointsToBounds` mantenha todos os pontos (inclusive do arco) dentro dos limites da imagem.

- [ ] **Step 4: Run all tests and build verification**

Run: `npm.cmd test && npx.cmd tsc --noEmit`
Expected: All tests PASS, TypeScript 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasEditor.tsx tests/
git commit -m "feat(canvas): suportar desenho, renderização e redimensionamento em degraus de flechas"
```

---

### Task 5: Final Verification & Integration

**Files:**
- Entire repository

- [ ] **Step 1: Execute complete test suite**

Run: `npm.cmd test`
Expected: 100% tests passing.

- [ ] **Step 2: Execute production build**

Run: `npm.cmd run build`
Expected: `tsc && vite build` completes with exit code 0.

- [ ] **Step 3: Commit and summarize for user**

Verificar status do git e apresentar as evidências de validação.
