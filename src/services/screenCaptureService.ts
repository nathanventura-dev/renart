import { Point, RectBounds } from '../types/capture';

export interface CropCoordinates {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Converte as coordenadas selecionadas no overlay (relativas ao viewport)
 * para as coordenadas reais em pixels da imagem capturada do monitor.
 */
export function calculateCropCoordinates(
  bounds: RectBounds,
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number
): CropCoordinates {
  const safeVpW = Math.max(1, viewportWidth);
  const safeVpH = Math.max(1, viewportHeight);
  const scaleX = imageWidth / safeVpW;
  const scaleY = imageHeight / safeVpH;

  const sx = Math.max(0, Math.round(bounds.x * scaleX));
  const sy = Math.max(0, Math.round(bounds.y * scaleY));
  const sw = Math.max(1, Math.min(imageWidth - sx, Math.round(bounds.width * scaleX)));
  const sh = Math.max(1, Math.min(imageHeight - sy, Math.round(bounds.height * scaleY)));

  return { sx, sy, sw, sh };
}

/**
 * Copia um DataURL de imagem PNG diretamente para a área de transferência do sistema.
 */
export async function copyDataUrlToClipboard(dataUrl: string): Promise<void> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }
  } catch (err) {
    console.warn('Não foi possível copiar automaticamente para a área de transferência:', err);
  }
}

/**
 * Captura um quadro real da tela do usuário (via Tauri nativo ou Web Screen Capture API getDisplayMedia).
 * Retorna null caso o usuário cancele a seleção da tela.
 */
export async function captureDesktopFrame(): Promise<string | null> {
  // 1. Tenta captura de tela inteira nativa se estiver rodando dentro do Tauri
  try {
    const isTauri =
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');
      const dataUrl = await invoke<string>('tauri_capture_screen', { mode: 'fullscreen' });
      if (dataUrl) return dataUrl;
    }
  } catch (err) {
    console.warn('Tauri invoke não disponível, usando captura de tela Web:', err);
  }

  // 2. Captura real da tela/janela do sistema operacional via getDisplayMedia
  if (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  ) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video
            .play()
            .then(() => resolve())
            .catch(reject);
        };
        video.onerror = () => reject(new Error('Falha ao carregar stream de vídeo da tela'));
      });

      // Aguarda um quadro de renderização para garantir que o frame de vídeo não esteja preto
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const width = video.videoWidth || window.screen.width || window.innerWidth;
      const height = video.videoHeight || window.screen.height || window.innerHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
      }

      // Encerra imediatamente o compartilhamento de tela para remover a barra do navegador
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('Captura de tela via getDisplayMedia cancelada ou indisponível:', err);
      return null;
    }
  }

  return null;
}

/**
 * Recorta a imagem capturada da tela de acordo com a região ou traçado selecionado pelo usuário.
 */
export async function cropCapturedScreen(
  sourceDataUrl: string,
  result: RectBounds | { freeformPoints: Point[] } | 'fullscreen',
  viewportWidth: number,
  viewportHeight: number
): Promise<string> {
  if (result === 'fullscreen') {
    await copyDataUrlToClipboard(sourceDataUrl);
    return sourceDataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = sourceDataUrl;
  });

  if ('freeformPoints' in result) {
    const pts = result.freeformPoints;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const bounds: RectBounds = {
      x: minX,
      y: minY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY),
    };

    const { sx, sy, sw, sh } = calculateCropCoordinates(
      bounds,
      viewportWidth,
      viewportHeight,
      img.width,
      img.height
    );
    const scaleX = img.width / Math.max(1, viewportWidth);
    const scaleY = img.height / Math.max(1, viewportHeight);

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (ctx && pts.length > 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo((pts[0].x - minX) * scaleX, (pts[0].y - minY) * scaleY);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i].x - minX) * scaleX, (pts[i].y - minY) * scaleY);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    }

    const croppedUrl = canvas.toDataURL('image/png');
    await copyDataUrlToClipboard(croppedUrl);
    return croppedUrl;
  }

  const { sx, sy, sw, sh } = calculateCropCoordinates(
    result,
    viewportWidth,
    viewportHeight,
    img.width,
    img.height
  );

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  }

  const croppedUrl = canvas.toDataURL('image/png');
  await copyDataUrlToClipboard(croppedUrl);
  return croppedUrl;
}
