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

### 2.1. Captura com Vários Monitores (App Desktop)

No app desktop, ao iniciar uma captura de **Área** ou **Tela Inteira** o RenArt esconde a própria janela, congela todos os monitores e mostra uma camada de seleção em cada tela:

- **Área:** arraste no monitor que quiser. A seleção fica restrita àquele monitor.
- **Tela Inteira:** cada monitor aparece escurecido; ao passar o mouse sobre um deles surge uma **câmera** com "Clique para capturar esta tela". O clique captura aquele monitor.
- **Esc** cancela e devolve a janela do RenArt. O botão **Janela** aparece desativado ("Em breve").

No macOS é preciso liberar o RenArt (ou o terminal, durante o desenvolvimento) em *Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela*. Sem a permissão o app mostra um aviso explicando o caminho. No navegador continua valendo o fluxo anterior, dentro da própria janela.

> **Limite conhecido:** a captura multi-monitor foi validada apenas no macOS. No Windows e no Linux, monitores com escala diferente de 100% podem posicionar os overlays e a seleção de forma errada.

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
- **Flecha Vetorial com Menu Suspenso Horizontal de Estilos (Arrow):** Desenha setas com ponta automática. Ao clicar no ícone da flecha, abre-se um **menu suspenso horizontal flutuante** rente à barra com os 4 estilos (`Padrão`, `Fina`, `Pontilhada`, `Curva`) e o botão `Inverter arco` (quando curva).
- **Bloco de Texto com Menu Suspenso Horizontal de Fonte e Tamanho (Type):**
  - Insere caixas de texto sobre a imagem com edição direta inline no canvas (duplo clique, sem janelas modais).
  - **Menu Suspenso Horizontal Flutuante (`[Fonte ▾]` e `[Tamanho ▾]`):** Ao clicar no ícone de Texto, abre-se logo abaixo do ícone um menu suspenso horizontal rente à barra contendo os seletores dedicados de **Família da Fonte** (`Arial`, `Segoe UI`, `Calibri`, `Verdana`, `Georgia`, `Times New Roman`, `Courier New`) e **Tamanho da Fonte** (`12`, `14`, `16`, `18`, `20`, `24`, `28`, `32`, `36`, `48`), sem empurrar os botões da barra de ferramentas.
  - **Redimensionamento Automático em Degraus de Tamanho (`12` a `48`) Sem Distorção:** Ao redimensionar um bloco de texto pelas âncoras de canto no canvas, o texto nunca estica nem distorce: ele aumenta ou diminui automaticamente em degraus nos tamanhos de fonte (`12` a `48`).
- **Inserir Imagem / Figura (ImageIcon):** Permite anexar logos, selos, carimbos ou figuras externas sobre o print.
- **Ferramenta de Ocultação de Dados Confidenciais (ShieldAlert - Tarja e Blur):**
  - **Propósito:** Ocultar com segurança absoluta informações confidenciais (senhas, documentos, nomes, cartões).
  - **Menu Suspenso Horizontal Flutuante:** Ao clicar no ícone de proteção, abre-se um menu contextual com seletores de:
    - **Efeito Visual:**
      - **`Tarja` (Blackout):** Bloco preto 100% opaco (`#000000`). Padrão ouro de segurança em que os pixels originais deixam matematicamente de existir.
      - **`Blur` (Desfoque Destrutivo):** Filtro de desfoque de alta densidade (`blurRadius >= 20px`), destruindo a entropia dos caracteres e prevenindo ataques de desofuscação baseados em IA ou OCR reverso.
    - **Modo de Aplicação:**
      - **`Retângulo`:** Caixa retangular ajustável pelas alças nos 4 cantos para cobrir com precisão campos de texto e áreas delimitadas.
      - **`Pincel`:** Caneta de arraste livre com traçado contínuo arredondado para cobrir linhas de texto irregulares.
  - **Garantia de Irreversibilidade:** Tanto na cópia para o clipboard quanto na exportação (PNG, JPEG, PDF), o Canvas achata todas as anotações em uma imagem de bits plana, eliminando camadas vetoriais ou dados residuais.
- **Ferramenta de Lupa com Menu Suspenso Horizontal (Zoom Lens):**
  - **Menu Suspenso Horizontal Flutuante:** Ao clicar no ícone da Lupa, abre-se logo abaixo do ícone o menu suspenso com as opções:
    - **`Sem foco`:** Mantém a lupa tradicional que amplia diretamente a região sob a própria lente.
    - **`Com foco`:** Permite clicar no ponto exato que deseja focar e arrastar a lupa para qualquer canto da tela com rastro levemente fosco conectado à lente.
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
- **Paleta de Cores em Menu Suspenso Horizontal:**
  - Na barra de ferramentas, um botão minimalista com ícone de Paleta exibe um indicador sutil da cor atual. Ao clicar, surge um **menu suspenso horizontal flutuante** com as 7 cores disponíveis (Vermelho, Laranja, Verde, Azul, Roxo, Preto, Branco).
  - Clicar em uma cor aplica a cor nos blocos selecionados (ou define a cor para os próximos) e fecha o menu automaticamente. Clicar novamente no ícone ou fora do menu também o fecha.
