# Manual de Funcionamento e Fluxo de Uso

**Aplicação:** Ferramenta de Captura Multiplataforma  
**Plataformas Suportadas:** Windows, macOS, Linux (X11 / Wayland)  

Este manual descreve em detalhes o fluxo de operação da aplicação, os recursos da interface visual, o comportamento de cada ferramenta de anotação e as regras de negócio integradas.

---

## 1. Visão Geral do Fluxo

A ferramenta foi projetada para combinar **agilidade máxima** com **poder de anotação vetorial**:

```
[Acionamento do Atalho ou Botão]
             │
             ▼
[Seleção de Modo: Região / Formato / Tela Cheia]
             │
             ▼
[Desenho da Área com o Mouse]
             │
             ├────────────────────────────────────────────────┐
             │                                                │
             ▼ (Cópia Automática Imediata)                    ▼
[Disponível no Clipboard (Ctrl+V / Cmd+V)]       [Abre Janela de Edição]
                                                              │
                                                              ▼
                                                 [Anotações: Formas, Setas,
                                                   Textos, Figuras, Lupa]
                                                              │
                                                              ▼
                                                 [Exportar em PNG, JPEG ou PDF]
```

---

## 2. Modos de Captura

Ao clicar em **"Nova Captura"** ou utilizar o atalho global configurado, uma camada escura semi-transparente sobrepõe a tela:

1. **Captura por Região (Padrão):**
   - **Como usar:** Clique com o botão esquerdo no ponto inicial, arraste até cobrir a área desejada e solte.
   - **Feedback visual:** As dimensões exatas em pixels (ex: `1280 × 720`) são exibidas em tempo real junto ao cursor.
   - **Arraste Livre:** Não importa se você arrasta da esquerda para a direita, de baixo para cima ou vice-versa; a geometria se normaliza automaticamente.
2. **Captura em Formato Livre (Lasso):**
   - **Como usar:** Desenhe à mão livre contornando o objeto de interesse na tela. O algoritmo filtra pontos repetidos para criar uma curva suave.
3. **Captura de Tela Inteira:**
   - Captura instantaneamente todo o conteúdo do monitor ativo com um único clique.
4. **Cancelamento:**
   - A qualquer momento, pressione a tecla **ESC** para cancelar a captura sem alterar nada.

---

## 3. Cópia Automática Imediata para o Clipboard

Assim que o mouse é solto ao finalizar a seleção:
- O buffer de pixels é compactado e **gravado diretamente na área de transferência** do sistema operacional.
- **Caso de uso rápido:** Se você só precisa enviar um print para um colega no WhatsApp Web, Slack, Teams ou e-mail, **não precisa salvar nenhum arquivo nem clicar em nada no editor**. Basta alternar para o seu aplicativo de mensagens e pressionar `Ctrl+V` (ou `Cmd+V` no Mac).

---

## 4. O Editor e a Barra de Ferramentas

Se você desejar apontar, destacar ou enriquecer o print antes de salvar:

