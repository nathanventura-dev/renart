# Tema Claro e Escuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tema claro/escuro à interface do RenArt, seguindo o SO por padrão com alternância manual persistida.

**Architecture:** `colors.ts` exporta duas paletas tipadas; um `themeStore` (mesmo estilo de `createGalleryStore`) resolve o tema ativo; o hook `useTheme()` entrega a paleta aos componentes, que trocam cores literais de superfície por tokens. Conteúdo da captura, anotações e exportação não são tocados.

**Tech Stack:** React 19, TypeScript, Vitest (ambiente node, sem DOM), Konva.

**Spec:** `docs/superpowers/specs/2026-11-05-light-dark-theme-design.md`

## Global Constraints

- Preferência: `'system' | 'light' | 'dark'`, padrão `'system'`, salva no `localStorage` na chave `renart-theme-preference`.
- Valores escuros medidos: chrome `#1a2227`, control `#272f34`, popup `#2b2c2d`, border `#2c3338`, textPrimary `#ffffff`, textSecondary `#c5c5c5`, workspace `#121211`.
- Laranja (`RENART_THEME`) idêntico nos dois temas; destaque nunca volta ao azul `#0071e3`/`#0078d4` em superfícies da interface.
- Pixels exportados e cores de anotação/ferramentas não dependem do tema.
- `CaptureOverlay.tsx` permanece inalterado.
- Vitest roda em ambiente node: testes de store injetam `matchMedia` e `storage` por parâmetro, sem tocar em globais.
- Mensagens de commit em português, formato `tipo(escopo): descrição`, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- `localStorage` contém lixo (`"banana"`) ou lança erro ao ler/gravar → tema `system`, app não quebra (Task 2).
- `matchMedia` ausente → `light` (Task 2).
- Usuário forçou `light` e o SO muda para escuro → continua `light` (Task 2).
- Usuário em `system` e o SO muda durante a sessão → atualiza sem recarregar, e o listener é removido ao cancelar a inscrição (Task 2).
- Exportação/cópia saem iguais nos dois temas: `exportService.ts` não pode importar nada de tema (Task 5).

Ajuste em relação ao spec: a tabela de tokens ganhou `controlActive`, `hover`, `borderStrong`, `icon`, `shadow` e `thumbBg`, descobertos ao mapear as cores literais de `Toolbar.tsx` e `GallerySidebar.tsx`. O spec não precisa mudar; a tabela dele lista o mínimo.

---

### Task 1: Paletas LIGHT e DARK

**Files:**
- Modify: `src/theme/colors.ts`
- Test: `tests/themeColors.test.ts`

**Interfaces:**
- Produces: `interface ThemePalette` com as chaves `chrome, control, controlActive, hover, popup, border, borderStrong, textPrimary, textSecondary, textMuted, icon, workspace, shadow, thumbBg` (todas `string`); `LIGHT_PALETTE: ThemePalette`; `DARK_PALETTE: ThemePalette`; `RENART_THEME` inalterado.

Valores claros (reaproveitam os literais atuais): chrome `#ffffff`, control `rgba(0,0,0,0.04)`, controlActive `#ffffff`, hover `#f1f5f9`, popup `#f8fafc`, border `#e5e5e7`, borderStrong `#d1d1d6`, textPrimary `#1e293b`, textSecondary `#475569`, textMuted `#86868b`, icon `#334155`, workspace `#e5e5e7`, shadow `rgba(0,0,0,0.12)`, thumbBg `#f9f9fa`.
Valores escuros: chrome `#1a2227`, control `#272f34`, controlActive `#323a40`, hover `#323a40`, popup `#2b2c2d`, border `#2c3338`, borderStrong `#3b444a`, textPrimary `#ffffff`, textSecondary `#c5c5c5`, textMuted `#9aa0a6`, icon `#e6e8ea`, workspace `#121211`, shadow `rgba(0,0,0,0.5)`, thumbBg `#20282d`.

- [ ] **Step 1: Escrever os testes que falham** em `tests/themeColors.test.ts` (manter os existentes):
  - `'light and dark palettes expose exactly the same keys'`: `Object.keys(LIGHT_PALETTE).sort()` igual a `Object.keys(DARK_PALETTE).sort()`.
  - `'dark palette matches colors measured from Windows Snipping Tool'`: `DARK_PALETTE.chrome === '#1a2227'`, `.control === '#272f34'`, `.popup === '#2b2c2d'`, `.border === '#2c3338'`, `.textPrimary === '#ffffff'`, `.textSecondary === '#c5c5c5'`, `.workspace === '#121211'`.
  - `'light palette keeps current interface colors'`: `LIGHT_PALETTE.chrome === '#ffffff'`, `.border === '#e5e5e7'`, `.textMuted === '#86868b'`, `.workspace === '#e5e5e7'`.
