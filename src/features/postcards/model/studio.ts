import { computed, ref } from "vue";
import type { Entry } from "../../../shared/types";
import type {
  CardStatus,
  ConfirmedFraming,
  DeviceProfile,
  EntrySnapshot,
  FramingMode,
  PostcardJob,
  PostcardText,
  QualityTier,
  StartFraming,
  TierPreview,
} from "../model/types";
import {
  buildCardText,
  findChapter,
  findHotspot,
  relativeTime,
  snapshotEntry,
} from "../lib/text";
import { resolveFraming } from "../lib/framing";
import { fitTexture, probeDevice } from "../lib/device";
import { markFor, tierSpec } from "../lib/quality";
import {
  canvasToDataUrl,
  isAbortError,
  loadPanorama,
  renderPerspective,
  ResourceError,
  type PanoramaSource,
} from "../lib/panorama";
import {
  buildPostcardHtml,
  downloadFile,
  safeFilename,
  type ExportCard,
} from "../lib/export";

export interface StudioDeps {
  /** Framing most recently confirmed by the visitor in the live scene. */
  getLatestConfirmed: () => ConfirmedFraming | null;
  /** Where the visitor is right now, captured when a batch starts. */
  getStartFraming: () => StartFraming;
  /** Panorama URL for a chapter id — resolved from the card's own chapter. */
  panoramaFor: (chapterId: string) => string | undefined;
  /** Persist a note written while cards are being made. */
  onNoteChange?: (entryId: string, note: string) => void;
  /** Latest note from the journal, so edits made elsewhere still reach a card. */
  getNote?: (entryId: string) => string | undefined;
}

interface RenderHandle {
  token: number;
  controller: AbortController;
}

interface CacheEntry {
  key: string;
  source: PanoramaSource;
}

const QUALITY_LABEL: Record<QualityTier, string> = {
  light: "轻量预览",
  balanced: "平衡画质",
  detailed: "完整细节",
};

