import { describe, it, expect } from 'vitest';
import {
  shouldDeselectOnEmptyClick,
  getDefaultShapeDimensions,
  isSimpleClick,
  calculateStampedShapeGeometry,
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

describe('calculateStampedShapeGeometry', () => {
  it('centers rect at click position and clamps within image bounds', () => {
    const geo = calculateStampedShapeGeometry('rect', { x: 200, y: 150 }, 800, 600);
    expect(geo.x).toBe(140); // 200 - 120/2
    expect(geo.y).toBe(120); // 150 - 60/2
    expect(geo.width).toBe(120);
    expect(geo.height).toBe(60);
  });

  it('clamps rect when click is near image edges', () => {
    const geoNearZero = calculateStampedShapeGeometry('rect', { x: 20, y: 10 }, 800, 600);
    expect(geoNearZero.x).toBe(0);
    expect(geoNearZero.y).toBe(0);

    const geoNearMax = calculateStampedShapeGeometry('rect', { x: 790, y: 590 }, 800, 600);
    expect(geoNearMax.x).toBe(680); // 800 - 120
    expect(geoNearMax.y).toBe(540); // 600 - 60
  });

  it('centers ellipse at click position', () => {
    const geo = calculateStampedShapeGeometry('ellipse', { x: 200, y: 150 }, 800, 600);
    expect(geo.x).toBe(200);
    expect(geo.y).toBe(150);
    expect(geo.radiusX).toBe(35);
    expect(geo.radiusY).toBe(25);
  });

  it('centers redaction at click position', () => {
    const geo = calculateStampedShapeGeometry('redaction', { x: 200, y: 150 }, 800, 600);
    expect(geo.x).toBe(140); // 200 - 120/2
    expect(geo.y).toBe(130); // 150 - 40/2
    expect(geo.width).toBe(120);
    expect(geo.height).toBe(40);
  });

  it('creates horizontal stamped points for line and arrow starting at click position', () => {
    const lineGeo = calculateStampedShapeGeometry('line', { x: 100, y: 100 }, 800, 600);
    expect(lineGeo.points).toEqual([100, 100, 200, 100]);

    const arrowGeo = calculateStampedShapeGeometry('arrow', { x: 100, y: 100 }, 800, 600);
    expect(arrowGeo.points).toEqual([100, 100, 200, 100]);
  });
});
