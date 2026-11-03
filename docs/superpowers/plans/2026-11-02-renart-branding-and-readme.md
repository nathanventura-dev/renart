# RenArt Branding & Flagship README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar a identidade visual da raposa RenArt no repositório, atualizar metadados do projeto e publicar um `README.md` flagship de alto padrão visual com alternância dinâmica de tema (Dark/Light).

**Architecture:** Estruturar os ativos gráficos em `docs/assets/`, atualizar a identidade em `package.json`, `index.html`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`, e compor um `README.md` completo e ilustrado com tag `<picture>` para alternância automática de tema no GitHub.

**Tech Stack:** Markdown, GitHub Flavored Markdown, TypeScript, Vitest, React, Tauri v2.

**Spec:** `docs/superpowers/specs/2026-11-02-renart-branding-and-readme-design.md`

## Global Constraints

- As artes do mascote devem ser armazenadas em `docs/assets/renart-mascot-dark.jpg` e `docs/assets/renart-mascot-light.jpg`.
- O `README.md` deve utilizar a tag `<picture>` com `media="(prefers-color-scheme: dark)"` para exibir o mascote correspondente ao tema do GitHub do visitante.
- Toda a documentação e showcase de funcionalidades deve refletir fidedignamente os recursos reais já implementados e validados no código (Lupa com coroa física, Smart Text OCR, Redação anti-IA, Alt+Click carimbo, Texto inline).
- A suíte completa de testes unitários (`vitest run`), tipagem TypeScript (`tsc --noEmit`) e build de produção (`npm run build`) devem continuar 100% íntegros.

## Review Focus

1. Alternância de tema do mascote: `<picture>` deve apontar para caminhos relativos válidos no GitHub (`docs/assets/...`).
2. Compatibilidade de nomes de pacotes: `package.json` deve ter nome válido npm (`renart`) sem quebrar scripts de dev/build.
3. Consistência entre documentação e código real: todas as ferramentas citadas devem existir e funcionar na base de código.
4. Renderização do README em markdown: não deve conter tags HTML mal fechadas que quebrem no renderizador do GitHub.
5. Preservação de dependências: `src-tauri` e scripts de frontend devem permanecer intactos.

---

### Task 1: Organizar e Validar Ativos de Branding em `docs/assets/`

**Files:**
- Create: `docs/assets/renart-mascot-dark.jpg`
- Create: `docs/assets/renart-mascot-light.jpg`
- Test: `tests/brandingAssets.test.ts`

**Interfaces:**
- Produces: Arquivos de imagem estáveis em `docs/assets/` para consumo pelo `README.md`.

- [ ] **Step 1: Escrever teste unitário falhando para verificação dos ativos**

```ts
// tests/brandingAssets.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Branding Assets', () => {
  it('has both dark and light mascot images in docs/assets/', () => {
    const darkPath = path.resolve(__dirname, '../docs/assets/renart-mascot-dark.jpg');
    const lightPath = path.resolve(__dirname, '../docs/assets/renart-mascot-light.jpg');

    expect(fs.existsSync(darkPath)).toBe(true);
    expect(fs.existsSync(lightPath)).toBe(true);

    const darkStats = fs.statSync(darkPath);
    const lightStats = fs.statSync(lightPath);

    expect(darkStats.size).toBeGreaterThan(1000);
    expect(lightStats.size).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/brandingAssets.test.ts`
Expected: FAIL (arquivos não encontrados em `docs/assets/`).

- [ ] **Step 3: Copiar os ativos de `RenArt/` para `docs/assets/`**

Copiar:
- `RenArt/mascote_minimalist_dark.JPG` -> `docs/assets/renart-mascot-dark.jpg`
- `RenArt/mascote_minimalist_white.JPG` -> `docs/assets/renart-mascot-light.jpg`

- [ ] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/brandingAssets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/assets/ tests/brandingAssets.test.ts
git commit -m "chore(branding): organizar imagens do mascote RenArt em docs/assets"
```

---

### Task 2: Atualizar Identidade do Projeto nos Metadados (`package.json`, `index.html`, `tauri`)

**Files:**
- Modify: `package.json`
- Modify: `index.html`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Consumes: Nome `renart` e título atualizado.
- Produces: Metadados alinhados em todo o ecossistema.

- [ ] **Step 1: Adicionar asserções de identidade em `tests/scaffold.test.ts`**

Adicionar teste verificando que `pkg.name === 'renart'` e `pkg.description` reflete a nova identidade.

- [ ] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/scaffold.test.ts`
Expected: FAIL (esperado `'renart'`, recebido `'ferramenta-captura'`).

- [ ] **Step 3: Atualizar metadados dos arquivos**

- Em `package.json`:
  ```json
  "name": "renart",
  "description": "RenArt — Captura de precisão e anotação fluida (CLI: vulcap)"
  ```
- Em `index.html`:
  ```html
  <title>RenArt — Captura de precisão e anotação fluida</title>
  ```
- Em `src-tauri/tauri.conf.json`:
  ```json
  "productName": "RenArt",
  "identifier": "com.renart.app"
  ```
- Em `src-tauri/Cargo.toml`:
  ```toml
  name = "renart"
  description = "RenArt — Captura de precisão e anotação fluida"
  ```

- [ ] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/scaffold.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html src-tauri/tauri.conf.json src-tauri/Cargo.toml tests/scaffold.test.ts
git commit -m "chore: atualizar metadados do projeto para identidade RenArt"
```

---

### Task 3: Elaborar o `README.md` Flagship Oficial na Raiz

**Files:**
- Create: `README.md`
- Test: `tests/readmeStructure.test.ts`

**Interfaces:**
- Consumes: Ativos em `docs/assets/`.
- Produces: `README.md` na raiz do repositório.

- [ ] **Step 1: Escrever teste unitário para validar estrutura do `README.md`**

```ts
// tests/readmeStructure.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('README.md Structure', () => {
  it('contains the RenArt flagship header, mascots, features and cli documentation', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');

    // Header dinâmico com mascote
    expect(content).toContain('docs/assets/renart-mascot-dark.jpg');
    expect(content).toContain('docs/assets/renart-mascot-light.jpg');
    expect(content).toContain('prefers-color-scheme: dark');

    // Nomes oficiais
    expect(content).toContain('RenArt');
    expect(content).toContain('vulcap');

    // Diferenciais fundamentais
    expect(content).toContain('Lupa Cirúrgica com Coroa Giratória');
    expect(content).toContain('Smart Text');
    expect(content).toContain('Alt + Click');

    // Stack e Guia de Execução
    expect(content).toContain('npm run dev');
    expect(content).toContain('vitest');
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**

Run: `cmd /c npx vitest run tests/readmeStructure.test.ts`
Expected: FAIL (README.md na raiz não existe ou não tem a estrutura completa).

- [ ] **Step 3: Redigir o `README.md` completo e elegante na raiz**

Estruturar o documento com:
- Header com `<picture>` centralizado, título RenArt, badges e slogan.
- Seção "Por que o RenArt?".
- Showcase com os 5 Diferenciais Únicos explicados em detalhes.
- Arquitetura do Ecossistema RenArt (GUI) + vulcap (CLI & Rust Core) com comandos exemplificados.
- Roadmap Transparente (Fase 1 Web Concluída, Fase 2 Tauri Desktop, Fase 3 CLI).
- Como Rodar Localmente (clone, install, dev, test, build).
- Contribuição e Licença MIT.

- [ ] **Step 4: Executar testes e verificar aprovação**

Run: `cmd /c npx vitest run tests/readmeStructure.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/readmeStructure.test.ts
git commit -m "docs: adicionar README flagship do RenArt com tema dinamico e documentacao completa"
```

---

### Task 4: Verificação Completa e Build

- [ ] **Step 1: Executar suíte completa de testes (`npx vitest run`)**
Expected: 100% dos testes aprovados (279+ testes).

- [ ] **Step 2: Executar verificação estrita de tipos TypeScript (`npx tsc --noEmit`)**
Expected: 0 erros.

- [ ] **Step 3: Executar build de produção (`npm run build`)**
Expected: Build concluído com sucesso.
