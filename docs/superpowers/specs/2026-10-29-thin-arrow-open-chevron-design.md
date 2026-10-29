# Especificação de Design: Flecha Fina com Ponta Aberta em Chevron (Estilo Ícone SVG)

**Data:** 29/10/2026  
**Status:** Proposto para aprovação  
**Referência Visual:** Ícone SVG `ArrowRight` do Lucide (`http://www.w3.org/2000/svg`)  

---

## 1. Intenção e Motivação (*Why*)

Atualmente, na aplicação, a variante de flecha estilo "Fina" (`arrowStyle === 'thin'`) é renderizada pelo componente `<Arrow>` padrão do Konva, o qual desenha uma ponta triangular sólida/preenchida, diferindo apenas na espessura ligeiramente menor em relação à flecha padrão.

O usuário solicitou que a flecha fina tenha a aparência idêntica ao ícone de flecha da barra de ferramentas (`ArrowRight` do Lucide / SVG padrão):
- Uma linha contínua esguia;
- Uma ponta aberta em ângulo de 45° (formato chevron `->`), sem preenchimento triangular fechado;
- Extremidades e junções arredondadas (`lineCap="round"` e `lineJoin="round"`);
- Manutenção do mesmo comportamento funcional da flecha padrão (2 âncoras de ajuste, snapping com Shift para 0°, 90° e 45°, rotação e multiseleção).

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
1. **Ponta Aberta em Chevron 45°:**
   - Criar a função matemática `getOpenChevronArrowPoints(x1, y1, x2, y2, strokeWidth)` em `src/utils/zoomAndCrop.ts`.
   - As hastes do chevron partem da ponta $(x_2, y_2)$ e recuam em ângulos de $\theta - 45°$ e $\theta + 45°$, onde $\theta = \text{atan2}(y_2 - y_1, x_2 - x_1)$.
   - Comprimento das hastes proporcional à espessura da linha (ex: `strokeWidth * 3.5` a `strokeWidth * 4`), garantindo visibilidade e elegância visual em qualquer espessura (2px a 8px).
2. **Renderização no Canvas:**
   - Em `src/components/CanvasEditor.tsx`, quando `arrowStyle === 'thin'`, renderizar a haste principal e a ponta chevron com `lineCap="round"` e `lineJoin="round"`.
   - Manter o mesmo feedback em tempo real durante o desenho com arraste do mouse e durante o ajuste pelas 2 âncoras de extremidade.
3. **Compatibilidade Total com Interações Existentes:**
   - 2 âncoras de ajuste nas pontas $(x_1, y_1)$ e $(x_2, y_2)$ continuam coladas e funcionais.
   - Snapping com Shift (0° horizontal perfeito, 90° vertical, 45° diagonal) opera sem alterações.
   - Histórico de desfazer/refazer (Undo/Redo), seleção, arrasto e multiseleção preservados.

### Não-Metas (Non-Goals)
- Não alterar as demais variantes de flechas (`standard`, `dashed`, `curved`), que continuam com suas respectivas características originais.
- Não alterar o modelo de dados da anotação no `editorStore` (permanece `type: 'arrow'`, `arrowStyle: 'thin'`).

### Anti-Metas (Anti-Goals)
- Não gerar distorção na ponta chevron ao girar a flecha em 360° ou ao mudar sua escala/tamanho.
- Não permitir que a flecha fina perca a área clicável de seleção (*hit-testing*).

---

## 3. Abordagens Consideradas

| Abordagem | Descrição | Trade-offs | Decisão |
|-----------|-----------|------------|---------|
| **1. Função Geométrica Pura + Primitivas Vetoriais do Konva** | Cálculo de coordenadas do chevron em função pura + renderização via `<Line>`/`<Group>` no Konva com `lineCap="round"` e `lineJoin="round"`. | Extremamente performático, declarativo e coberto por testes unitários puros. | **Escolhida (aprovada pelo usuário)**: idêntica ao ícone e limpa. |
| **2. Custom `<Shape>` com `sceneFunc` 2D** | Desenho imperativo de comandos `lineTo` em contexto 2D. | Mais verboso e menos declarativo no React. | Descartada. |

---

## 4. Arquitetura da Solução

### 4.1. Função Utilitária `getOpenChevronArrowPoints`
Em `src/utils/zoomAndCrop.ts`:
```ts
export interface OpenChevronPoints {
  shaftPoints: [number, number, number, number]; // [x1, y1, x2, y2]
  chevronPoints: [number, number, number, number, number, number]; // [xTop, yTop, x2, y2, xBottom, yBottom]
}

export function getOpenChevronArrowPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number = 2
): OpenChevronPoints
```

### 4.2. Renderização em `src/components/CanvasEditor.tsx`
Para `ann.arrowStyle === 'thin'`:
- Renderizar dentro de `<Group id={ann.id} draggable ...>`:
  - `<Line points={shaftPoints} stroke={ann.stroke} strokeWidth={effectiveStroke} lineCap="round" />`
  - `<Line points={chevronPoints} stroke={ann.stroke} strokeWidth={effectiveStroke} lineCap="round" lineJoin="round" />`
- Hit testing garantido via `hitStrokeWidth={20}`.

---

## 5. Validação e Testes
- Testes unitários em `tests/zoomAndCrop.test.ts` validando os pontos do chevron em ângulos ortogonais (0°, 90°, 180°, 270°) e diagonais (45°).
- Testes de integração em `tests/integration.test.ts` garantindo que as 2 âncoras se mantêm alinhadas e o arraste funciona perfeitamente.
- Garantir que todos os 127 testes continuem verdes.
