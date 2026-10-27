import React, { useState, useRef, useSyncExternalStore, useEffect, useCallback } from 'react';
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
        ctx.fillText('📸 Clique em "Nova Captura" para recortar uma área da sua tela.', 40, 110);
        ctx.fillText('📋 Pressione Ctrl+V em qualquer lugar para colar imagens na galeria.', 40, 140);
        ctx.fillText('✏️ Adicione formas, flechas e lupa. Use dois cliques no texto para editar.', 40, 170);
        ctx.fillText('💾 Use Ctrl+S para salvar e travar a edição.', 40, 200);
      }

      galleryStore.addCapture({
        id: `cap-${Date.now()}`,
        title: 'Boas-vindas',
        dataUrl: canvas.toDataURL('image/png'),
        createdAt: Date.now(),
      });
    }
  }, []);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (stageRef.current) {
      // Trava movimentação após salvar
      editorStore.setLocked(true);
      await exportCanvas(stageRef.current, format, activeCapture?.title || 'captura');
    }
  }, [activeCapture?.title]);

  // Listener global de atalhos de teclado (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+S, ESC)
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
                galleryStore.addCapture({
                  id: `pasted-${Date.now()}`,
                  title: `Colada #${currentCount + 1}`,
                  dataUrl: pastedDataUrl,
                  createdAt: Date.now(),
                });
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

  const handleStartCapture = (mode: CaptureMode = 'region') => {
    setCaptureMode(mode);
    setIsCapturing(true);
  };

  const handleCaptureComplete = async (
    result: RectBounds | { freeformPoints: Point[] } | 'fullscreen'
  ) => {
    setIsCapturing(false);

    let dataUrl = '';

    // 1. Tenta captura nativa se estiver rodando dentro do Tauri
    try {
      const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        let args: any = { mode: captureMode };
        if (result !== 'fullscreen' && 'x' in result) {
          args = { mode: 'region', x: Math.round(result.x), y: Math.round(result.y), w: Math.round(result.width), h: Math.round(result.height) };
        }
        dataUrl = await invoke('tauri_capture_screen', args);
      }
    } catch (err) {
      console.warn('Tauri invoke não disponível, gerando captura visual do canvas:', err);
    }

    // 2. Se não estiver no Tauri (ex: teste no navegador), gera a captura proporcional da área selecionada
    if (!dataUrl) {
      const w = result !== 'fullscreen' && 'width' in result ? result.width : 850;
      const h = result !== 'fullscreen' && 'height' in result ? result.height : 500;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(120, Math.round(w));
      canvas.height = Math.max(80, Math.round(h));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fundo simulado da tela capturada
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grade suave de fundo
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px system-ui';
        ctx.fillText(`Captura de Tela (${canvas.width} × ${canvas.height})`, 20, 35);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px system-ui';
        ctx.fillText(`Armazenada na galeria às ${new Date().toLocaleTimeString()}`, 20, 60);
      }
      dataUrl = canvas.toDataURL('image/png');
    }

    // 3. Adiciona obrigatoriamente a nova captura à galeria de miniaturas!
    const currentCount = galleryStore.getState().captures.length;
    galleryStore.addCapture({
      id: `cap-${Date.now()}`,
      title: `Captura #${currentCount + 1}`,
      dataUrl,
      createdAt: Date.now(),
    });
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
            isLocked={editorState.isLocked}
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
