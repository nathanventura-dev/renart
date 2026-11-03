# Design: RenArt — Identidade Visual, Mascote e README Flagship para o GitHub

## 1. Contexto e Motivação
O projeto evoluiu de uma prova de conceito de ferramenta de captura para um editor de anotação visual de alta precisão e nível profissional, contando com mais de 270 testes automatizados e recursos exclusivos no mercado (lupa com coroa física realista, anonimização local por OCR Smart Text, redação anti-IA, texto adaptativo inline e atalhos de carimbo fluído).

Para a publicação oficial no GitHub, foram definidos:
- **Nome Oficial da Aplicação GUI:** **RenArt** (combinação de elegância, arte e astúcia).
- **Nome do Binário CLI / Motor Nativo:** **`vulcap`** (derivado de *Vulpes* — raposa em latim — e *capture*).
- **Mascote:** Raposa-Vermelha minimalista estilizada, simbolizando precisão cirúrgica, velocidade e adaptabilidade aos diferentes sistemas operacionais.
- **Identidade Dual (Light/Dark):** Imagens do mascote preparadas para integração com o tema do usuário no GitHub.

Este documento formaliza a estrutura da documentação principal (`README.md`), a organização dos ativos gráficos e o posicionamento do RenArt como o frontend de excelência para o ecossistema desktop nativo com Tauri e Rust.

---

## 2. Objetivos e Não-Objetivos

### Objetivos
- **Apresentação de Alto Padrão (Flagship):** Criar um `README.md` na raiz do repositório com padrão visual internacional, destacando a raposa RenArt com suporte nativo a temas Claro e Escuro do GitHub via tag `<picture>`.
- **Showcase dos Diferenciais Inovadores:** Documentar com clareza as funcionalidades que diferenciam o RenArt de alternativas como Ferramenta de Captura do Windows, Flameshot, ShareX e CleanShot X:
  1. Lupa Cirúrgica com Coroa Giratória física e modos com/sem foco.
  2. Ocultação com IA Local (Smart Text Anonymization via Tesseract.js e blur anti-reconstrução de IA).
  3. Workflow de Alta Velocidade (`Alt + Click` para carimbar formas padrão centralizadas, desseleção limpa e multiseleção com `Ctrl`/`Shift`).
  4. Texto Rico Inline Adaptativo (auto-wrap/auto-fit sem modais).
  5. Vetores de Precisão com rotação livre em 4 cantos e âncoras personalizadas.
- **Posicionamento Estratégico de Ecossistema:** Apresentar a interface gráfica (React/TypeScript/Konva) como o editor do ecossistema e estabelecer o roadmap transparente para o empacotamento desktop nativo multiplataforma (Windows, macOS, Linux) e utilitário de terminal `vulcap` usando **Tauri e Rust**.
- **Organização de Ativos:** Alocar e versionar as ilustrações do mascote em `docs/assets/`.

### Não-Objetivos
- Não implementar a camada Tauri/Rust nesta etapa (isso fará parte da fase subsequente de empacotamento desktop).
- Não alterar as regras de negócio ou componentes existentes no editor.

---

## 3. Abordagens Consideradas

### Abordagem 1: Estilo *Tech Spec* (Técnico e Direto)
- Foco exclusivo em tabelas de módulos, comandos de terminal e especificações de código.
- *Trade-off:* Bom para leitura rápida de desenvolvedores, mas frio e pouco atrativo para criar uma comunidade e encantar usuários.

### Abordagem 2: Estilo *Open-Source Flagship* (Visual, Profissional e Inspirador — Escolhida)
- Header dinâmico com mascote adaptativo a tema claro/escuro.
- Badges dinâmicas de cobertura de testes (277 testes), TypeScript estrito e stack moderna.
- Narrativa de produto de alto padrão com demonstração conceitual das ferramentas cirúrgicas.
- Arquitetura transparente explicando o papel do frontend atual e a evolução planejada para Tauri + Rust.
- *Por que foi escolhida:* Transmite autoridade, consolida a marca RenArt e valoriza o esforço técnico já investido no projeto.

---

## 4. Especificação dos Ativos e do README

