import { computed, ref } from "vue";
import type { Position } from "../../../shared/types";
import { findPerson } from "../lib/transcript";
export function createBranch() {
  const personId = ref<string | null>(null),
    returnPoint = ref<Position | null>(null),
    paragraph = ref(0);
  const person = computed(() =>
    personId.value ? findPerson(personId.value) : undefined,
  );
  function enter(id: string, position: Position) {
    if (!findPerson(id)) return;
    returnPoint.value = structuredClone(position);
    personId.value = id;
    paragraph.value = 0;
  }
  function leave() {
    const point = returnPoint.value;
    personId.value = null;
    returnPoint.value = null;
    return point;
  }
  return { personId, returnPoint, paragraph, person, enter, leave };
}
export type Branch = ReturnType<typeof createBranch>;
