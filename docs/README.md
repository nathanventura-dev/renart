# Base de Conhecimento — Ferramenta de Captura

Bem-vindo à documentação técnica e de usuário da **Ferramenta de Captura Multiplataforma** (Windows, macOS e Linux).

Abaixo você encontra os guias oficiais organizados por área de interesse:

---

## 📚 Sumário da Documentação

1. **[Manual de Funcionamento e Fluxo de Uso](./manual-de-funcionamento-e-fluxo.md)**  
   Visão geral do produto, como funciona a captura imediata para o clipboard, ferramentas de desenho, lupa, edição e galeria.

2. **[Guia de Acionamento, Atalhos e Integração com o Sistema](./acionamento-e-atalhos.md)**  
   Canais de disparo (hotkeys globais, system tray, linha de comando), instruções passo a passo para configurar como app padrão no Windows, Mac e Linux, e tabela completa de atalhos.

3. **[Arquitetura e Tecnologias](./arquitetura-e-tecnologias.md)**  
   Estrutura interna do software, justificativa do Tauri v2 com Rust em vez de Electron, React 19, Konva.js e comunicação IPC.

4. **[Guia do Backend em Rust e Comandos Nativos](./guia-rust-e-backend.md)**  
   Implementação das crates `xcap`, `arboard`, gerenciador de instâncias concorrentes, segurança de memória e comandos Tauri.

5. **[Estratégia de Testes Unitários e Cobertura](./testes-unitarios-e-cobertura.md)**  
   Arquitetura de testes com Vitest, simulação de eventos e garantia de integridade das operações geométricas e do canvas.