- [ ] **Step 2: Rodar `npx vitest run tests/themeColors.test.ts`.** Esperado: FAIL (exports não existem).
- [ ] **Step 3: Implementar** `ThemePalette`, `LIGHT_PALETTE` e `DARK_PALETTE` em `src/theme/colors.ts` com os valores acima.
- [ ] **Step 4: Rodar `npx vitest run tests/themeColors.test.ts`.** Esperado: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/theme/colors.ts tests/themeColors.test.ts
git commit -m "feat(theme): adicionar paletas clara e escura baseadas na Ferramenta de Captura"
```

---

### Task 2: themeStore e hook useTheme

**Files:**
- Create: `src/state/themeStore.ts`, `src/hooks/useTheme.ts`
- Test: `tests/themeStore.test.ts`

**Interfaces:**
- Consumes: `ThemePalette`, `LIGHT_PALETTE`, `DARK_PALETTE` (Task 1).
- Produces:
  - `type ThemePreference = 'system' | 'light' | 'dark'`; `type ResolvedTheme = 'light' | 'dark'`.
  - `THEME_STORAGE_KEY = 'renart-theme-preference'`.
  - `createThemeStore(env?: { matchMedia?: (q: string) => MediaQueryListLike; storage?: StorageLike }): ThemeStore`, onde `MediaQueryListLike = { matches: boolean; addEventListener(type: 'change', cb: () => void): void; removeEventListener(type: 'change', cb: () => void): void }` e `StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void }`. Sem `env`, usa `window.matchMedia` e `window.localStorage` quando existirem.
  - `ThemeStore`: `getState(): { preference: ThemePreference; resolved: ResolvedTheme }`, `subscribe(l: () => void): () => void`, `setPreference(p: ThemePreference): void`, `cyclePreference(): void` (ordem `system → light → dark → system`), `dispose(): void`.
  - `themeStore`: instância singleton exportada de `themeStore.ts`.
  - `useTheme(): { palette: ThemePalette; resolved: ResolvedTheme; preference: ThemePreference; setPreference; cyclePreference }`, via `useSyncExternalStore` sobre `themeStore`. O snapshot precisa ter identidade estável entre mudanças (reaproveitar o objeto de estado enquanto nada muda).

- [ ] **Step 1: Escrever os testes que falham** em `tests/themeStore.test.ts`, com um `matchMedia` falso que permite disparar `change` e um `storage` falso em memória:
  - `'defaults to system and resolves from matchMedia'` (matches true → `dark`; false → `light`).
  - `'forced light/dark ignore the OS'`: após `setPreference('light')` com SO escuro, `resolved === 'light'`; idem para `'dark'`.
  - `'OS change updates resolved only in system mode'`: em `system` o `change` atualiza e notifica; em `light` não altera `resolved`.
  - `'persists preference and restores it'`: `setPreference('dark')` grava em `THEME_STORAGE_KEY`; um novo store com o mesmo `storage` começa em `dark`.
  - `'invalid stored value falls back to system'` (`"banana"`).
  - `'storage that throws does not break the store'`: `getItem` e `setItem` lançando; `setPreference('dark')` ainda atualiza o estado.
  - `'missing matchMedia resolves light'`.
  - `'cyclePreference walks system, light, dark, system'`.
  - `'dispose removes the matchMedia listener'` e `'unsubscribe stops notifications'`.
- [ ] **Step 2: Rodar `npx vitest run tests/themeStore.test.ts`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `createThemeStore` e o singleton `themeStore`** em `src/state/themeStore.ts`, no estilo de `src/state/galleryStore.ts` (estado imutável + `Set` de listeners). Objeto de estado só é recriado quando `preference` ou `resolved` mudam de fato.
- [ ] **Step 4: Implementar `useTheme`** em `src/hooks/useTheme.ts`; `palette` vem de `resolved === 'dark' ? DARK_PALETTE : LIGHT_PALETTE`.
- [ ] **Step 5: Rodar `npx vitest run tests/themeStore.test.ts && npx tsc --noEmit`.** Esperado: PASS e sem erros.
- [ ] **Step 6: Commit**
```bash
git add src/state/themeStore.ts src/hooks/useTheme.ts tests/themeStore.test.ts
git commit -m "feat(theme): adicionar themeStore com preferencia persistida e hook useTheme"
```

---

### Task 3: Toolbar com tokens e botão de alternância

**Files:**
- Modify: `src/components/Toolbar.tsx`, `src/App.tsx` (apenas se a alternância precisar de prop; preferir o próprio `Toolbar` chamar `useTheme()`)
- Create: `tests/themeSurfaces.test.ts`
- Test: `tests/themeSurfaces.test.ts`

**Interfaces:**
- Consumes: `useTheme()` (Task 2), `ThemePalette` (Task 1).
- Produces: `Toolbar` e `HorizontalFloatingMenu` (ambos em `Toolbar.tsx`) leem `palette` de `useTheme()`; novo botão `data-testid="theme-toggle"` que chama `cyclePreference()`, com `title` mostrando o modo atual (`Tema: Sistema`, `Tema: Claro`, `Tema: Escuro`); convenção de isenção: linha com o comentário `// theme-exempt` é ignorada pelo teste de regressão.

