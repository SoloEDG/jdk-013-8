import type { Hotspot } from "../../../shared/types";
export function activeHotspots(
  items: Hotspot[],
  chapterId: string,
  time: number,
) {
  return items.filter(
    (h) => h.chapterId === chapterId && time >= h.start && time < h.end,
  );
}
export function kindLabel(kind: Hotspot["kind"]) {
  return { person: "人物访谈", archive: "历史档案", sound: "声音现场" }[kind];
}
