export interface GalleryItem {
  id: string;
  title: string;
  dataUrl: string;
  createdAt: number;
}

export interface GalleryState {
  captures: GalleryItem[];
  activeId: string | null;
  maxCaptures: number;
}

export function createGalleryStore(maxCaptures: number = 10) {
  let state: GalleryState = {
    captures: [],
    activeId: null,
    maxCaptures,
  };

  const listeners: Set<() => void> = new Set();
  const notify = () => listeners.forEach((l) => l());

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    addCapture: (item: GalleryItem) => {
      let updated = [...state.captures, item];

      // Aplica política FIFO se exceder o limite máximo (10)
      if (updated.length > state.maxCaptures) {
        updated = updated.slice(updated.length - state.maxCaptures);
      }

      state = {
        ...state,
        captures: updated,
        activeId: item.id,
      };
      notify();
    },

    updateCaptureDataUrl: (id: string, dataUrl: string) => {
      state = {
        ...state,
        captures: state.captures.map((c) => (c.id === id ? { ...c, dataUrl } : c)),
      };
      notify();
    },

    removeCapture: (id: string) => {
      const remaining = state.captures.filter((c) => c.id !== id);
      let newActiveId = state.activeId;

      if (state.activeId === id) {
        newActiveId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }

      state = {
        ...state,
        captures: remaining,
        activeId: newActiveId,
      };
      notify();
    },

    setActive: (id: string) => {
      if (state.captures.some((c) => c.id === id)) {
        state = { ...state, activeId: id };
        notify();
      }
    },

    getActiveCapture: (): GalleryItem | null => {
      return state.captures.find((c) => c.id === state.activeId) || null;
    },
  };
}
