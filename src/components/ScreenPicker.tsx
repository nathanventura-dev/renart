import React, { useEffect, useState } from 'react';
import { Camera, Crop, X } from 'lucide-react';

export function resolvePickerState(hovered: boolean): { dimmed: boolean; showCamera: boolean; hint: string } {
  return hovered
    ? { dimmed: false, showCamera: true, hint: 'Clique para capturar esta tela' }
    : { dimmed: true, showCamera: false, hint: '' };
}

interface ScreenPickerProps {
  frameDataUrl: string;
  onPick: () => void;
  onCancel: () => void;
  onSwitchMode: (mode: 'region') => void;
}

/** Seletor de "tela inteira": escurece o monitor e mostra uma câmera quando o mouse está sobre ele. */
export const ScreenPicker: React.FC<ScreenPickerProps> = ({ frameDataUrl, onPick, onCancel, onSwitchMode }) => {
  const [hovered, setHovered] = useState(false);
  const state = resolvePickerState(hovered);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseMove={() => !hovered && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(32, 33, 36, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '12px',
          padding: '4px 6px',
          cursor: 'default',
        }}
      >
        <button
          type="button"
          onClick={() => onSwitchMode('region')}
          title="Modo Retangular (Área)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Crop size={15} />
          <span>Área</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="Cancelar (Esc)"
          aria-label="Cancelar"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.75)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
