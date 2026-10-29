# Flecha Fina com Ponta Aberta em Chevron (Estilo Ícone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o layout visual da flecha fina com ponta aberta em formato de chevron 45° idêntica ao ícone SVG da barra de ferramentas (`ArrowRight`), mantendo o comportamento de 2 âncoras de ajuste, snapping com Shift e manipulação idêntica à flecha padrão.

**Architecture:** 
1. Criação da função pura `getOpenChevronArrowPoints` em `src/utils/zoomAndCrop.ts`, que calcula com precisão trigonométrica as coordenadas da haste e das duas abas do chevron em ângulo de 45° relativo à inclinação da linha, com comprimento proporcional ao `strokeWidth`.
2. Integração no `src/components/CanvasEditor.tsx`:
   - Quando `ann.arrowStyle === 'thin'`, renderizar um `<Group>` contendo a haste `<Line>` e a ponta chevron `<Line lineCap="round" lineJoin="round">` em vez do `<Arrow>` padrão com triângulo sólido.
   - Suporte idêntico durante o desenho interativo em tempo real com arraste do mouse e no ajuste de 2 âncoras de extremidade.
3. Testes unitários puros para cobrir todos os quadrantes angulares (horizontal direita/esquerda, vertical cima/baixo e diagonais) e testes de integração com seleção e Undo/Redo.

**Tech Stack:** React 19, Konva / react-konva, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-thin-arrow-open-chevron-design.md`

## Global Constraints
- Sem bibliotecas externas adicionais.
- Preservar todas as 127 suítes de testes unitários e de integração passando.
- Mensagens de commit e documentação sempre em português.
- Apenas a variante `thin` tem o visual em chevron; as variantes `standard`, `dashed` e `curved` continuam inalteradas.

## Review Focus
- Flecha horizontal para a direita (`x1 < x2, y1 === y2`): chevron abre simetricamente para cima e para baixo em 45°.
- Flecha apontando em qualquer direção (360°): as abas do chevron giram junto sem distorção.
- Arrastar as 2 âncoras de extremidade atualiza o chevron perfeitamente em tempo real.
- Pressionar Shift ao desenhar trava a flecha fina na horizontal, vertical ou 45° com chevron alinhado.
- Clicar sobre o corpo ou sobre o chevron da flecha fina seleciona o elemento normalmente (*hit testing*).

---

### Task 1: Função Geométrica `getOpenChevronArrowPoints` e Testes Unitários

**Files:**
- Modify: `src/utils/zoomAndCrop.ts`
- Test: `tests/zoomAndCrop.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface OpenChevronPoints {
    shaftPoints: [number, number, number, number];
    chevronPoints: [number, number, number, number, number, number];
  }

  export function getOpenChevronArrowPoints(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeWidth?: number
  ): OpenChevronPoints;
  ```

- [ ] **Step 1: Escrever testes unitários que falham em `tests/zoomAndCrop.test.ts`**:
  - Testar flecha horizontal para a direita: `(0, 0) -> (100, 0)` gera ponta em `(100, 0)`, aba superior em `(100 - L*cos(45°), -L*sin(45°))` e aba inferior em `(100 - L*cos(45°), +L*sin(45°))`.
  - Testar flecha vertical para baixo: `(0, 0) -> (0, 100)` gera ponta em `(0, 100)` com abas recuando para cima.
  - Testar flecha degenerada de comprimento zero `(50, 50) -> (50, 50)`: não quebra e retorna pontos válidos.
  - Testar proporção das abas com diferentes valores de `strokeWidth` (2px, 4px, 8px).

- [ ] **Step 2: Executar testes para verificar falha (RED)**:
  - Comando: `npm.cmd test tests/zoomAndCrop.test.ts`
  - Esperado: FAIL pois `getOpenChevronArrowPoints` não existe.

- [ ] **Step 3: Implementar `getOpenChevronArrowPoints` em `src/utils/zoomAndCrop.ts`**:
  - Calcular `dx = x2 - x1`, `dy = y2 - y1`, `angle = Math.atan2(dy, dx)`.
  - Definir comprimento da aba: `barbLength = Math.max(8, strokeWidth * 3.8)`.
  - Calcular as coordenadas `[xTop, yTop, x2, y2, xBottom, yBottom]`.

- [ ] **Step 4: Executar testes para verificar aprovação (GREEN)**:
  - Comando: `npm.cmd test tests/zoomAndCrop.test.ts`
  - Esperado: PASS em todos os testes.

- [ ] **Step 5: Commit**:
  - `git add src/utils/zoomAndCrop.ts tests/zoomAndCrop.test.ts`
  - `git commit -m "feat(geometry): adicionar utilitario getOpenChevronArrowPoints para flecha fina estilo icone"`

---

### Task 2: Renderização da Flecha Fina no Canvas e Preview de Desenho

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/integration.test.ts`

**Interfaces:**
- Consumes: `getOpenChevronArrowPoints` de `src/utils/zoomAndCrop.ts`.

- [ ] **Step 1: Escrever teste de integração em `tests/integration.test.ts`**:
  - Verificar que anotação de flecha fina calcula e atualiza pontos via âncoras de 2 pontos preservando o estilo `thin`.
  - Verificar que alternar o estilo para `thin` mantém o histórico de Undo/Redo funcional.

- [ ] **Step 2: Executar teste para verificar falha ou validação inicial**:
  - Comando: `npm.cmd test tests/integration.test.ts`

- [ ] **Step 3: Implementar renderização no `src/components/CanvasEditor.tsx`**:
  - No render de anotações (`ann.type === 'arrow'`):
    - Se `ann.arrowStyle === 'thin'`, renderizar `<Group id={ann.id} draggable ...>` contendo:
      - `<Line points={shaftPoints} stroke={ann.stroke} strokeWidth={effectiveStroke} lineCap="round" />`
      - `<Line points={chevronPoints} stroke={ann.stroke} strokeWidth={effectiveStroke} lineCap="round" lineJoin="round" />`
    - Para as outras variantes (`standard`, `dashed`, `curved`), manter `<Arrow>`.
  - No preview de desenho em tempo real (`newAnnotation?.type === 'arrow'`):
    - Se `arrowStyle === 'thin'`, renderizar o preview com a haste e o chevron em tempo real conforme o mouse se move.
  - No preview do magnifier lens (lupa que amplia a tela), replicar a renderização da flecha fina com chevron.

- [ ] **Step 4: Executar todos os testes do projeto**:
  - Comando: `npm.cmd test`
  - Esperado: PASS em todos os testes.

- [ ] **Step 5: Commit**:
  - `git add src/components/CanvasEditor.tsx tests/integration.test.ts`
  - `git commit -m "feat(canvas): renderizar flecha fina com ponta aberta em chevron estilo icone"`

---

### Task 3: Verificação Completa de Tipos, Build e Validação Final

**Files:**
- Modify: `src/components/CanvasEditor.tsx`
- Test: `tests/zoomAndCrop.test.ts`

- [ ] **Step 1: Executar checagem de tipos TypeScript**:
  - Comando: `npx.cmd tsc --noEmit`
  - Esperado: 0 erros.

- [ ] **Step 2: Executar build de produção**:
  - Comando: `npm.cmd run build`
  - Esperado: Build bem-sucedido.

- [ ] **Step 3: Executar toda a suíte de testes (127+ testes)**:
  - Comando: `npm.cmd test`
  - Esperado: 100% verde.

- [ ] **Step 4: Commit**:
  - `git commit --allow-empty -m "chore: validar integracao da flecha fina estilo icone"`
