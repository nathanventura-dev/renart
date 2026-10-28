# Plano de Distribuição Multiplataforma: Versões Instalável e Portátil (Portable)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disponibilizar a Ferramenta de Captura tanto como instalador tradicional quanto como aplicativo autônomo portátil (portable) sem necessidade de instalação nem privilégios de administrador para Windows, Linux e macOS.

**Architecture:** O Tauri v2 compila um binário executável nativo em Rust que embute os recursos estáticos do frontend (React + Konva). No modo portátil do Windows, o binário gerado em `src-tauri/target/release` funciona como um executável único (`.exe`) independente de instaladores; no Linux, o formato padrão é `.AppImage` (portável por design); no macOS, o bundle `.app` é empacotado em `.zip`. O plano adiciona scripts e documentação oficial de build e distribuição para ambos os formatos.

**Tech Stack:** Tauri v2, Rust, Vite, React 19, TypeScript, NSIS / AppImage / DMG bundlers.

**Spec:** `docs/manual-de-funcionamento-e-fluxo.md` (Seção 8 - Distribuição e Empacotamento).

## Global Constraints

- O executável portátil de Windows deve funcionar com duplo clique direto, sem requerer privilégios de administrador (UAC prompt para instalação).
- O executável portátil deve manter a mesma leveza, inicialização rápida e limites da aplicação (máximo 2 instâncias, histórico local, atalhos de teclado).
- Mensagens de commit e documentação sempre em português.

## Review Focus

- O executável autônomo portátil no Windows inicializa sem exigir nenhuma biblioteca externa ausente no sistema operacional moderno.
- A distribuição portátil em `.zip` inclui o executável pronto para uso imediato em pendrives e ambientes corporativos com restrição de instalação.
- O formato de empacotamento Linux `.AppImage` executa diretamente com permissão de execução (`chmod +x`).
- A configuração do bundle no `tauri.conf.json` mantém suporte tanto aos instaladores formais quanto aos pacotes portáteis.
- Os testes automatizados da aplicação continuam passando com código 0 e sem regressões.

---

### Task 1: Configuração do Pipeline de Empacotamento Portátil e Instalável no Tauri e NPM

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `docs/manual-de-funcionamento-e-fluxo.md`

**Interfaces:**
- Produces:
  - Script `npm run build:app`: executa a compilação de produção e gera o binário do Tauri.
  - Script `npm run build:portable`: empacota o executável avulso em arquivo `.zip` portátil para distribuição rápida.
  - Documentação atualizada do fluxo de distribuição no manual operacional.

- [x] **Step 1: Adicionar comandos de build do Tauri no `package.json`**
- [x] **Step 2: Verificar a configuração do `src-tauri/tauri.conf.json` para alvos de bundle**
- [x] **Step 3: Atualizar `docs/manual-de-funcionamento-e-fluxo.md` com o guia passo a passo de compilação portátil**
- [x] **Step 4: Executar testes e validação de build (`npm test` e `npm run build`)**
- [x] **Step 5: Gravar alterações e realizar commit em português**
