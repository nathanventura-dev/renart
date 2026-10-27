# Design Doc: Ferramenta de Captura Multiplataforma (Windows, macOS, Linux)

**Data:** 2026-10-26  
**Status:** Pronto para Aprovação  
**Autor:** Antigravity & Usuário  

---

## 1. Contexto e Motivação (Intent & Why)

A ferramenta nativa de captura do Windows (Snipping Tool / Ferramenta de Captura) é amplamente elogiada pela sua simplicidade e agilidade, mas está restrita ao ambiente Windows. Usuários que alternam entre Windows, macOS e Linux sentem falta de uma experiência consistente, rápida e discreta que una captura de tela inteligente a recursos diretos de anotação (formas, setas, textos, lupa de destaque e inserção de imagens), com salvamento/exportação em múltiplos formatos.

O objetivo deste projeto é criar uma ferramenta de captura de tela de código aberto, leve, de alta performance e multiplataforma, acompanhada de documentação detalhada e didática em português para facilitar a compreensão, manutenção e evolução contínua da aplicação por qualquer pessoa, mesmo sem domínio prévio em Rust.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos (Goals)
1. **Multiplataforma:** Suporte oficial e empacotamento para Windows (10/11), macOS (Intel e Apple Silicon) e Linux (suportando X11 e Wayland).
2. **Modos de Captura:**
   - **Região:** Seleção retangular de área da tela.
   - **Formato Livre:** Desenho à mão livre da área de corte.
   - **Tela Inteira:** Captura instantânea do monitor ativo ou de todos os monitores.
3. **Editor e Pré-visualização com Canvas:**
   - **Cópia Automática Imediata:** Assim que o corte/captura é finalizado, a imagem é imediatamente colocada na área de transferência do SO (permitindo colar direto com Ctrl+V / Cmd+V em qualquer app sem precisar abrir o editor ou salvar).
   - Barra superior com ferramentas de anotação:
     - Formas geométricas (retângulos, elipses) com âncoras para redimensionamento e rotação.
     - Flechas/setas vetoriais para apontamento e destaque.
     - Blocos de texto editáveis e reposicionáveis.
     - Inserção de imagens/figuras externas sobre a captura.
     - Ferramenta de Lupa (zoom lens circular destacando e ampliando a área selecionada).
     - Desfazer / Refazer (Undo/Redo).
     - Botão rápido de copiar imagem editada para a área de transferência (para copiar as anotações posteriores).
     - Exportação para formatos: PNG, JPEG, JPG e PDF.
4. **Galeria de Capturas (Painel Lateral Esquerdo):**
   - Miniaturas das capturas recentes com troca instantânea de contexto.
   - Limite estrito de no máximo **10 capturas abertas simultaneamente** na memória/galeria (com política FIFO de substituição da mais antiga não salva ou aviso prévio).
5. **Ciclo de Vida e Instâncias:**
   - A aplicação permanece aberta após salvar um arquivo, pronta para novas capturas.
   - Suporte a no máximo **2 instâncias abertas simultaneamente**. Se o usuário tentar abrir uma 3ª instância, a aplicação redireciona o foco para uma das instâncias existentes sem abrir uma nova janela redundante.
6. **Documentação Didática Obrigatória (em `docs/`):**
   - `docs/arquitetura-e-tecnologias.md`: Explicação da arquitetura geral e justificativa técnica das escolhas.
   - `docs/guia-rust-e-backend.md`: Explicação didática bloco a bloco do código em Rust, detalhando o funcionamento de cada módulo nativo.
   - `docs/manual-de-funcionamento-e-fluxo.md`: Manual operacional de uso, fluxos, atalhos e limites do sistema.

### Não-Objetivos (Non-Goals)
- Gravação de vídeo/áudio ou criação de GIFs (escopo focado estritamente em captura estática e anotação).
- Reconhecimento óptico de caracteres (OCR) na versão inicial (pode ser considerado como melhoria futura).
- Sincronização em nuvem própria ou autenticação de contas de usuário (armazenamento estritamente local e privado).

### Anti-Objetivos (Anti-Goals)
- Criar uma aplicação pesada (>100MB) ou de inicialização lenta que consuma centenas de megabytes de RAM em segundo plano (como ocorre frequentemente com soluções baseadas em Electron puro).
- Implementar fluxos complexos de edição de fotos estilo Photoshop; o foco deve ser rapidez, anotação objetiva e clareza.

---

## 3. Restrições e Requisitos de Sistema

- **Permissões do Sistema Operacional:**
  - macOS: Necessidade de permissão de gravação de tela (`Screen Recording`) via permissões de acessibilidade/segurança do macOS.
  - Linux: Compatibilidade com sessões Wayland (via `xdg-desktop-portal` e PipeWire) e X11.
  - Windows: Execução sem necessidade de privilégios de Administrador.
- **Leveza:** O consumo de memória em repouso deve permanecer preferencialmente abaixo de 60 MB de RAM.
- **Ambiente de Desenvolvimento:** Deve ser documentado passo a passo para que um iniciante consiga instalar as ferramentas e rodar em modo de desenvolvimento.

