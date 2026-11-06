import React, { useEffect } from 'react';
import { RENART_THEME } from '../theme/colors';
import type { CaptureMode } from '../types/capture';
import type { HoverWindow } from '../services/captureService';
import { CaptureModeBar } from './CaptureModeBar';

export interface WindowHighlight {
  rect: { x: number; y: number; width: number; height: number };
  label: string;
}

/** Retângulo (local a este monitor) e rótulo da janela sob o cursor; `null` se ela não toca este monitor. */
export function resolveWindowHighlight(hover: HoverWindow | null, monitorId: number): WindowHighlight | null {
  if (!hover || hover.id === null) return null;
  const r = hover.rects.find((rect) => rect.monitorId === monitorId);
  if (!r) return null;
  return {
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    label: hover.title ? `${hover.appName} — ${hover.title}` : hover.appName,
  };
}

interface WindowPickerProps {
  frameDataUrl: string;
  monitorId: number;
  hover: HoverWindow | null;
  onPick: (windowId: number) => void;
  onCancel: () => void;
  onSwitchMode: (mode: CaptureMode) => void;
}

/** Modo Janela: destaca a janela sob o cursor (informada pelo Rust) e captura a janela ao clicar. */
export const WindowPicker: React.FC<WindowPickerProps> = ({
  frameDataUrl,
  monitorId,
  hover,
  onPick,
  onCancel,
  onSwitchMode,
}) => {
  const highlight = resolveWindowHighlight(hover, monitorId);

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
        <div
          style={{
            position: 'absolute',
            left: `${highlight.rect.x}px`,
            top: `${highlight.rect.y}px`,
            width: `${highlight.rect.width}px`,
            height: `${highlight.rect.height}px`,
            border: `3px solid ${RENART_THEME.primary}`,
            backgroundColor: RENART_THEME.primaryTint,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
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
      ) : (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)', pointerEvents: 'none' }} />
      )}

      <CaptureModeBar mode="window" onSwitchMode={onSwitchMode} onCancel={onCancel} />
    </div>
  );
};
