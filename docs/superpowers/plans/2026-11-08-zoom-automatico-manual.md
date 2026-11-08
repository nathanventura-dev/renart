# Zoom Automático e Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A imagem do editor acompanha a área útil da janela (modo Automático, padrão) ou mantém um zoom fixado pelo usuário (modo Manual), com troca implícita de modo e um indicador claro na barra.

**Architecture:** Regras de decisão ficam em funções puras (`zoomMode.ts`) e o estado (modo salvo, zoom manual por imagem, aviso) em `zoomStore.ts`, no padrão do `themeStore`. O `CanvasEditor` passa a avisar o `App` quando a imagem carrega **e** quando o container muda de tamanho (`ResizeObserver` agrupado por quadro); o `App` só aplica o resultado de `decideZoomOnFit`. A exportação já renderiza em 1:1 (`toNativeDataUrl`), então nada muda nela.

**Tech Stack:** React 19, TypeScript, Konva, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-zoom-automatico-manual-design.md`

## Regra de Git deste projeto

O usuário executa **todas** as ações de escrita no git (`add`, `commit`, `merge`, `push`, branches). O executor **não commita**: onde um plano normal teria "Commit", este plano tem um **Ponto de commit**: o executor mostra `git status`, um resumo do `git diff` e entrega os comandos prontos (`git add` por arquivo, nunca `git add .`), com a mensagem sugerida, e **espera** o usuário confirmar antes de seguir. Leitura (`status`, `log`, `diff`, `branch`) é permitida. Todo o trabalho acontece na branch `feat/zoom-automatico-manual`. O `.claude/` não versionado nunca entra nos commits.

## Global Constraints

- Modos: `'auto'` (padrão) e `'manual'`. Chave de preferência: `renart-zoom-mode`.
- O ajuste automático nunca passa de 100% (`1.0`) e arredonda para baixo (já garantido por `calculateFitToScreenScale`).
- Container com largura ou altura `<= 0` nunca dispara ajuste.
- Troca de modo: `user-zoom` → manual; `reset-to-auto` → auto; `image-load` → mantém.
- Texto do aviso de primeira vez, exato: `Zoom manual ativado. Ctrl+0 volta ao automático.` Fecha sozinho em cerca de 4 s.
- Tooltip Automático, exato: `Zoom automático: a imagem acompanha o tamanho da janela. Dê zoom para controlar manualmente.`
- Tooltip Manual, exato: `Zoom manual: clique para voltar ao zoom automático (Ctrl/Cmd 0).`
- Todas as cores da interface vêm de `palette` (temas claro e escuro). Textos da interface em português.
- Não persistir o zoom manual entre aberturas do app; não ampliar imagem pequena.

## Review Focus

- Janela escondida na bandeja (container com tamanho 0) não pode levar o zoom a 100% ao reaparecer. Teste na Task 1 (`shouldApplyFit`) e na Task 4 (integração).
- `localStorage` indisponível ou lançando exceção (modo privado, bloqueado) não pode derrubar o app: modo cai em `auto`. Teste na Task 2.
- Zoom manual salvo inválido (`0`, `NaN`, negativo) deve cair no ajuste, nunca aplicar zoom inválido. Teste na Task 1.
- Várias mudanças de tamanho no mesmo quadro (arrastar a borda da janela) devem produzir um único recálculo. Teste na Task 3.
- Sem captura ativa (galeria vazia após fechar a última imagem) o ajuste não pode lançar erro nem gravar zoom em chave indefinida. Teste na Task 4.

## Estrutura de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/utils/zoomMode.ts` (novo) | Regras puras: modos, transições, quando ajustar, decisão de zoom, descrição do indicador |
| `src/utils/frameCoalescer.ts` (novo) | Agrupa chamadas no mesmo quadro (`requestAnimationFrame` injetável) |
| `src/state/zoomStore.ts` (novo) | Modo salvo, zoom manual por captura, flag do aviso |
| `src/components/CanvasEditor.tsx` | Observa o tamanho do container e informa `(scale, reason, viewport)` |
| `src/App.tsx` | Aplica `decideZoomOnFit`, troca o modo nos handlers, aviso, limpeza ao fechar captura |
| `src/components/Toolbar.tsx` | Indicador por modo (ícone, tooltip, aria) |
| `tests/zoomMode.test.ts`, `tests/frameCoalescer.test.ts`, `tests/zoomStore.test.ts` (novos), `tests/integration.test.ts` | Testes |
| `docs/manual-de-funcionamento-e-fluxo.md`, `docs/acionamento-e-atalhos.md` | Documentação |

