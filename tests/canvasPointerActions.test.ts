import { describe, it, expect } from 'vitest';
import {
  shouldDeselectOnEmptyClick,
  getDefaultShapeDimensions,
  isSimpleClick,
} from '../src/utils/canvasPointerActions';

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

describe('Default Shape Stamp Dimensions and Simple Click', () => {
  it('returns standard stamp dimensions for each tool', () => {
    expect(getDefaultShapeDimensions('rect')).toEqual({ width: 120, height: 60 });
    expect(getDefaultShapeDimensions('ellipse')).toEqual({ radiusX: 35, radiusY: 25 });
    expect(getDefaultShapeDimensions('redaction')).toEqual({ width: 120, height: 40 });
    expect(getDefaultShapeDimensions('line')).toEqual({ points: [0, 0, 100, 0] });
    expect(getDefaultShapeDimensions('arrow')).toEqual({ points: [0, 0, 100, 0] });
  });

  it('detects simple click vs drag based on threshold', () => {
    expect(isSimpleClick(0, 0)).toBe(true);
    expect(isSimpleClick(2, 2)).toBe(true);
    expect(isSimpleClick(4, 4)).toBe(true);
    expect(isSimpleClick(5, 0)).toBe(false);
    expect(isSimpleClick(0, 5)).toBe(false);
    expect(isSimpleClick(-6, 2)).toBe(false);
  });
});
