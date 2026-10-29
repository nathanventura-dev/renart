// tests/editorStore.test.ts
import { describe, it, expect } from 'vitest';
import {
  createEditorStore,
  Annotation,
  STROKE_WIDTHS,
  shouldShowTextControls,
  shouldShowArrowControls,
  shouldShowMagnifierControls,
} from '../src/state/editorStore';

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

  it('manages STROKE_WIDTHS scale and sets stroke width on selected blocks without auto mode', () => {
    expect(STROKE_WIDTHS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const store = createEditorStore();
    expect(store.getState().strokeWidth).toBe(4);

    store.addAnnotation({
      id: 'rect-width-1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 80,
      height: 60,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });

    // Seleciona rect-width-1 e define uma espessura (7px) -> atualiza imediatamente
    store.setSelectedId('rect-width-1');
    store.setStrokeWidth(7);

    const a1 = store.getState().annotations.find((a) => a.id === 'rect-width-1')!;
    expect(a1.strokeWidth).toBe(7);
    expect(store.getState().strokeWidth).toBe(7);

    // Undo desfaz a alteração de espessura
    store.undo();
    const a1Undone = store.getState().annotations.find((a) => a.id === 'rect-width-1')!;
    expect(a1Undone.strokeWidth).toBe(3);

    // Redo reaplica
    store.redo();
    const a1Redone = store.getState().annotations.find((a) => a.id === 'rect-width-1')!;
    expect(a1Redone.strokeWidth).toBe(7);
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

  it('supports adding, styling, and undo/redo of line annotations for underlining text', () => {
    const store = createEditorStore();
    store.setActiveTool('line');
    expect(store.getState().activeTool).toBe('line');

    store.addAnnotation({
      id: 'line-1',
      type: 'line',
      x: 0,
      y: 0,
      points: [50, 120, 250, 120],
      stroke: '#ff3b30',
      strokeWidth: 3,
    });

    const added = store.getState().annotations[0];
    expect(added.type).toBe('line');
    if (added.type === 'line') {
      expect(added.points).toEqual([50, 120, 250, 120]);
    }

    // Altera cor e espessura da linha selecionada
    store.setStrokeColor('#0071e3');
    store.setStrokeWidth(5);
    const updated = store.getState().annotations[0];
    expect(updated.stroke).toBe('#0071e3');
    expect(updated.strokeWidth).toBe(5);
  });

  it('supports contextual fontFamily and fontSize selection per text block with undo/redo and mixed selection safety', () => {
    const store = createEditorStore();
    expect(store.getState().fontFamily).toBe('Arial');
    expect(store.getState().fontSize).toBe(18);

    // Contexto da barra: exibe controles de texto quando a ferramenta é 'text' ou há bloco 'text' selecionado
    expect(shouldShowTextControls('text', [])).toBe(true);
    expect(shouldShowTextControls('rect', [])).toBe(false);

    store.addAnnotation({
      id: 'txt-1',
      type: 'text',
      x: 40,
      y: 40,
      text: 'Título Principal',
      fontSize: 18,
      fontFamily: 'Arial',
      fill: '#ff3b30',
    });
    store.addAnnotation({
      id: 'txt-2',
      type: 'text',
      x: 40,
      y: 90,
      text: 'Subtítulo',
      fontSize: 18,
      fontFamily: 'Arial',
      fill: '#ff3b30',
    });
    store.addAnnotation({
      id: 'rect-mix',
      type: 'rect',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });

    // Quando selecionamos um bloco de texto com a ferramenta 'select', shouldShowTextControls deve retornar true
    const selectedTextOnly = store.getState().annotations.filter((a) => a.id === 'txt-1');
    expect(shouldShowTextControls('select', selectedTextOnly)).toBe(true);

    // Seleciona apenas txt-1 (+ rect-mix em seleção mista) e altera a fonte para 'Georgia' e tamanho para 32
    store.setSelectedIds(['txt-1', 'rect-mix']);
    store.setFontFamily('Georgia');
    store.setFontSize(32);

    const t1 = store.getState().annotations.find((a) => a.id === 'txt-1')!;
    const t2 = store.getState().annotations.find((a) => a.id === 'txt-2')!;
    const rMix = store.getState().annotations.find((a) => a.id === 'rect-mix')!;

    expect(t1.type === 'text' && t1.fontFamily).toBe('Georgia');
    expect(t1.type === 'text' && t1.fontSize).toBe(32);
    // txt-2 não estava selecionado e mantém 'Arial' 18
    expect(t2.type === 'text' && t2.fontFamily).toBe('Arial');
    expect(t2.type === 'text' && t2.fontSize).toBe(18);
    // rect-mix permanece intacto
    expect(rMix.type).toBe('rect');

    // Undo reverte o tamanho (32 -> 18) e o próximo Undo reverte a fonte ('Georgia' -> 'Arial')
    store.undo();
    const t1AfterUndoSize = store.getState().annotations.find((a) => a.id === 'txt-1')!;
    expect(t1AfterUndoSize.type === 'text' && t1AfterUndoSize.fontSize).toBe(18);

    store.undo();
    const t1AfterUndoFont = store.getState().annotations.find((a) => a.id === 'txt-1')!;
    expect(t1AfterUndoFont.type === 'text' && t1AfterUndoFont.fontFamily).toBe('Arial');

    // Quando o bloco de texto é redimensionado no canvas (updateAnnotation altera fontSize e reseta scaleX/scaleY),
    // o estado fontSize da barra superior sincroniza automaticamente com o novo tamanho
    store.setSelectedIds(['txt-1']);
    store.updateAnnotation('txt-1', { fontSize: 36, scaleX: 1, scaleY: 1 });
    expect(store.getState().fontSize).toBe(36);
  });

  it('replaces all annotations during crop and supports undo/redo stack', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'ann-1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      stroke: '#ff0000',
    });
    store.addAnnotation({
      id: 'ann-2',
      type: 'rect',
      x: 200,
      y: 200,
      width: 50,
      height: 50,
      stroke: '#00ff00',
    });
    expect(store.getState().annotations).toHaveLength(2);

    // Substitui annotations (como após recorte)
    const croppedAnnotations: Annotation[] = [
      {
        id: 'ann-1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        stroke: '#ff0000',
      },
    ];
    store.replaceAnnotations(croppedAnnotations);
    expect(store.getState().annotations).toHaveLength(1);
    expect(store.getState().annotations[0].x).toBe(0);

    // Undo restaura as 2 anotações originais
    store.undo();
    expect(store.getState().annotations).toHaveLength(2);
    expect(store.getState().annotations[0].x).toBe(10);
    expect(store.getState().annotations[1].x).toBe(200);

    // Redo reaplica as anotações recortadas
    store.redo();
    expect(store.getState().annotations).toHaveLength(1);
    expect(store.getState().annotations[0].x).toBe(0);
  });

  it('restores previous background image when undoing crop and reapplies on redo', () => {
    let restoredImage: string | null = null;
    const store = createEditorStore(undefined, (_capId, img) => {
      restoredImage = img;
    });

    const originalImage = 'data:image/png;base64,ORIGINAL_IMAGE_DATA';
    const croppedImage = 'data:image/png;base64,CROPPED_IMAGE_DATA';

    store.setImageBase64(originalImage);
    store.addAnnotation({
      id: 'ann-1',
      type: 'rect',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      stroke: '#ff0000',
    });

    // Aplica o recorte
    const croppedAnnotations: Annotation[] = [
      {
        id: 'ann-1',
        type: 'rect',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        stroke: '#ff0000',
      },
    ];
    store.applyCrop(croppedAnnotations, croppedImage);

    expect(store.getState().annotations[0].x).toBe(10);
    expect(store.getCurrentImageBase64()).toBe(croppedImage);

    // Desfaz (Ctrl+Z): deve restaurar a imagem original E as anotações originais
    store.undo();
    expect(store.getState().annotations[0].x).toBe(50);
    expect(store.getCurrentImageBase64()).toBe(originalImage);
    expect(restoredImage).toBe(originalImage);

    // Refaz (Ctrl+Shift+Z / Redo): deve reaplicar a imagem recortada E as anotações recortadas
    store.redo();
    expect(store.getState().annotations[0].x).toBe(10);
    expect(store.getCurrentImageBase64()).toBe(croppedImage);
    expect(restoredImage).toBe(croppedImage);
  });

  it('manages arrow styles and arrow curve direction with undo/redo', () => {
    const store = createEditorStore();
    expect(store.getState().arrowStyle).toBe('standard');
    expect(store.getState().arrowCurveDirection).toBe('right');

    // Mudar estilo padrão de flecha
    store.setArrowStyle('curved');
    expect(store.getState().arrowStyle).toBe('curved');

    // Adicionar flecha e selecionar
    store.addAnnotation({
      id: 'arrow-1',
      type: 'arrow',
      points: [10, 20, 100, 120],
      stroke: '#ff3b30',
      strokeWidth: 4,
      arrowStyle: 'standard',
    });
    store.setSelectedIds(['arrow-1']);

    // Alterar estilo da flecha selecionada
    store.setArrowStyle('dashed');
    const ann1 = store.getState().annotations.find((a) => a.id === 'arrow-1');
    expect(ann1?.type === 'arrow' && ann1.arrowStyle).toBe('dashed');

    // Undo restaura para standard
    store.undo();
    const ann1Undo = store.getState().annotations.find((a) => a.id === 'arrow-1');
    expect(ann1Undo?.type === 'arrow' && ann1Undo.arrowStyle).toBe('standard');

    // Redo reaplica dashed
    store.redo();
    const ann1Redo = store.getState().annotations.find((a) => a.id === 'arrow-1');
    expect(ann1Redo?.type === 'arrow' && ann1Redo.arrowStyle).toBe('dashed');

    // Alternar direção da curvatura com elemento selecionado
    store.setSelectedIds(['arrow-1']);
    store.setArrowStyle('curved');
    expect(store.getState().arrowCurveDirection).toBe('right');
    const ann1BeforeToggle = store.getState().annotations.find((a) => a.id === 'arrow-1');
    const midYBefore = ann1BeforeToggle?.type === 'arrow' ? ann1BeforeToggle.points[3] : 0;

    store.toggleArrowCurveDirection('arrow-1');
    const ann1Curved = store.getState().annotations.find((a) => a.id === 'arrow-1');
    expect(ann1Curved?.type === 'arrow' && ann1Curved.curveDirection).toBe('left');
    // Ao alternar a direção, os pontos da flecha selecionada DEVEM mudar de lado imediatamente
    const midYAfter = ann1Curved?.type === 'arrow' ? ann1Curved.points[3] : 0;
    expect(midYAfter).not.toBe(midYBefore);

    // Undo alterna de volta para right e restaura as coordenadas da curva
    store.undo();
    const ann1CurvedUndo = store.getState().annotations.find((a) => a.id === 'arrow-1');
    expect(ann1CurvedUndo?.type === 'arrow' && ann1CurvedUndo.curveDirection).toBe('right');
    expect(ann1CurvedUndo?.type === 'arrow' && ann1CurvedUndo.points[3]).toBe(midYBefore);
  });

  it('determines when arrow controls should be shown in toolbar', () => {
    expect(shouldShowArrowControls('arrow', [])).toBe(true);
    expect(shouldShowArrowControls('select', [])).toBe(false);

    const arrowAnn: Annotation = {
      id: 'arrow-2',
      type: 'arrow',
      points: [0, 0, 50, 50],
      stroke: '#0071e3',
    };
    const rectAnn: Annotation = {
      id: 'rect-2',
      type: 'rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      stroke: '#0071e3',
    };

    expect(shouldShowArrowControls('select', [arrowAnn])).toBe(true);
    expect(shouldShowArrowControls('select', [rectAnn])).toBe(false);
  });

  it('manages magnifier mode and updates selected magnifier block with undo/redo', () => {
    const store = createEditorStore();
    expect(store.getState().magnifierMode).toBe('without-focus');

    // Inicia lupa sem foco
    store.addAnnotation({
      id: 'mag-1',
      type: 'magnifier',
      x: 200,
      y: 200,
      radius: 65,
      zoomLevel: 2.0,
    });
    store.setSelectedIds(['mag-1']);

    // Alterna para com foco no elemento selecionado
    store.setMagnifierMode('with-focus');
    expect(store.getState().magnifierMode).toBe('with-focus');
    const magWithFocus = store.getState().annotations.find((a) => a.id === 'mag-1');
    expect(magWithFocus?.type === 'magnifier').toBe(true);
    if (magWithFocus && magWithFocus.type === 'magnifier') {
      expect(magWithFocus.focusX).toBeDefined();
      expect(magWithFocus.focusY).toBeDefined();
      expect(Math.hypot(magWithFocus.focusX! - magWithFocus.x, magWithFocus.focusY! - magWithFocus.y)).toBeGreaterThan(4);
    }

    // Alterna de volta para sem foco no elemento selecionado
    store.setMagnifierMode('without-focus');
    expect(store.getState().magnifierMode).toBe('without-focus');
    const magWithoutFocus = store.getState().annotations.find((a) => a.id === 'mag-1');
    if (magWithoutFocus && magWithoutFocus.type === 'magnifier') {
      expect(magWithoutFocus.focusX).toBeUndefined();
      expect(magWithoutFocus.focusY).toBeUndefined();
    }

    // Undo restaura com foco
    store.undo();
    const magRestored = store.getState().annotations.find((a) => a.id === 'mag-1');
    if (magRestored && magRestored.type === 'magnifier') {
      expect(magRestored.focusX).toBeDefined();
    }

    // Redo reaplica sem foco
    store.redo();
    const magRedone = store.getState().annotations.find((a) => a.id === 'mag-1');
    if (magRedone && magRedone.type === 'magnifier') {
      expect(magRedone.focusX).toBeUndefined();
    }

    // Determina se deve exibir controles de lupa na toolbar quando ativa ou selecionada
    expect(shouldShowMagnifierControls('magnifier', [])).toBe(true);
    expect(shouldShowMagnifierControls('select', [])).toBe(false);
    expect(shouldShowMagnifierControls('select', [magRestored!])).toBe(true);
  });
});
