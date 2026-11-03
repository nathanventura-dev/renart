# Design: Desseleção ao Clicar Fora e Criação Direta com Atalho Alt

## 1. Contexto e Motivação
Atualmente no editor, as ferramentas de desenho que exigem clique e arraste (retângulo, elipse, redação) possuem um comportamento conveniente: quando um elemento está selecionado e o usuário clica em uma área vazia da imagem, o elemento é apenas desselecionado, sem criar acidentalmente um novo objeto.

Por outro lado, a ferramenta de **Texto** cria o bloco no clique simples (`MouseDown`). Isso gerava frustração: ao clicar fora para fechar a edição ou desselecionar o texto, uma nova caixa de texto ("Digite seu texto aqui") era criada indesejadamente no ponto do clique.

Além disso, os usuários desejam:
1. Poder criar elementos em série de forma ágil com um atalho (`Alt + Click`), permitindo carimbar formas com dimensões padrão no clique simples ou desenhar diretamente sem precisar desselecionar antes.
2. Usar `Ctrl + Click` (e `Cmd + Click` no Mac) para alternar a seleção de elementos específicos (multiseleção), alinhando ao padrão universal de sistemas operacionais e ferramentas de design (além do `Shift + Click` já existente).
3. Selecionar blocos de **Ocultar Informações (Redação)** com a caixa de seleção por arraste (`marquee box`), que atualmente são ignorados pelo algoritmo de interseção.

---

## 2. Objetivos e Não-Objetivos

### Objetivos
- **Desseleção Padrão Consistente:** Qualquer clique simples em área vazia quando houver elemento(s) selecionado(s) ou edição de texto ativa deve **apenas desselecionar** e finalizar a edição, sem criar novos elementos (aplicado a Texto e todas as ferramentas).
- **Atalho `Alt` Universal:**
  - Segurar `Alt` permite criar uma nova instância da ferramenta ativa imediatamente, ignorando a trava de "desselecionar primeiro".
  - Se for um clique simples com `Alt` (deslocamento do mouse $\le$ 4px): insere a forma com tamanho padrão predefinido na posição do cursor.
  - Se for clique e arraste com `Alt`: desenha a forma com tamanho personalizado normalmente.
- **Multiseleção com `Ctrl`/`Cmd` + Clique:** Permitir adicionar ou remover itens específicos da seleção com `Ctrl + Click` e `Cmd + Click` (além de `Shift + Click`).
- **Suporte a Redação no Marquee:** Incluir o tipo `redaction` em `getAnnotationsInSelectionBox` para seleção e movimentação em lote.

### Não-Objetivos
- Não alterar os atalhos de teclado da ferramenta de captura global do sistema.
- Não alterar a funcionalidade da ferramenta de seleção ('select') e caixa de seleção padrão.

---

## 3. Abordagens Consideradas

### Abordagem A: Apenas deselecionar no primeiro clique, sem atalho de criação rápida
- *Prós:* Simples de implementar.
- *Contras:* Torna a criação repetida de muitos blocos de texto cansativa (2 cliques por bloco).

### Abordagem B: Atalho Alt + Click criando tamanhos padrão E Alt + Arraste desenhando (Escolhida)
- *Prós:* Resolve o problema da criação acidental sem perder a agilidade do fluxo de trabalho. Adota o comportamento consagrado de softwares líderes de mercado (Figma, Illustrator, Photoshop).
- *Contras:* Requer diferenciar clique de arraste via threshold de deslocamento (5px), técnica já amplamente validada no projeto.

---

## 4. Especificação Técnica Detalhada

### 4.1. Desseleção ao Clicar no Vazio (`handleMouseDown` em `CanvasEditor.tsx`)
1. Detectar se havia seleção ativa ou edição em andamento:
   ```ts
   const hadSelection = effectiveSelectedIds.length > 0 || editingText !== null;
   const isAltPressed = Boolean(e.evt.altKey);
   ```
2. Se `hadSelection && !isAltPressed`:
   - Limpar a seleção (`applySelectionIds([])`).
   - Se `editingText` estiver ativo, o próprio `onBlur` ou a chamada fecha o editor.
   - Retornar imediatamente (`return`), sem prosseguir para a criação de nova anotação.
3. Se `!hadSelection` OU `isAltPressed`:
   - Prosseguir para a criação da anotação da ferramenta ativa.

### 4.2. Criação com Atalho `Alt` e Dimensões Padrão no Clique
1. **Ferramentas de clique imediato (`text`, `magnifier`):**
   - Criação direta na posição do cursor `pos`.
2. **Ferramentas de desenho por arraste (`rect`, `ellipse`, `line`, `arrow`, `redaction`):**
   - No `handleMouseDown`, registra `startPos` e inicia `setIsDrawing(true)`.
   - Se no `handleMouseUp` o deslocamento $\sqrt{\Delta x^2 + \Delta y^2} \le 4\text{px}$ e `isAltPressed`:
     - **Retângulo:** $120 \times 60\text{px}$ (centralizado ou ancorado em `startPos`).
     - **Elipse:** Raio X = 35px, Raio Y = 25px.
     - **Linha / Seta:** Linha horizontal de 100px a partir de `startPos`.
     - **Redação (rect):** $120 \times 40\text{px}$.
     - Clampa aos limites da imagem e adiciona via `onAddAnnotation`.
   - Se o deslocamento for $> 4\text{px}$:
     - Cria com as dimensões arrastadas pelo usuário, exatamente como o fluxo atual.

### 4.3. Multiseleção com `Ctrl + Click` (`handleBlockClick` em `CanvasEditor.tsx`)
Atualizar a condição de toggle de multiseleção:
```ts
const isMultiSelectModifier = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
if (isMultiSelectModifier && onToggleSelectId) {
  onToggleSelectId(id);
  return;
}
```

### 4.4. Ocultar Informações na Caixa de Multiseleção (`getAnnotationsInSelectionBox` em `magnifierAndHover.ts`)
Adicionar suporte ao tipo `redaction`:
```ts
} else if (ann.type === 'redaction') {
  if (ann.mode === 'brush' && ann.points && ann.points.length >= 4) {
    const xs = ann.points.filter((_, idx) => idx % 2 === 0);
    const ys = ann.points.filter((_, idx) => idx % 2 === 1);
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
  } else {
    const w = ann.width || 0;
    const h = ann.height || 0;
    const x1 = ann.x || 0;
    const y1 = ann.y || 0;
    const x2 = x1 + w * sx;
    const y2 = y1 + h * sy;
    minX = Math.min(x1, x2);
    maxX = Math.max(x1, x2);
    minY = Math.min(y1, y2);
    maxY = Math.max(y1, y2);
  }
}
```

---

## 5. Estratégia de Testes (TDD)
1. **Testes Unitários:**
   - Em `tests/magnifierAndHover.test.ts`: testar que `getAnnotationsInSelectionBox` inclui anotações de redação (`type: 'redaction'`) tanto em modo retângulo quanto brush.
   - Em `tests/canvasTextRendering.test.ts` / novos testes: testar a lógica de desseleção prévia versus atalho `Alt` para criação direta e dimensões padrão.
2. **Verificação de Regressão:**
   - Garantir que todos os 265 testes existentes continuam passando.
   - Compilação limpa do TypeScript (`tsc --noEmit`) e build de produção.
