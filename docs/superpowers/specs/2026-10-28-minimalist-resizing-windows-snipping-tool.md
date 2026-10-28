# Redimensionamento Minimalista Inspirado na Ferramenta de Captura do Windows

**Data:** 2026-10-28  
**Autor:** Antigravity & User  
**Status:** Proposto / Em Validação  

---

## 1. Visão Geral e Motivação

O sistema anterior de redimensionamento baseado em uma caixa delimitadora retangular com 8 alças (`Transformer`) e espessura de traço automática (`Auto`) causava distorções, comportamentos imprevisíveis ao arrastar pelas laterais e problemas graves de ergonomia, especialmente para linhas e setas.

Inspirado diretamente na **Ferramenta de Captura do Windows** (conforme registrado no arquivo de referência `Captura de tela 2026-10-28 203404.png`), este projeto reconstrói o modelo de redimensionamento e espessura do aplicativo sob quatro pilares de simplicidade:

1. **Retângulos e Elipses:** Redimensionamento livre exclusivamente por **4 pontos nos cantos** (sem alças laterais centrais) e alça de rotação destacada no topo com ícone de giro circular (`⟳`).
2. **Linhas e Setas Retas:** Supressão total da caixa 2D. Manipulação cirúrgica e intuitiva por **2 pontos de extremidade** (origem e ponta). As setas curvas mantêm suas **3 âncoras** já implementadas (cauda, arco e ponta).
3. **Espessura de Borda Constante:** Redimensionar qualquer forma altera suas dimensões espaciais (largura/altura ou comprimento), mas **nunca altera sua espessura de traço (`strokeWidth`)**.
4. **Escala de Espessuras em Pixels e Fim do "Auto":** Remoção definitiva do modo "Auto" e introdução de uma escala fixa de pixels de **2 a 10px**: `[2, 3, 4, 5, 6, 7, 8, 9, 10]`, unificada para as 4 ferramentas gráficas (Retângulo, Círculo/Elipse, Linha e Setas).

---

## 2. Arquitetura e Especificação Técnica

### 2.1. Escala de Traço e Remoção do Modo "Auto"
- **Novo conjunto de espessuras (`STROKE_WIDTHS`):**
  ```ts
  export const STROKE_WIDTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
  ```
- **Remoção de `autoStrokeWidth`:**
  - Deprecar/remover `autoStrokeWidth` de `editorStore.ts`, `Toolbar.tsx` e `CanvasEditor.tsx`.
  - O seletor de espessura na barra de ferramentas exibe os valores `2px, 3px, 4px, 5px, 6px, 7px, 8px, 9px, 10px` para as 4 ferramentas gráficas (`rect`, `ellipse`, `line`, `arrow`).
  - O valor padrão inicial passa a ser `3px` ou `4px`.
  - Ao alterar a espessura no dropdown com qualquer forma ou linha selecionada, a espessura da seleção é atualizada imediatamente no canvas com suporte a Undo/Redo.

---

### 2.2. Retângulo e Círculo/Elipse (Formas 2D)

#### A. Apenas 4 Alças nos Cantos
- No componente `<Transformer>` do Konva:
  ```tsx
  enabledAnchors={
    activeTool === 'crop' || isCropping
      ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
      : ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  }
  ```
- Alças estilizadas com o visual do Windows Snipping Tool:
  - Círculos brancos preenchidos (`anchorFill: '#ffffff'`).
  - Borda cinza neutra (`anchorStroke: '#71717a'`, `anchorStrokeWidth: 1.5`).
  - Formato arredondado (`anchorSize: 10`, `anchorCornerRadius: 5`).

#### B. Redimensionamento Livre (Sem Trava de Proporção Obrigatória)
- `keepRatio={false}` para formas 2D.
- Ao arrastar qualquer um dos 4 cantos:
  - Permite alterar largura e altura de forma independente (ex.: transformar quadrado em retângulo largo ou alto).
  - Pressionar `Shift` durante o arraste mantém a proporção 1:1 travada (comportamento padrão e intuitivo de softwares gráficos).
  - A espessura da linha (`strokeWidth`) permanece estritamente inalterada.
  - As dimensões são contidas dentro dos limites da imagem (`0 <= x <= imgW`, `0 <= y <= imgH`).

