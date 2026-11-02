# Especificação de Design: Editor Inline Fluido de Texto e Auto-Fit de Bloco

**Data:** 2026-11-02  
**Status:** Proposto  
**Branch:** `feature/flecha-fina-chevron`

---

## 1. Contexto e Motivação
A implementação anterior do editor inline de texto sobre o Canvas apresentava duas grandes dores de usabilidade:
1. Pressionar `Enter` fechava e descartava o texto imediatamente devido a um ciclo assíncrono de desmontagem do `contenteditable` com texto não sincronizado.
2. O redimensionamento manual de fonte arrastando as alças da caixa de texto gerava inconsistências visuais e conflitos com o `<Group>` do Konva (que agrupa fundo de destaque e trechos com formatação mista).

---

## 2. Objetivos e Não-Objetivos
### Objetivos:
- **Digitação fluida multi-linha:** Pressionar `Enter` cria uma nova quebra de linha (`\n`) naturalmente dentro do bloco de texto.
- **Confirmação intuitiva:** O texto é concluído e fixado no Canvas ao clicar fora (blur em qualquer área do Canvas), ao selecionar outra ferramenta, ou pressionar `Esc` / `Ctrl+Enter`.
- **Sincronização à prova de perdas:** O conteúdo digitado é sincronizado continuamente (`onInput`), garantindo que nunca seja descartado acidentalmente.
- **Formatação por seleção e em bloco:** Manter o suporte completo a Negrito (`Ctrl+B/N`), Itálico (`Ctrl+I`), Sublinhado (`Ctrl+U`), Tachado (`Ctrl+Shift+X`/`Alt+Shift+5`), Alinhamento e Caixa de Destaque, aplicando no trecho selecionado ou no bloco todo se nada estiver selecionado.
- **Auto-Fit do Bloco (Opção A):** A largura e altura do bloco de texto (e de sua caixa de destaque) se ajustam automaticamente ao conteúdo digitado.
- **Alças de Seleção Limpas:** Desabilitar o redimensionamento livre de fonte por alças de canto na ferramenta Transformer para anotações de texto, mantendo alças de movimentação e rotação. O controle de tamanho de fonte (`fontSize`) fica exclusivo, padronizado e nítido via Toolbar superior (`12, 14, 16, 18, 20, 24, 28...`).

### Não-Objetivos:
- Não implementar quebra de linha forçada por alça de largura estática (Word Wrap fixo) nesta etapa.
- Não utilizar bibliotecas externas de Rich Text pesadas (mantendo 100% offline, leve e sem tainting de canvas no export).

---

## 3. Abordagem Selecionada (Abordagem 1 + Opção A)
- **Editor Inline Direto:** Componente editável sobreposto no Canvas com foco automático.
- **Ciclo de Edição:**
  - `Enter`: Insere quebra de linha.
  - `Escape` ou `Ctrl+Enter`: Conclui a edição e salva a anotação.
  - `onBlur`: Conclui a edição preservando o texto atualizado. Se o texto for apenas espaços em branco ao ser criado pela primeira vez, descarta a anotação para não poluir o canvas.
- **Transformer de Texto:**
  - Quando um elemento de texto é selecionado isoladamente no Canvas, o Konva `Transformer` oculta as alças de redimensionamento (`enabledAnchors: []`), permitindo rotação (`rotateEnabled: true`) e arrasto (`draggable: true`).
- **Renderização Konva:**
  - Cálculo de bounding box exato (`approxW`, `approxH`) baseado nas linhas e spans, recalculado automaticamente a cada alteração de texto ou fonte.

---

## 4. Plano de Verificação
- Testes unitários para ciclo de teclas do editor inline (`Enter` = newline, `Ctrl+Enter` / `Esc` = commit).
- Teste de auto-ajuste de dimensões de texto com spans e quebras de linha no Canvas.
- Verificação de não-ocorrência de perda de texto em blur.
- Validação completa com `npm test` (26+ suítes de teste), `tsc --noEmit` e `npm run build`.
