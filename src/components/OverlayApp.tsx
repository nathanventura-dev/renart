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
  onActiveMonitorChanged,
  onOverlayModeChanged,
  overlayReady,
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
  const [activeMonitorId, setActiveMonitorId] = useState<number | null>(null);

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

  // Carrega o quadro (BMP cru), decodifica e só então mostra a janela: sem tela preta enquanto carrega.
  useEffect(() => {
    let objectUrl: string | undefined;
    let disposed = false;
    getOverlayFrame(monitorId)
      .then(async (url) => {
        objectUrl = url;
        const img = new Image();
        img.src = url;
        try {
          await img.decode();
        } catch {
          /* segue mesmo assim: o Rust também mostra os overlays após um tempo de segurança */
        }
        if (!disposed) setFrame(url);
      })
      .catch(cancel);
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [monitorId, cancel]);

  useEffect(() => {
    if (frame) void overlayReady(monitorId).catch(() => {});
  }, [frame, monitorId]);

  // O Rust acompanha o cursor e diz qual monitor está ativo (janelas sem foco não recebem eventos de mouse).
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    onActiveMonitorChanged(setActiveMonitorId).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

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
        active={activeMonitorId === monitorId}
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
