# Especificação de Design: Formatação Avançada de Texto (Estilo, Alinhamento e Destaque)

**Data:** 2026-11-02  
**Status:** Proposto para aprovação  

---

## 1. Contexto e Motivação

Atualmente, a ferramenta de texto permite selecionar apenas a **Família da Fonte** e o **Tamanho da Fonte**.
Para anotações ricas em capturas de tela (como destacar termos importantes, riscar dados errados, sublinhar URLs/caminhos e criar notas legíveis sobre qualquer tipo de imagem), é necessário expandir a tipografia com controles de estilo, alinhamento e contraste de fundo.

---

## 2. Objetivos e Regras de Negócio

### 2.1 Modelo de Dados (`TextAnnotation` e `EditorState`)
A interface `TextAnnotation` e o estado global da store recebem os seguintes atributos (com valores default):
- `isBold?: boolean` (default: `false` -> Konva `fontStyle: 'bold'`)
- `isItalic?: boolean` (default: `false` -> Konva `fontStyle: 'italic'`)
  *(Quando ambos ativos: `fontStyle: 'italic bold'`)*
- `isUnderline?: boolean` (default: `false` -> Konva `textDecoration: 'underline'`)
- `isStrikethrough?: boolean` (default: `false` -> Konva `textDecoration: 'line-through'`)
  *(Quando ambos ativos: `textDecoration: 'underline line-through'`)*
- `textAlign?: 'left' | 'center' | 'right'` (default: `'left'`)
- `hasBackground?: boolean` (default: `false`)
  *(Quando ativo, renderiza uma caixa com cantos arredondados e cor de contraste atrás do texto, ou fundo sólido semitransparente para legibilidade total)*

### 2.2 Apresentação Visual no Menu Flutuante (`Toolbar.tsx`)
O submenu horizontal de texto (`HorizontalFloatingMenu`) adota a **Abordagem 1 (Barra Horizontal Agrupada por Blocos)**:
1. **Bloco 1 (Tipografia):**
   - `<select>` de Família de Fonte.
   - `<select>` de Tamanho de Fonte.
   - Divisor vertical suave (`#e2e8f0`).
2. **Bloco 2 (Estilo - Toggles):**
   - `[ B ]`: Negrito (`Bold`, ícone Lucide).
   - `[ I ]`: Itálico (`Italic`, ícone Lucide).
   - `[ U ]`: Sublinhado (`Underline`, ícone Lucide).
   - `[ S ]`: Riscado / Tachado (`Strikethrough`, ícone Lucide).
   - Divisor vertical suave.
3. **Bloco 3 (Alinhamento - Segmentado Exclusivo):**
   - `[ ⫷ ]`: Alinhar à Esquerda (`AlignLeft`).
   - `[ ≡ ]`: Centralizar (`AlignCenter`).
   - `[ ⫸ ]`: Alinhar à Direita (`AlignRight`).
   - Divisor vertical suave.
4. **Bloco 4 (Destaque):**
   - `[ 🏷️ / Badge ]`: Alternador de Caixa de Fundo / Realce (`highlighter` ou `square`).

### 2.3 Renderização no Canvas e Edição Inline (`CanvasEditor.tsx`)
1. **Renderização Konva `<Text />`:**
   - Monta dinamicamente `fontStyle` e `textDecoration`.
   - Se `hasBackground: true`, desenha uma `<Rect />` suave com `cornerRadius: 4` e preenchimento adaptativo sob o texto, ou utiliza agrupamento `<Group />`.
   - Aplica `align={ann.textAlign || 'left'}`.
2. **Edição Inline (`<textarea>`):**
   - O `<textarea>` de edição rápida herda imediatamente o `fontWeight`, `fontStyle`, `textDecoration` e `textAlign`.
   - Suporte a atalhos de teclado durante a digitação:
     - `Ctrl+B` / `Cmd+B`: Alterna Negrito.
     - `Ctrl+I` / `Cmd+I`: Alterna Itálico.
     - `Ctrl+U` / `Cmd+U`: Alterna Sublinhado.

---

## 3. Abordagens Consideradas

- **Abordagem 1 (Escolhida): Barra Horizontal Agrupada por Blocos.**
  - 100% alinhada à identidade visual dos submenus existentes (`HorizontalFloatingMenu`).
  - Acesso direto com 1 clique a todos os controles.
- **Abordagem 2: Mini-Painel Contextual em 2 Linhas.**
  - Rejeitada por ocupar espaço vertical excessivo e quebrar o padrão das outras ferramentas da barra.
