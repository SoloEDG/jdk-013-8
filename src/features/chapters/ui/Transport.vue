<script setup lang="ts">
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
} from "lucide-vue-next";
import { timecode } from "../../../shared/format";
import { chapterProgress } from "../lib/timeline";
import type { Playback } from "../model/playback";
defineProps<{ playback: Playback; disabled: boolean }>();
defineEmits<{ reset: []; fullscreen: [] }>();
</script>
<template>
  <div class="transport">
    <div class="timeline-labels">
      <span>本章进度</span
      ><span
        >{{
          chapterProgress(playback.chapter.value, playback.state.time)
        }}%</span
      >
    </div>
    <input
      aria-label="播放进度"
      type="range"
      min="0"
      :max="playback.chapter.value.duration"
      step="0.1"
      :value="playback.state.time"
      :disabled="disabled"
      @input="playback.seek(Number(($event.target as HTMLInputElement).value))"
    />
    <div class="controls">
      <button
        :disabled="disabled"
        :aria-label="playback.state.playing ? '暂停' : '播放'"
        @click="playback.toggle()"
      >
        <Pause v-if="playback.state.playing" /><Play v-else /></button
      ><span class="time"
        >{{ timecode(playback.state.time) }}
        <em>/ {{ timecode(playback.chapter.value.duration) }}</em></span
      ><span class="spacer" /><button
        :aria-label="playback.state.muted ? '开启声音' : '静音'"
        @click="playback.state.muted = !playback.state.muted"
      >
        <VolumeX v-if="playback.state.muted" /><Volume2 v-else /></button
      ><select aria-label="播放速度" v-model="playback.state.rate">
        <option :value="0.5">0.5×</option>
        <option :value="1">1.0×</option>
        <option :value="1.5">1.5×</option></select
      ><button aria-label="重置视角" @click="$emit('reset')">
        <RotateCcw /></button
      ><button aria-label="全屏" @click="$emit('fullscreen')">
        <Maximize />
      </button>
    </div>
  </div>
</template>