---

### Task 1: Regras puras do zoom (`zoomMode.ts`)

**Files:**
- Create: `src/utils/zoomMode.ts`
- Test: `tests/zoomMode.test.ts`

**Interfaces:**
- Consumes: `formatZoomPercentage(zoomLevel: number): string` de `src/utils/zoomAndCrop.ts`.
- Produces (exports de `src/utils/zoomMode.ts`):
  - `type ZoomMode = 'auto' | 'manual'`; `const DEFAULT_ZOOM_MODE: ZoomMode = 'auto'`
  - `type ZoomModeAction = 'user-zoom' | 'reset-to-auto' | 'image-load'`
  - `type FitReason = 'load' | 'resize'`
  - `nextZoomMode(mode: ZoomMode, action: ZoomModeAction): ZoomMode`
  - `shouldApplyFit(input: { mode: ZoomMode; reason: FitReason; width: number; height: number }): boolean`
  - `resolveManualZoomOnLoad(saved: number | undefined, fitScale: number): number`
  - `decideZoomOnFit(input: { mode: ZoomMode; reason: FitReason; width: number; height: number; fitScale: number; savedZoom?: number }): { zoom: number | null; saveZoom: boolean }`
  - `describeZoomIndicator(mode: ZoomMode, zoomLevel: number): { label: string; showFitIcon: boolean; clickable: boolean; tooltip: string; ariaLabel: string }`

