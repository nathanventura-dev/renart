# Canvas Deselection and Creation Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar o comportamento de clique no canvas para que qualquer clique simples no vazio apenas desselecione elementos ativos (evitando criação acidental de texto), adicionar o atalho `Alt` para criação direta / carimbo com dimensões padrão, habilitar `Ctrl + Click` para alternar multiseleção e incluir blocos de redação na caixa de seleção por arraste (`marquee`).

**Architecture:** 
1. Adicionar suporte ao tipo `redaction` em `getAnnotationsInSelectionBox` (`src/utils/magnifierAndHover.ts`) para incluir elementos de redação na multiseleção por caixa.
2. Atualizar `handleBlockClick` em `src/components/CanvasEditor.tsx` para reconhecer `Ctrl` e `Cmd` além de `Shift` na multiseleção de itens específicos.
3. Centralizar no `handleMouseDown` de `src/components/CanvasEditor.tsx` a regra de "desselecionar primeiro": se houver elementos selecionados ou edição de texto ativa e `Alt` não estiver pressionado, o clique no vazio apenas desseleciona e fecha edição sem criar novo elemento.
4. Implementar no `handleMouseDown` e `handleMouseUp` o suporte ao atalho `Alt`: se `Alt` estiver pressionado, fura a desseleção e cria o elemento imediatamente (no clique simples $\le 4\text{px}$, aplica dimensões padrão no ponto do clique; no clique e arraste $> 4\text{px}$, aplica as dimensões arrastadas).

**Tech Stack:** React 19, Konva / React-Konva, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-canvas-deselection-and-creation-shortcuts-design.md`

## Global Constraints
- Nenhuma dependência externa nova permitida.
- 100% de compatibilidade entre Windows (`Ctrl`) e macOS (`Cmd / metaKey`).
- 0 erros no compilador TypeScript (`npx tsc --noEmit`).
- Manter todos os 265 testes existentes passando sem quebras.

## Review Focus
1. Desseleção com ferramenta Texto ativa: clicar no vazio quando um bloco está selecionado deve apenas desselecionar e comitar o texto, sem chamar `onAddAnnotation`.
2. Criação com ferramenta Texto quando nada está selecionado: o clique simples em área vazia cria o bloco de texto normalmente.
3. `Alt + Click` na ferramenta Texto: cria um novo bloco de texto imediatamente mesmo se outro bloco estiver selecionado.
4. `Alt + Click` vs `Alt + Drag` em Retângulo/Redação: clique sem arrasto ($\le 4\text{px}$) cria com tamanho padrão ($120 \times 60$, $120 \times 40$); arraste ($> 4\text{px}$) cria com tamanho personalizado.
5. Multiseleção de redação: caixa de seleção arrastada sobre blocos de redação (`type: 'redaction'`) deve incluir seus IDs em `selectedIds`.

---

### Task 1: Suporte a Redação no Marquee e `Ctrl + Click` para Multiseleção (TDD)

**Files:**
- Modify: `src/utils/magnifierAndHover.ts:364-430`
- Modify: `src/components/CanvasEditor.tsx:730-745`
- Test: `tests/magnifierAndHover.test.ts`

**Interfaces:**
- Consumes: `getAnnotationsInSelectionBox(annotations: Annotation[], box: SelectionBoxBounds): string[]`
- Produces: `getAnnotationsInSelectionBox` suportando `ann.type === 'redaction'` nos modos `'rect'`, `'smart-text'` e `'brush'`.

- [ ] **Step 1: Escrever teste unitário falhando para redação em `getAnnotationsInSelectionBox`**

Em `tests/magnifierAndHover.test.ts`:
```ts
it('includes redaction annotations within selection box bounds', () => {
  const annotations: any[] = [
    {
      id: 'redact-1',
      type: 'redaction',
      mode: 'rect',
      x: 50,
      y: 50,
      width: 100,
      height: 40,
    },
    {
      id: 'redact-brush',
      type: 'redaction',
      mode: 'brush',
      points: [60, 60, 80, 80],
    },
    {
      id: 'redact-outside',
      type: 'redaction',
      mode: 'rect',
      x: 300,
      y: 300,
      width: 50,
      height: 50,
    },
  ];
  const box = { x: 40, y: 40, width: 120, height: 100 };
  const hitIds = getAnnotationsInSelectionBox(annotations, box);
  expect(hitIds).toContain('redact-1');
  expect(hitIds).toContain('redact-brush');
  expect(hitIds).not.toContain('redact-outside');
});
```

- [ ] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/magnifierAndHover.test.ts`
Expected: FAIL com `expected [] to contain 'redact-1'`

