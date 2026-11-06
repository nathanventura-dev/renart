export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'renart-theme-preference';

export interface MediaQueryListLike {
  matches: boolean;
  addEventListener(type: 'change', cb: () => void): void;
  removeEventListener(type: 'change', cb: () => void): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeEnv {
  matchMedia?: (query: string) => MediaQueryListLike;
  storage?: StorageLike;
}

export interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

const CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

function isPreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

function defaultEnv(): ThemeEnv {
  if (typeof window === 'undefined') return {};
  let storage: StorageLike | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  return {
    matchMedia: typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : undefined,
    storage,
  };
}

export function createThemeStore(env: ThemeEnv = defaultEnv()) {
  const mql = env.matchMedia ? env.matchMedia('(prefers-color-scheme: dark)') : undefined;
  const listeners: Set<() => void> = new Set();
  const notify = () => listeners.forEach((l) => l());

  const resolve = (pref: ThemePreference): ResolvedTheme => {
    if (pref === 'system') return mql?.matches ? 'dark' : 'light';
    return pref;
  };

  let stored: string | null = null;
  try {
    stored = env.storage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    stored = null;
  }
  const initial: ThemePreference = isPreference(stored) ? stored : 'system';
  let state: ThemeState = { preference: initial, resolved: resolve(initial) };

  const update = (preference: ThemePreference) => {
    const resolved = resolve(preference);
    if (state.preference === preference && state.resolved === resolved) return;
    state = { preference, resolved };
    notify();
  };

  const onOsChange = () => {
    if (state.preference === 'system') update('system');
  };
  mql?.addEventListener('change', onOsChange);

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPreference: (preference: ThemePreference) => {
      try {
        env.storage?.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        /* persistência indisponível: segue só em memória */
      }
      update(preference);
    },
    cyclePreference: () => {
      const next = CYCLE[(CYCLE.indexOf(state.preference) + 1) % CYCLE.length];
      try {
        env.storage?.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ver acima */
      }
      update(next);
    },
    dispose: () => {
      mql?.removeEventListener('change', onOsChange);
    },
  };
}

export type ThemeStore = ReturnType<typeof createThemeStore>;

export const themeStore: ThemeStore = createThemeStore();
