import type { ResolvedTheme } from '../state/themeStore';

/** Raposa laranja no tema claro; raposa ciano (noite) no tema escuro. */
export function getMascotSrc(resolved: ResolvedTheme): string {
  return resolved === 'dark' ? '/mascot-dark.png' : '/mascot-light.png';
}
