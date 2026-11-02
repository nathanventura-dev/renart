# Especificação de Design: Blindagem Anti-IA por Embaralhamento de Entropia (Níveis 1 e 2)

**Data:** 2026-11-01  
**Status:** Aprovado para implementação  

---

## 1. Contexto e Motivação

Na ocultação de informações em capturas de tela, os níveis de desfoque suave (Nível 1 - 8px e Nível 2 - 16px) oferecem excelente estética visual, mas teoricamente podem ser alvos de ferramentas de desofuscação baseadas em inteligência artificial (*AI De-blurring / Convolution Reversal*) que buscam reconstituir dígitos ou feições conhecidas.

Em vez de recorrer a OCR pesado com substituição artificial de palavras (*Lorem Ipsum/Inpainting*), a solução ideal é o **Embaralhamento de Entropia por Pixels (*Pixel Shuffling + Noise Injection*)**:
- **A olho nu:** Permanece um desfoque fosco, suave e perfeitamente integrado à captura.
- **Por debaixo dos panos:** Os pixels originais da região são permutados e perturbados aleatoriamente antes da passagem do filtro de desfoque, destruindo fisicamente a informação de alta frequência. Qualquer tentativa de desofuscação por IA resultará apenas em ruído estático irrevogável.

---

## 2. Objetivos e Não-Objetivos

### Objetivos (Goals)
1. **Algoritmo de Embaralhamento (`src/utils/scrambleBlur.ts`):**
   - Função pura para embaralhar blocos de pixels e injetar ruído suave em um `HTMLCanvasElement` ou `ImageData`.
   - **Nível 1 (Rostos e Fundos):** Micro-permutação (blocos de 2x2 a 3x3 px) com desfoque de 8px.
   - **Nível 2 (Textos e Números):** Permutação média (blocos de 4x4 a 5x5 px) com desfoque de 16px.
2. **Integração no Canvas (`CanvasEditor.tsx`):**
   - Os canvases pré-calculados de desfoque (`blurredBgCanvases[1]` e `blurredBgCanvases[2]`) geram a versão embaralhada antes de aplicar `ctx.filter = 'blur(...)'`.
   - Funciona automaticamente tanto para o modo **Retângulo** quanto para o modo **Pincel**.
3. **Limpeza e Simplificação:**
   - Remover a dependência de runtime do `tesseract.js` e os módulos transitórios de `smart-text` do menu de privacidade.
   - A barra de censura volta ao visual minimalista: `[Rosto (Nível 1)] [Texto (Nível 2)] [Desfoque Total (Nível 3)] [Tarja Preta (Nível 4)] | [Retângulo] [Pincel]`.
   - A ferramenta OCR fica arquivada para a futura feature de "Copiar Texto da Imagem" (estilo Apple Live Text / Google Lens).

### Não-Objetivos (Non-Goals)
- Não gerar palavras fictícias em texto visível sobre a imagem.
- Não alterar os Níveis 3 (28px) e 4 (tarja 100% opaca), que já são intrinsecamente seguros.

---

## 3. Abordagem Técnica

### Algoritmo de Embaralhamento de Entropia
```ts
export function scrambleCanvasPixels(
  canvas: HTMLCanvasElement,
  blockSize: number = 3,
  noiseIntensity: number = 10
): void
```
1. Lê o `ImageData` do canvas.
2. Divide a imagem em grade de `blockSize x blockSize`.
3. Para cada bloco, realiza uma troca aleatória de vizinhança (*random jitter / shuffle*) e adiciona uma leve variação gaussiana de cor.
4. Grava o `ImageData` de volta antes de aplicar o `ctx.filter = 'blur(Xpx)'`.
5. O desfoque espalha uniformemente os dados já permutados, gerando a textura suave e fosca esperada, sem rastros dos contornos originais das letras.
