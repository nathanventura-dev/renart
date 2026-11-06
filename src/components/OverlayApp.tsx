import React, { useCallback, useEffect, useState } from 'react';
import { CaptureOverlay } from './CaptureOverlay';
import { ScreenPicker } from './ScreenPicker';
import type { Point, RectBounds } from '../types/capture';
import type { OverlayMode, OverlayParams } from '../utils/overlayParams';
import {
  CaptureSelection,
  cancelCapture,
  finishCapture,
  focusThisWindow,
  getOverlayFrame,
  onOverlayModeChanged,
  setOverlayMode,
} from '../services/captureService';

/** Converte o resultado do overlay na seleção enviada ao Rust; `null` quando não há equivalente (traço livre). */
export function toCaptureSelection(
  result: RectBounds | { freeformPoints: Point[] } | 'fullscreen'
): CaptureSelection | null {
  if (result === 'fullscreen') return { kind: 'fullscreen' };
  if ('x' in result) {
    return { kind: 'region', x: result.x, y: result.y, width: result.width, height: result.height };
  }
  return null;
}

/** Janela de captura de um monitor: mostra o quadro congelado dele e a UI do modo atual. */
export const OverlayApp: React.FC<OverlayParams> = ({ monitorId, mode: initialMode }) => {
  const [mode, setMode] = useState<OverlayMode>(initialMode);
  const [frame, setFrame] = useState<string | null>(null);

  const cancel = useCallback(() => {
    void cancelCapture().catch(() => {});
  }, []);

  const finish = useCallback(
    async (selection: CaptureSelection) => {
      try {
        await finishCapture(monitorId, selection);
      } catch (err) {
        console.warn('Falha ao concluir a captura:', err);
        cancel();
      }
    },
    [monitorId, cancel]
  );

  useEffect(() => {
    getOverlayFrame(monitorId).then(setFrame).catch(cancel);
  }, [monitorId, cancel]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    onOverlayModeChanged(setMode).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Só uma janela de overlay nasce com foco; pede foco ao passar o mouse para o Esc funcionar em qualquer monitor.
  useEffect(() => {
    const onMove = () => {
      if (!document.hasFocus()) void focusThisWindow();
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!frame) {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000' }} />;
  }

  if (mode === 'fullscreen') {
    return (
      <ScreenPicker
        frameDataUrl={frame}
        onPick={() => void finish({ kind: 'fullscreen' })}
        onCancel={cancel}
        onSwitchMode={() => void setOverlayMode('region').catch(() => {})}
      />
    );
  }

  return (
    <CaptureOverlay
      mode="region"
      backgroundDataUrl={frame}
      windowDisabled
      onComplete={(result) => {
        const selection = toCaptureSelection(result);
        if (selection) void finish(selection);
        else cancel();
      }}
      onCancel={cancel}
      onSwitchMode={(next) => {
        if (next === 'fullscreen') void setOverlayMode('fullscreen').catch(() => {});
      }}
    />
  );
};
