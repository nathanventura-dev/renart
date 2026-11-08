# Design Doc: Zoom Automático e Zoom Manual

## 1. Objetivo
Fazer a imagem do editor **acompanhar a área útil da janela** sem que o usuário precise ajustar o zoom, e ao mesmo tempo permitir que ele **fixe um zoom próprio** quando quiser. Hoje o ajuste só acontece quando a imagem carrega; ao trocar de monitor ou redimensionar a janela o zoom fica congelado e, ao reabrir uma captura na galeria, ela se reajusta de forma que parece inconsistente.

## 2. Contexto
- O commit `54b80d0` aplica o ajuste à tela **uma única vez, ao carregar a imagem** (`handleFitScaleCalculated` em `src/App.tsx`), com `calculateFitToScreenScale` (nunca acima de 100%, sem o mínimo manual de 25%, arredondando para baixo). A exportação e a cópia já renderizam em 1:1 (`toNativeDataUrl`), então mudar o zoom não altera a resolução.
- O zoom vive em `useState` no `App`; `fitScale` guarda o último ajuste calculado e hoje só serve ao `Ctrl+0`, que alterna entre ajustado e 100%.
- `CanvasEditor` calcula o ajuste dentro do `onload` da imagem, usando `containerRef.clientWidth/Height`. Não observa mudanças de tamanho do container.
- O indicador de zoom na `Toolbar` é `[−] 52% [+]`; o percentual faz o reset.
- `themeStore` já estabelece o padrão de preferência salva em `localStorage` com `StorageLike` injetável.
- A galeria (`galleryStore`) tem `removeCapture(id)` e `activeId`.

## 3. Decisões Acordadas
- **Dois modos:** *Automático* (padrão) e *Manual*.
- **Automático:** o zoom é sempre o ajuste à área útil, recalculado ao carregar a imagem **e** quando o container muda de tamanho (redimensionar a janela, trocar de monitor). Nunca passa de 100%: imagem pequena fica em tamanho natural e centralizada, sem ampliar nem borrar. A resolução da imagem não muda, só a exibição.
- **Manual:** o zoom escolhido se mantém ao redimensionar a janela ou trocar de monitor. Cada imagem da galeria guarda o próprio zoom manual.
- **Troca implícita de modo**, sem interruptor separado:

| Ação do usuário | Resultado |
|---|---|
| Botão de zoom `+` ou `−`, `Cmd`/`Ctrl` + `+`/`−`, `Cmd`/`Ctrl` + roda, pinça | vai para **Manual** |
| `Cmd`/`Ctrl` + `0` ou clique no indicador | vai para **Automático** |
| Carregar imagem (captura, colagem, galeria) | mantém o modo atual |

- **Imagem nova no modo Manual:** abre ajustada à tela uma vez e então fica congelada (não abre em 100%, que reproduziria imagens gigantes com rolagem).
- **Persistência:** o **modo** é preferência salva; o **zoom manual por imagem** vive só na sessão.
- **Aviso de primeira vez:** ao passar de Automático para Manual pela primeira vez na sessão, aparece um aviso discreto e temporário: "Zoom manual ativado. Ctrl+0 volta ao automático."
- **Fora do escopo:** persistir o zoom manual entre aberturas do app; ampliar imagens pequenas; tratamento específico de densidade de pixels (DPR); reajuste do zoom manual ao mudar de monitor.

## 4. Regras Puras — `src/utils/zoomMode.ts` (novo)
- `type ZoomMode = 'auto' | 'manual'`; `DEFAULT_ZOOM_MODE = 'auto'`.
- `nextZoomMode(mode, action)`, com `action` em `'user-zoom' | 'reset-to-auto' | 'image-load'`: `user-zoom` → `manual`; `reset-to-auto` → `auto`; `image-load` → o próprio `mode`.
- `shouldApplyFit({ mode, reason, width, height })`, com `reason` em `'load' | 'resize'`: devolve `true` quando `width > 0` e `height > 0` e (`mode === 'auto'` ou `reason === 'load'`): o Automático reage a `load` e `resize`; o Manual só a `load` (para restaurar o zoom salvo). Container com tamanho zero (janela escondida na bandeja) **nunca** reajusta.
- `decideZoomOnFit({ mode, reason, width, height, fitScale, savedZoom })` → `{ zoom: number | null; saveZoom: boolean }`: concentra a decisão do §7 (`zoom: null` = não alterar), para o `App` só aplicar o resultado.
- `resolveManualZoomOnLoad(saved, fitScale)`: devolve `saved` quando existe, senão `fitScale`.
- `describeZoomIndicator(mode, zoomLevel)` → `{ label, showFitIcon, tooltip, ariaLabel, clickable }`:
  - `auto`: `showFitIcon = true`, `clickable = false`, tooltip "Zoom automático: a imagem acompanha o tamanho da janela. Dê zoom para controlar manualmente.";
  - `manual`: `showFitIcon = false`, `clickable = true`, tooltip "Zoom manual: clique para voltar ao zoom automático (Ctrl/Cmd 0).";
  - `label` usa `formatZoomPercentage`; `ariaLabel` inclui o modo e o percentual.

