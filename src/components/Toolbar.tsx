import React, { useRef } from 'react';
import { ToolType } from '../state/editorStore';
import {
  MousePointer,
  Square,
  Circle,
  ArrowRight,
  Type,
  Image as ImageIcon,
  ZoomIn,
  Undo2,
  Redo2,
  Copy,
  Camera,
} from 'lucide-react';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  strokeColor: string;
  onSelectColor: (color: string) => void;
  strokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  autoStrokeWidth?: boolean;
  onToggleAutoStrokeWidth?: (auto: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewCapture: () => void;
  onCopy: () => void;
  onExport: (format: 'png' | 'jpeg' | 'pdf') => void;
  onInsertImage: (file: File) => void;
}

const COLORS = ['#ff3b30', '#ff9f0a', '#34c759', '#0071e3', '#5856d6', '#000000', '#ffffff'];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  strokeColor,
  onSelectColor,
  strokeWidth,
  onSelectStrokeWidth,
  autoStrokeWidth = true,
  onToggleAutoStrokeWidth,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewCapture,
  onCopy,
  onExport,
  onInsertImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImage(file);
      e.target.value = '';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e5e7',
        userSelect: 'none',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      {/* Botão de Nova Captura */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onNewCapture}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0071e3',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <Camera size={16} /> Nova Captura
        </button>
      </div>

      {/* Ferramentas de Desenho e Anotação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#f5f5f7',
          padding: '4px',
          borderRadius: '8px',
        }}
      >
        <button
          title="Selecionar / Multiseleção (Clique e arraste)"
          onClick={() => onSelectTool('select')}
          style={{
            backgroundColor: activeTool === 'select' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'select' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <MousePointer size={16} />
        </button>

        <button
          title="Retângulo"
          onClick={() => onSelectTool('rect')}
          style={{
            backgroundColor: activeTool === 'rect' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'rect' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <Square size={16} />
        </button>

        <button
          title="Círculo / Elipse"
          onClick={() => onSelectTool('ellipse')}
          style={{
            backgroundColor: activeTool === 'ellipse' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'ellipse' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <Circle size={16} />
        </button>

        <button
          title="Flecha"
          onClick={() => onSelectTool('arrow')}
          style={{
            backgroundColor: activeTool === 'arrow' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'arrow' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <ArrowRight size={16} />
        </button>

        <button
          title="Bloco de Texto"
          onClick={() => onSelectTool('text')}
          style={{
            backgroundColor: activeTool === 'text' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <Type size={16} />
        </button>

        <button
          title="Inserir Figura / Imagem"
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: activeTool === 'image' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'image' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <ImageIcon size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFileChange}
        />

        <button
          title="Lupa de Zoom"
          onClick={() => onSelectTool('magnifier')}
          style={{
            backgroundColor: activeTool === 'magnifier' ? '#ffffff' : 'transparent',
            boxShadow: activeTool === 'magnifier' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none',
            borderRadius: '5px',
            padding: '6px',
            cursor: 'pointer',
          }}
        >
          <ZoomIn size={16} />
        </button>

        <div style={{ width: '1px', height: '18px', backgroundColor: '#d1d1d6', margin: '0 4px' }} />

        {/* Cores (aplica nos blocos selecionados ou define padrão para novos) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              title={`Cor ${c}`}
              onClick={() => onSelectColor(c)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: c,
                border: strokeColor === c ? '2px solid #0071e3' : '1px solid #ccc',
                padding: 0,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Espessura do traço em pixels */}
        <select
          title="Espessura da linha (em pixels)"
          value={strokeWidth}
          onChange={(e) => onSelectStrokeWidth(Number(e.target.value))}
          style={{
            marginLeft: '4px',
            fontSize: '12px',
            padding: '3px 6px',
            borderRadius: '4px',
            border: !autoStrokeWidth ? '1.5px solid #0071e3' : '1px solid #d1d1d6',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        >
          <option value={2}>2px</option>
          <option value={3}>3px</option>
          <option value={5}>5px</option>
          <option value={8}>8px</option>
        </select>

        {/* Botão "Auto" ao lado da lista de pixels */}
        <button
          type="button"
          title="Espessura automática ao redimensionar o bloco"
          onClick={() => onToggleAutoStrokeWidth?.(!autoStrokeWidth)}
          style={{
            marginLeft: '2px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '4px',
            border: autoStrokeWidth ? '1px solid #0071e3' : '1px solid #d1d1d6',
            backgroundColor: autoStrokeWidth ? '#0071e3' : '#ffffff',
            color: autoStrokeWidth ? '#ffffff' : '#334155',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Auto
        </button>
      </div>

      {/* Ações: Desfazer / Refazer / Copiar / Exportar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          title="Desfazer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            opacity: canUndo ? 1 : 0.4,
            padding: '4px',
          }}
        >
          <Undo2 size={18} />
        </button>

        <button
          title="Refazer (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            opacity: canRedo ? 1 : 0.4,
            padding: '4px',
          }}
        >
          <Redo2 size={18} />
        </button>

        <button
          onClick={onCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            border: '1px solid #d1d1d6',
            backgroundColor: '#f5f5f7',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Copy size={14} /> Copiar
        </button>

        {/* Menu Exportar */}
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onExport(e.target.value as 'png' | 'jpeg' | 'pdf');
              e.target.value = '';
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#34c759',
            color: '#fff',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <option value="" disabled>
            💾 Exportar...
          </option>
          <option value="png" style={{ color: '#000' }}>
            Exportar como PNG
          </option>
          <option value="jpeg" style={{ color: '#000' }}>
            Exportar como JPEG / JPG
          </option>
          <option value="pdf" style={{ color: '#000' }}>
            Exportar como PDF
          </option>
        </select>
      </div>
    </div>
  );
};
