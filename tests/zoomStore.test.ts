import { describe, it, expect } from 'vitest';
import { createZoomStore, ZOOM_MODE_STORAGE_KEY } from '../src/state/zoomStore';

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(ZOOM_MODE_STORAGE_KEY, initial);
  return {
    data,
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('zoomStore: modo', () => {
  it('padrão é automático sem nada salvo', () => {
    expect(createZoomStore({ storage: fakeStorage() }).getMode()).toBe('auto');
  });

  it('persiste o modo e uma nova store lê o valor salvo', () => {
    const storage = fakeStorage();
    createZoomStore({ storage }).setMode('manual');
    expect(storage.data.get(ZOOM_MODE_STORAGE_KEY)).toBe('manual');
    expect(createZoomStore({ storage }).getMode()).toBe('manual');
  });

  it('valor inválido salvo volta para automático', () => {
    expect(createZoomStore({ storage: fakeStorage('banana') }).getMode()).toBe('auto');
  });

  it('storage que lança exceção não derruba: lê automático e mantém o modo em memória', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const store = createZoomStore({ storage: broken });
    expect(store.getMode()).toBe('auto');
    expect(() => store.setMode('manual')).not.toThrow();
    expect(store.getMode()).toBe('manual');
  });

  it('sem storage disponível funciona só em memória', () => {
    const store = createZoomStore({});
    expect(store.getMode()).toBe('auto');
    store.setMode('manual');
    expect(store.getMode()).toBe('manual');
  });

  it('notifica uma vez por mudança real e para após cancelar a assinatura', () => {
    const store = createZoomStore({ storage: fakeStorage() });
    let calls = 0;
    const unsubscribe = store.subscribe(() => void calls++);
    store.setMode('manual');
    store.setMode('manual');
    expect(calls).toBe(1);
    unsubscribe();
    store.setMode('auto');
    expect(calls).toBe(1);
  });
});

describe('zoomStore: zoom manual por imagem', () => {
  it('guarda, lê e remove o zoom de cada captura', () => {
    const store = createZoomStore({ storage: fakeStorage() });
    store.saveManualZoom('a', 1.5);
    expect(store.getManualZoom('a')).toBe(1.5);
    expect(store.getManualZoom('b')).toBeUndefined();
    store.removeManualZoom('a');
    expect(store.getManualZoom('a')).toBeUndefined();
  });

  it('não grava o zoom manual no storage (vale só na sessão)', () => {
    const storage = fakeStorage();
    createZoomStore({ storage }).saveManualZoom('a', 2);
    expect(storage.data.size).toBe(0);
  });
});

describe('zoomStore: aviso de primeira vez', () => {
  it('começa não mostrado e fica marcado depois, sem ir ao storage', () => {
    const storage = fakeStorage();
    const store = createZoomStore({ storage });
    expect(store.hasShownManualNotice()).toBe(false);
    store.markManualNoticeShown();
    expect(store.hasShownManualNotice()).toBe(true);
    expect(storage.data.size).toBe(0);
    expect(createZoomStore({ storage }).hasShownManualNotice()).toBe(false);
  });
});
