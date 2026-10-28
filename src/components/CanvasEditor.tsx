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
  clampMagnifierToImageBounds,
  sortAnnotationsWithMagnifiersOnTop,
  getMagnifierVisibleAnnotations,
  calculateMagnifierFocusGeometry,
  clampFocusPointToImageBounds,
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
  fontFamily?: string;
  isLocked?: boolean;
  magnifierMode?: 'without-focus' | 'with-focus';
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
  fontFamily: string;
  fill: string;
}

interface CrownDragState {
  id: string;
  startX: number;
  initialZoom: number;
  currentZoom: number;
}

interface FocusDragState {
  id: string;
  initialFocusX: number;
  initialFocusY: number;
  currentFocusX: number;
  currentFocusY: number;
}

interface MarqueeSelectionState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const PassiveImageNode: React.FC<{ ann: ImageAnnotation }> = ({ ann }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const imageObj = new window.Image();
    imageObj.src = ann.src;
    imageObj.onload = () => setImg(imageObj);
  }, [ann.src]);

  if (!img) return null;

  return (
    <KonvaImage
      image={img}
      x={ann.x}
      y={ann.y}
      width={ann.width}
      height={ann.height}
      scaleX={ann.scaleX ?? 1}
      scaleY={ann.scaleY ?? 1}
      rotation={ann.rotation ?? 0}
      listening={false}
    />
  );
};

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
  fontFamily = 'Arial',
  isLocked = false,
  magnifierMode = 'without-focus',
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
  const [isHoveringFocus, setIsHoveringFocus] = useState(false);
  const [crownDrag, setCrownDrag] = useState<CrownDragState | null>(null);
  const [focusDrag, setFocusDrag] = useState<FocusDragState | null>(null);
  const [liveLensDrag, setLiveLensDrag] = useState<{ id: string; x: number; y: number } | null>(
    null
  );

  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const crownDragRef = useRef<CrownDragState | null>(null);
  const focusDragRef = useRef<FocusDragState | null>(null);
  const onUpdateAnnotationRef = useRef(onUpdateAnnotation);
  const multiDragStartRef = useRef<{
    draggedId: string;
    initialPositions: Record<string, { x: number; y: number }>;
  } | null>(null);

  crownDragRef.current = crownDrag;
  focusDragRef.current = focusDrag;
  onUpdateAnnotationRef.current = onUpdateAnnotation;

  // Lista normalizada de IDs selecionados (compatível com seleção única ou multiseleção)
  const effectiveSelectedIds = useMemo(() => {
    if (selectedIds && selectedIds.length > 0) return selectedIds;
    return selectedId ? [selectedId] : [];
  }, [selectedIds, selectedId]);

  // Ordena todas as anotações mantendo as lupas sempre acima de todos os demais blocos
  const orderedAnnotations = useMemo(
    () => sortAnnotationsWithMagnifiersOnTop(annotations),
    [annotations]
  );

  // Todos os blocos (formas, linhas, setas, textos, imagens) visíveis dentro da lente da lupa
  const visibleInLensAnnotations = useMemo(
    () => getMagnifierVisibleAnnotations(annotations),
    [annotations]
  );

  const hasSelectedMagnifier = useMemo(
    () =>
      effectiveSelectedIds.some(
        (id) => annotations.find((a) => a.id === id)?.type === 'magnifier'
      ),
    [effectiveSelectedIds, annotations]
  );

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
    setIsHoveringFocus(false);
    setIsDrawing(false);
    setNewAnnotation(null);
    setMarqueeBox(null);
  }, [activeTool, imageBase64, annotations.length]);

  const isDraggingCrown = Boolean(crownDrag);
  const isDraggingFocus = Boolean(focusDrag);

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

  // Finaliza o arraste do ponto focal da lupa ao soltar o mouse em qualquer lugar da janela
  useEffect(() => {
    if (!isDraggingFocus) return;

    const handleWindowMouseUp = () => {
      const current = focusDragRef.current;
      if (
        current &&
        (current.currentFocusX !== current.initialFocusX ||
          current.currentFocusY !== current.initialFocusY)
      ) {
        onUpdateAnnotationRef.current(current.id, {
          focusX: current.currentFocusX,
          focusY: current.currentFocusY,
        });
      }
      setFocusDrag(null);
      setIsHoveringFocus(false);
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingFocus]);

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

  // Resolve o estilo do cursor dinamicamente conforme hover em blocos, alça de foco ou coroa da lupa
  const pointerBehavior = resolveCanvasPointerBehavior(activeTool, isHoveringBlock, isLocked);
  const currentCursor =
    crownDrag || isHoveringCrown
      ? 'ew-resize'
      : focusDrag
        ? 'grabbing'
        : isHoveringFocus
          ? 'grab'
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

  // Movimento de arraste em tempo real (move todos os blocos da multiseleção juntos + atualiza lupa e cone focal)
  const handleBlockDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const draggedNode = e.currentTarget;

    // Se o próprio bloco arrastado for uma lupa, atualiza o conteúdo interno da lente e o cone de foco
    const draggedAnn = annotations.find((a) => a.id === id);
    if (draggedAnn?.type === 'magnifier') {
      const group = draggedNode as Konva.Group;
      const hasDetachedFocus =
        draggedAnn.focusX !== undefined &&
        draggedAnn.focusY !== undefined &&
        Math.hypot(draggedAnn.focusX - draggedAnn.x, draggedAnn.focusY - draggedAnn.y) > 4;

      if (hasDetachedFocus) {
        setLiveLensDrag({ id: draggedAnn.id, x: group.x(), y: group.y() });
      }

      const lensContent = group.findOne('.magnifier-lens-content');
      if (lensContent) {
        const activeZoom =
          crownDrag && crownDrag.id === draggedAnn.id ? crownDrag.currentZoom : draggedAnn.zoomLevel;
        const targetFocusX = hasDetachedFocus ? draggedAnn.focusX : group.x();
        const targetFocusY = hasDetachedFocus ? draggedAnn.focusY : group.y();
        const nextTransform = calculateMagnifierImageTransform(
          group.x(),
          group.y(),
          activeZoom,
          targetFocusX,
          targetFocusY
        );
        lensContent.position({ x: nextTransform.x, y: nextTransform.y });
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
          const lensContent = (otherNode as Konva.Group).findOne('.magnifier-lens-content');
          if (lensContent) {
            const hasDetached =
              otherAnn.focusX !== undefined &&
              otherAnn.focusY !== undefined &&
              Math.hypot(otherAnn.focusX - otherAnn.x, otherAnn.focusY - otherAnn.y) > 4;
            const nextTransform = calculateMagnifierImageTransform(
              nextX,
              nextY,
              otherAnn.zoomLevel,
              hasDetached ? otherAnn.focusX : nextX,
              hasDetached ? otherAnn.focusY : nextY
            );
            lensContent.position({ x: nextTransform.x, y: nextTransform.y });
          }
        }
      }
    }
  };

  // Finalização do arraste (salva posição única ou de todos os blocos da multiseleção)
  const handleBlockDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    setLiveLensDrag(null);
    const imgW = bgImage ? bgImage.width : 800;
    const imgH = bgImage ? bgImage.height : 600;
    const multi = multiDragStartRef.current;
    if (multi && multi.draggedId === id && stageRef.current && onUpdateAnnotations) {
      const updatesById: Record<string, Partial<Annotation>> = {};
      for (const selId of Object.keys(multi.initialPositions)) {
        const node = stageRef.current.findOne(`#${selId}`);
        const ann = annotations.find((a) => a.id === selId);
        if (node && ann) {
          if (ann.type === 'magnifier') {
            const clamped = clampMagnifierToImageBounds(
              node.x(),
              node.y(),
              ann.radius,
              imgW,
              imgH
            );
            node.position({ x: clamped.x, y: clamped.y });
            const hasDetached =
              ann.focusX !== undefined &&
              ann.focusY !== undefined &&
              Math.hypot(ann.focusX - ann.x, ann.focusY - ann.y) > 4;
            updatesById[selId] = hasDetached
              ? { x: clamped.x, y: clamped.y }
              : { x: clamped.x, y: clamped.y, focusX: clamped.x, focusY: clamped.y };
          } else {
            updatesById[selId] = { x: node.x(), y: node.y() };
          }
        }
      }
      multiDragStartRef.current = null;
      onUpdateAnnotations(updatesById);
      return;
    }

    multiDragStartRef.current = null;
    const draggedAnn = annotations.find((a) => a.id === id);
    if (draggedAnn?.type === 'magnifier') {
      const clamped = clampMagnifierToImageBounds(
        e.currentTarget.x(),
        e.currentTarget.y(),
        draggedAnn.radius,
        imgW,
        imgH
      );
      e.currentTarget.position({ x: clamped.x, y: clamped.y });
      const hasDetachedFocus =
        draggedAnn.focusX !== undefined &&
        draggedAnn.focusY !== undefined &&
        Math.hypot(draggedAnn.focusX - draggedAnn.x, draggedAnn.focusY - draggedAnn.y) > 4;
      onUpdateAnnotation(
        id,
        hasDetachedFocus
          ? { x: clamped.x, y: clamped.y }
          : { x: clamped.x, y: clamped.y, focusX: clamped.x, focusY: clamped.y }
      );
      return;
    }

    onUpdateAnnotation(id, {
      x: e.currentTarget.x(),
      y: e.currentTarget.y(),
    });
  };

  // Mantém a ampliação da lente íntegra em tempo real enquanto o usuário redimensiona a lupa
  const handleTransform = () => {
    if (!transformerRef.current) return;
    const nodes = transformerRef.current.nodes();
    for (const node of nodes) {
      const ann = annotations.find((a) => a.id === node.id());
      if (ann?.type === 'magnifier') {
        const sx = node.scaleX() || 1;
        const sy = node.scaleY() || 1;
        const hasDetachedFocus =
          ann.focusX !== undefined &&
          ann.focusY !== undefined &&
          Math.hypot(ann.focusX - ann.x, ann.focusY - ann.y) > 4;
        const targetFocusX = hasDetachedFocus ? ann.focusX! : node.x();
        const targetFocusY = hasDetachedFocus ? ann.focusY! : node.y();
        const lensContent = (node as Konva.Container).findOne('.magnifier-lens-content');
        if (lensContent) {
          const effectiveZoomX = ann.zoomLevel / sx;
          const effectiveZoomY = ann.zoomLevel / sy;
          lensContent.scale({ x: effectiveZoomX, y: effectiveZoomY });
          lensContent.position({
            x: -targetFocusX * effectiveZoomX,
            y: -targetFocusY * effectiveZoomY,
          });
        }
      }
    }
  };

  // Salva redimensionamento / rotação feito pelo Transformer (simples ou multiseleção, incluindo raio da lupa)
  const handleTransformEnd = () => {
    if (!transformerRef.current) return;
    const nodes = transformerRef.current.nodes();
    if (nodes.length === 0) return;

    const imgW = bgImage ? bgImage.width : 800;
    const imgH = bgImage ? bgImage.height : 600;

    const computeNodeTransformUpdate = (node: Konva.Node): Partial<Annotation> => {
      const ann = annotations.find((a) => a.id === node.id());
      if (ann?.type === 'magnifier') {
        const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
        const nextRadius = ann.radius * scale;
        const clamped = clampMagnifierToImageBounds(
          node.x(),
          node.y(),
          nextRadius,
          imgW,
          imgH
        );
        node.scaleX(1);
        node.scaleY(1);
        node.rotation(0);
        node.position({ x: clamped.x, y: clamped.y });
        const hasDetachedFocus =
          ann.focusX !== undefined &&
          ann.focusY !== undefined &&
          Math.hypot(ann.focusX - ann.x, ann.focusY - ann.y) > 4;
        const targetFocusX = hasDetachedFocus ? ann.focusX! : clamped.x;
        const targetFocusY = hasDetachedFocus ? ann.focusY! : clamped.y;
        const lensContent = (node as Konva.Container).findOne('.magnifier-lens-content');
        if (lensContent) {
          const nextTransform = calculateMagnifierImageTransform(
            clamped.x,
            clamped.y,
            ann.zoomLevel,
            targetFocusX,
            targetFocusY
          );
          lensContent.scale({ x: nextTransform.scaleX, y: nextTransform.scaleY });
          lensContent.position({ x: nextTransform.x, y: nextTransform.y });
        }
        return hasDetachedFocus
          ? {
              x: clamped.x,
              y: clamped.y,
              radius: clamped.radius,
            }
          : {
              x: clamped.x,
              y: clamped.y,
              radius: clamped.radius,
              focusX: clamped.x,
              focusY: clamped.y,
            };
      }

      return {
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      };
    };

    if (nodes.length === 1) {
      const node = nodes[0];
      onUpdateAnnotation(node.id(), computeNodeTransformUpdate(node));
      return;
    }

    if (onUpdateAnnotations) {
      const updatesById: Record<string, Partial<Annotation>> = {};
      for (const node of nodes) {
        updatesById[node.id()] = computeNodeTransformUpdate(node);
      }
      onUpdateAnnotations(updatesById);
    }
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const targetName = e.target.name();
    if (targetName === 'magnifier-crown' || targetName === 'magnifier-focus') {
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
        fontFamily,
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
        fontFamily,
        fill: strokeColor,
      });
      return;
    }

    if (activeTool === 'magnifier') {
      const imgW = bgImage ? bgImage.width : 800;
      const imgH = bgImage ? bgImage.height : 600;
      const clamped = clampMagnifierToImageBounds(pos.x, pos.y, 65, imgW, imgH);
      const clampedFocus = clampFocusPointToImageBounds(pos.x, pos.y, imgW, imgH);

      if (magnifierMode === 'with-focus') {
        // Lupa Com Foco (V2): O ponto clicado fica cravado como o Ponto Focal
        // e arrastar o mouse posiciona o corpo da lupa no canto desejado com o rastro fosco!
        setIsDrawing(true);
        setNewAnnotation({
          id,
          type: 'magnifier',
          x: clamped.x,
          y: clamped.y,
          radius: clamped.radius,
          zoomLevel: 2.0,
          focusX: clampedFocus.x,
          focusY: clampedFocus.y,
        });
        return;
      }

      // Lupa Sem Foco: Cria a lupa tradicional ampliando a área diretamente sob a lente
      onAddAnnotation({
        id,
        type: 'magnifier',
        x: clamped.x,
        y: clamped.y,
        radius: clamped.radius,
        zoomLevel: 2.0,
      });
      applySelectionIds([id]);
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

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();

    // Se estiver arrastando o ponto focal da lupa, atualiza em tempo real dentro dos limites da imagem
    if (focusDrag && pos) {
      const imgW = bgImage ? bgImage.width : 800;
      const imgH = bgImage ? bgImage.height : 600;
      const clampedFocus = clampFocusPointToImageBounds(pos.x, pos.y, imgW, imgH);
      if (
        clampedFocus.x !== focusDrag.currentFocusX ||
        clampedFocus.y !== focusDrag.currentFocusY
      ) {
        setFocusDrag((prev) =>
          prev
            ? {
                ...prev,
                currentFocusX: clampedFocus.x,
                currentFocusY: clampedFocus.y,
              }
            : null
        );
      }
      return;
    }

    if (!isDrawing && !marqueeBox) {
      if (targetName === 'magnifier-crown') {
        if (!isHoveringCrown) setIsHoveringCrown(true);
        if (isHoveringFocus) setIsHoveringFocus(false);
        if (isHoveringBlock) setIsHoveringBlock(false);
      } else if (targetName === 'magnifier-focus') {
        if (!isHoveringFocus) setIsHoveringFocus(true);
        if (isHoveringCrown) setIsHoveringCrown(false);
        if (isHoveringBlock) setIsHoveringBlock(false);
      } else {
        if (isHoveringCrown) setIsHoveringCrown(false);
        if (isHoveringFocus) setIsHoveringFocus(false);
        const hoveringExisting = !isLocked && isTargetExistingAnnotation(targetName, isStageTarget);
        if (hoveringExisting !== isHoveringBlock) {
          setIsHoveringBlock(hoveringExisting);
        }
      }
    }

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
    } else if (newAnnotation.type === 'magnifier') {
      const imgW = bgImage ? bgImage.width : 800;
      const imgH = bgImage ? bgImage.height : 600;
      const clampedLens = clampMagnifierToImageBounds(pos.x, pos.y, newAnnotation.radius, imgW, imgH);
      setNewAnnotation({
        ...newAnnotation,
        x: clampedLens.x,
        y: clampedLens.y,
      });
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
    } else if (newAnnotation.type === 'magnifier') {
      const imgW = bgImage ? bgImage.width : 800;
      const imgH = bgImage ? bgImage.height : 600;
      const fx = newAnnotation.focusX ?? newAnnotation.x;
      const fy = newAnnotation.focusY ?? newAnnotation.y;
      const dragDist = Math.hypot(newAnnotation.x - fx, newAnnotation.y - fy);
      if (dragDist <= 10) {
        // Se no modo V2 o usuário apenas clicou sem arrastar, destaca a lente diagonalmente para exibir o cone de foco imediato
        const offsetLens = clampMagnifierToImageBounds(
          fx + 110,
          fy - 85,
          newAnnotation.radius,
          imgW,
          imgH
        );
        onAddAnnotation({
          ...newAnnotation,
          x: offsetLens.x,
          y: offsetLens.y,
        });
      } else {
        onAddAnnotation(newAnnotation);
      }
      applySelectionIds([newAnnotation.id]);
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

          {/* Camada de Vetores e Anotações (Lupas sempre no topo) */}
          <Layer>
            {orderedAnnotations.map((ann) => {
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
                    fontFamily={ann.fontFamily || 'Arial'}
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
                        fontFamily: ann.fontFamily || 'Arial',
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

                const effectiveLensX =
                  liveLensDrag && liveLensDrag.id === ann.id ? liveLensDrag.x : ann.x;
                const effectiveLensY =
                  liveLensDrag && liveLensDrag.id === ann.id ? liveLensDrag.y : ann.y;

                const activeFocusX =
                  focusDrag && focusDrag.id === ann.id
                    ? focusDrag.currentFocusX
                    : (ann.focusX ?? ann.x);
                const activeFocusY =
                  focusDrag && focusDrag.id === ann.id
                    ? focusDrag.currentFocusY
                    : (ann.focusY ?? ann.y);

                const imgTransform = calculateMagnifierImageTransform(
                  effectiveLensX,
                  effectiveLensY,
                  activeZoom,
                  activeFocusX,
                  activeFocusY
                );
                const focusGeo = calculateMagnifierFocusGeometry(
                  effectiveLensX,
                  effectiveLensY,
                  ann.radius,
                  activeFocusX,
                  activeFocusY,
                  activeZoom
                );
                const showZoomBar = shouldShowZoomBar(crownDrag ? crownDrag.id : null, ann.id);
                const zoomProgress = calculateZoomBarProgress(activeZoom);
                const isSelected = effectiveSelectedIds.includes(ann.id);
                const grooveShift = (activeZoom - 2.0) * 4;
                const ringColor = ann.stroke || (isSelected ? '#0071e3' : '#64748b');

                const startFocusDrag = (e: Konva.KonvaEventObject<MouseEvent>) => {
                  if (isLocked) return;
                  e.cancelBubble = true;
                  const parentGroup = stageRef.current?.findOne(`#${ann.id}`);
                  if (parentGroup?.isDragging()) {
                    parentGroup.stopDrag();
                  }
                  if (!effectiveSelectedIds.includes(ann.id)) {
                    applySelectionIds([ann.id]);
                  }
                  setFocusDrag({
                    id: ann.id,
                    initialFocusX: activeFocusX,
                    initialFocusY: activeFocusY,
                    currentFocusX: activeFocusX,
                    currentFocusY: activeFocusY,
                  });
                };

                return (
                  <Group
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    draggable={!isLocked && !focusDrag}
                    dragBoundFunc={(pos) => {
                      const clamped = clampMagnifierToImageBounds(
                        pos.x,
                        pos.y,
                        ann.radius,
                        canvasWidth,
                        canvasHeight
                      );
                      return { x: clamped.x, y: clamped.y };
                    }}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseMove={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                  >
                    {/* Rastro Levemente Fosco Estreito e Apenas o Ponto Focal (Sem Círculo Externo) */}
                    {focusGeo.hasOffsetFocus && (
                      <Group
                        ref={(node) => {
                          if (node) {
                            node.getClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
                          }
                        }}
                      >
                        {/* Polígono do Rastro Levemente Fosco estreito partindo do ponto focal até a lupa */}
                        <Line
                          points={focusGeo.conePoints}
                          closed
                          fill="rgba(255, 255, 255, 0.36)"
                          stroke="rgba(255, 255, 255, 0.68)"
                          strokeWidth={1}
                          listening={false}
                        />
                        {/* Linhas Laterais Sutis do Rastro */}
                        <Line
                          points={[
                            focusGeo.conePoints[0],
                            focusGeo.conePoints[1],
                            focusGeo.conePoints[6],
                            focusGeo.conePoints[7],
                          ]}
                          stroke={ringColor}
                          strokeWidth={1}
                          opacity={0.42}
                          dash={[3, 3]}
                          listening={false}
                        />
                        <Line
                          points={[
                            focusGeo.conePoints[2],
                            focusGeo.conePoints[3],
                            focusGeo.conePoints[4],
                            focusGeo.conePoints[5],
                          ]}
                          stroke={ringColor}
                          strokeWidth={1}
                          opacity={0.42}
                          dash={[3, 3]}
                          listening={false}
                        />

                        {/* Área de Clique Invisível ao redor do Ponto Focal para Facilitar o Arraste */}
                        <Circle
                          name="magnifier-focus"
                          x={focusGeo.dx}
                          y={focusGeo.dy}
                          radius={14}
                          fill="rgba(0, 0, 0, 0.001)"
                          onMouseEnter={() => setIsHoveringFocus(true)}
                          onMouseLeave={() => setIsHoveringFocus(false)}
                          onMouseDown={startFocusDrag}
                        />

                        {/* Apenas o Ponto Central do Foco (Sem Círculo ao Redor) */}
                        <Circle
                          name="magnifier-focus"
                          x={focusGeo.dx}
                          y={focusGeo.dy}
                          radius={focusGeo.focusDotRadius}
                          fill={ringColor}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          onMouseEnter={() => setIsHoveringFocus(true)}
                          onMouseLeave={() => setIsHoveringFocus(false)}
                          onMouseDown={startFocusDrag}
                        />
                      </Group>
                    )}

                    {/* Lente Circular com Recorte e Ampliação Real da Imagem e dos Blocos Adicionados */}
                    <Group
                      ref={(node) => {
                        if (node) {
                          node.getClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
                        }
                      }}
                      clipFunc={(ctx) => {
                        ctx.arc(0, 0, ann.radius, 0, Math.PI * 2, false);
                      }}
                    >
                      <Circle radius={ann.radius} fill="#ffffff" listening={false} />
                      <Group
                        name="magnifier-lens-content"
                        x={imgTransform.x}
                        y={imgTransform.y}
                        scaleX={imgTransform.scaleX}
                        scaleY={imgTransform.scaleY}
                        listening={false}
                      >
                        {bgImage && (
                          <KonvaImage
                            name="magnifier-lens-image"
                            image={bgImage}
                            width={canvasWidth}
                            height={canvasHeight}
                            listening={false}
                          />
                        )}
                        {visibleInLensAnnotations.map((item) => {
                          const itemStrokeScale = item.autoStrokeWidth ?? true;
                          if (item.type === 'rect') {
                            return (
                              <Rect
                                key={`lens-${ann.id}-${item.id}`}
                                x={item.x}
                                y={item.y}
                                width={item.width}
                                height={item.height}
                                scaleX={item.scaleX ?? 1}
                                scaleY={item.scaleY ?? 1}
                                rotation={item.rotation ?? 0}
                                fill="rgba(0, 0, 0, 0.001)"
                                stroke={item.stroke}
                                strokeWidth={item.strokeWidth}
                                strokeScaleEnabled={itemStrokeScale}
                                listening={false}
                              />
                            );
                          }
                          if (item.type === 'ellipse') {
                            return (
                              <Ellipse
                                key={`lens-${ann.id}-${item.id}`}
                                x={item.x}
                                y={item.y}
                                radiusX={item.radiusX}
                                radiusY={item.radiusY}
                                scaleX={item.scaleX ?? 1}
                                scaleY={item.scaleY ?? 1}
                                rotation={item.rotation ?? 0}
                                fill="rgba(0, 0, 0, 0.001)"
                                stroke={item.stroke}
                                strokeWidth={item.strokeWidth}
                                strokeScaleEnabled={itemStrokeScale}
                                listening={false}
                              />
                            );
                          }
                          if (item.type === 'line') {
                            return (
                              <Line
                                key={`lens-${ann.id}-${item.id}`}
                                x={item.x || 0}
                                y={item.y || 0}
                                points={item.points}
                                scaleX={item.scaleX ?? 1}
                                scaleY={item.scaleY ?? 1}
                                rotation={item.rotation ?? 0}
                                stroke={item.stroke}
                                strokeWidth={item.strokeWidth}
                                strokeScaleEnabled={itemStrokeScale}
                                lineCap="round"
                                listening={false}
                              />
                            );
                          }
                          if (item.type === 'arrow') {
                            return (
                              <Arrow
                                key={`lens-${ann.id}-${item.id}`}
                                x={item.x || 0}
                                y={item.y || 0}
                                points={item.points}
                                scaleX={item.scaleX ?? 1}
                                scaleY={item.scaleY ?? 1}
                                rotation={item.rotation ?? 0}
                                stroke={item.stroke}
                                strokeWidth={item.strokeWidth}
                                strokeScaleEnabled={itemStrokeScale}
                                fill={item.stroke}
                                pointerLength={10}
                                pointerWidth={10}
                                listening={false}
                              />
                            );
                          }
                          if (item.type === 'text') {
                            return (
                              <Text
                                key={`lens-${ann.id}-${item.id}`}
                                x={item.x}
                                y={item.y}
                                text={item.text}
                                fontSize={item.fontSize}
                                fontFamily={item.fontFamily || 'Arial'}
                                fill={item.fill || '#000000'}
                                scaleX={item.scaleX ?? 1}
                                scaleY={item.scaleY ?? 1}
                                rotation={item.rotation ?? 0}
                                listening={false}
                              />
                            );
                          }
                          if (item.type === 'image') {
                            return (
                              <PassiveImageNode
                                key={`lens-${ann.id}-${item.id}`}
                                ann={item}
                              />
                            );
                          }
                          return null;
                        })}
                      </Group>
                    </Group>

                    {/* Superfície da Lente Clicável para Arraste Livre */}
                    <Circle
                      radius={ann.radius}
                      fill="rgba(255, 255, 255, 0.001)"
                      stroke="rgba(255, 255, 255, 0.85)"
                      strokeWidth={2.5}
                      onMouseEnter={() => {
                        setIsHoveringCrown(false);
                        setIsHoveringFocus(false);
                        handleBlockMouseEnter();
                      }}
                      onMouseMove={() => {
                        if (isHoveringCrown) setIsHoveringCrown(false);
                        if (isHoveringFocus) setIsHoveringFocus(false);
                        handleBlockMouseEnter();
                      }}
                    />

                    {/* Aro Minimalista Discreto da Lupa (suporta cor customizada quando alterada pelo usuário) */}
                    <Circle
                      radius={ann.radius}
                      stroke={ringColor}
                      strokeWidth={ann.strokeWidth || (isSelected ? 2 : 1.5)}
                      listening={false}
                    />

                    {/* Detalhe Cosmético Minimalista na Parte de Baixo: Coroa Giratória Discreta */}
                    <Group
                      ref={(node) => {
                        if (node) {
                          node.getClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
                        }
                      }}
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
                      <Group
                        ref={(node) => {
                          if (node) {
                            node.getClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
                          }
                        }}
                        y={ann.radius + 8}
                        listening={false}
                      >
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
                {newAnnotation.type === 'magnifier' && (() => {
                  const previewTransform = calculateMagnifierImageTransform(
                    newAnnotation.x,
                    newAnnotation.y,
                    newAnnotation.zoomLevel,
                    newAnnotation.focusX,
                    newAnnotation.focusY
                  );
                  const previewFocusGeo = calculateMagnifierFocusGeometry(
                    newAnnotation.x,
                    newAnnotation.y,
                    newAnnotation.radius,
                    newAnnotation.focusX,
                    newAnnotation.focusY,
                    newAnnotation.zoomLevel
                  );
                  return (
                    <Group x={newAnnotation.x} y={newAnnotation.y} listening={false}>
                      {previewFocusGeo.hasOffsetFocus && (
                        <>
                          <Line
                            points={previewFocusGeo.conePoints}
                            closed
                            fill="rgba(255, 255, 255, 0.36)"
                            stroke="rgba(255, 255, 255, 0.68)"
                            strokeWidth={1}
                            listening={false}
                          />
                          <Circle
                            x={previewFocusGeo.dx}
                            y={previewFocusGeo.dy}
                            radius={previewFocusGeo.focusDotRadius}
                            fill="#0071e3"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            listening={false}
                          />
                        </>
                      )}
                      <Group
                        clipFunc={(ctx) => {
                          ctx.arc(0, 0, newAnnotation.radius, 0, Math.PI * 2, false);
                        }}
                      >
                        <Circle radius={newAnnotation.radius} fill="#ffffff" listening={false} />
                        {bgImage && (
                          <KonvaImage
                            image={bgImage}
                            width={canvasWidth}
                            height={canvasHeight}
                            x={previewTransform.x}
                            y={previewTransform.y}
                            scaleX={previewTransform.scaleX}
                            scaleY={previewTransform.scaleY}
                            listening={false}
                          />
                        )}
                      </Group>
                      <Circle
                        radius={newAnnotation.radius}
                        stroke="#0071e3"
                        strokeWidth={2}
                        listening={false}
                      />
                    </Group>
                  );
                })()}
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

            {/* Transformer de Redimensionamento (Simples, Multiseleção e Lupa) */}
            <Transformer
              ref={transformerRef}
              onTransform={handleTransform}
              onTransformEnd={handleTransformEnd}
              rotateEnabled={!hasSelectedMagnifier}
              keepRatio={hasSelectedMagnifier}
              enabledAnchors={
                hasSelectedMagnifier
                  ? [
                      'top-left',
                      'top-right',
                      'bottom-left',
                      'bottom-right',
                      'middle-left',
                      'middle-right',
                      'top-center',
                    ]
                  : undefined
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (hasSelectedMagnifier) {
                  if (
                    newBox.width < 48 ||
                    newBox.height < 48 ||
                    newBox.x < 0 ||
                    newBox.y < 0 ||
                    newBox.x + newBox.width > canvasWidth ||
                    newBox.y + newBox.height > canvasHeight
                  ) {
                    return oldBox;
                  }
                }
                return newBox;
              }}
            />
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
              fontFamily: editingText.fontFamily || 'Arial',
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
