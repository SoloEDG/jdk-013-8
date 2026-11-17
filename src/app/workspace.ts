import { ref, watch } from "vue";
import { createCamera } from "../features/panorama";
import { createPlayback } from "../features/chapters";
import { createDiscovery } from "../features/hotspots";
import { createBranch } from "../features/interviews";
import { createJournal } from "../features/journal";
import { createPostcardStudio } from "../features/postcards";
import { chapters } from "../shared/content";
import type {
  Command,
  Entry,
  Position,
  ReturnTarget,
} from "../shared/types";
import type { ConfirmedFraming } from "../features/postcards";
export function createWorkspace() {
  const camera = createCamera(),
    playback = createPlayback(),
    discovery = createDiscovery(() => playback.state),
    branch = createBranch(),
    journal = createJournal(),
    tab = ref<"story" | "journal" | "studio">("story"),
    /** Last framing the visitor deliberately confirmed for postcard making. */
    latestConfirmed = ref<ConfirmedFraming | null>(null),
    toast = ref("");
  let toastTimer: number | undefined;
  const position = (): Position => ({
    chapterId: playback.state.chapterId,
    time: playback.state.time,
    camera: { ...camera.camera },
    playing: playback.state.playing,
  });
  const studio = createPostcardStudio({
    getLatestConfirmed: () => latestConfirmed.value,
    getStartFraming: () => ({
      chapterId: playback.state.chapterId,
      time: playback.state.time,
      camera: { ...camera.camera },
      at: Date.now(),
    }),
    panoramaFor: (chapterId) =>
      chapters.find((chapter) => chapter.id === chapterId)?.panorama,
    onNoteChange: (entryId, note) => journal.note(entryId, note),
    getNote: (entryId) =>
      journal.entries.value.find((entry) => entry.id === entryId)?.note,
  });
  // Cards made before a journal edit must still show that edit.
  watch(
    () => journal.entries.value.map((entry) => `${entry.id}:${entry.note}`).join("|"),
    () => studio.syncNotes(),
  );
  function announce(message: string, ms = 4200) {
    toast.value = message;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.value = ""), ms);
  }
  /** Capture the current live framing as the "latest confirmed" candidate. */
  function confirmFraming() {
    const current = position();
    latestConfirmed.value = {
      chapterId: current.chapterId,
      time: current.time,
      camera: { ...current.camera },
      at: Date.now(),
    };
    announce("已确认当前构图，制作时可以选择采用它。");
  }
  function enterPerson(id: string) {
    branch.enter(id, position());
    playback.state.playing = false;
    discovery.close();
  }
  function dispatch(command: Command) {
    switch (command.type) {
      case "chapter":
        if (branch.personId.value) return;
        playback.select(command.id);
        camera.reset();
        discovery.close();
        break;
      case "seek":
        playback.seek(command.time);
        break;
      case "hotspot":
        discovery.select(command.id);
        break;
      case "return": {
        const saved = branch.leave();
        if (saved) {
          playback.select(saved.chapterId);
          playback.seek(saved.time);
          camera.restore(saved.camera);
          playback.state.playing = saved.playing;
        }
        break;
      }
      case "revisit":
        branch.leave();
        restoreTarget(command.entry);
        discovery.select(command.entry.hotspotId);
        tab.value = "story";
        break;
      case "restore":
        branch.leave();
        tab.value = "story";
        restoreTarget(command.target);
        announce(
          `已按明信片的线索回到《${
            chapters.find((c) => c.id === command.target.chapterId)?.title ??
            command.target.chapterId
          }》的同一镜头。`,
        );
        break;
    }
  }
  function restoreTarget(target: ReturnTarget) {
    if (chapters.some((chapter) => chapter.id === target.chapterId)) {
      playback.select(target.chapterId);
      playback.seek(target.time);
    }
    camera.restore(target.camera);
  }
  function save() {
    const h = discovery.detail.value;
    if (h) journal.save(h, position());
  }
  function openStudio(entries?: Entry[]) {
    if (entries && entries.length) studio.begin(entries);
    tab.value = "studio";
  }
  function closeStudio() {
    tab.value = "journal";
  }
  return {
    camera,
    playback,
    discovery,
    branch,
    journal,
    studio,
    latestConfirmed,
    toast,
    tab,
    position,
    confirmFraming,
    enterPerson,
    dispatch,
    save,
    openStudio,
    closeStudio,
    announce,
  };
}
