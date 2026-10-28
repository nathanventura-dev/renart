# Design Curto: Seleção Contextual de Fonte e Tamanho para Blocos de Texto

## 1. Intenção e Porquê
Permitir ao usuário escolher a **família da fonte** e o **tamanho da fonte** nos blocos de texto (semelhante ao Microsoft Word), mantendo a barra de ferramentas minimalista, rápida e com altura unificada de `36px`.

## 2. Objetivos, Não-Objetivos e Anti-Objetivos
- **Objetivos:**
  - Exibir os seletores `[Fonte ▾]` e `[Tamanho ▾]` na barra superior sempre que a ferramenta de Texto (`text`) estiver ativa ou quando o(s) bloco(s) selecionado(s) forem do tipo `text`, substituindo contextualmente os controles de espessura de linha (`2px..8px` + `Auto`).
  - Permitir alterar a fonte e o tamanho de blocos de texto já adicionados na imagem de forma independente (somente nos blocos selecionados), além de definir o padrão para novos blocos de texto.
  - Garantir que a edição inline (`textarea`) e a renderização dentro da lente da Lupa reflitam exatamente a família e o tamanho da fonte escolhidos.
- **Não-Objetivos:** Download de fontes externas da web (Google Fonts) ou formatação rica complexa (tabelas, parágrafos avançados).
- **Anti-Objetivos:** Poluir a barra de ferramentas exibindo simultaneamente espessura de linha e controles de fonte, ou misturar valores de espessura de traço (`2px–8px`) com tamanhos tipográficos (`12–48`) no mesmo `<select>`.

## 3. Restrições
- Manter a altura unificada da barra (`36px` externa / `28px` interna nos controles).
- Usar fontes nativas de alta disponibilidade no sistema (`Arial`, `Segoe UI`, `Calibri`, `Times New Roman`, `Courier New`, `Verdana`, `Georgia`) para latência zero.
- Preservar suporte integral a `Ctrl+Z` / `Ctrl+Shift+Z` (Undo/Redo) ao alterar fonte ou tamanho de textos selecionados.

## 4. Abordagens Consideradas
1. **Troca Contextual no Mesmo Espaço da Barra (Escolhida):** Substitui os controles de linha (`2px..8px` + `Auto`) pelos seletores `[Fonte ▾]` e `[Tamanho ▾]` quando a ferramenta ativa é `text` ou quando a seleção atual no canvas contém blocos `text`. Mantém a barra enxuta e sem elementos flutuantes sobre a imagem.
2. **Mini Barra Flutuante sobre o Texto:** Mantém a barra superior fixa e abre um popover sobre o texto no canvas. Descartada por cobrir parte da imagem durante a edição.
3. **Campo Único de Pixels para Linha e Fonte:** Descartada porque escalas de linha (`2px–8px`) e escalas de leitura de texto (`12–48`) têm propósitos e intervalos incompatíveis.

## 5. Decisões de Implementação
- **Fontes Disponíveis (`FONT_FAMILIES`):** `Segoe UI`, `Arial`, `Calibri`, `Verdana`, `Georgia`, `Times New Roman`, `Courier New`. (Padrão: `Arial`).
- **Tamanhos Disponíveis (`FONT_SIZES`):** `12`, `14`, `16`, `18`, `20`, `24`, `28`, `32`, `36`, `48`. (Padrão: `18`).
- **Modelo de Estado (`editorStore.ts`):**
  - Adicionar `fontFamily?: string` em `TextAnnotation` e `fontFamily: string` em `EditorState` (padrão `'Arial'`).
  - Adicionar ações `setFontFamily(fontFamily: string)` e `setFontSize(fontSize: number)` que atualizam o padrão da ferramenta e, caso existam blocos `text` selecionados, aplicam a mudança imediatamente apenas nesses blocos registrando no histórico de Undo/Redo.
- **Renderização (`CanvasEditor.tsx`):**
  - Passar `fontFamily={ann.fontFamily || 'Arial'}` para o `<Text>` do Konva (tanto na camada principal quanto dentro da lente da Lupa) e para o `<textarea>` de edição inline.
