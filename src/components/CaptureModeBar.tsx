import React from 'react';
import { AppWindow, Crop, Monitor, X } from 'lucide-react';
import type { CaptureMode } from '../types/capture';

interface CaptureModeBarProps {
  mode: CaptureMode;
  onSwitchMode: (mode: CaptureMode) => void;
  onCancel: () => void;
}

const buttonStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: active ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
  color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

/** Barra flutuante de modos (Área / Janela / Tela Inteira / ✕), compartilhada pelos três overlays. */
export const CaptureModeBar: React.FC<CaptureModeBarProps> = ({ mode, onSwitchMode, onCancel }) => (
  <div
    data-capture-ui
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
    style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      backgroundColor: 'rgba(32, 33, 36, 0.92)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      borderRadius: '12px',
      padding: '4px 6px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
      zIndex: 10002,
      pointerEvents: 'auto',
      userSelect: 'none',
      cursor: 'default',
    }}
  >
    <button type="button" onClick={() => onSwitchMode('region')} title="Modo Retangular (Área)" style={buttonStyle(mode === 'region')}>
      <Crop size={15} />
      <span>Área</span>
    </button>

    <button type="button" onClick={() => onSwitchMode('window')} title="Capturar Janela do Sistema" style={buttonStyle(mode === 'window')}>
      <AppWindow size={15} />
      <span>Janela</span>
    </button>

    <button type="button" onClick={() => onSwitchMode('fullscreen')} title="Capturar Tela Inteira" style={buttonStyle(mode === 'fullscreen')}>
      <Monitor size={15} />
      <span>Tela Inteira</span>
    </button>

    <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.18)', margin: '0 2px' }} />

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
        transition: 'all 0.15s ease',
      }}
    >
      <X size={16} />
    </button>
  </div>
);
