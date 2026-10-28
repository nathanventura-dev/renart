import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Ellipse,
  Arrow,
  Text,
  Transformer,
  Circle,
  Group,
  Line,
} from 'react-konva';
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
  getAnnotationsInSelectionBox,
} from '../utils/magnifierAndHover';

interface CanvasEditorProps {
  imageBase64: string;
  annotations: Annotation[];
  activeTool: ToolType;
  selectedId: string | null;
  selectedIds?: string[];
  strokeColor: string;
  strokeWidth: number;
  autoStrokeWidth?: boolean;
  fontSize: number;
  isLocked?: boolean;
  onSelectId: (id: string | null) => void;
  onSelectIds?: (ids: string[]) => void;
  onToggleSelectId?: (id: string) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onUpdateAnnotations?: (updatesById: Record<string, Partial<Annotation>>) => void;
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

interface MarqueeSelectionState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const InsertedImageNode: React.FC<{
  ann: ImageAnnotation;
  canDrag: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({
  ann,
  canDrag,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
}) => {
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
      scaleX={ann.scaleX ?? 1}
      scaleY={ann.scaleY ?? 1}
      rotation={ann.rotation ?? 0}
      draggable={canDrag}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  );
};

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageBase64,
  annotations,
  activeTool,
  selectedId,
  selectedIds,
  strokeColor,
  strokeWidth,
  autoStrokeWidth = true,
  fontSize,
  isLocked = false,
  onSelectId,
  onSelectIds,
  onToggleSelectId,
  onAddAnnotation,
  onUpdateAnnotation,
  onUpdateAnnotations,
  stageRef,
}) => {
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Annotation | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeSelectionState | null>(null);
  const [editingText, setEditingText] = useState<InlineEditingText | null>(null);
  const [isHoveringBlock, setIsHoveringBlock] = useState(false);
  const [isHoveringCrown, setIsHoveringCrown] = useState(false);
  const [crownDrag, setCrownDrag] = useState<CrownDragState | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const crownDragRef = useRef<CrownDragState | null>(null);
  const onUpdateAnnotationRef = useRef(onUpdateAnnotation);
  const multiDragStartRef = useRef<{
    draggedId: string;
    initialPositions: Record<string, { x: number; y: number }>;
  } | null>(null);

  crownDragRef.current = crownDrag;
  onUpdateAnnotationRef.current = onUpdateAnnotation;

  // Lista normalizada de IDs selecionados (compatível com seleção única ou multiseleção)
  const effectiveSelectedIds = useMemo(() => {
    if (selectedIds && selectedIds.length > 0) return selectedIds;
    return selectedId ? [selectedId] : [];
  }, [selectedIds, selectedId]);

  const applySelectionIds = (ids: string[]) => {
    if (onSelectIds) {
      onSelectIds(ids);
    } else {
      onSelectId(ids[0] ?? null);
    }
  };

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
    setMarqueeBox(null);
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
        applySelectionIds([]);
        if (editingText) {
          setEditingText(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingText]);

  // Atualiza a seleção simples ou múltipla no Transformer do Konva
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (effectiveSelectedIds.length > 0 && !isLocked) {
      const nodes: Konva.Node[] = [];
      for (const id of effectiveSelectedIds) {
        const ann = annotations.find((a) => a.id === id);
        if (ann && shouldAttachTransformer(ann.type)) {
          const found = stageRef.current.findOne(`#${id}`);
          if (found) {
            nodes.push(found);
          }
        }
      }
      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [effectiveSelectedIds, annotations, isLocked, stageRef]);

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

  // Clique em um bloco: suporta Shift+Clique para adicionar/remover da multiseleção
  const handleBlockClick = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey && onToggleSelectId) {
      onToggleSelectId(id);
      return;
    }
    if (!effectiveSelectedIds.includes(id)) {
      applySelectionIds([id]);
    }
  };

  // Início do arraste de um bloco (suporta arrastar múltiplos blocos selecionados juntos)
  const handleBlockDragStart = (id: string) => {
    let activeIds = effectiveSelectedIds;
    if (!activeIds.includes(id)) {
      activeIds = [id];
      applySelectionIds([id]);
    }

    if (activeIds.length > 1 && stageRef.current) {
      const initialPositions: Record<string, { x: number; y: number }> = {};
      for (const selId of activeIds) {
        const node = stageRef.current.findOne(`#${selId}`);
        if (node) {
          initialPositions[selId] = { x: node.x(), y: node.y() };
        }
      }
      multiDragStartRef.current = { draggedId: id, initialPositions };
    } else {
      multiDragStartRef.current = null;
    }
  };

  // Movimento de arraste em tempo real (move todos os blocos da multiseleção juntos + atualiza lupa)
  const handleBlockDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const draggedNode = e.currentTarget;

    // Se o próprio bloco arrastado for uma lupa, atualiza a imagem interna da lente
    const draggedAnn = annotations.find((a) => a.id === id);
    if (draggedAnn?.type === 'magnifier') {
      const group = draggedNode as Konva.Group;
      const lensImg = group.findOne('.magnifier-lens-image');
      if (lensImg) {
        const activeZoom =
          crownDrag && crownDrag.id === draggedAnn.id ? crownDrag.currentZoom : draggedAnn.zoomLevel;
        const nextTransform = calculateMagnifierImageTransform(group.x(), group.y(), activeZoom);
        lensImg.position({ x: nextTransform.x, y: nextTransform.y });
      }
    }

    const multi = multiDragStartRef.current;
    if (!multi || multi.draggedId !== id || !stageRef.current) return;

    const startPos = multi.initialPositions[id];
    if (!startPos) return;

    const dx = draggedNode.x() - startPos.x;
    const dy = draggedNode.y() - startPos.y;

    for (const [otherId, initPos] of Object.entries(multi.initialPositions)) {
      if (otherId === id) continue;
      const otherNode = stageRef.current.findOne(`#${otherId}`);
      if (otherNode) {
        const nextX = initPos.x + dx;
        const nextY = initPos.y + dy;
        otherNode.position({ x: nextX, y: nextY });

        const otherAnn = annotations.find((a) => a.id === otherId);
        if (otherAnn?.type === 'magnifier') {
          const lensImg = (otherNode as Konva.Group).findOne('.magnifier-lens-image');
          if (lensImg) {
            const nextTransform = calculateMagnifierImageTransform(
              nextX,
              nextY,
              otherAnn.zoomLevel
            );
            lensImg.position({ x: nextTransform.x, y: nextTransform.y });
          }
        }
      }
    }
  };

  // Finalização do arraste (salva posição única ou de todos os blocos da multiseleção)
  const handleBlockDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const multi = multiDragStartRef.current;
    if (multi && multi.draggedId === id && stageRef.current && onUpdateAnnotations) {
      const updatesById: Record<string, Partial<Annotation>> = {};
      for (const selId of Object.keys(multi.initialPositions)) {
        const node = stageRef.current.findOne(`#${selId}`);
        if (node) {
          updatesById[selId] = { x: node.x(), y: node.y() };
        }
      }
      multiDragStartRef.current = null;
      onUpdateAnnotations(updatesById);
      return;
    }

    multiDragStartRef.current = null;
    onUpdateAnnotation(id, {
      x: e.currentTarget.x(),
      y: e.currentTarget.y(),
    });
  };

  // Salva redimensionamento / rotação feito pelo Transformer (simples ou multiseleção)
  const handleTransformEnd = () => {
    if (!transformerRef.current) return;
    const nodes = transformerRef.current.nodes();
    if (nodes.length === 0) return;

    if (nodes.length === 1) {
      const node = nodes[0];
      onUpdateAnnotation(node.id(), {
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      });
      return;
    }

    if (onUpdateAnnotations) {
      const updatesById: Record<string, Partial<Annotation>> = {};
      for (const node of nodes) {
        updatesById[node.id()] = {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        };
      }
      onUpdateAnnotations(updatesById);
    }
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const targetName = e.target.name();
    if (targetName === 'magnifier-crown') {
      return;
    }

    // Se clicou em uma âncora do Transformer, deixa o Transformer agir
    const parentName = e.target.getParent()?.className;
    if (parentName === 'Transformer') {
      return;
    }

    const isStageTarget = e.target === e.target.getStage();
    const clickedOnEmpty = !isTargetExistingAnnotation(targetName, isStageTarget);

    // Se o usuário clicou dentro da área de um bloco já existente,
    // permite apenas selecionar/movimentar o bloco existente sem criar um novo.
    if (!clickedOnEmpty) {
      return;
    }

    // Clicou na imagem de fundo ou Stage vazio: garante que o hover de bloco seja falso
    if (isHoveringBlock) {
      setIsHoveringBlock(false);
    }

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // Se a ferramenta de ponteiro ('select') está ativa, clicar e arrastar na área vazia inicia a Caixa de Multiseleção!
    if (activeTool === 'select') {
      applySelectionIds([]);
      if (!isLocked) {
        setMarqueeBox({
          startX: pos.x,
          startY: pos.y,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
        });
      }
      return;
    }

    applySelectionIds([]);

    const emptyClickBehavior = resolveCanvasPointerBehavior(activeTool, false, isLocked);
    if (emptyClickBehavior.clickAction !== 'create-new') {
      return;
    }

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
      applySelectionIds([id]);
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
        autoStrokeWidth,
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
        autoStrokeWidth,
      });
    } else if (activeTool === 'line') {
      setNewAnnotation({
        id,
        type: 'line',
        x: 0,
        y: 0,
        points: [pos.x, pos.y, pos.x, pos.y],
        stroke: strokeColor,
        strokeWidth,
        autoStrokeWidth,
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
        autoStrokeWidth,
      });
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const targetName = e.target.name();
    const isStageTarget = e.target === e.target.getStage();

    if (!isDrawing && !marqueeBox) {
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

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // Atualização em tempo real da Caixa de Multiseleção (clique e arraste)
    if (marqueeBox) {
      const nextBox: MarqueeSelectionState = {
        ...marqueeBox,
        x: Math.min(marqueeBox.startX, pos.x),
        y: Math.min(marqueeBox.startY, pos.y),
        width: Math.abs(pos.x - marqueeBox.startX),
        height: Math.abs(pos.y - marqueeBox.startY),
      };
      setMarqueeBox(nextBox);
      if (nextBox.width > 3 || nextBox.height > 3) {
        const hitIds = getAnnotationsInSelectionBox(annotations, nextBox);
        applySelectionIds(hitIds);
      }
      return;
    }

    if (!isDrawing || !newAnnotation) return;

    if (newAnnotation.type === 'rect') {
      const width = pos.x - newAnnotation.x;
      const height = pos.y - newAnnotation.y;
      setNewAnnotation({ ...newAnnotation, width, height });
    } else if (newAnnotation.type === 'ellipse') {
      const radiusX = Math.abs(pos.x - newAnnotation.x);
      const radiusY = Math.abs(pos.y - newAnnotation.y);
      setNewAnnotation({ ...newAnnotation, radiusX, radiusY });
    } else if (newAnnotation.type === 'line') {
      const p1 = newAnnotation.points;
      setNewAnnotation({ ...newAnnotation, points: [p1[0], p1[1], pos.x, pos.y] });
    } else if (newAnnotation.type === 'arrow') {
      const p1 = newAnnotation.points;
      setNewAnnotation({ ...newAnnotation, points: [p1[0], p1[1], pos.x, pos.y] });
    }
  };

  const handleMouseUp = () => {
    if (marqueeBox) {
      if (marqueeBox.width > 3 || marqueeBox.height > 3) {
        const hitIds = getAnnotationsInSelectionBox(annotations, marqueeBox);
        applySelectionIds(hitIds);
      }
      setMarqueeBox(null);
      return;
    }

    if (!isDrawing || !newAnnotation) return;
    setIsDrawing(false);

    if (newAnnotation.type === 'rect' && Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
      onAddAnnotation(newAnnotation);
    } else if (newAnnotation.type === 'ellipse' && newAnnotation.radiusX > 5 && newAnnotation.radiusY > 5) {
      onAddAnnotation(newAnnotation);
    } else if (newAnnotation.type === 'line') {
      const [x1, y1, x2, y2] = newAnnotation.points;
      if (Math.hypot(x2 - x1, y2 - y1) > 3) {
        onAddAnnotation(newAnnotation);
      }
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
              const strokeScaleEnabled = ann.autoStrokeWidth ?? true;

              if (ann.type === 'rect') {
                return (
                  <Rect
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    width={ann.width}
                    height={ann.height}
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    fill="rgba(0, 0, 0, 0.001)"
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
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
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    fill="rgba(0, 0, 0, 0.001)"
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                  />
                );
              }

              if (ann.type === 'line') {
                return (
                  <Line
                    key={ann.id}
                    id={ann.id}
                    x={ann.x || 0}
                    y={ann.y || 0}
                    points={ann.points}
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    lineCap="round"
                    hitStrokeWidth={20}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
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
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    hitStrokeWidth={20}
                    fill={ann.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
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
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    draggable={canDrag}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                    onDblClick={() => {
                      applySelectionIds([ann.id]);
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
                    onSelect={(e) => handleBlockClick(ann.id, e)}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                  />
                );
              }

              if (ann.type === 'magnifier') {
                const activeZoom =
                  crownDrag && crownDrag.id === ann.id ? crownDrag.currentZoom : ann.zoomLevel;

                const imgTransform = calculateMagnifierImageTransform(ann.x, ann.y, activeZoom);
                const showZoomBar = shouldShowZoomBar(crownDrag ? crownDrag.id : null, ann.id);
                const zoomProgress = calculateZoomBarProgress(activeZoom);
                const isSelected = effectiveSelectedIds.includes(ann.id);
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
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
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

                    {/* Aro Minimalista Discreto da Lupa (suporta cor customizada quando alterada pelo usuário) */}
                    <Circle
                      radius={ann.radius}
                      stroke={ann.stroke || (isSelected ? '#0071e3' : '#64748b')}
                      strokeWidth={ann.strokeWidth || (isSelected ? 2 : 1.5)}
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
                        if (!effectiveSelectedIds.includes(ann.id)) {
                          applySelectionIds([ann.id]);
                        }
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
                        x={-20}
                        y={-7}
                        width={40}
                        height={14}
                        fill="rgba(0, 0, 0, 0.001)"
                      />

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
                {newAnnotation.type === 'line' && (
                  <Line
                    points={newAnnotation.points}
                    stroke={newAnnotation.stroke}
                    strokeWidth={newAnnotation.strokeWidth}
                    lineCap="round"
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

            {/* Caixa de Multiseleção (Clique e Arraste com o Ponteiro) */}
            {marqueeBox && (marqueeBox.width > 2 || marqueeBox.height > 2) && (
              <Rect
                name="marquee-selection-box"
                x={marqueeBox.x}
                y={marqueeBox.y}
                width={marqueeBox.width}
                height={marqueeBox.height}
                fill="rgba(0, 113, 227, 0.12)"
                stroke="#0071e3"
                strokeWidth={1.5}
                dash={[4, 4]}
                listening={false}
              />
            )}

            {/* Transformer de Redimensionamento (Simples e Multiseleção) */}
            <Transformer ref={transformerRef} onTransformEnd={handleTransformEnd} />
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
