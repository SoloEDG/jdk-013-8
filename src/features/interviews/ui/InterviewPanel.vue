<script setup lang="ts">
import { ArrowLeft, ArrowRight, Quote } from "lucide-vue-next";
import { readingDuration } from "../lib/transcript";
import type { Branch } from "../model/branch";
defineProps<{ branch: Branch }>();
defineEmits<{ back: [] }>();
</script>
<template>
  <section
    v-if="branch.person.value"
    class="interview"
    role="dialog"
    aria-modal="true"
    aria-label="人物访谈"
  >
    <div class="interview-art">
      <div class="portrait">{{ branch.person.value.name.slice(0, 1) }}</div>
      <small>口述影像 · 田野记录</small>
    </div>
    <div class="interview-body">
      <button class="text-button" @click="$emit('back')">
        <ArrowLeft :size="16" /> 返回主线</button
      ><small
        >PEOPLE OF THE HARBOR · 预计
        {{ readingDuration(branch.person.value.paragraphs) }} 秒</small
      >
      <h2>{{ branch.person.value.name }}</h2>
      <p class="muted">{{ branch.person.value.role }}</p>
      <Quote class="quote-icon" />
      <blockquote>{{ branch.person.value.quote }}</blockquote>
      <p class="transcript">
        {{ branch.person.value.paragraphs[branch.paragraph.value] }}
      </p>
      <div class="interview-pages">
        <button
          :disabled="branch.paragraph.value === 0"
          @click="branch.paragraph.value--"
        >
          上一段</button
        ><span
          >{{ branch.paragraph.value + 1 }} /
          {{ branch.person.value.paragraphs.length }}</span
        ><button
          v-if="
            branch.paragraph.value < branch.person.value.paragraphs.length - 1
          "
          @click="branch.paragraph.value++"
        >
          下一段 <ArrowRight :size="14" /></button
        ><button v-else @click="$emit('back')">结束访谈 ↗</button>
      </div>
    </div>
  </section>
</template>
