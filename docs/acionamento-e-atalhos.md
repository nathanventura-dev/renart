# Guia de Acionamento, Atalhos e Integração com o Sistema

**Aplicação:** Ferramenta de Captura Multiplataforma  
**Plataformas Suportadas:** Windows 10/11, macOS, Linux (X11 / Wayland)  

Este documento descreve detalhadamente como a aplicação pode ser acionada, como configurá-la como a ferramenta de captura padrão do sistema operacional e a lista completa de atalhos suportados.

---

## 1. Modos de Acionamento da Aplicação

Quando instalada, a aplicação pode ser disparada através de **5 canais complementares**, projetados para diferentes fluxos de trabalho:

```
                      +-----------------------------------+
                      |      CANAIS DE ACIONAMENTO        |
                      +-----------------------------------+
                                        |
       +------------------+-------------+-------------+------------------+
       |                  |                           |                  |
       ▼                  ▼                           ▼                  ▼
[Atalho Global]    [Bandeja (Tray)]           [Lançador do SO]       [Linha de Comando]
(PrtScn / Hotkey)  (Ícone no Relógio)         (Iniciar / Spotlight)  (Scripts / Macros)
       │                  │                           │                  │
       +------------------+-------------+-------------+------------------+
                                        │
                                        ▼
                   +-----------------------------------------+
                   |   Barra Flutuante de Captura (Overlay)  |
                   |   - Área / Retângulo                    |
                   |   - Janela Nativa                       |
                   |   - Tela Inteira                        |
                   +-----------------------------------------+
```

### 1.1. Atalhos Globais de Teclado (Global Hotkeys)
- Mesmo que o aplicativo esteja minimizado ou rodando em segundo plano enquanto você utiliza outro software ou jogo em tela cheia, pressionar o atalho global aciona imediatamente o **Overlay de Captura** com a **Barra Flutuante**.
- O hook global é gerenciado em nível de sistema operacional através do core em Rust (Tauri), garantindo resposta em poucos milissegundos sem travamentos.

### 1.2. Ícone na Bandeja do Sistema (System Tray / Menu Bar)
- Um ícone residente na barra de menus superior do macOS (monocromático: o sistema o pinta de claro ou escuro conforme o tema). Validado apenas no macOS; no Windows e no Linux o código compila, mas a bandeja não foi testada (no Linux ela também depende do ambiente de desktop).
- **Qualquer clique** no ícone abre o menu (padrão do macOS):
  - *Nova Captura* ▸ *Área*, *Janela*, *Tela Inteira* — inicia a captura na hora, **sem mostrar a janela do editor**.
  - *Abrir RenArt* — mostra e foca a janela do editor, com a galeria e a última captura.
  - *Sair* — encerra o aplicativo.
- **Fechar a janela do editor** (o X ou `Cmd+W`) apenas a esconde: o RenArt continua na bandeja, e o atalho global `Cmd+Shift+S` segue funcionando. Para reabrir, use *Abrir RenArt* ou clique no ícone do Dock. `Cmd+Q` também encerra o app.
- Se a captura não puder começar (por exemplo, sem a permissão de Gravação de Tela), a janela abre com um aviso explicando como resolver.

### 1.3. Lançador de Aplicativos / Menu Iniciar
- Como qualquer software desktop instalado, o aplicativo pode ser aberto pelo **Menu Iniciar** (Windows), **Spotlight / Launchpad** (`Cmd + Espaço` no macOS) ou lançador de aplicativos do Linux (GNOME Dash, KRunner, Rofi).

### 1.4. Linha de Comando (CLI / Automações e Dispositivos Externos)
- A aplicação pode ser disparada via terminal, scripts em lote (`.bat`, `.sh`, `.ps1`) ou vinculada a botões programáveis de teclados macro, mesas digitalizadoras ou controles (ex.: Elgato Stream Deck):
  ```bash
  # Captura interativa por região (padrão)
  ferramenta-captura --mode region

  # Captura de janela nativa do SO
  ferramenta-captura --mode window

  # Captura instantânea de tela inteira
  ferramenta-captura --mode fullscreen
  ```

### 1.5. Botão "Nova Captura" no Editor
- Dentro da própria janela de edição, o botão minimalista com ícone de câmera na barra de ferramentas permite alternar e iniciar capturas nos modos **Área**, **Janela** ou **Tela Inteira** a qualquer momento.

---

## 2. Como Configurar como Ferramenta Padrão de Captura

Cada sistema operacional gerencia as capturas de tela através de mecanismos próprios. A aplicação está preparada para assumir a captura padrão em todos eles:

### 2.1. No Windows 10 e Windows 11
O Windows permite vincular a tecla **PrintScreen** (`PrtScn`) a aplicativos de terceiros:
1. Abra as **Configurações do Windows** (`Win + I`).
2. Vá em **Acessibilidade** > **Teclado**.
3. Localize e **desative** a opção:  
   > *"Usar o botão Impr Pant para abrir a captura de tela"* (ou *"Use the Print screen button to open screen snipping"*).
4. Ao desativar o aplicativo nativo do Windows, a nossa aplicação registra o atalho global `PrintScreen` via hook do sistema e passa a ser acionada instantaneamente sempre que a tecla for pressionada.
5. O instalador (`.msi` / `.exe`) também configura a inicialização automática junto ao sistema operacional (*Autostart*), mantendo a ferramenta sempre pronta para uso.

