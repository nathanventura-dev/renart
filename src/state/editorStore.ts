import { calculateCurvedArrowPoints, invertCurvedArrowPoints } from '../utils/zoomAndCrop';
import { AnonymizedLine, anonymizeWord } from '../utils/textAnonymizer';

export type ToolType =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'image'
  | 'magnifier'
  | 'crop'
  | 'redaction';

export const STROKE_WIDTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface BaseAnnotation {
  id: string;
  type: ToolType;
  x?: number;
  y?: number;
  stroke?: string;
  strokeWidth?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  x?: number;
  y?: number;
  points: number[]; // [x1, y1, x2, y2]
}

export type ArrowStyle = 'standard' | 'thin' | 'dashed' | 'curved';
export type ArrowCurveDirection = 'left' | 'right';

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  x?: number;
  y?: number;
  points: number[]; // [x1, y1, x2, y2] ou [x1, y1, midX, midY, x2, y2]
  arrowStyle?: ArrowStyle;
  curveDirection?: ArrowCurveDirection;
}

export const FONT_FAMILIES = [
  'Arial',
  'Segoe UI',
  'Calibri',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Courier New',
] as const;

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48] as const;

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily?: string;
  fill?: string;
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export interface MagnifierAnnotation extends BaseAnnotation {
  type: 'magnifier';
  x: number;
  y: number;
  radius: number;
  zoomLevel: number; // ex: 2.0x
  focusX?: number; // Coordenada X do ponto focal (quando desacoplado do centro da lente)
  focusY?: number; // Coordenada Y do ponto focal (quando desacoplado do centro da lente)
}

export type RedactionLevel = 1 | 2 | 3 | 4;
export type RedactionEffect = 'blackout' | 'blur';
export type RedactionMode = 'rect' | 'brush' | 'smart-text';

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redaction';
  level?: RedactionLevel;
  effect?: RedactionEffect;
  mode: RedactionMode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: number[];
  brushSize?: number;
  bgColor?: string;
  textColor?: string;
  lines?: AnonymizedLine[];
}

export type Annotation =
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | ArrowAnnotation
  | TextAnnotation
  | ImageAnnotation
  | MagnifierAnnotation
  | RedactionAnnotation;

export type MagnifierMode = 'without-focus' | 'with-focus';

export interface EditorState {
  annotations: Annotation[];
  activeTool: ToolType;
  selectedId: string | null;
  selectedIds: string[];
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  arrowStyle: ArrowStyle;
  arrowCurveDirection: ArrowCurveDirection;
  magnifierMode: MagnifierMode;
  redactionLevel: RedactionLevel;
  redactionEffect: RedactionEffect;
  redactionMode: RedactionMode;
  isLocked: boolean;
}

/**
 * Determina se a barra superior deve exibir os seletores contextuais de Fonte e Tamanho
 * em vez da espessura de linha (quando a ferramenta 'text' está ativa ou há blocos 'text' selecionados).
 */
export function shouldShowTextControls(
  activeTool: ToolType,
  selectedAnnotations: Annotation[]
): boolean {
  if (activeTool === 'text') return true;
  return selectedAnnotations.some((ann) => ann.type === 'text');
}

/**
 * Determina se a barra superior deve exibir o seletor contextual de estilo de flecha
 * (quando a ferramenta 'arrow' está ativa ou há blocos 'arrow' selecionados).
 */
export function shouldShowArrowControls(
  activeTool: ToolType,
  selectedAnnotations: Annotation[]
): boolean {
  if (activeTool === 'arrow') return true;
  return selectedAnnotations.some((ann) => ann.type === 'arrow');
}

/**
 * Determina se a barra superior deve exibir o seletor contextual de modo de lupa
 * (quando a ferramenta 'magnifier' está ativa ou há blocos 'magnifier' selecionados).
 */
export function shouldShowMagnifierControls(
  activeTool: ToolType,
  selectedAnnotations: Annotation[]
): boolean {
  if (activeTool === 'magnifier') return true;
  return selectedAnnotations.some((ann) => ann.type === 'magnifier');
}