### 4.1. Ferramentas Disponíveis
- **Cursor / Seleção (Mouse Pointer):** Permite clicar sobre qualquer elemento já desenhado para movê-lo, rotacioná-lo ou redimensioná-lo.
- **Retângulo (Square):** Cria caixas retangulares. Ao clicar no retângulo, surgem **âncoras nos cantos e laterais** que permitem esticar ou encolher o elemento com precisão milimétrica.
- **Círculo / Elipse (Circle):** Cria destaques circulares ou ovais com âncoras de ajuste e movimentação livre.
- **Linha / Traço (Minus):** Desenha linhas ou traços livres, ideais para sublinhar textos, destacar linhas de código ou fazer marcações diretas.
- **Flecha Vetorial (Arrow):** Desenha setas com ponta automática. Ideal para indicar botões, erros ou áreas de interesse em tutoriais.
- **Bloco de Texto (Type):** Insere caixas de texto com tamanho de fonte e cores customizáveis sobre a imagem (edição direta inline no canvas com duplo clique, sem janelas modais).
- **Inserir Imagem / Figura (ImageIcon):** Permite anexar logos, selos, carimbos ou figuras externas sobre o print.
- **Ferramenta de Lupa com Opções "Sem foco" e "Com foco" (Zoom Lens):**
  - **Duas Opções de Uso na Barra de Ferramentas:** Ao selecionar a Lupa, você pode escolher entre:
    - **`Sem foco`:** Mantém a lupa tradicional que amplia diretamente a região sob a própria lente.
    - **`Com foco`:** Permite clicar no ponto exato que deseja focar e arrastar a lupa para qualquer canto da tela. O ponto focal exibe **apenas um ponto discreto** (sem círculo ao redor para não poluir a visão) conectado à lupa por um **rastro levemente fosco estreito**. Tanto o ponto focal quanto o corpo da lupa podem ser reposicionados livremente.
  - **Ampliação Real da Imagem e de Todos os Blocos Adicionados:** A lente circular fica **sempre acima de todos os elementos da imagem** (independentemente da ordem de criação) e recorta/amplia em tempo real tanto os pixels da imagem de fundo quanto **todos os blocos adicionados** sob ela (setas, traços/linhas, elipses, quadrados/retângulos, textos e imagens inseridas).
  - **Redimensionamento Livre Respeitando o Limite da Imagem:** Ao selecionar a lupa, surgem âncoras de redimensionamento ao redor da lente (deixando a parte inferior livre para a coroa de zoom), permitindo aumentar ou diminuir o espaço ocupado pela lupa conforme desejar, sempre respeitando automaticamente as bordas da imagem.
  - **Movimentação Livre:** Pode ser arrastada livremente dentro dos limites da imagem tanto logo após a criação quanto depois de redimensionar ou realizar zoom in / zoom out.
  - **Coroa Giratória Minimalista na Parte Inferior:** Na borda inferior da lupa há uma discreta coroa minimalista com ranhuras sutis. Ao clicar, segurar nessa coroa inferior e **arrastar para a esquerda**, o zoom diminui; ao **arrastar para a direita**, o zoom aumenta.
  - **Barra de Zoom Sob Demanda (Parte Inferior):** Enquanto você está clicando e movimentando a coroa para ajustar o zoom, uma barra minimalista de progresso e indicador numérico aparece na **parte de baixo** da lupa e desaparece automaticamente assim que você solta o mouse.
  - **Níveis de Zoom:** Varia do mínimo `1.0x` (tamanho normal idêntico à imagem original) até o máximo `3.0x` (3 vezes o tamanho), alternando de `0.5` em `0.5` (`1.0x`, `1.5x`, `2.0x`, `2.5x`, `3.0x`).

### 4.2. Reconhecimento Inteligente de Hover e Drag-and-Drop
- Quando você está com qualquer ferramenta de criação selecionada (qualquer bloco exceto o primeiro ponteiro de seleção):
  - **Mouse dentro da área de um bloco existente:** O editor reconhece automaticamente o bloco sob o cursor, muda o ponteiro para movimentação (`move` / Drag-and-Drop) e permite clicar e arrastar o bloco existente imediatamente.
  - **Mouse fora da área dos blocos adicionados:** O ponteiro permanece no modo de criação (`crosshair`) e clicar na área livre adiciona mais um bloco normalmente.

### 4.3. Controles de Estilo por Bloco, Opção "Auto", Multiseleção e Histórico
- **Alteração Independente de Cor e Espessura por Bloco:**
  - Ao selecionar qualquer bloco já presente na imagem e clicar em uma cor da paleta (Vermelho, Laranja, Verde, Azul, Roxo, Preto, Branco) ou alterar a espessura em pixels (`2px`, `3px`, `5px`, `8px`), **somente o(s) bloco(s) selecionado(s)** terão sua cor ou espessura modificada, sem interferir nos demais blocos da imagem.
- **Opção `"Auto"` ao Lado da Lista de Espessura (Pixels):**
  - Ao lado do seletor de pixels (`2px`, `3px`, `5px`, `8px`), o botão **`Auto`** permite escolher entre espessura automática proporcional ao redimensionamento (`strokeScaleEnabled: true`) ou espessura fixa em pixels (`strokeScaleEnabled: false`).
  - Se **`Auto`** estiver selecionado, todos os novos blocos adicionados recebem o ajuste automático de espessura ao redimensionar.
  - Se o usuário alterar manualmente a espessura da linha em pixels com um ou mais blocos selecionados, somente os blocos selecionados passam a usar aquela espessura fixa.
