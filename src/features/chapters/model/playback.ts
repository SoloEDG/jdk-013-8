import { computed, reactive } from "vue";
import { chapters } from "../../../shared/content";
import { seekTime } from "../lib/timeline";
export function createPlayback() {
  const state = reactive({
    chapterId: chapters[0]!.id,
    time: 0,
    playing: false,
    muted: true,
    rate: 1,
    ready: false,
    error: "",
  });
  const chapter = computed(() =>
    chapters.find((c) => c.id === state.chapterId)!,
  );
  function select(id: string) {
    if (!chapters.some((c) => c.id === id)) return;
    state.chapterId = id;
    state.time = 0;
    state.playing = false;
    state.error = "";
  }
  return {
    state,
    chapter,
    select,
    seek: (time: number) => {
      state.time = seekTime(chapter.value, time);
    },
    toggle: () => {
      if (state.time >= chapter.value.duration) state.time = 0;
      state.playing = !state.playing;
    },
    tick: (time: number) => {
      state.time = seekTime(chapter.value, time);
    },
    finish: () => {
      state.playing = false;
      state.time = chapter.value.duration;
    },
  };
}
export type Playback = ReturnType<typeof createPlayback>;
