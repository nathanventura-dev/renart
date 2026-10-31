import { describe, it, expect } from 'vitest';
import {
  resolveRedactionLevel,
  createRedactionRect,
  createRedactionBrush,
  REDACTION_BLUR_RADII,
} from '../src/utils/redaction';
import { createEditorStore } from '../src/state/editorStore';

describe('Redaction Levels Model', () => {
  it('maps levels 1, 2, 3, 4 directly', () => {
    expect(resolveRedactionLevel({ level: 1 })).toBe(1);
    expect(resolveRedactionLevel({ level: 2 })).toBe(2);
    expect(resolveRedactionLevel({ level: 3 })).toBe(3);
    expect(resolveRedactionLevel({ level: 4 })).toBe(4);
  });

  it('provides backward compatibility for legacy effect property', () => {
    expect(resolveRedactionLevel({ effect: 'blur' })).toBe(3);
    expect(resolveRedactionLevel({ effect: 'blackout' })).toBe(4);
    expect(resolveRedactionLevel({})).toBe(4);
  });

  it('defines correct blur radii', () => {
    expect(REDACTION_BLUR_RADII[1]).toBe(8);
    expect(REDACTION_BLUR_RADII[2]).toBe(14);
    expect(REDACTION_BLUR_RADII[3]).toBe(26);
  });

  it('creates rect and brush with default or custom level', () => {
    const rectDefault = createRedactionRect(10, 20, 100, 50);
    expect(rectDefault.level).toBe(4);

    const rectLvl2 = createRedactionRect(10, 20, 100, 50, 2);
    expect(rectLvl2.level).toBe(2);

    const brushDefault = createRedactionBrush([0, 0, 10, 10]);
    expect(brushDefault.level).toBe(4);

    const brushLvl1 = createRedactionBrush([0, 0, 10, 10], 1);
    expect(brushLvl1.level).toBe(1);
  });

  it('updates selected annotation level when setRedactionLevel is called', () => {
    const store = createEditorStore();
    const ann = createRedactionRect(10, 10, 50, 50, 4, 'test-redact');
    store.addAnnotation(ann);
    store.setSelectedIds(['test-redact']);

    store.setRedactionLevel(2);
    const updated = store.getState().annotations.find((a) => a.id === 'test-redact');
    expect((updated as any)?.level).toBe(2);
    expect(store.getState().redactionLevel).toBe(2);
  });

  it('allows alternating redaction levels freely before any annotation is added', () => {
    const store = createEditorStore();
    expect(store.getState().redactionLevel).toBe(4);
    expect(store.getState().redactionEffect).toBe('blackout');

    store.setRedactionLevel(1);
    expect(store.getState().redactionLevel).toBe(1);
    expect(store.getState().redactionEffect).toBe('blur');

    store.setRedactionLevel(2);
    expect(store.getState().redactionLevel).toBe(2);
    expect(store.getState().redactionEffect).toBe('blur');

    store.setRedactionLevel(3);
    expect(store.getState().redactionLevel).toBe(3);
    expect(store.getState().redactionEffect).toBe('blur');

    store.setRedactionLevel(4);
    expect(store.getState().redactionLevel).toBe(4);
    expect(store.getState().redactionEffect).toBe('blackout');

    store.setRedactionLevel(1);
    expect(store.getState().redactionLevel).toBe(1);
    expect(store.getState().redactionEffect).toBe('blur');
  });

  it('preserves level 1 and 2 when setRedactionEffect is called with blur', () => {
    const store = createEditorStore();
    store.setRedactionLevel(1);
    store.setRedactionEffect('blur');
    expect(store.getState().redactionLevel).toBe(1);

    store.setRedactionLevel(2);
    store.setRedactionEffect('blur');
    expect(store.getState().redactionLevel).toBe(2);
  });
});
