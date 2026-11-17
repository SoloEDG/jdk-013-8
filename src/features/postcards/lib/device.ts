import type { DeviceProfile, QualityTier } from "../model/types";

function probeMaxTexture(): number {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl || !("getParameter" in gl)) return 4096;
    const raw = (gl as WebGLRenderingContext).getParameter(
      (gl as WebGLRenderingContext).MAX_TEXTURE_SIZE,
    );
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 4096;
  } catch {
    return 4096;
  }
}

export function probeDevice(): DeviceProfile {
  const maxTextureSize = probeMaxTexture();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memoryGB = Number(nav.deviceMemory ?? 0);
  const cores = Number(navigator.hardwareConcurrency ?? 0);
  const lowMemory = memoryGB > 0 && memoryGB <= 2;
  const fewCores = cores > 0 && cores <= 2;
  const smallTexture = maxTextureSize < 4096;
  const risky = lowMemory || fewCores || smallTexture;
  const recommended: QualityTier = risky ? "light" : "balanced";
  const reasons: string[] = [];
  if (smallTexture) reasons.push(`纹理上限 ${maxTextureSize}px`);
  if (lowMemory) reasons.push(`内存约 ${memoryGB}GB`);
  if (fewCores) reasons.push(`仅 ${cores} 核`);
  return {
    maxTextureSize,
    memoryGB,
    cores,
    risky,
    recommended,
    reason: risky
      ? `这台设备可能吃紧（${reasons.join(" · ")}），建议先用轻量预览。`
      : "设备资源充足，平衡画质通常够用。",
  };
}

export function fitTexture(tierTexture: number, maxTextureSize: number) {
  const safeMax = Math.max(1024, Math.min(maxTextureSize, 8192));
  const width = Math.min(tierTexture, safeMax);
  return { width, capped: width < tierTexture, maxTextureSize };
}
