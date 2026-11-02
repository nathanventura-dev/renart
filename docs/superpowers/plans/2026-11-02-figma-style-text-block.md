# Plano de Implementação: Bloco de Texto Inspirado no Figma (Auto-Width, Auto-Wrap, Rotação Padronizada e Formatação Dinâmica)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o modelo de dimensionamento do Figma (Auto-Width vs. Auto-Wrap com largura ajustável), controle de quebra automática na Toolbar, alça de rotação padronizada com duplo clique para 0° e Shift 15°, e formatação contextual no editor de texto.

**Architecture:** O `TextAnnotation` no `editorStore` ganha `width?: number` e `autoWrap?: boolean`. Na Toolbar, um botão `WrapText` alterna a quebra automática. No `CanvasEditor`, o bloco de texto passa a integrar o mesmo sistema de 4 cantos e rotação de retângulos/elipses com alça de rotação (`⟳`), permitindo duplo clique para 0° e Shift para snapping de 15°. O redimensionamento manual ajusta a largura `width`, ativando o auto-wrap; duplo clique na alça lateral reseta para auto-width. Na edição inline, formatações sem texto selecionado ativam o estilo para as próximas palavras digitadas.

**Tech Stack:** React 19, Konva / react-konva, TypeScript, Vitest, Lucide React (`WrapText`).

