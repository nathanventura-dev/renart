import React, { useState, useRef, useSyncExternalStore, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { Toolbar } from './components/Toolbar';
import { GallerySidebar } from './components/GallerySidebar';
import { CanvasEditor } from './components/CanvasEditor';
import { CaptureOverlay } from './components/CaptureOverlay';
import { createEditorStore, ToolType, Annotation } from './state/editorStore';
import { createGalleryStore } from './state/galleryStore';
import { exportCanvas, copyCanvasToClipboard, ExportFormat } from './services/exportService';
import { captureDesktopFrame, cropCapturedScreen } from './services/screenCaptureService';
import { CaptureMode, RectBounds, Point } from './types/capture';

// Instâncias globais dos stores para a sessão da janela
const editorStore = createEditorStore();
const galleryStore = createGalleryStore(10);

export const App: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('region');
  const [preCapturedScreen, setPreCapturedScreen] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  // Sincronização dos estados com React
  const editorState = useSyncExternalStore(editorStore.subscribe, editorStore.getState);
  const galleryState = useSyncExternalStore(galleryStore.subscribe, galleryStore.getState);

  // Imagem ativa atual
  const activeCapture = galleryStore.getActiveCapture();

  // Garante que cada imagem da galeria tenha seus próprios blocos, histórico Undo/Redo e trava isolados
  useEffect(() => {
    if (galleryState.activeId) {
      editorStore.switchCapture(galleryState.activeId);
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
      galleryStore.addCapture({
        id: initialId,
        title: 'Boas-vindas',
        dataUrl: canvas.toDataURL('image/png'),
        createdAt: Date.now(),
      });
      editorStore.switchCapture(initialId);
    }
  }, []);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (stageRef.current) {
      // Trava movimentação após salvar
      editorStore.setLocked(true);
      await exportCanvas(stageRef.current, format, activeCapture?.title || 'captura');
    }
  }, [activeCapture?.title]);

  // Listener global de atalhos de teclado (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+S, ESC, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

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
  }, [handleExport]);

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
                editorStore.switchCapture(newId);
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
    editorStore.switchCapture(newCaptureId);
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
