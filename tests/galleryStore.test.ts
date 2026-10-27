// tests/galleryStore.test.ts
import { describe, it, expect } from 'vitest';
import { createGalleryStore, GalleryItem } from '../src/state/galleryStore';

describe('Gallery Store', () => {
  it('adds items and selects the newest as active', () => {
    const store = createGalleryStore();
    const item1: GalleryItem = {
      id: 'cap-1',
      title: 'Captura 1',
      dataUrl: 'data:image/png;base64,mock1',
      createdAt: 1000,
    };

    store.addCapture(item1);
    expect(store.getState().captures).toHaveLength(1);
    expect(store.getState().activeId).toBe('cap-1');
  });

  it('enforces a strict maximum of 10 items with FIFO eviction', () => {
    const store = createGalleryStore();

    // Adiciona 11 capturas consecutivas
    for (let i = 1; i <= 11; i++) {
      store.addCapture({
        id: `cap-${i}`,
        title: `Captura ${i}`,
        dataUrl: `data:image/png;base64,mock${i}`,
        createdAt: 1000 + i,
      });
    }

    const state = store.getState();
    expect(state.captures).toHaveLength(10);
    // O item mais antigo (cap-1) deve ter sido descartado pelo FIFO
    expect(state.captures.find((c) => c.id === 'cap-1')).toBeUndefined();
    // O item 2 agora é o primeiro da lista
    expect(state.captures[0].id).toBe('cap-2');
    // O item 11 é o mais recente e ativo
    expect(state.captures[9].id).toBe('cap-11');
    expect(state.activeId).toBe('cap-11');
  });

  it('allows manual removal of an item and updates active selection', () => {
    const store = createGalleryStore();
    store.addCapture({ id: 'cap-a', title: 'A', dataUrl: 'data:...', createdAt: 10 });
    store.addCapture({ id: 'cap-b', title: 'B', dataUrl: 'data:...', createdAt: 20 });

    expect(store.getState().activeId).toBe('cap-b');
    store.removeCapture('cap-b');

    expect(store.getState().captures).toHaveLength(1);
    expect(store.getState().activeId).toBe('cap-a');
  });

  it('switches active capture by ID', () => {
    const store = createGalleryStore();
    store.addCapture({ id: 'cap-x', title: 'X', dataUrl: 'data:...', createdAt: 1 });
    store.addCapture({ id: 'cap-y', title: 'Y', dataUrl: 'data:...', createdAt: 2 });

    store.setActive('cap-x');
    expect(store.getState().activeId).toBe('cap-x');
  });
});
