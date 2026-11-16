<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { CameraController } from "../model/camera";
import { createRenderer } from "../lib/renderer";
import Compass from "./Compass.vue";
const props = defineProps<{ controller: CameraController; source: string }>();
const host = ref<HTMLElement>();
const error = ref(false);
let render: ReturnType<typeof createRenderer> | undefined;
let observer: ResizeObserver | undefined;
let drag: { x: number; y: number } | undefined;
function down(e: PointerEvent) {
  if ((e.target as HTMLElement).closest("button")) return;
  drag = { x: e.clientX, y: e.clientY };
  host.value?.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!drag) return;
  props.controller.move(e.clientX - drag.x, e.clientY - drag.y);
  drag = { x: e.clientX, y: e.clientY };
}
onMounted(() => {
  try {
    render = createRenderer(host.value!, () => (error.value = true));
    render.load(props.source);
    render.draw(props.controller.camera);
    observer = new ResizeObserver(() => render?.draw(props.controller.camera));
    observer.observe(host.value!);
  } catch {
    error.value = true;
  }
});
watch(
  () => props.source,
  (url) => {
    error.value = false;
    render?.load(url);
  },
);
watch(
  () => ({ ...props.controller.camera }),
  () => render?.draw(props.controller.camera),
);
onUnmounted(() => {
  observer?.disconnect();
  render?.dispose();
});
</script>
<template>
  <div
    ref="host"
    class="panorama"
    :style="{ backgroundImage: `url(${source})` }"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="drag = undefined"
    @pointercancel="drag = undefined"
    @wheel.prevent="controller.zoom($event.deltaY)"
  >
    <div v-if="error" class="media-warning">
      全景渲染不可用，正在显示静态场景
    </div>
    <slot /><Compass :camera="controller.camera" />
  </div>
</template>
