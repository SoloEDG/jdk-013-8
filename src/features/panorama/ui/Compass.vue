<script setup lang="ts">
import type { Camera } from "../../../shared/types";
defineProps<{ camera: Camera }>();
</script>
<template>
  <div class="compass">
    <span>N</span><i :style="{ transform: `rotate(${-camera.yaw}deg)` }">↑</i
    ><small>{{ Math.round((camera.yaw + 360) % 360) }}°</small>
  </div>
</template>
