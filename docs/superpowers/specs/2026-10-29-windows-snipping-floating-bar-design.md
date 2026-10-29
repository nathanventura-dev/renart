# Especificação de Design: Barra Flutuante de Captura (Estilo Windows Snipping Tool) e Menu Minimalista

**Data:** 2026-10-29  
**Status:** Proposto  
**Abordagem Selecionada:** Abordagem 1 (Menu Contextual à Direita + Barra Flutuante Superior Unificada)

---

## 1. Visão Geral e Motivação

O objetivo é alinhar a experiência de captura da aplicação com o padrão moderno da **Ferramenta de Captura do Windows (Windows Snipping Tool)**:
1. Permitir que o usuário escolha entre diferentes tipos de captura:
   - **Área Retangular** (seleção manual com clique e arraste).
   - **Janela** (usando o seletor nativo do sistema operacional para escolher uma janela específica de qualquer aplicativo).
   - **Tela Inteira** (captura instantânea do monitor).
2. Fornecer uma **Barra Flutuante Superior** suspensa no topo da tela durante a captura com os 3 modos e um botão **"X"** para cancelar.
3. Reposicionar e estilizar o botão **"Nova Captura"** na barra de ferramentas da aplicação:
   - Visual minimalista translúcido idêntico ao padrão refinado das ferramentas de recorte.
   - Menu suspenso abrindo à **direita** do botão, mantendo a galeria lateral esquerda totalmente desobstruída e visível.

---

## 2. Abordagens Consideradas

- **Abordagem 1 (Selecionada): Menu Flutuante à Direita + Barra Flutuante Superior Unificada**
  - O botão na Toolbar abre um menu compacto projetado para o lado direito da barra.
  - Ao entrar em modo de captura, o overlay exibe uma barra flutuante no topo centralizado permitindo alternar de modo ou cancelar via "X".
  - *Vantagem:* Acesso rápido e intuitivo em dois pontos, sem poluição visual e sem cobrir miniaturas da galeria.
- **Abordagem 2: Split Button com Diálogo Central de Configuração**
  - Botão dividido na Toolbar (metade dispara direto, metade abre menu).
  - *Desvantagem:* Mais cliques e maior densidade de controles, contrariando o minimalismo desejado.

---

## 3. Arquitetura e Componentes

### 3.1. Botão Minimalista e Menu de Captura à Direita na `Toolbar.tsx`

1. **Estilo do Botão "Nova Captura":**
   - Altura uniforme com a barra (`36px`), cantos arredondados de `6px`.
   - Fundo translúcido `rgba(0, 0, 0, 0.05)` (hover `rgba(0, 0, 0, 0.09)`), borda sutil `1px solid rgba(0, 0, 0, 0.08)`.
   - Ícone de câmera/tesoura acompanhado do texto "Nova Captura" e um pequeno chevron indicador de opções.
2. **Posicionamento do Menu Suspenso (`OpenToolbarMenu === 'capture'`):**
   - Em vez de abrir abaixo cobrindo a coluna esquerda da galeria, o menu abre como um flyout horizontal/vertical projetado para a **direita** (`left: 100%`, `marginLeft: 8px` ou alinhado de forma a utilizar a área livre da toolbar central).
   - Itens do menu:
     - 🔲 **Área Retangular** (Atalho: `Ctrl+Shift+S`)
     - 🪟 **Janela** (Seletor nativo do SO)
     - 🖥️ **Tela Inteira** (Monitor completo)
3. **Comportamento:**
   - Fechamento com clique fora ou tecla `Esc`.
   - Clique em qualquer opção dispara a captura no modo correspondente.

---

### 3.2. Barra Flutuante de Captura em `CaptureOverlay.tsx`

1. **Posicionamento e Estilo Visual (Windows 11 Fluent / Acrylic):**
   - `position: fixed`, `top: 20px`, `left: 50%`, `transform: translateX(-50%)`, `zIndex: 10002`.
   - Fundo: `rgba(32, 33, 36, 0.92)` com `backdrop-filter: blur(16px)` e sombra suave `0 8px 32px rgba(0,0,0,0.36)`.
   - Borda: `1px solid rgba(255, 255, 255, 0.12)`.
   - Raio: `10px`. Altura: `44px`.
2. **Botões de Modo e Ações:**
   - **Botão 1 (Área Retangular):** Ícone `SquareDashed` ou retângulo pontilhado. Fica como *pills* ativo quando o modo atual for `region`.
   - **Botão 2 (Janela):** Ícone `AppWindow` / Janela. Dispara a captura de janela nativa do SO.
   - **Botão 3 (Tela Inteira):** Ícone `Monitor` / Tela. Captura instantaneamente a tela inteira.
   - **Separador Vertical:** Linha sutil `1px solid rgba(255,255,255,0.15)`, altura `20px`.
   - **Botão 4 (Fechar / Cancelar "X"):** Ícone `X`. Hover vermelho sutil (`rgba(255, 59, 48, 0.2)`). Fecha o overlay e cancela a operação imediatamente.
3. **Feedback e Atalhos:**
   - Tooltips discretos em hover em cada botão ("Área retangular", "Capturar janela", "Tela inteira", "Cancelar (Esc)").
   - Tecla `Escape`: cancela e fecha o overlay.

---

### 3.3. Integração com o Sistema Operacional em `screenCaptureService.ts`

1. **Modo Janela Nativo:**
   - A função `captureDesktopFrame(displaySurface?: 'monitor' | 'window')` passa `displaySurface: 'window'` para `navigator.mediaDevices.getDisplayMedia`.
   - Os navegadores e ambientes Electron/Tauri abrem nativamente a caixa de diálogo do sistema operacional (Windows, macOS ou Linux) listando todas as janelas abertas para escolha direta do usuário.
   - Ao selecionar a janela, o quadro é capturado na resolução nativa exata da janela e entregue imediatamente para a galeria do editor.
2. **Modo Tela Inteira:**
   - `captureDesktopFrame('monitor')` captura o display principal e adiciona a nova captura à galeria sem exigir arraste manual.
3. **Modo Área:**
   - Congela o quadro da tela e permite a seleção por arraste de caixa com feedback de dimensões.

---

## 4. Testes e Critérios de Aceite

1. **Testes Unitários da Toolbar (`tests/toolbarMenus.test.ts`):**
   - Menu de captura abre e fecha com alternância correta e exclusividade em relação a outros menus.
   - Métricas de layout garantem que o menu de captura abra à direita, sem sobrepor a galeria.
2. **Testes do Overlay e Barra Flutuante (`tests/appFeatures.test.ts` e `tests/integration.test.ts`):**
   - Barra flutuante renderiza os botões de Área, Janela, Tela Inteira e botão X.
   - Alternância de modo em tempo real funciona sem travar a aplicação.
   - O botão "X" e o atalho `Esc` cancelam o overlay limpando o estado `isCapturing`.
   - Captura de janela e tela inteira encaminham os dados diretamente para o `galleryStore`.
3. **Qualidade:**
   - 100% dos testes da suíte passando (136+).
   - `tsc --noEmit` sem erros.
   - `npm run build` gerando bundle limpo.