### 4.1. Organização dos Ativos em `docs/assets/`
Os arquivos presentes em `RenArt/` serão copiados para `docs/assets/` com nomenclatura padronizada em kebab-case:
- `docs/assets/renart-mascot-dark.jpg` (para modo escuro)
- `docs/assets/renart-mascot-light.jpg` (para modo claro)

### 4.2. Estrutura do `README.md`
O arquivo `README.md` principal conterá as seguintes seções:

1. **Hero Header:**
   - Mascote renderizado via tag `<picture>` alternando automaticamente conforme o tema do GitHub (`prefers-color-scheme: dark` e `light`).
   - Título: **RenArt** (*CLI: `vulcap`*).
   - Tagline de impacto: *Captura de precisão cirúrgica, anonimização com IA local e anotação fluida para criadores e desenvolvedores.*
   - Linha de Badges (License MIT, TypeScript Strict, React 18, Vite, 277 Passing Tests, Tauri Ready).

2. **Visão Geral & O Que Torna o RenArt Único:**
   - Breve introdução à filosofia do projeto: combinar a agilidade da captura do Windows com a elegância de design e recursos avançados para macOS, Linux e Windows.

3. **Diferenciais de Elite (Feature Highlights):**
   - 🔍 **Lupa Cirúrgica com Coroa Giratória:** Zoom de 1.0x a 3.0x em passos de 0.5x, modo lente direta e modo focal com rastro fosco e barra de precisão.
   - 🛡️ **Ocultação de Dados Inteligente (Smart Text & Anti-AI):** OCR local no navegador via Tesseract.js para anonimizar textos preservando estilo visual, além de desfoque e embaralhamento (scramble) resistentes a ataques de IA.
   - ⚡ **Workflow Fluido & Atalhos de Produtividade:** Desseleção inteligente no vazio para evitar cliques acidentais, carimbo e desenho contínuo com `Alt + Click`/`Alt + Drag`, multiseleção com `Ctrl`/`Cmd + Click` e caixa de seleção por arraste.
   - ✍️ **Texto Rico & Vetores com Rotação Livre:** Edição inline direta sobre o canvas, ajuste dinâmico ao conteúdo (auto-wrap / auto-fit), snap angular de 15° e setas curvas.
   - 🖼️ **Galeria Lateral Desacoplada & Exportação Instantânea:** Histórico de capturas com cópia direta para o clipboard e salvamento em PNG.

4. **Arquitetura & Ecossistema (RenArt + vulcap):**
   - **RenArt (GUI):** O estúdio gráfico de anotação de alta performance construído em React + Konva + Tailwind.
   - **vulcap (CLI & Core Rust):** O motor de captura nativa em Rust integrado via Tauri.
   - Exemplos de comandos do CLI documentados:
     ```bash
     # Captura interativa de região
     vulcap --area
     # Captura de tela cheia com cópia direta para o clipboard
     vulcap --fullscreen --clipboard
     # Captura com atraso de 3 segundos
     vulcap --delay 3000 --output captura.png
     ```

5. **Roadmap de Desenvolvimento:**
   - [x] Fase 1: Editor visual completo e validado com 277 testes unitários.
   - [ ] Fase 2: Integração com Tauri para binário nativo para Windows, macOS e Linux.
   - [ ] Fase 3: Utilitário CLI `vulcap` e atalhos globais no sistema operacional.

6. **Como Executar Localmente:**
   - Comandos claros para clonar, instalar dependências (`npm install`), rodar em desenvolvimento (`npm run dev`), executar suíte de testes (`npx vitest run`) e build (`npm run build`).

7. **Licença e Contribuição:**
   - Informações sobre licença e boas-vindas a contribuidores.

---

## 5. Critérios de Aceitação
1. Ativos do mascote organizados em `docs/assets/` e íntegros.
2. `README.md` renderizando perfeitamente no GitHub, com suporte aos dois temas (Claro e Escuro) para o mascote.
3. Informações técnicas 100% fidedignas ao código real do repositório.
4. Suíte de testes e build continuando íntegros sem nenhuma alteração funcional quebrada.
