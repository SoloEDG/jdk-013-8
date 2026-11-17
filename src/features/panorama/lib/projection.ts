import { projectDirection } from "../../../shared/geometry";
import type { Camera } from "../../../shared/types";

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
  onScreen: boolean;
}

/**
 * Exact rectilinear projection, matching the orientation of the Three.js
 * panorama camera. The previous tangent approximation drifted for pitch and
 * wide angles, which would have made hotspot pins disagree with the framing
 * captured on a postcard.
 */
export function project(
  yaw: number,
  pitch: number,
  camera: Camera,
  width: number,
  height: number,
): ProjectedPoint {
  const point = projectDirection(yaw, pitch, camera, width, height);
  return {
    x: point.x,
    y: point.y,
    visible: point.visible,
    onScreen: point.onScreen,
  };
}
