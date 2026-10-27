import React, { useState, useRef, useSyncExternalStore, useEffect } from 'react';
import Konva from 'konva';
import { Toolbar } from './components/Toolbar';
import { GallerySidebar } from './components/GallerySidebar';
import { CanvasEditor } from './components/CanvasEditor';
import { CaptureOverlay } from './components/CaptureOverlay';
import { createEditorStore, ToolType, Annotation } from './state/editorStore';
import { createGalleryStore } from './state/galleryStore';
import { exportCanvas, copyCanvasToClipboard, ExportFormat } from './services/exportService';
import { CaptureMode, RectBounds, Point } from './types/capture';

// Instâncias globais dos stores para a sessão da janela
const editorStore = createEditorStore();
const galleryStore = createGalleryStore(10);

export const App: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('region');
  const stageRef = useRef<Konva.Stage | null>(null);

  // Sincronização dos estados com React
  const editorState = useSyncExternalStore(editorStore.subscribe, editorStore.getState);
  const galleryState = useSyncExternalStore(galleryStore.subscribe, galleryStore.getState);

  // Imagem ativa atual
  const activeCapture = galleryStore.getActiveCapture();

  // Cria uma imagem demonstrativa inicial se a galeria estiver vazia
  useEffect(() => {
    if (galleryState.captures.length === 0) {
      // Gera um canvas gradiente padrão para teste visual imediato
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
        ctx.font = 'bold 28px system-ui';
        ctx.fillText('Ferramenta de Captura Multiplataforma', 40, 70);

        ctx.fillStyle = '#627d98';
        ctx.font = '16px system-ui';
        ctx.fillText('Clique em "Nova Captura" para recortar uma área da sua tela.', 40, 110);
        ctx.fillText('Use a barra superior para adicionar formas, setas, textos e lupa.', 40, 140);
      }

      galleryStore.addCapture({
        id: `cap-${Date.now()}`,
        title: 'Boas-vindas',
        dataUrl: canvas.toDataURL('image/png'),
        createdAt: Date.now(),
      });
    }
  }, []);

  const handleStartCapture = (mode: CaptureMode = 'region') => {
    setCaptureMode(mode);
    setIsCapturing(true);
  };

  const handleCaptureComplete = async (
    result: RectBounds | { freeformPoints: Point[] } | 'fullscreen'
  ) => {
    setIsCapturing(false);

    try {
      // Tenta chamar o comando nativo Tauri se estiver em ambiente Tauri
      const { invoke } = await import('@tauri-apps/api/core').catch(() => ({ invoke: null }));

      if (invoke) {
        let args: any = { mode: captureMode };
        if (result !== 'fullscreen' && 'x' in result) {
          args = { mode: 'region', x: result.x, y: result.y, w: result.width, h: result.height };
        }

        const dataUrl: string = await invoke('tauri_capture_screen', args);
        galleryStore.addCapture({
          id: `cap-${Date.now()}`,
          title: `Captura #${galleryState.captures.length + 1}`,
          dataUrl,
          createdAt: Date.now(),
        });
      } else {
        // Fallback em ambiente de simulação/web
        const mockCanvas = document.createElement('canvas');
        const w = result !== 'fullscreen' && 'width' in result ? result.width : 800;
        const h = result !== 'fullscreen' && 'height' in result ? result.height : 500;
        mockCanvas.width = Math.max(100, w);
        mockCanvas.height = Math.max(100, h);
        const ctx = mockCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);
          ctx.fillStyle = '#0071e3';
          ctx.font = '16px system-ui';
          ctx.fillText(`Captura Simada (${mockCanvas.width}x${mockCanvas.height})`, 20, 40);
        }

        galleryStore.addCapture({
          id: `cap-${Date.now()}`,
          title: `Captura #${galleryState.captures.length + 1}`,
          dataUrl: mockCanvas.toDataURL('image/png'),
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('Erro na captura:', err);
    }
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

  const handleExport = async (format: ExportFormat) => {
    if (stageRef.current) {
      await exportCanvas(stageRef.current, format, activeCapture?.title || 'captura');
    }
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
          onSelect={(id: string) => galleryStore.setActive(id)}
          onClose={(id: string) => galleryStore.removeCapture(id)}
        />

        {activeCapture ? (
          <CanvasEditor
            imageBase64={activeCapture.dataUrl}
            annotations={editorState.annotations}
            activeTool={editorState.activeTool}
            selectedId={editorState.selectedId}
            strokeColor={editorState.strokeColor}
            strokeWidth={editorState.strokeWidth}
            fontSize={editorState.fontSize}
            onSelectId={(id: string | null) => editorStore.setSelectedId(id)}
            onAddAnnotation={(ann: Annotation) => editorStore.addAnnotation(ann)}
            onUpdateAnnotation={(id: string, updates: Partial<Annotation>) =>
              editorStore.updateAnnotation(id, updates)
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

      {/* Overlay de Seleção de Captura */}
      {isCapturing && (
        <CaptureOverlay
          mode={captureMode}
          onComplete={handleCaptureComplete}
          onCancel={() => setIsCapturing(false)}
        />
      )}
    </div>
  );
};

export default App;
