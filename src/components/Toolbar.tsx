import React, { useRef, useState, useEffect } from 'react';
import {
  ToolType,
  FONT_FAMILIES,
  FONT_SIZES,
  STROKE_WIDTHS,
  ArrowStyle,
  Annotation,
  MagnifierAnnotation,
  shouldShowArrowControls,
  shouldShowMagnifierControls,
} from '../state/editorStore';
import { formatZoomPercentage } from '../utils/zoomAndCrop';
import {
  MousePointer,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Image as ImageIcon,
  Search,
  Crop,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Copy,
  Save,
  Camera,
  RotateCw,
  Palette,
  AppWindow,
  Monitor,
} from 'lucide-react';
import { CaptureMode } from '../types/capture';

export type HoveredToolbarAction = 'copy' | 'export' | null;

export interface ToolbarActionFeedback {
  copyBadge: 'Copiar' | 'Copiado' | null;
  exportBadge: 'Exportar' | null;
}

export const UNIFIED_TOOLBAR_HEIGHT = '36px';
export const INNER_CONTROL_HEIGHT = '28px';

export interface ToolbarLayoutMetrics {
  captureButtonHeight: string;
  centerToolbarHeight: string;
  rightActionIconHeight: string;
  leftAlignment: 'flex-start';
  centerAlignment: 'center';
  rightAlignment: 'flex-end';
}

/**
 * Retorna as métricas de layout da barra superior garantindo a mesma altura (36px)
 * e alinhamento em 3 colunas (esquerda: captura, centro: ferramentas, direita: ícones).
 */
export function getToolbarLayoutMetrics(): ToolbarLayoutMetrics {
  return {
    captureButtonHeight: UNIFIED_TOOLBAR_HEIGHT,
    centerToolbarHeight: UNIFIED_TOOLBAR_HEIGHT,
    rightActionIconHeight: UNIFIED_TOOLBAR_HEIGHT,
    leftAlignment: 'flex-start',
    centerAlignment: 'center',
    rightAlignment: 'flex-end',
  };
}

/**
 * Resolve os rótulos de hover ("Copiar" e "Exportar") e o aviso de confirmação ("Copiado")
 * próximos aos ícones na extrema direita da barra superior.
 */
export function resolveToolbarActionFeedback(
  hoveredAction: HoveredToolbarAction,
  isCopied: boolean
): ToolbarActionFeedback {
  return {
    copyBadge: isCopied ? 'Copiado' : hoveredAction === 'copy' ? 'Copiar' : null,
    exportBadge: hoveredAction === 'export' ? 'Exportar' : null,
  };
}

export interface ArrowStyleOption {
  id: ArrowStyle;
  label: string;
  tooltip: string;
}

export const ARROW_STYLE_OPTIONS: ArrowStyleOption[] = [
  { id: 'standard', label: 'Padrão', tooltip: 'Flecha Padrão: Traço contínuo com ponta clássica' },
  { id: 'thin', label: 'Fina', tooltip: 'Flecha Fina: Traço fino e ponta sutil (estilo ->)' },
  { id: 'dashed', label: 'Pontilhada', tooltip: 'Flecha Pontilhada: Traço pontilhado no corpo e ponta sólida' },
  { id: 'curved', label: 'Curva', tooltip: 'Flecha Curva: Traço mais encorpado com curvatura suave' },
];

export interface ArrowToolbarState {
  showArrowControls: boolean;
  effectiveArrowStyle: ArrowStyle;
  showInvertCurve: boolean;
}

export function resolveArrowToolbarState(
  activeTool: ToolType,
  selectedAnnotations: Annotation[] = [],
  globalArrowStyle: ArrowStyle = 'standard'
): ArrowToolbarState {
  const showArrowControls = shouldShowArrowControls(activeTool, selectedAnnotations);
  const selectedArrow = selectedAnnotations.find((a) => a.type === 'arrow');
  const effectiveArrowStyle: ArrowStyle =
    selectedArrow?.arrowStyle || globalArrowStyle || 'standard';
  const showInvertCurve = showArrowControls && effectiveArrowStyle === 'curved';

  return {
    showArrowControls,
    effectiveArrowStyle,
    showInvertCurve,
  };
}

export interface MagnifierToolbarState {
  showMagnifierControls: boolean;
  effectiveMagnifierMode: 'without-focus' | 'with-focus';
}

