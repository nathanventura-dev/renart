import { resolveKonvaFontStyle, resolveKonvaTextDecoration, parseHtmlToSpans, spansToHtml, splitSpansIntoLines, measureSpanWidth, TextSpan, isEditingTextElement } from '../utils/textStyle';
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
  Shape,
} from 'react-konva';
import Konva from 'konva';
import {
  Annotation,
  ToolType,
  ImageAnnotation,
  RectAnnotation,
  EllipseAnnotation,
  RedactionAnnotation,
  RedactionLevel,
  RedactionEffect,
  RedactionMode,
  ArrowStyle,
  ArrowCurveDirection,
} from '../state/editorStore';
import {
  createRedactionBrush,
  createRedactionRect,
  clampRedactionRectToBounds,
  resolveRedactionLevel,
  REDACTION_BLUR_RADII,
  REDACTION_SCRAMBLE_CONFIG,
} from '../utils/redaction';
import { createAntiAiBlurredCanvas } from '../utils/scrambleBlur';
import { detectTextInImageRegion } from '../services/ocrService';
import { anonymizeOcrLines } from '../utils/textAnonymizer';
import { sampleRegionColors } from '../utils/colorSampling';
import { calculateSmartTextWordLayout } from '../utils/smartTextLayout';
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
  calculateResizedFontSize,
  clampTextResizeBox,
  getAnnotationSelectionOutline,
} from '../utils/magnifierAndHover';
import {
  calculateFitToScreenScale,
  calculateCropBounds,
  CropBox,
  getTransformedPointerPosition,
  getTransformedDragBound,
  toLocalBoundingBox,
  toAbsoluteBoundingBox,
  clampRectToBounds,
  clampEllipseToBounds,
  convertToPerfectCircle,
  clampLinePointsToBounds,
  clampAnnotationPositionToBounds,
  calculateProportionalResizeBox,
  calculateCurvedArrowPoints,
  getArrowHeadDimensions,
  calculateResizedArrowStroke,
  clampArrowResizeBox,
  updateCurvedArrowAnchor,
  getCurvedArrowAnchorPositions,
  updateTwoPointAnchor,
  getTwoPointAnchorPositions,
  getFourCornerPositions,
  shouldShowRotationHandle,
  updateCornerResize,
  updateShapeRotation,
  getCornerCursor,
  snapAngleToStep,
  snapLinePointsWithShift,
  snapRectWithShift,
  getTwoPointAnchorDragBound,
  getOpenChevronArrowPoints,
  getCropVisualGuides,
} from '../utils/zoomAndCrop';

