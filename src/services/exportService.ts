import { jsPDF } from 'jspdf';
import Konva from 'konva';

export type ExportImageFormat = 'png' | 'jpeg' | 'jpg';
export type ExportFormat = ExportImageFormat | 'pdf';

export interface PdfDimensions {
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
}

/**
 * Retorna o MIME type padrão para cada extensão de imagem suportada.
 */
export function getMimeTypeForFormat(format: ExportImageFormat): string {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg';
  return 'image/png';
}

/**
 * Formata o nome do arquivo com timestamp legível.
 */
export function formatExportFilename(prefix: string, format: string, timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${prefix}-${dateStr}.${ext}`;
}

/**
 * Calcula dimensões e orientação proporcionais para a folha do PDF
 * baseando-se no aspect ratio real do Canvas.
 */
export function calculatePdfPageDimensions(canvasWidth: number, canvasHeight: number): PdfDimensions {
  const orientation = canvasWidth >= canvasHeight ? 'landscape' : 'portrait';
  
  // Base A4 em pontos (72 dpi) ou proporção personalizada:
  // Se for landscape, fixa a largura em 297mm e calcula a altura proporcional
  const baseWidth = orientation === 'landscape' ? 297 : 210;
  const ratio = canvasHeight / canvasWidth;
  const baseHeight = baseWidth * ratio;

  return {
    orientation,
    width: baseWidth,
    height: baseHeight,
  };
}

/**
 * Exporta o stage do Konva como um arquivo baixável no navegador ou sistema local.
 */
export async function exportCanvas(
  stage: Konva.Stage,
  format: ExportFormat,
  prefix: string = 'captura'
): Promise<void> {
  const filename = formatExportFilename(prefix, format);

  if (format === 'pdf') {
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const { width, height, orientation } = calculatePdfPageDimensions(stage.width(), stage.height());

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [width, height],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(filename);
    return;
  }

  // Exportação como imagem (PNG ou JPEG)
  const mimeType = getMimeTypeForFormat(format as ExportImageFormat);
  const dataUrl = stage.toDataURL({ mimeType, quality: 0.95, pixelRatio: 2 });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copia a imagem renderizada do Canvas anotado diretamente para a área de transferência do navegador.
 */
export async function copyCanvasToClipboard(stage: Konva.Stage): Promise<void> {
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
  } catch (err) {
    console.error('Falha ao copiar canvas anotado para o clipboard:', err);
  }
}
