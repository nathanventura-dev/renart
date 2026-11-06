import { RENART_THEME } from '../theme/colors';
import React, { useState, useRef, useEffect } from 'react';
import { CaptureMode, Point, RectBounds } from '../types/capture';
import { calculateNormalizedRect, clampPointToScreen, simplifyFreeformPath } from '../utils/geometry';
import { Crop, AppWindow, Monitor, X } from 'lucide-react';

interface CaptureOverlayProps {
  mode: CaptureMode;
  backgroundDataUrl?: string | null;
  onComplete: (bounds: RectBounds | { freeformPoints: Point[] } | 'fullscreen') => void;
  onCancel: () => void;
  onSwitchMode?: (mode: CaptureMode) => void;
  /** Desativa o botão "Janela" (captura de janela ainda não disponível). */
  windowDisabled?: boolean;
}

export const CaptureOverlay: React.FC<CaptureOverlayProps> = ({
  mode,
  backgroundDataUrl,
  onComplete,
  onCancel,
  onSwitchMode,
  windowDisabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<RectBounds | null>(null);
  const [freeformPoints, setFreeformPoints] = useState<Point[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (mode === 'fullscreen') {
      onComplete('fullscreen');
    }
  }, [mode, onComplete]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const pt = clampPointToScreen({ x: e.clientX, y: e.clientY }, window.innerWidth, window.innerHeight);
    setIsDragging(true);
    setStartPoint(pt);

    if (mode === 'freeform') {
      setFreeformPoints([pt]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !startPoint) return;

    const pt = clampPointToScreen({ x: e.clientX, y: e.clientY }, window.innerWidth, window.innerHeight);

    if (mode === 'region') {
      const rect = calculateNormalizedRect(startPoint, pt);
      setCurrentRect(rect);
    } else if (mode === 'freeform') {
      setFreeformPoints((prev) => [...prev, pt]);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (mode === 'region' && currentRect && currentRect.width > 5 && currentRect.height > 5) {
      onComplete(currentRect);
    } else if (mode === 'freeform' && freeformPoints.length > 5) {
      const simplified = simplifyFreeformPath(freeformPoints);
      onComplete({ freeformPoints: simplified });
    } else {
      onCancel();
    }
  };

  if (mode === 'fullscreen') {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: backgroundDataUrl ? '#000' : 'rgba(0, 0, 0, 0.35)',
        backgroundImage: backgroundDataUrl ? `url(${backgroundDataUrl})` : undefined,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        cursor: 'crosshair',
        zIndex: 9999,
        userSelect: 'none',
      }}
    >
      {/* Escurecimento suave enquanto o usuário ainda não iniciou o arraste sobre o print congelado */}
      {backgroundDataUrl && !currentRect && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Retângulo de Seleção */}
      {mode === 'region' && currentRect && (
        <div
          style={{
            position: 'absolute',
            left: `${currentRect.x}px`,
            top: `${currentRect.y}px`,
            width: `${currentRect.width}px`,
            height: `${currentRect.height}px`,
            border: `2px solid ${RENART_THEME.primary}`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              left: 0,
              backgroundColor: RENART_THEME.primary,
              color: '#fff',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '3px',
              fontWeight: 600,
            }}
          >
            {Math.round(currentRect.width)} × {Math.round(currentRect.height)}
          </div>
        </div>
      )}

      {/* Traçado Freeform */}
      {mode === 'freeform' && freeformPoints.length > 1 && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <polyline
            points={freeformPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={RENART_THEME.primary}
            strokeWidth="3"
            strokeDasharray="4 4"
          />
        </svg>
      )}

      {/* Barra Flutuante de Captura (Estilo Windows Snipping Tool) */}
      <div
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
        }}
      >
        {/* Modo Área Retangular */}
        <button
          type="button"
          onClick={() => (onSwitchMode ? onSwitchMode('region') : undefined)}
          title="Modo Retangular (Área)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: mode === 'region' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
            color: mode === 'region' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Crop size={15} />
          <span>Área</span>
        </button>

        {/* Modo Janela */}
        <button
          type="button"
          onClick={() => (!windowDisabled && onSwitchMode ? onSwitchMode('window') : undefined)}
          disabled={windowDisabled}
          title={windowDisabled ? 'Em breve' : 'Capturar Janela do Sistema'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: mode === 'window' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
            color: mode === 'window' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: windowDisabled ? 'not-allowed' : 'pointer',
            opacity: windowDisabled ? 0.4 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <AppWindow size={15} />
          <span>Janela</span>
        </button>

        {/* Modo Tela Inteira */}
        <button
          type="button"
          onClick={() => (onSwitchMode ? onSwitchMode('fullscreen') : onComplete('fullscreen'))}
          title="Capturar Tela Inteira"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: (mode as CaptureMode) === 'fullscreen' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
            color: (mode as CaptureMode) === 'fullscreen' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Monitor size={15} />
          <span>Tela Inteira</span>
        </button>

        {/* Separador Vertical */}
        <div
          style={{
            width: '1px',
            height: '18px',
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            margin: '0 2px',
          }}
        />

        {/* Botão Cancelar (X) */}
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
    </div>
  );
};
