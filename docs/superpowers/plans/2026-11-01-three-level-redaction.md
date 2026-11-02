# Plano de Implementação: Transição para 3 Níveis de Ocultação de Dados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplificar os níveis de privacidade para 3 (Nível 1: Rosto como padrão, Nível 2: Texto inalterado, Nível 3: Tarja Preta), eliminando o antigo desfoque pesado redundante e mantendo 100% dos testes e retrocompatibilidade íntegros.

**Architecture:** Atualização do enum/tipo `RedactionLevel = 1 | 2 | 3` na store e utilitários, remoção do canvas de 28px no `CanvasEditor.tsx`, atualização dos botões do submenu de censura na `Toolbar.tsx` com Nível 1 como default inicial.

**Tech Stack:** TypeScript, React, HTML5 Canvas, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-three-level-redaction-design.md`

## Global Constraints

- Nível 1 (Rosto, 8px com blindagem anti-IA) é o padrão inicial (`default: 1`).
- Nível 2 (Texto, 16px com blindagem anti-IA) permanece **100% inalterado**.
- Nível 3 é a Tarja Preta sólida (`#000000`, antigo nível 4).
- O antigo Nível 3 (28px blur) é apagado do código e da interface.
- Retrocompatibilidade estrita: anotações antigas com nível 4 ou blackout mapeiam para 3; nível 3 com blur mapeia para 2.
- 0 erros em `tsc --noEmit` e 100% dos testes passando.

## Review Focus

1. Alternância entre efeito `blackout` e `blur` atualiza o nível correto sem desincronizar store.
2. Anotações com antigo nível 4 são renderizadas como tarja preta sólida no canvas sem lançar erro.
3. Canvas economiza recursos renderizando apenas mapas de blur para 1 e 2.
4. Submenu flutuante da Toolbar exibe exatamente 3 níveis em ordem visual (Rosto, Texto, Tarja).
5. Ativação inicial da ferramenta de censura inicia destacada no Nível 1 (Rosto).

---

### Task 1: Modelo e Store para 3 Níveis (`src/utils/redaction.ts`, `src/state/editorStore.ts`)

**Files:**
- Modify: `src/utils/redaction.ts`
- Modify: `src/state/editorStore.ts`
- Test: `tests/redactionLevels.test.ts`
- Test: `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RedactionLevel = 1 | 2 | 3;
  export const REDACTION_BLUR_RADII: Record<1 | 2, number> = { 1: 8, 2: 16 };
  export const REDACTION_SCRAMBLE_CONFIG: Record<1 | 2, { blockSize: number; noiseIntensity: number }> = {
    1: { blockSize: 3, noiseIntensity: 6 },
    2: { blockSize: 5, noiseIntensity: 10 },
  };
  export function resolveRedactionLevel(ann?: any): RedactionLevel;
  ```

- [ ] **Step 1: Update failing tests in `tests/redactionLevels.test.ts`**
  - Alterar asserções para o modelo 1..3, default 1, e retrocompatibilidade de 4 para 3.
- [ ] **Step 2: Run test to verify it fails** (`npm test -- tests/redactionLevels.test.ts`)
- [ ] **Step 3: Update `src/utils/redaction.ts` and `src/state/editorStore.ts`**
  - Definir `RedactionLevel = 1 | 2 | 3`.
  - Definir `redactionLevel: 1` e `redactionEffect: 'blur'` por padrão na store.
  - Atualizar `resolveRedactionLevel`: 1 e 2 mantidos; 3 ou 4 com blackout -> 3; blur legado -> 2.
  - Ajustar `setRedactionLevel` e `setRedactionEffect` na store.
- [ ] **Step 4: Run test to verify it passes** (`npm test -- tests/redactionLevels.test.ts tests/editorStore.test.ts`)
- [ ] **Step 5: Commit Task 1**

---

### Task 2: Otimização dos Canvases de Fundo no CanvasEditor (`src/components/CanvasEditor.tsx`)

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/redactionTool.test.ts`

**Interfaces:**
- Consumes: `REDACTION_BLUR_RADII` e `REDACTION_SCRAMBLE_CONFIG` (chaves `1` e `2`)
- Produces: `blurredBgCanvases: { 1: HTMLCanvasElement | null, 2: HTMLCanvasElement | null }`

- [ ] **Step 1: Check existing assertions in `tests/redactionTool.test.ts`**
- [ ] **Step 2: Update `CanvasEditor.tsx`**
  - Remover chave `3` de `blurredBgCanvases`.
  - Atualizar referências onde `effectiveLevel as 1 | 2` busca o canvas de blur quando `effectiveLevel < 3`.
  - Nível 3 renderiza o retângulo/linha preta sólida diretamente sem consultar `blurredBgCanvases`.
- [ ] **Step 3: Run tests to verify pass** (`npm test -- tests/redactionTool.test.ts`)
- [ ] **Step 4: Commit Task 2**

---

### Task 3: Interface da Toolbar com 3 Níveis (`src/components/Toolbar.tsx`)

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Test: `tests/toolbarRedactionLevels.test.ts`

**Interfaces:**
- Produces: Menu de censura com 3 botões de nível: Rosto (Nível 1, default), Texto (Nível 2), Tarja Preta (Nível 3).

- [ ] **Step 1: Update failing tests in `tests/toolbarRedactionLevels.test.ts`**
  - Testar que a toolbar renderiza exatamente 3 botões de nível e o Nível 1 está selecionado por padrão.
- [ ] **Step 2: Run test to verify failure** (`npm test -- tests/toolbarRedactionLevels.test.ts`)
- [ ] **Step 3: Update `Toolbar.tsx`**
  - Remover o botão do antigo nível 3 (desfoque total).
  - Renomear o botão da Tarja Preta para acionar `onSelectRedactionLevel?.(3)`.
  - Definir `redactionLevel = 1` como prop default.
- [ ] **Step 4: Run test to verify pass** (`npm test -- tests/toolbarRedactionLevels.test.ts`)
- [ ] **Step 5: Commit Task 3**

---

### Task 4: Validação Geral e Build

**Files:**
- None (Validação em todo o projeto)

- [ ] **Step 1: Run full test suite** (`npm test`)
- [ ] **Step 2: Run TypeScript typecheck** (`tsc --noEmit`)
- [ ] **Step 3: Run production build** (`npm run build`)
- [ ] **Step 4: Final commit and summary**
