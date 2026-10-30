# Especificação de Design: Ferramenta de Ocultação de Dados Confidenciais (Tarja e Blur)

**Data:** 30/10/2026  
**Status:** Proposto para aprovação  
**Abordagem Escolhida:** Abordagem 1 (Anotação Vetorial Interativa no Editor com Rasterização Destrutiva Segura na Exportação)

---

## 1. Intenção e Motivação (*Why*)

Ao capturar telas no ambiente profissional ou pessoal, é extremamente comum que imagens contenham dados sensíveis e confidenciais — como senhas visíveis, números de documentos (CPF, RG), cartões de crédito, chaves de API, tokens de acesso ou nomes privados de clientes.

Atualmente, o usuário precisaria cobrir tais informações usando caixas de texto com fundo ou desenhos manuais improvisados, o que não oferece uma experiência especializada nem garantias formais de segurança.

O objetivo desta funcionalidade é fornecer uma **ferramenta dedicada de privacidade e ocultação (Redaction & Blur)** com duas opções de efeito visual (**Tarja Sólida** e **Blur Destrutivo**) e dois modos ergonômicos de aplicação (**Caixa Retangular Ajustável** e **Pincel Livre**), garantindo matematicamente que após salvar ou copiar a imagem, **os dados originais estejam completamente destruídos e irrecuperáveis**.

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
1. **Segurança de Dados e Irreversibilidade Absoluta:**
   - A Tarja Sólida (*Blackout*) deve substituir 100% dos pixels confidenciais por blocos opacos (preto `#000000`).
   - O Blur deve aplicar desfoque/pixelização de alta intensidade (`blurRadius >= 20px`), destruindo a entropia visual e prevenindo ataques de desofuscação baseados em correlação ou OCR reverso (ex: ferramentas como *Depix*).
   - O processo de exportação (PNG, JPG, PDF) e cópia para o clipboard (`exportService`) deve achatar (*flatten/bake*) todas as anotações no Canvas 2D nativo, eliminando qualquer camada vetorial ou metadado oculto residual.

2. **Interface e Ergonomia na Barra de Ferramentas (`Toolbar.tsx`):**
   - Novo botão dedicado com ícone semântico de proteção (`ShieldAlert` ou `EyeOff` do `lucide-react`), localizado ao lado das ferramentas de texto e lupa.
   - Submenu flutuante minimalista (seguindo o padrão horizontal das flechas e lupa):
     - **Tipo de Ocultação:** `Tarja Sólida` (Blackout) vs `Blur` (Desfoque/Pixelização).
     - **Modo de Aplicação:** `Retângulo` (caixa demarcatória ajustável) vs `Pincel` (caneta de arraste livre).

3. **Interatividade no Canvas (`CanvasEditor.tsx` & `editorStore.ts`):**
   - **Modo Retângulo:** Permite ao usuário clicar e arrastar para criar a caixa sobre a informação sensível. Após criada, integra-se ao `Transformer` do Konva para permitir mover, redimensionar pelas alças e rotacionar antes de salvar.
   - **Modo Pincel:** Permite ao usuário clicar e arrastar livremente como uma caneta de ponta arredondada (`lineCap="round"`, `lineJoin="round"` com espessura padrão generosa de 24px) para cobrir linhas de texto irregulares.
   - Suporte completo ao histórico de **Desfazer e Refazer (`Ctrl+Z` / `Ctrl+Shift+Z`)** e seleção/exclusão com tecla `Delete` durante a edição.

### Não-Metas (Non-Goals)
- Não modificar o fluxo de captura nativa em Rust (`xcap`) ou o sistema de janelas do Tauri.
- Não manter histórico de edições embutido em arquivos PNG/JPG exportados (a exportação é intencionalmente unidirecional e segura).

### Anti-Metas (Anti-Goals)
- Não utilizar desfoques leves ou estéticos que permitam leitura residual por inteligência artificial ou filtros de contraste.
- Não exportar arquivos PDF com camadas vetoriais separadas que possam ser selecionadas e deletadas por leitores de PDF.

---

## 3. Abordagens Consideradas

