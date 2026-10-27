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
- **Flecha Vetorial (Arrow):** Desenha setas com ponta automática. Ideal para indicar botões, erros ou áreas de interesse em tutoriais.
- **Bloco de Texto (Type):** Insere caixas de texto com tamanho de fonte e cores customizáveis sobre a imagem (edição direta inline no canvas com duplo clique, sem janelas modais).
- **Inserir Imagem / Figura (ImageIcon):** Permite anexar logos, selos, carimbos ou figuras externas sobre o print.
- **Ferramenta de Lupa com Coroa Giratória (Zoom Lens):**
  - **Ampliação Real:** A lente circular recorta e amplia em tempo real os pixels da imagem que estão exatamente sob sua área.
  - **Coroa Giratória ("Coroa Giratória"):** Ao redor da lupa há um aro dentado giratório com um seletor inferior (`◀ 2.0x ▶`). Ao clicar, segurar na coroa/seletor e **arrastar para a esquerda**, o zoom diminui; ao **arrastar para a direita**, o zoom aumenta, girando visualmente a coroa.
  - **Níveis de Zoom:** Varia do mínimo `1.0x` (tamanho normal idêntico à imagem original) até o máximo `3.0x` (3 vezes o tamanho), alternando de `0.5` em `0.5` (`1.0x`, `1.5x`, `2.0x`, `2.5x`, `3.0x`).

### 4.2. Reconhecimento Inteligente de Hover e Drag-and-Drop
- Quando você está com qualquer ferramenta de criação selecionada (qualquer bloco exceto o primeiro ponteiro de seleção):
  - **Mouse dentro da área de um bloco existente:** O editor reconhece automaticamente o bloco sob o cursor, muda o ponteiro para movimentação (`move` / Drag-and-Drop) e permite clicar e arrastar o bloco existente imediatamente.
  - **Mouse fora da área dos blocos adicionados:** O ponteiro permanece no modo de criação (`crosshair`) e clicar na área livre adiciona mais um bloco normalmente.

### 4.3. Controles de Estilo e Histórico
- **Paleta de Cores:** Vermelho, Laranja, Verde, Azul, Roxo, Preto e Branco.
- **Espessura do Traço:** 2px, 3px, 5px e 8px.
- **Desfazer (Undo) e Refazer (Redo):** Atalhos `Ctrl+Z` (Desfazer) e `Ctrl+Shift+Z` / `Ctrl+Y` (Refazer) ou botões visuais na barra para reverter qualquer ação.
- **Desselecionar (`ESC`) e Salvar (`Ctrl+S`):** Pressionar `ESC` desmarca qualquer bloco selecionado mantendo os blocos móveis até que o usuário salve a imagem com `Ctrl+S` ou pelo menu Salvar/Exportar.

---

## 5. Galeria Lateral de Capturas Recentes

No painel esquerdo da aplicação, uma galeria visual organiza seus trabalhos recentes:

- **Alternância Instantânea:** Clique em qualquer miniatura para trazê-la ao centro do canvas, mantendo todas as anotações feitas.
- **Colagem Direta (`Ctrl+V`):** Você também pode colar imagens da área de transferência diretamente na seção de miniaturas pressionando `Ctrl+V`.
- **Contador com Limite Rígido (Máximo 10 Itens):**
  - A barra exibe o número de capturas abertas (ex: `3 / 10`).
  - **Política FIFO (First-In, First-Out):** Se você atingir o teto de 10 capturas e tirar ou colar uma 11ª imagem, a captura mais antiga da lista é automaticamente descartada da memória, garantindo que o programa nunca consuma memória excessiva do computador.
- **Fechamento Manual:** Cada miniatura possui um botão `X` no canto superior direito para fechar capturas que você já utilizou.

---

## 6. Exportação e Salvamento

No canto direito da barra superior, o menu **💾 Exportar** oferece três opções:

1. **Exportar como PNG:** Imagem com compressão sem perdas, ideal para interfaces gráficas e textos nítidos.
2. **Exportar como JPEG / JPG:** Imagem otimizada com tamanho de arquivo reduzido.
3. **Exportar como PDF:** Gera um documento PDF vetorial com a proporção exata da captura de tela (em folha paisagem ou retrato proporcional), pronto para anexar em relatórios técnicos ou documentações.
4. **Copiar com Anotações (Botão Copiar):** Renderiza o print final com todas as formas, setas e textos desenhados e substitui o conteúdo da área de transferência.

---

## 7. Controle de Instâncias (Máximo 2)

- Ao salvar um arquivo ou fechar uma captura, **a aplicação se mantém aberta em segundo plano**, pronta para o próximo print.
- É possível ter no máximo **2 janelas da aplicação abertas simultaneamente** (por exemplo, uma no monitor principal e outra no monitor secundário).
- Se o usuário tentar abrir uma 3ª janela, o sistema operacional foca automaticamente uma das janelas existentes e encerra o novo processo, evitando o acúmulo de processos redundantes na barra de tarefas.
