# Especificação Técnica: Anonimização Contextual Inteligente de Texto (Smart OCR Anonymization)

## 1. Visão Geral e Objetivo
Permitir que usuários ocultem dados sensíveis (nomes, e-mails, valores monetários, datas e parágrafos) em capturas de tela substituindo o texto real por **texto sintético contextualmente equivalente** (números viram números fictícios, e-mails viram e-mails falsos e palavras viram prosa simulada realista), mantendo a estética e o layout visual limpos do documento/software, sem a agressividade visual de tarjas pretas ou manchas de blur.

---

## 2. Arquitetura Multiplataforma de OCR (Zero Dependências Extras no OS)

### 2.1. Windows (10 e 11) - Ambiente Primário
* **Motor:** `Windows.Media.Ocr` nativo via Rust crate `windows` (WinRT).
* **Consumo e Peso:** 0 MB de download, zero dependências externas instaladas, tempo de resposta < 50ms com aceleração por hardware.
* **Comunicação:** Comando Tauri `detect_text_in_region(image_base64, rect) -> Result<Vec<OcrTextLine>, String>`.

### 2.2. macOS (Intel e Apple Silicon)
* **Motor:** Apple Vision Framework (`VNRecognizeTextRequest`).
* **Consumo e Peso:** 0 MB de download, aceleração direta na *Apple Neural Engine*.
* **Comunicação:** Módulo condicional `#[cfg(target_os = "macos")]`.

### 2.3. Linux (Ubuntu, Debian, Fedora, Arch)
* **Motor:** Empacotamento automático nativo (Opção 1 aprovada).
* **Distribuição:**
  * Pacotes `.deb` e `.rpm`: Declarar `tesseract-ocr` e `tesseract-ocr-por` como dependências no manifesto Tauri (`tauri.conf.json`). O gerenciador de pacotes do sistema instala tudo silenciosamente junto com o app.
  * `AppImage` e `Flatpak`: Empacotar a biblioteca nativa internamente no bundle para execução *plug-and-play* imediata sem terminal.

### 2.4. Ambiente de Desenvolvimento / Web (`npm run dev`)
* Provedor mock de OCR no frontend para permitir testes rápidos e desenvolvimento visual sem depender da compilação Rust a cada reload.

---

## 3. Algoritmo de Substituição Contextual Inteligente

### 3.1. Classificação de Padrões Léxicos
Ao detectar uma caixa de palavra/linha via OCR, o algoritmo analisa o padrão do texto original:
1. **Valores Monetários e Moedas:**
   * Padrão: `R$ [0-9.,]+` ou `\$[0-9.,]+`
   * Saída: Gera valor monetário aleatório de mesmo comprimento visual (ex: `R$ 4.520,00` -> `R$ 1.835,40`).
2. **Datas:**
   * Padrão: `DD/MM/AAAA` ou `AAAA-MM-DD`
   * Saída: Gera data aleatória válida com mesma formatação.
3. **E-mails:**
   * Padrão: `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`
   * Saída: Gera e-mail fictício aleatório com formato realista (ex: `carlos.silva@empresa.com.br` -> `andre.mendes@corporativo.net`).
4. **Números Puros / Documentos (CPF, Telefones):**
   * Padrão: Apenas dígitos ou com pontuação `999.999.999-99` / `(99) 99999-9999`
   * Saída: Dígitos aleatórios preservando os separadores originais.
5. **Palavras e Texto Geral:**
   * Padrão: Texto alfabético
   * Saída: Palavras aleatórias de comprimento proporcional, respeitando a capitalização (Maiúscula se a original começava com maiúscula, minúscula se minúscula).

### 3.2. Randomização e Inviolabilidade
* O texto sintético é sorteado a partir de sementes aleatórias e dicionários léxicos dinâmicos.
* **Inexistência de correlação reversa:** Nenhuma palavra substituta pode ser usada para inferir a original via análise de frequência.
* **Persistência na anotação:** Uma vez gerada para a captura, a anotação grava o texto sintético gerado em seu estado, mantendo estabilidade visual ao dar zoom, arrastar a tela ou exportar.

---

## 4. Experiência do Usuário (UX) e Interface

### 4.1. Ferramenta na Barra Superior (Toolbar)
* **Localização:** Integrada ao ecossistema de privacidade na Toolbar.
* **Ícone:** Ícone intuitivo de texto com varinha ou substituição (ex: `FileText`, `ScanText` ou `Sparkles`).
* **Tooltip:** *"Anonimização Inteligente: Substitui texto real por dados fictícios mantendo o layout"*.

### 4.2. Fluxo de Interação
1. O usuário clica na ferramenta **Anonimizar Texto**.
2. O usuário desenha um retângulo sobre a área que deseja anonimizar (ex: um bloco de notas, cartão de dados de cliente ou cabeçalho de fatura).
3. Uma animação sutil e minimalista de escaneamento ocorre por uma fração de segundo (< 100ms no Windows).
4. O retângulo é substituído pelo bloco de texto anonimizado.
5. **Opções na seleção:** Ao selecionar o bloco anonimizado criado, a barra exibe um botão de **"Sortear Novamente"** (`RefreshCw` / dado) para caso o usuário queira trocar as palavras fictícias geradas, além de poder redimensionar ou mover o bloco exatamente como as demais ferramentas.

---

## 5. Renderização Gráfica e Inpainting Local (Konva)

1. **Amostragem de Fundo (Inpainting Limpo):**
   * O sistema lê a cor dominante de fundo da região selecionada (média dos pixels dos cantos da caixa delimitadora).
   * Renderiza uma caixa opaca sólida com a cor exata do fundo, apagando 100% dos pixels originais.
2. **Desenho do Texto Sintético:**
   * Detecta a cor predominante do texto original (pixel mais escuro/claro contrastante).
   * Renderiza as palavras sintéticas alinhadas com as posições originais das linhas retornadas pelo OCR.
3. **Segurança no Export / Clipboard:**
   * O canvas é achatado irreversivelmente no momento da exportação (`stage.toDataURL()`), tornando o arquivo exportado (PNG/JPEG/PDF) livre de camadas e 100% seguro contra inspeção forense.

---

## 6. Fases de Implementação Propostas
1. **Fase 1 (Backend Rust):** Implementar comando Tauri `detect_text_in_region` no Windows via `Windows.Media.Ocr`, com fallback mock para Linux/Dev.
2. **Fase 2 (Algoritmo de Substituição):** Criar utilitário `src/utils/textAnonymizer.ts` com o gerador contextual randomizado (números, e-mails, palavras).
3. **Fase 3 (Canvas & Modelo de Anotação):** Criar `SmartTextAnnotation` no `editorStore.ts` e renderização no `CanvasEditor.tsx` com inpainting de cor e alinhamento de texto.
4. **Fase 4 (Interface & Toolbar):** Adicionar botão e controle de regeneração no `Toolbar.tsx`.
5. **Fase 5 (Testes & Validação):** Testes unitários com Vitest, verificação de tipagem TypeScript e validação de build em produção.
