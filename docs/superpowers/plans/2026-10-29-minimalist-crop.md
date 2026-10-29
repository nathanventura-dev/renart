# Refinamento Minimalista da Ferramenta de Recorte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar visualmente a ferramenta de recorte para uma estética moderna, limpa e minimalista (estilo Apple/Figma), substituindo botões sólidos saturados por botões translúcidos com atalhos de teclado e eliminando a duplicidade de bordas no canvas através de cantos em "L" clássicos e grade suave de regra dos terços.

**Architecture:**
1. Utilitário geométrico puro `getCropVisualGuides` em `src/utils/zoomAndCrop.ts`, calculando as coordenadas dos cantos em "L", barras centrais de aresta e as 4 linhas da grade 3x3 de regra dos terços.
2. Refatoração dos botões de ação em `src/components/Toolbar.tsx` quando `isCropping === true`: substituição dos blocos saturados por botões sutis no estilo *translucent tinted pill* com indicadores visuais de atalho (`↵` Enter e `esc` Escape) e alta legibilidade.
3. Renderização no `src/components/CanvasEditor.tsx`: remoção do conflito de borda dupla no retângulo de corte, renderização da grade suave de terços e dos cantos em "L" fotográficos, além de harmonização com o Transformer.

**Tech Stack:** React 19, Konva / react-konva, TypeScript, Vitest, Lucide React.

**Spec:** `docs/superpowers/specs/2026-10-29-minimalist-crop-design.md`

## Global Constraints
- Sem bibliotecas externas adicionais.
- Preservar todas as 129 suítes de testes unitários e de integração passando.
- Mensagens de commit e documentação sempre em português.
- Manter o comportamento funcional intacto (atalhos Enter/Esc, dragging da caixa, resize pelas 8 alças do Transformer).

## Review Focus
- Botões de confirmação e cancelamento na Toolbar continuam com contraste suficiente e fácil identificação de clique.
- Atalhos `Enter` para confirmar e `Esc` para cancelar continuam funcionando sem regressão.
- O quadro de recorte no Canvas redimensiona e arrasta suavemente acompanhando a imagem em qualquer nível de zoom (25% a 400%).
- A grade de regra dos terços (3x3) não bloqueia cliques e mantém opacidade suave sem ofuscar a imagem de fundo.
- Caixas de corte muito pequenas (ex: 20x20px) não quebram os cantos em "L" (usando `Math.min(cornerSize, w/2, h/2)`).

---

### Task 1: Função Geométrica `getCropVisualGuides` e Testes Unitários

