import { RENART_THEME } from './theme/colors';
import React, { useState, useRef, useSyncExternalStore, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { Toolbar } from './components/Toolbar';
import { useTheme } from './hooks/useTheme';
import { Mascot } from './components/Mascot';
import {
  beginCapture,
  describeCaptureError,
  isTauri,
  onCaptureComplete,
  onCaptureError,
} from './services/captureService';
import { captureTitle } from './utils/captureTitle';
import { GallerySidebar } from './components/GallerySidebar';
import { CanvasEditor } from './components/CanvasEditor';
import { CaptureOverlay } from './components/CaptureOverlay';
import { createEditorStore, ToolType, Annotation, shouldShowTextControls } from './state/editorStore';
import { createGalleryStore } from './state/galleryStore';
import { exportCanvas, copyCanvasToClipboard, ExportFormat } from './services/exportService';
import { captureDesktopFrame, cropCapturedScreen } from './services/screenCaptureService';
import { CaptureMode, RectBounds, Point } from './types/capture';
import {
  CropBox,
  adjustAnnotationsForCrop,
  calculateCropBounds,
  getNextZoomStep,
  isZoomShortcut,
} from './utils/zoomAndCrop';
import { decideZoomOnFit, nextZoomMode, type FitReason } from './utils/zoomMode';
import { zoomStore } from './state/zoomStore';
import { isEditingTextElement } from './utils/textStyle';

// Instâncias globais dos stores para a sessão da janela
const editorStore = createEditorStore();
const galleryStore = createGalleryStore(10);

export const App: React.FC = () => {
  const { palette } = useTheme();
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('region');
  const [preCapturedScreen, setPreCapturedScreen] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [fitScale, setFitScale] = useState<number>(1.0);
  const [zoomNotice, setZoomNotice] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<CropBox | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const zoomLevelRef = useRef<number>(1.0);
  zoomLevelRef.current = zoomLevel;

  // Sincronização dos estados com React
  const editorState = useSyncExternalStore(editorStore.subscribe, editorStore.getState);
  const galleryState = useSyncExternalStore(galleryStore.subscribe, galleryStore.getState);
  const zoomMode = useSyncExternalStore(zoomStore.subscribe, zoomStore.getMode);

  // Imagem ativa atual
  const activeCapture = galleryStore.getActiveCapture();

  // Registra callback para atualizar a imagem na galeria quando Undo/Redo reverter um recorte
  useEffect(() => {
    editorStore.setOnRestoreImage((captureId, restoredImage) => {
      galleryStore.updateCaptureDataUrl(captureId, restoredImage);
    });
  }, []);

  // Garante que cada imagem da galeria tenha seus próprios blocos, histórico Undo/Redo e trava isolados
  useEffect(() => {
    if (galleryState.activeId) {
      const cap = galleryStore.getActiveCapture();
      editorStore.switchCapture(galleryState.activeId, cap?.dataUrl);
      if (cap?.dataUrl) {
        editorStore.setImageBase64(cap.dataUrl);
      }
    }
  }, [galleryState.activeId]);

  // Cria uma imagem demonstrativa inicial se a galeria estiver vazia
  useEffect(() => {
    if (galleryStore.getState().captures.length === 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 550;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 900, 550);
        grad.addColorStop(0, '#f0f4f8'); // theme-exempt
        grad.addColorStop(1, '#d9e2ec'); // theme-exempt
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 550);

        ctx.fillStyle = RENART_THEME.primary;
        ctx.font = 'bold 26px system-ui';
        ctx.fillText('RenArt — Captura de precisão e anotação fluida', 40, 70);

        ctx.fillStyle = '#627d98'; // theme-exempt
        ctx.font = '15px system-ui';
        ctx.fillText('📸 Clique em "Nova Captura" para capturar e recortar uma área real da sua tela.', 40, 110);
        ctx.fillText('📋 Pressione Ctrl+V em qualquer lugar para colar imagens na galeria.', 40, 140);
        ctx.fillText('✏️ Adicione formas, flechas e lupa. Cada imagem possui blocos independentes.', 40, 170);
        ctx.fillText('💾 Use Delete para apagar um bloco selecionado e Ctrl+S para salvar.', 40, 200);
      }

      const initialId = `cap-${Date.now()}`;
      const welcomeDataUrl = canvas.toDataURL('image/png');
      galleryStore.addCapture({
        id: initialId,
        title: 'Boas-vindas',
        dataUrl: welcomeDataUrl,
        createdAt: Date.now(),
      });
      editorStore.switchCapture(initialId, welcomeDataUrl);
      editorStore.setImageBase64(welcomeDataUrl);
    }
  }, []);

  // O aviso de zoom manual some sozinho.
  useEffect(() => {
    if (!zoomNotice) return;
    const timer = setTimeout(() => setZoomNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [zoomNotice]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (stageRef.current) {
      // Trava movimentação após salvar
      editorStore.setLocked(true);
      await exportCanvas(stageRef.current, format, activeCapture?.title || 'captura', zoomLevel);
    }
  }, [activeCapture?.title, zoomLevel]);

  // Aplica o resultado de decideZoomOnFit. Lê os stores ao vivo (sem fechamento obsoleto).
  const handleFitScaleCalculated = useCallback(
    (scale: number, reason: FitReason, viewport: { width: number; height: number }) => {
      setFitScale(scale);
      const activeId = galleryStore.getActiveCapture()?.id;
      const decision = decideZoomOnFit({
        mode: zoomStore.getMode(),
        reason,
        width: viewport.width,
        height: viewport.height,
        fitScale: scale,
        savedZoom: activeId ? zoomStore.getManualZoom(activeId) : undefined,
      });
      if (decision.zoom === null) return;
      setZoomLevel(decision.zoom);
      if (decision.saveZoom && activeId) zoomStore.saveManualZoom(activeId, decision.zoom);
    },
    []
  );

  // Zoom feito pelo usuário (botões, atalhos, Cmd/Ctrl + roda, pinça) fixa o modo manual.
  const applyUserZoom = useCallback((direction: 'in' | 'out') => {
    const wasAuto = zoomStore.getMode() === 'auto';
    const next = getNextZoomStep(zoomLevelRef.current, direction);
    zoomLevelRef.current = next;
    setZoomLevel(next);
    zoomStore.setMode(nextZoomMode(zoomStore.getMode(), 'user-zoom'));
    const activeId = galleryStore.getActiveCapture()?.id;
    if (activeId) zoomStore.saveManualZoom(activeId, next);
    if (wasAuto && !zoomStore.hasShownManualNotice()) {
      zoomStore.markManualNoticeShown();
      setZoomNotice('Zoom manual ativado. Ctrl+0 volta ao automático.');
    }
  }, []);

  const handleZoomIn = useCallback(() => applyUserZoom('in'), [applyUserZoom]);
  const handleZoomOut = useCallback(() => applyUserZoom('out'), [applyUserZoom]);

  // Ctrl/Cmd 0 e clique no indicador: volta ao zoom automático (ajustado à área útil).
  const handleResetZoom = useCallback(() => {
    zoomStore.setMode(nextZoomMode(zoomStore.getMode(), 'reset-to-auto'));
    setZoomLevel(fitScale);
  }, [fitScale]);

  const handleToggleCrop = useCallback(() => {
    if (editorState.activeTool === 'crop') {
      setCropRect(null);
      editorStore.setActiveTool('select');
    } else {
      editorStore.setActiveTool('crop');
    }
  }, [editorState.activeTool]);

  const handleCancelCrop = useCallback(() => {
    setCropRect(null);
    editorStore.setActiveTool('select');
  }, []);

  const handleConfirmCrop = useCallback(async () => {
    if (!activeCapture || !cropRect) {
      editorStore.setActiveTool('select');
      return;
    }

    const img = new window.Image();
    img.src = activeCapture.dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const bounds = calculateCropBounds(cropRect, img.width, img.height);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = bounds.width;
    offCanvas.height = bounds.height;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    const croppedDataUrl = offCanvas.toDataURL('image/png');

    // Translada e filtra anotações existentes dentro da área de recorte
    const adjusted = adjustAnnotationsForCrop(
      editorState.annotations,
      { x: bounds.x, y: bounds.y },
      { width: bounds.width, height: bounds.height }
    );

    // Registra o recorte com a nova imagem e anotações no editorStore para suportar Undo/Redo completo
    editorStore.applyCrop(adjusted, croppedDataUrl);

    // Atualiza a imagem na galeria
    galleryStore.updateCaptureDataUrl(activeCapture.id, croppedDataUrl);

    setCropRect(null);
    editorStore.setActiveTool('select');
  }, [activeCapture, cropRect, editorState.annotations]);

  // Listener global de atalhos de teclado (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+S, ESC, Delete, Zoom e Recorte)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Se o usuário estiver interagindo com um campo de texto ou editor inline,
      // não intercepta atalhos de canvas (Backspace, Delete, Ctrl+Z, Ctrl+Y, Escape, etc.)
      if (isEditingTextElement(e.target)) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Atalhos de Zoom Multiplataforma (Ctrl/Cmd +, -, 0)
      const zoomShortcut = isZoomShortcut(e);
      if (zoomShortcut === 'in') {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (zoomShortcut === 'out') {
        e.preventDefault();
        handleZoomOut();
        return;
      }
      if (zoomShortcut === 'reset') {
        e.preventDefault();
        handleResetZoom();
        return;
      }

      // Atalhos de Recorte: Enter confirma, Esc cancela
      if (editorState.activeTool === 'crop') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirmCrop();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancelCrop();
          return;
        }
      }

      // ESC: Desseleciona qualquer bloco ativo
      if (e.key === 'Escape') {
        editorStore.setSelectedId(null);
        return;
      }

      // Delete ou Backspace: Apaga o bloco selecionado (se não estiver digitando em um input/textarea)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        if (editorStore.removeSelectedAnnotation()) {
          e.preventDefault();
        }
        return;
      }

      // Ctrl + Z: Desfazer
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        editorStore.undo();
        return;
      }

      // Ctrl + Shift + Z ou Ctrl + Y: Refazer
      if ((isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z') || (isCtrlOrCmd && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        editorStore.redo();
        return;
      }

      // Ctrl + S: Salvar (trava os blocos e exporta)
      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport('png');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleExport,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    editorState.activeTool,
    handleConfirmCrop,
    handleCancelCrop,
  ]);

  // Listener para Colar Imagens da Área de Transferência (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignora se o foco estiver em um input de texto
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const pastedDataUrl = event.target?.result as string;
              if (pastedDataUrl) {
                const currentCount = galleryStore.getState().captures.length;
                const newId = `pasted-${Date.now()}`;
                galleryStore.addCapture({
                  id: newId,
                  title: `Colada #${currentCount + 1}`,
                  dataUrl: pastedDataUrl,
                  createdAt: Date.now(),
                });
                editorStore.switchCapture(newId, pastedDataUrl);
                editorStore.setImageBase64(pastedDataUrl);
              }
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleStartCapture = async (mode: CaptureMode = 'region') => {
    setCaptureMode(mode);

    // No app desktop a captura é nativa e multi-monitor: o Rust abre uma janela de seleção por tela.
    if (isTauri() && (mode === 'region' || mode === 'fullscreen' || mode === 'window')) {
      try {
        await beginCapture(mode);
      } catch (err) {
        console.warn('Falha ao iniciar a captura nativa:', err);
        setCaptureNotice(describeCaptureError(err));
      }
      return;
    }

    if (mode === 'window') {
      // Dispara o seletor nativo de janelas do sistema operacional
      const windowFrame = await captureDesktopFrame('window');
      if (windowFrame) {
        const currentCount = galleryStore.getState().captures.length;
        const newCaptureId = `cap-${Date.now()}`;
        galleryStore.addCapture({
          id: newCaptureId,
          title: `Janela #${currentCount + 1}`,
          dataUrl: windowFrame,
          createdAt: Date.now(),
        });
        editorStore.switchCapture(newCaptureId, windowFrame);
        editorStore.setImageBase64(windowFrame);
      }
      return;
    }

    if (mode === 'fullscreen') {
      // Captura instantânea do monitor completo
      const screenFrame = await captureDesktopFrame('monitor');
      if (screenFrame) {
        const currentCount = galleryStore.getState().captures.length;
        const newCaptureId = `cap-${Date.now()}`;
        galleryStore.addCapture({
          id: newCaptureId,
          title: `Tela Inteira #${currentCount + 1}`,
          dataUrl: screenFrame,
          createdAt: Date.now(),
        });
        editorStore.switchCapture(newCaptureId, screenFrame);
        editorStore.setImageBase64(screenFrame);
      }
      return;
    }

    // Modo 'region': captura quadro congelado e abre o overlay com a barra flutuante
    const screenFrame = await captureDesktopFrame('monitor');
    if (!screenFrame) {
      // Caso o usuário tenha cancelado a permissão de captura de tela, não abre o overlay vazio
      return;
    }
    setPreCapturedScreen(screenFrame);
    setIsCapturing(true);
  };

  // Captura iniciada pela bandeja ou pelo atalho global que falhou (permissão negada, por exemplo):
  // o Rust abre a janela e envia o código do erro para o aviso aparecer aqui.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    onCaptureError((message) => {
      setCaptureNotice(describeCaptureError(message));
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Resultado da captura nativa multi-monitor: entra na galeria como as demais capturas.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    onCaptureComplete(({ dataUrl, fullscreen, kind: resultKind }) => {
      const kind = resultKind ?? (fullscreen ? 'fullscreen' : 'region');
      const count = galleryStore.getState().captures.length;
      const id = `cap-${Date.now()}`;
      galleryStore.addCapture({ id, title: captureTitle(kind, count), dataUrl, createdAt: Date.now() });
      editorStore.switchCapture(id, dataUrl);
      editorStore.setImageBase64(dataUrl);
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const handleSwitchCaptureMode = async (newMode: CaptureMode) => {
    if (newMode === 'region') {
      setCaptureMode('region');
      return;
    }
    setIsCapturing(false);
    setPreCapturedScreen(null);
    await handleStartCapture(newMode);
  };

  const handleCaptureComplete = async (
    result: RectBounds | { freeformPoints: Point[] } | 'fullscreen'
  ) => {
    setIsCapturing(false);

    let dataUrl = '';

    // 1. Se temos o quadro real capturado da tela, recorta exatamente a região selecionada pelo usuário
    if (preCapturedScreen) {
      try {
        dataUrl = await cropCapturedScreen(
          preCapturedScreen,
          result,
          window.innerWidth,
          window.innerHeight
        );
      } catch (err) {
        console.warn('Falha ao recortar o quadro capturado da tela:', err);
      }
      setPreCapturedScreen(null);
    }

    // 2. Fallback direto via Tauri se invocado sem preCapturedScreen
    if (!dataUrl) {
      try {
        const isTauri =
          typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
        if (isTauri) {
          const { invoke } = await import('@tauri-apps/api/core');
          let args: Record<string, unknown> = { mode: captureMode };
          if (result !== 'fullscreen' && 'x' in result) {
            args = {
              mode: 'region',
              x: Math.round(result.x),
              y: Math.round(result.y),
              w: Math.round(result.width),
              h: Math.round(result.height),
            };
          }
          dataUrl = await invoke<string>('tauri_capture_screen', args);
        }
      } catch (err) {
        console.warn('Tauri invoke indisponível:', err);
      }
    }

    if (!dataUrl) {
      return;
    }

    // 3. Adiciona a nova captura real à galeria de miniaturas e cria uma sessão limpa de blocos!
    const currentCount = galleryStore.getState().captures.length;
    const newCaptureId = `cap-${Date.now()}`;
    galleryStore.addCapture({
      id: newCaptureId,
      title: `Captura #${currentCount + 1}`,
      dataUrl,
      createdAt: Date.now(),
    });
    editorStore.switchCapture(newCaptureId, dataUrl);
    editorStore.setImageBase64(dataUrl);
  };

  const handleInsertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        editorStore.addAnnotation({
          id: `ann-img-${Date.now()}`,
          type: 'image',
          x: 100,
          y: 100,
          width: 150,
          height: 100,
          src,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = async () => {
    if (stageRef.current) {
      await copyCanvasToClipboard(stageRef.current, zoomLevel);
    }
  };

  const handleToggleBold = () => {
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isEditingInline =
      activeEl &&
      (activeEl.getAttribute('contenteditable') === 'true' ||
        Boolean(activeEl.closest?.('[contenteditable="true"]')));

    if (isEditingInline) {
      document.execCommand('bold', false);
      return;
    }
    editorStore.toggleBold();
  };

  const handleToggleItalic = () => {
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isEditingInline =
      activeEl &&
      (activeEl.getAttribute('contenteditable') === 'true' ||
        Boolean(activeEl.closest?.('[contenteditable="true"]')));

    if (isEditingInline) {
      document.execCommand('italic', false);
      return;
    }
    editorStore.toggleItalic();
  };

  const handleToggleUnderline = () => {
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isEditingInline =
      activeEl &&
      (activeEl.getAttribute('contenteditable') === 'true' ||
        Boolean(activeEl.closest?.('[contenteditable="true"]')));

    if (isEditingInline) {
      document.execCommand('underline', false);
      return;
    }
    editorStore.toggleUnderline();
  };

  const handleToggleStrikethrough = () => {
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isEditingInline =
      activeEl &&
      (activeEl.getAttribute('contenteditable') === 'true' ||
        Boolean(activeEl.closest?.('[contenteditable="true"]')));

    if (isEditingInline) {
      document.execCommand('strikeThrough', false);
      return;
    }
    editorStore.toggleStrikethrough();
  };

  const selectedAnnotations = editorState.annotations.filter((ann) =>
    editorState.selectedIds.includes(ann.id)
  );
  const showTextControls = shouldShowTextControls(editorState.activeTool, selectedAnnotations);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: palette.workspace,
        color: palette.textPrimary,
      }}
    >
      {/* Barra de Ferramentas Superior */}
      <Toolbar
        activeTool={editorState.activeTool}
        onSelectTool={(t: ToolType) => editorStore.setActiveTool(t)}
        strokeColor={editorState.strokeColor}
        onSelectColor={(c: string) => editorStore.setStrokeColor(c)}
        strokeWidth={editorState.strokeWidth}
        onSelectStrokeWidth={(w: number) => editorStore.setStrokeWidth(w)}
        canUndo={editorStore.canUndo()}
        canRedo={editorStore.canRedo()}
        onUndo={() => editorStore.undo()}
        onRedo={() => editorStore.redo()}
        onNewCapture={(mode) => handleStartCapture(mode || 'region')}
        onCopy={handleCopy}
        onExport={handleExport}
        onInsertImage={handleInsertImage}
        magnifierMode={editorState.magnifierMode}
        onSelectMagnifierMode={(mode) => editorStore.setMagnifierMode(mode)}
        showTextControls={showTextControls}
        fontFamily={editorState.fontFamily}
        onSelectFontFamily={(f: string) => editorStore.setFontFamily(f)}
        fontSize={editorState.fontSize}
        onSelectFontSize={(s: number) => editorStore.setFontSize(s)}
        isBold={editorState.isBold}
        onToggleBold={handleToggleBold}
        isItalic={editorState.isItalic}
        onToggleItalic={handleToggleItalic}
        isUnderline={editorState.isUnderline}
        onToggleUnderline={handleToggleUnderline}
        isStrikethrough={editorState.isStrikethrough}
        onToggleStrikethrough={handleToggleStrikethrough}
        textAlign={editorState.textAlign}
        onSelectTextAlign={(align) => editorStore.setTextAlign(align)}
        hasBackground={editorState.hasBackground}
        onToggleBackground={() => editorStore.toggleBackground()}
        autoWrap={editorState.autoWrap}
        onToggleAutoWrap={() => editorStore.toggleAutoWrap()}
        zoomLevel={zoomLevel}
        zoomMode={zoomMode}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        isCropping={editorState.activeTool === 'crop'}
        onToggleCrop={handleToggleCrop}
        onConfirmCrop={handleConfirmCrop}
        onCancelCrop={handleCancelCrop}
        arrowStyle={editorState.arrowStyle}
        onSelectArrowStyle={(style) => editorStore.setArrowStyle(style)}
        onToggleCurveDirection={() => editorStore.toggleArrowCurveDirection()}
        redactionLevel={editorState.redactionLevel}
        onSelectRedactionLevel={(level) => editorStore.setRedactionLevel(level)}
        redactionEffect={editorState.redactionEffect}
        onSelectRedactionEffect={(effect) => editorStore.setRedactionEffect(effect)}
        redactionMode={editorState.redactionMode}
        onSelectRedactionMode={(mode) => editorStore.setRedactionMode(mode)}
        selectedAnnotations={selectedAnnotations}
      />

      {/* Espaço Principal: Galeria Lateral (Esquerda) + Canvas Central */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <GallerySidebar
          captures={galleryState.captures}
          activeId={galleryState.activeId}
          maxCaptures={galleryState.maxCaptures}
          onSelect={(id: string) => {
            galleryStore.setActive(id);
            editorStore.switchCapture(id);
          }}
          onClose={(id: string) => {
            galleryStore.removeCapture(id);
            zoomStore.removeManualZoom(id);
            editorStore.removeCaptureSession(id);
            const nextActive = galleryStore.getState().activeId;
            if (nextActive) {
              editorStore.switchCapture(nextActive);
            }
          }}
        />

        {activeCapture ? (
          <CanvasEditor
            imageBase64={activeCapture.dataUrl}
            annotations={editorState.annotations}
            activeTool={editorState.activeTool}
            selectedId={editorState.selectedId}
            selectedIds={editorState.selectedIds}
            strokeColor={editorState.strokeColor}
            strokeWidth={editorState.strokeWidth}
            fontSize={editorState.fontSize}
            fontFamily={editorState.fontFamily}
            isBold={editorState.isBold}
            isItalic={editorState.isItalic}
            isUnderline={editorState.isUnderline}
            isStrikethrough={editorState.isStrikethrough}
            textAlign={editorState.textAlign}
            hasBackground={editorState.hasBackground}
            isLocked={editorState.isLocked}
            onSelectId={(id: string | null) => editorStore.setSelectedId(id)}
            onSelectIds={(ids: string[]) => editorStore.setSelectedIds(ids)}
            onToggleSelectId={(id: string) => editorStore.toggleSelectedId(id)}
            onAddAnnotation={(ann: Annotation) => editorStore.addAnnotation(ann)}
            onRemoveAnnotation={(id: string) => editorStore.removeAnnotation(id)}
            onUpdateAnnotation={(id: string, updates: Partial<Annotation>) =>
              editorStore.updateAnnotation(id, updates)
            }
            onUpdateAnnotations={(updatesById: Record<string, Partial<Annotation>>) =>
              editorStore.updateAnnotations(updatesById)
            }
            magnifierMode={editorState.magnifierMode}
            arrowStyle={editorState.arrowStyle}
            arrowCurveDirection={editorState.arrowCurveDirection}
            redactionLevel={editorState.redactionLevel}
            redactionEffect={editorState.redactionEffect}
            redactionMode={editorState.redactionMode}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitScaleCalculated={handleFitScaleCalculated}
            isCropping={editorState.activeTool === 'crop'}
            onCropRectChange={setCropRect}
            stageRef={stageRef}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              color: palette.textMuted,
            }}
          >
            <Mascot size={96} />
            Selecione ou realize uma nova captura para iniciar a edição.
          </div>
        )}
      </div>

      {zoomNotice && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            maxWidth: '560px',
            padding: '10px 16px',
            borderRadius: '10px',
            backgroundColor: palette.popup,
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            boxShadow: `0 8px 32px ${palette.shadow}`,
            fontSize: '13px',
            zIndex: 20000,
          }}
        >
          {zoomNotice}
        </div>
      )}

      {captureNotice && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            maxWidth: '560px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: palette.popup,
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            boxShadow: `0 8px 32px ${palette.shadow}`,
            fontSize: '13px',
            zIndex: 20000,
          }}
        >
          <span style={{ flex: 1 }}>{captureNotice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setCaptureNotice(null)}
            style={{ border: 'none', background: 'transparent', color: palette.textSecondary, cursor: 'pointer', fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Overlay de Seleção de Captura sobre o quadro real capturado */}
      {isCapturing && (
        <CaptureOverlay
          mode={captureMode}
          backgroundDataUrl={preCapturedScreen}
          onComplete={handleCaptureComplete}
          onSwitchMode={handleSwitchCaptureMode}
          onCancel={() => {
            setIsCapturing(false);
            setPreCapturedScreen(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
