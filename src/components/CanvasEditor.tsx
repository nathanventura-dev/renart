import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Arrow, Text, Transformer, Circle, Group } from 'react-konva';
import Konva from 'konva';
import { Annotation, ToolType } from '../state/editorStore';

interface CanvasEditorProps {
  imageBase64: string;
  annotations: Annotation[];
  activeTool: ToolType;
  selectedId: string | null;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  isLocked?: boolean;
  onSelectId: (id: string | null) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

interface InlineEditingText {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageBase64,
  annotations,
  activeTool,
  selectedId,
  strokeColor,
  strokeWidth,
  fontSize,
  isLocked = false,
  onSelectId,
  onAddAnnotation,
  onUpdateAnnotation,
  stageRef,
}) => {
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Annotation | null>(null);
  const [editingText, setEditingText] = useState<InlineEditingText | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageBase64) return;
    const img = new window.Image();
    img.src = imageBase64;
    img.onload = () => setBgImage(img);
  }, [imageBase64]);

  // Tecla ESC para desselecionar e fechar edição inline
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectId(null);
        if (editingText) {
          setEditingText(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectId, editingText]);

  // Atualiza a seleção no Transformer do Konva
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedId) {
      const selectedNode = stageRef.current.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, annotations, stageRef]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Se clicou no fundo vazio, desseleciona
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg-image';
    if (clickedOnEmpty) {
      onSelectId(null);
    }

    if (activeTool === 'select') {
      return;
    }

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const id = `ann-${Date.now()}`;

    if (activeTool === 'text') {
      // Cria o texto e abre imediatamente o editor inline no local exato do clique
      const initialText = 'Digite seu texto aqui';
      const textAnn: Annotation = {
        id,
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: initialText,
        fontSize,
        fill: strokeColor,
      };
      onAddAnnotation(textAnn);
      onSelectId(id);
      setEditingText({
        id,
        x: pos.x,
        y: pos.y,
        text: initialText,
        fontSize,
        fill: strokeColor,
      });
      return;
    }

    setIsDrawing(true);

    if (activeTool === 'rect') {
      setNewAnnotation({
        id,
        type: 'rect',
        x: pos.x,
        y: pos.y,
        width: 1,
        height: 1,
        stroke: strokeColor,
        strokeWidth,
      });
    } else if (activeTool === 'ellipse') {
      setNewAnnotation({
        id,
        type: 'ellipse',
        x: pos.x,
        y: pos.y,
        radiusX: 1,
        radiusY: 1,
        stroke: strokeColor,
        strokeWidth,
      });
    } else if (activeTool === 'arrow') {
      setNewAnnotation({
        id,
        type: 'arrow',
        x: 0,
        y: 0,
        points: [pos.x, pos.y, pos.x, pos.y],
        stroke: strokeColor,
        strokeWidth,
      });
    } else if (activeTool === 'magnifier') {
      onAddAnnotation({
        id,
        type: 'magnifier',
        x: pos.x,
        y: pos.y,
        radius: 60,
        zoomLevel: 2.0,
      });
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !newAnnotation) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (newAnnotation.type === 'rect') {
      const width = pos.x - newAnnotation.x;
      const height = pos.y - newAnnotation.y;
      setNewAnnotation({ ...newAnnotation, width, height });
    } else if (newAnnotation.type === 'ellipse') {
      const radiusX = Math.abs(pos.x - newAnnotation.x);
      const radiusY = Math.abs(pos.y - newAnnotation.y);
      setNewAnnotation({ ...newAnnotation, radiusX, radiusY });
    } else if (newAnnotation.type === 'arrow') {
      const p1 = newAnnotation.points;
      setNewAnnotation({ ...newAnnotation, points: [p1[0], p1[1], pos.x, pos.y] });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !newAnnotation) return;
    setIsDrawing(false);

    // Salva a anotação se possuir dimensões mínimas válidas
    if (newAnnotation.type === 'rect' && Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
      onAddAnnotation(newAnnotation);
    } else if (newAnnotation.type === 'ellipse' && newAnnotation.radiusX > 5 && newAnnotation.radiusY > 5) {
      onAddAnnotation(newAnnotation);
    } else if (newAnnotation.type === 'arrow') {
      onAddAnnotation(newAnnotation);
    }

    setNewAnnotation(null);
  };

  const canvasWidth = bgImage ? bgImage.width : 800;
  const canvasHeight = bgImage ? bgImage.height : 600;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e5e5e7',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
        <Stage
          ref={stageRef as React.RefObject<Konva.Stage>}
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Camada Base: Imagem de Fundo Capturada */}
          <Layer>
            {bgImage && <KonvaImage image={bgImage} width={canvasWidth} height={canvasHeight} name="bg-image" />}
          </Layer>

          {/* Camada de Vetores e Anotações */}
          <Layer>
            {annotations.map((ann) => {
              // Todos os elementos são movimentáveis (draggable) enquanto não estiverem bloqueados/salvos
              const canDrag = !isLocked;

              if (ann.type === 'rect') {
                return (
                  <Rect
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    width={ann.width}
                    height={ann.height}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    draggable={canDrag}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
                  />
                );
              }

              if (ann.type === 'ellipse') {
                return (
                  <Ellipse
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    radiusX={ann.radiusX}
                    radiusY={ann.radiusY}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    draggable={canDrag}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
                  />
                );
              }

              if (ann.type === 'arrow') {
                return (
                  <Arrow
                    key={ann.id}
                    id={ann.id}
                    x={ann.x || 0}
                    y={ann.y || 0}
                    points={ann.points}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    fill={ann.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                    draggable={canDrag}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
                  />
                );
              }

              if (ann.type === 'text') {
                return (
                  <Text
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    text={ann.text}
                    fontSize={ann.fontSize}
                    fill={ann.fill || '#000000'}
                    draggable={canDrag}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
                    onDblClick={() => {
                      onSelectId(ann.id);
                      setEditingText({
                        id: ann.id,
                        x: ann.x,
                        y: ann.y,
                        text: ann.text,
                        fontSize: ann.fontSize,
                        fill: ann.fill || '#000000',
                      });
                    }}
                  />
                );
              }

              if (ann.type === 'magnifier') {
                return (
                  <Group
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    draggable={canDrag}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
                  >
                    <Circle radius={ann.radius} stroke="#ff9f0a" strokeWidth={3} fill="#ffffff" opacity={0.3} />
                    <Circle radius={ann.radius} stroke="#ff9f0a" strokeWidth={2} />
                    <Text text={`🔍 ${ann.zoomLevel}x`} fontSize={12} fill="#ff9f0a" x={-18} y={-6} fontStyle="bold" />
                  </Group>
                );
              }

              return null;
            })}

            {/* Anotação em processo de criação (arraste) */}
            {newAnnotation && (
              <>
                {newAnnotation.type === 'rect' && (
                  <Rect
                    x={newAnnotation.x}
                    y={newAnnotation.y}
                    width={newAnnotation.width}
                    height={newAnnotation.height}
                    stroke={newAnnotation.stroke}
                    strokeWidth={newAnnotation.strokeWidth}
                  />
                )}
                {newAnnotation.type === 'ellipse' && (
                  <Ellipse
                    x={newAnnotation.x}
                    y={newAnnotation.y}
                    radiusX={newAnnotation.radiusX}
                    radiusY={newAnnotation.radiusY}
                    stroke={newAnnotation.stroke}
                    strokeWidth={newAnnotation.strokeWidth}
                  />
                )}
                {newAnnotation.type === 'arrow' && (
                  <Arrow
                    points={newAnnotation.points}
                    stroke={newAnnotation.stroke}
                    strokeWidth={newAnnotation.strokeWidth}
                    fill={newAnnotation.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                  />
                )}
              </>
            )}

            {/* Transformer de Redimensionamento */}
            <Transformer ref={transformerRef} />
          </Layer>
        </Stage>

        {/* Input Inline de Edição de Texto Direto sobre o Canvas (Sem Modais) */}
        {editingText && (
          <textarea
            autoFocus
            defaultValue={editingText.text}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val) {
                onUpdateAnnotation(editingText.id, { text: val });
              }
              setEditingText(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const val = (e.target as HTMLTextAreaElement).value.trim();
                if (val) {
                  onUpdateAnnotation(editingText.id, { text: val });
                }
                setEditingText(null);
              } else if (e.key === 'Escape') {
                setEditingText(null);
              }
            }}
            style={{
              position: 'absolute',
              left: `${editingText.x}px`,
              top: `${editingText.y}px`,
              fontSize: `${editingText.fontSize}px`,
              color: editingText.fill,
              fontFamily: 'system-ui, sans-serif',
              border: '1px dashed #0071e3',
              borderRadius: '3px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '2px 4px',
              outline: 'none',
              resize: 'both',
              minWidth: '150px',
              minHeight: '32px',
              zIndex: 1000,
            }}
          />
        )}
      </div>
    </div>
  );
};