### Abordagem 1: Anotação Vetorial com Rasterização Destrutiva na Exportação (Escolhida)
* **Conceito:** O usuário desenha a tarja ou o desfoque como objetos da cena Konva. Durante a edição, o usuário desfruta de total flexibilidade (ajuste de tamanho, reposicionamento, desfazer/refazer). Ao exportar para arquivo ou copiar para o clipboard, o Konva queima (*bakes*) a cena diretamente no buffer rasterizado de pixels, destruindo fisicamente as informações confidenciais.
* **Por que foi escolhida:** Combina máxima usabilidade e precisão no editor com 100% de segurança criptográfica/matemática no artefato final exportado.

### Abordagem 2: Queima Direta e Imediata no Bitmap
* **Conceito:** No momento em que o mouse é solto, os pixels da imagem de fundo são modificados permanentemente via `putImageData`.
* **Por que foi descartada:** Impede que o usuário reposicione a caixa ou faça micro-ajustes se a área demarcada ficar 2 pixels fora do texto, exigindo refazer o desenho do zero.

---

## 4. Detalhamento Arquitetural e Modelagem de Dados

### 4.1. Definição no Estado (`src/state/editorStore.ts`)

```typescript
export type RedactionEffect = 'blackout' | 'blur';
export type RedactionMode = 'rect' | 'brush';

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redaction';
  effect: RedactionEffect; // 'blackout' (tarja sólida) | 'blur' (desfoque forte)
  mode: RedactionMode;     // 'rect' (caixa ajustável) | 'brush' (pincelada livre)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: number[];       // Utilizado quando mode === 'brush'
  brushSize?: number;      // Espessura do traço no modo pincel (default: 24)
}
```

Estados adicionados à `EditorStore`:
- `activeRedactionEffect: RedactionEffect` (default: `'blackout'`)
- `activeRedactionMode: RedactionMode` (default: `'rect'`)
- Métodos: `setRedactionEffect(effect)`, `setRedactionMode(mode)`.

### 4.2. Renderização no Canvas (`src/components/CanvasEditor.tsx`)

1. **Tarja Sólida (`effect === 'blackout'`):**
   - `mode === 'rect'`: Renderizado com `<Rect>` do Konva preenchido com `#000000` (100% de opacidade) e cantos levemente arredondados (`cornerRadius: 2`). Totalmente acoplado ao `Transformer` para movimentação e redimensionamento.
   - `mode === 'brush'`: Renderizado com `<Line>` do Konva com `stroke="#000000"`, `strokeWidth={annotation.brushSize || 24}`, `lineCap="round"` e `lineJoin="round"`.

2. **Blur Destrutivo (`effect === 'blur'`):**
   - Renderizado utilizando `<Group>` com `clipFunc` limitado pelo retângulo ou traço do pincel, contendo uma cópia da imagem base com filtro `Konva.Filters.Blur` (`blurRadius: 24`) com chamada a `node.cache()`.
   - Alternativamente, desenhado com Canvas 2D auxiliar aplicando desfoque de alta densidade com amostragem reduzida para máxima fluidez a 60fps.

### 4.3. Pipeline de Exportação Segura (`src/services/exportService.ts`)

O método `exportCanvas` e a função de cópia utilizam `stage.toDataURL(...)` e `stage.toCanvas()`.
- Antes de exportar, os elementos de interface (Transformer, âncoras, caixas de seleção) são ocultados (como já implementado em `toggleEditorOverlaysVisibility`).
- O Canvas resultante é gerado como um mapa de bits plano (*flat raster image*).
- No caso do PDF, a imagem achatada em PNG/JPEG sem camadas é inserida via `jsPDF.addImage`, impedindo qualquer separação de camadas no visualizador de PDF.

---

## 5. Plano de Testes Automatizados

1. **Testes Unitários no `editorStore.test.ts`:**
   - Criação de anotação de ocultação com efeito Tarja e modo Retângulo.
   - Criação de anotação com efeito Blur e modo Pincel.
   - Alternância de ferramentas e persistência das configurações no estado.
   - Validação de histórico Undo/Redo ao criar e remover anotações de redaction.

2. **Testes de Renderização e Controles no `toolbarMenus.test.ts`:**
   - Exibição do botão da ferramenta de Ocultação na Toolbar.
   - Abertura do submenu com opções de Tarja Sólida, Blur, Retângulo e Pincel.
   - Seleção das opções e disparo correto dos callbacks.

3. **Testes de Integração e Exportação no `exportService.test.ts`:**
   - Validação de que a renderização oculta âncoras de seleção durante a cópia e exportação.
   - Validação de dimensões e formato do arquivo gerado.
