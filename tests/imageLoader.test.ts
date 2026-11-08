import { describe, it, expect } from 'vitest';
import { loadImage } from '../src/utils/imageLoader';

function fakeImage() {
  return { src: '', onload: null as null | (() => void) };
}

describe('loadImage', () => {
  it('chama onLoad com a imagem quando o carregamento termina', () => {
    const img = fakeImage();
    let received: unknown = null;
    loadImage('data:a', (i) => void (received = i), () => img as any);
    expect(img.src).toBe('data:a');
    img.onload?.();
    expect(received).toBe(img);
  });

  it('um onload atrasado depois de cancelar não chama onLoad (troca rápida de imagem)', () => {
    const img = fakeImage();
    let calls = 0;
    const cancel = loadImage('data:a', () => void calls++, () => img as any);
    cancel();
    img.onload?.();
    expect(calls).toBe(0);
  });
});
