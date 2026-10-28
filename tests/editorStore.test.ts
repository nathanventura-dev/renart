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

  it('updates color and strokeWidth independently only on the selected block(s)', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'rect-1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });
    store.addAnnotation({
      id: 'rect-2',
      type: 'rect',
      x: 100,
      y: 100,
      width: 60,
      height: 60,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });
    store.addAnnotation({
      id: 'text-1',
      type: 'text',
      x: 200,
      y: 200,
      text: 'Olá',
      fontSize: 16,
      fill: '#ff3b30',
    });

    // Seleciona apenas rect-1 e altera cor e espessura
    store.setSelectedId('rect-1');
    store.setStrokeColor('#34c759');
    store.setStrokeWidth(8);

    const r1 = store.getState().annotations.find((a) => a.id === 'rect-1')!;
    const r2 = store.getState().annotations.find((a) => a.id === 'rect-2')!;
    expect(r1.stroke).toBe('#34c759');
    expect(r1.strokeWidth).toBe(8);
    // rect-2 não estava selecionado e deve manter seus atributos originais
    expect(r2.stroke).toBe('#ff3b30');
    expect(r2.strokeWidth).toBe(3);

    // Seleciona text-1 e altera a cor
    store.setSelectedId('text-1');
    store.setStrokeColor('#0071e3');
    const t1 = store.getState().annotations.find((a) => a.id === 'text-1')!;
    if (t1.type === 'text') {
      expect(t1.fill).toBe('#0071e3');
    }
  });

  it('manages Auto stroke width per block and as default for newly added blocks', () => {
    const store = createEditorStore();
    // Por padrão, Auto vem ativo
    expect(store.getState().autoStrokeWidth).toBe(true);

    store.addAnnotation({
      id: 'rect-auto-1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 80,
      height: 60,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });
    store.addAnnotation({
      id: 'rect-auto-2',
      type: 'rect',
      x: 120,
      y: 10,
      width: 80,
      height: 60,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });

    // Ambos recebem autoStrokeWidth = true ao serem criados com Auto ativo
    expect(store.getState().annotations[0].autoStrokeWidth).toBe(true);
    expect(store.getState().annotations[1].autoStrokeWidth).toBe(true);

    // Seleciona apenas rect-auto-1 e define uma espessura fixa (5px) -> desativa o Auto apenas em rect-auto-1
    store.setSelectedId('rect-auto-1');
    store.setStrokeWidth(5);

    const a1 = store.getState().annotations.find((a) => a.id === 'rect-auto-1')!;
    const a2 = store.getState().annotations.find((a) => a.id === 'rect-auto-2')!;
    expect(a1.strokeWidth).toBe(5);
    expect(a1.autoStrokeWidth).toBe(false);
    expect(a2.strokeWidth).toBe(3);
    expect(a2.autoStrokeWidth).toBe(true);

    // Reativa a opção "Auto" com rect-auto-1 selecionado -> volta rect-auto-1 para autoStrokeWidth = true
    store.setAutoStrokeWidth(true);
    const a1AfterAuto = store.getState().annotations.find((a) => a.id === 'rect-auto-1')!;
    expect(a1AfterAuto.autoStrokeWidth).toBe(true);
    expect(store.getState().autoStrokeWidth).toBe(true);
  });

  it('supports multi-selection of blocks to move, resize, delete, or change color and strokeWidth together', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'b1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      stroke: '#ff3b30',
      strokeWidth: 2,
    });
    store.addAnnotation({
      id: 'b2',
      type: 'arrow',
      x: 0,
      y: 0,
      points: [60, 10, 110, 50],
      stroke: '#ff3b30',
      strokeWidth: 2,
    });
    store.addAnnotation({
      id: 'b3',
      type: 'ellipse',
      x: 300,
      y: 300,
      radiusX: 30,
      radiusY: 30,
      stroke: '#ff3b30',
      strokeWidth: 2,
    });

    // Seleciona múltiplos blocos (b1 e b2)
    store.setSelectedIds(['b1', 'b2']);
    expect(store.getState().selectedIds).toEqual(['b1', 'b2']);

    // Altera cor e espessura de todos os blocos selecionados simultaneamente
    store.setStrokeColor('#5856d6');
    store.setStrokeWidth(8);

    const [b1, b2, b3] = store.getState().annotations;
    expect(b1.stroke).toBe('#5856d6');
    expect(b1.strokeWidth).toBe(8);
    expect(b2.stroke).toBe('#5856d6');
    expect(b2.strokeWidth).toBe(8);
    // b3 não estava na multiseleção e permanece inalterado
    expect(b3.stroke).toBe('#ff3b30');
    expect(b3.strokeWidth).toBe(2);

    // Move os blocos selecionados em lote
    store.updateAnnotations({
      b1: { x: 30, y: 40 },
      b2: { x: 20, y: 30 },
    });
    expect(store.getState().annotations[0].x).toBe(30);
    expect(store.getState().annotations[1].x).toBe(20);

    // Apaga todos os blocos da multiseleção com Delete
    const deleted = store.removeSelectedAnnotation();
    expect(deleted).toBe(true);
    expect(store.getState().annotations).toHaveLength(1);
    expect(store.getState().annotations[0].id).toBe('b3');

    // Desfazer restaura ambos os blocos apagados
    store.undo();
    expect(store.getState().annotations).toHaveLength(3);
  });
});
