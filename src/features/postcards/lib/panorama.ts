import {
  cameraBasis,
  normalize,
  type CameraBasis,
} from "../../../shared/geometry";
import type { Camera } from "../../../shared/types";

export class ResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceError";
  }
}

export interface PanoramaSource {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** true when the source was downscaled from its intrinsic size. */
  downscaled: boolean;
  intrinsicWidth: number;
  intrinsicHeight: number;
}

export interface RenderOptions {
  signal: AbortSignal;
  onProgress?: (value: number) => void;
  rowsPerChunk?: number;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
}

function abortError(): Error {
  const error = new Error("已取消");
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  return (
    !!error && typeof error === "object" && (error as Error).name === "AbortError"
  );
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function decodeImage(
  url: string,
  signal: AbortSignal,
): Promise<DecodedImage> {
  if (signal.aborted) throw abortError();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`场景素材加载失败（${response.status}）`);
  const blob = await response.blob();
  if (signal.aborted) throw abortError();
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      if (signal.aborted) {
        bitmap.close();
        throw abortError();
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Some browsers refuse SVG bitmaps; fall through to an <img>.
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("场景素材无法解码"));
      image.src = objectUrl;
    });
    if (signal.aborted) throw abortError();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Load a panorama and prepare a downsampled CPU texture. The requested
 * texture width is honoured exactly (or the source's own width if smaller),
 * so a "light" preview genuinely trades detail for memory instead of silently
 * falling back.
 */
export async function loadPanorama(
  url: string,
  textureWidth: number,
  signal: AbortSignal,
): Promise<PanoramaSource> {
  const image = await decodeImage(url, signal);
  const intrinsicWidth = Math.max(2, Math.round(image.width));
  const intrinsicHeight = Math.max(2, Math.round(image.height));
  const width = Math.max(
    2,
    Math.min(Math.round(textureWidth), intrinsicWidth),
  );
  const ratio = intrinsicHeight / intrinsicWidth;
  const height = Math.max(2, Math.round(width * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    image.release?.();
    throw new ResourceError("无法创建绘图上下文");
  }
  try {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, width, height);
    // Force a read so allocation failures surface here, not mid-render.
    context.getImageData(0, 0, 1, 1);
  } catch {
    throw new ResourceError(
      `设备无法分配 ${width}×${height} 的场景纹理，请改用轻量预览`,
    );
  } finally {
    image.release?.();
  }
  return {
    canvas,
    width,
    height,
    downscaled: width < intrinsicWidth,
    intrinsicWidth,
    intrinsicHeight,
  };
}

function sampleBilinear(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  fx: number,
  fy: number,
  out: Uint8ClampedArray,
  offset: number,
): void {
  const clampedY = Math.max(0, Math.min(height - 1, fy));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(clampedY);
  const tx = fx - x0;
  const ty = clampedY - y0;
  const xi0 = ((x0 % width) + width) % width;
  const xi1 = (xi0 + 1) % width;
  const yi0 = y0;
  const yi1 = Math.min(height - 1, y0 + 1);
  const a = (yi0 * width + xi0) * 4;
  const b = (yi0 * width + xi1) * 4;
  const c = (yi1 * width + xi0) * 4;
  const d = (yi1 * width + xi1) * 4;
  for (let channel = 0; channel < 4; channel++) {
    const top = pixels[a + channel]! * (1 - tx) + pixels[b + channel]! * tx;
    const bottom = pixels[c + channel]! * (1 - tx) + pixels[d + channel]! * tx;
    out[offset + channel] = top * (1 - ty) + bottom * ty;
  }
}

/**
 * Match the equirectangular UVs of the Three.js sphere used by the live
 * scene: u = atan2(z, x) / 2π, and row 0 of the image is the zenith.
 */
function directionToUv(
  x: number,
  y: number,
  z: number,
): { u: number; row: number } {
  const yaw = Math.atan2(z, x);
  const pitch = Math.asin(Math.max(-1, Math.min(1, y)));
  return { u: yaw / (Math.PI * 2), row: 0.5 - pitch / Math.PI };
}

/**
 * Render the exact perspective the saved camera describes. Uses the same
 * basis as the live Three.js camera, so a card can never show a different
 * framing from the one the visitor chose. No DOM is ever captured.
 */
export async function renderPerspective(
  source: PanoramaSource,
  camera: Camera,
  width: number,
  height: number,
  options: RenderOptions,
): Promise<HTMLCanvasElement> {
  const { signal, onProgress } = options;
  if (signal.aborted) throw abortError();
  const sourceContext = source.canvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!sourceContext) throw new ResourceError("无法读取场景纹理");
  let pixels: ImageData;
  try {
    pixels = sourceContext.getImageData(0, 0, source.width, source.height);
  } catch {
    throw new ResourceError("场景纹理读取失败，请改用轻量预览");
  }
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) throw new ResourceError("无法创建明信片画布");
  const frame = context.createImageData(width, height);
  const data = frame.data;
  const basis: CameraBasis = cameraBasis(camera);
  const aspect = width / height;
  const tan = basis.tanHalf;
  const rowsPerChunk = Math.max(
    4,
    options.rowsPerChunk ?? Math.ceil(height / 24),
  );
  const { width: sw, height: sh } = source;
  const sourcePixels = pixels.data;

  for (let rowStart = 0; rowStart < height; rowStart += rowsPerChunk) {
    if (signal.aborted) throw abortError();
    const rowEnd = Math.min(height, rowStart + rowsPerChunk);
    for (let py = rowStart; py < rowEnd; py++) {
      const cy = (1 - ((py + 0.5) / height) * 2) * tan;
      for (let px = 0; px < width; px++) {
        const cx = (((px + 0.5) / width) * 2 - 1) * tan * aspect;
        const dir = normalize({
          x: basis.forward.x + cx * basis.right.x + cy * basis.up.x,
          y: basis.forward.y + cx * basis.right.y + cy * basis.up.y,
          z: basis.forward.z + cx * basis.right.z + cy * basis.up.z,
        });
        const { u, row } = directionToUv(dir.x, dir.y, dir.z);
        const fx = u * sw - 0.5;
        const fy = row * sh - 0.5;
        sampleBilinear(
          sourcePixels,
          sw,
          sh,
          fx,
          fy,
          data,
          (py * width + px) * 4,
        );
      }
    }
    onProgress?.(rowEnd / height);
    await yieldToMain();
  }
  context.putImageData(frame, 0, 0);
  return output;
}

export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(canvas.toDataURL(type, quality));
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("明信片编码失败"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("明信片编码失败"));
        reader.readAsDataURL(blob);
      },
      type,
      quality,
    );
  });
}
