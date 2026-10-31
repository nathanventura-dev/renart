# Smart Text Anonymization (OCR Contextual Synthetic Text) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to anonymize sensitive text in screenshots by replacing detected text with realistic, contextually matched synthetic text (values, dates, emails, words) maintaining visual layout aesthetics.

**Architecture:** A native Windows OCR engine (`Windows.Media.Ocr`) via Tauri/Rust extracts bounding boxes and text from a selected image region. A contextual anonymization engine classifies each word and generates random replacement tokens matching the original length, casing, and pattern type. Konva renders an inpainting background box and aligned synthetic text with full transform handles and regeneration support.

**Tech Stack:** Rust (Tauri 2, Windows WinRT OCR), React 19, TypeScript, Konva (react-konva), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-smart-text-anonymization-design.md`

## Global Constraints

- 100% offline execution; zero external network requests for text detection.
- Windows OCR uses `Windows.Media.Ocr` with 0 MB bundle overhead.
- Non-destructive canvas rendering with complete background inpainting (erasing 100% of original pixels under synthetic text).
- Seamless undo/redo and full 4-corner transformation support (drag, resize, rotate).
- Zero TypeScript errors (`tsc --noEmit`), 100% test pass rate with Vitest, clean production build (`npm run build`).

## Review Focus

- Empty OCR response: when an area contains no readable text, gracefully fallback to inpainting box or standard redaction without crashing.
- Multi-line text wrapping: synthetic lines must not overflow bounding box width or bleed outside image boundaries.
- Font sizing & line-height: text size must adapt proportionally to OCR line height for natural appearance.
- Edge cropping: color sampling must not sample coordinates outside the image dimensions.
- Randomization collision: re-generating text must produce varied tokens differing from the immediate prior output.

---

### Task 1: Contextual Synthetic Text Engine (`src/utils/textAnonymizer.ts`)

**Files:**
- Create: `src/utils/textAnonymizer.ts`
- Test: `tests/textAnonymizer.test.ts`

**Interfaces:**
- Consumes: None (pure utility).
- Produces:
  ```ts
  export type TokenType = 'currency' | 'date' | 'email' | 'digits' | 'word';
  export interface OcrWord { text: string; x: number; y: number; width: number; height: number; }
  export interface OcrLine { text: string; words: OcrWord[]; x: number; y: number; width: number; height: number; }
  export interface AnonymizedWord extends OcrWord { originalText: string; replacementText: string; tokenType: TokenType; }
  export interface AnonymizedLine extends OcrLine { words: AnonymizedWord[]; replacementText: string; }
  export function classifyTokenType(text: string): TokenType;
  export function anonymizeWord(text: string): string;
  export function anonymizeOcrLines(lines: OcrLine[]): AnonymizedLine[];
  ```

- [ ] **Step 1: Write failing tests in `tests/textAnonymizer.test.ts`**
  Assert classification and random generation for currency (`R$ 1.500,00`), dates (`15/08/2024`), emails (`user@empresa.com`), masked digits (`123.456.789-00`), and regular words preserving length and case.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm.cmd test -- tests/textAnonymizer.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/utils/textAnonymizer.ts`**
  Implement regex pattern matchers for currency, dates, emails, and numeric masks, plus randomized dictionary generation for prosaic words with matching capitalization.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm.cmd test -- tests/textAnonymizer.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/utils/textAnonymizer.ts tests/textAnonymizer.test.ts
  git commit -m "feat(anonymizer): implement contextual synthetic text generator"
  ```

---

### Task 2: Native OCR Command in Rust / Tauri (`src-tauri/src/ocr.rs`, `src-tauri/src/lib.rs`)

**Files:**
- Create: `src-tauri/src/ocr.rs`
- Modify: `src-tauri/src/lib.rs:1-16`
- Modify: `src-tauri/Cargo.toml:15-28`

**Interfaces:**
- Consumes: Image base64 string and region coordinates `(x, y, width, height)`.
- Produces:
  ```rust
  #[derive(Serialize, Deserialize, Clone, Debug)]
  pub struct OcrWordDto { pub text: String, pub x: f64, pub y: f64, pub width: f64, pub height: f64 }
  #[derive(Serialize, Deserialize, Clone, Debug)]
  pub struct OcrLineDto { pub text: String, pub words: Vec<OcrWordDto>, pub x: f64, pub y: f64, pub width: f64, pub height: f64 }
  #[tauri::command]
  pub async fn detect_text_in_region(image_base64: String, x: u32, y: u32, width: u32, height: u32) -> Result<Vec<OcrLineDto>, String>;
  ```

- [ ] **Step 1: Add Windows OCR dependencies in `src-tauri/Cargo.toml`**
  Add Windows Media OCR feature flags under `[target.'cfg(windows)'.dependencies]`.

- [ ] **Step 2: Implement `src-tauri/src/ocr.rs`**
  Implement image crop and decoding from base64, call `OcrEngine` on Windows to get lines and words with relative coordinates, and provide fallback stub for non-windows platforms.

- [ ] **Step 3: Register `detect_text_in_region` in `src-tauri/src/lib.rs`**
  Add `pub mod ocr;` and register command in `tauri::generate_handler!`.

- [ ] **Step 4: Verify Rust compilation**
  Run: `cargo check --manifest-path src-tauri/Cargo.toml`
  Expected: Success with 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add src-tauri/
  git commit -m "feat(ocr): implement native Windows Media OCR command in Tauri"
  ```