### 2.2. No macOS
Por padrão, o macOS reserva combinações como `Cmd + Shift + 4`:
1. Abra **Ajustes do Sistema** > **Teclado** > **Atalhos de Teclado...**
2. No menu lateral, clique em **Capturas de Tela**.
3. Desmarque as caixas correspondentes a:
   - *"Salvar imagem da área selecionada como um arquivo"* (`Cmd + Shift + 4`)
   - *"Salvar imagem da tela como um arquivo"* (`Cmd + Shift + 3`)
4. Em seguida, abra a Ferramenta de Captura e defina o atalho desejado. O macOS solicitará permissão de **Gravação de Tela** (*Screen Recording*) nas opções de Privacidade e Segurança para que a captura de pixels seja autorizada.

### 2.3. No Linux (GNOME, KDE Plasma, X11 e Wayland)
No Linux, o gerenciador de janelas permite remapear a tecla `Print` com total flexibilidade:
1. Abra as **Configurações do Sistema** > **Teclado** > **Atalhos de Teclado**.
2. Na seção de capturas, remova o atalho nativo da tecla `Print`.
3. Adicione um **Atalho Personalizado**:
   - **Nome:** Ferramenta de Captura
   - **Comando:** `ferramenta-captura` (ou o caminho do executável / AppImage)
   - **Atalho:** Pressione a tecla `PrintScreen`.

---

## 3. Tabela Completa de Atalhos por Sistema Operacional

### 3.1. Atalhos Globais de Acionamento (fora da janela)

| Sistema | Atalho Recomendado | Ação |
| :--- | :--- | :--- |
| **Windows** | `PrintScreen` (PrtScn) | Abre a barra flutuante / captura rápida |
| | `Win + Shift + S` | Captura estilo Snipping Tool |
| | `Alt + PrintScreen` | Captura direta da janela ativa |
| **macOS** | `Cmd + Shift + 4` | Captura de área retangular |
| | `Cmd + Shift + 3` | Captura da tela inteira |
| | `Cmd + Shift + 5` | Abre a barra flutuante de opções |
| **Linux** | `PrintScreen` | Abre a barra flutuante / tela inteira |
| | `Shift + PrintScreen` | Captura de área selecionada |
| | `Alt + PrintScreen` | Captura da janela ativa |

*(Todos os atalhos globais são livremente reconfiguráveis nas opções do aplicativo).*

---

### 3.2. Atalhos na Barra Flutuante de Captura (Overlay Ativo)

Quando o overlay translúcido surge na tela, os seguintes atalhos controlam a captura:

| Tecla / Atalho | Ação |
| :--- | :--- |
| `1` ou `R` | Seleciona o modo de **Área** (Retângulo livre) |
| `2` ou `W` | Seleciona o modo de **Janela** (Seletor nativo do SO) |
| `3` ou `F` | Seleciona o modo de **Tela Inteira** |
| `Esc` | **Cancela** a captura imediatamente e fecha o overlay |

---

### 3.3. Atalhos Dentro do Editor de Imagens (Canvas)

#### A. Ações de Arquivo e Exportação
| Atalho | Ação |
| :--- | :--- |
| `Ctrl + C` / `Cmd + C` | Copia a imagem renderizada com anotações para o Clipboard do sistema |
| `Ctrl + S` / `Cmd + S` | Abre o menu de exportação (.png, .jpeg, .pdf) |

#### B. Histórico e Edição
| Atalho | Ação |
| :--- | :--- |
| `Ctrl + Z` / `Cmd + Z` | Desfazer última anotação ou alteração (Undo) |
| `Ctrl + Shift + Z` / `Cmd + Shift + Z` ou `Ctrl + Y` | Refazer ação desfeita (Redo) |
| `Delete` ou `Backspace` | Exclui a anotação selecionada |
| `Clique Duplo (Elipse)` | Transforma instantaneamente a elipse em um **círculo perfeito** |
| `Clique Duplo (Alça de Rotação)` | Restaura o ângulo da forma para `0°` (alinhamento original) |

#### C. Ferramenta de Recorte (Crop)
| Atalho | Ação |
| :--- | :--- |
| `Enter` (`↵`) | Confirma o recorte da imagem pela área demarcada |
| `Esc` | Cancela o recorte e descarta o quadro de crop |

#### D. Navegação e Níveis de Zoom
| Atalho | Ação |
| :--- | :--- |
| `Ctrl + +` / `Cmd + +` | Aumentar Zoom (Zoom In) |
| `Ctrl + -` / `Cmd + -` | Diminuir Zoom (Zoom Out) |
| `Ctrl + 0` / `Cmd + 0` | Ajustar à tela / Zoom 100% |
| `Ctrl + Scroll do Mouse` | Zoom suave centrado na posição do cursor |

#### E. Teclas de Seleção Rápida de Ferramentas
| Tecla | Ferramenta Ativada |
| :--- | :--- |
| `V` | Seleção e manipulação de formas |
| `R` | Retângulo |
| `C` | Círculo / Elipse |
| `A` | Seta / Flecha vetorial |
| `T` | Texto inline com edição direta |
| `L` ou `M` | Lupa de Zoom (Com foco ou Sem foco) |
| `K` | Ferramenta de Recorte (Crop) |
| `Shift (durante desenho/redimensionamento)` | Trava proporção 1:1 (quadrado/círculo) ou eixos retos (0°, 45°, 90°) |
