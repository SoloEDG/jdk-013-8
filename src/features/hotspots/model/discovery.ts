import { computed, ref } from "vue";
import { hotspots } from "../../../shared/content";
import { activeHotspots } from "../lib/visibility";
export function createDiscovery(
  position: () => { chapterId: string; time: number },
) {
  const enabled = ref(true),
    selected = ref<string | null>(null);
  const visible = computed(() => {
    const p = position();
    return activeHotspots(hotspots, p.chapterId, p.time);
  });
  const detail = computed(() => hotspots.find((h) => h.id === selected.value));
  return {
    enabled,
    selected,
    visible,
    detail,
    select: (id: string) => {
      if (hotspots.some((h) => h.id === id)) selected.value = id;
    },
    close: () => (selected.value = null),
  };
}
