<script setup lang="ts">
import { people } from "../../../shared/content";
defineEmits<{ open: [id: string] }>();
</script>
<template>
  <div class="people-list">
    <button v-for="p in people" :key="p.id" @click="$emit('open', p.id)">
      <span class="avatar">{{ p.name.slice(0, 1) }}</span
      ><span
        ><b>{{ p.name }}</b
        ><small>{{ p.role }}</small></span
      ><em>↗</em>
    </button>
  </div>
</template>
