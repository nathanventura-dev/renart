import { RENART_THEME } from '../theme/colors';
import React, { useState, useRef, useEffect } from 'react';
import { CaptureMode, Point, RectBounds } from '../types/capture';
import { calculateNormalizedRect, clampPointToScreen, simplifyFreeformPath } from '../utils/geometry';
import { CaptureModeBar } from './CaptureModeBar';

interface CaptureOverlayProps {
  mode: CaptureMode;
  backgroundDataUrl?: string | null;
  onComplete: (bounds: RectBounds | { freeformPoints: Point[] } | 'fullscreen') => void;
  onCancel: () => void;
  onSwitchMode?: (mode: CaptureMode) => void;
}

export const CaptureOverlay: React.FC<CaptureOverlayProps> = ({
  mode,
  backgroundDataUrl,
  onComplete,
  onCancel,
  onSwitchMode,
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

      <CaptureModeBar
        mode={mode}
        onSwitchMode={(next) => {
          if (onSwitchMode) onSwitchMode(next);
          else if (next === 'fullscreen') onComplete('fullscreen');
        }}
        onCancel={onCancel}
      />
    </div>
  );
};
