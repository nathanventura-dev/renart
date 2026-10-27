export type CaptureMode = 'region' | 'freeform' | 'fullscreen';

export interface Point {
  x: number;
  y: number;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureItem {
  id: string;
  title: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
  isSaved?: boolean;
}
