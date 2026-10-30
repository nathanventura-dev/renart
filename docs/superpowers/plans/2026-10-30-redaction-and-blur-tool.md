# Ferramenta de Ocultação de Dados Confidenciais (Tarja e Blur) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar uma ferramenta dedicada de privacidade e ocultação de dados confidenciais (Redaction & Blur) com duas opções visuais (Tarja Sólida `#000000` e Blur Destrutivo) e dois modos de desenho (Caixa Retangular Ajustável e Pincel Livre), garantindo a queima permanente dos pixels e a irreversibilidade dos dados na imagem final exportada e no clipboard.

**Architecture:** No `editorStore.ts`, define-se o tipo `redaction` com modos de efeito (`blackout` / `blur`) e desenho (`rect` / `brush`) suportando histórico completo (Undo/Redo). A `Toolbar.tsx` ganha o botão de acionamento (`ShieldAlert`) com submenu contextual de seleção de modo. O `CanvasEditor.tsx` manipula o desenho interativo (com alças do `Transformer` para caixas retangulares e traçado contínuo para pincel) renderizando os filtros de desfoque ou blocos pretos, e o `exportService.ts` assegura a rasterização plana sem camadas residuais na exportação.

**Tech Stack:** React 19, TypeScript 5.7, Konva / react-konva, Vitest, Lucide React (`ShieldAlert`).

**Spec:** `docs/superpowers/specs/2026-10-30-redaction-and-blur-tool-design.md`

## Global Constraints

- A Tarja Sólida deve substituir 100% dos pixels confidenciais por blocos opacos pretos (`#000000`).
- O Blur deve aplicar desfoque ou pixelização de alta intensidade (`blurRadius >= 20px`), destruindo a entropia dos caracteres.
- Cópia para o clipboard e exportações (PNG, JPG, PDF) devem ser achatadas sem metadados nem camadas vetoriais residuais.
- As anotações de ocultação devem suportar Undo/Redo (`Ctrl+Z` / `Ctrl+Shift+Z`) e exclusão pela tecla `Delete` durante a edição.

## Review Focus

- Arrastar uma caixa de tarja ou blur para fora dos limites da imagem: deve ser contida pelos limites visíveis da imagem.
- Criar múltiplos traços de pincel seguidos: cada traçado deve ser uma anotação independente na pilha de desfazer.
- Redimensionar uma caixa de blur com o Transformer: o filtro de desfoque deve se esticar e cobrir com perfeição a nova área delimitada.
- Alternar entre Tarja Sólida e Blur com um item selecionado: deve atualizar dinamicamente o efeito do elemento selecionado na tela.
- Exportação em PDF com múltiplas tarjas e blurs: o PDF resultante não pode conter objetos vetoriais destacáveis, devendo ser uma imagem bitmap rasterizada plana.

---

### Task 1: Data Model, State Management & Helper Functions

**Files:**
- Modify: `src/state/editorStore.ts`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - `RedactionEffect = 'blackout' | 'blur'`
  - `RedactionMode = 'rect' | 'brush'`
  - `RedactionAnnotation extends BaseAnnotation`
  - `shouldShowRedactionControls(activeTool: ToolType, selectedAnnotations: Annotation[]): boolean`
  - `EditorState.redactionEffect: RedactionEffect`
  - `EditorState.redactionMode: RedactionMode`
  - `EditorStore.setRedactionEffect(effect: RedactionEffect): void`
  - `EditorStore.setRedactionMode(mode: RedactionMode): void`

- [ ] **Step 1: Write failing tests in `tests/editorStore.test.ts` for redaction state & helpers**

```typescript
describe('Redaction & Blur Tool in EditorStore', () => {
  it('adds a rect blackout redaction annotation and supports undo/redo', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'redact-1',
      type: 'redaction',
      effect: 'blackout',
      mode: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 30,
    });
    expect(store.getState().annotations).toHaveLength(1);
    expect(store.getState().annotations[0].type).toBe('redaction');
    store.undo();
    expect(store.getState().annotations).toHaveLength(0);
    store.redo();
    expect(store.getState().annotations).toHaveLength(1);
  });

  it('updates redaction effect and mode in store', () => {
    const store = createEditorStore();
    expect(store.getState().redactionEffect).toBe('blackout');
    expect(store.getState().redactionMode).toBe('rect');
    store.setRedactionEffect('blur');
    store.setRedactionMode('brush');
    expect(store.getState().redactionEffect).toBe('blur');
    expect(store.getState().redactionMode).toBe('brush');
  });

  it('evaluates shouldShowRedactionControls correctly', () => {
    expect(shouldShowRedactionControls('redaction', [])).toBe(true);
    expect(shouldShowRedactionControls('select', [])).toBe(false);
    expect(shouldShowRedactionControls('select', [{ id: '1', type: 'redaction', effect: 'blackout', mode: 'rect' }])).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/editorStore.test.ts`  