const STATUS_LABEL: Record<CardStatus, string> = {
  queued: "排队中",
  rendering: "取景中",
  ready: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export { STATUS_LABEL, QUALITY_LABEL };

export function createPostcardStudio(deps: StudioDeps) {
  const device = ref<DeviceProfile>(probeDevice()),
    jobs = ref<PostcardJob[]>([]),
    mode = ref<FramingMode>("start"),
    defaultQuality = ref<QualityTier>(device.value.recommended),
    start = ref<StartFraming | null>(null),
    cancelled = ref(false),
    notice = ref(""),
    noticeKind = ref<"info" | "warn">("info"),
    previews = ref<Partial<Record<QualityTier, TierPreview>>>({}),
    previewBusy = ref<QualityTier | null>(null),
    saving = ref(false);

  const handles = new Map<string, RenderHandle>();
  const cache: CacheEntry[] = [];
  let pumpRunning = false;
  let previewToken = 0;

  const running = computed(() =>
    jobs.value.some((j) => j.status === "rendering" || j.status === "queued"),
  );
  const readyCount = computed(
    () => jobs.value.filter((j) => j.status === "ready").length,
  );
  const failedCount = computed(
    () => jobs.value.filter((j) => j.status === "failed").length,
  );
  const saveable = computed(() => jobs.value.filter((j) => !!j.artwork));
  const progress = computed(() => {
    const list = jobs.value;
    if (!list.length) return 0;
    const total = list.reduce(
      (sum, job) =>
        sum + (job.status === "ready" ? 1 : job.status === "failed" ? 0.15 : job.progress),
      0,
    );
    return total / list.length;
  });
  const startLabel = computed(() =>
    start.value
      ? `${findChapter(start.value.chapterId)?.title ?? start.value.chapterId} · ${relativeTime(start.value.at)}`
      : "尚未记录",
  );
  const latest = computed(() => deps.getLatestConfirmed());
  /** A confirmation arrived after some cards were drawn: offer to re-apply. */
  const latestNewer = computed(() => {
    const confirmed = latest.value;
    if (!confirmed || !jobs.value.length) return false;
    return jobs.value.some(
      (job) => job.artwork && job.artwork.renderedAt < confirmed.at,
    );
  });
  const latestLabel = computed(() => {
    const value = latest.value;
    if (!value) return "尚未确认";
    return `${findChapter(value.chapterId)?.title ?? value.chapterId} · ${relativeTime(value.at)}`;
  });

  function say(message: string, kind: "info" | "warn" = "info") {
    notice.value = message;
    noticeKind.value = kind;
  }

  function releaseSource(source: PanoramaSource) {
    source.canvas.width = 0;
    source.canvas.height = 0;
  }

  function remember(key: string, source: PanoramaSource) {
    const existing = cache.findIndex((item) => item.key === key);
    if (existing >= 0) cache.splice(existing, 1);
    cache.unshift({ key, source });
    while (cache.length > 2) {
      const dropped = cache.pop();
      if (dropped) releaseSource(dropped.source);
    }
  }

  async function sourceFor(
    chapterId: string,
    textureWidth: number,
    signal: AbortSignal,
  ): Promise<{
    source: PanoramaSource;
    capped: boolean;
    downscaledByAsset: boolean;
    intrinsicWidth: number;
  }> {
    const url = deps.panoramaFor(chapterId);
    if (!url) throw new Error("这张手记所属章节缺少全景素材");
    const fit = fitTexture(textureWidth, device.value.maxTextureSize);
    const key = `${url}|${fit.width}`;
    const hit = cache.find((item) => item.key === key);
    if (hit) {
      remember(key, hit.source);
      return {
        source: hit.source,
        capped: fit.capped && hit.source.width < textureWidth,
        downscaledByAsset: false,
        intrinsicWidth: hit.source.intrinsicWidth,
      };
    }
    const source = await loadPanorama(url, fit.width, signal);
    remember(key, source);
    // Only a device cap (not the tier's own downscale) is worth warning about.
    return {
      source,
      capped: fit.capped && source.width < textureWidth,
      downscaledByAsset: source.width < Math.min(textureWidth, source.intrinsicWidth),
      intrinsicWidth: source.intrinsicWidth,
    };
  }

  function hydrateText(job: PostcardJob): void {
    const note = deps.getNote?.(job.entry.id);
    if (typeof note === "string" && note !== job.entry.note) {
      job.entry.note = note.slice(0, 500);
    }
    const framing = resolveFraming(
      job.entry,
      job.mode,
      start.value,
      deps.getLatestConfirmed(),
    );
    job.text = buildCardText(job.entry, framing);
  }

  async function renderJob(job: PostcardJob): Promise<void> {
    const entry = job.entry;
    const handle: RenderHandle = {
      token: ++job.version,
      controller: new AbortController(),
    };
    handles.set(job.id, handle);
    job.status = "rendering";
    job.progress = 0.02;
    job.error = undefined;
    job.warning = undefined;
    const spec = tierSpec(job.quality);
    const signal = handle.controller.signal;
    const stale = () =>
      signal.aborted ||
      job.version !== handle.token ||
      !jobs.value.includes(job);

    try {
      job.progress = 0.08;
      const { source, capped, downscaledByAsset, intrinsicWidth } = await sourceFor(
        entry.chapterId,
        spec.texture,
        signal,
      );
      if (stale()) return;
      job.progress = 0.16;
      const saved = Math.max(
        0.16,
        Math.min(
          0.6,
          0.16 + 0.44 * Math.min(1, source.width / Math.max(1, spec.texture)),
        ),
      );
      const [wideWidth, wideHeight] = spec.wide;
      const [narrowWidth, narrowHeight] = spec.narrow;
      const wideCanvas = await renderPerspective(
        source,
        job.text.framing,
        wideWidth,
        wideHeight,
        {
          signal,
          onProgress: (value) => {
            if (!stale()) job.progress = 0.16 + (saved - 0.16) * value;
          },
        },
      );
      if (stale()) return;
      const narrowCanvas = await renderPerspective(
        source,
        job.text.framing,
        narrowWidth,
        narrowHeight,
        {
          signal,
          onProgress: (value) => {
            if (!stale())
              job.progress = saved + (0.94 - saved) * value;
          },
        },
      );
      if (stale()) return;
      const [wideUrl, narrowUrl] = await Promise.all([
        canvasToDataUrl(wideCanvas, "image/jpeg", spec.jpeg),
        canvasToDataUrl(narrowCanvas, "image/jpeg", spec.jpeg),
      ]);
      if (stale()) return;

      const hotspot = findHotspot(entry.hotspotId);
      const yaw = hotspot?.yaw ?? job.text.framing.yaw;
      const pitch = hotspot?.pitch ?? job.text.framing.pitch;
      job.artwork = {
        images: {
          wide: wideUrl,
          narrow: narrowUrl,
          wideSize: { width: wideWidth, height: wideHeight },
          narrowSize: { width: narrowWidth, height: narrowHeight },
          textureWidth: source.width,
          bytes: wideUrl.length + narrowUrl.length,
        },
        camera: { ...job.text.framing },
        framingSource: job.text.framingSource,
        quality: job.quality,
        chapterId: entry.chapterId,
        marks: {
          wide: markFor(yaw, pitch, job.text.framing, wideWidth, wideHeight),
          narrow: markFor(yaw, pitch, job.text.framing, narrowWidth, narrowHeight),
        },
        framingNote: job.text.framingNote,
        renderedAt: Date.now(),
      };
      job.progress = 1;
      job.status = "ready";
      if (capped) {
        job.warning = `纹理已按设备上限限制为 ${source.width}px，细节少于「${spec.label}」的完整效果`;
      } else if (downscaledByAsset) {
        job.warning = `素材原生宽度仅 ${intrinsicWidth}px，已按原尺寸生成`;
      }
    } catch (error) {
      if (stale()) return;
      if (isAbortError(error)) {
        job.status = "cancelled";
        return;
      }
      job.status = "failed";
      job.progress = 0;
      job.error =
        error instanceof ResourceError
          ? `${error.message}。可改用「轻量预览」重试。`
          : error instanceof Error
            ? error.message
            : "取景失败，请重试";
    } finally {
      if (handles.get(job.id) === handle) handles.delete(job.id);
    }
  }

  async function pump(): Promise<void> {
    if (pumpRunning) return;
    pumpRunning = true;
    try {
      for (;;) {
        if (cancelled.value) break;
        const job = jobs.value.find((item) => item.status === "queued");
        if (!job) break;
        await renderJob(job);
      }
    } finally {
      pumpRunning = false;
    }
  }

  function begin(entries: Entry[]): boolean {
    if (!entries.length) {
      say("先在手记里选几条记录。", "warn");
      return false;
    }
    cancel();
    const opening = deps.getStartFraming();
    jobs.value = entries.map((entry) => {
      const snapshot: EntrySnapshot = snapshotEntry(entry);
      const framing = resolveFraming(snapshot, mode.value, opening, null);
      return {
        id: entry.id,
        entry: snapshot,
        mode: mode.value,
        status: "queued",
        progress: 0,
        version: 0,
        text: buildCardText(snapshot, framing),
        quality: defaultQuality.value,
      } satisfies PostcardJob;
    });
    start.value = { ...opening, camera: { ...opening.camera } };
    cancelled.value = false;
    previews.value = {};
    notice.value = "";
    say(
      `已记录制作开始时的构图（${findChapter(opening.chapterId)?.title ?? opening.chapterId}），正在为 ${jobs.value.length} 张手记取景。制作期间可以继续转动镜头或写手记。`,
    );
    void pump();
    return true;
  }

  /** Pull in notes written in the journal while the batch was in progress. */
  function syncNotes(): void {
    if (!deps.getNote) return;
    for (const job of jobs.value) {
      const note = deps.getNote(job.entry.id);
      if (typeof note !== "string") continue;
      const clipped = note.slice(0, 500);
      if (clipped === job.entry.note) continue;
      job.entry.note = clipped;
      job.text.note = clipped;
    }
  }

  function updateNote(entryId: string, note: string): void {
    const clipped = note.slice(0, 500);
    for (const job of jobs.value) {
      if (job.id !== entryId) continue;
      job.entry.note = clipped;
      job.text.note = clipped;
    }
    deps.onNoteChange?.(entryId, clipped);
  }

  /** Re-read the chosen framing and redraw every card (used after a new confirmation). */
  function reapply(): void {
    if (!jobs.value.length) {
      say("还没有卡片可重画。", "warn");
      return;
    }
    cancelled.value = false;
    for (const job of jobs.value) {
      hydrateText(job);
      invalidate(job);
    }
    say(
      mode.value === "start"
        ? "正在按制作开始时的构图重画全部卡片…"
        : "正在按最近一次确认的构图重画全部卡片…",
    );
    void pump();
  }

  function cancel(): void {
    cancelled.value = true;
    for (const handle of handles.values()) handle.controller.abort();
    handles.clear();
    for (const job of jobs.value) {
      if (job.status === "queued" || job.status === "rendering") {
        job.status = "cancelled";
        job.progress = 0;
      }
    }
  }

  function invalidate(job: PostcardJob): void {
    const handle = handles.get(job.id);
    if (handle) {
      job.version++;
      handle.controller.abort();
      handles.delete(job.id);
    }
    job.status = "queued";
    job.progress = 0;
    job.error = undefined;
    // Keep the last finished artwork: if this pass fails or is cancelled the
    // visitor can still save the card that already worked.
  }

  function retry(job: PostcardJob, tier?: QualityTier): void {
    if (!jobs.value.includes(job)) return;
    if (tier) job.quality = tier;
    cancelled.value = false;
    hydrateText(job);
    invalidate(job);
    void pump();
  }

  function retryFailed(): void {
    const failed = jobs.value.filter((job) => job.status === "failed");
    if (!failed.length) return;
    cancelled.value = false;
    for (const job of failed) {
      hydrateText(job);
      invalidate(job);
    }
    void pump();
  }

  function setMode(next: FramingMode): void {
    if (mode.value === next) return;
    mode.value = next;
    for (const job of jobs.value) job.mode = next;
    if (!jobs.value.length) return;
    reapply();
  }

  function setQuality(job: PostcardJob, tier: QualityTier): void {
    if (!jobs.value.includes(job)) return;
    job.quality = tier;
    cancelled.value = false;
    hydrateText(job);
    invalidate(job);
    void pump();
  }

  function setDefaultQuality(tier: QualityTier): void {
    defaultQuality.value = tier;
    for (const job of jobs.value) {
      if (job.status === "queued") job.quality = tier;
    }
  }

  function rerenderAll(tier: QualityTier): void {
    setDefaultQuality(tier);
    if (!jobs.value.length) return;
    cancelled.value = false;
    for (const job of jobs.value) {
      job.quality = tier;
      hydrateText(job);
      invalidate(job);
    }
    say(`正在以「${QUALITY_LABEL[tier]}」重画全部卡片…`);
    void pump();
  }

  function stop(): void {
    cancel();
    say("已停止后续取景，已完成的卡片仍可单独保存。", "warn");
  }

  function remove(job: PostcardJob): void {
    handles.get(job.id)?.controller.abort();
    handles.delete(job.id);
    jobs.value = jobs.value.filter((item) => item !== job);
  }

  function exportCards(list: PostcardJob[], filename: string): boolean {
    syncNotes();
    const cards: ExportCard[] = [];
    for (const job of list) {
      const art = job.artwork;
      if (!art) continue;
      const chapter = findChapter(job.entry.chapterId);
      // The picture is the source of truth: text and return link must describe
      // the framing that was actually rendered, not a newer pending one.
      const text: PostcardText = {
        ...job.text,
        framing: { ...art.camera },
        framingSource: art.framingSource,
      };
      cards.push({
        text,
        wide: art.images.wide,
        narrow: art.images.narrow,
        wideSize: art.images.wideSize,
        narrowSize: art.images.narrowSize,
        marks: art.marks,
        quality: art.quality,
        framingSourceLabel:
          art.framingSource === "entry"
            ? "手记收藏时的镜头"
            : art.framingSource === "start"
              ? "制作开始时的构图"
              : "最近确认的构图",
        chapterTitle: chapter?.title ?? job.text.chapterTitle,
      });
    }
    if (!cards.length) {
      say("还没有可保存的卡片，请等待取景完成或重试失败项。", "warn");
      return false;
    }
    const html = buildPostcardHtml(cards, {
      title: "潮汐之间 · 全景故事明信片",
      baseUrl: window.location.href.split("#")[0]!,
      createdAt: Date.now(),
      chapterTitles: cards.map((card) => card.chapterTitle),
      qualityLabel: QUALITY_LABEL[cards[0]!.quality],
    });
    downloadFile(filename, html, "text/html;charset=utf-8");
    const skipped = list.length - cards.length;
    say(
      skipped > 0
        ? `已保存 ${cards.length} 张；${skipped} 张未完成，可重试后单独保存。`
        : `已保存 ${cards.length} 张明信片。`,
      skipped > 0 ? "warn" : "info",
    );
    return true;
  }

  function saveOne(job: PostcardJob): boolean {
    if (!job.artwork) {
      say("这张卡片还没有可保存的画面。", "warn");
      return false;
    }
    saving.value = true;
    try {
      return exportCards(
        [job],
        `${safeFilename(job.text.hotspotTitle)}-明信片.html`,
      );
    } finally {
      saving.value = false;
    }
  }

  function saveAll(): boolean {
    if (!jobs.value.length) return false;
    saving.value = true;
    try {
      return exportCards(
        jobs.value,
        `潮汐之间-全景明信片-${new Date().toISOString().slice(0, 10)}.html`,
      );
    } finally {
      saving.value = false;
    }
  }

  async function previewTier(tier: QualityTier): Promise<void> {
    const job = jobs.value[0];
    if (!job) {
      say("先生成一张卡片，才能比较画质。", "warn");
      return;
    }
    const token = ++previewToken;
    previewBusy.value = tier;
    const previous = previews.value[tier];
    const planned = fitTexture(tierSpec(tier).texture, device.value.maxTextureSize);
    previews.value[tier] = {
      status: "rendering",
      textureWidth: planned.width,
      outputLabel: `${tierSpec(tier).wide[0]}×${tierSpec(tier).wide[1]}`,
      capped: planned.capped,
      url: previous?.url,
    };
    try {
      const controller = new AbortController();
      const fit = fitTexture(tierSpec(tier).texture, device.value.maxTextureSize);
      const url = deps.panoramaFor(job.entry.chapterId);
      if (!url) throw new Error("缺少全景素材");
      const source = await loadPanorama(url, fit.width, controller.signal);
      const canvas = await renderPerspective(source, job.text.framing, 720, 405, {
        signal: controller.signal,
      });
      const dataUrl = await canvasToDataUrl(canvas, "image/jpeg", 0.85);
      releaseSource(source);
      if (token !== previewToken) return;
      previews.value[tier] = {
        status: "ready",
        url: dataUrl,
        textureWidth: source.width,
        outputLabel: `${tierSpec(tier).wide[0]}×${tierSpec(tier).wide[1]}`,
        capped: fit.capped || source.downscaled,
      };
    } catch (error) {
      if (token !== previewToken) return;
      previews.value[tier] = {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "此档画质在当前设备上无法预览",
        textureWidth: planned.width,
        outputLabel: `${tierSpec(tier).wide[0]}×${tierSpec(tier).wide[1]}`,
        capped: planned.capped,
      };
    } finally {
      if (token === previewToken) previewBusy.value = null;
    }
  }

  function reset(): void {
    cancel();
    jobs.value = [];
    start.value = null;
    previews.value = {};
    previewToken++;
    previewBusy.value = null;
    notice.value = "";
  }

  function plannedTexture(tier: QualityTier): number {
    return fitTexture(tierSpec(tier).texture, device.value.maxTextureSize).width;
  }

  return {
    jobs,
    mode,
    defaultQuality,
    start,
    device,
    cancelled,
    notice,
    noticeKind,
    previews,
    previewBusy,
    saving,
    running,
    readyCount,
    failedCount,
    saveable,
    progress,
    startLabel,
    latest,
    latestLabel,
    latestNewer,
    begin,
    cancel,
    stop,
    retry,
    retryFailed,
    setMode,
    setQuality,
    setDefaultQuality,
    rerenderAll,
    reapply,
    updateNote,
    syncNotes,
    remove,
    saveOne,
    saveAll,
    previewTier,
    plannedTexture,
    reset,
  };
}

export type PostcardStudio = ReturnType<typeof createPostcardStudio>;
