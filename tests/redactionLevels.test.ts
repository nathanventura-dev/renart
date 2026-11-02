import { describe, it, expect } from 'vitest';
import {
  resolveRedactionLevel,
  createRedactionRect,
  createRedactionBrush,
  REDACTION_BLUR_RADII,
  REDACTION_SCRAMBLE_CONFIG,
} from '../src/utils/redaction';
import { createEditorStore } from '../src/state/editorStore';

describe('Redaction Levels Model (3-Level System)', () => {
  it('maps levels 1, 2, 3 directly, and maps legacy level 4 to 3', () => {
    expect(resolveRedactionLevel({ level: 1 })).toBe(1);
    expect(resolveRedactionLevel({ level: 2 })).toBe(2);
    expect(resolveRedactionLevel({ level: 3 })).toBe(3);
    // Legacy level 4 maps to level 3 (Tarja preta)
    expect(resolveRedactionLevel({ level: 4 as any })).toBe(3);
  });

  it('provides backward compatibility for legacy effect property', () => {
    // Legacy blur maps to level 2
    expect(resolveRedactionLevel({ effect: 'blur' })).toBe(2);
    // Legacy blackout maps to level 3
    expect(resolveRedactionLevel({ effect: 'blackout' })).toBe(3);
    // Default fallback when empty is level 1 (default natural order)
    expect(resolveRedactionLevel({})).toBe(1);
  });

  it('defines correct blur radii for levels 1 and 2, with level 3 being non-blur blackout', () => {
    expect(REDACTION_BLUR_RADII[1]).toBe(8);
    expect(REDACTION_BLUR_RADII[2]).toBe(16);
    expect((REDACTION_BLUR_RADII as any)[3]).toBeUndefined();

    expect(REDACTION_SCRAMBLE_CONFIG[1]).toEqual({ blockSize: 3, noiseIntensity: 6 });
    expect(REDACTION_SCRAMBLE_CONFIG[2]).toEqual({ blockSize: 5, noiseIntensity: 10 });
  });

  it('creates rect and brush with default level 1 (Rosto) or custom level', () => {
    const rectDefault = createRedactionRect(10, 20, 100, 50);
    expect(rectDefault.level).toBe(1);
    expect(rectDefault.effect).toBe('blur');

    const rectLvl2 = createRedactionRect(10, 20, 100, 50, 2);
    expect(rectLvl2.level).toBe(2);
    expect(rectLvl2.effect).toBe('blur');

    const rectLvl3 = createRedactionRect(10, 20, 100, 50, 3);
    expect(rectLvl3.level).toBe(3);
    expect(rectLvl3.effect).toBe('blackout');

    const brushDefault = createRedactionBrush([0, 0, 10, 10]);
    expect(brushDefault.level).toBe(1);
    expect(brushDefault.effect).toBe('blur');

    const brushLvl3 = createRedactionBrush([0, 0, 10, 10], 3);
    expect(brushLvl3.level).toBe(3);
    expect(brushLvl3.effect).toBe('blackout');
  });

  it('updates selected annotation level when setRedactionLevel is called', () => {
    const store = createEditorStore();
    const ann = createRedactionRect(10, 10, 50, 50, 3, 'test-redact');
    store.addAnnotation(ann);
    store.setSelectedIds(['test-redact']);

    store.setRedactionLevel(2);
    const updated = store.getState().annotations.find((a) => a.id === 'test-redact');
    expect((updated as any)?.level).toBe(2);
    expect((updated as any)?.effect).toBe('blur');
    expect(store.getState().redactionLevel).toBe(2);
  });

  it('initializes store with level 1 (Rosto) as default and alternates 1, 2, 3 freely', () => {
    const store = createEditorStore();
    expect(store.getState().redactionLevel).toBe(1);
    expect(store.getState().redactionEffect).toBe('blur');

    store.setRedactionLevel(2);
    expect(store.getState().redactionLevel).toBe(2);
    expect(store.getState().redactionEffect).toBe('blur');

    store.setRedactionLevel(3);
    expect(store.getState().redactionLevel).toBe(3);
    expect(store.getState().redactionEffect).toBe('blackout');

    store.setRedactionLevel(1);
    expect(store.getState().redactionLevel).toBe(1);
    expect(store.getState().redactionEffect).toBe('blur');
  });

  it('switches between blackout and blur modes properly via setRedactionEffect', () => {
    const store = createEditorStore();
    expect(store.getState().redactionLevel).toBe(1);

    // Switching to blackout sets level 3
    store.setRedactionEffect('blackout');
    expect(store.getState().redactionLevel).toBe(3);
    expect(store.getState().redactionEffect).toBe('blackout');

    // Switching back to blur restores level 1
    store.setRedactionEffect('blur');
    expect(store.getState().redactionLevel).toBe(1);
    expect(store.getState().redactionEffect).toBe('blur');

    // If on level 2 and setRedactionEffect('blur') is called, it preserves level 2
    store.setRedactionLevel(2);
    store.setRedactionEffect('blur');
    expect(store.getState().redactionLevel).toBe(2);
  });
});
