import type { Camera } from "./types";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraBasis {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  tanHalf: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** In front of the camera (not behind the viewer). */
  visible: boolean;
  /** Centre of the hotspot falls inside the rendered frame. */
  onScreen: boolean;
  ndcX: number;
  ndcY: number;
}

const RAD = Math.PI / 180;

export function direction(yaw: number, pitch: number): Vec3 {
  const y = yaw * RAD,
    p = pitch * RAD,
    cp = Math.cos(p);
  return { x: cp * Math.cos(y), y: Math.sin(p), z: cp * Math.sin(y) };
}

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Basis matching the interactive Three.js camera (pitch is not rolled). */
export function cameraBasis(camera: Camera): CameraBasis {
  const forward = direction(camera.yaw, camera.pitch);
  const z = { x: -forward.x, y: -forward.y, z: -forward.z };
  const x = normalize(cross({ x: 0, y: 1, z: 0 }, z));
  const y = cross(z, x);
  return {
    forward,
    right: x,
    up: y,
    tanHalf: Math.tan((camera.fov * RAD) / 2),
  };
}

export function projectDirection(
  yaw: number,
  pitch: number,
  camera: Camera,
  width: number,
  height: number,
): ScreenPoint {
  const basis = cameraBasis(camera);
  const point = direction(yaw, pitch);
  const cx = dot(point, basis.right);
  const cy = dot(point, basis.up);
  const cz = dot(point, { x: -basis.forward.x, y: -basis.forward.y, z: -basis.forward.z });
  const aspect = width / height || 1;
  if (cz >= -1e-6) {
    return {
      x: width / 2,
      y: height / 2,
      visible: false,
      onScreen: false,
      ndcX: 0,
      ndcY: 0,
    };
  }
  const ndcX = cx / -cz / (basis.tanHalf * aspect);
  const ndcY = cy / -cz / basis.tanHalf;
  return {
    x: ((ndcX + 1) / 2) * width,
    y: ((1 - ndcY) / 2) * height,
    visible: true,
    onScreen: ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1,
    ndcX,
    ndcY,
  };
}

/** Unit direction for a pixel in a rectilinear frame. */
export function pixelDirection(
  px: number,
  py: number,
  width: number,
  height: number,
  basis: CameraBasis,
): Vec3 {
  const aspect = width / height || 1;
  const cx = ((px + 0.5) / width * 2 - 1) * basis.tanHalf * aspect;
  const cy = (1 - ((py + 0.5) / height) * 2) * basis.tanHalf;
  return normalize({
    x: basis.forward.x + cx * basis.right.x + cy * basis.up.x,
    y: basis.forward.y + cx * basis.right.y + cy * basis.up.y,
    z: basis.forward.z + cx * basis.right.z + cy * basis.up.z,
  });
}

export function bearingLabel(yaw: number): string {
  const normalized = ((((yaw + 180) % 360) + 360) % 360) - 180;
  const rounded = Math.round(normalized);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

export function formatFraming(camera: Camera): string {
  return `方位 ${bearingLabel(camera.yaw)} · 俯仰 ${Math.round(camera.pitch)}° · 视场 ${Math.round(camera.fov)}°`;
}
