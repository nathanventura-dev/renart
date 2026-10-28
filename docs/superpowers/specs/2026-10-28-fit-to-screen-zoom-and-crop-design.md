# Design Doc: Ajuste Automático à Tela, Zoom Multiplataforma e Ferramenta de Recorte (Crop)

**Data:** 28/10/2026  
**Status:** Proposto para Aprovação  
**Autores:** Pair Programming (Antigravity + Usuário)

---

## 1. Contexto e Motivação

Atualmente, ao colar ou abrir imagens de alta resolução (Full HD, 4K ou dimensões superiores à janela do editor), a aplicação renderiza o canvas com as dimensões brutas da imagem. Em monitores de computadores compactos ou notebooks de 13 e 14 polegadas, isso força o aparecimento imediato de barras de rolagem horizontais e verticais, prejudicando a visão geral do print.

Além disso, faltam controles intuitivos de aproximação/afastamento da imagem na barra superior e uma ferramenta dedicada de **Recorte de Imagem (Crop)** semelhante à Ferramenta de Captura do Windows (Snipping Tool).

---

## 2. Objetivos e Não-Objetivos

### Objetivos:
1. **Ajuste Automático à Tela (Fit to Screen):** Ao colar ou carregar qualquer imagem, se ela for maior que o espaço útil da janela, ela deve abrir redimensionada proporcionalmente para caber inteira na tela sem gerar scrollbars imediatas. Se for menor que a janela, permanece em 100% nativa e centralizada.
2. **Zoom In e Zoom Out na Barra Superior com Atalhos Multiplataforma:**
   - Adicionar botões compactos de **Zoom Out (`-`)**, **Indicador de Porcentagem** e **Zoom In (`+`)** na `Toolbar.tsx`, logo ao lado de Desfazer e Refazer, separados por um divisor vertical (`|`).
   - Suporte a atalhos do sistema operacional:
     - **Windows / Linux:** `Ctrl + +` (Zoom In), `Ctrl + -` (Zoom Out), `Ctrl + 0` (Ajustar à tela / 100%).
     - **macOS:** `Cmd + +` (Zoom In), `Cmd + -` (Zoom Out), `Cmd + 0` (Ajustar à tela / 100%).
   - Se o usuário der Zoom In intencionalmente para inspecionar detalhes, a rolagem suave é habilitada para que em telas de 13"/14" nenhum canto fique inacessível.
3. **Ferramenta de Recorte (Crop) Estilo Windows Snipping Tool:**
   - Adicionar o ícone de Recorte (`Crop`) na barra de ferramentas.
   - Ao ativar, exibe uma máscara semitransparente escurecida e uma moldura de recorte redimensionável sobre a imagem com botões de ação:
     - **Check (Confirmar corte):** Recorta a imagem de fundo para a área selecionada, ajusta a posição das anotações existentes e descarta anotações 100% fora do corte, gravando o estado no histórico para suporte a `Ctrl+Z` (Desfazer).
     - **X (Cancelar):** Fecha o modo de recorte sem modificar a imagem original.

### Não-Objetivos:
- Não distorcer nem alterar o aspect ratio original da imagem de fundo no ajuste automático ou no zoom.
- Não introduzir modais ou janelas flutuantes complexas: toda a interação de recorte ocorre diretamente sobre o canvas.

---

## 3. Abordagens Consideradas

### Abordagem 1 (Escolhida): Ajuste Inicial à Tela + Rolagem Sob Demanda no Zoom
- **Comportamento:** A imagem sempre abre sem nenhuma barra de rolagem (modo Fit). Se o usuário aplicar Zoom In intencionalmente (`Ctrl + +`), a rolagem é liberada para permitir navegação pelas bordas em telas de 13"/14".
- **Por que foi escolhida:** Elimina o problema da imagem abrir estourando a tela e ao mesmo tempo nunca deixa o usuário preso sem conseguir alcançar áreas externas durante zoom ou recorte.