- **Espessura de Linha em Pixels (`2px`, `3px`, `5px`, `8px`):**
  - Posicionada fixa ao lado da Paleta de Cores, permitindo escolher a espessura sem deslocar o layout.
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

### 4.4. Ajuste Automático à Tela (Fit to Screen) e Zoom Multiplataforma
- **Ajuste Automático sem Barras de Rolagem Iniciais:**
  - Ao colar imagens externas (`Ctrl+V`) ou abrir capturas com dimensões superiores à janela do usuário (ex: imagens Full HD ou 4K em notebooks de 13 ou 14 polegadas), a imagem calcula automaticamente uma escala proporcional (`fitScale`) para ficar **100% visível sem gerar barras de rolagem horizontais ou verticais**, preservando a nitidez total.
  - Imagens menores que a tela abrem centralizadas em tamanho nativo (`100%`).
- **Controles de Zoom na Barra Superior:**
  - Posicionados logo após os botões de Desfazer e Refazer, separados por um divisor visual (`|`):
    - `[-]`: Reduz o zoom em degraus lógicos (até o mínimo de `25%`).
    - `[ 100% ]`: Botão indicador de percentual que, ao ser clicado, alterna instantaneamente entre o ajuste à tela e `100%` (ou atalho `Ctrl/Cmd 0`).
    - `[+]`: Aumenta o zoom em degraus lógicos (até o máximo de `400%`).
- **Atalhos de Teclado, Mouse e Trackpad:**
  - **Teclado:** `Ctrl +` e `Ctrl -` (Windows/Linux) ou `Cmd +` e `Cmd -` (macOS) para ampliar e diminuir o zoom; `Ctrl 0` ou `Cmd 0` para redefinir.
  - **Mouse:** `Ctrl + Roda do Mouse` (scroll wheel) amplia ou reduz suavemente.
  - **Trackpad:** Gesto de pinça (pinch-to-zoom) amplia e reduz a imagem diretamente.
  - **Interceptação Inteligente:** A aplicação intercepta os eventos com `{ passive: false }` e cancela o zoom padrão de página do navegador/WebView2, mantendo toda a interface e os botões fixos no tamanho correto enquanto apenas a imagem e suas anotações sofrem zoom.
  - **Barras de Rolagem Sob Demanda:** As barras de rolagem aparecem de forma fluida apenas quando o usuário aplica zoom além dos limites visíveis da janela.

### 4.5. Ferramenta de Recorte (Crop Mode) Estilo Windows
- **Ativação:** Clique no botão de Recorte (**Crop**) na barra de ferramentas.
- **Moldura Interativa com 8 Alças:** Um quadro delimitador surge sobre a imagem acompanhado de 8 alças (cantos e laterais) e uma máscara semi-transparente escurecida que cobre a área descartada, permitindo ajustar a região com precisão cirúrgica ou arrastar a caixa inteira.
- **Ações na Barra Superior:**
  - Botão verde **`[✓ Confirmar]`** (ou atalho **`Enter`**): Aplica o recorte na imagem base via Canvas 2D, atualiza a miniatura correspondente na galeria, reposiciona (translada) as anotações contidas dentro do corte e descarta anotações externas.
  - Botão vermelho **`[✕ Cancelar]`** (ou atalho **`ESC`**): Descarta o quadro de recorte e retorna à ferramenta de seleção sem alterar a imagem.
- **Compatibilidade com Histórico (Undo/Redo):** A alteração de anotações e da imagem de fundo é gravada no histórico, permitindo reverter com `Ctrl+Z` a qualquer momento.

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

---

## 8. Distribuição e Empacotamento: Versões Instalável e Portátil (Portable)

A aplicação suporta distribuição em duas modalidades oficiais para atender a todos os perfis de usuário:

### 8.1. Modalidade Portátil (Portable - Sem Instalação)
Ideal para usuários que buscam praticidade máxima, uso corporativo sem privilégios de administrador ou execução a partir de pendrives e pastas em nuvem (Google Drive, OneDrive):
- **Windows (`.exe` avulso ou `.zip` portátil):** O binário nativo compilado pelo Tauri (`src-tauri/target/release/Ferramenta de Captura.exe`) é um executável autônomo. Basta dar dois cliques para abrir instantaneamente, sem exigir telas de instalação (*Avançar > Concluir*), sem permissão de Administrador e sem criar entradas no Registro do Windows.
- **Linux (`.AppImage`):** Formato portátil oficial de Linux. O usuário apenas baixa o arquivo `.AppImage`, concede permissão de execução (`chmod +x`) e roda diretamente em distribuições como Ubuntu, Debian, Fedora e Mint.
- **macOS (`.app` em `.zip`):** O pacote de aplicativo `.app` pode ser compactado em `.zip` e executado de qualquer pasta local ou mídia externa sem necessidade de instalação no diretório `/Applications`.

### 8.2. Modalidade Instalador Padrão (Installer)
Para quem prefere a experiência tradicional com atalho automático no Menu Iniciar, na Área de Trabalho e desinstalador no Painel de Controle:
- **Windows:** Instalador executável via NSIS ou pacote `.msi`.
- **macOS:** Imagem de disco `.dmg` com atalho de arrastar para `/Applications`.
- **Linux:** Pacote `.deb` para distribuições Debian/Ubuntu.