Mapeamento literal → token em `Toolbar.tsx`: `#ffffff` de fundo/superfície → `chrome` (botão ativo → `controlActive`); `#f8fafc` → `popup`; `#f1f5f9` → `hover`; `#e5e5e7` e `#e2e8f0` → `border`; `#d1d1d6` → `borderStrong`; `#334155` → `icon`; `#1e293b` → `textPrimary`; `#475569` → `textSecondary`; `#f5f5f7` → `workspace`; `rgba(0,0,0,0.04)` → `control`; sombras `rgba(0,0,0,0.08–0.15)` → `shadow`. Ficam como estão, com `// theme-exempt`: o array `TOOLBAR_COLORS` (swatches de anotação, inclui `#ffffff`), `#ffffff` usado como texto sobre fundo laranja, e as cores semânticas verde/vermelho (`#16a34a`, `#15803d`, `#b91c1c`, `rgba(34,197,94,…)`, `rgba(239,68,68,…)`).

- [ ] **Step 1: Escrever o teste de regressão que falha** em `tests/themeSurfaces.test.ts`: helper `findLiteralSurfaceColors(file: string): string[]` que lê o arquivo, ignora linhas com `theme-exempt`, e retorna as linhas contendo qualquer de `#ffffff`, `#e5e5e7`, `#86868b`, `#f8fafc`, `#475569`, `#334155`, `#e2e8f0`, `#f5f5f7`, `#f1f5f9`, `#d1d1d6`, `#1e293b`. Teste: `'Toolbar.tsx has no literal surface colors'` espera lista vazia. Teste: `'Toolbar.tsx exposes a theme toggle'` espera que o arquivo contenha `data-testid="theme-toggle"` e `cyclePreference`.
- [ ] **Step 2: Rodar `npx vitest run tests/themeSurfaces.test.ts`.** Esperado: FAIL listando as linhas de `Toolbar.tsx`.
- [ ] **Step 3: Migrar `Toolbar.tsx`** conforme o mapeamento, chamando `useTheme()` em `Toolbar` e em `HorizontalFloatingMenu`; marcar as isenções com `// theme-exempt`.
- [ ] **Step 4: Adicionar o botão `theme-toggle`** ao lado das ações da direita, com ícone SVG inline (sol/lua/monitor conforme `preference`), mesma altura `INNER_CONTROL_HEIGHT` dos demais botões.
- [ ] **Step 5: Rodar `npx vitest run && npx tsc --noEmit`.** Esperado: todos passam, incluindo os testes de toolbar existentes.
- [ ] **Step 6: Commit**
```bash
git add src/components/Toolbar.tsx tests/themeSurfaces.test.ts
git commit -m "feat(theme): aplicar paleta no Toolbar e adicionar botao de alternancia de tema"
```

---

### Task 4: GallerySidebar, App, CanvasEditor e index.html

**Files:**
- Modify: `src/components/GallerySidebar.tsx`, `src/App.tsx`, `src/components/CanvasEditor.tsx` (somente `backgroundColor: '#e5e5e7'` do container e a sombra da imagem), `index.html`
- Test: `tests/themeSurfaces.test.ts`

**Interfaces:**
- Consumes: `useTheme()`, convenção `// theme-exempt` (Task 3).
- Produces: nenhuma interface nova.

