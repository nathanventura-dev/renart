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
};

/** Tons medidos da Ferramenta de Captura (Windows 11) no modo escuro. */
export const DARK_PALETTE: ThemePalette = {
  chrome: '#1a2227',
  control: '#272f34',
  controlActive: '#3d484f',
  hover: '#323a40',
  popup: '#2b2c2d',
  border: '#2c3338',
  borderStrong: '#3b444a',
  textPrimary: '#ffffff',
  textSecondary: '#c5c5c5',
  textMuted: '#9aa0a6',
  icon: '#e6e8ea',
  workspace: '#121211',
  shadow: 'rgba(0,0,0,0.5)',
  thumbBg: '#20282d',
};