---

### Task 3: OCR Client Service with Browser Fallback (`src/services/ocrService.ts`)

**Files:**
- Create: `src/services/ocrService.ts`
- Test: `tests/ocrService.test.ts`

**Interfaces:**
- Consumes: Tauri `invoke` or browser mock provider.
- Produces:
  ```ts
  export async function detectTextInImageRegion(
    imageBase64: string,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<OcrLine[]>;
  ```

- [ ] **Step 1: Write failing test in `tests/ocrService.test.ts`**
  Test mock execution in node/browser environment returns valid lines structure and handles empty/error cases safely.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm.cmd test -- tests/ocrService.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `src/services/ocrService.ts`**
  Check for Tauri runtime (`window.__TAURI_INTERNALS__`). If present, call `invoke('detect_text_in_region', ...)`; otherwise execute development fallback provider.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm.cmd test -- tests/ocrService.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/services/ocrService.ts tests/ocrService.test.ts
  git commit -m "feat(services): add ocr service with Tauri invoke and dev fallback"
  ```

---

### Task 4: Inpainting Color Sampler (`src/utils/colorSampling.ts`)

**Files:**
- Create: `src/utils/colorSampling.ts`
- Test: `tests/colorSampling.test.ts`

**Interfaces:**
- Consumes: Canvas/Image element and crop coordinates.
- Produces:
  ```ts
  export interface SampledColors { bgColor: string; textColor: string; }
  export function sampleRegionColors(
    canvasOrImage: HTMLCanvasElement | HTMLImageElement,
    crop: { x: number; y: number; width: number; height: number }
  ): SampledColors;
  ```

- [ ] **Step 1: Write failing test in `tests/colorSampling.test.ts`**
  Test sampling corners of a mock canvas to resolve dominant background hex and contrasting text color.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm.cmd test -- tests/colorSampling.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `src/utils/colorSampling.ts`**
  Sample corner pixels to compute average RGB for `bgColor`, and calculate luminance contrast to pick optimal `textColor` (e.g. `#1e293b` on light backgrounds, `#f8fafc` on dark).

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm.cmd test -- tests/colorSampling.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/utils/colorSampling.ts tests/colorSampling.test.ts
  git commit -m "feat(color): implement background and text color sampling for inpainting"
  ```

---

### Task 5: Editor Store Model & Smart Text Support (`src/state/editorStore.ts`)

**Files:**
- Modify: `src/state/editorStore.ts`
- Test: `tests/smartTextStore.test.ts`

**Interfaces:**
- Consumes: `AnonymizedLine` from `textAnonymizer.ts`.
- Produces:
  ```ts
  export type RedactionMode = 'rect' | 'brush' | 'smart-text';
  export interface SmartTextAnnotation extends BaseAnnotation {
    type: 'redaction';
    mode: 'smart-text';
    x: number;
    y: number;
    width: number;
    height: number;
    bgColor: string;
    textColor: string;
    lines: AnonymizedLine[];
  }
  // Store action:
  regenerateSmartText: (id: string) => void;
  ```

- [ ] **Step 1: Write failing test in `tests/smartTextStore.test.ts`**
  Test creating redaction with mode `'smart-text'`, verifying lines structure, undo/redo, and calling `regenerateSmartText(id)` to update lines with new random words.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm.cmd test -- tests/smartTextStore.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Update `src/state/editorStore.ts`**
  Expand `RedactionMode` to include `'smart-text'`, add fields to `RedactionAnnotation`, and implement `regenerateSmartText(id)` action with undo snapshot.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm.cmd test -- tests/smartTextStore.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/state/editorStore.ts tests/smartTextStore.test.ts
  git commit -m "feat(store): add smart-text redaction mode and regeneration action"
  ```

