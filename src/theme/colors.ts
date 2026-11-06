export const RENART_THEME = {
  primary: '#d3551d',
  primaryHover: '#e66a2d',
  primaryTint: 'rgba(211, 85, 29, 0.12)',
  primaryBorder: 'rgba(211, 85, 29, 0.3)',
  galleryActiveBg: 'rgba(211, 85, 29, 0.08)',
} as const;

export interface ThemePalette {
  chrome: string;
  control: string;
  controlActive: string;
  hover: string;
  popup: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  icon: string;
  workspace: string;
  shadow: string;
  thumbBg: string;
  primary: string;
  primaryHover: string;
  primaryTint: string;
  primaryBorder: string;
  galleryActiveBg: string;
  /** Cor do texto/ícone sobre fundo `primary`. */
  onPrimary: string;
}

export const LIGHT_PALETTE: ThemePalette = {
  chrome: '#ffffff',
  control: 'rgba(0,0,0,0.04)',
  controlActive: '#ffffff',
  hover: '#f1f5f9',
  popup: '#f8fafc',
  border: '#e5e5e7',
  borderStrong: '#d1d1d6',
  textPrimary: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#86868b',
  icon: '#334155',
  workspace: '#e5e5e7',
  shadow: 'rgba(0,0,0,0.12)',
  thumbBg: '#f9f9fa',
  primary: RENART_THEME.primary,
  primaryHover: RENART_THEME.primaryHover,
  primaryTint: RENART_THEME.primaryTint,
  primaryBorder: RENART_THEME.primaryBorder,
  galleryActiveBg: RENART_THEME.galleryActiveBg,
  onPrimary: '#ffffff',
};

/** Grafite neutro com o laranja original da raposa. */
export const DARK_PALETTE: ThemePalette = {
  chrome: '#1e1e1e',
  control: '#2b2b2b',
  controlActive: '#3d3d3d',
  hover: '#333333',
  popup: '#2a2a2a',
  border: '#363636',
  borderStrong: '#444444',
  textPrimary: '#ffffff',
  textSecondary: '#c5c5c5',
  textMuted: '#9a9a9a',
  icon: '#e6e6e6',
  workspace: '#121212',
  shadow: 'rgba(0,0,0,0.5)',
  thumbBg: '#252525',
  primary: RENART_THEME.primary,
  primaryHover: RENART_THEME.primaryHover,
  primaryTint: 'rgba(211, 85, 29, 0.18)',
  primaryBorder: 'rgba(211, 85, 29, 0.45)',
  galleryActiveBg: 'rgba(211, 85, 29, 0.14)',
  onPrimary: '#ffffff',
};
