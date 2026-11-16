<script setup lang="ts">
import { X, ArrowUpRight } from "lucide-vue-next";
import type { Hotspot } from "../../../shared/types";
import { kindLabel } from "../lib/visibility";
defineProps<{ hotspot: Hotspot; saved: boolean }>();
defineEmits<{ close: []; interview: []; save: [] }>();
</script>
<template>
  <aside class="detail-card">
    <button class="close" aria-label="关闭热点" @click="$emit('close')">
      <X /></button
    ><small>{{ kindLabel(hotspot.kind) }} / FIELD NOTES</small>
    <h2>{{ hotspot.title }}</h2>
    <p>{{ hotspot.summary }}</p>
    <button v-if="hotspot.personId" class="primary" @click="$emit('interview')">
      进入人物访谈 <ArrowUpRight :size="16" /></button
    ><button class="text-button" @click="$emit('save')">
      {{ saved ? "已加入探索记录" : "＋ 收藏这个发现" }}
    </button>
  </aside>
</template>