---

## 4. Abordagens Consideradas e Decisão

### Abordagem 1: Tauri v2 + Rust + React/TypeScript com Konva.js *(ESCOLHIDA)*
- **Descrição:** Backend nativo em Rust responsável por captura de tela de baixo nível (usando `xcap`), escuta de atalhos globais, controle de instâncias via IPC e escrita de arquivos no disco. Frontend em React e Konva.js (Canvas 2D) rodando sobre a webview nativa do SO.
- **Vantagens:** 
  - Binário compacto (~15 a 20 MB).
  - Consumo mínimo de memória (~30 a 50 MB de RAM).
  - Inicialização quase imediata para captura instantânea.
  - Sistema de auto-update seguro integrado via `@tauri-apps/plugin-updater`.
- **Desvantagens:** Requer Rust instalado no ambiente do desenvolvedor para compilação local (mitigado por GitHub Actions no CI/CD).
- **Decisão:** Escolhida por entregar a melhor experiência para um utilitário nativo de sistema operacional.

### Abordagem 2: Electron + Node.js + React/TypeScript com Konva.js *(REJEITADA)*
- **Descrição:** Uso de Chromium e Node.js para encapsular a aplicação e usar a API `desktopCapturer`.
- **Desvantagens:** Binário volumoso (>100 MB), consumo de memória excessivo (150-250 MB), descaracterizando a leveza esperada de uma ferramenta nativa de captura.

---

## 5. Arquitetura e Estrutura dos Módulos

### 5.1. Backend Rust (Tauri Core)
- **`capture_service`:** Utiliza a crate `xcap` para interagir com as telas do sistema e obter o buffer de pixels dos monitores de forma eficiente e multiplataforma.
- **`instance_manager`:** Utiliza socket local (IPC) ou mecanismo nativo (named pipe no Windows, unix domain socket no Linux/macOS) para rastrear o número de instâncias ativas. Permite até 2 instâncias; na tentativa de abertura da 3ª, envia um sinal para focar a janela ativa existente e encerra a nova chamada.
- **`shortcut_manager`:** Registra e gerencia atalhos globais (ex: atalho padrão configurável para disparar a captura a qualquer momento).
- **`export_service`:** Recebe buffers do canvas ou realiza a conversão e escrita em disco nos formatos PNG, JPEG/JPG e PDF.

### 5.2. Frontend Web (React + TypeScript + Konva.js)
- **Overlay de Captura:**
  - Janela transparente cobrindo a tela capturada onde o usuário define a área de corte (Retângulo, Corte Livre ou Tela Inteira) com guias visuais e coordenadas.
- **Janela do Editor (Workspace):**
  - **Barra Superior:**
    - Seletor de Nova Captura.
    - Ferramentas de anotação: Retângulo/Elipse com âncoras (Transformer), Seta vetorial com ponta ajustável, Bloco de texto inline, Inserção de imagens/figuras locais, Lupa com ampliação ajustável (ex: 2x ou 3x).
    - Paleta de cores, espessura de traço e tamanho de fonte.
    - Controles de Desfazer/Refazer.
    - Ações de Copiar para Clipboard e Exportar (PNG, JPEG, JPG, PDF).
  - **Painel Lateral Esquerdo (Galeria de Capturas):**
    - Lista visual das capturas ativas (thumbnails).
    - Contador indicador (ex: `N / 10`).
    - Ao capturar a 11ª imagem, aplica descarte automático (FIFO) do item mais antigo não salvo (ou com opção de aviso nas configurações).
    - Botão de fechar item individual da galeria.
  - **Canvas Central:**
    - Renderização via Konva.js em camada dupla (camada base com a imagem de fundo estática + camada interativa com objetos vetoriais manipuláveis).

### 5.3. Documentação Didática (`docs/`)
Serão entregues 3 guias detalhados:
1. `docs/arquitetura-e-tecnologias.md`: Visão técnica, papel do Tauri v2, comunicação frontend/backend e motivos de escolha.
2. `docs/guia-rust-e-backend.md`: Análise comentada bloco a bloco do código em Rust, explicando conceitos como crates, funções Tauri commands, IPC e manipulação de memória.
3. `docs/manual-de-funcionamento-e-fluxo.md`: Guia de utilização, atalhos, fluxo de captura, limites e exportação.

---

## 6. O que Fica a Critério do Construtor (Builder's Discretion)

- Estrutura visual exata dos ícones (ex: Lucide Icons ou Feather Icons).
- Detalhes de implementação da geração de PDF no cliente (`jspdf` / `pdf-lib`) vs backend nativo.
- Paleta padrão de cores de anotação (vermelho, amarelo, azul, verde, branco, preto).
- Atalho padrão de teclado para captura rápida de região (sugestão inicial: `Ctrl+Shift+S` no Windows/Linux e `Cmd+Shift+S` no macOS).
