import { RENART_THEME } from '../theme/colors';
import { useTheme } from '../hooks/useTheme';
import React, { useRef, useState, useEffect } from 'react';
import {
  ToolType,
  FONT_FAMILIES,
  FONT_SIZES,
  STROKE_WIDTHS,
  ArrowStyle,
  Annotation,
  MagnifierAnnotation,
  RedactionAnnotation,
  RedactionEffect,
  RedactionMode,
  shouldShowArrowControls,
  shouldShowMagnifierControls,
  shouldShowRedactionControls,
  RedactionLevel,
} from '../state/editorStore';
import { resolveRedactionLevel } from '../utils/redaction';
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
  EyeOff,
  Smile,
  Crop,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  WrapText,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
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

export interface RedactionToolbarState {
  showRedactionControls: boolean;
  effectiveRedactionLevel: RedactionLevel;
  effectiveRedactionEffect: RedactionEffect;
  effectiveRedactionMode: RedactionMode;
}

export function resolveRedactionToolbarState(
  activeTool: ToolType,
  selectedAnnotations: Annotation[] = [],
  globalRedactionLevel: RedactionLevel | RedactionEffect | number = 1,
  globalRedactionMode: RedactionMode = 'rect'
): RedactionToolbarState {
  const showRedactionControls = shouldShowRedactionControls(activeTool, selectedAnnotations);
  const selectedRedaction = selectedAnnotations.find((a) => a.type === 'redaction') as
    | RedactionAnnotation
    | undefined;

  const defaultLevel: RedactionLevel =
    typeof globalRedactionLevel === 'number'
      ? (globalRedactionLevel === 4 ? 3 : globalRedactionLevel as RedactionLevel)
      : globalRedactionLevel === 'blackout'
        ? 3
        : 1;

  const effectiveRedactionLevel: RedactionLevel = selectedRedaction
    ? resolveRedactionLevel(selectedRedaction)
    : defaultLevel;

  const effectiveRedactionEffect: RedactionEffect =
    effectiveRedactionLevel === 3 ? 'blackout' : 'blur';

  return {
    showRedactionControls,
    effectiveRedactionLevel,
    effectiveRedactionEffect,
    effectiveRedactionMode: selectedRedaction?.mode || globalRedactionMode,
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
  isBold?: boolean;
  onToggleBold?: () => void;
  isItalic?: boolean;
  onToggleItalic?: () => void;
  isUnderline?: boolean;
  onToggleUnderline?: () => void;
  isStrikethrough?: boolean;
  onToggleStrikethrough?: () => void;
  textAlign?: 'left' | 'center' | 'right';
  onSelectTextAlign?: (align: 'left' | 'center' | 'right') => void;
  hasBackground?: boolean;
  onToggleBackground?: () => void;
  autoWrap?: boolean;
  onToggleAutoWrap?: () => void;
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
  redactionLevel?: RedactionLevel;
  onSelectRedactionLevel?: (level: RedactionLevel) => void;
  redactionEffect?: RedactionEffect;
  onSelectRedactionEffect?: (effect: RedactionEffect) => void;
  redactionMode?: RedactionMode;
  onSelectRedactionMode?: (mode: RedactionMode) => void;
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
  '#ffffff', // theme-exempt
];
export const COLORS = TOOLBAR_COLORS;

export type OpenToolbarMenu = 'palette' | 'arrow' | 'magnifier' | 'redaction' | 'text' | 'capture' | 'export' | null;

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
    redaction?: Node | null;
    text?: Node | null;
    capture?: Node | null;
    export?: Node | null;
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
  const { palette } = useTheme();
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
        backgroundColor: palette.chrome,
        border: `1px solid ${palette.border}`,
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
  isBold = false,
  onToggleBold,
  isItalic = false,
  onToggleItalic,
  isUnderline = false,
  onToggleUnderline,
  isStrikethrough = false,
  onToggleStrikethrough,
  textAlign = 'left',
  onSelectTextAlign,
  hasBackground = false,
  onToggleBackground,
  autoWrap = false,
  onToggleAutoWrap,
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
  redactionLevel = 1,
  onSelectRedactionLevel,
  redactionEffect = 'blur',
  onSelectRedactionEffect: _onSelectRedactionEffect,
  redactionMode = 'rect',
  onSelectRedactionMode,
  selectedAnnotations = [],
  initialOpenMenu = null,
}) => {
  const { palette, preference, cyclePreference } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const paletteContainerRef = useRef<HTMLDivElement>(null);
  const arrowContainerRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const magnifierContainerRef = useRef<HTMLDivElement>(null);
  const redactionContainerRef = useRef<HTMLDivElement>(null);
  const captureContainerRef = useRef<HTMLDivElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hoveredAction, setHoveredAction] = useState<HoveredToolbarAction>(null);
  const [isCopied, setIsCopied] = useState(false);
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
  const {
    effectiveRedactionLevel,
    effectiveRedactionMode,
  } = resolveRedactionToolbarState(
    activeTool,
    selectedAnnotations,
    redactionLevel ?? (redactionEffect === 'blackout' ? 3 : 1),
    redactionMode
  );


  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const targetNode = e.target as Node;
      const currentMenu = openMenuRef.current;
      if (
        isClickOutsideActiveMenu(
          currentMenu,
          {
            palette: paletteContainerRef.current,
            arrow: arrowContainerRef.current,
            magnifier: magnifierContainerRef.current,
            redaction: redactionContainerRef.current,
            text: textContainerRef.current,
            capture: captureContainerRef.current,
            export: exportMenuRef.current,
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
    backgroundColor: isActive ? palette.controlActive : 'transparent',
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
        backgroundColor: palette.chrome,
        borderBottom: `1px solid ${palette.border}`,
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
              backgroundColor: openMenu === 'capture' ? RENART_THEME.primaryTint : palette.control,
              color: openMenu === 'capture' ? RENART_THEME.primary : palette.textPrimary,
              border: openMenu === 'capture' ? `1px solid ${RENART_THEME.primaryBorder}` : `1px solid ${palette.border}`,
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
                backgroundColor: palette.popup,
                padding: '2px 4px',
                height: layoutMetrics.captureButtonHeight,
                boxSizing: 'border-box',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                border: `1px solid ${palette.border}`,
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
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  height: '28px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: palette.textSecondary,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = palette.controlActive;
                  e.currentTarget.style.color = RENART_THEME.primary;
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = palette.textSecondary;
                  e.currentTarget.style.boxShadow = 'none';
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
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  height: '28px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: palette.textSecondary,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = palette.controlActive;
                  e.currentTarget.style.color = RENART_THEME.primary;
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = palette.textSecondary;
                  e.currentTarget.style.boxShadow = 'none';
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
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  height: '28px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: palette.textSecondary,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = palette.controlActive;
                  e.currentTarget.style.color = RENART_THEME.primary;
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = palette.textSecondary;
                  e.currentTarget.style.boxShadow = 'none';
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
          backgroundColor: palette.hover,
          padding: '0 6px',
          borderRadius: '8px',
          border: `1px solid ${palette.border}`,
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
                    backgroundColor: isSelected ? RENART_THEME.primary : 'transparent',
                    color: isSelected ? '#ffffff' : palette.icon, // theme-exempt
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
                  border: `1px solid ${palette.borderStrong}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: palette.popup,
                  color: palette.icon,
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
                border: `1px solid ${palette.borderStrong}`,
                backgroundColor: palette.chrome,
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
                border: `1px solid ${palette.borderStrong}`,
                backgroundColor: palette.chrome,
                cursor: 'pointer',
              }}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            {/* Divisor vertical */}
            <div style={{ width: '1px', height: '16px', backgroundColor: palette.border, margin: '0 4px' }} />

            {/* Estilos */}
            <button
              type="button"
              title="Negrito (Ctrl+B)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleBold}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: isBold ? RENART_THEME.primary : 'transparent',
                color: isBold ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              title="Itálico (Ctrl+I)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleItalic}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: isItalic ? RENART_THEME.primary : 'transparent',
                color: isItalic ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              title="Sublinhado (Ctrl+U)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleUnderline}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: isUnderline ? RENART_THEME.primary : 'transparent',
                color: isUnderline ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Underline size={14} />
            </button>
            <button
              type="button"
              title="Tachado / Riscado"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleStrikethrough}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: isStrikethrough ? RENART_THEME.primary : 'transparent',
                color: isStrikethrough ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Strikethrough size={14} />
            </button>

            {/* Divisor vertical */}
            <div style={{ width: '1px', height: '16px', backgroundColor: palette.border, margin: '0 4px' }} />

            {/* Alinhamento */}
            <button
              type="button"
              title="Alinhar à esquerda"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectTextAlign?.('left')}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: textAlign === 'left' ? RENART_THEME.primary : 'transparent',
                color: textAlign === 'left' ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              title="Centralizar"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectTextAlign?.('center')}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: textAlign === 'center' ? RENART_THEME.primary : 'transparent',
                color: textAlign === 'center' ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              title="Alinhar à direita"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectTextAlign?.('right')}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: textAlign === 'right' ? RENART_THEME.primary : 'transparent',
                color: textAlign === 'right' ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <AlignRight size={14} />
            </button>

            {/* Divisor vertical */}
            <div style={{ width: '1px', height: '16px', backgroundColor: palette.border, margin: '0 4px' }} />

            {/* Fundo / Destaque */}
            <button
              type="button"
              title="Caixa de destaque / Fundo do texto"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleBackground}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: hasBackground ? RENART_THEME.primary : 'transparent',
                color: hasBackground ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Highlighter size={14} />
            </button>

            {/* Quebra Automática de Linha (Auto-wrap) */}
            <button
              type="button"
              title="Quebra automática de linha (Auto-wrap)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleAutoWrap}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: autoWrap ? RENART_THEME.primary : 'transparent',
                color: autoWrap ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <WrapText size={14} />
            </button>
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

        {/* Ocultação / Censura (Tarja e Blur) com submenu horizontal flutuante */}
        <div
          ref={redactionContainerRef}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
          <button
            type="button"
            title="Ocultar informações (Censura e Desfoque)"
            onClick={() => {
              if (shouldSwitchToolOnMenuClick(activeTool, 'redaction', selectedAnnotations)) {
                onSelectTool('redaction');
              }
              setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'redaction'));
            }}
            style={getToolButtonStyle(activeTool === 'redaction' || openMenu === 'redaction')}
          >
            <EyeOff size={16} />
          </button>
          <HorizontalFloatingMenu
            isOpen={openMenu === 'redaction'}
            testId="horizontal-floating-menu-redaction"
          >
            {/* Nível 1: Rosto / Desfoque suave */}
            <button
              type="button"
              title="Nível 1: Desfoque suave para rostos e fundos"
              onClick={() => onSelectRedactionLevel?.(1)}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveRedactionLevel === 1 ? RENART_THEME.primary : 'transparent',
                color: effectiveRedactionLevel === 1 ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Smile size={15} />
            </button>

            {/* Nível 2: Texto atenuado */}
            <button
              type="button"
              title="Nível 2: Desfoque moderado para texto"
              onClick={() => onSelectRedactionLevel?.(2)}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveRedactionLevel === 2 ? RENART_THEME.primary : 'transparent',
                color: effectiveRedactionLevel === 2 ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Type size={15} style={{ opacity: effectiveRedactionLevel === 2 ? 0.9 : 0.4 }} />
            </button>

            {/* Nível 3: Tarja preta sólida */}
            <button
              type="button"
              title="Nível 3: Tarja preta 100% sólida (Inviolável)"
              onClick={() => onSelectRedactionLevel?.(3)}
              style={{
                width: '28px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveRedactionLevel === 3 ? RENART_THEME.primary : 'transparent',
                color: effectiveRedactionLevel === 3 ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              <Square size={14} fill="currentColor" />
            </button>

            {/* Divisor vertical suave */}
            <div style={{ width: '1px', height: '16px', backgroundColor: palette.border, margin: '0 4px' }} />

            {/* Seletor de Modo: Retângulo vs Pincel */}
            <button
              type="button"
              title="Retângulo: Caixa ajustável para cobrir campos e documentos"
              onClick={() => onSelectRedactionMode?.('rect')}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveRedactionMode === 'rect' ? RENART_THEME.primary : 'transparent',
                color: effectiveRedactionMode === 'rect' ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              Retângulo
            </button>
            <button
              type="button"
              title="Pincel: Traçado livre contínuo com a caneta"
              onClick={() => onSelectRedactionMode?.('brush')}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: effectiveRedactionMode === 'brush' ? RENART_THEME.primary : 'transparent',
                color: effectiveRedactionMode === 'brush' ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              Pincel
            </button>
            </HorizontalFloatingMenu>
        </div>

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
                backgroundColor: effectiveMagnifierMode === 'without-focus' ? RENART_THEME.primary : 'transparent',
                color: effectiveMagnifierMode === 'without-focus' ? '#ffffff' : palette.icon, // theme-exempt
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
                backgroundColor: effectiveMagnifierMode === 'with-focus' ? RENART_THEME.primary : 'transparent',
                color: effectiveMagnifierMode === 'with-focus' ? '#ffffff' : palette.icon, // theme-exempt
              }}
            >
              Com foco
            </button>
          </HorizontalFloatingMenu>
        </div>

        {/* Recortar Imagem (Crop) com menu horizontal flutuante abaixo do ícone */}
        <div
          ref={cropContainerRef}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
          <button
            type="button"
            title="Recortar Imagem (Crop)"
            onClick={() => {
              setOpenMenu(null);
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

          <HorizontalFloatingMenu
            isOpen={Boolean(isCropping)}
            testId="horizontal-floating-menu-crop"
          >
            <button
              type="button"
              title="Confirmar Recorte (Enter)"
              onClick={onConfirmCrop}
              style={{
                height: '24px',
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.12)';
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
                height: '24px',
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
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
          </HorizontalFloatingMenu>
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: palette.borderStrong, margin: '0 4px' }} />

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
                border: '1px solid #ffffff', // theme-exempt
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
                  border: strokeColor === c ? `2px solid ${RENART_THEME.primary}` : '1px solid #ccc',
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
            border: `1px solid ${palette.borderStrong}`,
            backgroundColor: palette.chrome,
            cursor: 'pointer',
          }}
        >
          {STROKE_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width}px
            </option>
          ))}
        </select>

        <div style={{ width: '1px', height: '20px', backgroundColor: palette.borderStrong, margin: '0 4px' }} />

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

        <div style={{ width: '1px', height: '20px', backgroundColor: palette.borderStrong, margin: '0 4px' }} />

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
            color: palette.icon,
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
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: '6px',
            backgroundColor: palette.chrome,
            cursor: 'pointer',
            padding: '0 6px',
            fontSize: '11px',
            fontWeight: 600,
            color: palette.icon,
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
            color: palette.icon,
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
        {/* Alternância de tema: Sistema → Claro → Escuro */}
        <button
          type="button"
          data-testid="theme-toggle"
          aria-label="Alternar tema"
          title={`Tema: ${preference === 'system' ? 'Sistema' : preference === 'light' ? 'Claro' : 'Escuro'}`}
          onClick={cyclePreference}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: layoutMetrics.rightActionIconHeight,
            height: layoutMetrics.rightActionIconHeight,
            boxSizing: 'border-box',
            border: `1px solid ${palette.border}`,
            backgroundColor: palette.popup,
            color: palette.textPrimary,
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          {preference === 'system' ? <Monitor size={17} /> : preference === 'light' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

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
              border: `1px solid ${palette.border}`,
              backgroundColor: hoveredAction === 'copy' ? palette.hover : palette.popup,
              color: palette.textPrimary,
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
                backgroundColor: feedback.copyBadge === 'Copiado' ? '#16a34a' : '#1e293b', // theme-exempt
                color: '#ffffff', // theme-exempt
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

        {/* Ícone de Disquete Minimalista (Exportar) + Menu Horizontal Minimalista à Esquerda */}
        <div
          ref={exportMenuRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {openMenu === 'export' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: palette.popup,
                border: `1px solid ${palette.border}`,
                borderRadius: '8px',
                padding: '2px 4px',
                height: layoutMetrics.rightActionIconHeight,
                boxSizing: 'border-box',
              }}
            >
              {(['png', 'jpeg', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onExport(fmt);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 8px',
                    height: '28px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: palette.textSecondary,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = palette.controlActive;
                    e.currentTarget.style.color = RENART_THEME.primary;
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = palette.textSecondary;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {`.${fmt}`}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            aria-label="Exportar"
            onClick={() =>
              setOpenMenu((prev) => resolveActiveToolbarMenu(prev, 'export'))
            }
            onMouseEnter={() => setHoveredAction('export')}
            onMouseLeave={() => setHoveredAction((prev) => (prev === 'export' ? null : prev))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: layoutMetrics.rightActionIconHeight,
              height: layoutMetrics.rightActionIconHeight,
              boxSizing: 'border-box',
              border:
                openMenu === 'export'
                  ? `1px solid ${RENART_THEME.primaryBorder}`
                  : `1px solid ${palette.border}`,
              backgroundColor:
                openMenu === 'export'
                  ? RENART_THEME.primaryTint
                  : hoveredAction === 'export'
                    ? palette.hover
                    : palette.popup,
              color: openMenu === 'export' ? RENART_THEME.primary : palette.textPrimary,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <Save size={17} strokeWidth={1.75} />
          </button>

          {feedback.exportBadge && openMenu !== 'export' && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                backgroundColor: '#1e293b', // theme-exempt
                color: '#ffffff', // theme-exempt
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
        </div>
      </div>
    </div>
  );
};
