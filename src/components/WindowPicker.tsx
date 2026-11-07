import React, { useEffect, useRef, useState } from 'react';
import { RENART_THEME } from '../theme/colors';
import type { CaptureMode } from '../types/capture';
import type { HoverWindow, WindowImage } from '../services/captureService';
import { CaptureModeBar } from './CaptureModeBar';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowHighlight {
  /** Parte visível da janela neste monitor. */
  rect: Rect;
  /** Janela inteira, local ao monitor (pode começar antes da borda ou passar dela). */
  full: Rect;
  label: string;
}

/** Posição do canvas com a imagem da janela dentro do contêiner recortado (a parte visível). */
export function computeWindowLayout(rect: Rect, full: Rect) {
  return {
    container: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    canvas: { left: full.x - rect.x, top: full.y - rect.y, width: full.width, height: full.height },
  };
}

/** Retângulo (local a este monitor) e rótulo da janela sob o cursor; `null` se ela não toca este monitor. */
export function resolveWindowHighlight(hover: HoverWindow | null, monitorId: number): WindowHighlight | null {
  if (!hover || hover.id === null) return null;
  const r = hover.rects.find((rect) => rect.monitorId === monitorId);
  if (!r) return null;
  return {
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    full: { x: r.fullX, y: r.fullY, width: r.fullWidth, height: r.fullHeight },
    label: hover.title ? `${hover.appName} — ${hover.title}` : hover.appName,
  };
}

interface WindowPickerProps {
  frameDataUrl: string;
  monitorId: number;
  hover: HoverWindow | null;
  /** Busca a imagem real da janela (o Rust captura uma vez e guarda em cache). */
  loadImage: (windowId: number) => Promise<WindowImage>;
  onPick: (windowId: number) => void;
  onCancel: () => void;
  onSwitchMode: (mode: CaptureMode) => void;
}

/** Modo Janela: destaca a janela sob o cursor (informada pelo Rust) e captura a janela ao clicar. */
export const WindowPicker: React.FC<WindowPickerProps> = ({
  frameDataUrl,
  monitorId,
  hover,
  loadImage,
  onPick,
  onCancel,
  onSwitchMode,
}) => {
  const highlight = resolveWindowHighlight(hover, monitorId);
  const hoverId = hover?.id ?? null;
  const touchesThisMonitor = highlight !== null;

  // Imagem real da janela destacada: mostrá-la à frente das demais deixa claro o que será capturado.
  // Enquanto carrega (ou se falhar), segue a silhueta com o tint.
  const [loaded, setLoaded] = useState<{ id: number; data: WindowImage } | null>(null);
  const cache = useRef(new Map<number, WindowImage>());
  useEffect(() => {
    if (hoverId === null || !touchesThisMonitor) return;
    const cached = cache.current.get(hoverId);
    if (cached) {
      setLoaded({ id: hoverId, data: cached });
      return;
    }
    let active = true;
    loadImage(hoverId)
      .then((data) => {
        cache.current.set(hoverId, data);
        // guarda só as últimas imagens: cada uma pode ter dezenas de MB
        if (cache.current.size > 4) cache.current.delete(cache.current.keys().next().value as number);
        if (active) setLoaded({ id: hoverId, data });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [hoverId, touchesThisMonitor, loadImage]);
  const image = loaded && loaded.id === hoverId ? loaded.data : null;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas
      .getContext('2d')
      ?.putImageData(new ImageData(image.pixels as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0);
  }, [image]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={() => {
        if (hover?.id != null) onPick(hover.id);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: '#000',
        backgroundImage: `url(${frameDataUrl})`,
        backgroundSize: '100% 100%',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {highlight ? (
        <>
          {/* Escurece tudo, menos a janela destacada */}
          <div
            style={{
              position: 'absolute',
              left: `${highlight.rect.x}px`,
              top: `${highlight.rect.y}px`,
              width: `${highlight.rect.width}px`,
              height: `${highlight.rect.height}px`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
              pointerEvents: 'none',
            }}
          />
          {/* A própria janela, à frente de qualquer outra que estivesse por cima dela */}
          {image && (
            <div
              style={{
                position: 'absolute',
                left: `${highlight.rect.x}px`,
                top: `${highlight.rect.y}px`,
                width: `${highlight.rect.width}px`,
                height: `${highlight.rect.height}px`,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  left: `${computeWindowLayout(highlight.rect, highlight.full).canvas.left}px`,
                  top: `${computeWindowLayout(highlight.rect, highlight.full).canvas.top}px`,
                  width: `${highlight.full.width}px`,
                  height: `${highlight.full.height}px`,
                }}
              />
            </div>
          )}
          {/* Contorno e rótulo; sem a imagem ainda, mantém o tint da silhueta */}
          <div
            style={{
              position: 'absolute',
              left: `${highlight.rect.x}px`,
              top: `${highlight.rect.y}px`,
              width: `${highlight.rect.width}px`,
              height: `${highlight.rect.height}px`,
              border: `3px solid ${RENART_THEME.primary}`,
              backgroundColor: image ? 'transparent' : RENART_THEME.primaryTint,
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '12px',
                top: '12px',
                maxWidth: 'calc(100% - 24px)',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(32, 33, 36, 0.9)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {highlight.label}
            </div>
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)', pointerEvents: 'none' }} />
      )}

      <CaptureModeBar mode="window" onSwitchMode={onSwitchMode} onCancel={onCancel} />
    </div>
  );
};
