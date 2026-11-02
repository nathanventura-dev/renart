/**
 * Anti-AI Pixel Scrambler and Entropy Blur Utility.
 *
 * Scrambles local pixel blocks and injects controlled noise prior to Gaussian blurring.
 * This physically and irreversibly destroys high-frequency font glyphs and biometric features
 * before blur convolution is applied, preventing AI de-blurring / de-convolution attacks
 * while maintaining an identical smooth, natural frosted-glass blur to the human eye.
 */

export function scramblePixelData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number = 3,
  noiseIntensity: number = 0
): Uint8ClampedArray {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return data;
  }

  const effectiveBlockSize = Math.max(1, Math.floor(blockSize));

  // If blockSize > 1, shuffle pixels inside each block
  if (effectiveBlockSize > 1) {
    for (let by = 0; by < height; by += effectiveBlockSize) {
      const bh = Math.min(effectiveBlockSize, height - by);
      for (let bx = 0; bx < width; bx += effectiveBlockSize) {
        const bw = Math.min(effectiveBlockSize, width - bx);
        const count = bw * bh;
        if (count <= 1) continue;

        // Collect coordinates of pixels within this block
        const coords: Array<{ x: number; y: number }> = [];
        for (let dy = 0; dy < bh; dy++) {
          for (let dx = 0; dx < bw; dx++) {
            coords.push({ x: bx + dx, y: by + dy });
          }
        }

        // Create a copy of the original pixel values in this block
        const blockPixels: Array<[number, number, number]> = coords.map(({ x, y }) => {
          const idx = (y * width + x) * 4;
          return [data[idx], data[idx + 1], data[idx + 2]];
        });

        // Fisher-Yates shuffle of pixel positions within the block
        for (let i = count - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = blockPixels[i];
          blockPixels[i] = blockPixels[j];
          blockPixels[j] = temp;
        }

        // Put shuffled pixels back into data (preserving original alpha)
        for (let i = 0; i < count; i++) {
          const { x, y } = coords[i];
          const idx = (y * width + x) * 4;
          data[idx] = blockPixels[i][0];
          data[idx + 1] = blockPixels[i][1];
          data[idx + 2] = blockPixels[i][2];
          // Alpha at data[idx + 3] is unchanged
        }
      }
    }
  }

  // Inject subtle uniform noise if noiseIntensity > 0
  if (noiseIntensity > 0) {
    const intensity = Math.floor(noiseIntensity);
    for (let i = 0; i < data.length; i += 4) {
      const deltaR = Math.round((Math.random() * 2 - 1) * intensity);
      const deltaG = Math.round((Math.random() * 2 - 1) * intensity);
      const deltaB = Math.round((Math.random() * 2 - 1) * intensity);

      data[i] = Math.min(255, Math.max(0, data[i] + deltaR));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + deltaG));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + deltaB));
      // Alpha channel is never modified
    }
  }

  return data;
}

export function createAntiAiBlurredCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  blurRadius: number,
  blockSize: number = 3,
  noiseIntensity: number = 6
): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined' || !source || source.width <= 0 || source.height <= 0) {
      return null;
    }

    // Step 1: Draw source onto offscreen scratch canvas 1:1
    const scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = source.width;
    scratchCanvas.height = source.height;
    const scratchCtx = scratchCanvas.getContext('2d');
    if (!scratchCtx) return null;

    scratchCtx.drawImage(source, 0, 0);

    // Step 2: Read pixel data and scramble
    const imgData = scratchCtx.getImageData(0, 0, source.width, source.height);
    scramblePixelData(imgData.data, source.width, source.height, blockSize, noiseIntensity);
    scratchCtx.putImageData(imgData, 0, 0);

    // Step 3: Apply blur with edge expansion onto final canvas
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = source.width;
    blurCanvas.height = source.height;
    const blurCtx = blurCanvas.getContext('2d');
    if (!blurCtx) return scratchCanvas;

    blurCtx.filter = `blur(${blurRadius}px)`;
    blurCtx.drawImage(
      scratchCanvas,
      -blurRadius,
      -blurRadius,
      source.width + blurRadius * 2,
      source.height + blurRadius * 2
    );

    return blurCanvas;
  } catch {
    return null;
  }
}