---

### Task 6: Canvas Inpainting & Text Rendering (`src/components/CanvasEditor.tsx`)

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/canvasSmartText.test.ts`

**Interfaces:**
- Consumes: `SmartTextAnnotation`, `detectTextInImageRegion`, `sampleRegionColors`, `anonymizeOcrLines`.
- Produces:
  - Interactive Konva rendering of `smart-text` redactions with solid inpainting background and proportional `<Text>` elements.
  - Automatic OCR execution on drag-end in `'smart-text'` mode.
  - Support for 4-corner resizing, dragging, and rotating.

- [ ] **Step 1: Write failing test in `tests/canvasSmartText.test.ts`**
  Test helper that transforms OCR lines into canvas text elements with proper scaling and offset.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm.cmd test -- tests/canvasSmartText.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Update `src/components/CanvasEditor.tsx`**
  - When dragging finishes with `redactionMode === 'smart-text'`: sample colors, run OCR asynchronously on crop, anonymize lines, and add annotation to store.
  - In rendering loop: render `smart-text` redaction as a solid rect (`fill={ann.bgColor}`) containing styled Konva `<Text>` nodes for each synthetic line.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm.cmd test -- tests/canvasSmartText.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/CanvasEditor.tsx tests/canvasSmartText.test.ts
  git commit -m "feat(canvas): render smart-text inpainting and synthetic lines"
  ```

---

### Task 7: Toolbar UI Integration & Regeneration Button (`src/components/Toolbar.tsx`, `src/App.tsx`)

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/toolbarSmartText.test.ts`

**Interfaces:**
- Consumes: `redactionMode: 'smart-text'`, `editorStore.regenerateSmartText`.
- Produces:
  - `Texto Inteligente` button in Toolbar redaction submenu (`Sparkles` icon).
  - `Sortear Novamente` button (`RefreshCw` icon) visible when a `smart-text` annotation is selected.

- [ ] **Step 1: Write failing test in `tests/toolbarSmartText.test.ts`**
  Assert Toolbar renders the `smart-text` button, highlights it when active, and renders "Sortear Novamente" when a smart-text annotation is selected.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm.cmd test -- tests/toolbarSmartText.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Update `src/components/Toolbar.tsx` and `src/App.tsx`**
  Add mode button to horizontal menu, add regenerate button when `selectedRedaction?.mode === 'smart-text'`, and wire `onRegenerateSmartText` to `editorStore.regenerateSmartText`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm.cmd test -- tests/toolbarSmartText.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/Toolbar.tsx src/App.tsx tests/toolbarSmartText.test.ts
  git commit -m "feat(ui): add smart-text mode and regenerate button to toolbar"
  ```

---

### Task 8: Full Verification & Build Validation

**Files:**
- Verification only.

- [ ] **Step 1: Run full test suite**
  Run: `npm.cmd test`
  Expected: All tests passing across all test files.

- [ ] **Step 2: Run TypeScript typecheck**
  Run: `npx.cmd tsc --noEmit`
  Expected: 0 errors.

- [ ] **Step 3: Run production build**
  Run: `npm.cmd run build`
  Expected: Vite build succeeds in < 10s.

- [ ] **Step 4: Final commit and summary**
  ```bash
  git commit --allow-empty -m "chore: complete smart text anonymization implementation"
  ```