Mapeamento: em `GallerySidebar.tsx`, `#ffffff`→`chrome`, `#e5e5e7`→`border`, `#86868b`→`textMuted`, `#aeaeb2`→`textMuted`, `#f9f9fa`→`thumbBg`, `#f5f5f7`→`control`, `#1d1d1f`→`textPrimary`; o `#ffffff` do contador em laranja (`#ff9f0a`) fica com `// theme-exempt`. Em `App.tsx`, só o `#86868b` do texto de placeholder vira `textMuted`; o gradiente `#f0f4f8`/`#d9e2ec`/`#627d98` (linhas 69–78) desenha uma imagem de exemplo, não interface: `// theme-exempt`. Em `CanvasEditor.tsx`, `#e5e5e7` do container → `workspace` e a sombra da imagem → `shadow`; as outras ~70 cores do arquivo são conteúdo de canvas e não entram no teste. `index.html`: adicionar `@media (prefers-color-scheme: dark)` com `background-color: #121211; color: #ffffff` em `html, body, #root`, para evitar flash branco; o React assume o controle depois. O fundo inicial do `html` deve usar o tema escolhido no `localStorage` quando existir, via um script inline curto no `<head>` que define `document.documentElement.dataset.theme` e uma regra `html[data-theme='dark']` com as mesmas cores.

- [ ] **Step 1: Estender `tests/themeSurfaces.test.ts`** com `'GallerySidebar.tsx has no literal surface colors'` e `'App.tsx has no literal surface colors'` (mesmo helper), mais `'index.html defines dark startup colors'` (contém `prefers-color-scheme: dark` e `#121211`), `'CanvasEditor workspace background comes from the palette'` (a linha do container não contém `#e5e5e7`), e `'exportService does not depend on the theme'` (`src/services/exportService.ts` não contém `theme`).
- [ ] **Step 2: Rodar `npx vitest run tests/themeSurfaces.test.ts`.** Esperado: FAIL.
- [ ] **Step 3: Migrar os quatro arquivos** conforme o mapeamento; `CanvasEditor` chama `useTheme()` apenas para `workspace` e `shadow`.
- [ ] **Step 4: Rodar `npx vitest run && npx tsc --noEmit && npx vite build`.** Esperado: tudo passa, build gera `dist/`.
- [ ] **Step 5: Commit**
```bash
git add src/components/GallerySidebar.tsx src/App.tsx src/components/CanvasEditor.tsx index.html tests/themeSurfaces.test.ts
git commit -m "feat(theme): aplicar paleta na galeria, area de edicao e cores iniciais da pagina"
```

---

### Task 5: Validação visual, README e fechamento

**Files:**
- Modify: `README.md`, `tests/readmeStructure.test.ts`, `docs/superpowers/plans/2026-11-02-renart-orange-theme-and-roadmap.md` (marcar checkboxes concluídos), `docs/superpowers/plans/2026-11-05-light-dark-theme.md` (marcar este plano)
- Test: `tests/readmeStructure.test.ts`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: roadmap atualizado.

- [ ] **Step 1: Escrever o teste que falha** em `tests/readmeStructure.test.ts`: o README contém `Alternância de tema` na lista de recursos do editor e o badge/contagem de testes bate com o total real de testes (rodar `npx vitest run` e usar o número impresso).
- [ ] **Step 2: Rodar `npx vitest run tests/readmeStructure.test.ts`.** Esperado: FAIL.
- [ ] **Step 3: Atualizar o `README.md`**: recurso "Alternância de tema (Sistema / Claro / Escuro)" nos Outros Recursos; roadmap da Fase 2 passa a citar o tema como concluído (os demais itens da fase continuam em andamento); corrigir badge e texto do número de testes.
- [ ] **Step 4: Validação visual manual** com `npm run dev` em `http://127.0.0.1:1420/`: alternar pelo botão nos três modos; trocar o tema do macOS em modo `system` e ver a mudança sem recarregar; recarregar e confirmar que a preferência persiste e que não há flash branco com tema escuro; conferir toolbar, dropdowns, galeria e área de edição; fazer uma captura, anotar e exportar nos dois temas e confirmar que a imagem exportada é idêntica. Ajustar `control`, `textMuted`, `controlActive`, `hover`, `borderStrong`, `icon` ou `thumbBg` em `DARK_PALETTE` se algo estiver ilegível, atualizando o teste de valores só para chaves que o spec mediu.
- [ ] **Step 5: Rodar `npx vitest run && npx tsc --noEmit && npx vite build`.** Esperado: tudo verde.
- [ ] **Step 6: Commit**
```bash
git add README.md tests/readmeStructure.test.ts docs/superpowers/plans
git commit -m "docs: registrar tema claro e escuro no roadmap e corrigir contagem de testes"
```
