import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Arrow, Text, Transformer, Circle, Group, Line } from 'react-konva';
import Konva from 'konva';
import { Annotation, ToolType, ImageAnnotation } from '../state/editorStore';
import {
  calculateMagnifierImageTransform,
  calculateZoomFromCrownDrag,
  resolveCanvasPointerBehavior,
  shouldShowZoomBar,
  calculateZoomBarProgress,
  shouldAttachTransformer,
  isTargetExistingAnnotation,
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
  const [crownDrag, setCrownDrag] = useState<CrownDragState | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const crownDragRef = useRef<CrownDragState | null>(null);
  const onUpdateAnnotationRef = useRef(onUpdateAnnotation);

  crownDragRef.current = crownDrag;
  onUpdateAnnotationRef.current = onUpdateAnnotation;

  useEffect(() => {
    if (!imageBase64) return;
    const img = new window.Image();
    img.src = imageBase64;
    img.onload = () => setBgImage(img);
  }, [imageBase64]);

  // Sempre que o usuário alternar entre ferramentas (Formas, Texto, Seta, Lupa) ou trocar de imagem,
  // limpa o estado de hover para nunca travar a imagem inteira como se fosse um bloco.
  useEffect(() => {
    setIsHoveringBlock(false);
    setIsHoveringCrown(false);
    setIsDrawing(false);
    setNewAnnotation(null);
  }, [activeTool, imageBase64, annotations.length]);

  const isDraggingCrown = Boolean(crownDrag);

  // Gerencia o arraste horizontal da coroa minimalista inferior da lupa (esquerda diminui, direita aumenta de 0.5 em 0.5)
  useEffect(() => {
    if (!isDraggingCrown) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const current = crownDragRef.current;
      if (!current) return;
      const deltaX = e.clientX - current.startX;
      const nextZoom = calculateZoomFromCrownDrag(current.initialZoom, deltaX, 25);
      if (nextZoom !== current.currentZoom) {
        setCrownDrag((prev) => (prev ? { ...prev, currentZoom: nextZoom } : null));
      }
    };

    const handleWindowMouseUp = () => {
      const current = crownDragRef.current;
      if (current && current.currentZoom !== current.initialZoom) {
        onUpdateAnnotationRef.current(current.id, { zoomLevel: current.currentZoom });
      }
      setCrownDrag(null);
      setIsHoveringCrown(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingCrown]);

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

  // Atualiza a seleção no Transformer do Konva (excluindo a lupa circular para manter movimentação livre)
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const selectedAnn = annotations.find((a) => a.id === selectedId);
    if (selectedId && !isLocked && selectedAnn && shouldAttachTransformer(selectedAnn.type)) {
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

    const isStageTarget = e.target === e.target.getStage();
    const clickedOnEmpty = !isTargetExistingAnnotation(targetName, isStageTarget);

    // Se o usuário clicou dentro da área de um bloco já existente (ou âncora do Transformer),
    // permite apenas selecionar/movimentar o bloco existente sem criar um novo.
    if (!clickedOnEmpty) {
      return;
    }

    // Clicou na imagem de fundo ou Stage vazio: garante que o hover de bloco seja falso e limpa seleção
    if (isHoveringBlock) {
      setIsHoveringBlock(false);
    }
    onSelectId(null);

    const emptyClickBehavior = resolveCanvasPointerBehavior(activeTool, false, isLocked);
    if (emptyClickBehavior.clickAction !== 'create-new') {
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
    const targetName = e.target.name();
    const isStageTarget = e.target === e.target.getStage();

    if (!isDrawing) {
      if (targetName === 'magnifier-crown') {
        if (!isHoveringCrown) setIsHoveringCrown(true);
        if (isHoveringBlock) setIsHoveringBlock(false);
      } else {
        if (isHoveringCrown) setIsHoveringCrown(false);
        const hoveringExisting = !isLocked && isTargetExistingAnnotation(targetName, isStageTarget);
        if (hoveringExisting !== isHoveringBlock) {
          setIsHoveringBlock(hoveringExisting);
        }
      }
    }

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
          onMouseLeave={() => {
            setIsHoveringBlock(false);
            setIsHoveringCrown(false);
          }}
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
                const activeZoom =
                  crownDrag && crownDrag.id === ann.id ? crownDrag.currentZoom : ann.zoomLevel;

                const imgTransform = calculateMagnifierImageTransform(ann.x, ann.y, activeZoom);
                const showZoomBar = shouldShowZoomBar(crownDrag ? crownDrag.id : null, ann.id);
                const zoomProgress = calculateZoomBarProgress(activeZoom);
                const isSelected = selectedId === ann.id;
                // Deslocamento sutil das ranhuras da coroa minimalista conforme o giro [-4px .. +4px]
                const grooveShift = (activeZoom - 2.0) * 4;

                return (
                  <Group
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    draggable={!isLocked}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseMove={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={() => onSelectId(ann.id)}
                    onDragStart={() => {
                      if (selectedId !== ann.id) {
                        onSelectId(ann.id);
                      }
                    }}
                    onDragMove={(e) => {
                      const group = e.currentTarget as Konva.Group;
                      const lensImg = group.findOne('.magnifier-lens-image');
                      if (lensImg) {
                        const nextTransform = calculateMagnifierImageTransform(
                          group.x(),
                          group.y(),
                          activeZoom
                        );
                        lensImg.position({ x: nextTransform.x, y: nextTransform.y });
                      }
                    }}
                    onDragEnd={(e) => {
                      onUpdateAnnotation(ann.id, {
                        x: e.currentTarget.x(),
                        y: e.currentTarget.y(),
                      });
                    }}
                  >
                    {/* Lente Circular com Recorte e Ampliação Real da Imagem */}
                    <Group
                      clipFunc={(ctx) => {
                        ctx.arc(0, 0, ann.radius, 0, Math.PI * 2, false);
                      }}
                    >
                      <Circle radius={ann.radius} fill="#ffffff" listening={false} />
                      {bgImage && (
                        <KonvaImage
                          name="magnifier-lens-image"
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

                    {/* Superfície da Lente Clicável para Arraste Livre */}
                    <Circle
                      radius={ann.radius}
                      fill="rgba(255, 255, 255, 0.001)"
                      stroke="rgba(255, 255, 255, 0.85)"
                      strokeWidth={2.5}
                      onMouseEnter={() => {
                        setIsHoveringCrown(false);
                        handleBlockMouseEnter();
                      }}
                      onMouseMove={() => {
                        if (isHoveringCrown) setIsHoveringCrown(false);
                        handleBlockMouseEnter();
                      }}
                    />

                    {/* Aro Minimalista Discreto da Lupa */}
                    <Circle
                      radius={ann.radius}
                      stroke={isSelected ? '#0071e3' : '#64748b'}
                      strokeWidth={isSelected ? 2 : 1.5}
                      listening={false}
                    />

                    {/* Detalhe Cosmético Minimalista na Parte de Baixo: Coroa Giratória Discreta */}
                    <Group
                      y={ann.radius}
                      onMouseEnter={() => {
                        setIsHoveringCrown(true);
                      }}
                      onMouseLeave={() => {
                        setIsHoveringCrown(false);
                      }}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        const parentGroup = e.currentTarget.getParent();
                        if (parentGroup?.isDragging()) {
                          parentGroup.stopDrag();
                        }
                        if (selectedId !== ann.id) {
                          onSelectId(ann.id);
                        }
                        setCrownDrag({
                          id: ann.id,
                          startX: e.evt.clientX,
                          initialZoom: ann.zoomLevel,
                          currentZoom: ann.zoomLevel,
                        });
                      }}
                    >
                      {/* Área de toque confortável e invisível na parte de baixo */}
                      <Rect
                        name="magnifier-crown"
                        x={-20}
                        y={-7}
                        width={40}
                        height={14}
                        fill="rgba(0, 0, 0, 0.001)"
                      />

                      {/* Cápsula minimalista da coroa giratória */}
                      <Rect
                        name="magnifier-crown"
                        x={-14}
                        y={-3.5}
                        width={28}
                        height={7}
                        cornerRadius={3.5}
                        fill="#334155"
                        stroke="#cbd5e1"
                        strokeWidth={1}
                      />

                      {/* Ranhuras minimalistas que acompanham o giro da coroa */}
                      {[-5, 0, 5].map((tickOffset) => (
                        <Line
                          key={tickOffset}
                          points={[
                            tickOffset + grooveShift,
                            -2,
                            tickOffset + grooveShift,
                            2,
                          ]}
                          stroke="#94a3b8"
                          strokeWidth={1}
                          listening={false}
                        />
                      ))}
                    </Group>

                    {/* Barra Minimalista de Zoom na Parte de Baixo (Visível APENAS ao movimentar para fazer zoom) */}
                    {showZoomBar && (
                      <Group y={ann.radius + 8} listening={false}>
                        <Rect
                          x={-44}
                          y={0}
                          width={88}
                          height={22}
                          cornerRadius={11}
                          fill="rgba(15, 23, 42, 0.88)"
                          stroke="rgba(148, 163, 184, 0.4)"
                          strokeWidth={1}
                        />
                        {/* Trilho de progresso minimalista */}
                        <Rect
                          x={-34}
                          y={9}
                          width={40}
                          height={4}
                          cornerRadius={2}
                          fill="#334155"
                        />
                        <Rect
                          x={-34}
                          y={9}
                          width={Math.max(4, 40 * zoomProgress)}
                          height={4}
                          cornerRadius={2}
                          fill="#f8fafc"
                        />
                        {/* Indicador numérico enxuto */}
                        <Text
                          x={10}
                          y={5}
                          width={30}
                          align="center"
                          text={`${activeZoom.toFixed(1)}x`}
                          fontSize={10}
                          fontStyle="bold"
                          fill="#f8fafc"
                        />
                      </Group>
                    )}
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
