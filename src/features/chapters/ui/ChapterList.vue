<script setup lang="ts">
import { chapters } from "../../../shared/content";
import { timecode } from "../../../shared/format";
defineProps<{ active: string }>();
defineEmits<{ select: [id: string] }>();
</script>
<template>
  <div class="chapter-list">
    <button
      v-for="(chapter, i) in chapters"
      :key="chapter.id"
      :class="{ active: active === chapter.id }"
      @click="$emit('select', chapter.id)"
    >
      <div
        class="chapter-thumb"
        :style="{ backgroundImage: `url(${chapter.panorama})` }"
      >
        <span>0{{ i + 1 }}</span
        ><small>{{ timecode(chapter.duration) }}</small>
      </div>
      <div>
        <small>CHAPTER 0{{ i + 1 }}</small>
        <h3>{{ chapter.title }}</h3>
        <p>{{ chapter.subtitle }}</p>
      </div>
      <b>{{ active === chapter.id ? "正在探索" : "↗" }}</b>
    </button>
  </div>
</template>
