<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { UserRound, Files, AudioLines } from "lucide-vue-next";
import type { Hotspot, Camera } from "../../../shared/types";
import { project } from "../../panorama";
const props = defineProps<{
  items: Hotspot[];
  camera: Camera;
  enabled: boolean;
}>();
defineEmits<{ open: [id: string] }>();
const host = ref<HTMLElement>(),
  size = ref({ width: 1000, height: 520 });
let observer: ResizeObserver;
function position(h: Hotspot) {
  return project(
    h.yaw,
    h.pitch,
    props.camera,
    size.value.width,
    size.value.height,
  );
}
onMounted(() => {
  observer = new ResizeObserver(([e]) => {
    if (e)
      size.value = { width: e.contentRect.width, height: e.contentRect.height };
  });
  observer.observe(host.value!);
});
onUnmounted(() => observer?.disconnect());
</script>
<template>
  <div ref="host" class="hotspot-layer">
    <template v-if="enabled"
      ><button
        v-for="h in items"
        :key="h.id"
        v-show="position(h).visible"
        class="hotspot"
        :style="{ left: position(h).x + 'px', top: position(h).y + 'px' }"
        @pointerdown.stop
        @click.stop="$emit('open', h.id)"
      >
        <span
          ><UserRound v-if="h.kind === 'person'" /><Files
            v-else-if="h.kind === 'archive'" /><AudioLines v-else /></span
        ><strong>{{ h.title }}</strong
        ><small>点击探索 ↗</small>
      </button></template
    >
  </div>
</template>
