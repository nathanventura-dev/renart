# Especificação Técnica: Bloco de Texto Inspirado no Figma (Auto-Width, Auto-Wrap, Rotação Padronizada e Formatação Dinâmica)

## 1. Visão Geral
Este documento especifica a evolução da experiência do bloco de texto na ferramenta de captura, inspirando-se no modelo consagrado do Figma. A proposta entrega:
1. **Dimensionamento Dinâmico:** Alternância entre *Auto-Width* (crescimento livre com digitação e quebra apenas no `Enter`) e *Fixed-Width / Auto-Wrap* (largura definida manualmente com quebra automática de palavras e ajuste automático de altura).
2. **Controle na Barra de Ferramentas:** Botão dedicado de *Quebra Automática* com ícone `WrapText`.
3. **Alças de Redimensionamento e Auto-Fit:** Alças laterais e de canto para redimensionar a largura da caixa; duplo clique na alça lateral reseta para *Auto-Width* (ajuste perfeito ao conteúdo).
4. **Padronização da Rotação:** Adoção da mesma alça de rotação (`⟳`) das demais ferramentas (badge circular escuro, duplo clique para 0° e `Shift` para travar em intervalos de 15°).
5. **Formatação Dinâmica de Texto:** Formatação global quando selecionado fora de edição; formatação de seleção quando houver texto marcado; formatação das próximas palavras quando o cursor estiver sem seleção.

---

## 2. Modelo de Dados (`TextAnnotation`)

Em `src/state/editorStore.ts`:
```ts
export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily?: string;
  fill?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  textAlign?: TextAlign;
  hasBackground?: boolean;
  backgroundColor?: string;
  spans?: TextSpan[];
  
  // Novos campos:
  width?: number;       // Largura definida manualmente pelo usuário (em pixels do canvas)
  autoWrap?: boolean;   // Se true, quebra linhas automaticamente na largura definida
}
```

No `EditorState`:
```ts
export interface EditorState {
  // ...
  autoWrap: boolean; // Padrão: false (Auto-Width)
}
```

Ações no `editorStore`:
- `toggleAutoWrap()`: Alterna o modo de quebra automática na anotação selecionada ou no estado global.
- `setAutoWrap(autoWrap: boolean)`: Define explicitamente o estado.
- `syncToolbarWithSelection`: Sincroniza `autoWrap` da anotação selecionada com a Toolbar.

---

## 3. Comportamento de Dimensionamento (Auto-Width vs. Auto-Wrap)

### Modo 1: Auto-Width (`autoWrap: false`) — Padrão Inicial
- A caixa expande horizontalmente à medida que o usuário digita.
- Quebras de linha só ocorrem onde o usuário pressionar `Enter` (`\n`).
- A largura da caixa (`approxW`) é calculada pela linha mais longa do texto (ou spans) mais o padding.
- Se o usuário arrastar a alça lateral para redimensionar a largura, o sistema define `width` e automaticamente ativa `autoWrap = true`.

### Modo 2: Auto-Wrap (`autoWrap: true`)
- A caixa possui uma largura definida `width`.
- Se o texto ultrapassar a largura, ele quebra suavemente entre palavras (`word-break: break-word`).
- Quebras manuais de `Enter` continuam sendo 100% respeitadas.
- A altura da caixa (`approxH`) ajusta-se automaticamente para acomodar todas as linhas geradas pelo wrap.
- **Duplo clique na alça lateral:** Restaura `autoWrap: false` e `width: undefined`, fazendo a caixa encolher perfeitamente ao redor do texto atual (*Auto-Width*).

---

## 4. Alças de Controle e Rotação Padronizada

### Alças Visuais
- O bloco de texto passa a integrar o mesmo sistema de controles que retângulos e elipses (`getFourCornerPositions` / `selectedFourCornerAnnotation`).
- **Alça de Rotação (`⟳`):**
  - Posicionada centralizada acima do topo do bloco.
  - Arrastar com mouse rotaciona livremente.
  - Segurar `Shift` trava o ângulo em múltiplos de 15° (0°, 15°, 30°, 45°, 90°, etc.).
  - **Duplo clique:** redefine a rotação instantaneamente para 0° (deixa o bloco reto).
- **Alças de Redimensionamento:**
  - Alças nos cantos e/ou laterais (esquerda e direita).
  - Arrastar a alça direita ou esquerda ajusta a largura `width` do bloco em tempo real.
  - Duplo clique na alça reseta para *Auto-Width*.

---

## 5. Formatação Inteligente de Texto

### Fora de Edição (Bloco Selecionado no Canvas)
- Clicar em Negrito, Itálico, Sublinhado ou Riscado na Toolbar alterna a propriedade em toda a anotação (`isBold`, `isItalic`, etc.).

### No Modo de Edição Inline (`editingText !== null`)
1. **Com Seleção Ativa (`!sel.isCollapsed && sel.toString().length > 0`):**
   - Executa `document.execCommand(formatCmd, false)`.
   - Apenas o texto selecionado recebe/perde a formatação.
2. **Sem Seleção (Cursor Simples / `sel.isCollapsed`):**
   - Executa diretamente `document.execCommand(formatCmd, false)` na posição do cursor sem selecionar o elemento pai.
   - O navegador aplica a formatação para as **próximas palavras digitadas** a partir daquele ponto.
3. **Atalhos de Teclado no Editor:**
   - `Ctrl+B` / `Ctrl+N`: Negrito
   - `Ctrl+I`: Itálico
   - `Ctrl+U`: Sublinhado
   - `Ctrl+Shift+X` / `Alt+Shift+5`: Riscado
   - Todos chamam `e.stopPropagation()` para não colidir com atalhos do canvas.

---

## 6. Interface da Barra de Ferramentas (`Toolbar.tsx`)
- No submenu flutuante de texto, ao lado do botão de *Fundo/Destaque* (`Highlighter`), adiciona-se o botão de **Quebra Automática**:
  - Ícone: `WrapText` (de `lucide-react`).
  - Estado ativo: destaque azul com fundo preenchido quando `autoWrap` estiver ativado.
  - Tooltip: *"Quebra automática de linha (Auto-wrap)"*.