**Files:**
- Modify: `src/utils/zoomAndCrop.ts`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CropVisualGuides {
    corners: Array<{ name: string; points: number[] }>;
    edgeBars: Array<{ name: string; points: number[] }>;
    gridLines: Array<{ name: string; points: number[] }>;
  }

  export function getCropVisualGuides(
    cropBox: CropBox,
    cornerSize?: number,
    barSize?: number
  ): CropVisualGuides;
  ```

- [ ] **Step 1: Escrever testes unitários em `tests/zoomAndCrop.test.ts`**:
  - Testar quadro padrão `(100, 100, 300, 200)`:
    - 4 cantos em "L" com tamanho 14px em TL, TR, BL, BR.
    - 4 barras centrais de 12px nas 4 arestas.
    - 4 linhas da grade de terços (verticais em x=200 e x=300, horizontais em y=166.67 e y=233.33).
  - Testar quadro pequeno (20x20px): tamanho das alças não excede a metade das dimensões (`actualCorner = 10`).

- [ ] **Step 2: Executar testes para verificar falha (RED)**:
  - Comando: `npm.cmd test tests/zoomAndCrop.test.ts`
  - Esperado: FAIL com `getCropVisualGuides is not defined`.

- [ ] **Step 3: Implementar `getCropVisualGuides` em `src/utils/zoomAndCrop.ts`**:
  - Exportar interface `CropVisualGuides`.
  - Implementar o cálculo dos pontos de cantos, barras e linhas 3x3 com tratamento de limites mínimos.

- [ ] **Step 4: Executar testes para verificar aprovação (GREEN)**:
  - Comando: `npm.cmd test tests/zoomAndCrop.test.ts`
  - Esperado: PASS em todos os testes.

- [ ] **Step 5: Commit**:
  - `git add src/utils/zoomAndCrop.ts tests/zoomAndCrop.test.ts`
  - `git commit -m "feat(geometry): adicionar getCropVisualGuides para cantos e grade de terços do recorte"`

---

### Task 2: Refatoração Minimalista dos Botões de Ação na Toolbar

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Test: `tests/toolbarMenus.test.ts`

**Interfaces:**
- Consumes: `isCropping`, `onConfirmCrop`, `onCancelCrop` de `ToolbarProps`.

- [ ] **Step 1: Escrever teste em `tests/toolbarMenus.test.ts`**:
  - Renderizar `Toolbar` com `isCropping: true`.
  - Verificar que o container de ações de corte renderiza os botões com textos "Confirmar" e "Cancelar".
  - Verificar que os indicadores visuais de atalho `↵` e `esc` estão presentes.
  - Verificar que os botões possuem as classes/estilos de fundo translúcido semântico (`rgba(34, 197, 94, ...)` e `rgba(239, 68, 68, ...)`).

- [ ] **Step 2: Executar testes para verificar estado inicial**:
  - Comando: `npm.cmd test tests/toolbarMenus.test.ts`

- [ ] **Step 3: Implementar botões translúcidos em `src/components/Toolbar.tsx`**:
  - Refatorar o bloco `{isCropping && (...)}` no `Toolbar.tsx`.
  - Aplicar fundo translúcido verde (`rgba(34, 197, 94, 0.12)`) e borda suave no botão Confirmar.
  - Aplicar fundo translúcido neutro/vermelho (`rgba(239, 68, 68, 0.08)`) e borda suave no botão Cancelar.
  - Adicionar tags visuais de teclado `<kbd>↵</kbd>` e `<kbd>esc</kbd>`.
  - Manter tooltips e eventos `onClick={onConfirmCrop}` e `onClick={onCancelCrop}`.

- [ ] **Step 4: Executar testes para verificar aprovação**:
  - Comando: `npm.cmd test tests/toolbarMenus.test.ts`
  - Esperado: PASS.

- [ ] **Step 5: Commit**:
  - `git add src/components/Toolbar.tsx tests/toolbarMenus.test.ts`
  - `git commit -m "feat(toolbar): adotar botoes translucidos semanticos para confirmar e cancelar recorte"`

---

### Task 3: Renderização do Quadro Minimalista com Cantos e Grade no Canvas

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Consumes: `getCropVisualGuides` de `src/utils/zoomAndCrop.ts`.

- [ ] **Step 1: Escrever teste de integração em `tests/integration.test.ts`**:
  - Testar que as guias de corte se adaptam em sincronia com o estado `cropRect` e mantêm o fluxo de redimensionamento e confirmação intacto.

- [ ] **Step 2: Executar teste**:
  - Comando: `npm.cmd test tests/integration.test.ts`

- [ ] **Step 3: Implementar visual refinado em `src/components/CanvasEditor.tsx`**:
  - Importar `getCropVisualGuides`.
  - No `crop-overlay-group`:
    - Atualizar `#crop-box-rect` para uma borda única nítida `stroke="rgba(255, 255, 255, 0.9)"` com `strokeWidth={1.5}` e leve sombra.
    - Renderizar as 4 linhas da grade 3x3 de regra dos terços (`gridLines`) com `stroke="rgba(255, 255, 255, 0.22)"` e `strokeWidth={1}`.
    - Renderizar os 4 cantos em "L" (`corners`) com `stroke="#ffffff"`, `strokeWidth={3}` e leve sombra.
    - Renderizar as 4 barras centrais de aresta (`edgeBars`) com `stroke="#ffffff"`, `strokeWidth={3}`.
  - No `Transformer`:
    - Quando `activeTool === 'crop' || isCropping`, ajustar borda e alças para não conflitar com as linhas desenhadas (`borderStroke="transparent"`, alças transparentes/discretas sincronizadas).

- [ ] **Step 4: Executar suíte completa de testes**:
  - Comando: `npm.cmd test`
  - Esperado: PASS em todos os testes.

- [ ] **Step 5: Commit**:
  - `git add src/components/CanvasEditor.tsx tests/integration.test.ts`
  - `git commit -m "feat(canvas): renderizar quadro de recorte com cantos em L e grade de tercos"`

---

### Task 4: Verificação de Tipos, Build e Validação Final

- [ ] **Step 1: Executar checagem de tipos TypeScript**:
  - Comando: `npx.cmd tsc --noEmit`
  - Esperado: 0 erros.

- [ ] **Step 2: Executar build de produção Vite**:
  - Comando: `npm.cmd run build`
  - Esperado: Sucesso no build.

- [ ] **Step 3: Executar todos os testes do projeto**:
  - Comando: `npm.cmd test`
  - Esperado: 100% verde.

- [ ] **Step 4: Commit**:
  - `git commit --allow-empty -m "chore: validar refinamento minimalista da ferramenta de recorte"`
