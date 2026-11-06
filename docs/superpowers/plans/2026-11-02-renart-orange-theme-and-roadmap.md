# RenArt Orange Theme & Roadmap Dark/Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implementar o módulo centralizado de tema `src/theme/colors.ts` aplicando o laranja terracota da raposa (`#d3551d`) na interface onde antes era usado o azul `#0071e3`, e documentar o suporte planejado a Tema Claro/Escuro no roadmap do `README.md`.

**Architecture:** Criar o módulo `src/theme/colors.ts` com as constantes cromáticas extraídas do mascote oficial, refatorar os componentes (`Toolbar.tsx`, `CanvasEditor.tsx`, `CaptureOverlay.tsx`, `GallerySidebar.tsx` e `App.tsx`) para consumir a paleta da marca, e atualizar a tabela de roadmap no `README.md`.

**Tech Stack:** React 19, TypeScript, Konva (react-konva), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-renart-orange-theme-and-roadmap-design.md`

## Global Constraints

- O tom primário da raposa é `#d3551d` (RGB `211, 85, 29`).
- O tom de hover é `#e66a2d`.
- O fundo translúcido para botões selecionados e bounding boxes é `rgba(211, 85, 29, 0.12)`.
- O fundo do item selecionado na galeria é `rgba(211, 85, 29, 0.08)`.
- Toda a suíte de testes (281+ testes), tipagem (`tsc --noEmit`) e build (`npm run build`) devem permanecer 100% íntegros.

## Review Focus

1. Visibilidade e contraste: O tom `#d3551d` e suas variantes devem manter legibilidade e nitidez tanto em caixas de seleção quanto em botões da barra.
2. Centralização de estilos: Nenhum componente deve manter `#0071e3` como cor de acento do sistema.
3. Preservação de comportamento no Canvas: As alças de rotação, seleção múltipla e anel da lupa devem continuar renderizando perfeitamente sem falhas de clique ou arraste.
4. Consistência do `README.md`: O roadmap deve catalogar Tema Claro e Escuro na Fase 2 sem quebrar o teste estrutural.
5. Zero regressões nos testes automatizados existentes.

---

### Task 1: Definir Módulo Central de Cores `src/theme/colors.ts` (TDD)

**Files:**
- Create: `src/theme/colors.ts`
- Test: `tests/themeColors.test.ts`

**Interfaces:**
- Produces: `RENART_THEME` contendo `primary`, `primaryHover`, `primaryTint`, `primaryBorder` e `galleryActiveBg`.

- [x] **Step 1: Escrever teste unitário falhando para o módulo de tema**

```ts
// tests/themeColors.test.ts
import { describe, it, expect } from 'vitest';
import { RENART_THEME } from '../src/theme/colors';

describe('RenArt Theme Colors', () => {
  it('exports expected fox orange palette values', () => {
    expect(RENART_THEME.primary).toBe('#d3551d');
    expect(RENART_THEME.primaryHover).toBe('#e66a2d');
    expect(RENART_THEME.primaryTint).toBe('rgba(211, 85, 29, 0.12)');
    expect(RENART_THEME.primaryBorder).toBe('rgba(211, 85, 29, 0.3)');
    expect(RENART_THEME.galleryActiveBg).toBe('rgba(211, 85, 29, 0.08)');
  });
});
```

- [x] **Step 2: Executar teste e verificar falha (RED)**

Run: `cmd /c npx vitest run tests/themeColors.test.ts`
Expected: FAIL (módulo `src/theme/colors.ts` não existe).

- [x] **Step 3: Implementar `src/theme/colors.ts` (GREEN)**

```ts
export const RENART_THEME = {
  primary: '#d3551d',
  primaryHover: '#e66a2d',
  primaryTint: 'rgba(211, 85, 29, 0.12)',
  primaryBorder: 'rgba(211, 85, 29, 0.3)',
  galleryActiveBg: 'rgba(211, 85, 29, 0.08)',
} as const;
```

- [x] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/themeColors.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/theme/colors.ts tests/themeColors.test.ts
git commit -m "feat(theme): adicionar modulo central de cores da raposa RenArt"
```

---

### Task 2: Aplicar o Tema Laranja nos Componentes da Interface (TDD)

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/CanvasEditor.tsx`
- Modify: `src/components/CaptureOverlay.tsx`
- Modify: `src/components/GallerySidebar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/toolbarAppIntegration.test.ts`

**Interfaces:**
- Consumes: `RENART_THEME` de `src/theme/colors.ts`.
- Produces: Interface visual completa com acentos laranja da raposa.

- [x] **Step 1: Atualizar asserções de estilo em testes se houver acoplamento com `#0071e3`**

Verificar arquivos de teste para garantir que testes que verificam cor de destaque esperem a nova paleta.

- [x] **Step 2: Atualizar `Toolbar.tsx`, `CanvasEditor.tsx`, `CaptureOverlay.tsx`, `GallerySidebar.tsx` e `App.tsx`**

Substituir o azul `#0071e3` e `rgba(0, 113, 227, ...)` por `RENART_THEME.primary` e variantes.

- [x] **Step 3: Executar testes unitários dos componentes**

Run: `cmd /c npx vitest run tests/toolbarAppIntegration.test.ts tests/galleryStore.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/Toolbar.tsx src/components/CanvasEditor.tsx src/components/CaptureOverlay.tsx src/components/GallerySidebar.tsx src/App.tsx
git commit -m "style(ui): aplicar paleta laranja da raposa RenArt na toolbar, canvas e galeria"
```

---

### Task 3: Atualizar Roadmap do `README.md` com Tema Claro e Escuro (TDD)

**Files:**
- Modify: `README.md`
- Test: `tests/readmeStructure.test.ts`

**Interfaces:**
- Produces: Documentação do Roadmap atualizada com Tema Claro/Escuro.

- [x] **Step 1: Atualizar teste unitário em `tests/readmeStructure.test.ts` com asserção do tema (RED)**

Adicionar asserção verificando que o README cita `Tema Claro e Escuro` no roadmap.

- [x] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/readmeStructure.test.ts`
Expected: FAIL.

- [x] **Step 3: Atualizar `README.md` com a entrada do roadmap (GREEN)**

Na tabela de Roadmap:
```markdown
| **Fase 2: Desktop Tauri v2 & Temas** | Atalhos globais de captura do SO, bandeja do sistema (Tray), janelas multi-monitores sem bordas e suporte a Tema Claro e Escuro (Light / Dark Mode) | 🔄 Em andamento |
```

- [x] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/readmeStructure.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add README.md tests/readmeStructure.test.ts
git commit -m "docs: adicionar tema claro e escuro no roadmap do README"
```

---

### Task 4: Verificação Completa e Build

- [x] **Step 1: Executar suíte completa de testes (`npx vitest run`)**
Expected: 100% dos testes aprovados (282 testes).

- [x] **Step 2: Executar verificação estrita de tipos TypeScript (`npx tsc --noEmit`)**
Expected: 0 erros.

- [x] **Step 3: Executar build de produção (`npm run build`)**
Expected: Build concluído com sucesso.