## 5. Estado — `src/state/zoomStore.ts` (novo)
Segue o padrão do `themeStore`: fábrica `createZoomStore(env?)` com `StorageLike` injetável e instância padrão exportada.
- `getMode()` / `setMode(mode)`: lê e grava em `localStorage` na chave `renart-zoom-mode`; valor ausente, inválido ou `localStorage` indisponível → `auto`; falha de escrita é ignorada.
- `saveManualZoom(captureId, zoom)` / `getManualZoom(captureId)` / `removeManualZoom(captureId)`: mapa em memória.
- `hasShownManualNotice()` / `markManualNoticeShown()`: flag da sessão, não persistida.
- `subscribe(listener)` para a interface reagir ao modo.

## 6. Observador de Tamanho — `CanvasEditor.tsx`
- Um `ResizeObserver` no `containerRef` chama o recálculo, agrupado por `requestAnimationFrame` (no máximo uma vez por quadro). Os dados observados vêm de `contentRect` do container.
- `onFitScaleCalculated(scale, reason)` passa a receber o motivo `'load' | 'resize'`. No `onload` da imagem, `reason = 'load'`; no observador, `'resize'`.
- O observador só atua com a imagem carregada e com largura e altura do container maiores que zero; limpa o `requestAnimationFrame` pendente e se desconecta ao desmontar.
- Sem `ResizeObserver` (ambiente de teste), nada acontece: o comportamento de carga permanece.

## 7. Comportamento no `App.tsx`
`handleFitScaleCalculated(scale, reason)`:
1. Sempre `setFitScale(scale)`.
2. Lê o modo do `zoomStore`. Se `shouldApplyFit` for `false`, para.
3. **Automático:** `setZoomLevel(scale)` (em `load` e em `resize`).
4. **Manual, `load`:** `setZoomLevel(resolveManualZoomOnLoad(getManualZoom(activeId), scale))`; se não havia zoom salvo, salva o `scale` para aquela captura. Se a imagem mudou dentro da mesma captura (recorte), mantém o zoom atual.
5. **Manual, `resize`:** não altera o zoom.

Demais pontos:
- `handleZoomIn`, `handleZoomOut` (inclui `Cmd`/`Ctrl` + roda e pinça, que já chamam esses handlers) executam `nextZoomMode('user-zoom')`, gravam `manual` e salvam o novo zoom da captura ativa. Na primeira transição `auto → manual` da sessão, disparam o aviso.
- `handleResetZoom` (atalho `Ctrl/Cmd 0` e clique no indicador) executa `nextZoomMode('reset-to-auto')`, grava `auto` e aplica `setZoomLevel(fitScale)`. Deixa de alternar para 100%.
- Ao trocar a captura ativa em modo Manual, salva o zoom da captura que sai.
- `galleryStore.removeCapture` limpa a entrada do zoom manual da captura removida.
- Aviso: estado próprio (`zoomNotice`), neutro e fechado automaticamente após cerca de 4 s, separado do banner de erro de captura (`captureNotice`).

## 8. Indicador — `Toolbar.tsx`
- Novas props: `zoomMode`, e o texto e o estado vêm de `describeZoomIndicator`.
- **Automático:** ícone `Scan` (lucide-react) na cor de destaque do tema antes do percentual; sem ação ao clicar.
- **Manual:** sem ícone, texto neutro, cursor de mão e fundo no hover; clique chama `onResetZoom`.
- `title` e `aria-label` por modo; `aria-pressed` reflete o modo Automático. Todas as cores saem de `palette` (temas claro e escuro).

## 9. Casos de Borda
- **Janela escondida (bandeja):** container com tamanho zero → `shouldApplyFit` falso; o zoom não pula para 100% ao reaparecer.
- **Ciclo de rolagem no redimensionamento:** em Automático nunca há rolagem (ajuste arredondado para baixo, já garantido) e o recálculo é agrupado por quadro; sem ciclo.
- **Troca de monitor com o mesmo tamanho lógico de janela:** o container não muda, nada a recalcular.
- **Valor inválido salvo no `localStorage`:** volta a `auto`.
- **Imagem removida da galeria:** o zoom manual salvo dela é descartado.
- **Exportar e copiar:** inalterados; já renderizam 1:1 independente do zoom.

## 10. Estratégia de Testes (TDD)
- `tests/zoomMode.test.ts`: tabela de `nextZoomMode`; `shouldApplyFit` (auto/manual, load/resize, tamanho zero); `resolveManualZoomOnLoad`; `describeZoomIndicator` nos dois modos.
- `tests/zoomStore.test.ts`: padrão `auto`; persistência; valor inválido; storage indisponível; zoom manual por imagem e remoção; flag do aviso.
- `tests/integration.test.ts`: sequência Automático (viewport menor e maior, imagem nunca acima de 100%) → zoom manual → troca de imagem restaura o zoom → `Ctrl+0` volta ao automático → remoção limpa a entrada.
- `tests/zoomAndCrop.test.ts` e `tests/exportService.test.ts` seguem verdes sem mudanças.
- **Validação manual (sua):** roteiro detalhado no terminal ao final, incluindo troca real de monitor.

## 11. Documentação
Atualizar `docs/manual-de-funcionamento-e-fluxo.md` (comportamento de zoom e indicador) e `docs/acionamento-e-atalhos.md` (`Ctrl/Cmd 0` passa a "voltar ao zoom automático"), no mesmo PR da implementação.
