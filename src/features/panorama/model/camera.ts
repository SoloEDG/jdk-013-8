import { reactive } from "vue";
import type { Camera } from "../../../shared/types";
import { clamp, wrap } from "../../../shared/format";
export function normalizeCamera(value: Camera): Camera {
  return {
    yaw: wrap(value.yaw),
    pitch: clamp(value.pitch, -65, 65),
    fov: clamp(value.fov, 35, 95),
  };
}
export function createCamera() {
  const camera = reactive<Camera>({ yaw: 0, pitch: 0, fov: 70 });
  function restore(value: Camera) {
    const next = normalizeCamera(value);
    camera.yaw = next.yaw;
    camera.pitch = next.pitch;
    camera.fov = next.fov;
  }
  return {
    camera,
    restore,
    move: (dx: number, dy: number) =>
      restore({
        ...camera,
        yaw: camera.yaw - dx * 0.13,
        pitch: camera.pitch + dy * 0.13,
      }),
    zoom: (delta: number) =>
      restore({ ...camera, fov: camera.fov + delta * 0.03 }),
    reset: () => restore({ yaw: 0, pitch: 0, fov: 70 }),
  };
}
export type CameraController = ReturnType<typeof createCamera>;
