# Text Editor Inline & Auto-Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular o editor de texto inline para digitação multi-linha fluida (Enter cria quebra de linha sem fechar), sincronização contínua sem perda de dados, e auto-fit de dimensões no Canvas desativando redimensionamento livre de fonte por alças de canto.

**Architecture:** O editor inline mantém suporte a rich text (`contenteditable`) com sincronização contínua de conteúdo via `onInput` e captura no `onBlur`. O `Enter` permite múltiplas linhas, enquanto `Ctrl+Enter`, `Esc` ou clique externo confirmam a edição. No Konva, elementos de texto usam auto-fit baseado no conteúdo e fonte, desativando alças de redimensionamento no `Transformer` para manter `fontSize` padronizado e exclusivo via Toolbar.

**Tech Stack:** React 18, Konva / react-konva, TypeScript, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-02-text-editor-inline-autofit-design.md`](file:///C:/Code/ferramenta-captura/docs/superpowers/specs/2026-11-02-text-editor-inline-autofit-design.md)

## Global Constraints
- Nenhuma dependência externa pesada de rich text; permanecer 100% offline e leve.
- Sem tainting de canvas: exportação e cópia de imagem (`toDataURL`) devem funcionar sem erros de segurança.
- Manter todas as funcionalidades de formatação: Negrito, Itálico, Sublinhado, Riscado, Alinhamento e Caixa de Destaque.

## Review Focus
- Pressionar `Enter` simples deve inserir quebra de linha sem sumir com a caixa de texto nem fechar a edição.
- Pressionar `Ctrl+Enter` ou `Esc` deve salvar o texto e fechar o modo de edição.
- Clicar fora da caixa de texto (blur) deve salvar as alterações digitadas sem perda.
- Caixa de texto vazia ao ser criada e abandonada deve ser removida sem deixar resíduos transparentes no Canvas.
- Selecionar um texto e rotacioná-lo ou movê-lo pelo Transformer não deve distorcer a fonte nem alterar o `fontSize` arbitrariamente.

---

### Task 1: Ciclo de Teclas, Sincronização Contínua e Commit no Editor Inline

**Files:**
- Modify: `src/components/CanvasEditor.tsx:4425-4525`
- Test: `tests/canvasTextRendering.test.ts`

**Interfaces:**
- Consumes: `parseHtmlToSpans`, `spansToHtml` de `src/utils/textStyle.ts`.
- Produces: `onUpdateAnnotation(id, { text, spans })` com sincronização contínua no blur e teclas.

- [ ] **Step 1: Escrever teste de unidade para o novo ciclo de teclas do editor inline**
  Em `tests/canvasTextRendering.test.ts`, adicionar teste simulando:
  - `Enter` sem Shift não deve fechar a edição (`preventDefault` é chamado apenas se for quebra de linha controlada ou inserção normal).
  - `Ctrl+Enter` e `Escape` chamam o fechamento/commit.
  - Sincronização de texto com quebras de linha (`\n`).

- [ ] **Step 2: Executar teste para verificar falha ou comportamento antigo**
  Executar: `cmd /c npx vitest run tests/canvasTextRendering.test.ts`
  Resultado esperado: Falha ou ausência do teste novo.

- [ ] **Step 3: Atualizar `CanvasEditor.tsx` para tratar teclas e sincronização no editor inline**
  - No `onKeyDown` de `inlineEditableRef`:
    - Se `e.key === 'Enter' && !e.ctrlKey && !e.metaKey`: NÃO fechar o editor! Permitir a quebra de linha natural do navegador (`\n`).
    - Se `(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'Escape'`: prevenir default, extrair `{ text, spans }` de `inlineEditableRef.current` via `parseHtmlToSpans` e invocar `onUpdateAnnotation` e `setEditingText(null)`.
  - No `onInput`:
    - Manter uma `ref` local (`currentTextRef`) com o HTML/texto mais recente digitado pelo usuário.
  - No `onBlur`:
    - Extrair o texto final de `inlineEditableRef.current` ou `currentTextRef`.
    - Se o texto trimado não for vazio e for diferente do texto inicial padrão não alterado: salvar com `onUpdateAnnotation`.
    - Se o texto for vazio e for uma anotação recém-adicionada: remover via `onDeleteAnnotation` ou não salvar texto vazio.
    - Fechar o modo de edição com `setEditingText(null)`.

- [ ] **Step 4: Executar testes de unidade e verificar aprovação**
  Executar: `cmd /c npx vitest run tests/canvasTextRendering.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit da Task 1**
  ```bash
  git add src/components/CanvasEditor.tsx tests/canvasTextRendering.test.ts
  git commit -m "feat(canvas): implement multiline enter and safe blur commit in text editor"
  ```

---

### Task 2: Auto-Fit de Bloco e Transformer de Texto Sem Redimensionamento Livre de Fonte

**Files:**
- Modify: `src/components/CanvasEditor.tsx:1115-1200`, `src/components/CanvasEditor.tsx:4340-4420`
- Test: `tests/canvasTextRendering.test.ts`

**Interfaces:**
- Consumes: Transformer do react-konva, `fontSize` da Toolbar e das anotações.
- Produces: Configuração do Transformer com `enabledAnchors: []` quando o único nó selecionado for texto, permitindo rotação e movimento sem escalonamento decimal de fonte.

- [ ] **Step 1: Escrever teste de unidade para ancoras e auto-fit de texto**
  Em `tests/canvasTextRendering.test.ts`, adicionar asserções garantindo que textos selecionados não ativam escalonamento manual de `fontSize` no Transformer e mantêm cálculo exato de dimensões (`approxW`, `approxH`).

- [ ] **Step 2: Executar teste para verificar comportamento**
  Executar: `cmd /c npx vitest run tests/canvasTextRendering.test.ts`
  Resultado esperado: PASS ou FAIL de nova asserção.

- [ ] **Step 3: Ajustar `CanvasEditor.tsx`**
  - No `Transformer`:
    - Detectar se os nós selecionados consistem exclusivamente em anotação do tipo `'text'`.
    - Se for texto selecionado: definir `enabledAnchors={[]}` (oculta as 8 alças de escala de tamanho).
    - Manter `rotateEnabled={true}` e `borderStroke="#0071e3"`.
  - Remover ou simplificar a rotina antiga `onTransform` / `onTransformEnd` para texto que tentava forçar `(node as Konva.Text).fontSize(nextFontSize)` em `<Group>`.
  - Garantir que o tamanho do texto seja alterado exclusivamente pelo controle de tamanho na Toolbar.

- [ ] **Step 4: Executar testes e verificar aprovação**
  Executar: `cmd /c npx vitest run tests/canvasTextRendering.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit da Task 2**
  ```bash
  git add src/components/CanvasEditor.tsx tests/canvasTextRendering.test.ts
  git commit -m "feat(canvas): enable auto-fit bounding box and disable free font resize handles for text"
  ```

---

### Task 3: Validação Completa e Integração Final

**Files:**
- Test: Todos os testes existentes em `tests/`
- Build: `npm run build`

- [ ] **Step 1: Executar suíte completa de testes**
  Executar: `cmd /c npx vitest run`
  Resultado esperado: 26 arquivos de teste passando (232+ testes).

- [ ] **Step 2: Executar checagem de tipos TypeScript estrita**
  Executar: `cmd /c npx tsc --noEmit`
  Resultado esperado: 0 erros (código 0).

- [ ] **Step 3: Executar build de produção**
  Executar: `cmd /c npm run build`
  Resultado esperado: Sucesso no bundle do Vite.

- [ ] **Step 4: Commit e atualização dos artefatos**
  ```bash
  git commit -m "chore: final verification for text inline editor and auto-fit block"
  ```
