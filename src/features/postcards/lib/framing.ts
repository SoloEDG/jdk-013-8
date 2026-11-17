import { findChapter } from "./text";
import type {
  ConfirmedFraming,
  EntrySnapshot,
  FramingMode,
  ResolvedFraming,
  StartFraming,
} from "../model/types";

/**
 * Decide which camera a card should use. A live framing captured in another
 * chapter is never applied: that would paste another chapter's scene into the
 * card. In that case the card falls back to the perspective saved with the
 * journal entry, and the fallback is reported so the visitor can see why.
 */
export function resolveFraming(
  entry: EntrySnapshot,
  mode: FramingMode,
  start: StartFraming | null,
  latest: ConfirmedFraming | null,
): ResolvedFraming {
  const chosen = mode === "start" ? start : latest;
  if (!chosen) {
    return {
      camera: { ...entry.camera },
      source: "entry",
      at: entry.createdAt,
      crossChapter: false,
      note:
        mode === "latest"
          ? "还没有确认过新构图，已采用手记收藏时的镜头"
          : "本次制作尚未记录起始构图，已采用手记收藏时的镜头",
    };
  }
  if (!findChapter(chosen.chapterId)) {
    return {
      camera: { ...entry.camera },
      source: "entry",
      at: entry.createdAt,
      crossChapter: true,
      note: "所选构图来自未知章节，已采用手记收藏时的镜头",
    };
  }
  if (chosen.chapterId !== entry.chapterId) {
    return {
      camera: { ...entry.camera },
      source: "entry",
      at: entry.createdAt,
      crossChapter: true,
      note:
        mode === "start"
          ? "制作开始时的镜头在别的章节，已改用这张手记收藏时的取景"
          : `最近确认的构图在《${findChapter(chosen.chapterId)?.title ?? chosen.chapterId}》，已改用这张手记收藏时的取景`,
    };
  }
  return {
    camera: { ...chosen.camera },
    source: mode,
    at: chosen.at,
    crossChapter: false,
  };
}
