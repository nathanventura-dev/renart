import React, { useEffect } from 'react';
import { Camera } from 'lucide-react';
import type { CaptureMode } from '../types/capture';
import { CaptureModeBar } from './CaptureModeBar';

export function resolvePickerState(active: boolean): { dimmed: boolean; showCamera: boolean; hint: string } {
  return active
    ? { dimmed: false, showCamera: true, hint: 'Clique para capturar esta tela' }
    : { dimmed: true, showCamera: false, hint: '' };
}

interface ScreenPickerProps {
  frameDataUrl: string;
  /** `true` quando o Rust informa que o cursor está neste monitor (janelas sem foco não recebem eventos de mouse). */
  active: boolean;
  onPick: () => void;
  onCancel: () => void;
  onSwitchMode: (mode: CaptureMode) => void;
}

/** Seletor de "tela inteira": escurece o monitor e mostra uma câmera quando o mouse está sobre ele. */
export const ScreenPicker: React.FC<ScreenPickerProps> = ({ frameDataUrl, active, onPick, onCancel, onSwitchMode }) => {
  const state = resolvePickerState(active);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={onPick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        backgroundImage: `url(${frameDataUrl})`,
        backgroundSize: '100% 100%',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          opacity: state.dimmed ? 1 : 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
        }}
      />

      {state.showCamera && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              backgroundColor: 'rgba(32, 33, 36, 0.78)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Camera size={44} />
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(32, 33, 36, 0.85)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {state.hint}
          </div>
        </div>
      )}

      <CaptureModeBar mode="fullscreen" onSwitchMode={onSwitchMode} onCancel={onCancel} />
    </div>
  );
};
