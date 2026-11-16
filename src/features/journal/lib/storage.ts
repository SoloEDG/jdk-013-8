import type { Entry } from "../../../shared/types";
const key = "tidal-journal-v1";
export function loadEntries(): Entry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (e): e is Entry =>
        !!e &&
        typeof e.id === "string" &&
        typeof e.hotspotId === "string" &&
        typeof e.chapterId === "string" &&
        Number.isFinite(e.time) &&
        typeof e.title === "string" &&
        typeof e.note === "string" &&
        e.camera &&
        Number.isFinite(e.camera.yaw) &&
        Number.isFinite(e.camera.pitch) &&
        Number.isFinite(e.camera.fov) &&
        Number.isFinite(e.createdAt),
    );
  } catch {
    return [];
  }
}
export function persist(entries: Entry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}
