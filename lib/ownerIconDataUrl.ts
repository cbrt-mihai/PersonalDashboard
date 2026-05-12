export async function fileToOwnerIconDataUrl(
  file: File,
  opts?: { maxSize?: number; maxBytes?: number },
): Promise<string> {
  const maxSize = opts?.maxSize ?? 256;
  const maxBytes = opts?.maxBytes ?? 350_000;
  const alphaThreshold = 8; // 0-255; ignore near-transparent pixels

  // SVG: keep as-is (preserves vector + transparency).
  if (file.type === "image/svg+xml") {
    const raw = await readFileAsDataUrl(file);
    if (raw.length > maxBytes * 2) {
      // Data URLs are ~33% overhead, so use a looser guard.
      throw new Error("SVG is too large");
    }
    return raw;
  }

  // Raster: decode, auto-crop transparent padding, then downscale. Export to PNG
  // to preserve transparency (e.g. from PNG/WebP).
  const bitmap = await createImageBitmap(file);
  try {
    // First draw at native resolution to find content bounds accurately.
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = bitmap.width;
    scanCanvas.height = bitmap.height;
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
    if (!scanCtx) throw new Error("Canvas not available");
    scanCtx.clearRect(0, 0, bitmap.width, bitmap.height);
    scanCtx.drawImage(bitmap, 0, 0);

    const bounds = findOpaqueBounds(scanCtx, bitmap.width, bitmap.height, alphaThreshold);
    const src = bounds ?? { x: 0, y: 0, w: bitmap.width, h: bitmap.height };

    const scale = Math.min(1, maxSize / Math.max(src.w, src.h));
    const outW = Math.max(1, Math.round(src.w * scale));
    const outH = Math.max(1, Math.round(src.h * scale));

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) throw new Error("Canvas not available");
    outCtx.clearRect(0, 0, outW, outH);
    outCtx.drawImage(scanCanvas, src.x, src.y, src.w, src.h, 0, 0, outW, outH);

    const dataUrl = outCanvas.toDataURL("image/png");
    if (dataUrl.length > maxBytes * 2) {
      throw new Error("Icon is too large after resize");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

function findOpaqueBounds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alphaThreshold: number,
): { x: number; y: number; w: number; h: number } | null {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]!;
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  // Add a tiny safety margin (1px) to avoid shaving anti-aliased edges.
  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(w - 1, maxX + 1);
  maxY = Math.min(h - 1, maxY + 1);

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read file"));
    r.onload = () => resolve(String(r.result ?? ""));
    r.readAsDataURL(file);
  });
}
