# Especificação de Design: Níveis de Privacidade e Desfoque (Redaction Levels)

**Data:** 2026-10-31  
**Status:** Proposto para aprovação  
**Abordagem Selecionada:** Abordagem 1 (Modelo unificado `level: 1 | 2 | 3 | 4`)

---

## 1. Intenção e Contexto
Substituir a divisão binária anterior ("Tarja" vs "Blur") por uma régua coesa e progressiva de **4 níveis de privacidade**, representada por ícones intuitivos no menu flutuante horizontal da ferramenta de censura/ocultação. Essa reformulação resolve a segurança contra ferramentas de deconvolução matemática ao mesmo tempo em que oferece gradação visual para diferentes casos de uso (como desfocar rostos ou atenuar dados secundários).

---

## 2. Objetivos e Não-Objetivos

### Objetivos:
1. **Régua unificada de 4 níveis:**
   - **Nível 1 (Rosto):** Desfoque leve com raio de 8px (estético, fotos de fundo).
   - **Nível 2 (Texto atenuado):** Desfoque moderado com raio de 18px.
   - **Nível 3 (Sem visibilidade / Olho fechado):** Desfoque intenso com raio de 32px (seguro contra OCR e IA).
   - **Nível 4 (Tarja sólida):** Preenchimento 100% preto (`#000000`), sigilo inviolável.
2. **Ícones intuitivos no Toolbar:**
   - Botão principal da ferramenta no Toolbar: `<EyeOff size={16} />` (substituindo o antigo `ShieldAlert` por um ícone universalmente reconhecido para ocultar informações confidenciais).
   - Nível 1: Ícone de rosto (`Smile`).
   - Nível 2: Ícone de texto (`Type` com opacidade reduzida a ~50%).
   - Nível 3: Ícone sem visibilidade / olho fechado (`EyeClosed`).
   - Nível 4: Ícone preto sólido (`Square` preenchido em preto).
3. **Edição e sincronização em tempo real:**
   - Clicar em um nível altera a intensidade padrão para novas criações.
   - Se um bloco retangular estiver selecionado na tela, clicar em um nível atualiza o bloco imediatamente.
4. **Simplificação do Pincel:**
   - O traçado livre do Pincel aplica o nível ativo no momento do desenho.
   - Não gera alças ou pontos de seleção no canvas; correções são feitas via desfazer (`Ctrl+Z` / Botão Desfazer).
5. **Compatibilidade retroativa:**
   - Anotações prévias com `effect: 'blackout'` são interpretadas como Nível 4; `effect: 'blur'` como Nível 3.

### Não-Objetivos:
- Criar coroas giratórias no canvas para desfoque (mantemos o controle direto no menu superior).
- Selecionar traços livres de pincel com caixas de redimensionamento.

---

## 3. Abordagens Consideradas
- **Abordagem 1 (Escolhida):** Modelo unificado com `level: 1 | 2 | 3 | 4` no estado e na anotação `RedactionAnnotation`. Fonte única da verdade, eliminando estados ambíguos.
- **Abordagem 2 (Descartada):** Modelo híbrido mantendo `effect: 'blackout' | 'blur'` e adicionando `blurLevel: 1 | 2 | 3`. Descartada por fragmentar o estado e exigir sincronização extra.

---

## 4. Detalhes de Implementação

### 4.1 Estado e Tipos (`src/state/editorStore.ts` e `src/utils/redaction.ts`)
- Tipo `RedactionLevel = 1 | 2 | 3 | 4`.
- `RedactionAnnotation` passa a conter `level: RedactionLevel` (com fallback retroativo para `effect`).
- Ações `setRedactionLevel(level: RedactionLevel)` no `editorStore`.
- Mapeamento de raios de desfoque:
  ```ts
  export const REDACTION_BLUR_RADII: Record<1 | 2 | 3, number> = {
    1: 8,
    2: 18,
    3: 32,
  };
  ```

### 4.2 Barra de Ferramentas (`src/components/Toolbar.tsx`)
- Botão da ferramenta: alterar o ícone de `<ShieldAlert size={16} />` para `<EyeOff size={16} />` (Tooltip: "Ocultar Informações (Censura e Desfoque)").
- No `HorizontalFloatingMenu` da ferramenta de censura:
  - Substituir os botões de texto "Tarja" e "Blur" pelos 4 botões com os ícones:
    - Nível 1: `<Smile size={15} />` (Tooltip: "Nível 1: Desfoque suave para rostos e fundos")
    - Nível 2: `<Type size={15} style={{ opacity: 0.5 }} />` (Tooltip: "Nível 2: Desfoque moderado para texto")
    - Nível 3: `<EyeClosed size={15} />` (Tooltip: "Nível 3: Desfoque total sem visibilidade")
    - Nível 4: `<Square size={15} fill="currentColor" />` (Tooltip: "Nível 4: Tarja preta 100% sólida (Inviolável)")
  - Divisor vertical suave.
  - Seletores de modo: `Retângulo` e `Pincel`.

### 4.3 Renderização no Canvas (`src/components/CanvasEditor.tsx`)
- Canvases de blur gerados/memoizados para os raios 8px, 18px e 32px a partir de `bgImage`.
- Para retângulos de nível 1 a 3, desenha o recorte da imagem correspondente ao nível de blur selecionado. Para nível 4, desenha o `<Rect fill="#000000" />`.
- Para o pincel:
  - Nível 4 desenha traço com preenchimento `#000000`.
  - Níveis 1 a 3 desenham com pattern do canvas borrado correspondente.
  - Pincel com `listening={false}` no modo estático para não interceptar cliques nem abrir alças de seleção.
