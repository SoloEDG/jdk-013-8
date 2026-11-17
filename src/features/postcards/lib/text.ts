import { chapters, hotspots, people } from "../../../shared/content";
import type { Entry } from "../../../shared/types";
import type {
  EntrySnapshot,
  FramingSource,
  PostcardText,
  ResolvedFraming,
} from "../model/types";

export function findHotspot(id: string) {
  return hotspots.find((h) => h.id === id);
}

export function findChapter(id: string) {
  return chapters.find((chapter) => chapter.id === id);
}

export function findPerson(id?: string) {
  if (!id) return undefined;
  return people.find((p) => p.id === id);
}

export function snapshotEntry(entry: Entry): EntrySnapshot {
  return {
    id: entry.id,
    hotspotId: entry.hotspotId,
    chapterId: entry.chapterId,
    time: entry.time,
    camera: { ...entry.camera },
    title: entry.title,
    note: entry.note,
    createdAt: entry.createdAt,
  };
}

/**
 * Assemble every piece of text a card will show. Hotspot, chapter and person
 * data are resolved from the card's own entry, so a card can never borrow the
 * scene the visitor happens to be looking at right now.
 */
export function buildCardText(
  entry: EntrySnapshot,
  framing: ResolvedFraming,
): PostcardText {
  const hotspot = findHotspot(entry.hotspotId);
  const chapter =
    findChapter(entry.chapterId) ?? findChapter(hotspot?.chapterId ?? "");
  const person = findPerson(hotspot?.personId);
  const quote = person?.quote ?? hotspot?.summary ?? entry.title;
  return {
    hotspotId: entry.hotspotId,
    hotspotKind: hotspot?.kind ?? "archive",
    hotspotTitle: hotspot?.title ?? entry.title,
    chapterId: chapter?.id ?? entry.chapterId,
    chapterTitle: chapter?.title ?? "未命名章节",
    chapterSubtitle: chapter?.subtitle ?? "",
    location: chapter?.location ?? "",
    time: entry.time,
    createdAt: entry.createdAt,
    personId: person?.id,
    personName: person?.name,
    personRole: person?.role,
    quote,
    quoteLabel: person ? `${person.name} · ${person.role}` : "现场摘录",
    quoteIsPerson: !!person,
    note: entry.note,
    framing: { ...framing.camera },
    framingSource: framing.source,
    framingAt: framing.at,
    framingNote: framing.note,
  };
}

export function framingSourceLabel(source: FramingSource): string {
  if (source === "entry") return "手记收藏时的镜头";
  if (source === "start") return "本次制作开始时的构图";
  return "最近一次确认的构图";
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 30) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}