#### C. Alça de Rotação Estilizada no Topo
- Posicionada centralizada a ~24px acima da borda superior da forma.
- Visual fiel ao Windows Snipping Tool:
  - Badge circular escuro (`#262626` ou `#1e1e1e`) com borda sutil (`#3f3f46`) e sombra de elevação.
  - Ícone de rotação branca circular (`⟳`).
  - Cursor `grab` ao passar o mouse e `grabbing` ao girar.
  - Rotação suave em 360°, mantendo o centro do elemento fixo.

---

### 2.3. Linhas Retas e Flechas Retas (Controle de 2 Pontos)

#### A. Supressão Completa do Transformer
- `shouldAttachTransformer(toolType, arrowStyle)` retorna `false` para:
  - `ann.type === 'line'`
  - `ann.type === 'arrow'` (tanto para setas retas `standard`, `thin`, `dashed` quanto para curvas `curved`).
- Linhas e setas nunca mais serão envolvidas por caixas retangulares 2D.

#### B. Duas Âncoras Circulares Interativas
- **Âncora 0 (Origem/Cauda):** coordenada `(points[0], points[1])`.
  - Permite mover a base da linha ou cauda da flecha.
  - Cursor: `crosshair`.
- **Âncora 1 (Destino/Ponta):** coordenada `(points[2], points[3])`.
  - Permite apontar com precisão cirúrgica o alvo final da linha ou cabeça da flecha.
  - Cursor: `crosshair`.
- **Arraste do Corpo:**
  - Clicar e arrastar o corpo da linha ou flecha translada todo o elemento pelo canvas mantendo comprimento e inclinação intactos.
- **Arraste das Âncoras:**
  - Sincronização em tempo real a 60fps durante o arraste (`livePoints`).
  - Ambas as extremidades contidas pelos limites da imagem (`0 <= x <= imgW`, `0 <= y <= imgH`) sob qualquer nível de zoom via `getTransformedDragBound`.
  - Persistência ao soltar com suporte integral a Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).

---

## 3. Matriz de Comportamento dos Elementos

| Tipo de Elemento | Tipo de Controle | Número de Alças | Alça de Rotação | Traço no Resize |
| :--- | :--- | :--- | :--- | :--- |
| **Retângulo** (`rect`) | Transformer 2D | 4 (apenas cantos) | Sim (badge superior `⟳`) | Constante (não distorce) |
| **Círculo / Elipse** (`ellipse`) | Transformer 2D | 4 (apenas cantos) | Sim (badge superior `⟳`) | Constante (não distorce) |
| **Linha / Traço** (`line`) | Âncoras Pontuais | 2 (Origem e Ponta) | Não (rotaciona via pontas) | Constante |
| **Seta Reta** (`standard`, `thin`, `dashed`) | Âncoras Pontuais | 2 (Cauda e Ponta) | Não (rotaciona via pontas) | Constante |
| **Seta Curva** (`curved`) | Âncoras Pontuais | 3 (Cauda, Arco, Ponta) | Não (arco livre manual) | Constante |
| **Texto** (`text`) | Transformer 2D | 4 (cantos) | Sim | N/A (fonte snap 12..48) |
| **Lupa** (`magnifier`) | Alça Focal + Coroa | 1 ponto focal + aro | Não | Constante |
| **Recorte** (`crop`) | Transformer 8 alças | 8 alças completas | Não | N/A |

---

## 4. Plano de Testes e Validação

1. **Testes Unitários:**
   - `shouldAttachTransformer`: valida retorno `false` para `line` e todas as variações de `arrow`; valida `true` para `rect`, `ellipse`, `image`, `text`.
   - `updateLineAnchor`: valida atualização de âncoras de 2 pontos (índice 0 e índice 1) com contenção estrita aos limites da imagem.
   - `STROKE_WIDTHS`: valida lista `[2, 3, 4, 5, 6, 7, 8, 9, 10]`.
2. **Testes de Integração:**
   - Adicionar retângulo e redimensionar via canto sem alteração de `strokeWidth`.
   - Mover âncoras da linha e de seta reta com gravação e reversão em histórico de Undo/Redo.
   - Alternar espessura de 2 a 10px e confirmar reflexo imediato nos elementos selecionados.
3. **Verificação de Compilação:**
   - `npx.cmd tsc --noEmit` com 0 erros.
   - `npm.cmd test` cobrindo 100% da suíte existente.
   - `npm.cmd run build` gerando bundle limpo de produção.
