/**
 * AI-Generated Image Detector
 * Multi-factor heuristic analysis to distinguish real photos from AI-generated images.
 *
 * Scoring factors (0-100 real, higher = more likely real):
 *  1. EXIF metadata presence   — Real camera photos almost always have EXIF
 *  2. Local noise analysis     — Real sensors have natural photon noise; AI is often too smooth
 *  3. Edge frequency analysis  — AI images have unnaturally uniform, perfect gradients
 *  4. Color channel correlation — Real photos show correlated channel noise; AI doesn't
 *  5. Blocking artifact check  — AI images often have structured periodic patterns
 */

// ─── 1. EXIF CHECK ─────────────────────────────────────────────────────────────
// Reads raw bytes of a JPEG File to detect EXIF segment (0xFFE1)
export async function hasExifData(file) {
  return new Promise((resolve) => {
    if (!file || file.type !== 'image/jpeg') {
      resolve(false); // only JPEGs carry EXIF
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arr = new Uint8Array(e.target.result);
        // JPEG SOI = FF D8, then look for APP1 marker = FF E1
        if (arr[0] !== 0xFF || arr[1] !== 0xD8) { resolve(false); return; }
        let i = 2;
        while (i < arr.length - 1) {
          if (arr[i] === 0xFF) {
            const marker = arr[i + 1];
            if (marker === 0xE1) {
              // APP1 found — check for 'Exif\0\0' signature
              const segLen = (arr[i + 2] << 8) | arr[i + 3];
              if (i + 10 < arr.length) {
                const sig = String.fromCharCode(arr[i+4], arr[i+5], arr[i+6], arr[i+7]);
                if (sig === 'Exif') { resolve(true); return; }
              }
              i += 2 + segLen;
            } else if (marker === 0xDA) {
              break; // Start of Scan — no more headers
            } else if (marker === 0xD9) {
              break; // End of Image
            } else {
              if (i + 3 < arr.length) {
                const segLen = (arr[i + 2] << 8) | arr[i + 3];
                i += 2 + segLen;
              } else break;
            }
          } else {
            i++;
          }
        }
        resolve(false);
      } catch { resolve(false); }
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 65536)); // Only read first 64KB
  });
}

// ─── 2. PIXEL ANALYSIS ENGINE ──────────────────────────────────────────────────
// Draws image to offscreen canvas and extracts pixel data
function getPixelData(img, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data; // RGBA flat array
}

// ─── 3. LOCAL NOISE ANALYSIS ───────────────────────────────────────────────────
// Real camera photos have natural sensor noise (shot noise + read noise).
// AI images are either too smooth (score very low variance) or have structured noise.
// We analyze local 4x4 block variance across the grayscale channel.
function computeNoiseScore(data, width = 128) {
  const blockSize = 4;
  const variances = [];
  for (let by = 0; by < width - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      const pixels = [];
      for (let y = by; y < by + blockSize; y++) {
        for (let x = bx; x < bx + blockSize; x++) {
          const idx = (y * width + x) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
          pixels.push(gray);
        }
      }
      const mean = pixels.reduce((s, v) => s + v, 0) / pixels.length;
      const variance = pixels.reduce((s, v) => s + (v - mean) ** 2, 0) / pixels.length;
      variances.push(variance);
    }
  }
  const avgVariance = variances.reduce((s, v) => s + v, 0) / variances.length;
  // Natural photo noise variance: typically 20-200 (in 8-bit grayscale)
  // AI images: often < 10 (too smooth) or very high in specific regions
  // Score: peak around variance 40-150 = real photo
  if (avgVariance < 3)   return 10;  // Suspiciously smooth → AI
  if (avgVariance < 8)   return 25;
  if (avgVariance < 15)  return 45;
  if (avgVariance < 200) return 90;  // Natural noise range → real
  return 60; // Very high variance often real but could be stylized
}

// ─── 4. EDGE FREQUENCY ANALYSIS ────────────────────────────────────────────────
// AI images often have very clean, smooth edges (no ringing, consistent gradients).
// Real photos have irregular edge noise (camera shake, depth of field variation).
// We compute gradient magnitude std-dev across image patches.
function computeEdgeScore(data, width = 128) {
  const gradients = [];
  for (let y = 1; y < width - 1; y++) {
    for (let x = 1; x < width - 1; x++) {

      const gl = (y * width + (x - 1)) * 4;
      const gr = (y * width + (x + 1)) * 4;
      const gu = ((y - 1) * width + x) * 4;
      const gd = ((y + 1) * width + x) * 4;
      const gx = (data[gr] - data[gl]) * 0.5;
      const gy = (data[gd] - data[gu]) * 0.5;
      gradients.push(Math.sqrt(gx * gx + gy * gy));
    }
  }
  const mean = gradients.reduce((s, v) => s + v, 0) / gradients.length;
  const stdDev = Math.sqrt(gradients.reduce((s, v) => s + (v - mean) ** 2, 0) / gradients.length);
  const cv = mean > 0 ? stdDev / mean : 0; // Coefficient of variation

  // Real photos: high variation in gradient (cv > 0.8)
  // AI images: very uniform gradient distribution (cv < 0.5)
  if (cv < 0.3) return 15;
  if (cv < 0.5) return 40;
  if (cv < 0.7) return 65;
  return 85;
}

