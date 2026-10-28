export type ToolType =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'image'
  | 'magnifier';

export interface BaseAnnotation {
  id: string;
  type: ToolType;
  x?: number;
  y?: number;
  stroke?: string;
  strokeWidth?: number;
  autoStrokeWidth?: boolean;
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

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  x?: number;
  y?: number;
  points: number[]; // [x1, y1, x2, y2]
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
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

export type Annotation =
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | ArrowAnnotation
  | TextAnnotation
  | ImageAnnotation
  | MagnifierAnnotation;

export interface EditorState {
  annotations: Annotation[];
  activeTool: ToolType;
  selectedId: string | null;
  selectedIds: string[];
  strokeColor: string;
  strokeWidth: number;
  autoStrokeWidth: boolean;
  fontSize: number;
  isLocked: boolean;
}

interface CaptureEditorSession {
  annotations: Annotation[];
  undoStack: Annotation[][];
  redoStack: Annotation[][];
  isLocked: boolean;
}

export function createEditorStore(initialState?: Partial<EditorState>) {
  const initialSelectedId = initialState?.selectedId ?? null;
  const initialSelectedIds =
    initialState?.selectedIds ?? (initialSelectedId ? [initialSelectedId] : []);

  let state: EditorState = {
    annotations: [],
    activeTool: 'select',
    selectedId: initialSelectedId,
    selectedIds: initialSelectedIds,
    strokeColor: '#ff3b30',
    strokeWidth: 3,
    autoStrokeWidth: true,
    fontSize: 16,
    isLocked: false,
    ...initialState,
  };

  let activeCaptureId: string = 'default';
  const sessions = new Map<string, CaptureEditorSession>();

  const undoStack: Annotation[][] = [];
  const redoStack: Annotation[][] = [];
  const listeners: Set<() => void> = new Set();

  const notify = () => listeners.forEach((l) => l());

  const saveCurrentSession = () => {
    sessions.set(activeCaptureId, {
      annotations: [...state.annotations],
      undoStack: undoStack.map((snap) => [...snap]),
      redoStack: redoStack.map((snap) => [...snap]),
      isLocked: state.isLocked,
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
    const nextAuto = firstSelected.autoStrokeWidth ?? state.autoStrokeWidth;

    return {
      strokeColor: nextColor,
      strokeWidth: nextWidth,
      autoStrokeWidth: nextAuto,
    };
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Alterna o contexto de edição para outra captura da galeria,
     * mantendo os blocos, histórico Undo/Redo e bloqueio totalmente independentes por imagem.
     */
    switchCapture: (captureId: string) => {
      if (!captureId || captureId === activeCaptureId) {
        return;
      }

      saveCurrentSession();

      activeCaptureId = captureId;
      const targetSession = sessions.get(captureId);

      undoStack.length = 0;
      redoStack.length = 0;

      if (targetSession) {
        targetSession.undoStack.forEach((snap) => undoStack.push([...snap]));
        targetSession.redoStack.forEach((snap) => redoStack.push([...snap]));
        state = {
          ...state,
          annotations: [...targetSession.annotations],
          isLocked: targetSession.isLocked,
          selectedId: null,
          selectedIds: [],
        };
      } else {
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
        undoStack.push([...state.annotations]);
        redoStack.length = 0;
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
        undoStack.push([...state.annotations]);
        redoStack.length = 0;
        state = {
          ...state,
          strokeWidth: width,
          autoStrokeWidth: false,
          annotations: state.annotations.map((ann) => {
            if (!selectedSet.has(ann.id)) return ann;
            return {
              ...ann,
              strokeWidth: width,
              autoStrokeWidth: false,
            };
          }),
        };
      } else {
        state = { ...state, strokeWidth: width };
      }
      notify();
    },

    setAutoStrokeWidth: (auto: boolean) => {
      if (state.selectedIds.length > 0 && !state.isLocked) {
        const selectedSet = new Set(state.selectedIds);
        undoStack.push([...state.annotations]);
        redoStack.length = 0;
        state = {
          ...state,
          autoStrokeWidth: auto,
          annotations: state.annotations.map((ann) => {
            if (!selectedSet.has(ann.id)) return ann;
            return {
              ...ann,
              autoStrokeWidth: auto,
            };
          }),
        };
      } else {
        state = { ...state, autoStrokeWidth: auto };
      }
      notify();
    },

    setFontSize: (size: number) => {
      state = { ...state, fontSize: size };
      notify();
    },

    isLocked: () => state.isLocked,
    setLocked: (locked: boolean) => {
      state = { ...state, isLocked: locked };
      notify();
    },

    addAnnotation: (annotation: Annotation) => {
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
      const withDefaults: Annotation = {
        ...annotation,
        autoStrokeWidth: annotation.autoStrokeWidth ?? state.autoStrokeWidth,
      };
      state = {
        ...state,
        annotations: [...state.annotations, withDefaults],
        selectedId: withDefaults.id,
        selectedIds: [withDefaults.id],
        isLocked: false,
      };
      notify();
    },

    updateAnnotation: (id: string, updates: Partial<Annotation>) => {
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
      state = {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === id ? ({ ...a, ...updates } as Annotation) : a
        ),
        isLocked: false,
      };
      notify();
    },

    updateAnnotations: (updatesById: Record<string, Partial<Annotation>>) => {
      const ids = Object.keys(updatesById);
      if (ids.length === 0) return;
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
      state = {
        ...state,
        annotations: state.annotations.map((a) =>
          updatesById[a.id] ? ({ ...a, ...updatesById[a.id] } as Annotation) : a
        ),
        isLocked: false,
      };
      notify();
    },

    removeAnnotation: (id: string) => {
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
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
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
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
      redoStack.push([...state.annotations]);
      const prev = undoStack.pop()!;
      state = { ...state, annotations: prev, selectedId: null, selectedIds: [] };
      notify();
    },

    redo: () => {
      if (redoStack.length === 0) return;
      undoStack.push([...state.annotations]);
      const next = redoStack.pop()!;
      state = { ...state, annotations: next, selectedId: null, selectedIds: [] };
      notify();
    },
  };
}
