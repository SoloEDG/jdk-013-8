<script setup lang="ts">
import { Download, Bookmark, Trash2, ArrowUpRight } from "lucide-vue-next";
import { timecode } from "../../../shared/format";
import type { Entry } from "../../../shared/types";
import type { Journal } from "../model/entries";
import { exportJournal } from "../lib/export";
defineProps<{ journal: Journal }>();
defineEmits<{ revisit: [entry: Entry] }>();
</script>
<template>
  <section class="journal-panel">
    <div class="panel-heading">
      <div>
        <small>YOUR FIELD NOTES</small>
        <h2>
          探索手记
          <em>{{
            journal.entries.value.length.toString().padStart(2, "0")
          }}</em>
        </h2>
      </div>
      <button
        class="text-button"
        :disabled="!journal.entries.value.length"
        @click="exportJournal(journal.entries.value)"
      >
        <Download :size="16" /> 导出手记
      </button>
    </div>
    <p v-if="journal.error.value" role="alert">{{ journal.error.value }}</p>
    <div v-if="!journal.entries.value.length" class="empty">
      <Bookmark />
      <h3>每一次发现，都值得留下</h3>
      <p>在全景画面中点击热点，将感兴趣的故事收藏在这里。</p>
    </div>
    <article
      v-for="e in journal.entries.value"
      :key="e.id"
      class="journal-entry"
    >
      <div>
        <small
          >{{ timecode(e.time) }} ·
          {{ new Date(e.createdAt).toLocaleDateString("zh-CN") }}</small
        >
        <h3>{{ e.title }}</h3>
      </div>
      <button class="text-button" @click="$emit('revisit', e)">
        回到现场 <ArrowUpRight :size="16" /></button
      ><textarea
        aria-label="记录感想"
        maxlength="500"
        :value="e.note"
        placeholder="写下此刻的感受…"
        @change="
          journal.note(e.id, ($event.target as HTMLTextAreaElement).value)
        "
      /><button
        class="delete"
        aria-label="删除记录"
        @click="journal.remove(e.id)"
      >
        <Trash2 :size="15" />
      </button>
    </article>
  </section>
</template>
