# Especificação de Design: Refinamento Minimalista da Ferramenta de Recorte

**Data:** 29/10/2026  
**Status:** Proposto para aprovação  
**Abordagem Escolhida:** Abordagem 1 (Estilo Moderno Apple/Figma: Botões Translúcidos Semânticos + Quadro de Recorte com Cantos em L e Grade de Terços)

---

## 1. Intenção e Motivação (*Why*)

A ferramenta de corte atual possui dois pontos de atrito visual que comprometem a harmonia da interface:
1. **Botões de confirmação/cancelamento na Toolbar:** Atualmente utilizam blocos de cor sólida altamente saturados (verde `#34c759` e vermelho `#ef4444`) que criam um peso visual desproporcional em relação ao restante da barra de ferramentas (que possui tons neutros, translúcidos e elegantes).
2. **Quadro de recorte no Canvas:** Apresenta duplicidade de bordas conflitantes (o retângulo `#crop-box-rect` possui linha tracejada branca `dash={[6, 4]}`, enquanto o `Transformer` projeta uma linha sólida azul `#0071e3`), além de 8 alças circulares genéricas que poluem o enquadramento.

O objetivo deste refinamento é trazer uma estética minimalista, elegante e profissional inspirada em softwares de fotografia modernos (como Apple Photos, Lightroom e Figma), **sem perder a clareza e sem dificultar que o usuário identifique onde clicar para confirmar ou cancelar**.

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
1. **Botões de Ação na Toolbar (`src/components/Toolbar.tsx`):**
   - Substituir os blocos sólidos pesados por botões refinados no estilo *translucent tinted pill*:
     - **Confirmar:** Fundo verde translúcido suave (`rgba(34, 197, 94, 0.12)`), borda sutil (`rgba(34, 197, 94, 0.25)`), ícone `Check` (15px) e texto "Confirmar" em verde nítido (`#16a34a`), com badge ou atalho `Enter`.
     - **Cancelar:** Fundo neutro/vermelho translúcido (`rgba(239, 68, 68, 0.08)`), borda sutil (`rgba(239, 68, 68, 0.2)`), ícone `X` (15px) e texto "Cancelar" em tom suave (`#dc2626`), com badge ou atalho `Esc`.
   - Hover responsivo e elegante com leve transição de opacidade/fundo.
   - Manter 100% de clareza textual e semântica de cores para garantir usabilidade sem esforço cognitivo.

2. **Quadro de Recorte no Canvas (`src/components/CanvasEditor.tsx`):**
   - **Borda única nítida:** Eliminar o conflito visual entre a linha tracejada e a linha azul. O quadro de recorte terá uma borda branca nítida de 1px com sombra sutil (`drop-shadow(0 1px 2px rgba(0,0,0,0.4))`).
   - **Marcas de Canto em "L" e Barras Centrais:** Substituir as 8 âncoras circulares genéricas por marcas de corte clássicas (cantos em "L" de 14px com espessura de 2px a 2.5px em branco com contorno fino escuro para contraste universal, e pequenas barras centrais nas 4 arestas).
   - **Grade de Regra dos Terços (3x3):** Linhas internas muito suaves (`rgba(255, 255, 255, 0.2)`) dividindo o quadro em 9 partes para auxílio de composição e enquadramento fotográfico.

### Não-Metas (Non-Goals)
- Não alterar as funções matemáticas de corte e redimensionamento (`calculateCropBounds`, `adjustAnnotationsForCrop`).
- Não alterar os atalhos de teclado existentes (`Enter` para confirmar, `Escape` para cancelar).
- Não alterar a lógica de histórico (Undo/Redo) ou captura de imagem.

### Anti-Metas (Anti-Goals)
- Não remover os textos explicativos "Confirmar" e "Cancelar" a ponto de deixar a ação ambígua ou confusa.
- Não usar linhas de grade espessas ou opacas que obstruam a visualização da imagem abaixo.

---

## 3. Detalhamento da Solução

### 3.1. Barra de Ferramentas (`Toolbar.tsx`)
```tsx
// Container de ações de corte integrado à altura da barra
<div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
  {/* Botão Confirmar */}
  <button
    type="button"
    title="Confirmar Recorte (Enter)"
    onClick={onConfirmCrop}
    style={{
      height: '26px',
      padding: '0 10px',
      fontSize: '12px',
      fontWeight: 500,
      borderRadius: '6px',
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      color: '#15803d',
      border: '1px solid rgba(34, 197, 94, 0.25)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }}
  >
    <Check size={14} strokeWidth={2.2} />
    <span>Confirmar</span>
    <kbd style={{ fontSize: '10px', opacity: 0.7, marginLeft: '2px' }}>↵</kbd>
  </button>

  {/* Botão Cancelar */}
  <button
    type="button"
    title="Cancelar Recorte (Esc)"
    onClick={onCancelCrop}
    style={{
      height: '26px',
      padding: '0 10px',
      fontSize: '12px',
      fontWeight: 500,
      borderRadius: '6px',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      color: '#b91c1c',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }}
  >
    <X size={14} strokeWidth={2.2} />
    <span>Cancelar</span>
    <kbd style={{ fontSize: '10px', opacity: 0.7, marginLeft: '2px' }}>esc</kbd>
  </button>
</div>
```

### 3.2. Quadro de Recorte e Grade de Terços (`CanvasEditor.tsx`)
1. **Grade de Regra dos Terços (Linhas Internas):**
   - 2 linhas verticais em `cropRect.x + cropRect.width * 1/3` e `cropRect.x + cropRect.width * 2/3`.
   - 2 linhas horizontais em `cropRect.y + cropRect.height * 1/3` e `cropRect.y + cropRect.height * 2/3`.
   - Traço: `stroke="rgba(255, 255, 255, 0.22)"`, `strokeWidth={1}`, `listening={false}`.
2. **Moldura do Retângulo:**
   - Retângulo nítido com `stroke="rgba(255, 255, 255, 0.9)"`, `strokeWidth={1.5}`, com leve sombra para contraste sobre fundos claros ou escuros.
3. **Marcas de Canto em "L":**
   - Renderizadas nos 4 cantos (`TL`, `TR`, `BL`, `BR`) com `stroke="#ffffff"`, `strokeWidth={3}`, `shadowBlur={2}` e comprimento de 14px.
   - Pequenas barras centrais (`T`, `B`, `L`, `R`) de 12px x 3px.
4. **Alças do Transformer:**
   - Quando `activeTool === 'crop' || isCropping`, o Transformer é configurado com bordas transparentes para não conflitar com a moldura desenhada, e alças estilizadas de forma correspondente aos cantos de corte.

---

## 4. Testes e Validação
- Testes unitários e de renderização em `tests/toolbarMenus.test.ts` e `tests/integration.test.ts`.
- Validação de atalhos `Enter` e `Escape`.
- Garantia de que todos os 129 testes continuem verdes.