- [ ] **Step 1: Escrever os testes em `tests/zoomMode.test.ts`**
  - `nextZoomMode`: `('auto','user-zoom')` → `'manual'`; `('manual','reset-to-auto')` → `'auto'`; `('auto','reset-to-auto')` → `'auto'`; `('manual','image-load')` → `'manual'`; `('auto','image-load')` → `'auto'`; `('manual','user-zoom')` → `'manual'`.
  - `shouldApplyFit`: auto + `load` + 1000×700 → `true`; auto + `resize` → `true`; manual + `load` → `true`; manual + `resize` → `false`; width `0` ou height `0` ou negativo, em qualquer modo e motivo → `false` (janela escondida).
  - `resolveManualZoomOnLoad`: `(1.5, 0.4)` → `1.5`; `(undefined, 0.4)` → `0.4`; `(0, 0.4)`, `(NaN, 0.4)`, `(-1, 0.4)` → `0.4` (zoom salvo inválido cai no ajuste).
  - `decideZoomOnFit`: auto + `resize` válido → `{ zoom: fitScale, saveZoom: false }`; manual + `resize` → `{ zoom: null, saveZoom: false }`; manual + `load` com `savedZoom: 1.5` → `{ zoom: 1.5, saveZoom: false }`; manual + `load` sem `savedZoom` → `{ zoom: fitScale, saveZoom: true }`; qualquer modo com viewport `0×0` → `{ zoom: null, saveZoom: false }`.
  - `describeZoomIndicator('auto', 0.52)` → `label: '52%'`, `showFitIcon: true`, `clickable: false`, `tooltip` e `ariaLabel` contendo o texto do modo Automático; `('manual', 1.5)` → `label: '150%'`, `showFitIcon: false`, `clickable: true`, tooltip exato das Global Constraints; `ariaLabel` de cada modo contém o nome do modo e o percentual.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/zoomMode.test.ts`
Expected: FAIL com "Cannot find module '../src/utils/zoomMode'" (ou funções indefinidas).

- [ ] **Step 3: Implementar `src/utils/zoomMode.ts`** com as assinaturas acima. `decideZoomOnFit` usa `shouldApplyFit` e `resolveManualZoomOnLoad`; `saveZoom` é `true` só em manual + `load` quando `savedZoom` é inválido (ausente, `NaN` ou `<= 0`). `describeZoomIndicator` usa `formatZoomPercentage` e os tooltips exatos das Global Constraints.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/zoomMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Ponto de commit** (espera o usuário)
  - Arquivos: `src/utils/zoomMode.ts tests/zoomMode.test.ts`
  - Mensagem sugerida: `feat(zoom): regras puras dos modos de zoom automatico e manual`

---

### Task 2: Estado do zoom (`zoomStore.ts`)

**Files:**
- Create: `src/state/zoomStore.ts`
- Test: `tests/zoomStore.test.ts`

**Interfaces:**
- Consumes: `ZoomMode`, `DEFAULT_ZOOM_MODE` de `src/utils/zoomMode.ts`; padrão `StorageLike` de `src/state/themeStore.ts` (reexportar o tipo ou redeclarar `{ getItem; setItem }`).
- Produces (exports de `src/state/zoomStore.ts`):
  - `const ZOOM_MODE_STORAGE_KEY = 'renart-zoom-mode'`
  - `createZoomStore(env?: { storage?: StorageLike })` retornando `{ getMode(): ZoomMode; setMode(mode: ZoomMode): void; subscribe(listener: () => void): () => void; saveManualZoom(captureId: string, zoom: number): void; getManualZoom(captureId: string): number | undefined; removeManualZoom(captureId: string): void; hasShownManualNotice(): boolean; markManualNoticeShown(): void }`
  - `const zoomStore` (instância padrão, `storage` = `window.localStorage` protegido por `try/catch`); `type ZoomStore`

- [ ] **Step 1: Escrever os testes em `tests/zoomStore.test.ts`** com `fakeStorage` como em `tests/themeStore.test.ts`:
  - padrão é `'auto'` sem nada salvo;
  - `setMode('manual')` grava `'manual'` em `ZOOM_MODE_STORAGE_KEY` e uma nova store sobre o mesmo storage lê `'manual'`;
  - valor inválido salvo (`'banana'`) → `'auto'`;
  - storage cujo `getItem` e `setItem` lançam exceção → `getMode()` devolve `'auto'` e `setMode` não lança (modo continua valendo em memória);
  - `setMode` notifica `subscribe` uma vez por mudança real e não notifica se o modo for o mesmo; o `unsubscribe` retornado para de notificar;
  - `saveManualZoom('a', 1.5)` / `getManualZoom('a')` → `1.5`; `getManualZoom('b')` → `undefined`; `removeManualZoom('a')` → `undefined`;
  - `hasShownManualNotice()` é `false` até `markManualNoticeShown()`, depois `true`; a flag não vai para o storage.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/zoomStore.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/state/zoomStore.ts`**: leitura e escrita do modo protegidas por `try/catch`; modo em memória como fonte de verdade depois da primeira leitura; `Map<string, number>` para o zoom manual; listeners em `Set`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/zoomStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Ponto de commit** (espera o usuário)
  - Arquivos: `src/state/zoomStore.ts tests/zoomStore.test.ts`
  - Mensagem sugerida: `feat(zoom): store do modo de zoom, zoom manual por imagem e flag do aviso`

---

### Task 3: Observador de tamanho no `CanvasEditor`

**Files:**
- Create: `src/utils/frameCoalescer.ts`
- Modify: `src/components/CanvasEditor.tsx` (prop `onFitScaleCalculated` em `:127` e `:309`; efeito de carga em `:466-483`)
- Test: `tests/frameCoalescer.test.ts`

