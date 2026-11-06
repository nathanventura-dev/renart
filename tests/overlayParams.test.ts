import { describe, it, expect } from 'vitest';
import { parseOverlayParams } from '../src/utils/overlayParams';

describe('parseOverlayParams', () => {
  it('parses monitor id and mode', () => {
    expect(parseOverlayParams('?overlay=2&mode=region')).toEqual({ monitorId: 2, mode: 'region' });
    expect(parseOverlayParams('?overlay=0&mode=fullscreen')).toEqual({ monitorId: 0, mode: 'fullscreen' });
  });

  it('returns null when there is no overlay parameter', () => {
    expect(parseOverlayParams('')).toBeNull();
    expect(parseOverlayParams('?mode=region')).toBeNull();
  });

  it('returns null for unsupported or missing modes', () => {
    expect(parseOverlayParams('?overlay=1&mode=window')).toBeNull();
    expect(parseOverlayParams('?overlay=1')).toBeNull();
  });

  it('returns null for non numeric or negative ids', () => {
    expect(parseOverlayParams('?overlay=abc&mode=region')).toBeNull();
    expect(parseOverlayParams('?overlay=-1&mode=region')).toBeNull();
    expect(parseOverlayParams('?overlay=1.5&mode=region')).toBeNull();
  });
});
