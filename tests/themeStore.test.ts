import { describe, it, expect } from 'vitest';
import { createThemeStore, THEME_STORAGE_KEY } from '../src/state/themeStore';

function fakeMedia(initialDark: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initialDark,
    addEventListener: (_t: 'change', cb: () => void) => listeners.add(cb),
    removeEventListener: (_t: 'change', cb: () => void) => listeners.delete(cb),
  };
  return {
    matchMedia: () => mql,
    setDark(v: boolean) {
      mql.matches = v;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(THEME_STORAGE_KEY, initial);
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('themeStore', () => {
  it('defaults to system and resolves from matchMedia', () => {
    expect(createThemeStore({ matchMedia: fakeMedia(true).matchMedia, storage: fakeStorage() }).getState()).toEqual({
      preference: 'system',
      resolved: 'dark',
    });
    expect(createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage: fakeStorage() }).getState().resolved).toBe('light');
  });

  it('forced light/dark ignore the OS', () => {
    const store = createThemeStore({ matchMedia: fakeMedia(true).matchMedia, storage: fakeStorage() });
    store.setPreference('light');
    expect(store.getState().resolved).toBe('light');
    const store2 = createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage: fakeStorage() });
    store2.setPreference('dark');
    expect(store2.getState().resolved).toBe('dark');
  });

  it('OS change updates resolved only in system mode', () => {
    const media = fakeMedia(false);
    const store = createThemeStore({ matchMedia: media.matchMedia, storage: fakeStorage() });
    let notified = 0;
    store.subscribe(() => notified++);
    media.setDark(true);
    expect(store.getState().resolved).toBe('dark');
    expect(notified).toBe(1);
    store.setPreference('light');
    media.setDark(false);
    media.setDark(true);
    expect(store.getState().resolved).toBe('light');
  });

  it('persists preference and restores it', () => {
    const storage = fakeStorage();
    createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage }).setPreference('dark');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    const restored = createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage });
    expect(restored.getState()).toEqual({ preference: 'dark', resolved: 'dark' });
  });

  it('invalid stored value falls back to system', () => {
    const store = createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage: fakeStorage('banana') });
    expect(store.getState().preference).toBe('system');
  });

  it('storage that throws does not break the store', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage });
    store.setPreference('dark');
    expect(store.getState()).toEqual({ preference: 'dark', resolved: 'dark' });
  });

  it('missing matchMedia resolves light', () => {
    const store = createThemeStore({ storage: fakeStorage() });
    expect(store.getState()).toEqual({ preference: 'system', resolved: 'light' });
  });

  it('cyclePreference walks system, light, dark, system', () => {
    const store = createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage: fakeStorage() });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      store.cyclePreference();
      seen.push(store.getState().preference);
    }
    expect(seen).toEqual(['light', 'dark', 'system']);
  });

  it('dispose removes the matchMedia listener and unsubscribe stops notifications', () => {
    const media = fakeMedia(false);
    const store = createThemeStore({ matchMedia: media.matchMedia, storage: fakeStorage() });
    let n = 0;
    const off = store.subscribe(() => n++);
    off();
    store.setPreference('dark');
    expect(n).toBe(0);
    expect(media.listenerCount()).toBe(1);
    store.dispose();
    expect(media.listenerCount()).toBe(0);
  });

  it('state object identity is stable when nothing changes', () => {
    const store = createThemeStore({ matchMedia: fakeMedia(false).matchMedia, storage: fakeStorage() });
    const a = store.getState();
    store.setPreference('system');
    expect(store.getState()).toBe(a);
  });

  it('applies data-theme and color-scheme to the root element and keeps them in sync', () => {
    const attrs: Record<string, string> = {};
    const root = { setAttribute: (n: string, v: string) => void (attrs[n] = v), style: { colorScheme: '' } };
    const media = fakeMedia(false);
    const store = createThemeStore({ matchMedia: media.matchMedia, storage: fakeStorage(), root });
    expect(attrs['data-theme']).toBe('light');
    expect(root.style.colorScheme).toBe('light');
    store.setPreference('dark');
    expect(attrs['data-theme']).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    store.setPreference('system');
    media.setDark(true);
    expect(attrs['data-theme']).toBe('dark');
  });
});