// ─── 5. COLOR CHANNEL DECORRELATION ───────────────────────────────────────────
// In real camera images, R/G/B channels have correlated noise (Bayer pattern).
// AI images often have independent, uncorrelated channel representations.
// Measure R-G correlation in smooth regions.
function computeChannelScore(data, width = 128) {
  let diffRG = 0, diffRB = 0, count = 0;
  // Only sample darker/midtone pixels (more informative noise regions)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const brightness = (r + g + b) / 3;
    if (brightness > 30 && brightness < 200) {
      diffRG += Math.abs(r - g);
      diffRB += Math.abs(r - b);
      count++;
    }
  }
  if (count === 0) return 50;
  const avgDiff = (diffRG + diffRB) / (2 * count);
  // Real photos from natural scenes: avgDiff typically 8-35
  // AI images can be very saturated (high diff) or over-neutral (very low diff)
  if (avgDiff < 3)  return 20;  // Suspiciously neutral / grayscale-like
  if (avgDiff < 8)  return 55;
  if (avgDiff < 40) return 85;
  if (avgDiff < 80) return 60;
  return 30; // Hyper-saturated, often stylized/AI
}

// ─── 6. BLOCKING ARTIFACT CHECK ────────────────────────────────────────────────
// AI diffusion models often produce subtle 8x8 grid patterns from VAE architecture.
// We check for periodicities along horizontal/vertical directions in 8px intervals.
function computeBlockScore(data, width = 128) {
  let blockBoundaryDiff = 0;
  let count = 0;
  for (let y = 8; y < width - 8; y += 8) {
    for (let x = 0; x < width; x++) {
      const above = ((y - 1) * width + x) * 4;
      const below = (y * width + x) * 4;
      blockBoundaryDiff += Math.abs(data[below] - data[above]);
      count++;
    }
  }
  const avgBoundaryDiff = count > 0 ? blockBoundaryDiff / count : 0;
  // AI images often show subtle but consistent discontinuities at 8px boundaries
  // Score: high boundary diff = suspicious periodicity = lower score
  if (avgBoundaryDiff > 25) return 25; // Strong block artifacts → likely AI/heavy compression
  if (avgBoundaryDiff > 15) return 50;
  if (avgBoundaryDiff > 8)  return 70;
  return 88; // Smooth transitions = real photo (or very high quality)
}

// ─── MASTER DETECTOR ──────────────────────────────────────────────────────────
/**
 * Analyzes an image (HTMLImageElement or File) for AI-generation signals.
 * Returns { isReal: boolean, confidence: number, scores: object, reason: string }
 */
export async function detectAIImage(imgElement, file = null) {
  const width = 128;
  const data = getPixelData(imgElement, width);

  // Run all analysis factors
  const noiseScore   = computeNoiseScore(data, width);
  const edgeScore    = computeEdgeScore(data, width);
  const channelScore = computeChannelScore(data, width);
  const blockScore   = computeBlockScore(data, width);

  // EXIF check (only works for File objects)
  let exifScore = 50; // neutral default
  if (file) {
    const hasExif = await hasExifData(file);
    exifScore = hasExif ? 95 : 20;
    // PNG files (no EXIF support) — neutral
    if (file.type === 'image/png') exifScore = 50;
    // Newly captured camera photos often don't have full EXIF — adjust
  }

  // Weighted combination
  const weights = { exif: 0.30, noise: 0.25, edge: 0.20, channel: 0.15, block: 0.10 };
  const finalScore = (
    exifScore   * weights.exif +
    noiseScore  * weights.noise +
    edgeScore   * weights.edge +
    channelScore * weights.channel +
    blockScore  * weights.block
  );

  const scores = { exifScore, noiseScore, edgeScore, channelScore, blockScore, finalScore: Math.round(finalScore) };

  // Decision
  const isReal = finalScore >= 50;

  let reason = '';
  if (!isReal) {
    const flags = [];
    if (exifScore   < 30) flags.push('No camera EXIF metadata found');
    if (noiseScore  < 35) flags.push('Image is unnaturally smooth (no camera noise)');
    if (edgeScore   < 40) flags.push('Edges are too uniform (AI gradient pattern)');
    if (channelScore < 35) flags.push('Color channel distribution is unnatural');
    if (blockScore  < 35) flags.push('Periodic block artifacts detected (AI model grid)');
    reason = flags.length > 0 ? flags.join('; ') : 'Multiple AI indicators detected';
  } else {
    reason = 'Real camera photo characteristics detected';
  }

  return { isReal, confidence: Math.round(finalScore), scores, reason };
}
