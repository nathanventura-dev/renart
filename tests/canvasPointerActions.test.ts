import { describe, it, expect } from 'vitest';
import { shouldDeselectOnEmptyClick } from '../src/utils/canvasPointerActions';

describe('Canvas Pointer Deselection Actions', () => {
  it('returns true when there is a selection or active text editing and Alt is not pressed', () => {
    expect(shouldDeselectOnEmptyClick(true, false, false)).toBe(true);
    expect(shouldDeselectOnEmptyClick(false, true, false)).toBe(true);
    expect(shouldDeselectOnEmptyClick(true, true, false)).toBe(true);
  });

  it('returns false when Alt is pressed even if there is an active selection', () => {
    expect(shouldDeselectOnEmptyClick(true, false, true)).toBe(false);
    expect(shouldDeselectOnEmptyClick(false, true, true)).toBe(false);
  });

  it('returns false when there is no selection and not editing', () => {
    expect(shouldDeselectOnEmptyClick(false, false, false)).toBe(false);
    expect(shouldDeselectOnEmptyClick(false, false, true)).toBe(false);
  });
});
