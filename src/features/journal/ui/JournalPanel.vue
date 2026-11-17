<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Download,
  Bookmark,
  Trash2,
  ArrowUpRight,
  Images,
  CheckSquare,
  Square,
  X,
} from "lucide-vue-next";
import { chapters } from "../../../shared/content";
import { timecode } from "../../../shared/format";
import type { Entry } from "../../../shared/types";
import type { Journal } from "../model/entries";
import { exportJournal } from "../lib/export";
const props = defineProps<{ journal: Journal }>();
const emit = defineEmits<{
  revisit: [entry: Entry];
  createPostcards: [entries: Entry[]];
}>();

const selected = ref<string[]>([]);
const selecting = ref(false);

const entries = computed(() => props.journal.entries.value);
const chosen = computed(() =>
  entries.value.filter((entry) => selected.value.includes(entry.id)),
);
const allSelected = computed(
  () => entries.value.length > 0 && selected.value.length === entries.value.length,
);

function chapterTitle(id: string) {
  return chapters.find((chapter) => chapter.id === id)?.title ?? id;
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((value) => value !== id)
    : [...selected.value, id];
}

function toggleAll() {
  selected.value = allSelected.value ? [] : entries.value.map((entry) => entry.id);
}

function makePostcards() {
  emit("createPostcards", chosen.value);
}

function stopSelecting() {
  selecting.value = false;
  selected.value = [];
}

function remove(id: string) {
  props.journal.remove(id);
  selected.value = selected.value.filter((value) => value !== id);
}
</script>
<template>
  <section class="journal-panel">
    <div class="panel-heading">
      <div>
        <small>YOUR FIELD NOTES</small>
        <h2>
          探索手记
          <em>{{ entries.length.toString().padStart(2, "0") }}</em>
        </h2>
      </div>
      <div class="journal-tools">
        <button
          class="text-button"
          :disabled="!entries.length"
          @click="selecting = !selecting"
        >
          <CheckSquare :size="15" />
          {{ selecting ? "退出选择" : "挑选成明信片" }}
        </button>
        <button
          class="text-button"
          :disabled="!entries.length"
          @click="exportJournal(entries)"
        >
          <Download :size="16" /> 导出手记
        </button>
      </div>
    </div>

    <div v-if="selecting" class="selection-bar">
      <button class="text-button" @click="toggleAll">
        <component :is="allSelected ? CheckSquare : Square" :size="14" />
        {{ allSelected ? "取消全选" : "全选" }}
      </button>
      <span>已选 {{ chosen.length }} 条</span>
      <button
        class="primary"
        :disabled="!chosen.length"
        @click="makePostcards"
      >
        <Images :size="14" /> 制作全景明信片（{{ chosen.length }}）
      </button>
      <button class="text-button" @click="stopSelecting">
        <X :size="14" /> 取消
      </button>
    </div>

    <p v-if="journal.error.value" role="alert">{{ journal.error.value }}</p>
    <div v-if="!entries.length" class="empty">
      <Bookmark />
      <h3>每一次发现，都值得留下</h3>
      <p>在全景画面中点击热点，将感兴趣的故事收藏在这里。</p>
    </div>
    <article
      v-for="e in entries"
      :key="e.id"
      class="journal-entry"
      :class="{ chosen: selected.includes(e.id), selecting }"
    >
      <button
        v-if="selecting"
        class="journal-pick"
        :aria-pressed="selected.includes(e.id)"
        :aria-label="`选择 ${e.title}`"
        @click="toggle(e.id)"
      >
        <component
          :is="selected.includes(e.id) ? CheckSquare : Square"
          :size="17"
        />
      </button>
      <div>
        <small
          >{{ chapterTitle(e.chapterId) }} · {{ timecode(e.time) }} ·
          {{ new Date(e.createdAt).toLocaleDateString("zh-CN") }}</small
        >
        <h3>{{ e.title }}</h3>
      </div>
      <button
        class="text-button"
        :disabled="selecting"
        @click="emit('revisit', e)"
      >
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
        @click="remove(e.id)"
      >
        <Trash2 :size="15" />
      </button>
    </article>
  </section>
</template>
