import React, { useCallback, useEffect, useState } from 'react';
import { CaptureOverlay } from './CaptureOverlay';
import { ScreenPicker } from './ScreenPicker';
import { WindowPicker } from './WindowPicker';
import type { CaptureMode, Point, RectBounds } from '../types/capture';
import type { OverlayMode, OverlayParams } from '../utils/overlayParams';
import {
  CaptureSelection,
  HoverWindow,
  cancelCapture,
  finishCapture,
  focusThisWindow,
  getOverlayFrame,
  getWindowImage,
  onActiveMonitorChanged,
  onHoverWindowChanged,
  onOverlayModeChanged,
  overlayReady,
  setOverlayMode,
  setOverlayUiRect,
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
  const [hover, setHover] = useState<HoverWindow | null>(null);

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

  // Informa ao Rust onde está a barra de opções: sobre ela a página mostra o cursor normal, e o Rust
  // não força a mira (forçar a mira ali fazia o cursor piscar entre seta e cruz).
  useEffect(() => {
    if (!frame || mode !== 'region') return;
    const report = () => {
      const el = document.querySelector('[data-capture-ui]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      void setOverlayUiRect(monitorId, { x: r.left, y: r.top, width: r.width, height: r.height }).catch(() => {});
    };
    const raf = requestAnimationFrame(report);
    window.addEventListener('resize', report);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', report);
    };
  }, [frame, mode, monitorId]);

  // Modo Janela: o Rust descobre a janela sob o cursor e envia o retângulo recortado de cada monitor.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    onHoverWindowChanged(setHover).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

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

  const switchMode = (next: CaptureMode) => {
    if (next === 'region' || next === 'fullscreen' || next === 'window') {
      void setOverlayMode(next).catch(() => {});
    }
  };

  if (mode === 'window') {
    return (
      <WindowPicker
        frameDataUrl={frame}
        monitorId={monitorId}
        hover={hover}
        loadImage={getWindowImage}
        onPick={(id) => void finish({ kind: 'window', id })}
        onCancel={cancel}
        onSwitchMode={switchMode}
      />
    );
  }

  if (mode === 'fullscreen') {
    return (
      <ScreenPicker
        frameDataUrl={frame}
        active={activeMonitorId === monitorId}
        onPick={() => void finish({ kind: 'fullscreen' })}
        onCancel={cancel}
        onSwitchMode={switchMode}
      />
    );
  }

  return (
    <CaptureOverlay
      mode="region"
      backgroundDataUrl={frame}
      onComplete={(result) => {
        const selection = toCaptureSelection(result);
        if (selection) void finish(selection);
        else cancel();
      }}
      onCancel={cancel}
      onSwitchMode={switchMode}
    />
  );
};
