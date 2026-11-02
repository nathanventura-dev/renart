# Plano de Implementação: Formatação Avançada de Texto (Estilo, Alinhamento e Destaque)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir a ferramenta de texto com controles de estilo (Negrito, Itálico, Sublinhado, Riscado), alinhamento (Esquerda, Centro, Direita), fundo de realce (Badge/Tag), atalhos de teclado (`Ctrl+B`, `Ctrl+I`, `Ctrl+U`) e histórico de Undo/Redo.

**Architecture:** 
1. Módulo puro `textStyle.ts` para resolver mapeamento de estilos para o Konva e CSS.
2. Extensão do modelo `TextAnnotation` e `EditorState` com novas ações e sincronização bidirecional na store.
3. Submenu horizontal na `Toolbar.tsx` organizado nos 4 blocos definidos na especificação.
4. Renderização do Konva no `CanvasEditor.tsx` com suporte a fundo de destaque e atalhos na edição inline.

**Tech Stack:** TypeScript, React, Konva / react-konva, Lucide Icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-text-styling-toolbar-design.md`

## Global Constraints

- Todos os novos atributos são opcionais em `TextAnnotation` com defaults seguros (`isBold: false`, `isItalic: false`, `isUnderline: false`, `isStrikethrough: false`, `textAlign: 'left'`, `hasBackground: false`).
- A interface segue a Abordagem 1 (barra horizontal única com divisores verticais).
- 100% de cobertura nos testes unitários e zero erros em `tsc --noEmit`.
- Undo/Redo deve funcionar ao alterar qualquer estilo em bloco(s) de texto selecionado(s).

## Review Focus

1. Combinações simultâneas de estilos (ex: Negrito + Itálico -> `fontStyle: 'italic bold'`; Sublinhado + Riscado -> `textDecoration: 'underline line-through'`).
2. Alternância de alinhamento em textos com múltiplas linhas.
3. Sincronização dos botões da Toolbar ao selecionar um texto existente com estilos ativos.
4. Edição inline no `<textarea>` refletindo estilos em tempo real e interceptando `Ctrl+B`, `Ctrl+I`, `Ctrl+U`.
5. Fundo de realce desenhado corretamente com padding e sem sobrepor controles do Konva.

---

### Task 1: Módulo de Mapeamento de Estilos de Texto (`src/utils/textStyle.ts`)

**Files:**
- Create: `src/utils/textStyle.ts`
- Test: `tests/textStyle.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TextAlign = 'left' | 'center' | 'right';
  export function resolveKonvaFontStyle(isBold?: boolean, isItalic?: boolean): string;
  export function resolveKonvaTextDecoration(isUnderline?: boolean, isStrikethrough?: boolean): string;
  export function resolveTextCssStyle(isBold?: boolean, isItalic?: boolean, isUnderline?: boolean, isStrikethrough?: boolean): {
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
  };
  ```

- [ ] **Step 1: Write failing test in `tests/textStyle.test.ts`**
- [ ] **Step 2: Run test to verify it fails** (`npm test -- tests/textStyle.test.ts`)
- [ ] **Step 3: Implement `src/utils/textStyle.ts`**
- [ ] **Step 4: Run test to verify it passes** (`npm test -- tests/textStyle.test.ts`)
- [ ] **Step 5: Commit Task 1**

---

### Task 2: Modelo e Ações de Texto na Store (`src/state/editorStore.ts`)

**Files:**
- Modify: `src/state/editorStore.ts`
- Test: `tests/textStore.test.ts`

**Interfaces:**
- Produces:
  - `TextAnnotation` com novos campos: `isBold`, `isItalic`, `isUnderline`, `isStrikethrough`, `textAlign`, `hasBackground`.
  - `EditorState` com novos estados e ações:
    `toggleBold()`, `toggleItalic()`, `toggleUnderline()`, `toggleStrikethrough()`, `setTextAlign(align)`, `toggleBackground()`.
  - Suporte a seleção de anotações (sincronizando o estado global com a primeira anotação de texto selecionada) e histórico de Undo/Redo.

- [ ] **Step 1: Write failing test in `tests/textStore.test.ts`**
- [ ] **Step 2: Run test to verify it fails** (`npm test -- tests/textStore.test.ts`)
- [ ] **Step 3: Implement updates in `src/state/editorStore.ts`**
- [ ] **Step 4: Run test to verify it passes** (`npm test -- tests/textStore.test.ts`)
- [ ] **Step 5: Commit Task 2**

---

### Task 3: Controles de Formatação de Texto na Toolbar (`src/components/Toolbar.tsx`, `src/App.tsx`)

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/toolbarTextControls.test.ts`

**Interfaces:**
- Produces:
  - Menu horizontal de texto atualizado com:
    - Tipografia (Fonte e Tamanho)
    - Toggles de estilo (`Bold`, `Italic`, `Underline`, `Strikethrough`)
    - Segmentado de alinhamento (`AlignLeft`, `AlignCenter`, `AlignRight`)
    - Toggle de Fundo/Badge (`Highlighter`)

- [ ] **Step 1: Write failing test in `tests/toolbarTextControls.test.ts`**
- [ ] **Step 2: Run test to verify it fails** (`npm test -- tests/toolbarTextControls.test.ts`)
- [ ] **Step 3: Implement new buttons in `Toolbar.tsx` and connect handlers in `App.tsx`**
- [ ] **Step 4: Run test to verify it passes** (`npm test -- tests/toolbarTextControls.test.ts`)
- [ ] **Step 5: Commit Task 3**

---

### Task 4: Renderização do Canvas e Atalhos de Edição Inline (`src/components/CanvasEditor.tsx`)

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/canvasTextRendering.test.ts`

**Interfaces:**
- Produces:
  - `<Text />` no Konva aplicando `fontStyle`, `textDecoration`, `align`.
  - Caixa de fundo arredondada `<Rect />` quando `hasBackground: true`.
  - `<textarea>` inline herdando estilos e tratando atalhos `Ctrl+B`, `Ctrl+I`, `Ctrl+U`.

- [ ] **Step 1: Write failing test in `tests/canvasTextRendering.test.ts`**
- [ ] **Step 2: Run test to verify it fails** (`npm test -- tests/canvasTextRendering.test.ts`)
- [ ] **Step 3: Update `CanvasEditor.tsx` with text rendering and shortcut handlers**
- [ ] **Step 4: Run test to verify it passes** (`npm test -- tests/canvasTextRendering.test.ts`)
- [ ] **Step 5: Commit Task 4**

---

### Task 5: Validação Geral e Build

**Files:**
- None (Validação geral)

- [ ] **Step 1: Run full test suite** (`npm test`)
- [ ] **Step 2: Run TypeScript typecheck** (`tsc --noEmit`)
- [ ] **Step 3: Run production build** (`npm run build`)
- [ ] **Step 4: Final commit and summary**