interface CanvasEditorProps {
  imageBase64: string;
  annotations: Annotation[];
  activeTool: ToolType;
  selectedId: string | null;
  selectedIds?: string[];
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  hasBackground?: boolean;
  isLocked?: boolean;
  magnifierMode?: 'without-focus' | 'with-focus';
  arrowStyle?: ArrowStyle;
  arrowCurveDirection?: ArrowCurveDirection;
  redactionLevel?: RedactionLevel;
  redactionEffect?: RedactionEffect;
  redactionMode?: RedactionMode;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitScaleCalculated?: (scale: number) => void;
  isCropping?: boolean;
  onCropRectChange?: (cropBox: CropBox) => void;
  onSelectId: (id: string | null) => void;
  onSelectIds?: (ids: string[]) => void;
  onToggleSelectId?: (id: string) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onUpdateAnnotations?: (updatesById: Record<string, Partial<Annotation>>) => void;
  onRemoveAnnotation?: (id: string) => void;
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
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  hasBackground?: boolean;
  spans?: TextSpan[];
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
  canvasWidth: number;
  canvasHeight: number;
  zoomLevel: number;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({
  ann,
  canDrag,
  canvasWidth,
  canvasHeight,
  zoomLevel,
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
      dragBoundFunc={(pos) =>
        getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
          clampRectToBounds(
            localX,
            localY,
            ann.width,
            ann.height,
            canvasWidth,
            canvasHeight,
            ann.scaleX ?? 1,
            ann.scaleY ?? 1,
            ann.rotation ?? 0
          )
        )
      }
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
  fontSize,
  fontFamily = 'Arial',
  isBold = false,
  isItalic = false,
  isUnderline = false,
  isStrikethrough = false,
  textAlign = 'left',
  hasBackground = false,
  isLocked = false,
  magnifierMode = 'without-focus',
  arrowStyle = 'standard',
  arrowCurveDirection = 'right',
  redactionLevel = 4,
  redactionEffect = 'blackout',
  redactionMode = 'rect',
  zoomLevel = 1.0,
  onZoomIn,
  onZoomOut,
  onFitScaleCalculated,
  isCropping = false,
  onCropRectChange,
  onSelectId,
  onSelectIds,
  onToggleSelectId,
  onAddAnnotation,
  onUpdateAnnotation,
  onUpdateAnnotations,
  onRemoveAnnotation,
  stageRef,
}) => {
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const blurredBgCanvases = useMemo(() => {
    if (!bgImage) return { 1: null, 2: null };
    const createBlurCanvas = (radius: number) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bgImage.width;
        canvas.height = bgImage.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.filter = `blur(${radius}px)`;
        ctx.drawImage(bgImage, -radius, -radius, bgImage.width + radius * 2, bgImage.height + radius * 2);
        return canvas;
      } catch {
        return null;
      }
    };
    return {
      1:
        createAntiAiBlurredCanvas(
          bgImage,
          REDACTION_BLUR_RADII[1],
          REDACTION_SCRAMBLE_CONFIG[1].blockSize,
          REDACTION_SCRAMBLE_CONFIG[1].noiseIntensity
        ) || createBlurCanvas(REDACTION_BLUR_RADII[1]),
      2:
        createAntiAiBlurredCanvas(
          bgImage,
          REDACTION_BLUR_RADII[2],
          REDACTION_SCRAMBLE_CONFIG[2].blockSize,
          REDACTION_SCRAMBLE_CONFIG[2].noiseIntensity
        ) || createBlurCanvas(REDACTION_BLUR_RADII[2]),
    };
  }, [bgImage]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Annotation | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeSelectionState | null>(null);
  const [editingText, setEditingText] = useState<InlineEditingText | null>(null);
  const inlineEditableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editingText && inlineEditableRef.current) {
      inlineEditableRef.current.focus();
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (sel) {
        const textContent = inlineEditableRef.current.innerText || inlineEditableRef.current.textContent || '';
        if (textContent.trim() === 'Digite seu texto aqui') {
          const range = document.createRange();
          range.selectNodeContents(inlineEditableRef.current);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
  }, [editingText]);
  const [isHoveringBlock, setIsHoveringBlock] = useState(false);
  const [isHoveringCrown, setIsHoveringCrown] = useState(false);
  const [isHoveringFocus, setIsHoveringFocus] = useState(false);
  const [crownDrag, setCrownDrag] = useState<CrownDragState | null>(null);
  const [focusDrag, setFocusDrag] = useState<FocusDragState | null>(null);
  const [liveLensDrag, setLiveLensDrag] = useState<{ id: string; x: number; y: number } | null>(
    null
  );
  const [cropRect, setCropRect] = useState<CropBox | null>(null);
  const [liveAnchorPoints, setLiveAnchorPoints] = useState<number[] | null>(null);
  const [draggingAnchor, setDraggingAnchor] = useState<{ id: string; index: 0 | 1 | 2 } | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<0 | 1 | 2 | null>(null);
  const [isDraggingArrowBody, setIsDraggingArrowBody] = useState(false);
  const [liveTwoPointPoints, setLiveTwoPointPoints] = useState<number[] | null>(null);
  const [draggingTwoPointAnchor, setDraggingTwoPointAnchor] = useState<{ id: string; index: 0 | 1 } | null>(null);
  const [hoveredTwoPointAnchor, setHoveredTwoPointAnchor] = useState<0 | 1 | null>(null);
  const [isDraggingTwoPointBody, setIsDraggingTwoPointBody] = useState(false);
  const [liveFourCornerUpdate, setLiveFourCornerUpdate] = useState<Partial<Annotation> | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<0 | 1 | 2 | 3 | null>(null);
  const [hoveredCorner, setHoveredCorner] = useState<0 | 1 | 2 | 3 | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isHoveringRotater, setIsHoveringRotater] = useState(false);
  const [liveRotation, setLiveRotation] = useState<number | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const crownDragRef = useRef<CrownDragState | null>(null);
  const focusDragRef = useRef<FocusDragState | null>(null);
  const onUpdateAnnotationRef = useRef(onUpdateAnnotation);
  const isShiftPressedRef = useRef(false);
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

  const hasSelectedText = useMemo(
    () =>
      effectiveSelectedIds.some(
        (id) => annotations.find((a) => a.id === id)?.type === 'text'
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
    img.onload = () => {
      setBgImage(img);
      if (containerRef.current) {
        const vw = containerRef.current.clientWidth;
        const vh = containerRef.current.clientHeight;
        const scale = calculateFitToScreenScale(img.width, img.height, vw, vh, 24);
        onFitScaleCalculated?.(scale);
      }
    };
  }, [imageBase64, onFitScaleCalculated]);

  // Listener para Ctrl + Roda do mouse e gesto de pinça (pinch) do trackpad com passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0 && onZoomIn) {
          onZoomIn();
        } else if (e.deltaY > 0 && onZoomOut) {
          onZoomOut();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [onZoomIn, onZoomOut]);

  // Inicializa o quadro de corte ao entrar na ferramenta de recorte (crop)
  useEffect(() => {
    if (activeTool === 'crop' || isCropping) {
      if (!cropRect && bgImage) {
        const initCrop: CropBox = {
          x: Math.round(bgImage.width * 0.05),
          y: Math.round(bgImage.height * 0.05),
          width: Math.round(bgImage.width * 0.9),
          height: Math.round(bgImage.height * 0.9),
        };
        setCropRect(initCrop);
        onCropRectChange?.(initCrop);
      }
    } else if (cropRect) {
      setCropRect(null);
    }
  }, [activeTool, isCropping, bgImage, cropRect, onCropRectChange]);

  // Sempre que o usuário alternar entre ferramentas (Formas, Texto, Seta, Lupa) ou trocar de imagem,
  // limpa o estado de hover para nunca travar a imagem inteira como se fosse um bloco.
  useEffect(() => {
    setIsHoveringBlock(false);
    setIsHoveringCrown(false);
    setIsHoveringFocus(false);
    setIsDrawing(false);
    setNewAnnotation(null);
    setMarqueeBox(null);
    setLiveAnchorPoints(null);
    setDraggingAnchor(null);
    setHoveredAnchor(null);
    setIsDraggingArrowBody(false);
    setLiveTwoPointPoints(null);
    setDraggingTwoPointAnchor(null);
    setHoveredTwoPointAnchor(null);
    setIsDraggingTwoPointBody(false);
    setHoveredCorner(null);
    setIsHoveringRotater(false);
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

  // Tecla ESC para desselecionar e rastreamento da tecla Shift para snapping de precisão
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = true;
      }
      if (e.key === 'Escape') {
        if (isEditingTextElement(e.target)) {
          return;
        }
        applySelectionIds([]);
        if (editingText) {
          setEditingText(null);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = false;
      }
    };
    const handleBlur = () => {
      isShiftPressedRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [editingText]);

  // Atualiza a seleção simples ou múltipla no Transformer do Konva (ou acopla ao quadro de recorte)
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (activeTool === 'crop' || isCropping) {
      const cropNode = stageRef.current.findOne('#crop-box-rect');
      if (cropNode) {
        transformerRef.current.nodes([cropNode]);
        transformerRef.current.forceUpdate();
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    if (effectiveSelectedIds.length > 0 && !isLocked) {
      const nodes: Konva.Node[] = [];
      for (const id of effectiveSelectedIds) {
        const ann = annotations.find((a) => a.id === id);
        if (ann && shouldAttachTransformer(ann.type, ann.type === 'arrow' ? ann.arrowStyle : undefined)) {
          const found = stageRef.current.findOne(`#${id}`);
          if (found) {
            nodes.push(found);
          }
        }
      }
      transformerRef.current.nodes(nodes);
      transformerRef.current.forceUpdate();
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [effectiveSelectedIds, annotations, isLocked, stageRef, activeTool, isCropping, cropRect]);

  const currentRotation =
    effectiveSelectedIds.length === 1
      ? annotations.find((a) => a.id === effectiveSelectedIds[0])?.rotation ?? 0
      : 0;
  const activeRotation = liveRotation !== null ? liveRotation : currentRotation;

  // Resolve o estilo do cursor dinamicamente conforme hover em blocos, alça de foco ou coroa da lupa
  const pointerBehavior = resolveCanvasPointerBehavior(activeTool, isHoveringBlock, isLocked);
  const currentCursor =
    isRotating
      ? 'grabbing'
      : isHoveringRotater
        ? 'grab'
        : draggingCorner !== null
          ? getCornerCursor(draggingCorner, activeRotation)
          : hoveredCorner !== null
            ? getCornerCursor(hoveredCorner, activeRotation)
            : draggingTwoPointAnchor || hoveredTwoPointAnchor !== null
              ? 'crosshair'
              : draggingAnchor
                ? draggingAnchor.index === 1
                  ? 'grabbing'
                  : 'crosshair'
                : hoveredAnchor !== null
                  ? hoveredAnchor === 1
                    ? 'grab'
                    : 'crosshair'
                  : crownDrag || isHoveringCrown
                    ? 'ew-resize'
                    : focusDrag
                      ? 'grabbing'
                      : isHoveringFocus
                        ? 'grab'
                        : isHoveringBlock && !isLocked
                          ? 'move'
                          : pointerBehavior.cursor;

  // Garante que o cursor do contêiner interno do Konva esteja sempre sincronizado com o cursor atual
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      const container = stage.container();
      if (container) {
        container.style.cursor = currentCursor;
      }
    }
  }, [currentCursor, stageRef]);

  const handleBlockMouseEnter = () => {
    if (!isLocked) {
      setIsHoveringBlock(true);
      const stage = stageRef.current;
      if (stage && hoveredCorner === null && !isHoveringRotater) {
        stage.container().style.cursor = 'move';
      }
    }
  };

  const handleBlockMouseLeave = () => {
    setIsHoveringBlock(false);
    const stage = stageRef.current;
    if (stage) {
      stage.container().style.cursor = isLocked ? 'default' : resolveCanvasPointerBehavior(activeTool, false, isLocked).cursor;
    }
  };

  // Clique em um bloco: suporta Shift+Clique para adicionar/remover da multiseleção e apresenta cursor 'move'
  const handleBlockClick = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (stage && !isLocked && hoveredCorner === null && !isHoveringRotater) {
      stage.container().style.cursor = 'move';
    }
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
    const stage = stageRef.current;
    if (stage && !isLocked) {
      stage.container().style.cursor = 'move';
    }
    let activeIds = effectiveSelectedIds;
    if (!activeIds.includes(id)) {
      activeIds = [id];
      applySelectionIds([id]);
    }

    const ann = annotations.find((a) => a.id === id);
    if (ann?.type === 'arrow' && ann.arrowStyle === 'curved') {
      setIsDraggingArrowBody(true);
    } else if (ann?.type === 'line' || (ann?.type === 'arrow' && ann.arrowStyle !== 'curved')) {
      setIsDraggingTwoPointBody(true);
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

    if (draggedAnn?.type === 'rect' || (draggedAnn?.type === 'redaction' && draggedAnn.mode === 'rect')) {
      const dW = (draggedAnn as any).width || 0;
      const dH = (draggedAnn as any).height || 0;
      setLiveFourCornerUpdate({
        x: draggedNode.x() - dW / 2,
        y: draggedNode.y() - dH / 2,
      });
    } else if (draggedAnn?.type === 'ellipse') {
      setLiveFourCornerUpdate({
        x: draggedNode.x(),
        y: draggedNode.y(),
      });
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
        const rawNextX = initPos.x + dx;
        const rawNextY = initPos.y + dy;
        const otherAnn = annotations.find((a) => a.id === otherId);
        let nextX = rawNextX;
        let nextY = rawNextY;
        if (otherAnn) {
          const clamped = clampAnnotationPositionToBounds(
            otherAnn,
            rawNextX,
            rawNextY,
            canvasWidth,
            canvasHeight,
            otherNode.width?.(),
            otherNode.height?.()
          );
          nextX = clamped.x;
          nextY = clamped.y;
        }
        otherNode.position({ x: nextX, y: nextY });

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
    setIsDraggingArrowBody(false);
    setIsDraggingTwoPointBody(false);
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
          } else if (ann.type === 'arrow' || ann.type === 'line' || (ann.type === 'redaction' && ann.mode === 'brush')) {
            const clamped = clampAnnotationPositionToBounds(
              ann,
              node.x(),
              node.y(),
              imgW,
              imgH,
              node.width?.(),
              node.height?.()
            );
            const ox = ann.x || 0;
            const oy = ann.y || 0;
            const dx = clamped.x - ox;
            const dy = clamped.y - oy;
            const annPts = ann.points || [];
            const bakedPoints = annPts.map((p, idx) => (idx % 2 === 0 ? p + dx : p + dy));
            node.position({ x: 0, y: 0 });
            updatesById[selId] = { x: 0, y: 0, points: bakedPoints };
          } else if (ann.type === 'rect' || (ann.type === 'redaction' && ann.mode === 'rect')) {
            const annW = (ann as any).width || 0;
            const annH = (ann as any).height || 0;
            const rawLeft = node.x() - annW / 2;
            const rawTop = node.y() - annH / 2;
            const clamped = clampRectToBounds(
              rawLeft,
              rawTop,
              annW,
              annH,
              imgW,
              imgH,
              1,
              1,
              ann.rotation ?? 0
            );
            node.position({ x: clamped.x + annW / 2, y: clamped.y + annH / 2 });
            updatesById[selId] = { x: clamped.x, y: clamped.y };
          } else if (ann.type === 'ellipse') {
            const clamped = clampEllipseToBounds(
              node.x(),
              node.y(),
              ann.radiusX,
              ann.radiusY,
              imgW,
              imgH,
              1,
              1,
              ann.rotation ?? 0
            );
            node.position({ x: clamped.x, y: clamped.y });
            updatesById[selId] = { x: clamped.x, y: clamped.y };
          } else {
            const clamped = clampAnnotationPositionToBounds(
              ann,
              node.x(),
              node.y(),
              imgW,
              imgH,
              node.width?.(),
              node.height?.()
            );
            node.position({ x: clamped.x, y: clamped.y });
            updatesById[selId] = { x: clamped.x, y: clamped.y };
          }
        }
      }
      multiDragStartRef.current = null;
      setLiveFourCornerUpdate(null);
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

    if (draggedAnn?.type === 'arrow' || draggedAnn?.type === 'line') {
      const clamped = clampAnnotationPositionToBounds(
        draggedAnn,
        e.currentTarget.x(),
        e.currentTarget.y(),
        imgW,
        imgH,
        e.currentTarget.width?.(),
        e.currentTarget.height?.()
      );
      const ox = draggedAnn.x || 0;
      const oy = draggedAnn.y || 0;
      const dx = clamped.x - ox;
      const dy = clamped.y - oy;
      const bakedPoints = draggedAnn.points.map((p, idx) => (idx % 2 === 0 ? p + dx : p + dy));
      e.currentTarget.position({ x: 0, y: 0 });
      onUpdateAnnotation(id, {
        x: 0,
        y: 0,
        points: bakedPoints,
      });
      return;
    }

    if (draggedAnn) {
      if (draggedAnn.type === 'rect' || (draggedAnn.type === 'redaction' && draggedAnn.mode === 'rect')) {
        const dW = (draggedAnn as any).width || 0;
        const dH = (draggedAnn as any).height || 0;
        const rawLeft = e.currentTarget.x() - dW / 2;
        const rawTop = e.currentTarget.y() - dH / 2;
        const clamped = clampRectToBounds(
          rawLeft,
          rawTop,
          dW,
          dH,
          imgW,
          imgH,
          1,
          1,
          draggedAnn.rotation ?? 0
        );
        e.currentTarget.position({ x: clamped.x + dW / 2, y: clamped.y + dH / 2 });
        onUpdateAnnotation(id, {
          x: clamped.x,
          y: clamped.y,
        });
        setLiveFourCornerUpdate(null);
        return;
      }
      if (draggedAnn.type === 'ellipse') {
        const clamped = clampEllipseToBounds(
          e.currentTarget.x(),
          e.currentTarget.y(),
          draggedAnn.radiusX,
          draggedAnn.radiusY,
          imgW,
          imgH,
          1,
          1,
          draggedAnn.rotation ?? 0
        );
        e.currentTarget.position({ x: clamped.x, y: clamped.y });
        onUpdateAnnotation(id, {
          x: clamped.x,
          y: clamped.y,
        });
        setLiveFourCornerUpdate(null);
        return;
      }
      const clamped = clampAnnotationPositionToBounds(
        draggedAnn,
        e.currentTarget.x(),
        e.currentTarget.y(),
        imgW,
        imgH,
        e.currentTarget.width?.(),
        e.currentTarget.height?.()
      );
      e.currentTarget.position({ x: clamped.x, y: clamped.y });
      onUpdateAnnotation(id, {
        x: clamped.x,
        y: clamped.y,
      });
      setLiveFourCornerUpdate(null);
    } else {
      onUpdateAnnotation(id, {
        x: Math.max(0, Math.min(e.currentTarget.x(), imgW)),
        y: Math.max(0, Math.min(e.currentTarget.y(), imgH)),
      });
      setLiveFourCornerUpdate(null);
    }
  };

  // Mantém a ampliação da lente íntegra em tempo real enquanto o usuário redimensiona a lupa ou o quadro de recorte
  const handleTransform = () => {
    if (!transformerRef.current) return;
    const nodes = transformerRef.current.nodes();
    for (const node of nodes) {
      if (node.id() === 'crop-box-rect') {
        const sx = node.scaleX() || 1;
        const sy = node.scaleY() || 1;
        const nextX = Math.round(node.x());
        const nextY = Math.round(node.y());
        const nextW = Math.max(20, Math.round(node.width() * sx));
        const nextH = Math.max(20, Math.round(node.height() * sy));
        node.scaleX(1);
        node.scaleY(1);
        node.width(nextW);
        node.height(nextH);
        const updatedCrop: CropBox = { x: nextX, y: nextY, width: nextW, height: nextH };
        setCropRect(updatedCrop);
        onCropRectChange?.(updatedCrop);
        return;
      }
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
      } else if (ann?.type === 'text') {
        const rawScale = Math.max(Math.abs(node.scaleX() || 1), Math.abs(node.scaleY() || 1));
        const nextFontSize = calculateResizedFontSize(ann.fontSize, rawScale);
        const steppedScale = nextFontSize / ann.fontSize;
        node.scaleX(steppedScale);
        node.scaleY(steppedScale);
      } else if (ann?.type === 'arrow') {
        const baseStroke = ann.strokeWidth || (ann.arrowStyle === 'thin' ? 2 : 4);
        const rawScale = Math.max(Math.abs(node.scaleX() || 1), Math.abs(node.scaleY() || 1));
        const nextStroke = calculateResizedArrowStroke(baseStroke, rawScale);
        const steppedScale = nextStroke / baseStroke;
        node.scaleX(steppedScale * (node.scaleX() < 0 ? -1 : 1));
        node.scaleY(steppedScale * (node.scaleY() < 0 ? -1 : 1));
      } else if (ann) {
        // Para qualquer outra forma (rect, ellipse, arrow, line, image):
        // Garante escala uniforme em tempo real (scaleX === scaleY) sem qualquer distorção
        const sx = Math.abs(node.scaleX() || 1);
        const sy = Math.abs(node.scaleY() || 1);
        const maxScale = Math.max(sx, sy);
        node.scaleX(maxScale * (node.scaleX() < 0 ? -1 : 1));
        node.scaleY(maxScale * (node.scaleY() < 0 ? -1 : 1));
      }
    }
  };

  // Salva redimensionamento / rotação feito pelo Transformer (simples, multiseleção, lupa ou quadro de recorte)
  const handleTransformEnd = () => {
    if (!transformerRef.current) return;
    const nodes = transformerRef.current.nodes();
    if (nodes.length === 0) return;

    if (nodes[0]?.id() === 'crop-box-rect') {
      const node = nodes[0] as Konva.Rect;
      const sx = node.scaleX() || 1;
      const sy = node.scaleY() || 1;
      const nextX = Math.round(node.x());
      const nextY = Math.round(node.y());
      const nextW = Math.max(20, Math.round(node.width() * sx));
      const nextH = Math.max(20, Math.round(node.height() * sy));
      node.scaleX(1);
      node.scaleY(1);
      node.width(nextW);
      node.height(nextH);
      const imgW = bgImage ? bgImage.width : 800;
      const imgH = bgImage ? bgImage.height : 600;
      const clamped = calculateCropBounds(
        { x: nextX, y: nextY, width: nextW, height: nextH },
        imgW,
        imgH
      );
      node.position({ x: clamped.x, y: clamped.y });
      node.width(clamped.width);
      node.height(clamped.height);
      setCropRect(clamped);
      onCropRectChange?.(clamped);
      transformerRef.current.forceUpdate();
      return;
    }

    const imgW = bgImage ? bgImage.width : 800;
    const imgH = bgImage ? bgImage.height : 600;

    const computeNodeTransformUpdate = (node: Konva.Node): Partial<Annotation> => {
      const ann = annotations.find((a) => a.id === node.id());
      if (ann?.type === 'text') {
        node.scaleX(1);
        node.scaleY(1);
        return {
          x: node.x(),
          y: node.y(),
          scaleX: 1,
          scaleY: 1,
          rotation: node.rotation(),
        };
      }
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

      if (ann?.type === 'rect' || (ann?.type === 'redaction' && ann.mode === 'rect')) {
        const annW = (ann as any).width || 0;
        const annH = (ann as any).height || 0;
        const sx = Math.abs(node.scaleX() || 1);
        const sy = Math.abs(node.scaleY() || 1);
        const nextW = Math.max(10, Math.round(annW * sx));
        const nextH = Math.max(10, Math.round(annH * sy));
        node.scaleX(1);
        node.scaleY(1);
        if (typeof (node as any).width === 'function') {
          (node as any).width(nextW);
          (node as any).height(nextH);
        }
        const clamped = clampRectToBounds(node.x(), node.y(), nextW, nextH, imgW, imgH, 1, 1, node.rotation());
        node.position({ x: clamped.x, y: clamped.y });
        return {
          x: clamped.x,
          y: clamped.y,
          width: nextW,
          height: nextH,
          scaleX: 1,
          scaleY: 1,
          rotation: node.rotation(),
        };
      }

      if (ann?.type === 'ellipse') {
        const sx = Math.abs(node.scaleX() || 1);
        const sy = Math.abs(node.scaleY() || 1);
        const nextRx = Math.max(5, Math.round(ann.radiusX * sx));
        const nextRy = Math.max(5, Math.round(ann.radiusY * sy));
        node.scaleX(1);
        node.scaleY(1);
        (node as Konva.Ellipse).radiusX(nextRx);
        (node as Konva.Ellipse).radiusY(nextRy);
        const clamped = clampEllipseToBounds(node.x(), node.y(), nextRx, nextRy, imgW, imgH, 1, 1, node.rotation());
        node.position({ x: clamped.x, y: clamped.y });
        return {
          x: clamped.x,
          y: clamped.y,
          radiusX: nextRx,
          radiusY: nextRy,
          scaleX: 1,
          scaleY: 1,
          rotation: node.rotation(),
        };
      }

      if (ann?.type === 'arrow') {
        const baseStroke = ann.strokeWidth || (ann.arrowStyle === 'thin' ? 2 : 4);
        const rawScale = Math.max(Math.abs(node.scaleX() || 1), Math.abs(node.scaleY() || 1));
        const nextStroke = calculateResizedArrowStroke(baseStroke, rawScale);
        const steppedScale = (nextStroke / baseStroke) * ((node.scaleX() || 1) < 0 ? -1 : 1);
        const nextPoints = ann.points.map((p) => Math.round(p * steppedScale));
        node.scaleX(1);
        node.scaleY(1);
        if (typeof (node as any).points === 'function') {
          (node as any).points(nextPoints);
        }
        if (typeof (node as any).strokeWidth === 'function') {
          (node as any).strokeWidth(nextStroke);
        }
        const clamped = clampLinePointsToBounds(node.x(), node.y(), nextPoints, imgW, imgH, 1, 1, node.rotation());
        node.position({ x: clamped.x, y: clamped.y });
        return {
          x: clamped.x,
          y: clamped.y,
          points: nextPoints,
          strokeWidth: nextStroke,
          scaleX: 1,
          scaleY: 1,
          rotation: node.rotation(),
        };
      }

      if (ann?.type === 'line') {
        const sx = node.scaleX() || 1;
        const sy = node.scaleY() || 1;
        const uniformScale = Math.max(Math.abs(sx), Math.abs(sy)) * (sx < 0 ? -1 : 1);
        const nextPoints = ann.points.map((p) => Math.round(p * uniformScale));
        node.scaleX(1);
        node.scaleY(1);
        (node as Konva.Line).points(nextPoints);
        const clamped = clampLinePointsToBounds(node.x(), node.y(), nextPoints, imgW, imgH, 1, 1, node.rotation());
        node.position({ x: clamped.x, y: clamped.y });
        return {
          x: clamped.x,
          y: clamped.y,
          points: nextPoints,
          scaleX: 1,
          scaleY: 1,
          rotation: node.rotation(),
        };
      }

      if (ann?.type === 'image') {
        const sx = Math.abs(node.scaleX() || 1);
        const sy = Math.abs(node.scaleY() || 1);
        const scale = Math.max(sx, sy);
        const nextW = Math.max(10, Math.round(ann.width * scale));
        const nextH = Math.max(10, Math.round(ann.height * scale));
        node.scaleX(1);
        node.scaleY(1);
        node.width(nextW);
        node.height(nextH);
        const clamped = clampRectToBounds(node.x(), node.y(), nextW, nextH, imgW, imgH, 1, 1, node.rotation());
        node.position({ x: clamped.x, y: clamped.y });
        return {
          x: clamped.x,
          y: clamped.y,
          width: nextW,
          height: nextH,
          scaleX: 1,
          scaleY: 1,
          rotation: node.rotation(),
        };
      }

      if (ann) {
        const clamped = clampAnnotationPositionToBounds(
          ann,
          node.x(),
          node.y(),
          imgW,
          imgH,
          node.width?.(),
          node.height?.()
        );
        node.position({ x: clamped.x, y: clamped.y });
        return {
          x: clamped.x,
          y: clamped.y,
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
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
      const updates = computeNodeTransformUpdate(node);
      transformerRef.current.forceUpdate();
      onUpdateAnnotation(node.id(), updates);
      return;
    }

    if (onUpdateAnnotations) {
      const updatesById: Record<string, Partial<Annotation>> = {};
      for (const node of nodes) {
        updatesById[node.id()] = computeNodeTransformUpdate(node);
      }
      transformerRef.current.forceUpdate();
      onUpdateAnnotations(updatesById);
    }
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'crop' || isCropping) {
      return;
    }

    const targetName = e.target.name();
    if (
      targetName === 'magnifier-crown' ||
      targetName === 'magnifier-focus' ||
      targetName?.startsWith('corner-anchor-') ||
      targetName?.startsWith('two-point-anchor-') ||
      targetName === 'four-corner-rotater'
    ) {
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
    const rawPos = stage?.getPointerPosition();
    const pos = rawPos ? getTransformedPointerPosition(rawPos, zoomLevel) : null;
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
    const imgW = bgImage ? bgImage.width : 800;
    const imgH = bgImage ? bgImage.height : 600;
    const clampedStartX = Math.max(0, Math.min(pos.x, imgW));
    const clampedStartY = Math.max(0, Math.min(pos.y, imgH));

    if (activeTool === 'text') {
      const initialText = 'Digite seu texto aqui';
      const textX = Math.max(0, Math.min(pos.x, imgW - 150));
      const textY = Math.max(0, Math.min(pos.y, imgH - 30));
      const textAnn: Annotation = {
        id,
        type: 'text',
        x: textX,
        y: textY,
        text: initialText,
        fontSize,
        fontFamily,
        fill: strokeColor,
        isBold,
        isItalic,
        isUnderline,
        isStrikethrough,
        textAlign,
        hasBackground,
      };
      onAddAnnotation(textAnn);
      applySelectionIds([id]);
      setEditingText({
        id,
        x: textX,
        y: textY,
        text: initialText,
        fontSize,
        fontFamily,
        fill: strokeColor,
        isBold,
        isItalic,
        isUnderline,
        isStrikethrough,
        textAlign,
        hasBackground,
      });
      return;
    }

    if (activeTool === 'magnifier') {
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
        x: clampedStartX,
        y: clampedStartY,
        width: 1,
        height: 1,
        stroke: strokeColor,
        strokeWidth,
      });
    } else if (activeTool === 'ellipse') {
      setNewAnnotation({
        id,
        type: 'ellipse',
        x: clampedStartX,
        y: clampedStartY,
        radiusX: 1,
        radiusY: 1,
        stroke: strokeColor,
        strokeWidth,
      });
    } else if (activeTool === 'line') {
      setNewAnnotation({
        id,
        type: 'line',
        x: 0,
        y: 0,
        points: [clampedStartX, clampedStartY, clampedStartX, clampedStartY],
        stroke: strokeColor,
        strokeWidth,
      });
    } else if (activeTool === 'redaction') {
      const activeLevel = redactionLevel ?? (redactionEffect === 'blur' ? 3 : 4);
      if (redactionMode === 'brush') {
        setNewAnnotation(
          createRedactionBrush(
            [clampedStartX, clampedStartY],
            activeLevel,
            strokeWidth ? strokeWidth * 4 : 24,
            id
          )
        );
      } else if (redactionMode === 'smart-text') {
        setNewAnnotation({
          id,
          type: 'redaction',
          mode: 'smart-text',
          x: clampedStartX,
          y: clampedStartY,
          width: 1,
          height: 1,
        });
      } else {
        setNewAnnotation(
          createRedactionRect(clampedStartX, clampedStartY, 1, 1, activeLevel, id)
        );
      }
    } else if (activeTool === 'arrow') {
      const initialStroke = arrowStyle === 'thin' ? 2 : strokeWidth || 4;
      const initialPoints =
        arrowStyle === 'curved'
          ? [clampedStartX, clampedStartY, clampedStartX, clampedStartY, clampedStartX, clampedStartY]
          : [clampedStartX, clampedStartY, clampedStartX, clampedStartY];

      setNewAnnotation({
        id,
        type: 'arrow',
        x: 0,
        y: 0,
        points: initialPoints,
        stroke: strokeColor,
        strokeWidth: initialStroke,
        arrowStyle,
        curveDirection: arrowCurveDirection,
      });
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const targetName = e.target.name();
    const isStageTarget = e.target === e.target.getStage();

    const stage = e.target.getStage();
    const rawPos = stage?.getPointerPosition();
    const pos = rawPos ? getTransformedPointerPosition(rawPos, zoomLevel) : null;

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

    const imgW = bgImage ? bgImage.width : 800;
    const imgH = bgImage ? bgImage.height : 600;
    const clampedDrawingX = Math.max(0, Math.min(pos.x, imgW));
    const clampedDrawingY = Math.max(0, Math.min(pos.y, imgH));
    const isShift = e.evt?.shiftKey ?? false;

    if (newAnnotation.type === 'rect') {
      if (isShift) {
        const sq = snapRectWithShift(newAnnotation.x, newAnnotation.y, clampedDrawingX, clampedDrawingY);
        setNewAnnotation({ ...newAnnotation, width: sq.width, height: sq.height });
      } else {
        const width = clampedDrawingX - newAnnotation.x;
        const height = clampedDrawingY - newAnnotation.y;
        setNewAnnotation({ ...newAnnotation, width, height });
      }
    } else if (newAnnotation.type === 'ellipse') {
      const radiusX = Math.abs(clampedDrawingX - newAnnotation.x);
      const radiusY = Math.abs(clampedDrawingY - newAnnotation.y);
      setNewAnnotation({ ...newAnnotation, radiusX, radiusY });
    } else if (newAnnotation.type === 'line') {
      const p1 = newAnnotation.points;
      const targetPt = isShift
        ? snapLinePointsWithShift(p1[0], p1[1], clampedDrawingX, clampedDrawingY)
        : { x: clampedDrawingX, y: clampedDrawingY };
      setNewAnnotation({ ...newAnnotation, points: [p1[0], p1[1], targetPt.x, targetPt.y] });
    } else if (newAnnotation.type === 'arrow') {
      const p1 = newAnnotation.points;
      const startX = p1[0];
      const startY = p1[1];
      if (newAnnotation.arrowStyle === 'curved') {
        const curvedPoints = calculateCurvedArrowPoints(
          startX,
          startY,
          clampedDrawingX,
          clampedDrawingY,
          newAnnotation.curveDirection || arrowCurveDirection || 'right'
        );
        setNewAnnotation({ ...newAnnotation, points: curvedPoints });
      } else {
        const targetPt = isShift
          ? snapLinePointsWithShift(startX, startY, clampedDrawingX, clampedDrawingY)
          : { x: clampedDrawingX, y: clampedDrawingY };
        setNewAnnotation({ ...newAnnotation, points: [startX, startY, targetPt.x, targetPt.y] });
      }
    } else if (newAnnotation.type === 'redaction') {
      if (newAnnotation.mode === 'brush') {
        const prevPoints = newAnnotation.points || [];
        setNewAnnotation({ ...newAnnotation, points: [...prevPoints, clampedDrawingX, clampedDrawingY] });
      } else {
        if (isShift) {
          const sq = snapRectWithShift(newAnnotation.x || 0, newAnnotation.y || 0, clampedDrawingX, clampedDrawingY);
          setNewAnnotation({ ...newAnnotation, width: sq.width, height: sq.height });
        } else {
          const width = clampedDrawingX - (newAnnotation.x ?? 0);
          const height = clampedDrawingY - (newAnnotation.y ?? 0);
          setNewAnnotation({ ...newAnnotation, width, height });
        }
      }
    } else if (newAnnotation.type === 'magnifier') {
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

    const imgW = bgImage ? bgImage.width : 800;
    const imgH = bgImage ? bgImage.height : 600;

    if (newAnnotation.type === 'redaction') {
      if (newAnnotation.mode === 'rect') {
        if (Math.abs(newAnnotation.width || 0) > 4 && Math.abs(newAnnotation.height || 0) > 4) {
          const clamped = clampRedactionRectToBounds(
            newAnnotation.x || 0,
            newAnnotation.y || 0,
            newAnnotation.width || 0,
            newAnnotation.height || 0,
            imgW,
            imgH
          );
          onAddAnnotation({
            ...newAnnotation,
            x: clamped.x,
            y: clamped.y,
            width: clamped.width,
            height: clamped.height,
          });
          applySelectionIds([newAnnotation.id]);
        }
      } else if (newAnnotation.mode === 'smart-text') {
        if (Math.abs(newAnnotation.width || 0) > 4 && Math.abs(newAnnotation.height || 0) > 4) {
          const clamped = clampRedactionRectToBounds(
            newAnnotation.x || 0,
            newAnnotation.y || 0,
            newAnnotation.width || 0,
            newAnnotation.height || 0,
            imgW,
            imgH
          );
          const colors = sampleRegionColors(
            bgImage || { data: new Uint8ClampedArray(4), width: 1, height: 1 },
            clamped
          );
          const annId = newAnnotation.id;
          detectTextInImageRegion(imageBase64, clamped).then((ocrLines) => {
            if (!ocrLines || ocrLines.length === 0) return;
            const anonymizedLines = anonymizeOcrLines(ocrLines);
            onAddAnnotation({
              id: annId,
              type: 'redaction',
              mode: 'smart-text',
              x: clamped.x,
              y: clamped.y,
              width: clamped.width,
              height: clamped.height,
              bgColor: colors.bgColor,
              textColor: colors.textColor,
              lines: anonymizedLines,
            });
            applySelectionIds([annId]);
          });
        }
      } else if (newAnnotation.mode === 'brush') {
        if ((newAnnotation.points || []).length >= 4) {
          onAddAnnotation(newAnnotation);
          applySelectionIds([newAnnotation.id]);
        }
      }
      setNewAnnotation(null);
      return;
    }

    if (newAnnotation.type === 'rect' && Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
      const rawX = newAnnotation.width < 0 ? newAnnotation.x + newAnnotation.width : newAnnotation.x;
      const rawY = newAnnotation.height < 0 ? newAnnotation.y + newAnnotation.height : newAnnotation.y;
      const w = Math.abs(newAnnotation.width);
      const h = Math.abs(newAnnotation.height);
      const clamped = clampRectToBounds(rawX, rawY, w, h, imgW, imgH);
      onAddAnnotation({
        ...newAnnotation,
        x: clamped.x,
        y: clamped.y,
        width: Math.min(w, imgW - clamped.x),
        height: Math.min(h, imgH - clamped.y),
      });
      applySelectionIds([newAnnotation.id]);
    } else if (newAnnotation.type === 'ellipse' && newAnnotation.radiusX > 5 && newAnnotation.radiusY > 5) {
      const clamped = clampEllipseToBounds(newAnnotation.x, newAnnotation.y, newAnnotation.radiusX, newAnnotation.radiusY, imgW, imgH);
      onAddAnnotation({
        ...newAnnotation,
        x: clamped.x,
        y: clamped.y,
      });
      applySelectionIds([newAnnotation.id]);
    } else if (newAnnotation.type === 'line') {
      const [x1, y1, x2, y2] = newAnnotation.points;
      if (Math.hypot(x2 - x1, y2 - y1) > 3) {
        const clampedP = [
          Math.max(0, Math.min(x1, imgW)),
          Math.max(0, Math.min(y1, imgH)),
          Math.max(0, Math.min(x2, imgW)),
          Math.max(0, Math.min(y2, imgH)),
        ];
        onAddAnnotation({ ...newAnnotation, points: clampedP });
        applySelectionIds([newAnnotation.id]);
      }
    } else if (newAnnotation.type === 'arrow') {
      const p = newAnnotation.points;
      const startX = p[0];
      const startY = p[1];
      const endX = p[p.length - 2];
      const endY = p[p.length - 1];
      if (Math.hypot(endX - startX, endY - startY) > 3) {
        const clampedP = p.map((val, idx) =>
          Math.max(0, Math.min(val, idx % 2 === 0 ? imgW : imgH))
        );
        onAddAnnotation({ ...newAnnotation, points: clampedP });
        applySelectionIds([newAnnotation.id]);
      }
    } else if (newAnnotation.type === 'magnifier') {
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
  const visualWidth = Math.round(canvasWidth * zoomLevel);
  const visualHeight = Math.round(canvasHeight * zoomLevel);

  const selectedCurvedArrow = useMemo(() => {
    if (effectiveSelectedIds.length !== 1) return null;
    const ann = annotations.find((a) => a.id === effectiveSelectedIds[0]);
    if (ann && ann.type === 'arrow' && ann.arrowStyle === 'curved') {
      return ann;
    }
    return null;
  }, [effectiveSelectedIds, annotations]);

  const effectiveCurvedPoints = useMemo(() => {
    if (!selectedCurvedArrow) return null;
    if (liveAnchorPoints && draggingAnchor?.id === selectedCurvedArrow.id) {
      return liveAnchorPoints;
    }
    const rawPoints = selectedCurvedArrow.points;
    const ox = selectedCurvedArrow.x || 0;
    const oy = selectedCurvedArrow.y || 0;
    if (ox !== 0 || oy !== 0) {
      return rawPoints.map((p, idx) => (idx % 2 === 0 ? p + ox : p + oy));
    }
    return rawPoints;
  }, [selectedCurvedArrow, liveAnchorPoints, draggingAnchor]);

  const selectedTwoPointAnnotation = useMemo(() => {
    if (effectiveSelectedIds.length !== 1) return null;
    const ann = annotations.find((a) => a.id === effectiveSelectedIds[0]);
    if (!ann) return null;
    if (ann.type === 'line') return ann;
    if (ann.type === 'arrow' && ann.arrowStyle !== 'curved') return ann;
    return null;
  }, [effectiveSelectedIds, annotations]);

  const effectiveTwoPointPoints = useMemo(() => {
    if (!selectedTwoPointAnnotation) return null;
    if (liveTwoPointPoints && draggingTwoPointAnchor?.id === selectedTwoPointAnnotation.id) {
      return liveTwoPointPoints;
    }
    const rawPoints = selectedTwoPointAnnotation.points;
    const ox = selectedTwoPointAnnotation.x || 0;
    const oy = selectedTwoPointAnnotation.y || 0;
    if (ox !== 0 || oy !== 0) {
      return rawPoints.map((p, idx) => (idx % 2 === 0 ? p + ox : p + oy));
    }
    return rawPoints;
  }, [selectedTwoPointAnnotation, liveTwoPointPoints, draggingTwoPointAnchor]);

  const selectedFourCornerAnnotation = useMemo(() => {
    if (effectiveSelectedIds.length !== 1) return null;
    const ann = annotations.find((a) => a.id === effectiveSelectedIds[0]);
    if (ann && (ann.type === 'rect' || ann.type === 'ellipse' || (ann.type === 'redaction' && (ann.mode === 'rect' || ann.mode === 'smart-text')))) {
      return ann;
    }
    return null;
  }, [effectiveSelectedIds, annotations]);

  const effectiveFourCornerAnn = useMemo(() => {
    if (!selectedFourCornerAnnotation) return null;
    if (selectedFourCornerAnnotation.type === 'rect' || (selectedFourCornerAnnotation.type === 'redaction' && (selectedFourCornerAnnotation.mode === 'rect' || selectedFourCornerAnnotation.mode === 'smart-text'))) {
      const base = { ...selectedFourCornerAnnotation };
      if (liveFourCornerUpdate) {
        const update = liveFourCornerUpdate as Partial<RectAnnotation>;
        if (update.x !== undefined) base.x = update.x;
        if (update.y !== undefined) base.y = update.y;
        if (update.width !== undefined) base.width = update.width;
        if (update.height !== undefined) base.height = update.height;
      }
      if (liveRotation !== null) {
        base.rotation = liveRotation;
      }
      return base;
    }
    if (selectedFourCornerAnnotation.type === 'ellipse') {
      const base = { ...selectedFourCornerAnnotation };
      if (liveFourCornerUpdate) {
        const update = liveFourCornerUpdate as Partial<EllipseAnnotation>;
        if (update.x !== undefined) base.x = update.x;
        if (update.y !== undefined) base.y = update.y;
        if (update.radiusX !== undefined) base.radiusX = update.radiusX;
        if (update.radiusY !== undefined) base.radiusY = update.radiusY;
      }
      if (liveRotation !== null) {
        base.rotation = liveRotation;
      }
      return base;
    }
    return selectedFourCornerAnnotation;
  }, [selectedFourCornerAnnotation, liveFourCornerUpdate, liveRotation]);

  const fourCornerPositions = useMemo(() => {
    if (!effectiveFourCornerAnn) return null;
    return getFourCornerPositions(effectiveFourCornerAnn);
  }, [effectiveFourCornerAnn]);

  // Gerenciamento da rotação 360 graus da forma através da alça de rotação (estilo Windows Snipping Tool)
  useEffect(() => {
    if (!isRotating || !selectedFourCornerAnnotation) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rawPos = stage.getPointerPosition();
      if (!rawPos) return;
      const localPos = getTransformedPointerPosition(rawPos, zoomLevel);
      const rawRot = updateShapeRotation(selectedFourCornerAnnotation, localPos);
      const newRot = e.shiftKey ? snapAngleToStep(rawRot, 15) : rawRot;
      setLiveRotation(newRot);
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      const stage = stageRef.current;
      if (stage) {
        const rawPos = stage.getPointerPosition();
        if (rawPos) {
          const localPos = getTransformedPointerPosition(rawPos, zoomLevel);
          const rawRot = updateShapeRotation(selectedFourCornerAnnotation, localPos);
          const finalRot = e.shiftKey ? snapAngleToStep(rawRot, 15) : rawRot;
          if (finalRot !== (selectedFourCornerAnnotation.rotation ?? 0)) {
            const isRect4C =
              selectedFourCornerAnnotation.type === 'rect' ||
              (selectedFourCornerAnnotation.type === 'redaction' && (selectedFourCornerAnnotation as any).mode === 'rect');
            const clampedPos = isRect4C
              ? clampRectToBounds(
                  selectedFourCornerAnnotation.x || 0,
                  selectedFourCornerAnnotation.y || 0,
                  (selectedFourCornerAnnotation as any).width || 0,
                  (selectedFourCornerAnnotation as any).height || 0,
                  canvasWidth,
                  canvasHeight,
                  1,
                  1,
                  finalRot
                )
              : clampEllipseToBounds(
                  (selectedFourCornerAnnotation.x || 0),
                  (selectedFourCornerAnnotation.y || 0),
                  (selectedFourCornerAnnotation as EllipseAnnotation).radiusX,
                  (selectedFourCornerAnnotation as EllipseAnnotation).radiusY,
                  canvasWidth,
                  canvasHeight,
                  1,
                  1,
                  finalRot
                );
            onUpdateAnnotationRef.current(selectedFourCornerAnnotation.id, {
              rotation: finalRot,
              x: clampedPos.x,
              y: clampedPos.y,
            });
          }
        }
        stage.container().style.cursor = 'default';
      }
      setIsRotating(false);
      setLiveRotation(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isRotating, selectedFourCornerAnnotation, zoomLevel]);

  // Gerenciamento do redimensionamento pelos 4 cantos mantendo o canto oposto firmemente ancorado
  useEffect(() => {
    if (draggingCorner === null || !selectedFourCornerAnnotation) return;

    const handleWindowMouseMove = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const rawPos = stage.getPointerPosition();
      if (!rawPos) return;
      const localPos = getTransformedPointerPosition(rawPos, zoomLevel);
      const update = updateCornerResize(
        selectedFourCornerAnnotation,
        draggingCorner,
        localPos,
        canvasWidth,
        canvasHeight
      );
      setLiveFourCornerUpdate(update);
    };

    const handleWindowMouseUp = () => {
      const stage = stageRef.current;
      if (stage) {
        const rawPos = stage.getPointerPosition();
        if (rawPos) {
          const localPos = getTransformedPointerPosition(rawPos, zoomLevel);
          const update = updateCornerResize(
            selectedFourCornerAnnotation,
            draggingCorner,
            localPos,
            canvasWidth,
            canvasHeight
          );
          onUpdateAnnotationRef.current(selectedFourCornerAnnotation.id, update);
        }
        stage.container().style.cursor = 'default';
      }
      setDraggingCorner(null);
      setLiveFourCornerUpdate(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingCorner, selectedFourCornerAnnotation, canvasWidth, canvasHeight, zoomLevel]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#e5e5e7',
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          minWidth: '100%',
          minHeight: '100%',
          width: 'max-content',
          height: 'max-content',
          padding: '24px',
          boxSizing: 'border-box',
          display: 'flex',
        }}
      >
        <div
          style={{
            margin: 'auto',
            width: `${visualWidth}px`,
            height: `${visualHeight}px`,
            minWidth: `${visualWidth}px`,
            minHeight: `${visualHeight}px`,
            position: 'relative',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: currentCursor,
          }}
        >
        <Stage
          ref={stageRef as React.RefObject<Konva.Stage>}
          width={visualWidth}
          height={visualHeight}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
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
              const isManipulatingFourCorner = draggingCorner !== null || isRotating;
              const canDrag = !isLocked && !isManipulatingFourCorner && (!crownDrag || crownDrag.id !== ann.id);
              const strokeScaleEnabled = false;

              if (ann.type === 'rect') {
                const isSelected4C = selectedFourCornerAnnotation?.id === ann.id;
                const activeRect = isSelected4C && effectiveFourCornerAnn?.type === 'rect' ? effectiveFourCornerAnn : ann;
                const cx = activeRect.x + activeRect.width / 2;
                const cy = activeRect.y + activeRect.height / 2;
                return (
                  <Rect
                    key={ann.id}
                    id={ann.id}
                    x={cx}
                    y={cy}
                    offsetX={activeRect.width / 2}
                    offsetY={activeRect.height / 2}
                    width={activeRect.width}
                    height={activeRect.height}
                    scaleX={1}
                    scaleY={1}
                    rotation={activeRect.rotation ?? 0}
                    fill="rgba(0, 0, 0, 0.001)"
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    draggable={canDrag}
                    dragBoundFunc={(pos) =>
                      getTransformedDragBound(pos, zoomLevel, (localX, localY) => {
                        const rawLeft = localX - activeRect.width / 2;
                        const rawTop = localY - activeRect.height / 2;
                        const clamped = clampRectToBounds(
                          rawLeft,
                          rawTop,
                          activeRect.width,
                          activeRect.height,
                          canvasWidth,
                          canvasHeight,
                          1,
                          1,
                          activeRect.rotation ?? 0
                        );
                        return {
                          x: clamped.x + activeRect.width / 2,
                          y: clamped.y + activeRect.height / 2,
                        };
                      })
                    }
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
                const isSelected4C = selectedFourCornerAnnotation?.id === ann.id;
                const activeEllipse = isSelected4C && effectiveFourCornerAnn?.type === 'ellipse' ? effectiveFourCornerAnn : ann;
                return (
                  <Ellipse
                    key={ann.id}
                    id={ann.id}
                    x={activeEllipse.x}
                    y={activeEllipse.y}
                    radiusX={activeEllipse.radiusX}
                    radiusY={activeEllipse.radiusY}
                    scaleX={1}
                    scaleY={1}
                    rotation={activeEllipse.rotation ?? 0}
                    fill="rgba(0, 0, 0, 0.001)"
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    draggable={canDrag}
                    dragBoundFunc={(pos) =>
                      getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
                        clampEllipseToBounds(
                          localX,
                          localY,
                          activeEllipse.radiusX,
                          activeEllipse.radiusY,
                          canvasWidth,
                          canvasHeight,
                          1,
                          1,
                          activeEllipse.rotation ?? 0
                        )
                      )
                    }
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onClick={(e) => handleBlockClick(ann.id, e)}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (isLocked || isCropping) return;
                      applySelectionIds([ann.id]);
                      const circleUpdate = convertToPerfectCircle(ann, canvasWidth, canvasHeight);
                      onUpdateAnnotation(ann.id, circleUpdate);
                    }}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                  />
                );
              }

              if (ann.type === 'line') {
                const isLineSelected = selectedTwoPointAnnotation?.id === ann.id;
                const displayPoints = isLineSelected && liveTwoPointPoints ? liveTwoPointPoints : ann.points;
                const displayX = isLineSelected && liveTwoPointPoints ? 0 : (ann.x || 0);
                const displayY = isLineSelected && liveTwoPointPoints ? 0 : (ann.y || 0);

                return (
                  <Line
                    key={ann.id}
                    id={ann.id}
                    x={displayX}
                    y={displayY}
                    points={displayPoints}
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    stroke={ann.stroke}
                    strokeWidth={ann.strokeWidth}
                    strokeScaleEnabled={strokeScaleEnabled}
                    lineCap="round"
                    hitStrokeWidth={20}
                    draggable={canDrag && !draggingTwoPointAnchor}
                    dragBoundFunc={(pos) =>
                      getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
                        clampLinePointsToBounds(
                          localX,
                          localY,
                          displayPoints,
                          canvasWidth,
                          canvasHeight,
                          ann.scaleX ?? 1,
                          ann.scaleY ?? 1,
                          ann.rotation ?? 0
                        )
                      )
                    }
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
                const currentArrowStyle = ann.arrowStyle || 'standard';
                const headDims = getArrowHeadDimensions(ann.strokeWidth || 4, currentArrowStyle);
                const isDashed = currentArrowStyle === 'dashed';
                const isCurved = currentArrowStyle === 'curved';
                const isCurvedSelected = selectedCurvedArrow?.id === ann.id;
                const isStraightSelected = selectedTwoPointAnnotation?.id === ann.id;
                const displayPoints =
                  isCurvedSelected && liveAnchorPoints
                    ? liveAnchorPoints
                    : isStraightSelected && liveTwoPointPoints
                      ? liveTwoPointPoints
                      : ann.points;
                const displayX =
                  (isCurvedSelected && liveAnchorPoints) || (isStraightSelected && liveTwoPointPoints)
                    ? 0
                    : (ann.x || 0);
                const displayY =
                  (isCurvedSelected && liveAnchorPoints) || (isStraightSelected && liveTwoPointPoints)
                    ? 0
                    : (ann.y || 0);
                const effectiveStroke = ann.strokeWidth || (currentArrowStyle === 'thin' ? 2 : 4);

                if (currentArrowStyle === 'thin' && displayPoints.length >= 4) {
                  const chevronData = getOpenChevronArrowPoints(
                    displayPoints[0],
                    displayPoints[1],
                    displayPoints[2],
                    displayPoints[3],
                    effectiveStroke
                  );
                  return (
                    <Group
                      key={ann.id}
                      id={ann.id}
                      x={displayX}
                      y={displayY}
                      scaleX={ann.scaleX ?? 1}
                      scaleY={ann.scaleY ?? 1}
                      rotation={ann.rotation ?? 0}
                      draggable={canDrag && !draggingAnchor && !draggingTwoPointAnchor}
                      dragBoundFunc={(pos) =>
                        getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
                          clampLinePointsToBounds(
                            localX,
                            localY,
                            displayPoints,
                            canvasWidth,
                            canvasHeight,
                            ann.scaleX ?? 1,
                            ann.scaleY ?? 1,
                            ann.rotation ?? 0
                          )
                        )
                      }
                      onMouseEnter={handleBlockMouseEnter}
                      onMouseLeave={handleBlockMouseLeave}
                      onClick={(e) => handleBlockClick(ann.id, e)}
                      onDragStart={() => handleBlockDragStart(ann.id)}
                      onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                      onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                    >
                      <Line
                        points={chevronData.shaftPoints}
                        stroke={ann.stroke}
                        strokeWidth={effectiveStroke}
                        lineCap="round"
                        strokeScaleEnabled={strokeScaleEnabled}
                        hitStrokeWidth={20}
                      />
                      <Line
                        points={chevronData.chevronPoints}
                        stroke={ann.stroke}
                        strokeWidth={effectiveStroke}
                        lineCap="round"
                        lineJoin="round"
                        strokeScaleEnabled={strokeScaleEnabled}
                        hitStrokeWidth={20}
                      />
                    </Group>
                  );
                }

                return (
                  <Arrow
                    key={ann.id}
                    id={ann.id}
                    x={displayX}
                    y={displayY}
                    points={displayPoints}
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    stroke={ann.stroke}
                    strokeWidth={effectiveStroke}
                    dash={isDashed ? [6, 4] : undefined}
                    tension={isCurved ? 0.4 : 0}
                    strokeScaleEnabled={strokeScaleEnabled}
                    hitStrokeWidth={20}
                    fill={ann.stroke}
                    pointerLength={headDims.pointerLength}
                    pointerWidth={headDims.pointerWidth}
                    draggable={canDrag && !draggingAnchor && !draggingTwoPointAnchor}
                    dragBoundFunc={(pos) =>
                      getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
                        clampLinePointsToBounds(
                          localX,
                          localY,
                          displayPoints,
                          canvasWidth,
                          canvasHeight,
                          ann.scaleX ?? 1,
                          ann.scaleY ?? 1,
                          ann.rotation ?? 0
                        )
                      )
                    }
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
                const align = ann.textAlign || 'left';
                const padX = ann.hasBackground ? 8 : 0;
                const padY = ann.hasBackground ? 4 : 0;
                const hasSpans = Boolean(ann.spans && ann.spans.length > 0);

                let textChildren: React.ReactNode = null;
                let approxW = 30;
                let approxH = 30;

                if (hasSpans && ann.spans) {
                  const lines = splitSpansIntoLines(ann.spans);
                  const lineCalculations = lines.map((lineSpans) => {
                    let w = 0;
                    const measuredSpans = lineSpans.map((span) => {
                      const spanW = measureSpanWidth(
                        span.text,
                        ann.fontSize,
                        ann.fontFamily || 'Arial',
                        span.isBold ?? ann.isBold,
                        span.isItalic ?? ann.isItalic
                      );
                      const startX = w;
                      w += spanW;
                      return { ...span, spanW, startX };
                    });
                    return { spans: measuredSpans, lineWidth: w };
                  });

                  const maxLineWidth = Math.max(...lineCalculations.map((l) => l.lineWidth), 30);
                  approxW = maxLineWidth + padX * 2;
                  approxH = Math.max(lines.length, 1) * (ann.fontSize * 1.3) + padY * 2;

                  textChildren = lineCalculations.map((l, lineIdx) => {
                    const lineStartX =
                      align === 'center'
                        ? (maxLineWidth - l.lineWidth) / 2
                        : align === 'right'
                        ? maxLineWidth - l.lineWidth
                        : 0;

                    return l.spans.map((span, spanIdx) => (
                      <Text
                        key={`span-${lineIdx}-${spanIdx}`}
                        x={lineStartX + span.startX + padX}
                        y={lineIdx * (ann.fontSize * 1.3) + padY}
                        text={span.text}
                        fontSize={ann.fontSize}
                        fontFamily={ann.fontFamily || 'Arial'}
                        fontStyle={resolveKonvaFontStyle(span.isBold ?? ann.isBold, span.isItalic ?? ann.isItalic)}
                        textDecoration={resolveKonvaTextDecoration(
                          span.isUnderline ?? ann.isUnderline,
                          span.isStrikethrough ?? ann.isStrikethrough
                        )}
                        fill={ann.fill || '#000000'}
                      />
                    ));
                  });
                } else {
                  const fontStyle = resolveKonvaFontStyle(ann.isBold, ann.isItalic);
                  const textDecoration = resolveKonvaTextDecoration(ann.isUnderline, ann.isStrikethrough);
                  const textLines = (ann.text || '').split('\n');
                  const maxLen = Math.max(...textLines.map((l) => l.length), 1);
                  approxW = Math.max(30, maxLen * (ann.fontSize * 0.6) + padX * 2);
                  approxH = textLines.length * (ann.fontSize * 1.3) + padY * 2;

                  const textElement = (
                    <Text
                      id={ann.hasBackground ? undefined : ann.id}
                      x={padX}
                      y={padY}
                      text={ann.text}
                      fontSize={ann.fontSize}
                      fontFamily={ann.fontFamily || 'Arial'}
                      fontStyle={fontStyle}
                      textDecoration={textDecoration}
                      align={align}
                      fill={ann.fill || '#000000'}
                    />
                  );
                  textChildren = textElement;
                }

                if (ann.hasBackground || hasSpans) {
                  return (
                    <Group
                      key={ann.id}
                      id={ann.id}
                      x={ann.x}
                      y={ann.y}
                      scaleX={ann.scaleX ?? 1}
                      scaleY={ann.scaleY ?? 1}
                      rotation={ann.rotation ?? 0}
                      draggable={canDrag}
                      dragBoundFunc={(pos) =>
                        getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
                          clampRectToBounds(
                            localX,
                            localY,
                            approxW,
                            approxH,
                            canvasWidth,
                            canvasHeight,
                            ann.scaleX ?? 1,
                            ann.scaleY ?? 1,
                            ann.rotation ?? 0
                          )
                        )
                      }
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
                          isBold: ann.isBold,
                          isItalic: ann.isItalic,
                          isUnderline: ann.isUnderline,
                          isStrikethrough: ann.isStrikethrough,
                          textAlign: ann.textAlign,
                          hasBackground: ann.hasBackground,
                          spans: ann.spans,
                        });
                      }}
                    >
                      {ann.hasBackground && (
                        <Rect
                          width={approxW}
                          height={approxH}
                          fill={ann.backgroundColor || '#ffffff'}
                          opacity={0.92}
                          cornerRadius={4}
                          shadowColor="rgba(0, 0, 0, 0.16)"
                          shadowBlur={5}
                          shadowOffset={{ x: 0, y: 1 }}
                        />
                      )}
                      {textChildren}
                    </Group>
                  );
                }

                return (
                  <Text
                    key={ann.id}
                    id={ann.id}
                    x={ann.x}
                    y={ann.y}
                    text={ann.text}
                    fontSize={ann.fontSize}
                    fontFamily={ann.fontFamily || 'Arial'}
                    fontStyle={resolveKonvaFontStyle(ann.isBold, ann.isItalic)}
                    textDecoration={resolveKonvaTextDecoration(ann.isUnderline, ann.isStrikethrough)}
                    align={align}
                    fill={ann.fill || '#000000'}
                    scaleX={ann.scaleX ?? 1}
                    scaleY={ann.scaleY ?? 1}
                    rotation={ann.rotation ?? 0}
                    draggable={canDrag}
                    dragBoundFunc={(pos) => {
                      const textNode = stageRef.current?.findOne(`#${ann.id}`) as Konva.Text | undefined;
                      const w = textNode ? textNode.width() : 120;
                      const h = textNode ? textNode.height() : 30;
                      return getTransformedDragBound(pos, zoomLevel, (localX, localY) =>
                        clampRectToBounds(
                          localX,
                          localY,
                          w,
                          h,
                          canvasWidth,
                          canvasHeight,
                          ann.scaleX ?? 1,
                          ann.scaleY ?? 1,
                          ann.rotation ?? 0
                        )
                      );
                    }}
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
                        isBold: ann.isBold,
                        isItalic: ann.isItalic,
                        isUnderline: ann.isUnderline,
                        isStrikethrough: ann.isStrikethrough,
                        textAlign: ann.textAlign,
                        hasBackground: ann.hasBackground,
                        spans: ann.spans,
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
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    zoomLevel={zoomLevel}
                    onSelect={(e) => handleBlockClick(ann.id, e)}
                    onMouseEnter={handleBlockMouseEnter}
                    onMouseLeave={handleBlockMouseLeave}
                    onDragStart={() => handleBlockDragStart(ann.id)}
                    onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                    onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                  />
                );
              }

              if (ann.type === 'redaction') {
                if (ann.mode === 'smart-text') {
                  const isSelected4C = selectedFourCornerAnnotation?.id === ann.id;
                  const activeRect =
                    isSelected4C && effectiveFourCornerAnn && effectiveFourCornerAnn.type === 'redaction'
                      ? (effectiveFourCornerAnn as RedactionAnnotation)
                      : ann;
                  const w = activeRect.width || 0;
                  const h = activeRect.height || 0;
                  const cx = (activeRect.x || 0) + w / 2;
                  const cy = (activeRect.y || 0) + h / 2;
                  const smartWords = calculateSmartTextWordLayout(
                    ann.lines,
                    { x: activeRect.x || 0, y: activeRect.y || 0, width: w, height: h },
                    ann
                  );

                  const renderKey = `${ann.id}-${(ann.lines || [])
                    .map((l) => (l.words || []).map((w) => w.replacementText).join('-'))
                    .join('_')}`;

                  return (
                    <Group
                      key={renderKey}
                      id={ann.id}
                      x={cx}
                      y={cy}
                      offsetX={w / 2}
                      offsetY={h / 2}
                      width={w}
                      height={h}
                      rotation={activeRect.rotation ?? 0}
                      draggable={canDrag}
                      dragBoundFunc={(pos) =>
                        getTransformedDragBound(pos, zoomLevel, (localX, localY) => {
                          const rawLeft = localX - w / 2;
                          const rawTop = localY - h / 2;
                          const clamped = clampRectToBounds(
                            rawLeft,
                            rawTop,
                            w,
                            h,
                            canvasWidth,
                            canvasHeight,
                            1,
                            1,
                            activeRect.rotation ?? 0
                          );
                          return {
                            x: clamped.x + w / 2,
                            y: clamped.y + h / 2,
                          };
                        })
                      }
                      onMouseEnter={handleBlockMouseEnter}
                      onMouseLeave={handleBlockMouseLeave}
                      onClick={(e) => handleBlockClick(ann.id, e)}
                      onDragStart={() => handleBlockDragStart(ann.id)}
                      onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                      onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                    >
                      {/* Borda de seleção quando em foco */}
                      {isSelected4C && (
                        <Rect
                          width={w}
                          height={h}
                          stroke="#0071e3"
                          strokeWidth={1.5}
                          dash={[4, 4]}
                          fill="transparent"
                          cornerRadius={2}
                          listening={false}
                        />
                      )}


                      {/* Renderização individual de cada palavra anonimizada com inpainting sob ela */}
                      {smartWords.map((word, idx) => (
                        <Group key={`smart-word-${idx}`} x={word.x} y={word.y}>
                          <Rect
                            width={word.width}
                            height={word.height}
                            fill={ann.bgColor || '#ffffff'}
                            cornerRadius={2}
                          />
                          <Text
                            width={word.width}
                            height={word.height}
                            text={word.text}
                            fontSize={word.fontSize}
                            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                            fill={ann.textColor || '#1e293b'}
                            align="center"
                            verticalAlign="middle"
                            listening={false}
                          />
                        </Group>
                      ))}

                      {/* Hitbox transparente para clique e arraste */}
                      <Rect
                        width={w}
                        height={h}
                        fill="rgba(0,0,0,0.001)"
                      />
                    </Group>
                  );
                }

                if (ann.mode === 'rect') {
                  const isSelected4C = selectedFourCornerAnnotation?.id === ann.id;
                  const activeRect =
                    isSelected4C && effectiveFourCornerAnn && effectiveFourCornerAnn.type === 'redaction' && effectiveFourCornerAnn.mode === 'rect'
                      ? (effectiveFourCornerAnn as RedactionAnnotation)
                      : ann;
                  const w = activeRect.width || 0;
                  const h = activeRect.height || 0;
                  const cx = (activeRect.x || 0) + w / 2;
                  const cy = (activeRect.y || 0) + h / 2;

                  const effectiveLevel = resolveRedactionLevel(ann);
                  if (effectiveLevel === 3) {
                    return (
                      <Rect
                        key={ann.id}
                        id={ann.id}
                        x={cx}
                        y={cy}
                        offsetX={w / 2}
                        offsetY={h / 2}
                        width={w}
                        height={h}
                        scaleX={1}
                        scaleY={1}
                        rotation={activeRect.rotation ?? 0}
                        fill="#000000"
                        cornerRadius={2}
                        draggable={canDrag}
                        dragBoundFunc={(pos) =>
                          getTransformedDragBound(pos, zoomLevel, (localX, localY) => {
                            const rawLeft = localX - w / 2;
                            const rawTop = localY - h / 2;
                            const clamped = clampRectToBounds(
                              rawLeft,
                              rawTop,
                              w,
                              h,
                              canvasWidth,
                              canvasHeight,
                              1,
                              1,
                              activeRect.rotation ?? 0
                            );
                            return {
                              x: clamped.x + w / 2,
                              y: clamped.y + h / 2,
                            };
                          })
                        }
                        onMouseEnter={handleBlockMouseEnter}
                        onMouseLeave={handleBlockMouseLeave}
                        onClick={(e) => handleBlockClick(ann.id, e)}
                        onDragStart={() => handleBlockDragStart(ann.id)}
                        onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                        onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                      />
                    );
                  } else {
                    const currentBlurCanvas = blurredBgCanvases[effectiveLevel as 1 | 2];
                    return (
                      <Group
                        key={ann.id}
                        id={ann.id}
                        x={cx}
                        y={cy}
                        offsetX={w / 2}
                        offsetY={h / 2}
                        width={w}
                        height={h}
                        rotation={activeRect.rotation ?? 0}
                        draggable={canDrag}
                        dragBoundFunc={(pos) =>
                          getTransformedDragBound(pos, zoomLevel, (localX, localY) => {
                            const rawLeft = localX - w / 2;
                            const rawTop = localY - h / 2;
                            const clamped = clampRectToBounds(
                              rawLeft,
                              rawTop,
                              w,
                              h,
                              canvasWidth,
                              canvasHeight,
                              1,
                              1,
                              activeRect.rotation ?? 0
                            );
                            return {
                              x: clamped.x + w / 2,
                              y: clamped.y + h / 2,
                            };
                          })
                        }
                        onMouseEnter={handleBlockMouseEnter}
                        onMouseLeave={handleBlockMouseLeave}
                        onClick={(e) => handleBlockClick(ann.id, e)}
                        onDragStart={() => handleBlockDragStart(ann.id)}
                        onDragMove={(e) => handleBlockDragMove(ann.id, e)}
                        onDragEnd={(e) => handleBlockDragEnd(ann.id, e)}
                      >
                        {/* Área de toque interativa invisível para captura precisa de eventos no Konva */}
                        <Rect
                          width={w}
                          height={h}
                          fill="rgba(0, 0, 0, 0.001)"
                        />
                        <Group
                          clipFunc={(ctx) => {
                            ctx.rect(0, 0, w, h);
                          }}
                        >
                          {currentBlurCanvas ? (
                            <KonvaImage
                              image={currentBlurCanvas}
                              x={-(activeRect.x || 0)}
                              y={-(activeRect.y || 0)}
                              width={canvasWidth}
                              height={canvasHeight}
                              listening={false}
                            />
                          ) : (
                            <Rect width={w} height={h} fill="#334155" listening={false} />
                          )}
                        </Group>
                        <Rect
                          width={w}
                          height={h}
                          stroke="rgba(0, 0, 0, 0.15)"
                          strokeWidth={1}
                          listening={false}
                        />
                      </Group>
                    );
                  }
                } else {
                  const brushPts = ann.points || [];
                  const bSize = ann.brushSize || 24;
                  const effectiveLevel = resolveRedactionLevel(ann);
                  if (effectiveLevel === 3) {
                    return (
                      <Line
                        key={ann.id}
                        id={ann.id}
                        x={ann.x || 0}
                        y={ann.y || 0}
                        points={brushPts}
                        stroke="#000000"
                        strokeWidth={bSize}
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                      />
                    );
                  } else {
                    const currentBlurCanvas = blurredBgCanvases[effectiveLevel as 1 | 2];
                    return (
                      <Shape
                        key={ann.id}
                        id={ann.id}
                        x={ann.x || 0}
                        y={ann.y || 0}
                        listening={false}
                        sceneFunc={(context) => {
                          if (!brushPts || brushPts.length < 2) return;
                          const rawCtx = (context as any)._context as CanvasRenderingContext2D;
                          if (!rawCtx) return;

                          rawCtx.save();
                          rawCtx.beginPath();
                          rawCtx.moveTo(brushPts[0], brushPts[1]);
                          for (let i = 2; i < brushPts.length; i += 2) {
                            rawCtx.lineTo(brushPts[i], brushPts[i + 1]);
                          }
                          rawCtx.lineWidth = bSize;
                          rawCtx.lineCap = 'round';
                          rawCtx.lineJoin = 'round';

                          if (currentBlurCanvas) {
                            try {
                              const pattern = rawCtx.createPattern(currentBlurCanvas, 'no-repeat');
                              if (pattern) {
                                if (typeof DOMMatrix !== 'undefined' && (pattern as any).setTransform) {
                                  const mat = new DOMMatrix();
                                  mat.translateSelf(-(ann.x || 0), -(ann.y || 0));
                                  (pattern as any).setTransform(mat);
                                }
                                rawCtx.strokeStyle = pattern;
                                rawCtx.stroke();
                              } else {
                                rawCtx.strokeStyle = '#334155';
                                rawCtx.stroke();
                              }
                            } catch {
                              rawCtx.strokeStyle = '#334155';
                              rawCtx.stroke();
                            }
                          } else {
                            rawCtx.strokeStyle = '#334155';
                            rawCtx.stroke();
                          }
                          rawCtx.restore();
                        }}
                      />
                    );
                  }
                }
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
                    dragBoundFunc={(pos) =>
                      getTransformedDragBound(pos, zoomLevel, (localX, localY) => {
                        const clamped = clampMagnifierToImageBounds(
                          localX,
                          localY,
                          ann.radius,
                          canvasWidth,
                          canvasHeight
                        );
                        return { x: clamped.x, y: clamped.y };
                      })
                    }
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
                          const itemStrokeScale = false;
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
                            const currentItemStyle = item.arrowStyle || 'standard';
                            const effectiveStroke = item.strokeWidth || (currentItemStyle === 'thin' ? 2 : 4);
                            if (currentItemStyle === 'thin' && item.points.length >= 4) {
                              const chevronData = getOpenChevronArrowPoints(
                                item.points[0],
                                item.points[1],
                                item.points[2],
                                item.points[3],
                                effectiveStroke
                              );
                              return (
                                <Group
                                  key={`lens-${ann.id}-${item.id}`}
                                  x={item.x || 0}
                                  y={item.y || 0}
                                  scaleX={item.scaleX ?? 1}
                                  scaleY={item.scaleY ?? 1}
                                  rotation={item.rotation ?? 0}
                                  listening={false}
                                >
                                  <Line
                                    points={chevronData.shaftPoints}
                                    stroke={item.stroke}
                                    strokeWidth={effectiveStroke}
                                    lineCap="round"
                                    strokeScaleEnabled={itemStrokeScale}
                                    listening={false}
                                  />
                                  <Line
                                    points={chevronData.chevronPoints}
                                    stroke={item.stroke}
                                    strokeWidth={effectiveStroke}
                                    lineCap="round"
                                    lineJoin="round"
                                    strokeScaleEnabled={itemStrokeScale}
                                    listening={false}
                                  />
                                </Group>
                              );
                            }
                            const itemHeadDims = getArrowHeadDimensions(item.strokeWidth || 4, currentItemStyle);
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
                                strokeWidth={effectiveStroke}
                                dash={currentItemStyle === 'dashed' ? [6, 4] : undefined}
                                tension={currentItemStyle === 'curved' ? 0.4 : 0}
                                strokeScaleEnabled={itemStrokeScale}
                                fill={item.stroke}
                                pointerLength={itemHeadDims.pointerLength}
                                pointerWidth={itemHeadDims.pointerWidth}
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

            {/* Contornos visuais para todos os elementos selecionados na multiseleção */}
            {effectiveSelectedIds.length > 1 && (
              <Group name="multi-selection-outlines-group" listening={false}>
                {annotations
                  .filter((ann) => effectiveSelectedIds.includes(ann.id))
                  .map((ann) => {
                    const outline = getAnnotationSelectionOutline(ann);
                    if (outline.type === 'rect') {
                      return (
                        <Rect
                          key={`multi-outline-${ann.id}`}
                          name={`multi-outline-${ann.id}`}
                          x={outline.x}
                          y={outline.y}
                          width={outline.width}
                          height={outline.height}
                          offsetX={outline.offsetX}
                          offsetY={outline.offsetY}
                          rotation={outline.rotation}
                          stroke="#0078d4"
                          strokeWidth={1.5}
                          dash={[4, 4]}
                          listening={false}
                        />
                      );
                    }
                    if (outline.type === 'ellipse') {
                      return (
                        <Ellipse
                          key={`multi-outline-${ann.id}`}
                          name={`multi-outline-${ann.id}`}
                          x={outline.x}
                          y={outline.y}
                          radiusX={outline.radiusX!}
                          radiusY={outline.radiusY!}
                          rotation={outline.rotation}
                          stroke="#0078d4"
                          strokeWidth={1.5}
                          dash={[4, 4]}
                          listening={false}
                        />
                      );
                    }
                    if (outline.type === 'circle') {
                      return (
                        <Circle
                          key={`multi-outline-${ann.id}`}
                          name={`multi-outline-${ann.id}`}
                          x={outline.x}
                          y={outline.y}
                          radius={outline.radius!}
                          stroke="#0078d4"
                          strokeWidth={1.5}
                          dash={[4, 4]}
                          listening={false}
                        />
                      );
                    }
                    return null;
                  })}
              </Group>
            )}

            {/* Anotação em processo de criação (arraste) */}
            {newAnnotation && (
              <>
                {newAnnotation.type === 'redaction' && (() => {
                  const previewLevel = resolveRedactionLevel(newAnnotation);
                  const isSolid = previewLevel === 3;
                  return newAnnotation.mode === 'brush' ? (
                    <Line
                      points={newAnnotation.points || []}
                      stroke={isSolid ? '#000000' : 'rgba(100, 116, 139, 0.7)'}
                      strokeWidth={newAnnotation.brushSize || 24}
                      lineCap="round"
                      lineJoin="round"
                      dash={!isSolid ? [4, 4] : undefined}
                      listening={false}
                    />
                  ) : (
                    <Rect
                      x={newAnnotation.width! < 0 ? newAnnotation.x! + newAnnotation.width! : newAnnotation.x}
                      y={newAnnotation.height! < 0 ? newAnnotation.y! + newAnnotation.height! : newAnnotation.y}
                      width={Math.abs(newAnnotation.width!)}
                      height={Math.abs(newAnnotation.height!)}
                      fill={isSolid ? '#000000' : 'rgba(100, 116, 139, 0.4)'}
                      stroke={!isSolid ? '#0071e3' : undefined}
                      strokeWidth={1}
                      dash={!isSolid ? [4, 4] : undefined}
                      listening={false}
                    />
                  );
                })()}
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
                {newAnnotation.type === 'arrow' && (() => {
                  const previewStyle = newAnnotation.arrowStyle || arrowStyle || 'standard';
                  const effectiveStroke = newAnnotation.strokeWidth || (previewStyle === 'thin' ? 2 : 4);
                  if (previewStyle === 'thin' && newAnnotation.points.length >= 4) {
                    const chevronData = getOpenChevronArrowPoints(
                      newAnnotation.points[0],
                      newAnnotation.points[1],
                      newAnnotation.points[2],
                      newAnnotation.points[3],
                      effectiveStroke
                    );
                    return (
                      <Group listening={false}>
                        <Line
                          points={chevronData.shaftPoints}
                          stroke={newAnnotation.stroke}
                          strokeWidth={effectiveStroke}
                          lineCap="round"
                        />
                        <Line
                          points={chevronData.chevronPoints}
                          stroke={newAnnotation.stroke}
                          strokeWidth={effectiveStroke}
                          lineCap="round"
                          lineJoin="round"
                        />
                      </Group>
                    );
                  }
                  const previewHead = getArrowHeadDimensions(newAnnotation.strokeWidth || 4, previewStyle);
                  return (
                    <Arrow
                      points={newAnnotation.points}
                      stroke={newAnnotation.stroke}
                      strokeWidth={newAnnotation.strokeWidth}
                      dash={previewStyle === 'dashed' ? [6, 4] : undefined}
                      tension={previewStyle === 'curved' ? 0.4 : 0}
                      fill={newAnnotation.stroke}
                      pointerLength={previewHead.pointerLength}
                      pointerWidth={previewHead.pointerWidth}
                    />
                  );
                })()}
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

            {/* Modo de Recorte (Crop): Máscara Escurecida Externa e Quadro Interativo */}
            {(activeTool === 'crop' || isCropping) && cropRect && (() => {
              const guides = getCropVisualGuides(cropRect);
              return (
                <Group name="crop-overlay-group">
                  {/* 4 Retângulos escurecidos fora do quadro de recorte */}
                  <Rect
                    x={0}
                    y={0}
                    width={canvasWidth}
                    height={Math.max(0, cropRect.y)}
                    fill="rgba(0, 0, 0, 0.55)"
                    listening={false}
                  />
                  <Rect
                    x={0}
                    y={cropRect.y + cropRect.height}
                    width={canvasWidth}
                    height={Math.max(0, canvasHeight - (cropRect.y + cropRect.height))}
                    fill="rgba(0, 0, 0, 0.55)"
                    listening={false}
                  />
                  <Rect
                    x={0}
                    y={cropRect.y}
                    width={Math.max(0, cropRect.x)}
                    height={cropRect.height}
                    fill="rgba(0, 0, 0, 0.55)"
                    listening={false}
                  />
                  <Rect
                    x={cropRect.x + cropRect.width}
                    y={cropRect.y}
                    width={Math.max(0, canvasWidth - (cropRect.x + cropRect.width))}
                    height={cropRect.height}
                    fill="rgba(0, 0, 0, 0.55)"
                    listening={false}
                  />

                  {/* Grade 3x3 de regra dos terços */}
                  {guides.gridLines.map((line) => (
                    <Line
                      key={line.name}
                      name={line.name}
                      points={line.points}
                      stroke="rgba(255, 255, 255, 0.22)"
                      strokeWidth={1}
                      listening={false}
                    />
                  ))}

                  {/* Retângulo de recorte interativo com moldura nítida única */}
                  <Rect
                    id="crop-box-rect"
                    name="crop-box-rect"
                    x={cropRect.x}
                    y={cropRect.y}
                    width={cropRect.width}
                    height={cropRect.height}
                    stroke="rgba(255, 255, 255, 0.9)"
                    strokeWidth={1.5}
                    shadowColor="rgba(0, 0, 0, 0.4)"
                    shadowBlur={3}
                    draggable
                    dragBoundFunc={(pos) =>
                      getTransformedDragBound(pos, zoomLevel, (localX, localY) => ({
                        x: Math.max(0, Math.min(localX, canvasWidth - cropRect.width)),
                        y: Math.max(0, Math.min(localY, canvasHeight - cropRect.height)),
                      }))
                    }
                    onDragMove={(e) => {
                      const nextX = Math.round(e.target.x());
                      const nextY = Math.round(e.target.y());
                      setCropRect((prev) => (prev ? { ...prev, x: nextX, y: nextY } : null));
                    }}
                    onDragEnd={(e) => {
                      const nextX = Math.round(e.target.x());
                      const nextY = Math.round(e.target.y());
                      const updated: CropBox = {
                        x: nextX,
                        y: nextY,
                        width: cropRect.width,
                        height: cropRect.height,
                      };
                      setCropRect(updated);
                      onCropRectChange?.(updated);
                    }}
                  />

                  {/* 4 Cantos clássicos em 'L' */}
                  {guides.corners.map((corner) => (
                    <Line
                      key={corner.name}
                      name={corner.name}
                      points={corner.points}
                      stroke="#ffffff"
                      strokeWidth={3}
                      lineCap="square"
                      lineJoin="miter"
                      shadowColor="rgba(0, 0, 0, 0.5)"
                      shadowBlur={2}
                      listening={false}
                    />
                  ))}

                  {/* 4 Barras centrais nas arestas */}
                  {guides.edgeBars.map((bar) => (
                    <Line
                      key={bar.name}
                      name={bar.name}
                      points={bar.points}
                      stroke="#ffffff"
                      strokeWidth={3}
                      lineCap="round"
                      shadowColor="rgba(0, 0, 0, 0.5)"
                      shadowBlur={2}
                      listening={false}
                    />
                  ))}
                </Group>
              );
            })()}

            {/* Âncoras interativas de ajuste manual da flecha curva selecionada (1: Cauda/Origem, 2: Meio/Curvatura, 3: Ponta/Alvo) */}
            {selectedCurvedArrow &&
              effectiveCurvedPoints &&
              effectiveCurvedPoints.length >= 6 &&
              !isLocked &&
              !isCropping &&
              !isDrawing &&
              !isDraggingArrowBody &&
              effectiveSelectedIds.length === 1 && (() => {
                const anchors = getCurvedArrowAnchorPositions(effectiveCurvedPoints);
                const anchorList: Array<{ index: 0 | 1 | 2; pos: { x: number; y: number }; name: string }> = [
                  { index: 0, pos: anchors.tail, name: 'curved-arrow-anchor-tail' },
                  { index: 1, pos: anchors.bend, name: 'curved-arrow-anchor-bend' },
                  { index: 2, pos: anchors.tip, name: 'curved-arrow-anchor-tip' },
                ];

                return (
                  <Group name="curved-arrow-anchors-group">
                    {anchorList.map(({ index, pos, name }) => (
                      <Circle
                        key={name}
                        name={name}
                        x={pos.x}
                        y={pos.y}
                        radius={6}
                        fill="#ffffff"
                        stroke="#0071e3"
                        strokeWidth={2}
                        shadowColor="rgba(0, 0, 0, 0.25)"
                        shadowBlur={3}
                        hitStrokeWidth={16}
                        draggable={!isLocked}
                        dragBoundFunc={(absolutePos) =>
                          getTransformedDragBound(absolutePos, zoomLevel, (localX, localY) => ({
                            x: Math.max(0, Math.min(localX, canvasWidth)),
                            y: Math.max(0, Math.min(localY, canvasHeight)),
                          }))
                        }
                        onMouseEnter={() => setHoveredAnchor(index)}
                        onMouseLeave={() => setHoveredAnchor((prev) => (prev === index ? null : prev))}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          setDraggingAnchor({ id: selectedCurvedArrow.id, index });
                          setLiveAnchorPoints(effectiveCurvedPoints);
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const nextPoints = updateCurvedArrowAnchor(
                            effectiveCurvedPoints,
                            index,
                            e.target.x(),
                            e.target.y(),
                            canvasWidth,
                            canvasHeight
                          );
                          setLiveAnchorPoints(nextPoints);
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          const finalPoints = updateCurvedArrowAnchor(
                            liveAnchorPoints || effectiveCurvedPoints,
                            index,
                            e.target.x(),
                            e.target.y(),
                            canvasWidth,
                            canvasHeight
                          );
                          const hasChanged = finalPoints.some(
                            (val, i) => val !== selectedCurvedArrow.points[i]
                          );
                          if (hasChanged || (selectedCurvedArrow.x && selectedCurvedArrow.x !== 0) || (selectedCurvedArrow.y && selectedCurvedArrow.y !== 0)) {
                            onUpdateAnnotation(selectedCurvedArrow.id, {
                              x: 0,
                              y: 0,
                              points: finalPoints,
                            });
                          }
                          setLiveAnchorPoints(null);
                          setDraggingAnchor(null);
                        }}
                      />
                    ))}
                  </Group>
                );
              })()}

            {/* Âncoras interativas de 2 pontos para linha reta e seta reta (1: Origem/Cauda, 2: Destino/Ponta) */}
            {selectedTwoPointAnnotation &&
              effectiveTwoPointPoints &&
              effectiveTwoPointPoints.length >= 4 &&
              !isLocked &&
              !isCropping &&
              !isDrawing &&
              !isDraggingTwoPointBody &&
              effectiveSelectedIds.length === 1 && (() => {
                const anchors = getTwoPointAnchorPositions(effectiveTwoPointPoints);
                const anchorList: Array<{ index: 0 | 1; pos: { x: number; y: number }; name: string }> = [
                  { index: 0, pos: anchors.start, name: 'two-point-anchor-start' },
                  { index: 1, pos: anchors.end, name: 'two-point-anchor-end' },
                ];

                return (
                  <Group name="two-point-anchors-group">
                    {anchorList.map(({ index, pos, name }) => (
                      <Circle
                        key={name}
                        name={name}
                        x={pos.x}
                        y={pos.y}
                        radius={6}
                        fill="#ffffff"
                        stroke="#0071e3"
                        strokeWidth={2}
                        shadowColor="rgba(0, 0, 0, 0.25)"
                        shadowBlur={3}
                        hitStrokeWidth={16}
                        draggable={!isLocked}
                        dragBoundFunc={(absolutePos: Konva.Vector2d) =>
                          getTransformedDragBound(absolutePos, zoomLevel, (localX, localY) => {
                            const isShift = isShiftPressedRef.current;
                            const fixedX = index === 0 ? effectiveTwoPointPoints[2] : effectiveTwoPointPoints[0];
                            const fixedY = index === 0 ? effectiveTwoPointPoints[3] : effectiveTwoPointPoints[1];
                            return getTwoPointAnchorDragBound(
                              localX,
                              localY,
                              { x: fixedX, y: fixedY },
                              isShift,
                              canvasWidth,
                              canvasHeight
                            );
                          })
                        }
                        onMouseEnter={() => setHoveredTwoPointAnchor(index)}
                        onMouseLeave={() => setHoveredTwoPointAnchor((prev) => (prev === index ? null : prev))}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          setDraggingTwoPointAnchor({ id: selectedTwoPointAnnotation.id, index });
                          setLiveTwoPointPoints(effectiveTwoPointPoints);
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const isShift = (e.evt as MouseEvent)?.shiftKey ?? isShiftPressedRef.current;
                          const fixedX = index === 0 ? effectiveTwoPointPoints[2] : effectiveTwoPointPoints[0];
                          const fixedY = index === 0 ? effectiveTwoPointPoints[3] : effectiveTwoPointPoints[1];
                          const bounded = getTwoPointAnchorDragBound(
                            e.target.x(),
                            e.target.y(),
                            { x: fixedX, y: fixedY },
                            isShift,
                            canvasWidth,
                            canvasHeight
                          );
                          e.target.position({ x: bounded.x, y: bounded.y });
                          const nextPoints = updateTwoPointAnchor(
                            effectiveTwoPointPoints,
                            index,
                            bounded.x,
                            bounded.y,
                            canvasWidth,
                            canvasHeight
                          );
                          setLiveTwoPointPoints(nextPoints);
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          const isShift = (e.evt as MouseEvent)?.shiftKey ?? isShiftPressedRef.current;
                          const fixedX = index === 0 ? effectiveTwoPointPoints[2] : effectiveTwoPointPoints[0];
                          const fixedY = index === 0 ? effectiveTwoPointPoints[3] : effectiveTwoPointPoints[1];
                          const bounded = getTwoPointAnchorDragBound(
                            e.target.x(),
                            e.target.y(),
                            { x: fixedX, y: fixedY },
                            isShift,
                            canvasWidth,
                            canvasHeight
                          );
                          e.target.position({ x: bounded.x, y: bounded.y });
                          const finalPoints = updateTwoPointAnchor(
                            liveTwoPointPoints || effectiveTwoPointPoints,
                            index,
                            bounded.x,
                            bounded.y,
                            canvasWidth,
                            canvasHeight
                          );
                          const hasChanged = finalPoints.some(
                            (val, i) => val !== selectedTwoPointAnnotation.points[i]
                          );
                          if (
                            hasChanged ||
                            (selectedTwoPointAnnotation.x && selectedTwoPointAnnotation.x !== 0) ||
                            (selectedTwoPointAnnotation.y && selectedTwoPointAnnotation.y !== 0)
                          ) {
                            onUpdateAnnotation(selectedTwoPointAnnotation.id, {
                              x: 0,
                              y: 0,
                              points: finalPoints,
                            });
                          }
                          setLiveTwoPointPoints(null);
                          setDraggingTwoPointAnchor(null);
                        }}
                      />
                    ))}
                  </Group>
                );
              })()}

            {/* Âncoras Minimalistas de 4 Cantos e Rotação Estilo Ferramenta de Captura do Windows para Retângulos e Elipses */}
            {selectedFourCornerAnnotation &&
              fourCornerPositions &&
              !isLocked &&
              !isCropping &&
              !isDrawing &&
              effectiveSelectedIds.length === 1 && (() => {
                const corners = fourCornerPositions.corners;
                const rotaterPos = fourCornerPositions.rotater;
                const showRotater = shouldShowRotationHandle(selectedFourCornerAnnotation);

                return (
                  <Group name="four-corner-controls-group">
                    {/* Alça Superior de Rotação Estilo Windows Snipping Tool (ocultada para texto inteligente) */}
                    {showRotater && (
                    <Group
                      name="four-corner-rotater"
                      x={rotaterPos.x}
                      y={rotaterPos.y}
                      draggable={false}
                      onMouseEnter={(e) => {
                        e.cancelBubble = true;
                        setIsHoveringRotater(true);
                        const stage = stageRef.current;
                        if (stage) stage.container().style.cursor = 'grab';
                      }}
                      onMouseLeave={() => {
                        setIsHoveringRotater(false);
                        const stage = stageRef.current;
                        if (stage && !isRotating) {
                          stage.container().style.cursor = isHoveringBlock && !isLocked ? 'move' : 'default';
                        }
                      }}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        setIsRotating(true);
                        const stage = stageRef.current;
                        if (stage) stage.container().style.cursor = 'grabbing';
                      }}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        setIsRotating(false);
                        setLiveRotation(null);
                        const isRect4C =
                          selectedFourCornerAnnotation.type === 'rect' ||
                          (selectedFourCornerAnnotation.type === 'redaction' && (selectedFourCornerAnnotation as any).mode === 'rect');
                        const clampedPos = isRect4C
                          ? clampRectToBounds(
                              selectedFourCornerAnnotation.x || 0,
                              selectedFourCornerAnnotation.y || 0,
                              (selectedFourCornerAnnotation as any).width || 0,
                              (selectedFourCornerAnnotation as any).height || 0,
                              canvasWidth,
                              canvasHeight,
                              1,
                              1,
                              0
                            )
                          : clampEllipseToBounds(
                              (selectedFourCornerAnnotation.x || 0),
                              (selectedFourCornerAnnotation.y || 0),
                              (selectedFourCornerAnnotation as EllipseAnnotation).radiusX,
                              (selectedFourCornerAnnotation as EllipseAnnotation).radiusY,
                              canvasWidth,
                              canvasHeight,
                              1,
                              1,
                              0
                            );
                        onUpdateAnnotation(selectedFourCornerAnnotation.id, {
                          rotation: 0,
                          x: clampedPos.x,
                          y: clampedPos.y,
                        });
                      }}
                    >
                      {/* Área de toque expandida invisível */}
                      <Circle radius={18} fill="rgba(0,0,0,0.001)" />
                      {/* Badge escuro estilo Windows Snipping Tool */}
                      <Circle
                        radius={13}
                        fill="#262626"
                        stroke="#52525b"
                        strokeWidth={1.2}
                        shadowColor="rgba(0,0,0,0.35)"
                        shadowBlur={4}
                        shadowOffsetY={1}
                      />
                      {/* Ícone de rotação ⟳ */}
                      <Shape
                        sceneFunc={(context, shape) => {
                          const ctx = context._context as CanvasRenderingContext2D;
                          ctx.save();
                          ctx.beginPath();
                          ctx.arc(0, 0, 6.5, -Math.PI * 0.85, Math.PI * 0.65, false);
                          ctx.lineWidth = 1.6;
                          ctx.strokeStyle = '#ffffff';
                          ctx.lineCap = 'round';
                          ctx.stroke();

                          const endAngle = Math.PI * 0.65;
                          const tipX = Math.cos(endAngle) * 6.5;
                          const tipY = Math.sin(endAngle) * 6.5;
                          ctx.beginPath();
                          ctx.moveTo(tipX - 1.5, tipY - 3);
                          ctx.lineTo(tipX + 2.5, tipY + 1.2);
                          ctx.lineTo(tipX - 2.5, tipY + 2.5);
                          ctx.closePath();
                          ctx.fillStyle = '#ffffff';
                          ctx.fill();
                          ctx.restore();
                          context.fillStrokeShape(shape);
                        }}
                        listening={false}
                      />
                    </Group>
                    )}

                    {/* 4 Âncoras Circulares nos Cantos (TL, TR, BR, BL) */}
                    {corners.map((pos, idx) => {
                      const cursorStyle = getCornerCursor(
                        idx as 0 | 1 | 2 | 3,
                        effectiveFourCornerAnn?.rotation ?? 0
                      );
                      return (
                        <Circle
                          key={`corner-anchor-${idx}`}
                          name={`corner-anchor-${idx}`}
                          x={pos.x}
                          y={pos.y}
                          radius={6}
                          fill="#ffffff"
                          stroke="#71717a"
                          strokeWidth={1.5}
                          hitStrokeWidth={18}
                          shadowColor="rgba(0, 0, 0, 0.25)"
                          shadowBlur={3}
                          draggable={false}
                          onMouseEnter={(e) => {
                            e.cancelBubble = true;
                            setHoveredCorner(idx as 0 | 1 | 2 | 3);
                            const stage = stageRef.current;
                            if (stage) stage.container().style.cursor = cursorStyle;
                          }}
                          onMouseLeave={() => {
                            setHoveredCorner(null);
                            const stage = stageRef.current;
                            if (stage && draggingCorner === null) {
                              stage.container().style.cursor = isHoveringBlock && !isLocked ? 'move' : 'default';
                            }
                          }}
                          onMouseDown={(e) => {
                            e.cancelBubble = true;
                            setDraggingCorner(idx as 0 | 1 | 2 | 3);
                            const stage = stageRef.current;
                            if (stage) stage.container().style.cursor = cursorStyle;
                          }}
                        />
                      );
                    })}
                  </Group>
                );
              })()}

            {/* Transformer de Redimensionamento (Simples, Multiseleção, Texto Sem Distorção 12..48, Lupa e Quadro de Recorte) */}
            <Transformer
              ref={transformerRef}
              onTransform={handleTransform}
              onTransformEnd={handleTransformEnd}
              flipEnabled={false}
              rotateEnabled={!hasSelectedMagnifier && activeTool !== 'crop' && !isCropping}
              keepRatio={activeTool === 'crop' || isCropping ? false : hasSelectedText || hasSelectedMagnifier ? true : false}
              enabledAnchors={
                activeTool === 'crop' || isCropping
                  ? [
                      'top-left',
                      'top-center',
                      'top-right',
                      'middle-left',
                      'middle-right',
                      'bottom-left',
                      'bottom-center',
                      'bottom-right',
                    ]
                  : hasSelectedText && effectiveSelectedIds.length === 1
                  ? []
                  : ['top-left', 'top-right', 'bottom-left', 'bottom-right']
              }
              anchorSize={activeTool === 'crop' || isCropping ? 14 : 10}
              anchorCornerRadius={activeTool === 'crop' || isCropping ? 0 : 5}
              anchorFill={activeTool === 'crop' || isCropping ? 'rgba(255, 255, 255, 0.01)' : '#ffffff'}
              anchorStroke={activeTool === 'crop' || isCropping ? 'rgba(0, 0, 0, 0.01)' : '#71717a'}
              anchorStrokeWidth={activeTool === 'crop' || isCropping ? 0 : 1.5}
              borderStroke={activeTool === 'crop' || isCropping ? 'transparent' : '#0071e3'}
              borderStrokeWidth={activeTool === 'crop' || isCropping ? 0 : 1.5}
              rotateAnchorOffset={28}
              rotateAnchorCursor="grab"
              boundBoxFunc={(oldBox, newBox) => {
                const localNewBox = toLocalBoundingBox(newBox, zoomLevel);
                const localOldBox = toLocalBoundingBox(oldBox, zoomLevel);

                if (activeTool === 'crop' || isCropping) {
                  const minW = 20;
                  const minH = 20;
                  const clampedX = Math.max(0, Math.min(localNewBox.x, canvasWidth - minW));
                  const clampedY = Math.max(0, Math.min(localNewBox.y, canvasHeight - minH));
                  const clampedW = Math.max(minW, Math.min(localNewBox.width, canvasWidth - clampedX));
                  const clampedH = Math.max(minH, Math.min(localNewBox.height, canvasHeight - clampedY));
                  return toAbsoluteBoundingBox(
                    {
                      x: clampedX,
                      y: clampedY,
                      width: clampedW,
                      height: clampedH,
                      rotation: newBox.rotation,
                    },
                    zoomLevel
                  );
                }

                // Ajusta a proporção uniforme (scaleX === scaleY) ao redimensionar para cima, baixo ou lados
                const proportionalBox = calculateProportionalResizeBox(localOldBox, localNewBox);

                if (hasSelectedMagnifier) {
                  if (
                    proportionalBox.width < 48 ||
                    proportionalBox.height < 48 ||
                    proportionalBox.x < 0 ||
                    proportionalBox.y < 0 ||
                    proportionalBox.x + proportionalBox.width > canvasWidth ||
                    proportionalBox.y + proportionalBox.height > canvasHeight
                  ) {
                    return oldBox;
                  }
                  return toAbsoluteBoundingBox(proportionalBox, zoomLevel);
                }

                if (hasSelectedText && transformerRef.current) {
                  const nodes = transformerRef.current.nodes();
                  if (nodes.length === 1) {
                    const node = nodes[0];
                    const ann = annotations.find((a) => a.id === node.id());
                    if (ann?.type === 'text') {
                      const clampedLocal = clampTextResizeBox(
                        localOldBox,
                        proportionalBox,
                        ann.fontSize,
                        node.width(),
                        node.height()
                      );
                      if (
                        clampedLocal.x < 0 ||
                        clampedLocal.y < 0 ||
                        clampedLocal.x + clampedLocal.width > canvasWidth ||
                        clampedLocal.y + clampedLocal.height > canvasHeight
                      ) {
                        return oldBox;
                      }
                      return toAbsoluteBoundingBox(
                        {
                          ...clampedLocal,
                          rotation: newBox.rotation,
                        },
                        zoomLevel
                      );
                    }
                  }
                }

                if (transformerRef.current) {
                  const nodes = transformerRef.current.nodes();
                  if (nodes.length === 1) {
                    const node = nodes[0];
                    const ann = annotations.find((a) => a.id === node.id());
                    if (ann?.type === 'arrow') {
                      const baseStroke = ann.strokeWidth || (ann.arrowStyle === 'thin' ? 2 : 4);
                      const clampedLocal = clampArrowResizeBox(
                        localOldBox,
                        proportionalBox,
                        baseStroke,
                        localOldBox.width,
                        localOldBox.height
                      );
                      if (
                        clampedLocal.x < 0 ||
                        clampedLocal.y < 0 ||
                        clampedLocal.x + clampedLocal.width > canvasWidth ||
                        clampedLocal.y + clampedLocal.height > canvasHeight
                      ) {
                        return oldBox;
                      }
                      return toAbsoluteBoundingBox(
                        {
                          ...clampedLocal,
                          rotation: newBox.rotation,
                        },
                        zoomLevel
                      );
                    }
                  }
                }

                // Para qualquer outro elemento (retângulo, elipse, imagem inserida):
                // Redimensionamento livre pelos 4 cantos mantendo limites da imagem
                const minDim = 10;
                if (
                  localNewBox.width < minDim ||
                  localNewBox.height < minDim ||
                  localNewBox.x < 0 ||
                  localNewBox.y < 0 ||
                  localNewBox.x + localNewBox.width > canvasWidth ||
                  localNewBox.y + localNewBox.height > canvasHeight
                ) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>

        {/* Input Inline de Edição de Texto Direto sobre o Canvas (Sem Modais) */}
        {editingText && (() => {
          const initialHtml = spansToHtml(editingText.text, editingText.spans, {
            isBold: editingText.isBold,
            isItalic: editingText.isItalic,
            isUnderline: editingText.isUnderline,
            isStrikethrough: editingText.isStrikethrough,
          });

          const commitEditing = () => {
            if (inlineEditableRef.current && editingText) {
              const { text, spans } = parseHtmlToSpans(inlineEditableRef.current);
              const val = text.trim();
              if (val) {
                onUpdateAnnotation(editingText.id, { text: val, spans });
              } else if (onRemoveAnnotation) {
                onRemoveAnnotation(editingText.id);
                applySelectionIds([]);
              }
            }
            setEditingText(null);
          };

          return (
            <div
              ref={inlineEditableRef}
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: initialHtml }}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                const isCmdOrCtrl = e.ctrlKey || e.metaKey;

                // Enter + Ctrl/Cmd ou Escape: confirma e conclui a edição
                if ((e.key === 'Enter' && isCmdOrCtrl) || e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  commitEditing();
                  return;
                }

                // Enter simples: permite quebra de linha natural (\n) sem fechar o editor
                if (e.key === 'Enter' && !isCmdOrCtrl) {
                  return;
                }

                const key = e.key.toLowerCase();
                let formatCmd: 'bold' | 'italic' | 'underline' | 'strikeThrough' | null = null;

                if (isCmdOrCtrl && (key === 'b' || key === 'n')) {
                  formatCmd = 'bold';
                } else if (isCmdOrCtrl && key === 'i') {
                  formatCmd = 'italic';
                } else if (isCmdOrCtrl && key === 'u') {
                  formatCmd = 'underline';
                } else if (
                  (isCmdOrCtrl && e.shiftKey && key === 'x') ||
                  (e.altKey && e.shiftKey && key === '5')
                ) {
                  formatCmd = 'strikeThrough';
                }

                if (formatCmd) {
                  e.preventDefault();
                  e.stopPropagation();
                  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
                  const hasSelection = sel && !sel.isCollapsed && sel.toString().length > 0;
                  if (hasSelection) {
                    document.execCommand(formatCmd, false);
                  } else if (inlineEditableRef.current && sel) {
                    const range = document.createRange();
                    range.selectNodeContents(inlineEditableRef.current);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    document.execCommand(formatCmd, false);
                    sel.collapseToEnd();
                  }
                }
              }}
              style={{
                position: 'absolute',
                left: `${editingText.x * zoomLevel}px`,
                top: `${editingText.y * zoomLevel}px`,
                fontSize: `${editingText.fontSize * zoomLevel}px`,
                color: editingText.fill,
                fontFamily: editingText.fontFamily || 'Arial',
                textAlign: editingText.textAlign || 'left',
                border: '1px dashed #0071e3',
                borderRadius: '4px',
                backgroundColor: editingText.hasBackground ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.90)',
                padding: '4px 6px',
                outline: 'none',
                minWidth: `${150 * zoomLevel}px`,
                minHeight: `${32 * zoomLevel}px`,
                zIndex: 1000,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            />
          );
        })()}
      </div>
    </div>
  </div>
);
};
