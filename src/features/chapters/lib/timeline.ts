import { clamp } from "../../../shared/format";
import type { Chapter } from "../../../shared/types";
export function seekTime(chapter: Chapter, time: number) {
  return Number.isFinite(time) ? clamp(time, 0, chapter.duration) : 0;
}
export function chapterProgress(chapter: Chapter, time: number) {
  return Math.round((seekTime(chapter, time) / chapter.duration) * 100);
}
