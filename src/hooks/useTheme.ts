import { useSyncExternalStore } from 'react';
import { themeStore } from '../state/themeStore';
import { DARK_PALETTE, LIGHT_PALETTE } from '../theme/colors';

export function useTheme() {
  const state = useSyncExternalStore(themeStore.subscribe, themeStore.getState, themeStore.getState);
  return {
    palette: state.resolved === 'dark' ? DARK_PALETTE : LIGHT_PALETTE,
    resolved: state.resolved,
    preference: state.preference,
    setPreference: themeStore.setPreference,
    cyclePreference: themeStore.cyclePreference,
  };
}
