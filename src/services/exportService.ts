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
 * Calcula o pixelRatio necessário para exportar o Stage do Konva na resolução nativa 1:1 da imagem,
 * compensando com exatidão o nível de zoom atual da tela para não perder resolução nem dobrar pixels.
 */
export function calculateNativeExportPixelRatio(stageScale: number = 1.0): number {
  const safeScale = stageScale > 0 ? stageScale : 1.0;
  return Number((1 / safeScale).toFixed(4));
}

/**
 * Oculta temporariamente elementos de interface do editor (Transformer, âncoras, controles)
 * durante a geração da imagem para que não sejam gravados no arquivo exportado ou clipboard.
 */
function toggleEditorOverlaysVisibility(stage: Konva.Stage, visible: boolean): Array<() => void> {
  const restorers: Array<() => void> = [];
  
  const nodes = [
    stage.findOne('Transformer'),
    stage.findOne('.two-point-anchors-group'),
    stage.findOne('.curved-arrow-anchors-group'),
    stage.findOne('.crop-overlay-group'),
    stage.findOne('.four-corner-anchors-group'),
  ];

  for (const node of nodes) {
    if (node) {
      const prev = node.visible();
      node.visible(visible);
      restorers.push(() => node.visible(prev));
    }
  }

  stage.batchDraw();
  return restorers;
}

/**
 * Exporta o stage do Konva como um arquivo baixável no navegador ou sistema local,
 * mantendo a fidelidade nativa 1:1 da imagem original.
 */
export async function exportCanvas(
  stage: Konva.Stage,
  format: ExportFormat,
  prefix: string = 'captura',
  zoomLevel?: number
): Promise<void> {
  const filename = formatExportFilename(prefix, format);
  const currentScale = zoomLevel ?? stage.scaleX() ?? 1.0;
  const pixelRatio = calculateNativeExportPixelRatio(currentScale);

  const restorers = toggleEditorOverlaysVisibility(stage, false);

  try {
    if (format === 'pdf') {
      const dataUrl = stage.toDataURL({ pixelRatio });
      const nativeWidth = Math.round(stage.width() * pixelRatio);
      const nativeHeight = Math.round(stage.height() * pixelRatio);
      const { width, height, orientation } = calculatePdfPageDimensions(nativeWidth, nativeHeight);

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
    const dataUrl = stage.toDataURL({ mimeType, quality: 0.95, pixelRatio });

    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } finally {
    for (const restore of restorers) {
      restore();
    }
    stage.batchDraw();
  }
}

/**
 * Copia a imagem renderizada do Canvas anotado diretamente para a área de transferência do navegador,
 * preservando com exatidão a resolução nativa 1:1 e sem queimar alças de seleção.
 */
export async function copyCanvasToClipboard(
  stage: Konva.Stage,
  zoomLevel?: number
): Promise<void> {
  const currentScale = zoomLevel ?? stage.scaleX() ?? 1.0;
  const pixelRatio = calculateNativeExportPixelRatio(currentScale);

  const restorers = toggleEditorOverlaysVisibility(stage, false);
  let dataUrl = '';

  try {
    dataUrl = stage.toDataURL({ pixelRatio });
  } finally {
    for (const restore of restorers) {
      restore();
    }
    stage.batchDraw();
  }

  const res = await fetch(dataUrl);
  const blob = await res.blob();

  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
    } else {
      await (navigator.clipboard as any).write([blob]);
    }
  } catch (err) {
    console.error('Falha ao copiar canvas anotado para o clipboard:', err);
  }
}
