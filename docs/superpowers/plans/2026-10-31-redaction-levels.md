# Redaction and Blur Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified 4-level privacy scale (Level 1: 8px soft blur, Level 2: 18px text blur, Level 3: 32px blind blur, Level 4: 100% solid blackout) with intuitive icons, replace the tool icon with `EyeOff`, enable real-time level switching on selected annotations, and streamline brush strokes to be undo-driven.

**Architecture:** Replace the binary `effect` with `level: 1 | 2 | 3 | 4` in `RedactionAnnotation` and `editorStore`, maintaining backward compatibility with legacy `effect`. Memoize 3 calibrated blur canvases (8px, 18px, 32px) in `CanvasEditor` alongside the solid black fill for level 4. Update `Toolbar` to display `EyeOff` as the main tool icon and render 4 level icons (`Smile`, `Type`, `EyeClosed`, `Square`) inside the floating menu.

**Tech Stack:** React 19, TypeScript, Konva / react-konva, Lucide React (`EyeOff`, `Smile`, `Type`, `EyeClosed`, `Square`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-redaction-levels-design.md`

## Global Constraints

- Windows environment: PowerShell commands, CRLF line endings.
- Strict TDD: failing tests before code, minimal code to pass, refactor.
- 100% backward compatible: legacy annotations with `effect: 'blackout'` become level 4; `effect: 'blur'` become level 3.
- All 154 existing tests must remain passing; zero TypeScript errors (`tsc --noEmit`); build must pass.

## Review Focus

1. **Legacy annotation fallback:** Annotations missing `level` but having `effect: 'blur'` or `'blackout'` must resolve cleanly without crashing.
2. **Brush selection isolation:** Freehand brush redactions must have `listening={false}` and never attach transformer or 4-corner controls, relying on Undo/Redo.
3. **Selected annotation sync:** When a rect annotation is currently selected, clicking any of the 4 level icons must update the selected annotation's `level` immediately.
4. **Blur canvas failure resilience:** If `ctx.filter` or canvas creation fails on an edge-case browser, graceful fallback to a dark tint must prevent white screens.
5. **Crop and Shift-snap preservation:** Redaction boxes must continue resizing and cropping accurately regardless of whether level is 1, 2, 3, or 4.

---

### Task 1: Privacy Levels Data Model & Editor Store

**Files:**
- Modify: `src/utils/redaction.ts`
- Modify: `src/state/editorStore.ts`
- Test: `src/utils/__tests__/redactionLevels.test.ts`

**Interfaces:**
- Consumes: `RedactionEffect`, `RedactionMode` from `src/state/editorStore.ts`
- Produces: `RedactionLevel` (`1 | 2 | 3 | 4`), `REDACTION_BLUR_RADII`, `resolveRedactionLevel`, `setRedactionLevel` in `editorStore`

- [ ] **Step 1: Write failing tests for redaction level resolution and store updates**

```typescript
// src/utils/__tests__/redactionLevels.test.ts
import { describe, it, expect } from 'vitest';
import {
  resolveRedactionLevel,
  createRedactionRect,
  createRedactionBrush,
  REDACTION_BLUR_RADII,
} from '../redaction';
import { useEditorStore } from '../../state/editorStore';

describe('Redaction Levels Model', () => {
  it('maps levels 1, 2, 3, 4 directly', () => {
    expect(resolveRedactionLevel({ level: 1 })).toBe(1);
    expect(resolveRedactionLevel({ level: 2 })).toBe(2);
    expect(resolveRedactionLevel({ level: 3 })).toBe(3);
    expect(resolveRedactionLevel({ level: 4 })).toBe(4);
  });

  it('provides backward compatibility for legacy effect property', () => {
    expect(resolveRedactionLevel({ effect: 'blur' })).toBe(3);
    expect(resolveRedactionLevel({ effect: 'blackout' })).toBe(4);
    expect(resolveRedactionLevel({})).toBe(4);
  });

  it('defines correct blur radii', () => {
    expect(REDACTION_BLUR_RADII[1]).toBe(8);
    expect(REDACTION_BLUR_RADII[2]).toBe(18);
    expect(REDACTION_BLUR_RADII[3]).toBe(32);
  });

  it('updates selected annotation level when setRedactionLevel is called', () => {
    const store = useEditorStore.getState();
    const ann = createRedactionRect(10, 10, 50, 50, 4, 'test-redact');
    store.addAnnotation(ann);
    store.setSelectedAnnotationIds(['test-redact']);

    store.setRedactionLevel(2);
    const updated = useEditorStore.getState().annotations.find((a) => a.id === 'test-redact');
    expect(updated?.level).toBe(2);
    expect(useEditorStore.getState().redactionLevel).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm.cmd test src/utils/__tests__/redactionLevels.test.ts`
Expected: FAIL with missing exports / types.

- [ ] **Step 3: Implement `RedactionLevel`, `REDACTION_BLUR_RADII`, `resolveRedactionLevel`, and store updates**

In `src/utils/redaction.ts` and `src/state/editorStore.ts`:
- Export `type RedactionLevel = 1 | 2 | 3 | 4`.
- Export `const REDACTION_BLUR_RADII: Record<1 | 2 | 3, number> = { 1: 8, 2: 18, 3: 32 }`.
- Export `function resolveRedactionLevel(ann?: Partial<RedactionAnnotation>): RedactionLevel`.
- Update `RedactionAnnotation` to have `level: RedactionLevel`.
- Add `redactionLevel: RedactionLevel` (default: 4) to `EditorState`.
- Add `setRedactionLevel: (level: RedactionLevel) => void` in `editorStore.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test src/utils/__tests__/redactionLevels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/redaction.ts src/state/editorStore.ts src/utils/__tests__/redactionLevels.test.ts
git commit -m "feat(store): add 4-level privacy model and resolution helpers"
```

---

### Task 2: Toolbar UI with Recognizable Icons & Real-time Level Switching

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/__tests__/ToolbarRedactionLevels.test.tsx`

**Interfaces:**
- Consumes: `RedactionLevel`, `setRedactionLevel` from Task 1
- Produces: Updated Toolbar UI with `EyeOff` tool button and 4 level buttons (`Smile`, `Type`, `EyeClosed`, `Square`)

- [ ] **Step 1: Write failing test for Toolbar redaction controls**

```tsx
// src/components/__tests__/ToolbarRedactionLevels.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Toolbar, resolveRedactionToolbarState } from '../Toolbar';

describe('Toolbar Redaction Levels', () => {
  it('resolves effectiveRedactionLevel from selected annotation', () => {
    const selected = [{ id: '1', type: 'redaction', level: 2, mode: 'rect' } as any];
    const state = resolveRedactionToolbarState('select', selected, 4, 'rect');
    expect(state.effectiveRedactionLevel).toBe(2);
  });

  it('renders EyeOff as the main tool icon and 4 level buttons in submenu', () => {
    const onSelectLevel = vi.fn();
    render(
      <Toolbar
        activeTool="redaction"
        openMenu="redaction"
        redactionLevel={3}
        onSelectRedactionLevel={onSelectLevel}
        onSelectTool={() => {}}
        onToggleMenu={() => {}}
      />
    );

    const level1Btn = screen.getByTitle(/Nível 1/i);
    const level2Btn = screen.getByTitle(/Nível 2/i);
    const level3Btn = screen.getByTitle(/Nível 3/i);
    const level4Btn = screen.getByTitle(/Nível 4/i);

    expect(level1Btn).toBeDefined();
    expect(level2Btn).toBeDefined();
    expect(level3Btn).toBeDefined();
    expect(level4Btn).toBeDefined();

    fireEvent.click(level1Btn);
    expect(onSelectLevel).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm.cmd test src/components/__tests__/ToolbarRedactionLevels.test.tsx`
Expected: FAIL with missing props/elements.

- [ ] **Step 3: Update `Toolbar.tsx` and `App.tsx`**

- In `Toolbar.tsx`:
  - Import `EyeOff`, `EyeClosed`, `Smile`, `Type`, `Square` from `lucide-react`.
  - Replace `<ShieldAlert size={16} />` with `<EyeOff size={16} />` on the main tool button.
  - In `HorizontalFloatingMenu`, replace "Tarja" and "Blur" with 4 level buttons:
    - Level 1: `<Smile size={15} />` (Title: "Nível 1: Desfoque suave para rostos e fundos")
    - Level 2: `<Type size={15} style={{ opacity: 0.5 }} />` (Title: "Nível 2: Desfoque moderado para texto")
    - Level 3: `<EyeClosed size={15} />` (Title: "Nível 3: Desfoque total sem visibilidade")
    - Level 4: `<Square size={15} fill="currentColor" />` (Title: "Nível 4: Tarja preta 100% sólida (Inviolável)")
  - Highlight active level with `#0071e3` background and white icon.
  - Retain `Retângulo` and `Pincel` mode buttons after divider.
- In `App.tsx`:
  - Connect `redactionLevel={editorState.redactionLevel}` and `onSelectRedactionLevel={(lvl) => editorStore.setRedactionLevel(lvl)}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test src/components/__tests__/ToolbarRedactionLevels.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/App.tsx src/components/__tests__/ToolbarRedactionLevels.test.tsx
git commit -m "feat(ui): update tool icon to EyeOff and add 4-level privacy buttons in toolbar"
```

---

### Task 3: Canvas Rendering with Multi-Radius Blur and Streamlined Brush

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `src/utils/zoomAndCrop.ts`

**Interfaces:**
- Consumes: `RedactionLevel`, `REDACTION_BLUR_RADII`, `resolveRedactionLevel`
- Produces: Real-time rendering of rect & brush with levels 1, 2, 3 (blurred canvases) and 4 (solid black), with brush set to `listening={false}`

- [ ] **Step 1: Write integration test for canvas redaction level rendering**

Verify in existing or new test that `createRedactionRect` with levels 1-4 clamps bounds and passes to stage without errors, and that brush redactions with levels 1-4 are created correctly.

- [ ] **Step 2: Run test to verify baseline**

Run: `npm.cmd test`
Expected: All tests pass.

- [ ] **Step 3: Update `CanvasEditor.tsx`**

- In `CanvasEditor.tsx`:
  - Accept `redactionLevel?: RedactionLevel` prop (default: 4).
  - Create `blurredBgCanvases` memoized map for levels 1, 2, 3:
    - Radius 8px for Level 1
    - Radius 18px for Level 2
    - Radius 32px for Level 3
  - In Rect rendering (`ann.type === 'redaction' && ann.mode === 'rect'`):
    - Determine `effectiveLevel = resolveRedactionLevel(ann)`.
    - If `effectiveLevel === 4`: render `<Rect fill="#000000" ... />`.
    - If `effectiveLevel` is 1, 2, or 3: render `<Group clip...><Image image={blurredBgCanvases[effectiveLevel]} /><Rect fill="rgba(0,0,0,0.001)" /></Group>`.
  - In Brush rendering (`ann.type === 'redaction' && ann.mode === 'brush'`):
    - Set `listening={false}` on the brush group/shape so it never intercepts mouse clicks or selects.
    - If `effectiveLevel === 4`: render `<Line points={ann.points} stroke="#000000" strokeWidth={ann.brushSize} lineCap="round" lineJoin="round" listening={false} />`.
    - If `effectiveLevel` is 1, 2, or 3: render `<Shape listening={false} sceneFunc={(ctx, shape) => { const pat = ctx.createPattern(blurredBgCanvases[effectiveLevel], 'no-repeat'); ... }} />`.
  - In mouse handlers (`handleMouseDown`, `handleMouseMove`):
    - When creating new rect or brush, pass `redactionLevel` to `createRedactionRect` / `createRedactionBrush`.
  - In `adjustAnnotationsForCrop`:
    - Ensure `level` is preserved during crop transforms.

- [ ] **Step 4: Run full test suite & TypeScript check**

Run: `npm.cmd test && npx.cmd tsc --noEmit`
Expected: 100% PASS, zero TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasEditor.tsx src/utils/zoomAndCrop.ts
git commit -m "feat(canvas): render 3 calibrated blur radii and solid blackout with streamlined brush"
```

---

### Task 4: Full Verification & Build Validation

**Files:**
- Test: All tests across the project
- Build: Vite production build

- [ ] **Step 1: Run complete test suite**

Run: `npm.cmd test`
Expected: All tests passing (155+ tests).

- [ ] **Step 2: Run TypeScript typecheck**

Run: `npx.cmd tsc --noEmit`
Expected: 0 errors, exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`
Expected: Build successfully finishes with bundle assets in `dist/`.

- [ ] **Step 4: Commit any remaining refinements and update task artifact**

```bash
git commit -m "chore: verify full test suite and production build for redaction levels"
```