export function resolveMagnifierToolbarState(
  activeTool: ToolType,
  selectedAnnotations: Annotation[] = [],
  globalMagnifierMode: 'without-focus' | 'with-focus' = 'without-focus'
): MagnifierToolbarState {
  const showMagnifierControls = shouldShowMagnifierControls(activeTool, selectedAnnotations);
  const selectedMag = selectedAnnotations.find((a) => a.type === 'magnifier') as
    | MagnifierAnnotation
    | undefined;
  let effectiveMagnifierMode = globalMagnifierMode;
  if (selectedMag) {
    const isDetached =
      selectedMag.focusX !== undefined &&
      selectedMag.focusY !== undefined &&
      Math.hypot(selectedMag.focusX - selectedMag.x, selectedMag.focusY - selectedMag.y) > 4;
    effectiveMagnifierMode = isDetached ? 'with-focus' : 'without-focus';
  }

  return {
    showMagnifierControls,
    effectiveMagnifierMode,
  };
}

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  strokeColor: string;
  onSelectColor: (color: string) => void;
  strokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewCapture: (mode?: CaptureMode) => void;
  onCopy: () => void;
  onExport: (format: 'png' | 'jpeg' | 'pdf') => void;
  onInsertImage: (file: File) => void;
  magnifierMode?: 'without-focus' | 'with-focus';
  onSelectMagnifierMode?: (mode: 'without-focus' | 'with-focus') => void;
  showTextControls?: boolean;
  fontFamily?: string;
  onSelectFontFamily?: (fontFamily: string) => void;
  fontSize?: number;
  onSelectFontSize?: (fontSize: number) => void;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  isCropping?: boolean;
  onToggleCrop?: () => void;
  onConfirmCrop?: () => void;
  onCancelCrop?: () => void;
  arrowStyle?: ArrowStyle;
  onSelectArrowStyle?: (style: ArrowStyle) => void;
  onToggleCurveDirection?: () => void;
  selectedAnnotations?: Annotation[];
  initialOpenMenu?: OpenToolbarMenu;
}

export const TOOLBAR_COLORS = [
  '#ff3b30',
  '#ff9f0a',
  '#34c759',
  '#0071e3',
  '#5856d6',
  '#000000',
  '#ffffff',
];
export const COLORS = TOOLBAR_COLORS;

export type OpenToolbarMenu = 'palette' | 'arrow' | 'magnifier' | 'text' | 'capture' | null;

export function resolveActiveToolbarMenu(
  currentMenu: OpenToolbarMenu,
  targetMenu: OpenToolbarMenu
): OpenToolbarMenu {
  if (targetMenu === null) return null;
  return currentMenu === targetMenu ? null : targetMenu;
}

export function isClickOutsideActiveMenu(
  activeMenu: OpenToolbarMenu,
  containers: {
    palette?: Node | null;
    arrow?: Node | null;
    magnifier?: Node | null;
    text?: Node | null;
    capture?: Node | null;
  },
  target: Node | null
): boolean {
  if (!activeMenu || !target) return false;
  const container = containers[activeMenu];
  if (!container) return false;
  return !container.contains(target);
}

export function shouldSwitchToolOnMenuClick(
  currentTool: ToolType,
  targetTool: ToolType,
  selectedAnnotations: Annotation[] = []
): boolean {
  if (currentTool === targetTool) return false;
  const hasSelectedTargetType = selectedAnnotations.some((a) => a.type === targetTool);
  if (hasSelectedTargetType) return false;
  return true;
}

export interface HorizontalFloatingMenuProps {
  isOpen: boolean;
  testId?: string;
  align?: 'center' | 'left' | 'right';
  children: React.ReactNode;
}

