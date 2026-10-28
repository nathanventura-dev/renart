# Text Font Family and Size Contextual Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir escolher a família da fonte e o tamanho da fonte de forma contextual na barra superior (quando a ferramenta `text` estiver ativa ou houver blocos de texto selecionados), aplicando alterações independentemente por bloco e mantendo a barra minimalista em `36px`.

**Architecture:** Estende `TextAnnotation` e `EditorState` em `src/state/editorStore.ts` com `fontFamily` e ações `setFontFamily` / `setFontSize` que atualizam os blocos `text` selecionados com suporte a Undo/Redo. Na `Toolbar.tsx`, troca contextualmente o seletor de espessura de linha (`2px..8px` + `Auto`) pelos seletores `[Fonte ▾]` e `[Tamanho ▾]` quando `isTextContextActive` for verdadeiro, e propaga `fontFamily` para o Konva `<Text>` e `<textarea>` inline em `CanvasEditor.tsx`.

**Tech Stack:** React 19, TypeScript, Konva.js (`react-konva`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-text-font-and-size-design.md`

## Global Constraints

- Altura unificada da barra de ferramentas: `36px` externa / `28px` interna nos controles.
- Fontes nativas instantâneas (`FONT_FAMILIES`): `['Arial', 'Segoe UI', 'Calibri', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New']`.
- Tamanhos tipográficos (`FONT_SIZES`): `[12, 14, 16, 18, 20, 24, 28, 32, 36, 48]`.
- Commits em português e documentação de manual e testes atualizada.

## Review Focus

- Alterar fonte ou tamanho com múltiplos blocos selecionados (ex: 1 retângulo + 1 texto) deve atualizar apenas os blocos de texto selecionados sem corromper os outros blocos.
- Selecionar um bloco de texto já existente com a ferramenta `select` ativa deve exibir os seletores de Fonte e Tamanho na barra refletindo a fonte e o tamanho daquele bloco.
- Desfazer (`Ctrl+Z`) e refazer (`Ctrl+Shift+Z`) após alterar a fonte ou o tamanho de um bloco de texto selecionado deve restaurar os valores anteriores.
- O texto ampliado dentro da lente da Lupa (`magnifier`) deve renderizar a mesma `fontFamily` e `fontSize` do bloco original.
- A edição inline por duplo clique (`textarea`) deve abrir com a `fontFamily` e o `fontSize` atuais do bloco de texto.

---

### Task 1: Suporte a `fontFamily`, `setFontFamily`, `setFontSize` e Contexto de Texto no Store e Toolbar

**Files:**
- Modify: `src/state/editorStore.ts`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `src/App.tsx`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - `TextAnnotation.fontFamily?: string`
  - `EditorState.fontFamily: string`
  - `editorStore.setFontFamily(fontFamily: string): void`
  - `editorStore.setFontSize(fontSize: number): void`
  - `shouldShowTextControls(activeTool: ToolType, selectedAnnotations: Annotation[]): boolean`

- [x] **Step 1: Write the failing test in `tests/editorStore.test.ts`**
- [x] **Step 2: Run test to verify it fails (`cmd.exe /c npm test tests/editorStore.test.ts`)**
- [x] **Step 3: Implement `fontFamily`, `setFontFamily`, `setFontSize`, `shouldShowTextControls`, and update `Toolbar.tsx`, `CanvasEditor.tsx`, and `App.tsx`**
- [x] **Step 4: Run test suite and build (`cmd.exe /c npm test` and `cmd.exe /c npm run build`)**
- [x] **Step 5: Update documentation and commit in Portuguese**