**Interfaces:**
- Consumes: `FitReason` de `src/utils/zoomMode.ts`; `calculateFitToScreenScale` (já importado no `CanvasEditor`).
- Produces:
  - `createFrameCoalescer(run: () => void, requestFrame?: (cb: () => void) => number, cancelFrame?: (id: number) => void): { schedule(): void; cancel(): void }` em `src/utils/frameCoalescer.ts` (padrões: `requestAnimationFrame` e `cancelAnimationFrame`). `schedule()` várias vezes antes do quadro executa `run` **uma vez**; `cancel()` descarta a execução pendente.
  - Prop do `CanvasEditor`: `onFitScaleCalculated?: (scale: number, reason: FitReason, viewport: { width: number; height: number }) => void`.

- [ ] **Step 1: Escrever `tests/frameCoalescer.test.ts`** com `requestFrame` falso que guarda o callback e `cancelFrame` falso:
  - três `schedule()` seguidos e um quadro disparado → `run` chamado 1 vez;
  - depois do quadro, um novo `schedule()` agenda de novo (nova execução);
  - `schedule()` seguido de `cancel()` e quadro disparado → `run` não é chamado;
  - `cancel()` sem nada pendente não lança.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/frameCoalescer.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `createFrameCoalescer`** em `src/utils/frameCoalescer.ts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/frameCoalescer.test.ts`
Expected: PASS.

- [ ] **Step 5: Ligar no `CanvasEditor.tsx`.**
  - No `onload` da imagem, chamar `onFitScaleCalculated?.(scale, 'load', { width: vw, height: vh })`.
  - Novo `useEffect` dependente de `bgImage`: se `typeof ResizeObserver === 'undefined'` ou não há `containerRef.current` ou `bgImage`, não faz nada. Senão cria um `ResizeObserver` no container cujo callback agenda um `createFrameCoalescer` que lê `clientWidth/clientHeight`, calcula `calculateFitToScreenScale(bgImage.width, bgImage.height, vw, vh, 24)` e chama `onFitScaleCalculated?.(scale, 'resize', { width: vw, height: vh })`. A limpeza do efeito chama `coalescer.cancel()` e `observer.disconnect()`.
  - Usar uma ref para `onFitScaleCalculated` (como o resto do arquivo faz com `onUpdateAnnotationRef`) para o efeito não recriar o observador a cada render.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros de tipo e suíte completa verde. (O `App` ainda aceita a assinatura antiga porque os parâmetros novos são extras; a Task 4 os usa.)

- [ ] **Step 7: Ponto de commit** (espera o usuário)
  - Arquivos: `src/utils/frameCoalescer.ts src/components/CanvasEditor.tsx tests/frameCoalescer.test.ts`
  - Mensagem sugerida: `feat(zoom): observar o tamanho da area do editor e informar o motivo do ajuste`

---

### Task 4: Aplicar os modos no `App`

**Files:**
- Modify: `src/App.tsx` (`handleFitScaleCalculated` ~`:118`, `handleZoomIn/Out/ResetZoom` ~`:128-138`, `onClose` da galeria ~`:676`, JSX do aviso ~`:747`, props da `Toolbar` ~`:647`)
- Test: `tests/integration.test.ts` (novo bloco `describe`)

**Interfaces:**
- Consumes: `decideZoomOnFit`, `nextZoomMode`, `ZoomMode`, `FitReason` (Task 1); `zoomStore` (Task 2); o novo terceiro formato de `onFitScaleCalculated` (Task 3).
- Produces: para a Task 5, a prop `zoomMode: ZoomMode` passada à `Toolbar`; o `onResetZoom` existente passa a significar "voltar ao automático".