export const HorizontalFloatingMenu: React.FC<HorizontalFloatingMenuProps> = ({
  isOpen,
  testId,
  align = 'center',
  children,
}) => {
  if (!isOpen) return null;

  const getTransform = () => {
    if (align === 'left') return 'translateX(0)';
    if (align === 'right') return 'translateX(-100%)';
    return 'translateX(-50%)';
  };

  const getLeft = () => {
    if (align === 'left') return '0';
    if (align === 'right') return '100%';
    return '50%';
  };

  return (
    <div
      data-testid={testId}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: getLeft(),
        transform: getTransform(),
        zIndex: 200,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e7',
        borderRadius: '8px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
        padding: '3px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  strokeColor,
  onSelectColor,
  strokeWidth,
  onSelectStrokeWidth,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewCapture,
  onCopy,
  onExport,
  onInsertImage,
  magnifierMode = 'without-focus',
  onSelectMagnifierMode,
  fontFamily = 'Arial',
  onSelectFontFamily,
  fontSize = 18,
  onSelectFontSize,
  zoomLevel = 1.0,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isCropping = false,
  onToggleCrop,
  onConfirmCrop,
  onCancelCrop,
  arrowStyle = 'standard',
  onSelectArrowStyle,
  onToggleCurveDirection,
  selectedAnnotations = [],
  initialOpenMenu = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const paletteContainerRef = useRef<HTMLDivElement>(null);
  const arrowContainerRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const magnifierContainerRef = useRef<HTMLDivElement>(null);
  const captureContainerRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hoveredAction, setHoveredAction] = useState<HoveredToolbarAction>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenToolbarMenu>(initialOpenMenu);
  const openMenuRef = useRef<OpenToolbarMenu>(openMenu);
  openMenuRef.current = openMenu;

  const feedback = resolveToolbarActionFeedback(hoveredAction, isCopied);
  const layoutMetrics = getToolbarLayoutMetrics();
  const { effectiveArrowStyle, showInvertCurve } = resolveArrowToolbarState(
    activeTool,
    selectedAnnotations,
    arrowStyle
  );
  const { effectiveMagnifierMode } = resolveMagnifierToolbarState(
    activeTool,
    selectedAnnotations,
    magnifierMode
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const targetNode = e.target as Node;
      if (exportMenuRef.current && !exportMenuRef.current.contains(targetNode)) {
        setIsExportMenuOpen(false);
      }
      const currentMenu = openMenuRef.current;
      if (
        isClickOutsideActiveMenu(
          currentMenu,
          {
            palette: paletteContainerRef.current,
            arrow: arrowContainerRef.current,
            magnifier: magnifierContainerRef.current,
            text: textContainerRef.current,
            capture: captureContainerRef.current,
          },
          targetNode
        )
      ) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImage(file);
      e.target.value = '';
    }
  };

  const handleCopyClick = () => {
    onCopy();
    setIsCopied(true);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setIsCopied(false);
    }, 1800);
  };

  const getToolButtonStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: INNER_CONTROL_HEIGHT,
    height: INNER_CONTROL_HEIGHT,
    boxSizing: 'border-box',
    backgroundColor: isActive ? '#ffffff' : 'transparent',
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    border: 'none',
    borderRadius: '6px',
    padding: 0,
    cursor: 'pointer',
  });

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
        gap: '12px',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Coluna 1 (Extremo Esquerdo): Botão de Nova Captura e Menu Suspenso à Direita */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: layoutMetrics.leftAlignment,
        }}
      >
        <div
          ref={captureContainerRef}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'capture'))}
            title="Nova Captura"
            aria-label="Nova Captura"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: openMenu === 'capture' ? 0 : '6px',
              width: openMenu === 'capture' ? layoutMetrics.captureButtonHeight : 'auto',
              height: layoutMetrics.captureButtonHeight,
              boxSizing: 'border-box',
              backgroundColor: openMenu === 'capture' ? 'rgba(0, 113, 227, 0.12)' : 'rgba(0, 0, 0, 0.04)',
              color: openMenu === 'capture' ? '#0071e3' : '#1e293b',
              border: openMenu === 'capture' ? '1px solid rgba(0, 113, 227, 0.3)' : '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '8px',
              padding: openMenu === 'capture' ? 0 : '0 12px',
              fontWeight: 600,
              fontSize: '13px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Camera size={openMenu === 'capture' ? 18 : 16} />
            {openMenu !== 'capture' && <span>Nova Captura</span>}
          </button>

          {/* Menu Suspenso de Captura projetado para a Direita (desobstrui a galeria lateral) */}
          {openMenu === 'capture' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '100%',
                marginLeft: '8px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#ffffff',
                padding: '4px 6px',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                border: '1px solid #e2e8f0',
                zIndex: 10001,
                whiteSpace: 'nowrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onNewCapture('region');
                }}
                title="Capturar Área Retangular (arraste livre)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Crop size={14} />
                <span>Área</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onNewCapture('window');
                }}
                title="Capturar Janela (seletor nativo do sistema)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <AppWindow size={14} />
                <span>Janela</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onNewCapture('fullscreen');
                }}
                title="Capturar Tela Inteira (monitor completo)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Monitor size={14} />
                <span>Tela Inteira</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Coluna 2 (Centro): Barra de Ferramentas de Desenho e Anotação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: layoutMetrics.centerAlignment,
          height: layoutMetrics.centerToolbarHeight,
          boxSizing: 'border-box',
          gap: '4px',
          backgroundColor: '#f5f5f7',
          padding: '0 6px',
          borderRadius: '8px',
          border: '1px solid #e5e5e7',
        }}
      >
        <button
          type="button"
          title="Selecionar / Multiseleção (Clique e arraste)"
          onClick={() => onSelectTool('select')}
          style={getToolButtonStyle(activeTool === 'select')}
        >
          <MousePointer size={16} />
        </button>

        <button
          type="button"
          title="Retângulo"
          onClick={() => onSelectTool('rect')}
          style={getToolButtonStyle(activeTool === 'rect')}
        >
          <Square size={16} />
        </button>

        <button
          type="button"
          title="Círculo / Elipse"
          onClick={() => onSelectTool('ellipse')}
          style={getToolButtonStyle(activeTool === 'ellipse')}
        >
          <Circle size={16} />
        </button>

        <button
          type="button"
          title="Linha / Traço (Sublinhar)"
          onClick={() => onSelectTool('line')}
          style={getToolButtonStyle(activeTool === 'line')}
        >
          <Minus size={16} />
        </button>

        {/* Flecha com submenu horizontal flutuante */}
        <div
          ref={arrowContainerRef}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
          <button
            type="button"
            title="Flecha"
            onClick={() => {
              if (shouldSwitchToolOnMenuClick(activeTool, 'arrow', selectedAnnotations)) {
                onSelectTool('arrow');
              }
              setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'arrow'));
            }}
            style={getToolButtonStyle(activeTool === 'arrow' || openMenu === 'arrow')}
          >
            <ArrowRight size={16} />
          </button>
          <HorizontalFloatingMenu
            isOpen={openMenu === 'arrow'}
            testId="horizontal-floating-menu-arrow"
          >
            {ARROW_STYLE_OPTIONS.map((opt) => {
              const isSelected = effectiveArrowStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.tooltip}
                  onClick={() => onSelectArrowStyle?.(opt.id)}
                  style={{
                    height: '24px',
                    padding: '0 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#0071e3' : 'transparent',
                    color: isSelected ? '#ffffff' : '#334155',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            {showInvertCurve && (
              <button
                type="button"
                title="Inverter direção do arco da flecha curva"
                onClick={onToggleCurveDirection}
                style={{
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCw size={13} />
                <span>Inverter arco</span>
              </button>
            )}
          </HorizontalFloatingMenu>
        </div>

        {/* Bloco de Texto com submenu horizontal flutuante */}
        <div
          ref={textContainerRef}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
          <button
            type="button"
            title="Bloco de Texto"
            onClick={() => {
              if (shouldSwitchToolOnMenuClick(activeTool, 'text', selectedAnnotations)) {
                onSelectTool('text');
              }
              setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'text'));
            }}
            style={getToolButtonStyle(activeTool === 'text' || openMenu === 'text')}
          >
            <Type size={16} />
          </button>
          <HorizontalFloatingMenu
            isOpen={openMenu === 'text'}
            testId="horizontal-floating-menu-text"
          >
            <select
              title="Família da fonte"
              value={fontFamily}
              onChange={(e) => onSelectFontFamily?.(e.target.value)}
              style={{
                height: '24px',
                boxSizing: 'border-box',
                fontSize: '12px',
                fontFamily,
                padding: '0 6px',
                borderRadius: '6px',
                border: '1px solid #d1d1d6',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
            <select
              title="Tamanho da fonte"
              value={fontSize}
              onChange={(e) => onSelectFontSize?.(Number(e.target.value))}
              style={{
                height: '24px',
                boxSizing: 'border-box',
                fontSize: '12px',
                padding: '0 6px',
                borderRadius: '6px',
                border: '1px solid #d1d1d6',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </HorizontalFloatingMenu>
        </div>

        <button
          type="button"
          title="Inserir Figura / Imagem"
          onClick={() => fileInputRef.current?.click()}
          style={getToolButtonStyle(activeTool === 'image')}
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

        {/* Lupa com submenu horizontal flutuante */}
        <div
          ref={magnifierContainerRef}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
          <button
            type="button"
            title="Lupa de Zoom"
            onClick={() => {
              if (shouldSwitchToolOnMenuClick(activeTool, 'magnifier', selectedAnnotations)) {
                onSelectTool('magnifier');
              }
              setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'magnifier'));
            }}
            style={getToolButtonStyle(activeTool === 'magnifier' || openMenu === 'magnifier')}
          >
            <Search size={16} />
          </button>
          <HorizontalFloatingMenu
            isOpen={openMenu === 'magnifier'}
            testId="horizontal-floating-menu-magnifier"
          >
            <button
              type="button"
              title="Lupa Sem Foco: Amplia diretamente a área sob a lente (como tradicionalmente)"
              onClick={() => onSelectMagnifierMode?.('without-focus')}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveMagnifierMode === 'without-focus' ? '#0071e3' : 'transparent',
                color: effectiveMagnifierMode === 'without-focus' ? '#ffffff' : '#334155',
              }}
            >
              Sem foco
            </button>
            <button
              type="button"
              title="Lupa Com Foco: Clica no ponto de foco e puxa a lupa para o canto com rastro fosco"
              onClick={() => onSelectMagnifierMode?.('with-focus')}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveMagnifierMode === 'with-focus' ? '#0071e3' : 'transparent',
                color: effectiveMagnifierMode === 'with-focus' ? '#ffffff' : '#334155',
              }}
            >
              Com foco
            </button>
          </HorizontalFloatingMenu>
        </div>

        <button
          type="button"
          title="Recortar Imagem (Crop)"
          onClick={() => {
            if (onToggleCrop) {
              onToggleCrop();
            } else {
              onSelectTool('crop');
            }
          }}
          style={getToolButtonStyle(activeTool === 'crop' || Boolean(isCropping))}
        >
          <Crop size={16} />
        </button>

        {isCropping && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: INNER_CONTROL_HEIGHT,
              gap: '4px',
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              title="Confirmar Recorte (Enter)"
              onClick={onConfirmCrop}
              style={{
                height: INNER_CONTROL_HEIGHT,
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#15803d',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <Check size={14} strokeWidth={2.2} />
              <span>Confirmar</span>
              <kbd
                style={{
                  fontSize: '9px',
                  opacity: 0.75,
                  padding: '1px 3px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  marginLeft: '2px',
                  lineHeight: 1,
                }}
              >
                ↵
              </kbd>
            </button>
            <button
              type="button"
              title="Cancelar Recorte (Esc)"
              onClick={onCancelCrop}
              style={{
                height: INNER_CONTROL_HEIGHT,
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: '#b91c1c',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={14} strokeWidth={2.2} />
              <span>Cancelar</span>
              <kbd
                style={{
                  fontSize: '9px',
                  opacity: 0.75,
                  padding: '1px 3px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  marginLeft: '2px',
                  lineHeight: 1,
                }}
              >
                esc
              </kbd>
            </button>
          </div>
        )}

        <div style={{ width: '1px', height: '20px', backgroundColor: '#d1d1d6', margin: '0 4px' }} />

        {/* Paleta de Cores: Botão com ícone que abre lista suspensa horizontal */}
        <div
          ref={paletteContainerRef}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
          <button
            type="button"
            data-testid="palette-trigger-button"
            title="Paleta de cores"
            onClick={() => setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'palette'))}
            style={{
              ...getToolButtonStyle(openMenu === 'palette'),
              position: 'relative',
            }}
          >
            <Palette size={16} />
            <span
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: strokeColor,
                border: '1px solid #ffffff',
                boxShadow: '0 0 1px rgba(0,0,0,0.5)',
              }}
            />
          </button>

          <HorizontalFloatingMenu
            isOpen={openMenu === 'palette'}
            testId="horizontal-floating-menu-palette"
          >
            {TOOLBAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={`Cor ${c}`}
                onClick={() => {
                  onSelectColor(c);
                  setOpenMenu(null);
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: strokeColor === c ? '2px solid #0071e3' : '1px solid #ccc',
                  padding: 0,
                  cursor: 'pointer',
                }}
              />
            ))}
          </HorizontalFloatingMenu>
        </div>

        {/* Espessura do traço em pixels (fixo ao lado da paleta) */}
        <select
          title="Espessura da linha (em pixels)"
          value={strokeWidth}
          onChange={(e) => onSelectStrokeWidth(Number(e.target.value))}
          style={{
            marginLeft: '4px',
            height: INNER_CONTROL_HEIGHT,
            boxSizing: 'border-box',
            fontSize: '12px',
            padding: '0 6px',
            borderRadius: '6px',
            border: '1px solid #d1d1d6',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        >
          {STROKE_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width}px
            </option>
          ))}
        </select>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#d1d1d6', margin: '0 4px' }} />

        {/* Desfazer e Refazer junto às ferramentas */}
        <button
          type="button"
          title="Desfazer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: INNER_CONTROL_HEIGHT,
            height: INNER_CONTROL_HEIGHT,
            boxSizing: 'border-box',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            opacity: canUndo ? 1 : 0.4,
            padding: 0,
          }}
        >
          <Undo2 size={16} />
        </button>

        <button
          type="button"
          title="Refazer (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: INNER_CONTROL_HEIGHT,
            height: INNER_CONTROL_HEIGHT,
            boxSizing: 'border-box',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            opacity: canRedo ? 1 : 0.4,
            padding: 0,
          }}
        >
          <Redo2 size={16} />
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#d1d1d6', margin: '0 4px' }} />

        {/* Controles de Zoom In e Zoom Out */}
        <button
          type="button"
          title="Diminuir Zoom (Ctrl/Cmd -)"
          onClick={onZoomOut}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: INNER_CONTROL_HEIGHT,
            height: INNER_CONTROL_HEIGHT,
            boxSizing: 'border-box',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            padding: 0,
            color: '#334155',
          }}
        >
          <ZoomOut size={16} />
        </button>

        <button
          type="button"
          title="Ajustar à tela (Ctrl/Cmd 0)"
          onClick={onResetZoom}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: INNER_CONTROL_HEIGHT,
            boxSizing: 'border-box',
            border: '1px solid #d1d1d6',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
            padding: '0 6px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#334155',
          }}
        >
          {formatZoomPercentage(zoomLevel)}
        </button>

        <button
          type="button"
          title="Aumentar Zoom (Ctrl/Cmd +)"
          onClick={onZoomIn}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: INNER_CONTROL_HEIGHT,
            height: INNER_CONTROL_HEIGHT,
            boxSizing: 'border-box',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            padding: 0,
            color: '#334155',
          }}
        >
          <ZoomIn size={16} />
        </button>
      </div>

      {/* Coluna 3 (Extremo Direito): Ícones Minimalistas de Copiar e Exportar (Disquete) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: layoutMetrics.rightAlignment,
          gap: '8px',
        }}
      >
        {/* Ícone de Copiar + Hover "Copiar" / Feedback "Copiado" */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            aria-label="Copiar"
            onClick={handleCopyClick}
            onMouseEnter={() => setHoveredAction('copy')}
            onMouseLeave={() => setHoveredAction((prev) => (prev === 'copy' ? null : prev))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: layoutMetrics.rightActionIconHeight,
              height: layoutMetrics.rightActionIconHeight,
              boxSizing: 'border-box',
              border: '1px solid #e2e8f0',
              backgroundColor: hoveredAction === 'copy' ? '#f1f5f9' : '#f8fafc',
              color: '#1e293b',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Copy size={17} />
          </button>

          {feedback.copyBadge && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                backgroundColor: feedback.copyBadge === 'Copiado' ? '#16a34a' : '#1e293b',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                pointerEvents: 'none',
                zIndex: 200,
              }}
            >
              {feedback.copyBadge}
            </div>
          )}
        </div>

        {/* Ícone de Disquete Minimalista (Exportar) + Hover "Exportar" */}
        <div
          ref={exportMenuRef}
          style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        >
          <button
            type="button"
            aria-label="Exportar"
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            onMouseEnter={() => setHoveredAction('export')}
            onMouseLeave={() => setHoveredAction((prev) => (prev === 'export' ? null : prev))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: layoutMetrics.rightActionIconHeight,
              height: layoutMetrics.rightActionIconHeight,
              boxSizing: 'border-box',
              border: '1px solid #e2e8f0',
              backgroundColor:
                hoveredAction === 'export' || isExportMenuOpen ? '#f1f5f9' : '#f8fafc',
              color: '#1e293b',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Save size={17} strokeWidth={1.75} />
          </button>

          {feedback.exportBadge && !isExportMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                backgroundColor: '#1e293b',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                pointerEvents: 'none',
                zIndex: 200,
              }}
            >
              {feedback.exportBadge}
            </div>
          )}

          {isExportMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
                padding: '4px',
                minWidth: '140px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                zIndex: 300,
              }}
            >
              {(['png', 'jpeg', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExport(fmt);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#1e293b',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Exportar como {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
