import React, { useState, useRef, useSyncExternalStore, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { Toolbar } from './components/Toolbar';
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

// Instâncias globais dos stores para a sessão da janela
const editorStore = createEditorStore();
const galleryStore = createGalleryStore(10);

export const App: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('region');
  const [preCapturedScreen, setPreCapturedScreen] = useState<string | null>(null);
  const [magnifierMode, setMagnifierMode] = useState<'without-focus' | 'with-focus'>('without-focus');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [fitScale, setFitScale] = useState<number>(1.0);
  const [cropRect, setCropRect] = useState<CropBox | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  // Sincronização dos estados com React
  const editorState = useSyncExternalStore(editorStore.subscribe, editorStore.getState);
  const galleryState = useSyncExternalStore(galleryStore.subscribe, galleryStore.getState);

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
        grad.addColorStop(0, '#f0f4f8');
        grad.addColorStop(1, '#d9e2ec');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 550);

        ctx.fillStyle = '#102a43';
        ctx.font = 'bold 26px system-ui';
        ctx.fillText('Ferramenta de Captura Multiplataforma', 40, 70);

        ctx.fillStyle = '#627d98';
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

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (stageRef.current) {
      // Trava movimentação após salvar
      editorStore.setLocked(true);
      await exportCanvas(stageRef.current, format, activeCapture?.title || 'captura');
    }
  }, [activeCapture?.title]);

  const handleFitScaleCalculated = useCallback((scale: number) => {
    setFitScale(scale);
    setZoomLevel(scale);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => getNextZoomStep(prev, 'in'));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => getNextZoomStep(prev, 'out'));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel((prev) => (Math.abs(prev - 1.0) < 0.01 ? fitScale : 1.0));
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
    // Captura o quadro real da tela/monitor antes de exibir o overlay de recorte
    const screenFrame = await captureDesktopFrame();
    if (!screenFrame) {
      // Caso o usuário tenha cancelado a permissão de captura de tela, não abre o overlay vazio
      return;
    }
    setPreCapturedScreen(screenFrame);
    setIsCapturing(true);
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
      await copyCanvasToClipboard(stageRef.current);
    }
  };

  const selectedAnnotations = editorState.annotations.filter((ann) =>
    editorState.selectedIds.includes(ann.id)
  );
  const showTextControls = shouldShowTextControls(editorState.activeTool, selectedAnnotations);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Barra de Ferramentas Superior */}
      <Toolbar
        activeTool={editorState.activeTool}
        onSelectTool={(t: ToolType) => editorStore.setActiveTool(t)}
        strokeColor={editorState.strokeColor}
        onSelectColor={(c: string) => editorStore.setStrokeColor(c)}
        strokeWidth={editorState.strokeWidth}
        onSelectStrokeWidth={(w: number) => editorStore.setStrokeWidth(w)}
        autoStrokeWidth={editorState.autoStrokeWidth}
        onToggleAutoStrokeWidth={(auto: boolean) => editorStore.setAutoStrokeWidth(auto)}
        canUndo={editorStore.canUndo()}
        canRedo={editorStore.canRedo()}
        onUndo={() => editorStore.undo()}
        onRedo={() => editorStore.redo()}
        onNewCapture={() => handleStartCapture('region')}
        onCopy={handleCopy}
        onExport={handleExport}
        onInsertImage={handleInsertImage}
        magnifierMode={magnifierMode}
        onSelectMagnifierMode={setMagnifierMode}
        showTextControls={showTextControls}
        fontFamily={editorState.fontFamily}
        onSelectFontFamily={(f: string) => editorStore.setFontFamily(f)}
        fontSize={editorState.fontSize}
        onSelectFontSize={(s: number) => editorStore.setFontSize(s)}
        zoomLevel={zoomLevel}
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
            autoStrokeWidth={editorState.autoStrokeWidth}
            fontSize={editorState.fontSize}
            fontFamily={editorState.fontFamily}
            isLocked={editorState.isLocked}
            onSelectId={(id: string | null) => editorStore.setSelectedId(id)}
            onSelectIds={(ids: string[]) => editorStore.setSelectedIds(ids)}
            onToggleSelectId={(id: string) => editorStore.toggleSelectedId(id)}
            onAddAnnotation={(ann: Annotation) => editorStore.addAnnotation(ann)}
            onUpdateAnnotation={(id: string, updates: Partial<Annotation>) =>
              editorStore.updateAnnotation(id, updates)
            }
            onUpdateAnnotations={(updatesById: Record<string, Partial<Annotation>>) =>
              editorStore.updateAnnotations(updatesById)
            }
            magnifierMode={magnifierMode}
            arrowStyle={editorState.arrowStyle}
            arrowCurveDirection={editorState.arrowCurveDirection}
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
              color: '#86868b',
            }}
          >
            Selecione ou realize uma nova captura para iniciar a edição.
          </div>
        )}
      </div>

      {/* Overlay de Seleção de Captura sobre o quadro real capturado */}
      {isCapturing && (
        <CaptureOverlay
          mode={captureMode}
          backgroundDataUrl={preCapturedScreen}
          onComplete={handleCaptureComplete}
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