- [ ] **Step 3: Implementar suporte a redação em `getAnnotationsInSelectionBox` e `Ctrl`/`Cmd` em `handleBlockClick`**

Em `src/utils/magnifierAndHover.ts`, adicionar cláusula para `ann.type === 'redaction'`:
```ts
} else if (ann.type === 'redaction') {
  if (ann.mode === 'brush' && ann.points && ann.points.length >= 2) {
    const xs = ann.points.filter((_, idx) => idx % 2 === 0);
    const ys = ann.points.filter((_, idx) => idx % 2 === 1);
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
  } else {
    const w = ann.width || 0;
    const h = ann.height || 0;
    const x1 = ann.x || 0;
    const y1 = ann.y || 0;
    const x2 = x1 + w * sx;
    const y2 = y1 + h * sy;
    minX = Math.min(x1, x2);
    maxX = Math.max(x1, x2);
    minY = Math.min(y1, y2);
    maxY = Math.max(y1, y2);
  }
}
```

Em `src/components/CanvasEditor.tsx`, em `handleBlockClick`:
```ts
const isMultiSelectModifier = Boolean(e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey);
if (isMultiSelectModifier && onToggleSelectId) {
  onToggleSelectId(id);
  return;
}
```

- [ ] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/magnifierAndHover.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/magnifierAndHover.ts src/components/CanvasEditor.tsx tests/magnifierAndHover.test.ts
git commit -m "feat(selection): incluir redacao na caixa de selecao e habilitar Ctrl/Cmd+Click"
```

---

### Task 2: Desseleção Padrão no Vazio e Prevenção de Criação Acidental de Texto (TDD)

**Files:**
- Create: `src/utils/canvasPointerActions.ts`
- Modify: `src/components/CanvasEditor.tsx:1474-1560`
- Test: `tests/canvasPointerActions.test.ts`

**Interfaces:**
- Produces: `shouldDeselectOnEmptyClick(hasSelection: boolean, isEditingText: boolean, isAltPressed: boolean): boolean`

- [ ] **Step 1: Escrever teste unitário falhando para `shouldDeselectOnEmptyClick`**

Criar `tests/canvasPointerActions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shouldDeselectOnEmptyClick } from '../src/utils/canvasPointerActions';