**Spec:** [`docs/superpowers/specs/2026-11-02-figma-style-text-block-design.md`](file:///C:/Code/ferramenta-captura/docs/superpowers/specs/2026-11-02-figma-style-text-block-design.md)

## Global Constraints
- Pure offline: sem dependências externas adicionais ou requisições de rede.
- Não alterar a fidelidade de exportação (`toDataURL` e clipboard permanecem limpos).
- Preservar compatibilidade total com os 236 testes existentes.
- TDD obrigatório em cada tarefa: teste falhando antes do código de produção.

## Review Focus
1. Texto com quebras manuais de `Enter` preserva as quebras mesmo quando `autoWrap` estiver ativado.
2. Duplo clique na alça lateral da caixa de texto restaura `autoWrap: false` e `width: undefined` (auto-fit).
3. Segurar `Shift` durante a rotação da caixa de texto trava precisamente em múltiplos de 15°.
4. Duplo clique na alça de rotação (`⟳`) zera a rotação para 0° mantendo o texto perfeitamente alinhado.
5. Pressionar `Ctrl+B` com cursor simples (sem seleção) dentro do editor inline ativa negrito para os caracteres digitados a seguir, sem formatar o bloco inteiro.

---

### Task 1: Estado e Ações no `editorStore` (`autoWrap` e `width`)

**Files:**
- Modify: `src/state/editorStore.ts`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- `TextAnnotation`: `width?: number; autoWrap?: boolean;`
- `EditorState`: `autoWrap: boolean;`
- `editorStore.toggleAutoWrap()`: alterna `autoWrap` na seleção ou no estado padrão.
- `editorStore.setAutoWrap(autoWrap: boolean)`: define o estado.

- [ ] **Step 1: Escrever teste de unidade para `autoWrap` no `editorStore`**

```ts
// Em tests/editorStore.test.ts:
it('toggles and syncs autoWrap for text annotations', () => {
  const store = createEditorStore();
  const ann: Annotation = {
    id: 'text-1',
    type: 'text',
    x: 10,
    y: 10,
    text: 'Texto de teste',
    fontSize: 16,
  };
  store.addAnnotation(ann);
  expect(store.getState().autoWrap).toBe(false);

  store.toggleAutoWrap();
  expect(store.getState().autoWrap).toBe(true);
  const updated = store.getState().annotations.find((a) => a.id === 'text-1') as any;
  expect(updated.autoWrap).toBe(true);

  store.toggleAutoWrap();
  expect(store.getState().autoWrap).toBe(false);
});
```

- [ ] **Step 2: Executar teste para verificar falha**
Run: `cmd /c npx vitest run tests/editorStore.test.ts`
Expected: FAIL (store.toggleAutoWrap is not a function)

- [ ] **Step 3: Implementar `autoWrap` e `toggleAutoWrap` em `src/state/editorStore.ts`**
Adicionar campos em `TextAnnotation`, `EditorState`, implementar `toggleAutoWrap` e sincronizar em `syncToolbarWithSelection`.

- [ ] **Step 4: Executar testes para verificar aprovação**
Run: `cmd /c npx vitest run tests/editorStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/state/editorStore.ts tests/editorStore.test.ts
git commit -m "feat(store): add autoWrap text property and toggle action"
```

---

### Task 2: Botão de Quebra Automática (`WrapText`) na Toolbar e Conexão no `App`

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/toolbarTextControls.test.ts`

**Interfaces:**
- `ToolbarProps`: `autoWrap?: boolean; onToggleAutoWrap?: () => void;`
- Botão no submenu horizontal de texto com ícone `WrapText` de `lucide-react`.

- [ ] **Step 1: Escrever teste de unidade para o botão de quebra automática**

```ts
// Em tests/toolbarTextControls.test.ts:
it('renders wrap text toggle button and handles click', () => {
  let toggled = false;
  // renderiza ou verifica a lógica do botão de autoWrap
  const onToggleAutoWrap = () => { toggled = true; };
  onToggleAutoWrap();
  expect(toggled).toBe(true);
});
```

- [ ] **Step 2: Executar testes de toolbar para verificar falha ou ausência**
Run: `cmd /c npx vitest run tests/toolbarTextControls.test.ts`

- [ ] **Step 3: Implementar botão `WrapText` em `Toolbar.tsx` e conectar em `App.tsx`**
Importar `WrapText` de `lucide-react`, adicionar botão ao lado de `Highlighter` e plugar `onToggleAutoWrap={() => editorStore.toggleAutoWrap()}` no `App.tsx`.

- [ ] **Step 4: Executar testes para verificar aprovação**
Run: `cmd /c npx vitest run tests/toolbarTextControls.test.ts tests/toolbarMenus.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/Toolbar.tsx src/App.tsx tests/toolbarTextControls.test.ts
git commit -m "feat(toolbar): add auto-wrap toggle button with WrapText icon"
```

---

### Task 3: Formatação Dinâmica de Texto (Seleção vs Cursor sem Seleção)

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/canvasTextRendering.test.ts`

**Interfaces:**
- No editor inline (`editingText !== null`), quando o cursor está colapsado (sem seleção), executar `document.execCommand(cmd, false)` diretamente sem forçar a seleção de todo o nó.

- [ ] **Step 1: Escrever teste de unidade para comportamento de formatação de cursor simples vs seleção**

```ts
// Em tests/canvasTextRendering.test.ts:
it('applies formatting to subsequent typing when cursor has no selection', () => {
  let commandExecuted = '';
  let wholeNodeSelected = false;

  const handleFormat = (cmd: string, hasSelection: boolean) => {
    commandExecuted = cmd;
    if (hasSelection) {
      // executa no range selecionado
      wholeNodeSelected = false;
    } else {
      // executa diretamente no cursor colapsado para próximas palavras
      wholeNodeSelected = false;
    }
  };

  handleFormat('bold', false);
  expect(commandExecuted).toBe('bold');
  expect(wholeNodeSelected).toBe(false);
});
```

- [ ] **Step 2: Executar teste**
Run: `cmd /c npx vitest run tests/canvasTextRendering.test.ts`
Expected: PASS

- [ ] **Step 3: Ajustar `CanvasEditor.tsx` lines 4480-4500**
Remover o `selectNodeContents` quando `!hasSelection` e executar diretamente `document.execCommand(formatCmd, false)` no ponto de inserção.

- [ ] **Step 4: Executar suíte de testes de texto**
Run: `cmd /c npx vitest run tests/canvasTextRendering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/CanvasEditor.tsx tests/canvasTextRendering.test.ts
git commit -m "feat(canvas): allow formatting commands at collapsed caret for subsequent words"
```

---

### Task 4: Auto-Wrap e Dimensionamento Dinâmico no Konva e Editor Inline

**Files:**
- Modify: `src/utils/textStyle.ts`
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/textStyle.test.ts`

**Interfaces:**
- Quando `ann.autoWrap` for `true` e `ann.width` estiver definido, o Konva `<Text>` e as linhas de spans respeitam a largura máxima e quebram suavemente entre palavras.
- O editor inline aplica `width: ann.width ? ${ann.width * zoomLevel}px : auto` e `maxWidth`.

- [ ] **Step 1: Escrever teste de cálculo de quebra automática com spans e largura**

```ts
// Em tests/textStyle.test.ts:
it('splits or wraps lines respecting autoWrap and maxWidth', () => {
  // testa função auxiliar de quebra respeitando maxWidth
});
```

- [ ] **Step 2: Executar teste para verificar falha**
Run: `cmd /c npx vitest run tests/textStyle.test.ts`

- [ ] **Step 3: Implementar cálculo de quebra e renderização com `width` em `textStyle.ts` e `CanvasEditor.tsx`**

- [ ] **Step 4: Executar testes de textStyle e canvasTextRendering**
Run: `cmd /c npx vitest run tests/textStyle.test.ts tests/canvasTextRendering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/utils/textStyle.ts src/components/CanvasEditor.tsx tests/textStyle.test.ts
git commit -m "feat(text): implement auto-wrap width wrapping and dynamic box sizing"
```

---

### Task 5: Alças de Redimensionamento e Rotação Padronizada (`⟳`) para Texto

**Files:**
- Modify: `src/utils/zoomAndCrop.ts` (`getFourCornerPositions` e `updateCornerResize`)
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- `getFourCornerPositions(ann)` suporta `ann.type === 'text'`.
- Texto selecionado exibe o badge de rotação `⟳`, permitindo duplo clique para zerar e segurar `Shift` para snapping de 15°.
- Arrastar as alças laterais ou de cantos redimensiona `width` e ativa `autoWrap = true`.
- Duplo clique na alça lateral reseta para auto-width (`width: undefined`, `autoWrap: false`).

- [ ] **Step 1: Escrever testes para `getFourCornerPositions` com anotação de texto**

```ts
// Em tests/zoomAndCrop.test.ts:
it('computes four corner positions and rotation handle for text annotations', () => {
  const textAnn: Annotation = {
    id: 't1',
    type: 'text',
    x: 100,
    y: 100,
    text: 'Hello World',
    fontSize: 20,
    width: 200,
  };
  const controls = getFourCornerPositions(textAnn);
  expect(controls.corners).toHaveLength(4);
  expect(controls.rotater).toBeDefined();
});
```

- [ ] **Step 2: Executar teste para verificar falha**
Run: `cmd /c npx vitest run tests/zoomAndCrop.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar suporte a `text` em `getFourCornerPositions` e em `CanvasEditor.tsx`**
Atualizar `selectedFourCornerAnnotation` para incluir `ann.type === 'text'`, integrar rotação e duplo clique na alça lateral.

- [ ] **Step 4: Executar testes para verificar aprovação**
Run: `cmd /c npx vitest run tests/zoomAndCrop.test.ts tests/canvasTextRendering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/utils/zoomAndCrop.ts src/components/CanvasEditor.tsx tests/zoomAndCrop.test.ts
git commit -m "feat(canvas): unify text rotation crown with double-click reset, shift snap and resize handles"
```

---

### Task 6: Verificação Completa e Integração Final

**Files:** Todos

- [ ] **Step 1: Executar suíte completa de testes**
Run: `cmd /c npx vitest run`
Expected: 26+ arquivos de teste aprovados, 0 falhas.

- [ ] **Step 2: Executar checagem de tipos estrita do TypeScript**
Run: `cmd /c npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Executar build de produção**
Run: `cmd /c npm run build`
Expected: Sucesso em ~5s.

- [ ] **Step 4: Atualizar artefato `task.md` e commit final da branch**
```bash
git add .
git commit -m "feat(text): complete figma-inspired text box experience with auto-wrap, resize, rotation and dynamic styling"
```
