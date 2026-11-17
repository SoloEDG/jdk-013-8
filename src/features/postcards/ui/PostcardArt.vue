<script setup lang="ts">
import { computed } from "vue";
import { timecode } from "../../../shared/format";
import { formatFraming } from "../../../shared/geometry";
import type { PostcardArtwork, PostcardText } from "../model/types";

const props = defineProps<{
  text: PostcardText;
  artwork: PostcardArtwork;
  view: "wide" | "narrow";
  compact?: boolean;
}>();

const mark = computed(() =>
  props.view === "wide" ? props.artwork.marks.wide : props.artwork.marks.narrow,
);
const size = computed(() =>
  props.view === "wide" ? props.artwork.images.wideSize : props.artwork.images.narrowSize,
);
const src = computed(() =>
  props.view === "wide" ? props.artwork.images.wide : props.artwork.images.narrow,
);
const clipGuard = computed(() =>
  mark.value.left > 78 ? "pin--end" : mark.value.left < 22 ? "pin--start" : "",
);
const title = computed(() =>
  props.text.personName ?? props.text.hotspotTitle,
);
const kindLabel = computed(
  () =>
    ({ person: "人物访谈", archive: "历史档案", sound: "声音现场" })[
      props.text.hotspotKind
    ],
);
</script>

<template>
  <article class="postcard-art" :data-view="view" :class="{ compact }">
    <div class="postcard-frame">
      <img
        :src="src"
        :width="size.width"
        :height="size.height"
        :alt="`${text.chapterTitle} · ${text.hotspotTitle} 的${view === 'wide' ? '宽屏' : '窄屏'}取景`"
      />
      <div
        class="postcard-pin"
        :class="[`pin-${mark.state}`, clipGuard]"
        :style="{ left: `${mark.left}%`, top: `${mark.top}%` }"
        :aria-label="`${title}：${mark.hint}`"
      >
        <span class="postcard-pin-dot" aria-hidden="true" />
        <span class="postcard-pin-copy">
          <b>{{ title }}</b>
          <small>{{ mark.hint }}</small>
        </span>
      </div>
      <span class="postcard-frame-chip">
        {{ view === "wide" ? "宽屏" : "窄屏" }} · {{ formatFraming(artwork.camera) }}
      </span>
    </div>
    <div class="postcard-caption">
      <p class="postcard-kicker">
        {{ text.chapterTitle }} · {{ timecode(text.time) }} · {{ kindLabel }}
      </p>
      <h3>{{ text.hotspotTitle }}</h3>
      <p v-if="text.personName" class="postcard-person">
        <b>{{ text.personName }}</b><span>{{ text.personRole }}</span>
      </p>
      <blockquote>{{ text.quote }}</blockquote>
      <p v-if="text.quoteIsPerson" class="postcard-quote-from">
        摘录自 {{ text.personName }} 的口述
      </p>
      <p v-if="text.note" class="postcard-note">{{ text.note }}</p>
    </div>
  </article>
</template>