describe('Canvas Pointer Deselection Actions', () => {
  it('returns true when there is a selection or active text editing and Alt is not pressed', () => {
    expect(shouldDeselectOnEmptyClick(true, false, false)).toBe(true);
    expect(shouldDeselectOnEmptyClick(false, true, false)).toBe(true);
    expect(shouldDeselectOnEmptyClick(true, true, false)).toBe(true);
  });

  it('returns false when Alt is pressed even if there is an active selection', () => {
    expect(shouldDeselectOnEmptyClick(true, false, true)).toBe(false);
    expect(shouldDeselectOnEmptyClick(false, true, true)).toBe(false);
  });

  it('returns false when there is no selection and not editing', () => {
    expect(shouldDeselectOnEmptyClick(false, false, false)).toBe(false);
    expect(shouldDeselectOnEmptyClick(false, false, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/canvasPointerActions.test.ts`
Expected: FAIL com `shouldDeselectOnEmptyClick is not defined`

- [ ] **Step 3: Implementar `shouldDeselectOnEmptyClick` e integrar em `CanvasEditor.tsx`**

Criar `src/utils/canvasPointerActions.ts`:
```ts
/**
 * Determina se um clique no vazio do canvas deve apenas desselecionar/fechar edições existentes
 * em vez de criar um novo elemento.
 */
export function shouldDeselectOnEmptyClick(
  hasSelection: boolean,
  isEditingText: boolean,
  isAltPressed: boolean
): boolean {
  if (isAltPressed) return false;
  return hasSelection || isEditingText;
}
```

Em `src/components/CanvasEditor.tsx`, em `handleMouseDown`:
```ts
const isAltPressed = Boolean(e.evt?.altKey);
const hasActiveSelection = effectiveSelectedIds.length > 0;
const isEditingActive = editingText !== null;

if (shouldDeselectOnEmptyClick(hasActiveSelection, isEditingActive, isAltPressed)) {
  applySelectionIds([]);
  return;
}
```

- [ ] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/canvasPointerActions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/canvasPointerActions.ts src/components/CanvasEditor.tsx tests/canvasPointerActions.test.ts
git commit -m "feat(canvas): deselecionar ao clicar no vazio sem criar novo elemento acidental"
```

---

### Task 3: Criação Direta com `Alt` e Carimbo com Dimensões Padrão no Clique Simples (TDD)

**Files:**
- Modify: `src/utils/canvasPointerActions.ts`
- Modify: `src/components/CanvasEditor.tsx:1474-1980`
- Test: `tests/canvasPointerActions.test.ts`

**Interfaces:**
- Produces: `getDefaultShapeDimensions(tool: ToolType): { width: number; height: number; radiusX?: number; radiusY?: number } | null`
- Produces: Suporte no `handleMouseUp` em `CanvasEditor.tsx` para carimbar com tamanho padrão se `isAltPressed` e deslocamento $\le 4\text{px}$.

- [ ] **Step 1: Escrever teste unitário falhando para `getDefaultShapeDimensions`**

Em `tests/canvasPointerActions.test.ts`:
```ts
import { getDefaultShapeDimensions } from '../src/utils/canvasPointerActions';

describe('Default Shape Stamping Dimensions', () => {
  it('returns appropriate default dimensions for rect, ellipse, and redaction', () => {
    expect(getDefaultShapeDimensions('rect')).toEqual({ width: 120, height: 60 });
    expect(getDefaultShapeDimensions('ellipse')).toEqual({ radiusX: 35, radiusY: 25, width: 70, height: 50 });
    expect(getDefaultShapeDimensions('redaction')).toEqual({ width: 120, height: 40 });
  });

  it('returns null for tools that do not use default box dimensions', () => {
    expect(getDefaultShapeDimensions('select')).toBeNull();
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/canvasPointerActions.test.ts`
Expected: FAIL com `getDefaultShapeDimensions is not defined`

- [ ] **Step 3: Implementar `getDefaultShapeDimensions` e integrar carimbo no `handleMouseUp` de `CanvasEditor.tsx`**

Em `src/utils/canvasPointerActions.ts`:
```ts
export function getDefaultShapeDimensions(tool: string): { width: number; height: number; radiusX?: number; radiusY?: number } | null {
  if (tool === 'rect') return { width: 120, height: 60 };
  if (tool === 'ellipse') return { radiusX: 35, radiusY: 25, width: 70, height: 50 };
  if (tool === 'redaction') return { width: 120, height: 40 };
  return null;
}
```

Em `src/components/CanvasEditor.tsx`:
- Armazenar `isAltPressedRef = useRef(false)`.
- No `handleMouseDown`, registrar `isAltPressedRef.current = Boolean(e.evt?.altKey)`.
- Se `isAltPressedRef.current` estiver ativo e a ferramenta for de clique imediato (`text`, `magnifier sem foco`), cria imediatamente.
- No `handleMouseUp`, se `newAnnotation`:
  - Se $\text{deslocamento} \le 4\text{px}$ e `isAltPressedRef.current`:
    - Aplica as dimensões de `getDefaultShapeDimensions(activeTool)` centralizadas no ponto inicial.
    - Chama `onAddAnnotation` e seleciona o elemento carimbado.
  - Se $\text{deslocamento} > 4\text{px}$, mantém as dimensões arrastadas normalmente.

- [ ] **Step 4: Executar testes de `canvasPointerActions`**

Run: `cmd /c npx vitest run tests/canvasPointerActions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/canvasPointerActions.ts src/components/CanvasEditor.tsx tests/canvasPointerActions.test.ts
git commit -m "feat(canvas): suportar carimbo com Alt+Click em tamanho padrao e desenho livre com Alt+Drag"
```

---

### Task 4: Verificação Completa e Build de Produção

**Files:**
- Test: Todas as suítes de teste

- [ ] **Step 1: Executar suíte completa de testes**

Run: `cmd /c npx vitest run`
Expected: 267+ testes passando em 28 arquivos

- [ ] **Step 2: Executar verificação estrita de tipos TypeScript**

Run: `cmd /c npx tsc --noEmit`
Expected: 0 erros

- [ ] **Step 3: Executar build de produção**

Run: `cmd /c npm run build`
Expected: Build concluído com sucesso sem erros
