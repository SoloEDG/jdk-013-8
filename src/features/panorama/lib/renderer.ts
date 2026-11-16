import * as THREE from "three";
import type { Camera } from "../../../shared/types";
export function createRenderer(host: HTMLElement, onError: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  const geometry = new THREE.SphereGeometry(10, 64, 40);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  scene.add(new THREE.Mesh(geometry, material));
  let texture: THREE.Texture | undefined,
    version = 0,
    alive = true;
  return {
    load: (url: string) => {
      const token = ++version;
      new THREE.TextureLoader().load(
        url,
        (t) => {
          if (!alive || token !== version) {
            t.dispose();
            return;
          }
          texture?.dispose();
          texture = t;
          t.colorSpace = THREE.SRGBColorSpace;
          material.map = t;
          material.needsUpdate = true;
          renderer.render(scene, camera);
        },
        undefined,
        onError,
      );
    },
    draw: (value: Camera) => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = value.fov;
      camera.updateProjectionMatrix();
      const phi = THREE.MathUtils.degToRad(90 - value.pitch),
        theta = THREE.MathUtils.degToRad(value.yaw);
      camera.lookAt(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      renderer.render(scene, camera);
    },
    dispose: () => {
      alive = false;
      version++;
      texture?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
