# Windows Snipping Tool Floating Bar and Minimalist Capture Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Windows Snipping Tool style floating capture bar at the top of the capture overlay with mode switching (Area, Window, Fullscreen) and "X" cancel, plus a minimalist "Nova Captura" button with a right-aligned popover menu that never obscures the gallery.

**Architecture:** Extend `CaptureMode` with `'window'`, enhance `screenCaptureService.ts` to trigger native OS window selection via `displaySurface: 'window'`, add a right-aligned minimalist capture menu to `Toolbar.tsx`, create the floating acrylic bar in `CaptureOverlay.tsx` with active pills and cancel action, and coordinate state transitions in `App.tsx`.

**Tech Stack:** React 19, TypeScript, Vitest, Lucide Icons (`Crop`, `AppWindow`, `Monitor`, `X`, `ChevronDown`).

**Spec:** [`docs/superpowers/specs/2026-10-29-windows-snipping-floating-bar-design.md`](file:///C:/Code/ferramenta-captura/docs/superpowers/specs/2026-10-29-windows-snipping-floating-bar-design.md)

## Global Constraints

- Never overlap the left gallery with the capture menu: dropdown must open to the right of the button.
- Native OS window selection must be triggered when "Janela" mode is chosen.
- Fullscreen capture must immediately capture without requiring manual dragging.
- Floating bar must match the dark acrylic/glass styling of Windows 11 Fluent (`rgba(32, 33, 36, 0.92)`, blur `16px`).
- Cancel button ("X") and `Escape` key must cancel cleanly without creating blank items or dirtying state.
- All 136 existing tests must continue to pass; 0 TypeScript errors.

## Review Focus

1. User clicks "Janela" in the floating bar while inside the capture overlay: must switch mode and invoke native window picker without getting stuck.
2. User clicks "Tela Inteira" in the floating bar: must immediately complete full monitor capture and add to gallery.
3. User opens "Nova Captura" menu in Toolbar: menu must render to the right of the button, preserving gallery visibility.
4. User clicks "X" or presses `Escape`: overlay must close immediately, cleaning up pre-captured screen memory.
5. User clicks outside the Toolbar capture menu: menu must close cleanly with click-outside detection.

---

### Task 1: Capture Types and Screen Capture Service Window Mode

**Files:**
- Modify: `src/types/capture.ts`
- Modify: `src/services/screenCaptureService.ts`
- Test: `tests/appFeatures.test.ts`

**Interfaces:**
- Consumes: `displaySurface?: 'monitor' | 'window'`
- Produces: `CaptureMode = 'region' | 'freeform' | 'fullscreen' | 'window'` and `captureDesktopFrame(displaySurface?: 'monitor' | 'window'): Promise<string | null>`

- [ ] **Step 1: Write failing test in `tests/appFeatures.test.ts` for capture modes and window surface configuration**

```typescript
it('supports window and fullscreen capture modes with displaySurface constraints', async () => {
  // Test that CaptureMode supports 'window' and screenCaptureService prepares window surface constraint
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run tests/appFeatures.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `src/types/capture.ts` and `src/services/screenCaptureService.ts`**

Add `'window'` to `CaptureMode`:
```typescript
export type CaptureMode = 'region' | 'freeform' | 'fullscreen' | 'window';
```
Update `captureDesktopFrame(displaySurface: 'monitor' | 'window' = 'monitor')`:
Pass `displaySurface` to `getDisplayMedia` video constraints:
```typescript
video: { displaySurface } as MediaTrackConstraints
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run tests/appFeatures.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/capture.ts src/services/screenCaptureService.ts tests/appFeatures.test.ts
git commit -m "feat(capture): add window capture mode and displaySurface support in screenCaptureService"
```

---

### Task 2: Minimalist "Nova Captura" Button & Right-Aligned Menu in Toolbar

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Test: `tests/toolbarMenus.test.ts`

**Interfaces:**
- Consumes: `CaptureMode`, `OpenToolbarMenu`
- Produces: `onNewCapture(mode?: CaptureMode) => void`, `resolveActiveToolbarMenu(active, 'capture')`

- [ ] **Step 1: Write failing test in `tests/toolbarMenus.test.ts` for capture menu right-alignment and toggle**

```typescript
it('toggles capture menu open to the right and triggers onNewCapture with selected mode', () => {
  // Verify resolveActiveToolbarMenu toggles 'capture'
  // Verify capture menu metrics position it to the right of the button
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run tests/toolbarMenus.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement minimalist button & right-aligned capture dropdown in `src/components/Toolbar.tsx`**

1. Add `'capture'` to `OpenToolbarMenu`.
2. Style "Nova Captura" button with translucent backdrop, 1px subtle border, rounded-6px, chevron icon.
3. Position capture menu dropdown with `position: 'absolute'`, `left: '100%'`, `marginLeft: '8px'`, `top: 0`, ensuring it opens to the right into empty toolbar space rather than down over the left gallery.
4. Render 3 options:
   - 🔲 **Área Retangular** (`region`)
   - 🪟 **Janela** (`window`)
   - 🖥️ **Tela Inteira** (`fullscreen`)

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run tests/toolbarMenus.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx tests/toolbarMenus.test.ts
git commit -m "feat(toolbar): add minimalist capture button and right-aligned dropdown menu"
```

---

### Task 3: Floating Capture Bar in `CaptureOverlay.tsx` (Windows Snipping Tool Style)

**Files:**
- Modify: `src/components/CaptureOverlay.tsx`
- Test: `tests/appFeatures.test.ts`

**Interfaces:**
- Consumes: `mode: CaptureMode`, `onComplete: (...) => void`, `onCancel: () => void`
- Produces: `onSwitchMode?: (mode: CaptureMode) => void` in `CaptureOverlayProps`

- [ ] **Step 1: Write failing test in `tests/appFeatures.test.ts` for floating bar structure and actions**

```typescript
it('renders floating capture bar with Area, Window, Fullscreen and Cancel buttons', () => {
  // Verifies the floating bar actions and active mode pill highlighting
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run tests/appFeatures.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Floating Capture Bar in `src/components/CaptureOverlay.tsx`**

1. Render floating bar at `top: '20px'`, `left: '50%'`, `transform: 'translateX(-50%)'`, `zIndex: 10002`.
2. Style with dark acrylic blur (`rgba(32, 33, 36, 0.92)`, `backdropFilter: 'blur(16px)'`, border `1px solid rgba(255,255,255,0.12)`, radius `10px`).
3. Mode buttons:
   - Area (`region`): active pill style with subtle white/blue highlight when `mode === 'region'`.
   - Window (`window`): active pill style, calls `onSwitchMode?.('window')`.
   - Fullscreen (`fullscreen`): active pill style, calls `onSwitchMode?.('fullscreen')`.
   - Separator line (`1px solid rgba(255,255,255,0.15)`).
   - Cancel button ("X"): red hover effect, calls `onCancel()`.
4. Ensure mouse clicks inside the floating bar do not trigger region drag selection (`onMouseDown={(e) => e.stopPropagation()}`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run tests/appFeatures.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CaptureOverlay.tsx tests/appFeatures.test.ts
git commit -m "feat(overlay): add Windows Snipping Tool style floating capture bar"
```

---

### Task 4: State Coordination and Mode Execution in `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Consumes: `onStartCapture(mode: CaptureMode)`, `CaptureOverlay` with `onSwitchMode`
- Produces: Integrated capture workflow for region, window, and fullscreen.

- [ ] **Step 1: Write failing integration test in `tests/integration.test.ts`**

```typescript
it('integrates full capture workflow: toolbar menu selection, floating bar mode switching, and clean cancel', async () => {
  // Test switching between region, window, fullscreen and clean cancel
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run tests/integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Wire up capture handlers in `src/App.tsx`**

1. Update `handleStartCapture`:
   - If `mode === 'fullscreen'`: captures screen frame and directly calls `handleCaptureComplete('fullscreen')`.
   - If `mode === 'window'`: calls `captureDesktopFrame('window')` to prompt native window selector, then commits capture directly.
   - If `mode === 'region'`: calls `captureDesktopFrame('monitor')`, sets `preCapturedScreen`, and opens `CaptureOverlay`.
2. In `CaptureOverlay`:
   - Connect `onSwitchMode={(newMode) => handleSwitchCaptureMode(newMode)}`.
   - If user switches to `window` or `fullscreen` while in the overlay, trigger the respective capture immediately.
3. In `Toolbar`:
   - Connect `onNewCapture={(mode) => handleStartCapture(mode || 'region')}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run tests/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/integration.test.ts
git commit -m "feat(app): coordinate capture modes, floating bar switching, and native window capture"
```

---

### Task 5: Typecheck, Build, and Final Verification

**Files:**
- All touched files

- [ ] **Step 1: Run TypeScript typecheck**

Run: `cmd.exe /c npx tsc --noEmit`
Expected: Exit code 0, 0 errors.

- [ ] **Step 2: Run production build**

Run: `cmd.exe /c npm run build`
Expected: Exit code 0, build succeeds.

- [ ] **Step 3: Run full test suite**

Run: `cmd.exe /c npm test`
Expected: All tests pass (136+).

- [ ] **Step 4: Commit and finalize**

```bash
git commit --allow-empty -m "chore(verification): all tests passing and build verified for floating capture bar"
```