- **Multiseleção de Blocos (Clique e Arraste ou `Shift + Clique`):**
  - Com a ferramenta de ponteiro selecionada, basta **clicar na área livre e arrastar** para desenhar uma caixa de seleção e capturar diversos blocos de uma só vez (ou usar `Shift + Clique` em cada bloco).
  - Com múltiplos blocos selecionados, você pode **movimentar todos juntos**, **redimensionar o conjunto pelas âncoras**, **alterar cores e espessura de linha de todos de uma vez** ou **apagar todos com `Delete`**.
- **Excluir Bloco Selecionado (`Delete`):** Ao selecionar um ou mais blocos e pressionar a tecla **`Delete`** (ou `Backspace` fora da edição de texto), os blocos selecionados são apagados imediatamente.
- **Desfazer (Undo) e Refazer (Redo):** Atalhos `Ctrl+Z` (Desfazer) e `Ctrl+Shift+Z` / `Ctrl+Y` (Refazer) ou botões visuais na barra para reverter qualquer ação.
- **Desselecionar (`ESC`) e Salvar (`Ctrl+S`):** Pressionar `ESC` desmarca qualquer bloco selecionado mantendo os blocos móveis até que o usuário salve a imagem com `Ctrl+S` ou pelo menu Salvar/Exportar.

---

## 5. Galeria Lateral de Capturas Recentes (Sessões Independentes)

No painel esquerdo da aplicação, uma galeria visual organiza seus trabalhos recentes:

- **Independência Total por Imagem:** Cada captura ou imagem colada na galeria possui sua própria lista de blocos (formas, setas, textos, lupas) e seu próprio histórico `Ctrl+Z` / `Ctrl+Shift+Z`. Adicionar ou editar blocos em uma captura nunca interfere nas demais imagens da galeria.
- **Alternância Instantânea:** Clique em qualquer miniatura para trazê-la ao centro do canvas, restaurando automaticamente apenas as anotações daquela imagem específica.
- **Colagem Direta (`Ctrl+V`):** Você também pode colar imagens da área de transferência diretamente na seção de miniaturas pressionando `Ctrl+V`.
- **Contador com Limite Rígido (Máximo 10 Itens):**
  - A barra exibe o número de capturas abertas (ex: `3 / 10`).
  - **Política FIFO (First-In, First-Out):** Se você atingir o teto de 10 capturas e tirar ou colar uma 11ª imagem, a captura mais antiga da lista é automaticamente descartada da memória, garantindo que o programa nunca consuma memória excessiva do computador.
- **Fechamento Manual:** Cada miniatura possui um botão `X` no canto superior direito para fechar capturas que você já utilizou.

---

## 6. Copiar e Exportar (Ícones Minimalistas na Extrema Direita)

Na extrema direita da barra superior, ficam localizados dois ícones minimalistas dedicados às ações finais:

1. **Ícone de Copiar:**
   - Ao passar o mouse (hover), exibe a legenda **`"Copiar"`**.
   - Ao clicar, copia a captura com todas as anotações para a área de transferência e exibe imediatamente o aviso **`"Copiado"`** próximo ao ícone.
2. **Ícone de Disquete Minimalista (Exportar):**
   - Ao passar o mouse (hover), exibe a legenda **`"Exportar"`**.
   - Ao clicar no disquete, abre o seletor rápido de formato:
     - **Exportar como PNG:** Imagem sem perdas, ideal para interfaces gráficas e textos nítidos.
     - **Exportar como JPEG:** Imagem compactada com tamanho reduzido.
     - **Exportar como PDF:** Documento PDF proporcional à área capturada.

---

## 7. Controle de Instâncias (Máximo 2)

- Ao salvar um arquivo ou fechar uma captura, **a aplicação se mantém aberta em segundo plano**, pronta para o próximo print.
- É possível ter no máximo **2 janelas da aplicação abertas simultaneamente** (por exemplo, uma no monitor principal e outra no monitor secundário).
- Se o usuário tentar abrir uma 3ª janela, o sistema operacional foca automaticamente uma das janelas existentes e encerra o novo processo, evitando o acúmulo de processos redundantes na barra de tarefas.
