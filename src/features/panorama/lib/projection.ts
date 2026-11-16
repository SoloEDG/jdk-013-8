import { wrap } from "../../../shared/format";
import type { Camera } from "../../../shared/types";
export function project(
  yaw: number,
  pitch: number,
  camera: Camera,
  width: number,
  height: number,
) {
  const delta = (wrap(yaw - camera.yaw) * Math.PI) / 180;
  const vertical = ((pitch - camera.pitch) * Math.PI) / 180;
  const focal = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  return {
    x: width / 2 + Math.tan(delta) * focal,
    y: height / 2 - Math.tan(vertical) * focal,
    visible: Math.abs(delta) < Math.PI / 2 && Math.abs(vertical) < Math.PI / 2,
  };
}
