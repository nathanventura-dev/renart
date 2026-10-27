import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Arrow, Text, Transformer, Circle, Group, Line } from 'react-konva';
import Konva from 'konva';
import { Annotation, ToolType, ImageAnnotation } from '../state/editorStore';
import {
  calculateMagnifierImageTransform,
  calculateCrownRotationAngle,
  calculateZoomFromCrownDrag,
  resolveCanvasPointerBehavior,
} from '../utils/magnifierAndHover';

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

interface CrownDragState {
  id: string;
  startX: number;
  initialZoom: number;
  currentZoom: number;
}

const InsertedImageNode: React.FC<{
  ann: ImageAnnotation;
  canDrag: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDragEnd: (x: number, y: number) => void;
}> = ({ ann, canDrag, onSelect, onMouseEnter, onMouseLeave, onDragEnd }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const imageObj = new window.Image();
    imageObj.src = ann.src;
    imageObj.onload = () => setImg(imageObj);
  }, [ann.src]);

  if (!img) return null;

  return (
    <KonvaImage
      id={ann.id}
      image={img}
      x={ann.x}
      y={ann.y}
      width={ann.width}
      height={ann.height}
      draggable={canDrag}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onSelect}
      onDragStart={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    />
  );
};

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
  const [isHoveringBlock, setIsHoveringBlock] = useState(false);
  const [isHoveringCrown, setIsHoveringCrown] = useState(false);
  const [draggingPositions, setDraggingPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [crownDrag, setCrownDrag] = useState<CrownDragState | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageBase64) return;
    const img = new window.Image();
    img.src = imageBase64;
    img.onload = () => setBgImage(img);
  }, [imageBase64]);

  // Gerencia o arraste horizontal da coroa giratória da lupa (esquerda diminui, direita aumenta de 0.5 em 0.5)
  useEffect(() => {
    if (!crownDrag) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - crownDrag.startX;
      const nextZoom = calculateZoomFromCrownDrag(crownDrag.initialZoom, deltaX, 25);
      setCrownDrag((prev) => (prev ? { ...prev, currentZoom: nextZoom } : null));
    };

    const handleWindowMouseUp = () => {
      if (crownDrag.currentZoom !== crownDrag.initialZoom) {
        onUpdateAnnotation(crownDrag.id, { zoomLevel: crownDrag.currentZoom });
      }
      setCrownDrag(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [crownDrag, onUpdateAnnotation]);

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
    if (selectedId && !isLocked) {
      const selectedNode = stageRef.current.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, annotations, isLocked, stageRef]);

  // Resolve o estilo do cursor dinamicamente conforme hover em blocos ou coroa da lupa
  const pointerBehavior = resolveCanvasPointerBehavior(activeTool, isHoveringBlock, isLocked);
  const currentCursor =
    crownDrag || isHoveringCrown
      ? 'ew-resize'
      : pointerBehavior.cursor;

  const handleBlockMouseEnter = () => {
    if (!isLocked) {
      setIsHoveringBlock(true);
    }
  };

  const handleBlockMouseLeave = () => {
    setIsHoveringBlock(false);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const targetName = e.target.name();
    if (targetName === 'magnifier-crown') {
      return;
    }

    const clickedOnEmpty = e.target === e.target.getStage() || targetName === 'bg-image';

    // Se o usuário clicou dentro da área de um bloco já existente (ou âncora do Transformer),
    // permite apenas selecionar/movimentar o bloco existente sem criar um novo.
    if (!clickedOnEmpty) {
      return;
    }

    // Clicou fora de qualquer bloco existente: limpa seleção atual
    onSelectId(null);

    if (pointerBehavior.clickAction !== 'create-new') {
      return;
    }

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const id = `ann-${Date.now()}`;

    if (activeTool === 'text') {
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

    if (activeTool === 'magnifier') {
      onAddAnnotation({
        id,
        type: 'magnifier',
        x: pos.x,
        y: pos.y,
        radius: 65,
        zoomLevel: 2.0,
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

  // Índices dos dentes cosméticos da coroa giratória (24 marcações ao redor do anel)
  const crownTeethAngles = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);

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
      <div
        style={{
          position: 'relative',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          borderRadius: '4px',
          overflow: 'hidden',
          cursor: currentCursor,
        }}
      >
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
              const canDrag = !isLocked && (!crownDrag || crownDrag.id !== ann.id);

              if (ann.type === 'rect') {
                return (
                  <Rect
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    width={ann.width}
                    height={ann.height}
                    fill="rgba(0, 0, 0, 0.001)"
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
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
                    fill="rgba(0, 0, 0, 0.001)"
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
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
                    hitStrokeWidth={20}
                    fill={ann.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
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
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
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

              if (ann.type === 'image') {
                return (
                  <InsertedImageNode
                    key={ann.id}
                    ann={ann}
                    canDrag={canDrag}
                    onSelect={() => onSelectId(ann.id)}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onDragEnd={(x, y) => onUpdateAnnotation(ann.id, { x, y })}
                  />
                );
              }

              if (ann.type === 'magnifier') {
                const livePos = draggingPositions[ann.id];
                const currentX = livePos ? livePos.x : ann.x;
                const currentY = livePos ? livePos.y : ann.y;
                const activeZoom =
                  crownDrag && crownDrag.id === ann.id ? crownDrag.currentZoom : ann.zoomLevel;

                const imgTransform = calculateMagnifierImageTransform(currentX, currentY, activeZoom);
                const crownAngle = calculateCrownRotationAngle(activeZoom);

                return (
                  <Group
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => onSelectId(ann.id)}
                    onDragMove={(e) => {
                      setDraggingPositions((prev) => ({
                        ...prev,
                        [ann.id]: { x: e.target.x(), y: e.target.y() },
                      }));
                    }}
                    onDragEnd={(e) => {
                      const finalX = e.target.x();
                      const finalY = e.target.y();
                      setDraggingPositions((prev) => {
                        const copy = { ...prev };
                        delete copy[ann.id];
                        return copy;
                      });
                      onUpdateAnnotation(ann.id, { x: finalX, y: finalY });
                    }}
                  >
                    {/* Lente Circular com Recorte e Ampliação Real da Imagem */}
                    <Group
                      clipFunc={(ctx) => {
                        ctx.arc(0, 0, ann.radius, 0, Math.PI * 2, false);
                      }}
                    >
                      <Circle radius={ann.radius} fill="#ffffff" />
                      {bgImage && (
                        <KonvaImage
                          image={bgImage}
                          width={canvasWidth}
                          height={canvasHeight}
                          x={imgTransform.x}
                          y={imgTransform.y}
                          scaleX={imgTransform.scaleX}
                          scaleY={imgTransform.scaleY}
                          listening={false}
                        />
                      )}
                    </Group>

                    {/* Área interna clicável da lente para arraste fácil da lupa */}
                    <Circle
                      radius={ann.radius - 4}
                      fill="rgba(255, 255, 255, 0.001)"
                    />

                    {/* Anel da Coroa Giratória Cosmética (Bezel Serrilhado) */}
                    <Group rotation={crownAngle}>
                      {/* Base metálica escura da coroa */}
                      <Circle
                        name="magnifier-crown"
                        radius={ann.radius + 3}
                        stroke="#2c2c2e"
                        strokeWidth={8}
                        onMouseEnter={() => {
                          setIsHoveringBlock(false);
                          setIsHoveringCrown(true);
                        }}
                        onMouseLeave={() => setIsHoveringCrown(false)}
                        onMouseDown={(e) => {
                          e.cancelBubble = true;
                          onSelectId(ann.id);
                          setCrownDrag({
                            id: ann.id,
                            startX: e.evt.clientX,
                            initialZoom: ann.zoomLevel,
                            currentZoom: ann.zoomLevel,
                          });
                        }}
                      />

                      {/* Dentes / Serrilhado Cosmético da Coroa Giratória */}
                      {crownTeethAngles.map((deg) => {
                        const rad = (deg * Math.PI) / 180;
                        const rInner = ann.radius;
                        const rOuter = ann.radius + 7;
                        return (
                          <Line
                            key={deg}
                            points={[
                              Math.cos(rad) * rInner,
                              Math.sin(rad) * rInner,
                              Math.cos(rad) * rOuter,
                              Math.sin(rad) * rOuter,
                            ]}
                            stroke="#ff9f0a"
                            strokeWidth={2}
                            listening={false}
                          />
                        );
                      })}

                      {/* Pega / Pino Superior da Coroa Giratória */}
                      <Rect
                        name="magnifier-crown"
                        x={-16}
                        y={-(ann.radius + 14)}
                        width={32}
                        height={12}
                        cornerRadius={4}
                        fill="#ff9f0a"
                        stroke="#2c2c2e"
                        strokeWidth={1.5}
                        onMouseEnter={() => {
                          setIsHoveringBlock(false);
                          setIsHoveringCrown(true);
                        }}
                        onMouseLeave={() => setIsHoveringCrown(false)}
                        onMouseDown={(e) => {
                          e.cancelBubble = true;
                          onSelectId(ann.id);
                          setCrownDrag({
                            id: ann.id,
                            startX: e.evt.clientX,
                            initialZoom: ann.zoomLevel,
                            currentZoom: ann.zoomLevel,
                          });
                        }}
                      />
                    </Group>

                    {/* Aro Interno de Acabamento da Lente */}
                    <Circle
                      radius={ann.radius}
                      stroke="#ff9f0a"
                      strokeWidth={2}
                      listening={false}
                    />

                    {/* Visor / Badge Fixo de Controle da Coroa (Arraste ◀ ▶ para ajustar 1.0x a 3.0x) */}
                    <Group
                      y={ann.radius + 12}
                      onMouseEnter={() => {
                        setIsHoveringBlock(false);
                        setIsHoveringCrown(true);
                      }}
                      onMouseLeave={() => setIsHoveringCrown(false)}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        onSelectId(ann.id);
                        setCrownDrag({
                          id: ann.id,
                          startX: e.evt.clientX,
                          initialZoom: ann.zoomLevel,
                          currentZoom: ann.zoomLevel,
                        });
                      }}
                    >
                      <Rect
                        name="magnifier-crown"
                        x={-36}
                        y={0}
                        width={72}
                        height={20}
                        cornerRadius={10}
                        fill="#1c1c1e"
                        stroke="#ff9f0a"
                        strokeWidth={1.5}
                      />
                      <Text
                        name="magnifier-crown"
                        x={-36}
                        y={4}
                        width={72}
                        align="center"
                        text={`◀ ${activeZoom.toFixed(1)}x ▶`}
                        fontSize={11}
                        fontStyle="bold"
                        fill="#ff9f0a"
                      />
                    </Group>
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