### Abordagem 2: Bloqueio Rígido de Scrollbars com Navegação por Pan (Barra de Espaço)
- **Comportamento:** O container nunca permite barras de rolagem nativas. A navegação durante o zoom exigiria segurar a barra de espaço para arrastar o palco.
- **Por que foi descartada:** Menos intuitiva para usuários comuns habituados com o padrão do Windows, Mac e navegadores, exigindo uma curva de aprendizado desnecessária para ações cotidianas.

---

## 4. Detalhes da Arquitetura e Implementação

### 4.1. Ajuste Automático à Tela (`fit-to-screen`)
- No container do `CanvasEditor.tsx`:
  - Mede a largura e altura úteis da área visível (`viewportWidth`, `viewportHeight`), descontando o padding de margem (24px).
  - Se `imageWidth > viewportWidth || imageHeight > viewportHeight`:
    - `initialZoom = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight)`.
  - Se `imageWidth <= viewportWidth && imageHeight <= viewportHeight`:
    - `initialZoom = 1.0` (imagem nativa centralizada).
  - O cálculo do ponteiro do mouse e do Transformer no Konva respeita a escala da câmera, mantendo clique, arraste e desenho 100% precisos.

### 4.2. Controles de Zoom e Atalhos Multiplataforma
- **Na `Toolbar.tsx`:**
  - Posicionamento: após os botões de Undo/Redo, separados por um divisor vertical (`|`).
  - Controles:
    - Botão `ZoomOut` (`Ctrl/Cmd -`): decrementa o zoom em passos de 10% a 25% (mínimo 25%).
    - Indicador `100%` (ou porcentagem atual): exibe o valor atual e, ao clicar, reseta para "Ajustar à Tela".
    - Botão `ZoomIn` (`Ctrl/Cmd +`): incrementa o zoom em passos de 10% a 25% (máximo 400%).
- **Tratamento de Teclado Multiplataforma:**
  - Event listener global para `(e.ctrlKey || e.metaKey)` capturando `+`, `=`, `-`, `_` e `0`, prevenindo o zoom nativo do browser e aplicando o zoom no canvas da ferramenta.

### 4.3. Ferramenta de Recorte (Crop Mode)
- **Estado de Corte:**
  - `isCropping: boolean` e `cropBox: { x: number; y: number; width: number; height: number }`.
  - Ao clicar no ícone de recorte, inicializa `cropBox` cobrindo inicialmente toda a imagem com recuo suave de 10px ou 20px.
- **Interação no Canvas:**
  - Camada de sobreposição semitransparente escurecida fora do `cropBox`.
  - 8 alças de redimensionamento nos cantos e laterais da moldura.
  - Controles de ação posicionados sobre ou próximos ao quadro (ou na barra superior em modo contextual):
    - Botão **Check** (Verde / Destaque): executa `confirmCrop()`.
    - Botão **X** (Cinza / Cancelar): executa `cancelCrop()`.
- **Ação `confirmCrop()`:**
  - Cria um elemento `<canvas>` temporário, recorta a região em pixels reais da imagem de fundo e gera a nova `imageBase64`.
  - Atualiza as anotações existentes: translada `x` e `y` por `-cropBox.x` e `-cropBox.y`. Remove elementos cuja área delimitadora ficou totalmente fora do novo recorte.
  - Registra a alteração no histórico (`undoStack`), permitindo reverter o recorte imediatamente com `Ctrl+Z`.

---

## 5. Compatibilidade Windows, macOS e Linux

- **Comportamento Idêntico:** O motor de desenho do Konva e React roda de forma 100% equivalente em todos os sistemas operacionais.
- **Adaptação de Teclado:** No macOS, `e.metaKey` (`Cmd`) é reconhecido com a mesma prioridade que `e.ctrlKey` no Windows e Linux.
- **Scrollbars Nativas:** No macOS e distribuições Linux com temas modernos, as barras de rolagem são flutuantes/ocultas por padrão, mantendo o visual limpo mesmo quando o zoom está ativo.