- [ ] **Step 1: Escrever o teste de integração** em `tests/integration.test.ts`, bloco `describe('zoom automático e manual')`, simulando a sequência com `createZoomStore({ storage })`, `createGalleryStore()` e `decideZoomOnFit` (aplicando o resultado a uma variável `zoom` e a `zoomStore` como o `App` fará):
  - **Auto acompanha o monitor:** imagem 3000×2000, `load` em viewport 1200×800 → `zoom` = ajuste desse viewport (< 1); `resize` para 2400×1600 → `zoom` sobe, sem passar de `1.0`; `resize` de volta para 1200×800 → `zoom` desce.
  - **Imagem pequena nunca amplia:** imagem 600×400 em viewport 2400×1600 → `zoom` = `1.0`.
  - **Manual congela:** depois de `setMode('manual')` e `saveManualZoom(id, 1.5)`, um `resize` não altera `zoom`.
  - **Troca de imagem em Manual:** captura A com zoom salvo `1.5`, captura B sem zoom; `load` de B → usa o ajuste e `saveZoom: true` (o teste salva); voltar a A → `load` restaura `1.5`.
  - **Voltar ao automático:** `setMode('auto')` seguido de `resize` → `zoom` = ajuste atual.
  - **Janela escondida:** `resize` com viewport `0×0` em auto → `zoom` não muda.
  - **Sem captura ativa:** com galeria vazia (`getActiveCapture()` nulo), a função auxiliar do teste que aplica o resultado não lança nem chama `saveManualZoom` com chave indefinida.
  - **Remoção:** fechar uma captura chama `removeManualZoom` e o zoom salvo dela some.

- [ ] **Step 2: Rodar o teste de integração**

Run: `npx vitest run tests/integration.test.ts`
Expected: PASS. Este bloco compõe regras e stores já implementados e testados nas Tasks 1 e 2, então ele **não** inicia em vermelho; ele fixa o comportamento combinado antes de ligar o `App`, que não tem teste unitário próprio (é ligação de React). Se algum caso falhar, é bug de regra: corrigir primeiro com um teste unitário que falhe no módulo da Task 1 ou 2, não remendar no `App`.

- [ ] **Step 3: Confirmar a leitura ao vivo dos stores**: o `handleFitScaleCalculated` não pode capturar `mode` nem o id da captura por fechamento (evita zoom obsoleto). O passo seguinte implementa isso lendo `zoomStore.getMode()` e `galleryStore.getActiveCapture()` no momento da chamada.

- [ ] **Step 4: Ligar no `App.tsx`.**
  - Assinar o modo com `useSyncExternalStore(zoomStore.subscribe, zoomStore.getMode)`.
  - `handleFitScaleCalculated(scale: number, reason: FitReason, viewport)`: `setFitScale(scale)`; lê no momento da chamada `zoomStore.getMode()` e `galleryStore.getActiveCapture()?.id`; chama `decideZoomOnFit`; se `zoom !== null`, `setZoomLevel(zoom)`; se `saveZoom` e há id da captura, `zoomStore.saveManualZoom(id, zoom)`. `useCallback` com dependências vazias (leitura ao vivo dos stores, sem fechamento obsoleto).
  - `handleZoomIn` / `handleZoomOut`: calculam o próximo passo, `setZoomLevel`, `zoomStore.setMode(nextZoomMode(modo, 'user-zoom'))`, salvam o zoom da captura ativa (`saveManualZoom`) e, se `zoomStore.hasShownManualNotice()` for falso e o modo anterior era `auto`, chamam `markManualNoticeShown()` e mostram o aviso.
  - `handleResetZoom` (atalho e clique no indicador): `zoomStore.setMode(nextZoomMode(modo, 'reset-to-auto'))` e `setZoomLevel(fitScale)`. Deixa de alternar para 100%.
  - Aviso: `useState<string | null>` próprio (`zoomNotice`), com `useEffect` que o limpa após 4000 ms; renderizado ao lado do banner de captura, com `role="status"`, mesmos tokens de `palette`, texto exato das Global Constraints.
  - `onClose` da galeria: acrescentar `zoomStore.removeManualZoom(id)`.
  - Passar `zoomMode` à `Toolbar`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros e suíte completa verde.

- [ ] **Step 6: Ponto de commit** (espera o usuário)
  - Arquivos: `src/App.tsx tests/integration.test.ts`
  - Mensagem sugerida: `feat(zoom): modos automatico e manual com troca implicita e aviso de primeira vez`

---

### Task 5: Indicador de zoom na `Toolbar`

**Files:**
- Modify: `src/components/Toolbar.tsx` (imports `~:20` e `~:44`; props `~:250`/`~:410`; botão do percentual `~:1602-1622`)
- Test: `tests/zoomMode.test.ts` (já cobre `describeZoomIndicator`); verificação manual do componente

