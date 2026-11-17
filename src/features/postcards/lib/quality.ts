import type { Camera } from "../../../shared/types";
import { bearingLabel, projectDirection } from "../../../shared/geometry";
import type { PostcardMark, QualityTier } from "../model/types";

export interface TierSpec {
  id: QualityTier;
  label: string;
  short: string;
  detail: string;
  texture: number;
  wide: readonly [number, number];
  narrow: readonly [number, number];
  jpeg: number;
  previewMs: string;
}

export const TIERS: Record<QualityTier, TierSpec> = {
  light: {
    id: "light",
    label: "轻量预览",
    short: "旧设备也能生成",
    detail:
      "全景纹理降到 2048 像素，卡片 960×540。细节较少，但生成快、占用小，适合设备吃紧时先看效果。",
    texture: 2048,
    wide: [960, 540],
    narrow: [720, 900],
    jpeg: 0.8,
    previewMs: "约 1 秒",
  },
  balanced: {
    id: "balanced",
    label: "平衡",
    short: "推荐",
    detail:
      "全景纹理 4096 像素，卡片 1440×810。取景、热点位置与画质兼顾，文件大小适中。",
    texture: 4096,
    wide: [1440, 810],
    narrow: [1080, 1350],
    jpeg: 0.85,
    previewMs: "约 2 秒",
  },
  detailed: {
    id: "detailed",
    label: "完整细节",
    short: "文件更大",
    detail:
      "卡片 1920×1080，纹理受设备上限约束。较慢、文件更大，适合只生成一两张留存。",
    texture: 4096,
    wide: [1920, 1080],
    narrow: [1440, 1800],
    jpeg: 0.9,
    previewMs: "约 4 秒",
  },
};

export const QUALITY_ORDER: QualityTier[] = ["light", "balanced", "detailed"];

export function tierSpec(tier: QualityTier): TierSpec {
  return TIERS[tier] ?? TIERS.balanced;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const wrap = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180;

/** Percentage position inside a frame, for a mark at fractional coordinates. */
function toPercent(fraction: number): number {
  return clamp(fraction * 100, 4, 96);
}

/**
 * Place the hotspot on a card image. If the pin falls outside the frame we
 * keep it pinned to the nearest edge and describe the direction instead of
 * silently dropping it, so the person/hotspot relation survives every crop.
 */
export function markFor(
  yaw: number,
  pitch: number,
  camera: Camera,
  width: number,
  height: number,
): PostcardMark {
  const point = projectDirection(yaw, pitch, camera, width, height);
  const bearing = bearingLabel(yaw);
  if (!point.visible) {
    const delta = wrap(yaw - camera.yaw);
    const right = delta >= 0;
    const high = pitch > camera.pitch;
    const left = right ? 93 : 7;
    const top = high ? 13 : 87;
    return {
      left,
      top,
      state: "behind",
      hint: `镜头之外 · 方位 ${bearing}`,
      rotate: right ? 0 : 180,
    };
  }
  const fractionX = (clamp(point.ndcX, -1, 1) + 1) / 2;
  const fractionY = (1 - clamp(point.ndcY, -1, 1)) / 2;
  const inside = Math.abs(point.ndcX) <= 0.88 && Math.abs(point.ndcY) <= 0.84;
  if (inside) {
    return {
      left: toPercent(fractionX),
      top: toPercent(fractionY),
      state: "center",
      hint: `画面之内 · 方位 ${bearing}`,
      rotate: 0,
    };
  }
  const horizontal = Math.abs(point.ndcX) >= Math.abs(point.ndcY);
  const direction = horizontal
    ? point.ndcX > 0
      ? "右侧"
      : "左侧"
    : point.ndcY > 0
      ? "上侧"
      : "下侧";
  const angle =
    (Math.atan2(-(fractionY - 0.5), fractionX - 0.5) * 180) / Math.PI + 90;
  return {
    left: toPercent(fractionX),
    top: toPercent(fractionY),
    state: "edge",
    hint: `在画面${direction} · 方位 ${bearing}`,
    rotate: angle,
  };
}
