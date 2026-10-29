// tests/appFeatures.test.ts
import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/state/editorStore';
import { createGalleryStore } from '../src/state/galleryStore';
import { calculateCropCoordinates, captureDesktopFrame } from '../src/services/screenCaptureService';
import { CaptureMode } from '../src/types/capture';
import {
  resolveToolbarActionFeedback,
  getToolbarLayoutMetrics,
  ARROW_STYLE_OPTIONS,
  resolveArrowToolbarState,
  resolveMagnifierToolbarState,
} from '../src/components/Toolbar';

describe('App Enhanced Features & User Fixes', () => {
  it('handles paste of image dataUrl into gallery respecting 10 items limit', () => {
    const gallery = createGalleryStore(10);

    // Simula colagem de 3 imagens consecutivas
    for (let i = 1; i <= 3; i++) {
      gallery.addCapture({
        id: `pasted-${i}`,
        title: `Imagem Colada #${i}`,
        dataUrl: `data:image/png;base64,mockPaste${i}`,
        createdAt: Date.now() + i,
      });
    }

    expect(gallery.getState().captures).toHaveLength(3);
    expect(gallery.getState().activeId).toBe('pasted-3');
  });

  it('deselects annotation when escape key or clearSelection is called', () => {
    const editor = createEditorStore({
      annotations: [
        { id: 'item-1', type: 'rect', x: 10, y: 10, width: 50, height: 50, stroke: '#f00' }
      ],
      selectedId: 'item-1'
    });

    expect(editor.getState().selectedId).toBe('item-1');
    editor.setSelectedId(null);
    expect(editor.getState().selectedId).toBeNull();
  });

  it('manages isLocked / isSaved state for annotations upon Ctrl+S or saving', () => {
    const editor = createEditorStore();
    expect(editor.isLocked()).toBe(false);

    editor.setLocked(true);
    expect(editor.isLocked()).toBe(true);

    editor.setLocked(false);
    expect(editor.isLocked()).toBe(false);
  });

  it('supports inline text editing update without modal prompts', () => {
    const editor = createEditorStore();
    editor.addAnnotation({
      id: 'text-1',
      type: 'text',
      x: 100,
      y: 100,
      text: 'Texto Inicial',
      fontSize: 16
    });

    editor.updateAnnotation('text-1', { text: 'Texto Editado Diretamente' });
    const textAnn = editor.getState().annotations.find(a => a.id === 'text-1');
    expect(textAnn?.type).toBe('text');
    if (textAnn?.type === 'text') {
      expect(textAnn.text).toBe('Texto Editado Diretamente');
    }
  });

  it('deletes the currently selected block when removeSelectedAnnotation is invoked (Delete key) and supports undo', () => {
    const editor = createEditorStore();
    editor.addAnnotation({
      id: 'rect-del-1',
      type: 'rect',
      x: 20,
      y: 20,
      width: 100,
      height: 80,
      stroke: '#ff3b30',
    });
    editor.addAnnotation({
      id: 'mag-del-2',
      type: 'magnifier',
      x: 200,
      y: 200,
      radius: 65,
      zoomLevel: 2.0,
    });

    // O último bloco adicionado ('mag-del-2') está selecionado
    expect(editor.getState().selectedId).toBe('mag-del-2');
    expect(editor.getState().annotations).toHaveLength(2);

    // Pressionar Delete apaga o bloco selecionado
    const removed = editor.removeSelectedAnnotation();
    expect(removed).toBe(true);
    expect(editor.getState().annotations).toHaveLength(1);
    expect(editor.getState().annotations[0].id).toBe('rect-del-1');
    expect(editor.getState().selectedId).toBeNull();

    // Ctrl+Z (undo) restaura o bloco apagado
    editor.undo();
    expect(editor.getState().annotations).toHaveLength(2);
  });

  it('does not delete selected block when canvas is locked after saving', () => {
    const editor = createEditorStore({
      annotations: [
        { id: 'rect-locked', type: 'rect', x: 10, y: 10, width: 50, height: 50, stroke: '#000' },
      ],
      selectedId: 'rect-locked',
      isLocked: true,
    });

    const removed = editor.removeSelectedAnnotation();
    expect(removed).toBe(false);
    expect(editor.getState().annotations).toHaveLength(1);
  });

  it('isolates annotations, undo/redo history, and lock state per capture in the gallery', () => {
    const editor = createEditorStore();

    // Inicia na captura 1 e adiciona dois blocos
    editor.switchCapture('cap-1');
    editor.addAnnotation({
      id: 'rect-cap1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 80,
      height: 60,
      stroke: '#ff3b30',
    });
    editor.addAnnotation({
      id: 'arrow-cap1',
      type: 'arrow',
      points: [0, 0, 50, 50],
      stroke: '#007aff',
    });

    expect(editor.getState().annotations).toHaveLength(2);
    expect(editor.canUndo()).toBe(true);

    // Muda para a captura 2: deve estar limpa, sem os blocos da captura 1
    editor.switchCapture('cap-2');
    expect(editor.getState().annotations).toHaveLength(0);
    expect(editor.getState().selectedId).toBeNull();
    expect(editor.canUndo()).toBe(false);

    // Adiciona um bloco de texto apenas na captura 2
    editor.addAnnotation({
      id: 'text-cap2',
      type: 'text',
      x: 40,
      y: 40,
      text: 'Exclusivo da Captura 2',
      fontSize: 18,
    });
    expect(editor.getState().annotations).toHaveLength(1);
    expect(editor.getState().annotations[0].id).toBe('text-cap2');

    // Volta para a captura 1: deve preservar apenas os 2 blocos da captura 1
    editor.switchCapture('cap-1');
    expect(editor.getState().annotations).toHaveLength(2);
    expect(editor.getState().annotations.map((a) => a.id)).toEqual(['rect-cap1', 'arrow-cap1']);

    // Desfazer na captura 1 não afeta a captura 2
    editor.undo();
    expect(editor.getState().annotations).toHaveLength(1);

    editor.switchCapture('cap-2');
    expect(editor.getState().annotations).toHaveLength(1);
    expect(editor.getState().annotations[0].id).toBe('text-cap2');
  });

  it('calculates exact real-screen pixel crop coordinates from overlay selection bounds', () => {
    const crop = calculateCropCoordinates(
      { x: 100, y: 50, width: 400, height: 300 },
      1000,
      500,
      2000,
      1000
    );

    expect(crop).toEqual({
      sx: 200,
      sy: 100,
      sw: 800,
      sh: 600,
    });
  });

  it('resolves hover labels ("Copiar" / "Exportar") and click feedback ("Copiado") for right-side icon buttons', () => {
    // Sem hover e sem clique recente
    expect(resolveToolbarActionFeedback(null, false)).toEqual({
      copyBadge: null,
      exportBadge: null,
    });

    // Hover sobre o ícone de copiar mostra "Copiar"
    expect(resolveToolbarActionFeedback('copy', false)).toEqual({
      copyBadge: 'Copiar',
      exportBadge: null,
    });

    // Hover sobre o ícone de disquete (exportar) mostra "Exportar"
    expect(resolveToolbarActionFeedback('export', false)).toEqual({
      copyBadge: null,
      exportBadge: 'Exportar',
    });

    // Ao clicar em copiar, mostra "Copiado" perto do botão de copiar (mesmo com ou sem hover)
    expect(resolveToolbarActionFeedback('copy', true)).toEqual({
      copyBadge: 'Copiado',
      exportBadge: null,
    });
    expect(resolveToolbarActionFeedback(null, true)).toEqual({
      copyBadge: 'Copiado',
      exportBadge: null,
    });
  });

  it('enforces identical height and 3-column alignment (left capture, centered toolbar, right icons)', () => {
    const metrics = getToolbarLayoutMetrics();

    // Altura uniforme entre botão de captura, barra de ferramentas central e ícones da direita
    expect(metrics.captureButtonHeight).toBe('36px');
    expect(metrics.centerToolbarHeight).toBe('36px');
    expect(metrics.rightActionIconHeight).toBe('36px');
    expect(metrics.captureButtonHeight).toBe(metrics.centerToolbarHeight);
    expect(metrics.centerToolbarHeight).toBe(metrics.rightActionIconHeight);

    // Posicionamento: extremo esquerdo, centro e extremo direito
    expect(metrics.leftAlignment).toBe('flex-start');
    expect(metrics.centerAlignment).toBe('center');
    expect(metrics.rightAlignment).toBe('flex-end');
  });

  it('provides arrow toolbar styles, options and contextual flip state', () => {
    // 4 opções disponíveis
    expect(ARROW_STYLE_OPTIONS).toHaveLength(4);
    expect(ARROW_STYLE_OPTIONS.map((o) => o.id)).toEqual(['standard', 'thin', 'dashed', 'curved']);
    expect(ARROW_STYLE_OPTIONS.map((o) => o.label)).toEqual(['Padrão', 'Fina', 'Pontilhada', 'Curva']);

    // Com ferramenta flecha ativa e padrão
    const stateDefault = resolveArrowToolbarState('arrow', [], 'standard');
    expect(stateDefault.showArrowControls).toBe(true);
    expect(stateDefault.effectiveArrowStyle).toBe('standard');
    expect(stateDefault.showInvertCurve).toBe(false);

    // Com flecha curva ativa
    const stateCurved = resolveArrowToolbarState('arrow', [], 'curved');
    expect(stateCurved.showArrowControls).toBe(true);
    expect(stateCurved.effectiveArrowStyle).toBe('curved');
    expect(stateCurved.showInvertCurve).toBe(true);

    // Com ferramenta select sem seleção
    const stateSelectEmpty = resolveArrowToolbarState('select', [], 'standard');
    expect(stateSelectEmpty.showArrowControls).toBe(false);

    // Com ferramenta select e flecha curva selecionada
    const stateSelectCurvedArrow = resolveArrowToolbarState(
      'select',
      [{ id: 'arr-1', type: 'arrow', points: [0, 0, 10, 10], arrowStyle: 'curved' }],
      'standard'
    );
    expect(stateSelectCurvedArrow.showArrowControls).toBe(true);
    expect(stateSelectCurvedArrow.effectiveArrowStyle).toBe('curved');
    expect(stateSelectCurvedArrow.showInvertCurve).toBe(true);
  });

  it('provides magnifier toolbar state when tool is active or magnifier is selected', () => {
    // Com ferramenta lupa ativa
    const stateActive = resolveMagnifierToolbarState('magnifier', [], 'without-focus');
    expect(stateActive.showMagnifierControls).toBe(true);
    expect(stateActive.effectiveMagnifierMode).toBe('without-focus');

    // Com ferramenta select e lupa selecionada com foco desacoplado
    const stateSelectedWithFocus = resolveMagnifierToolbarState(
      'select',
      [{ id: 'm-1', type: 'magnifier', x: 100, y: 100, radius: 50, zoomLevel: 2, focusX: 20, focusY: 20 }],
      'without-focus'
    );
    expect(stateSelectedWithFocus.showMagnifierControls).toBe(true);
    expect(stateSelectedWithFocus.effectiveMagnifierMode).toBe('with-focus');

    // Com ferramenta select e lupa sem foco
    const stateSelectedWithoutFocus = resolveMagnifierToolbarState(
      'select',
      [{ id: 'm-2', type: 'magnifier', x: 100, y: 100, radius: 50, zoomLevel: 2 }],
      'with-focus'
    );
    expect(stateSelectedWithoutFocus.showMagnifierControls).toBe(true);
    expect(stateSelectedWithoutFocus.effectiveMagnifierMode).toBe('without-focus');

    // Com ferramenta select sem nenhuma lupa selecionada
    const stateEmpty = resolveMagnifierToolbarState('select', [], 'without-focus');
    expect(stateEmpty.showMagnifierControls).toBe(false);
  });

  it('supports window and fullscreen capture modes with displaySurface constraints', async () => {
    const validModes: CaptureMode[] = ['region', 'freeform', 'fullscreen', 'window'];
    expect(validModes).toContain('window');

    let requestedConstraints: any = null;
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: async (constraints: any) => {
          requestedConstraints = constraints;
          return null;
        },
      },
      configurable: true,
      writable: true,
    });

    try {
      await captureDesktopFrame('window');
      expect(requestedConstraints?.video?.displaySurface).toBe('window');

      await captureDesktopFrame('monitor');
      expect(requestedConstraints?.video?.displaySurface).toBe('monitor');
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
        writable: true,
      });
    }
  });
});