**Interfaces:**
- Consumes: `describeZoomIndicator`, `ZoomMode` (Task 1); prop `zoomMode` fornecida pelo `App` (Task 4).
- Produces: nenhuma interface nova.

- [ ] **Step 1: Escrever o teste que falta** em `tests/zoomMode.test.ts` caso a Task 1 não tenha coberto: `describeZoomIndicator` nunca devolve `clickable: true` com `showFitIcon: true`. Rodar `npx vitest run tests/zoomMode.test.ts` (deve passar se a Task 1 já cobriu; se for novo, ver falhar e corrigir).

- [ ] **Step 2: Atualizar `Toolbar.tsx`.**
  - Importar o ícone `Scan` de `lucide-react` e `describeZoomIndicator`; nova prop `zoomMode?: ZoomMode` (padrão `'auto'`).
  - No botão do percentual: obter `describeZoomIndicator(zoomMode, zoomLevel)`; renderizar `<Scan size={12} />` na cor de destaque do tema (`palette`, o mesmo token de acento já usado em botões ativos da barra) quando `showFitIcon`; `title` = `tooltip`; `aria-label` = `ariaLabel`; `aria-pressed={zoomMode === 'auto'}`; `onClick={onResetZoom}` apenas quando `clickable` (em Automático o clique não faz nada); `cursor: 'pointer'` e destaque no hover só quando `clickable`, senão `cursor: 'default'`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros e suíte completa verde.

- [ ] **Step 4: Ponto de commit** (espera o usuário)
  - Arquivos: `src/components/Toolbar.tsx tests/zoomMode.test.ts`
  - Mensagem sugerida: `feat(zoom): indicador de zoom mostra o modo automatico ou manual`

---

### Task 6: Documentação e validação manual

**Files:**
- Modify: `docs/manual-de-funcionamento-e-fluxo.md`, `docs/acionamento-e-atalhos.md`

- [ ] **Step 1: Atualizar os docs.** No manual de funcionamento: descrever os dois modos, a troca implícita, o indicador, o aviso de primeira vez e o limite de 100%. Em `acionamento-e-atalhos.md`: `Ctrl/Cmd 0` passa a "voltar ao zoom automático". Procurar com `grep -n -i "zoom\|ctrl.*0" docs/*.md` os trechos antigos sobre 100% fixo e corrigir.

- [ ] **Step 2: Verificação final**

Run: `npx tsc --noEmit && npm test && (cd src-tauri && cargo test)`
Expected: tudo verde. O Rust não foi alterado; a execução confirma que nada quebrou.

- [ ] **Step 3: Validação manual com `npm run tauri dev` (pelo usuário).** O executor entrega o roteiro **detalhado no terminal**, passo a passo com o resultado esperado: (1) abrir imagem grande em Automático e ver o ícone e o percentual reduzido; (2) redimensionar a janela e ver o percentual acompanhar; (3) mover a janela para outro monitor e ver o ajuste; (4) dar zoom com `+`, `Cmd`+roda e pinça: ícone some, aviso aparece uma vez; (5) redimensionar e trocar de monitor em Manual: zoom não muda; (6) trocar de imagem na galeria: cada uma guarda o zoom; (7) `Ctrl+0` e clique no indicador voltam ao Automático; (8) imagem pequena não é ampliada em monitor grande; (9) fechar a janela na bandeja, capturar pelo atalho e confirmar que o zoom não pula para 100% ao reaparecer; (10) exportar em PNG e conferir as dimensões originais. Ajustar o que falhar.

- [ ] **Step 4: Ponto de commit** (espera o usuário)
  - Arquivos: `docs/manual-de-funcionamento-e-fluxo.md docs/acionamento-e-atalhos.md docs/superpowers/plans/2026-11-08-zoom-automatico-manual.md`
  - Mensagem sugerida: `docs(zoom): documentar os modos de zoom e o novo atalho Ctrl+0`
