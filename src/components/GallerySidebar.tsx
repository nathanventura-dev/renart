import React from 'react';
import { GalleryItem } from '../state/galleryStore';
import { X, Clock } from 'lucide-react';

interface GallerySidebarProps {
  captures: GalleryItem[];
  activeId: string | null;
  maxCaptures: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export const GallerySidebar: React.FC<GallerySidebarProps> = ({
  captures,
  activeId,
  maxCaptures,
  onSelect,
  onClose,
}) => {
  return (
    <div
      style={{
        width: '220px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e5e5e7',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Cabeçalho da Galeria com Contador */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e5e5e7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#86868b', textTransform: 'uppercase' }}>
          Galeria
        </span>
        <span
          style={{
            fontSize: '11px',
            backgroundColor: captures.length >= maxCaptures ? '#ff9f0a' : '#f5f5f7',
            color: captures.length >= maxCaptures ? '#ffffff' : '#86868b',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 600,
          }}
        >
          {captures.length} / {maxCaptures}
        </span>
      </div>

      {/* Lista de Miniaturas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {captures.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aeaeb2', fontSize: '12px', marginTop: '40px' }}>
            Nenhuma captura ainda. Clique em "Nova Captura".
          </div>
        ) : (
          captures.map((item) => {
            const isActive = item.id === activeId;
            const dateStr = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item.id)}
                style={{
                  position: 'relative',
                  border: isActive ? '2px solid #0071e3' : '1px solid #e5e5e7',
                  backgroundColor: isActive ? 'rgba(0, 113, 227, 0.08)' : '#f9f9fa',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Botão de Fechar Item */}
                <button
                  title="Fechar captura"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(item.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    border: 'none',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: '#ffffff',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                >
                  <X size={12} />
                </button>

                {/* Miniatura da Imagem */}
                <div
                  style={{
                    height: '75px',
                    backgroundColor: '#e5e5e7',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={item.dataUrl}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Detalhes do Item */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500, color: isActive ? '#0071e3' : '#1d1d1f' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '10px', color: '#86868b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Clock size={10} /> {dateStr}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé Informativo da Política FIFO */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e5e7', fontSize: '10px', color: '#86868b', textAlign: 'center' }}>
        Limite de 10 capturas. As mais antigas saem automaticamente (FIFO).
      </div>
    </div>
  );
};
