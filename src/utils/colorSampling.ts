export interface SampledColors {
  bgColor: string;
  textColor: string;
}

export interface PixelBuffer {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/**
 * Converte componentes RGB individuais (0-255) em string hexadecimal (#RRGGBB).
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calcula a luminância relativa padronizada (Rec. 709) de uma cor RGB.
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Extrai o buffer de pixels de uma imagem, canvas ou buffer direto.
 */
function extractPixelBuffer(
  source: HTMLCanvasElement | HTMLImageElement | PixelBuffer
): PixelBuffer | null {
  if ('data' in source && typeof source.width === 'number' && typeof source.height === 'number') {
    return source as PixelBuffer;
  }

  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(source as CanvasImageSource, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      data: imgData.data,
      width: imgData.width,
      height: imgData.height,
    };
  } catch {
    return null;
  }
}

/**
 * Amostra as cores dos cantos da região para obter a cor de fundo dominante
 * e calcula a melhor cor contrastante para o texto sintético.
 */
export function sampleRegionColors(
  source: HTMLCanvasElement | HTMLImageElement | PixelBuffer,
  crop: { x: number; y: number; width: number; height: number }
): SampledColors {
  const defaultColors: SampledColors = {
    bgColor: '#ffffff',
    textColor: '#1e293b',
  };

  const buffer = extractPixelBuffer(source);
  if (!buffer || buffer.width <= 0 || buffer.height <= 0 || crop.width <= 0 || crop.height <= 0) {
    return defaultColors;
  }

  const { data, width, height } = buffer;

  const clampX = (val: number) => Math.max(0, Math.min(width - 1, Math.round(val)));
  const clampY = (val: number) => Math.max(0, Math.min(height - 1, Math.round(val)));

  // Amostra os 4 cantos da caixa delimitadora (onde quase nunca há glifos de texto)
  const samplePoints = [
    { x: clampX(crop.x + 2), y: clampY(crop.y + 2) },
    { x: clampX(crop.x + crop.width - 3), y: clampY(crop.y + 2) },
    { x: clampX(crop.x + 2), y: clampY(crop.y + crop.height - 3) },
    { x: clampX(crop.x + crop.width - 3), y: clampY(crop.y + crop.height - 3) },
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let validCount = 0;

  for (const pt of samplePoints) {
    const idx = (pt.y * width + pt.x) * 4;
    if (idx + 3 < data.length) {
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
      validCount++;
    }
  }

  if (validCount === 0) {
    return defaultColors;
  }

  const avgR = Math.round(sumR / validCount);
  const avgG = Math.round(sumG / validCount);
  const avgB = Math.round(sumB / validCount);

  const bgColor = rgbToHex(avgR, avgG, avgB);
  const luminance = calculateLuminance(avgR, avgG, avgB);

  // Se o fundo for claro (> 128), texto escuro; se for escuro, texto claro
  const textColor = luminance > 128 ? '#1e293b' : '#f8fafc';

  return {
    bgColor,
    textColor,
  };
}
