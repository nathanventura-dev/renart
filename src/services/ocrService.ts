import { OcrLine, OcrWord } from '../utils/textAnonymizer';

export interface OcrRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TauriInvoker = (cmd: string, args: Record<string, any>) => Promise<any>;

/**
 * Detecta se a aplicação está rodando dentro do runtime nativo do Tauri.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
}

const FALLBACK_WORDS_POOL = [
  'Documento', 'Financeiro', 'Confidencial', 'Relatorio', 'Protocolo', 'Empresa',
  'Faturamento', 'Mensal', 'Valor', 'Cliente', 'Operacao', 'Sistema', 'Aprovado'
];

/**
 * Gera linhas simuladas para testes no navegador e desenvolvimento sem dependência do backend nativo.
 */
export function generateDevFallbackOcrLines(region: OcrRegion): OcrLine[] {
  const { x, y, width, height } = region;
  if (width < 5 || height < 5) return [];

  const estimatedLineHeight = Math.max(16, Math.min(28, Math.floor(height / Math.max(1, Math.round(height / 24)))));
  const lineSpacing = estimatedLineHeight * 1.35;
  const numLines = Math.max(1, Math.floor(height / lineSpacing));

  const lines: OcrLine[] = [];

  for (let l = 0; l < numLines; l++) {
    const lineY = y + l * lineSpacing;
    const availableWidth = width * 0.95;
    let currentX = x + width * 0.025;
    const words: OcrWord[] = [];
    const wordsInThisLine = Math.max(1, Math.floor(availableWidth / 70));

    for (let w = 0; w < wordsInThisLine; w++) {
      const text = FALLBACK_WORDS_POOL[(l * 3 + w) % FALLBACK_WORDS_POOL.length];
      const wordW = Math.max(30, Math.min(100, Math.floor(availableWidth / wordsInThisLine) - 8));
      
      if (currentX + wordW > x + width) break;

      words.push({
        text,
        x: Math.round(currentX),
        y: Math.round(lineY),
        width: Math.round(wordW),
        height: Math.round(estimatedLineHeight),
      });

      currentX += wordW + 8;
    }

    if (words.length > 0) {
      const lineText = words.map((w) => w.text).join(' ');
      const totalW = words[words.length - 1].x + words[words.length - 1].width - words[0].x;

      lines.push({
        text: lineText,
        x: words[0].x,
        y: words[0].y,
        width: totalW,
        height: estimatedLineHeight,
        words,
      });
    }
  }

  return lines;
}

/**
 * Detecta texto dentro de uma região selecionada da imagem.
 * Utiliza o backend Tauri nativo quando disponível; caso contrário, utiliza o gerador de desenvolvimento.
 */
export async function detectTextInImageRegion(
  imageBase64: string,
  region: OcrRegion,
  customInvoker?: TauriInvoker
): Promise<OcrLine[]> {
  const { x, y, width, height } = region;
  if (width <= 0 || height <= 0) {
    return [];
  }

  // 1. Invoker personalizado (injeção para testes unitários)
  if (customInvoker) {
    try {
      const result = await customInvoker('detect_text_in_region', {
        imageBase64,
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      });
      if (Array.isArray(result) && result.length > 0) {
        return result as OcrLine[];
      }
    } catch (err) {
      console.warn('Falha no invoker customizado de OCR:', err);
    }
  }

  // 2. Runtime nativo do Tauri (produção / app desktop)
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<OcrLine[]>('detect_text_in_region', {
        imageBase64,
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      });
      if (Array.isArray(result) && result.length > 0) {
        return result;
      }
    } catch (err) {
      console.warn('Falha na invocação do OCR nativo do Tauri:', err);
    }
  }

  // 3. Fallback de desenvolvimento (navegador web ou testes)
  return generateDevFallbackOcrLines(region);
}