/**
 * Determina se a barra superior deve exibir os seletores contextuais de Ocultação/Censura
 * (quando a ferramenta 'redaction' está ativa ou há blocos 'redaction' selecionados).
 */
export function shouldShowRedactionControls(
  activeTool: ToolType,
  selectedAnnotations: Annotation[]
): boolean {
  if (activeTool === 'redaction') return true;
  return selectedAnnotations.some((ann) => ann.type === 'redaction');
}

export interface HistorySnapshot {
  annotations: Annotation[];
  imageBase64?: string;
}

interface CaptureEditorSession {
  annotations: Annotation[];
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  isLocked: boolean;
  imageBase64?: string;
}

export function createEditorStore(
  initialState?: Partial<EditorState>,
  onRestoreImageCallback?: (captureId: string, imageBase64: string) => void
) {
  const initialSelectedId = initialState?.selectedId ?? null;
  const initialSelectedIds =
    initialState?.selectedIds ?? (initialSelectedId ? [initialSelectedId] : []);

  let state: EditorState = {
    annotations: [],
    activeTool: 'select',
    selectedId: initialSelectedId,
    selectedIds: initialSelectedIds,
    strokeColor: '#ff3b30',
    strokeWidth: 4,
    fontSize: 18,
    fontFamily: 'Arial',
    arrowStyle: 'standard',
    arrowCurveDirection: 'right',
    magnifierMode: 'without-focus',
    redactionLevel: 4,
    redactionEffect: 'blackout',
    redactionMode: 'rect',
    isLocked: false,
    ...initialState,
  };

  let activeCaptureId: string = 'default';
  let currentImageBase64: string = '';
  let onRestoreImage: ((captureId: string, imageBase64: string) => void) | undefined =
    onRestoreImageCallback;
  const sessions = new Map<string, CaptureEditorSession>();

  const undoStack: HistorySnapshot[] = [];
  const redoStack: HistorySnapshot[] = [];
  const listeners: Set<() => void> = new Set();

  const notify = () => listeners.forEach((l) => l());

  const pushUndoSnapshot = () => {
    undoStack.push({
      annotations: [...state.annotations],
      imageBase64: currentImageBase64,
    });
    redoStack.length = 0;
  };

  const saveCurrentSession = () => {
    sessions.set(activeCaptureId, {
      annotations: [...state.annotations],
      undoStack: undoStack.map((snap) => ({
        annotations: [...snap.annotations],
        imageBase64: snap.imageBase64,
      })),
      redoStack: redoStack.map((snap) => ({
        annotations: [...snap.annotations],
        imageBase64: snap.imageBase64,
      })),
      isLocked: state.isLocked,
      imageBase64: currentImageBase64,
    });
  };

  const syncToolbarWithSelection = (ids: string[], annotations: Annotation[]) => {
    if (ids.length === 0) return {};
    const firstSelected = annotations.find((a) => a.id === ids[0]);
    if (!firstSelected) return {};

    const nextColor =
      firstSelected.type === 'text'
        ? firstSelected.fill || state.strokeColor
        : firstSelected.stroke || state.strokeColor;
    const nextWidth = firstSelected.strokeWidth ?? state.strokeWidth;
    const firstText = annotations.find((a) => ids.includes(a.id) && a.type === 'text') as
      | TextAnnotation
      | undefined;
    const firstArrow = annotations.find((a) => ids.includes(a.id) && a.type === 'arrow') as
      | ArrowAnnotation
      | undefined;
    const firstMag = annotations.find((a) => ids.includes(a.id) && a.type === 'magnifier') as
      | MagnifierAnnotation
      | undefined;
    const firstRedaction = annotations.find((a) => ids.includes(a.id) && a.type === 'redaction') as
      | RedactionAnnotation
      | undefined;
    let nextMagMode = state.magnifierMode;
    if (firstMag) {
      const isDetached =
        firstMag.focusX !== undefined &&
        firstMag.focusY !== undefined &&
        Math.hypot(firstMag.focusX - firstMag.x, firstMag.focusY - firstMag.y) > 4;
      nextMagMode = isDetached ? 'with-focus' : 'without-focus';
    }

    return {
      strokeColor: nextColor,
      strokeWidth: nextWidth,
      fontSize: firstText ? firstText.fontSize : state.fontSize,
      fontFamily: firstText ? firstText.fontFamily || 'Arial' : state.fontFamily,
      arrowStyle: firstArrow ? firstArrow.arrowStyle || 'standard' : state.arrowStyle,
      arrowCurveDirection: firstArrow ? firstArrow.curveDirection || 'right' : state.arrowCurveDirection,
      magnifierMode: nextMagMode,
      redactionLevel: firstRedaction
        ? firstRedaction.level ?? (firstRedaction.effect === 'blur' ? 3 : 4)
        : state.redactionLevel,
      redactionEffect: firstRedaction
        ? firstRedaction.effect ?? (firstRedaction.level === 4 ? 'blackout' : 'blur')
        : state.redactionEffect,
      redactionMode: firstRedaction ? firstRedaction.mode : state.redactionMode,
    };
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setImageBase64: (image: string) => {
      currentImageBase64 = image;
    },

    getCurrentImageBase64: () => currentImageBase64,

    setOnRestoreImage: (callback: (captureId: string, imageBase64: string) => void) => {
      onRestoreImage = callback;
    },

    /**
     * Alterna o contexto de edição para outra captura da galeria,
     * mantendo os blocos, histórico Undo/Redo e bloqueio totalmente independentes por imagem.
     */
    switchCapture: (captureId: string, initialImageBase64?: string) => {
      if (!captureId || captureId === activeCaptureId) {
        if (initialImageBase64 && !currentImageBase64) {
          currentImageBase64 = initialImageBase64;
        }
        return;
      }

      saveCurrentSession();

      activeCaptureId = captureId;
      const targetSession = sessions.get(captureId);

      undoStack.length = 0;
      redoStack.length = 0;

      if (targetSession) {
        targetSession.undoStack.forEach((snap) =>
          undoStack.push({
            annotations: [...snap.annotations],
            imageBase64: snap.imageBase64,
          })
        );
        targetSession.redoStack.forEach((snap) =>
          redoStack.push({
            annotations: [...snap.annotations],
            imageBase64: snap.imageBase64,
          })
        );
        currentImageBase64 = targetSession.imageBase64 || initialImageBase64 || '';
        state = {
          ...state,
          annotations: [...targetSession.annotations],
          isLocked: targetSession.isLocked,
          selectedId: null,
          selectedIds: [],
        };
      } else {
        currentImageBase64 = initialImageBase64 || '';
        state = {
          ...state,
          annotations: [],
          isLocked: false,
          selectedId: null,
          selectedIds: [],
        };
        saveCurrentSession();
      }

      notify();
    },

    removeCaptureSession: (captureId: string) => {
      sessions.delete(captureId);
    },

    setActiveTool: (tool: ToolType) => {
      if (state.activeTool === tool) return;
      state = { ...state, activeTool: tool, selectedId: null, selectedIds: [] };
      notify();
    },

    setSelectedId: (id: string | null) => {
      const ids = id ? [id] : [];
      const synced = syncToolbarWithSelection(ids, state.annotations);
      state = {
        ...state,
        ...synced,
        selectedId: id,
        selectedIds: ids,
      };
      notify();
    },

    setSelectedIds: (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids));
      const synced = syncToolbarWithSelection(uniqueIds, state.annotations);
      state = {
        ...state,
        ...synced,
        selectedId: uniqueIds[0] ?? null,
        selectedIds: uniqueIds,
      };
      notify();
    },

    toggleSelectedId: (id: string) => {
      const exists = state.selectedIds.includes(id);
      const nextIds = exists
        ? state.selectedIds.filter((item) => item !== id)
        : [...state.selectedIds, id];
      const synced = syncToolbarWithSelection(nextIds, state.annotations);
      state = {
        ...state,
        ...synced,
        selectedId: nextIds[0] ?? null,
        selectedIds: nextIds,
      };
      notify();
    },

    setStrokeColor: (color: string) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        pushUndoSnapshot();
        state = {
          ...state,
          strokeColor: color,
          annotations: state.annotations.map((ann) => {
            if (!selectedSet.has(ann.id)) return ann;
            if (ann.type === 'text') {
              return { ...ann, fill: color };
            }
            return { ...ann, stroke: color };
          }),
        };
      } else {
        state = { ...state, strokeColor: color };
      }
      notify();
    },

    setStrokeWidth: (width: number) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        pushUndoSnapshot();
        state = {
          ...state,
          strokeWidth: width,
          annotations: state.annotations.map((ann) => {
            if (!selectedSet.has(ann.id)) return ann;
            return {
              ...ann,
              strokeWidth: width,
            };
          }),
        };
      } else {
        state = { ...state, strokeWidth: width };
      }
      notify();
    },

    setFontSize: (size: number) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedText = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'text'
        );
        if (hasSelectedText) {
          pushUndoSnapshot();
          state = {
            ...state,
            fontSize: size,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'text') return ann;
              return {
                ...ann,
                fontSize: size,
                scaleX: 1,
                scaleY: 1,
              };
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, fontSize: size };
      notify();
    },

    setFontFamily: (family: string) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedText = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'text'
        );
        if (hasSelectedText) {
          pushUndoSnapshot();
          state = {
            ...state,
            fontFamily: family,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'text') return ann;
              return {
                ...ann,
                fontFamily: family,
              };
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, fontFamily: family };
      notify();
    },

    setArrowStyle: (style: ArrowStyle) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedArrow = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'arrow'
        );
        if (hasSelectedArrow) {
          pushUndoSnapshot();
          state = {
            ...state,
            arrowStyle: style,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'arrow') return ann;

              let nextPoints = ann.points;
              const curveDir = ann.curveDirection || state.arrowCurveDirection || 'right';
              if (style === 'curved' && ann.points.length === 4) {
                nextPoints = calculateCurvedArrowPoints(
                  ann.points[0],
                  ann.points[1],
                  ann.points[2],
                  ann.points[3],
                  curveDir
                );
              } else if (style !== 'curved' && ann.points.length >= 6) {
                nextPoints = [
                  ann.points[0],
                  ann.points[1],
                  ann.points[ann.points.length - 2],
                  ann.points[ann.points.length - 1],
                ];
              }

              const nextStroke =
                style === 'thin' && (!ann.strokeWidth || ann.strokeWidth === 4)
                  ? 2
                  : style !== 'thin' && ann.strokeWidth === 2
                  ? 4
                  : ann.strokeWidth;

              return {
                ...ann,
                arrowStyle: style,
                strokeWidth: nextStroke,
                curveDirection:
                  style === 'curved'
                    ? ann.curveDirection || state.arrowCurveDirection || 'right'
                    : ann.curveDirection,
                points: nextPoints,
              };
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, arrowStyle: style };
      notify();
    },

    toggleArrowCurveDirection: (targetId?: string) => {
      const targetArrowId =
        targetId ||
        state.selectedIds.find((id) => {
          const ann = state.annotations.find((a) => a.id === id);
          return ann?.type === 'arrow';
        });

      const nextGlobalDir: ArrowCurveDirection =
        state.arrowCurveDirection === 'left' ? 'right' : 'left';

      if (targetArrowId && !state.isLocked) {
        const ann = state.annotations.find((a) => a.id === targetArrowId);
        if (ann && ann.type === 'arrow') {
          const currentDir = ann.curveDirection || state.arrowCurveDirection || 'right';
          const flippedDir: ArrowCurveDirection = currentDir === 'left' ? 'right' : 'left';
          pushUndoSnapshot();

          let nextPoints = ann.points;
          if (ann.points.length >= 6) {
            nextPoints = invertCurvedArrowPoints(ann.points);
          } else if (ann.points.length === 4) {
            nextPoints = calculateCurvedArrowPoints(
              ann.points[0],
              ann.points[1],
              ann.points[2],
              ann.points[3],
              flippedDir
            );
          }

          state = {
            ...state,
            arrowCurveDirection: flippedDir,
            annotations: state.annotations.map((a) => {
              if (a.id !== targetArrowId || a.type !== 'arrow') return a;
              return {
                ...a,
                arrowStyle: 'curved',
                curveDirection: flippedDir,
                points: nextPoints,
              };
            }),
          };
          notify();
          return;
        }
      }

      state = { ...state, arrowCurveDirection: nextGlobalDir };
      notify();
    },

    setMagnifierMode: (mode: MagnifierMode) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedMag = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'magnifier'
        );
        if (hasSelectedMag) {
          pushUndoSnapshot();
          state = {
            ...state,
            magnifierMode: mode,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'magnifier') return ann;
              if (mode === 'without-focus') {
                return {
                  ...ann,
                  focusX: undefined,
                  focusY: undefined,
                };
              } else {
                const isAlreadyDetached =
                  ann.focusX !== undefined &&
                  ann.focusY !== undefined &&
                  Math.hypot(ann.focusX - ann.x, ann.focusY - ann.y) > 4;
                return {
                  ...ann,
                  focusX: isAlreadyDetached ? ann.focusX : Math.max(0, ann.x - 110),
                  focusY: isAlreadyDetached ? ann.focusY : ann.y + 85,
                };
              }
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, magnifierMode: mode };
      notify();
    },

    setRedactionLevel: (level: RedactionLevel) => {
      const effect: RedactionEffect = level === 4 ? 'blackout' : 'blur';
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedRedaction = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'redaction'
        );
        if (hasSelectedRedaction) {
          pushUndoSnapshot();
          state = {
            ...state,
            redactionLevel: level,
            redactionEffect: effect,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'redaction') return ann;
              return {
                ...ann,
                level,
                effect,
              };
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, redactionLevel: level, redactionEffect: effect };
      notify();
    },

    setRedactionEffect: (effect: RedactionEffect) => {
      const currentLevel = state.redactionLevel;
      const level: RedactionLevel =
        effect === 'blackout'
          ? 4
          : currentLevel && currentLevel >= 1 && currentLevel <= 3
            ? currentLevel
            : 3;
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedRedaction = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'redaction'
        );
        if (hasSelectedRedaction) {
          pushUndoSnapshot();
          state = {
            ...state,
            redactionEffect: effect,
            redactionLevel: level,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'redaction') return ann;
              return {
                ...ann,
                effect,
                level:
                  effect === 'blackout'
                    ? 4
                    : ann.level && ann.level >= 1 && ann.level <= 3
                      ? ann.level
                      : level,
              };
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, redactionEffect: effect, redactionLevel: level };
      notify();
    },

    setRedactionMode: (mode: RedactionMode) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        const hasSelectedRedaction = state.annotations.some(
          (ann) => selectedSet.has(ann.id) && ann.type === 'redaction'
        );
        if (hasSelectedRedaction) {
          pushUndoSnapshot();
          state = {
            ...state,
            redactionMode: mode,
            annotations: state.annotations.map((ann) => {
              if (!selectedSet.has(ann.id) || ann.type !== 'redaction') return ann;
              return {
                ...ann,
                mode,
              };
            }),
          };
          notify();
          return;
        }
      }
      state = { ...state, redactionMode: mode };
      notify();
    },

    regenerateSmartText: (id: string) => {
      const ann = state.annotations.find((a) => a.id === id) as RedactionAnnotation | undefined;
      if (!ann || ann.type !== 'redaction' || ann.mode !== 'smart-text' || !ann.lines) {
        return;
      }

      pushUndoSnapshot();

      const regeneratedLines: AnonymizedLine[] = ann.lines.map((line) => {
        const regeneratedWords = line.words.map((w) => ({
          ...w,
          replacementText: anonymizeWord(w.originalText || w.text),
        }));
        const replacementText = regeneratedWords.map((w) => w.replacementText).join(' ');
        return {
          ...line,
          words: regeneratedWords,
          replacementText,
        };
      });

      const nextAnnotations = state.annotations.map((a) =>
        a.id === id ? ({ ...a, lines: regeneratedLines } as Annotation) : a
      );

      state = {
        ...state,
        annotations: nextAnnotations,
      };
      notify();
    },

    isLocked: () => state.isLocked,
    setLocked: (locked: boolean) => {
      state = { ...state, isLocked: locked };
      notify();
    },

    applyCrop: (newAnnotations: Annotation[], croppedImageBase64: string) => {
      pushUndoSnapshot();
      currentImageBase64 = croppedImageBase64;
      state = {
        ...state,
        annotations: newAnnotations,
        selectedId: null,
        selectedIds: [],
        isLocked: false,
      };
      notify();
    },

    replaceAnnotations: (newAnnotations: Annotation[], newImageBase64?: string) => {
      pushUndoSnapshot();
      if (newImageBase64) {
        currentImageBase64 = newImageBase64;
      }
      state = {
        ...state,
        annotations: newAnnotations,
        selectedId: null,
        selectedIds: [],
        isLocked: false,
      };
      notify();
    },

    addAnnotation: (annotation: Annotation) => {
      pushUndoSnapshot();
      state = {
        ...state,
        annotations: [...state.annotations, annotation],
        selectedId: annotation.id,
        selectedIds: [annotation.id],
        isLocked: false,
      };
      notify();
    },

    updateAnnotation: (id: string, updates: Partial<Annotation>) => {
      pushUndoSnapshot();
      const nextAnnotations = state.annotations.map((a) =>
        a.id === id ? ({ ...a, ...updates } as Annotation) : a
      );
      const synced = syncToolbarWithSelection(state.selectedIds, nextAnnotations);
      state = {
        ...state,
        ...synced,
        annotations: nextAnnotations,
        isLocked: false,
      };
      notify();
    },

    updateAnnotations: (updatesById: Record<string, Partial<Annotation>>) => {
      const ids = Object.keys(updatesById);
      if (ids.length === 0) return;
      pushUndoSnapshot();
      const nextAnnotations = state.annotations.map((a) =>
        updatesById[a.id] ? ({ ...a, ...updatesById[a.id] } as Annotation) : a
      );
      const synced = syncToolbarWithSelection(state.selectedIds, nextAnnotations);
      state = {
        ...state,
        ...synced,
        annotations: nextAnnotations,
        isLocked: false,
      };
      notify();
    },

    removeAnnotation: (id: string) => {
      pushUndoSnapshot();
      const nextSelectedIds = state.selectedIds.filter((item) => item !== id);
      state = {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== id),
        selectedId: nextSelectedIds[0] ?? null,
        selectedIds: nextSelectedIds,
      };
      notify();
    },

    removeSelectedAnnotation: (): boolean => {
      const targets =
        state.selectedIds.length > 0
          ? state.selectedIds
          : state.selectedId
            ? [state.selectedId]
            : [];
      if (targets.length === 0 || state.isLocked) {
        return false;
      }
      const targetSet = new Set(targets);
      const exists = state.annotations.some((a) => targetSet.has(a.id));
      if (!exists) {
        return false;
      }
      pushUndoSnapshot();
      state = {
        ...state,
        annotations: state.annotations.filter((a) => !targetSet.has(a.id)),
        selectedId: null,
        selectedIds: [],
      };
      notify();
      return true;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    undo: () => {
      if (undoStack.length === 0) return;
      redoStack.push({
        annotations: [...state.annotations],
        imageBase64: currentImageBase64,
      });
      const prev = undoStack.pop()!;
      const prevImage = prev.imageBase64;
      const imageChanged = Boolean(prevImage && prevImage !== currentImageBase64);
      if (imageChanged && prevImage) {
        currentImageBase64 = prevImage;
        if (onRestoreImage) {
          onRestoreImage(activeCaptureId, prevImage);
        }
      }
      state = { ...state, annotations: prev.annotations, selectedId: null, selectedIds: [] };
      notify();
    },

    redo: () => {
      if (redoStack.length === 0) return;
      undoStack.push({
        annotations: [...state.annotations],
        imageBase64: currentImageBase64,
      });
      const next = redoStack.pop()!;
      const nextImage = next.imageBase64;
      const imageChanged = Boolean(nextImage && nextImage !== currentImageBase64);
      if (imageChanged && nextImage) {
        currentImageBase64 = nextImage;
        if (onRestoreImage) {
          onRestoreImage(activeCaptureId, nextImage);
        }
      }
      state = { ...state, annotations: next.annotations, selectedId: null, selectedIds: [] };
      notify();
    },
  };
}
