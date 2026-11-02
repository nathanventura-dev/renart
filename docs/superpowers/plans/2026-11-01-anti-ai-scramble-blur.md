# Blindagem Anti-IA por Embaralhamento de Entropia (Níveis 1 e 2) - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o algoritmo de embaralhamento de pixels pré-desfoque (blindagem anti-IA) para os Níveis 1 e 2 de censura, garantindo aparência suave e destruição irreversível dos dados originais, e simplificar a interface removendo a complexidade experimental do OCR.

**Architecture:** Módulo puro `scrambleBlur.ts` com permutação de blocos e injeção de ruído não uniforme, integrado diretamente na geração dos canvases de desfoque `blurredBgCanvases[1]` e `blurredBgCanvases[2]` do `CanvasEditor.tsx`.

**Tech Stack:** TypeScript, React, HTML5 Canvas 2D (`ImageData`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-anti-ai-scramble-blur-design.md`

## Global Constraints

- 100% offline e sem dependências pesadas de IA/OCR para o fluxo de censura.
- Visual fosco idêntico a um desfoque estético suave a olho nu.
- Execução rápida (< 2ms) sem travar a navegação ou o canvas do Konva.
- Compatibilidade total com os modos Retângulo e Pincel de censura.

## Review Focus

1. Imagens com dimensões ímpares ou menores que o tamanho do bloco não podem gerar overflow de buffer.
2. O canal Alfa (transparência) dos pixels deve ser estritamente preservado.
3. Desfoque Nível 1 (8px) deve usar microblocos (3px); Nível 2 (16px) deve usar blocos médios (5px).
4. O modo Retângulo e o modo Pincel devem ler os mesmos canvases blindados automaticamente.
5. Todos os 20 arquivos de teste devem continuar verdes e `tsc --noEmit` sem erros.

---

### Task 1: Algoritmo de Embaralhamento de Entropia (`src/utils/scrambleBlur.ts`)

**Files:**
- Create: `src/utils/scrambleBlur.ts`
- Test: `tests/scrambleBlur.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function scramblePixelData(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    blockSize: number,
    noiseIntensity?: number
  ): Uint8ClampedArray;

  export function createAntiAiBlurredCanvas(
    source: HTMLImageElement | HTMLCanvasElement,
    blurRadius: number,
    blockSize: number,
    noiseIntensity?: number
  ): HTMLCanvasElement | null;
  ```

- [ ] **Step 1: Write the failing test in `tests/scrambleBlur.test.ts`**
- [ ] **Step 2: Run test to verify it fails** (`npm test -- tests/scrambleBlur.test.ts`)
- [ ] **Step 3: Implement `scramblePixelData` and `createAntiAiBlurredCanvas` in `src/utils/scrambleBlur.ts`**
- [ ] **Step 4: Run test to verify it passes** (`npm test -- tests/scrambleBlur.test.ts`)
- [ ] **Step 5: Commit**

---

### Task 2: Integração dos Canvases Blindados no CanvasEditor (`src/components/CanvasEditor.tsx`)

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/redactionLevels.test.ts`

**Interfaces:**
- Consumes: `createAntiAiBlurredCanvas` from `src/utils/scrambleBlur.ts`
- Produces: `blurredBgCanvases[1]` (blur 8px + bloco 3px) e `blurredBgCanvases[2]` (blur 16px + bloco 5px)

- [ ] **Step 1: Update `tests/redactionLevels.test.ts` with assertions for anti-AI blur calibration**
- [ ] **Step 2: Run test to verify failures or regressions**
- [ ] **Step 3: Connect `createAntiAiBlurredCanvas` to `blurredBgCanvases` in `CanvasEditor.tsx`**
- [ ] **Step 4: Run tests to verify pass** (`npm test -- tests/redactionLevels.test.ts`)
- [ ] **Step 5: Commit**

---

### Task 3: Simplificação e Limpeza da Interface de Censura (`Toolbar.tsx`, `editorStore.ts`)

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/state/editorStore.ts`
- Modify: `tests/toolbarMenus.test.ts`
- Modify: `tests/toolbarSmartText.test.ts`
- Modify: `package.json`

**Interfaces:**
- Redaction modes restaurados aos 2 modos oficiais: `'rect'` e `'brush'`.
- Remoção de `tesseract.js` das dependências principais.

- [ ] **Step 1: Update toolbar and store tests for clean redaction UI**
- [ ] **Step 2: Remove `smart-text` button and `Sortear` button from `Toolbar.tsx`**
- [ ] **Step 3: Uninstall `tesseract.js` from `package.json`**
- [ ] **Step 4: Run tests to verify pass** (`npm test`)
- [ ] **Step 5: Commit**

---

### Task 4: Verificação Completa e Build

**Files:**
- None (Validação geral)

- [ ] **Step 1: Run full test suite** (`npm test`)
- [ ] **Step 2: Run TypeScript typecheck** (`npx tsc --noEmit`)
- [ ] **Step 3: Run production build** (`npm run build`)
- [ ] **Step 4: Final commit and summary**
