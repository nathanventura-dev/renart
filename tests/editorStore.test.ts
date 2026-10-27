// tests/editorStore.test.ts
import { describe, it, expect } from 'vitest';
import { createEditorStore, Annotation } from '../src/state/editorStore';

describe('Editor Store', () => {
  it('adds an annotation and supports undo/redo stack', () => {
    const store = createEditorStore();
    const rect: Annotation = {
      id: 'ann-1',
      type: 'rect',
      x: 50,
      y: 60,
      width: 120,
      height: 80,
      stroke: '#ff0000',
      strokeWidth: 3,
    };

    store.addAnnotation(rect);
    expect(store.getState().annotations).toHaveLength(1);
    expect(store.getState().annotations[0].id).toBe('ann-1');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);

    // Undo
    store.undo();
    expect(store.getState().annotations).toHaveLength(0);
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(true);

    // Redo
    store.redo();
    expect(store.getState().annotations).toHaveLength(1);
    expect(store.getState().annotations[0].id).toBe('ann-1');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
  });

  it('updates an existing annotation position or dimensions', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'ann-2',
      type: 'ellipse',
      x: 100,
      y: 100,
      radiusX: 40,
      radiusY: 30,
      stroke: '#0071e3',
      strokeWidth: 2,
    });

    store.updateAnnotation('ann-2', { x: 150, radiusX: 60 });
    const updated = store.getState().annotations.find((a) => a.id === 'ann-2');
    expect(updated?.x).toBe(150);
    if (updated && updated.type === 'ellipse') {
      expect(updated.radiusX).toBe(60);
    }
  });

  it('removes an annotation by ID', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'ann-3',
      type: 'arrow',
      points: [10, 10, 100, 100],
      stroke: '#34c759',
      strokeWidth: 3,
    });

    expect(store.getState().annotations).toHaveLength(1);
    store.removeAnnotation('ann-3');
    expect(store.getState().annotations).toHaveLength(0);
  });

  it('changes active tool and color settings', () => {
    const store = createEditorStore();
    expect(store.getState().activeTool).toBe('select');

    store.setActiveTool('arrow');
    expect(store.getState().activeTool).toBe('arrow');

    store.setStrokeColor('#ff9f0a');
    expect(store.getState().strokeColor).toBe('#ff9f0a');

    store.setStrokeWidth(5);
    expect(store.getState().strokeWidth).toBe(5);
  });

  it('manages magnifier tool zoom factor and size', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'ann-mag-1',
      type: 'magnifier',
      x: 200,
      y: 200,
      radius: 50,
      zoomLevel: 2.5,
    });

    const mag = store.getState().annotations[0];
    expect(mag.type).toBe('magnifier');
    if (mag.type === 'magnifier') {
      expect(mag.zoomLevel).toBe(2.5);
    }
  });
});
