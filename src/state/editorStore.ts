export type ToolType = 'select' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'image' | 'magnifier';

export interface BaseAnnotation {
  id: string;
  type: ToolType;
  x?: number;
  y?: number;
  stroke?: string;
  strokeWidth?: number;
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
}

export type Annotation =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | TextAnnotation
  | ImageAnnotation
  | MagnifierAnnotation;

export interface EditorState {
  annotations: Annotation[];
  activeTool: ToolType;
  selectedId: string | null;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  isLocked: boolean;
}

export function createEditorStore(initialState?: Partial<EditorState>) {
  let state: EditorState = {
    annotations: [],
    activeTool: 'select',
    selectedId: null,
    strokeColor: '#ff3b30',
    strokeWidth: 3,
    fontSize: 16,
    isLocked: false,
    ...initialState,
  };

  const undoStack: Annotation[][] = [];
  const redoStack: Annotation[][] = [];
  const listeners: Set<() => void> = new Set();

  const notify = () => listeners.forEach((l) => l());

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setActiveTool: (tool: ToolType) => {
      state = { ...state, activeTool: tool, selectedId: null };
      notify();
    },

    setSelectedId: (id: string | null) => {
      state = { ...state, selectedId: id };
      notify();
    },

    setStrokeColor: (color: string) => {
      state = { ...state, strokeColor: color };
      notify();
    },

    setStrokeWidth: (width: number) => {
      state = { ...state, strokeWidth: width };
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
      redoStack.length = 0; // limpa o redo ao fazer uma nova ação
      state = {
        ...state,
        annotations: [...state.annotations, annotation],
        selectedId: annotation.id,
        isLocked: false, // nova edição desbloqueia o canvas para movimentação
      };
      notify();
    },

    updateAnnotation: (id: string, updates: Partial<Annotation>) => {
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
      state = {
        ...state,
        annotations: state.annotations.map((a) => (a.id === id ? ({ ...a, ...updates } as Annotation) : a)),
        isLocked: false,
      };
      notify();
    },

    removeAnnotation: (id: string) => {
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
      state = {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
      notify();
    },

    removeSelectedAnnotation: (): boolean => {
      if (!state.selectedId || state.isLocked) {
        return false;
      }
      const targetId = state.selectedId;
      const exists = state.annotations.some((a) => a.id === targetId);
      if (!exists) {
        return false;
      }
      undoStack.push([...state.annotations]);
      redoStack.length = 0;
      state = {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== targetId),
        selectedId: null,
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
      state = { ...state, annotations: prev, selectedId: null };
      notify();
    },

    redo: () => {
      if (redoStack.length === 0) return;
      undoStack.push([...state.annotations]);
      const next = redoStack.pop()!;
      state = { ...state, annotations: next, selectedId: null };
      notify();
    },
  };
}
