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
  onSelectId: (id: string | null) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageBase64,
  annotations,
  activeTool,
  selectedId,
  strokeColor,
  strokeWidth,
  fontSize,
  onSelectId,
  onAddAnnotation,
  onUpdateAnnotation,
  stageRef,
}) => {
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Annotation | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (!imageBase64) return;
    const img = new window.Image();
    img.src = imageBase64;
    img.onload = () => setBgImage(img);
  }, [imageBase64]);

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
    if (activeTool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg-image';
      if (clickedOnEmpty) {
        onSelectId(null);
      }
      return;
    }

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    const id = `ann-${Date.now()}`;

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
    } else if (activeTool === 'text') {
      const enteredText = window.prompt('Digite o texto para o bloco:', 'Anotação');
      if (enteredText) {
        onAddAnnotation({
          id,
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: enteredText,
          fontSize,
          fill: strokeColor,
        });
      }
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
      style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e5e5e7',
        padding: '24px',
      }}
    >
      <div style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
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
                    draggable={activeTool === 'select'}
                    onClick={() => onSelectId(ann.id)}
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
                    draggable={activeTool === 'select'}
                    onClick={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
                  />
                );
              }

              if (ann.type === 'arrow') {
                return (
                  <Arrow
                    key={ann.id}
                    id={ann.id}
                    points={ann.points}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    fill={ann.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                    draggable={activeTool === 'select'}
                    onClick={() => onSelectId(ann.id)}
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
                    draggable={activeTool === 'select'}
                    onClick={() => onSelectId(ann.id)}
                    onDragEnd={(e) => onUpdateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() })}
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
                    draggable={activeTool === 'select'}
                    onClick={() => onSelectId(ann.id)}
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
      </div>
    </div>
  );
};