Expected: FAIL with compilation error on missing `shouldShowRedactionControls`, `redaction` type or properties.

- [ ] **Step 3: Implement data model and actions in `src/state/editorStore.ts`**

Adicionar `RedactionEffect`, `RedactionMode`, `RedactionAnnotation`, estender `ToolType` com `'redaction'`, estender o union `Annotation`, adicionar os campos e métodos no store e exportar `shouldShowRedactionControls`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/editorStore.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/editorStore.ts tests/editorStore.test.ts
git commit -m "feat(store): add redaction and blur data model and actions"
```

---

### Task 2: Toolbar UI, Contextual Dropdowns & Controls

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Test: `tests/toolbarMenus.test.ts`

**Interfaces:**
- Consumes: `RedactionEffect`, `RedactionMode`, `shouldShowRedactionControls`, `RedactionAnnotation` from `editorStore.ts`
- Produces:
  - `resolveRedactionToolbarState(...)`
  - Botão `ShieldAlert` na Toolbar ao lado de Texto/Lupa
  - Submenu contextual horizontal de Ocultação com opções de Efeito (Tarja / Blur) e Modo (Retângulo / Pincel)

- [ ] **Step 1: Write failing tests in `tests/toolbarMenus.test.ts` for redaction toolbar menu**

```typescript
describe('Redaction Toolbar Controls', () => {
  it('resolves redaction toolbar state with active tool or selected redaction annotation', () => {
    const activeState = resolveRedactionToolbarState('redaction', [], 'blackout', 'rect');
    expect(activeState.showRedactionControls).toBe(true);
    expect(activeState.effectiveRedactionEffect).toBe('blackout');
    expect(activeState.effectiveRedactionMode).toBe('rect');

    const selectedState = resolveRedactionToolbarState(
      'select',
      [{ id: 'r1', type: 'redaction', effect: 'blur', mode: 'brush' }],
      'blackout',
      'rect'
    );
    expect(selectedState.showRedactionControls).toBe(true);
    expect(selectedState.effectiveRedactionEffect).toBe('blur');
    expect(selectedState.effectiveRedactionMode).toBe('brush');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/toolbarMenus.test.ts`  
Expected: FAIL with "resolveRedactionToolbarState is not a function".

- [ ] **Step 3: Implement `resolveRedactionToolbarState`, tool button and dropdown in `src/components/Toolbar.tsx`**

1. Importar `ShieldAlert` de `lucide-react`.
2. Implementar `resolveRedactionToolbarState`.
3. Adicionar o botão da ferramenta na Toolbar (entre Texto e Lupa).
4. Adicionar o submenu contextual com botões estéticos para alternar entre Tarja Sólida e Blur Destrutivo, e entre Retângulo e Pincel Livre.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/toolbarMenus.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx tests/toolbarMenus.test.ts
git commit -m "feat(ui): add redaction tool button and contextual dropdown menu to toolbar"
```

---

### Task 3: Interactive Drawing & Konva Rendering

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Create: `tests/redactionTool.test.ts`

**Interfaces:**
- Consumes: `RedactionAnnotation`, `activeRedactionEffect`, `activeRedactionMode` from `editorStore.ts`
- Produces:
  - Criação de `RedactionAnnotation` no arraste do cursor
  - Renderização de Tarja Sólida com `<Rect>` ou `<Line>`
  - Renderização de Blur Destrutivo com desfoque de alta densidade
  - Integração com `Transformer` para redimensionamento e rotação de caixas

- [ ] **Step 1: Write failing tests in `tests/redactionTool.test.ts`**

```typescript
describe('Redaction & Blur Canvas Logic', () => {
  it('creates rect redaction with correct bounding box clamp', () => {
    // Validação matemática de limites e dimensões mínimas para anotação de redaction
    const redactionBox = createRedactionRect(10, 20, 100, 50, 'blackout');
    expect(redactionBox.type).toBe('redaction');
    expect(redactionBox.effect).toBe('blackout');
    expect(redactionBox.mode).toBe('rect');
    expect(redactionBox.width).toBe(100);
  });

  it('creates brush redaction with points array and default brush size', () => {
    const brushAnn = createRedactionBrush([10, 10, 20, 20, 30, 25], 'blur', 24);
    expect(brushAnn.type).toBe('redaction');
    expect(brushAnn.effect).toBe('blur');
    expect(brushAnn.mode).toBe('brush');
    expect(brushAnn.brushSize).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test tests/redactionTool.test.ts`  
Expected: FAIL (files/functions do not exist).

- [ ] **Step 3: Implement interactive redaction creation and rendering in `src/components/CanvasEditor.tsx`**

1. Suportar estado transitório de desenho para `'redaction'`:
   - Se `redactionMode === 'rect'`: desenha caixa delimitadora temporária no arraste e cria `RedactionAnnotation` no mouseup.
   - Se `redactionMode === 'brush'`: acumula pontos `[x, y]` no arraste e cria `RedactionAnnotation` com `points` no mouseup.
2. Renderizar nó `<Rect>` preto para Tarja Retângulo e `<Line>` para Tarja Pincel.
3. Renderizar nós com filtro de Blur destrutivo para efeito `'blur'`.
4. Vincular o `Transformer` às anotações de redaction retangulares selecionadas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test tests/redactionTool.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasEditor.tsx tests/redactionTool.test.ts
git commit -m "feat(canvas): implement interactive rect and brush drawing for redaction and blur"
```

---

### Task 4: Secure Flattening Verification in Export & Clipboard

**Files:**
- Modify: `src/services/exportService.ts`
- Modify: `tests/exportService.test.ts`

**Interfaces:**
- Consumes: Stage do Konva com anotações de redaction
- Produces: Imagem rasterizada plana com dados confidenciais completamente substituídos e sem âncoras/controles

- [ ] **Step 1: Write test in `tests/exportService.test.ts` verifying overlay suppression during export with redaction**

```typescript
it('ensures redaction annotations are rendered and editor overlays remain hidden during export', async () => {
  // Teste garantindo que overlays (Transformer, âncoras) não vazem para a imagem exportada
  // e que o pipeline de exportação processe o stage de forma plana
});
```

- [ ] **Step 2: Run test to verify current state**

Run: `npm.cmd test tests/exportService.test.ts`  
Expected: PASS / Adaptar assertions se necessário.

- [ ] **Step 3: Verify and ensure flattening logic in `src/services/exportService.ts`**

Garantir que todas as anotações do tipo `redaction` sejam mantidas visíveis durante o achatamento do Canvas e que a saída seja gerada como PNG/JPEG plano sem camadas.

- [ ] **Step 4: Run full test suite**

Run: `npm.cmd test`  
Expected: 100% dos testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/services/exportService.ts tests/exportService.test.ts
git commit -m "test(export): verify secure flattening of redaction and blur in export pipeline"
```

---

### Task 5: Documentation & Knowledge Base Update

**Files:**
- Modify: `README.md`
- Modify: `docs/manual-de-funcionamento-e-fluxo.md`
- Modify: `docs/arquitetura-e-tecnologias.md`

- [ ] **Step 1: Update `README.md` with the new privacy feature**
Adicionar a nova ferramenta de Ocultação/Censura (Tarja Sólida e Blur Destrutivo com Retângulo e Pincel) na lista de Recursos Principais e Atalhos.

- [ ] **Step 2: Update documentation in `docs/`**
Atualizar `docs/manual-de-funcionamento-e-fluxo.md` e `docs/arquitetura-e-tecnologias.md` explicando o funcionamento e a garantia de irreversibilidade dos dados.

- [ ] **Step 3: Run full test suite to guarantee no regressions**

Run: `npm.cmd test`  
Expected: 100% PASS

- [ ] **Step 4: Commit**

```bash
git add README.md docs/
git commit -m "docs: update readme and documentation with redaction and blur tool"
```
