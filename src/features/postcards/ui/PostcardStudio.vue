<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  ArrowUpRight,
  ChevronLeft,
  Download,
  Frame,
  Images,
  RefreshCw,
  StopCircle,
  X,
} from "lucide-vue-next";
import { timecode } from "../../../shared/format";
import { formatFraming } from "../../../shared/geometry";
import type { PostcardJob } from "../model/types";
import {
  STATUS_LABEL,
  type PostcardStudio as Studio,
} from "../model/studio";
import { QUALITY_ORDER, tierSpec } from "../lib/quality";
import { framingSourceLabel } from "../lib/text";
import PostcardArt from "./PostcardArt.vue";

const props = defineProps<{ studio: Studio }>();
const emit = defineEmits<{ close: []; confirmFraming: [] }>();

const activeView = ref<"wide" | "narrow">("wide"),
  expanded = ref<string | null>(null),
  /** Per-card override so a single card can be previewed independently. */
  cardViews = ref<Record<string, "wide" | "narrow">>({});

const judge = computed(() => props.studio.device.value);
const jobs = computed(() => props.studio.jobs.value);
const mode = computed(() => props.studio.mode.value);
const startLabel = computed(() => props.studio.startLabel.value);
const latestLabel = computed(() => props.studio.latestLabel.value);
function denseText(job: PostcardJob): boolean {
  return job.entry.note.length > 120 || job.text.quote.length > 160;
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape" && expanded.value) {
    expanded.value = null;
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
const expandedJob = computed(
  () => jobs.value.find((job) => job.id === expanded.value) ?? null,
);

function viewFor(job: PostcardJob): "wide" | "narrow" {
  return cardViews.value[job.id] ?? activeView.value;
}

function toggleView() {
  activeView.value = activeView.value === "wide" ? "narrow" : "wide";
  cardViews.value = {};
}

function toggleCardView(job: PostcardJob) {
  cardViews.value = {
    ...cardViews.value,
    [job.id]: viewFor(job) === "wide" ? "narrow" : "wide",
  };
}

function noteInput(job: PostcardJob, event: Event) {
  props.studio.updateNote(job.id, (event.target as HTMLTextAreaElement).value);
}

function pickTier(tier: (typeof QUALITY_ORDER)[number]) {
  if (jobs.value.length) props.studio.rerenderAll(tier);
  else props.studio.setDefaultQuality(tier);
}

function confirmFraming() {
  emit("confirmFraming");
}
</script>

<template>
  <section class="studio-page" aria-label="全景故事明信片工作室">
    <header class="studio-head">
      <button class="studio-back" aria-label="返回探索手记" @click="emit('close')">
        <ChevronLeft :size="16" /> 返回手记
      </button>
      <div class="studio-title">
        <small>PANORAMA POSTCARDS</small>
        <h2>把发现做成明信片 <em>{{ jobs.length }}</em></h2>
      </div>
      <div class="studio-actions">
        <button
          class="ghost"
          :disabled="!studio.failedCount.value"
          @click="studio.retryFailed()"
        >
          <RefreshCw :size="14" /> 重试失败项
        </button>
        <button
          class="ghost"
          :disabled="!studio.running.value"
          @click="studio.stop()"
        >
          <StopCircle :size="14" /> 停止后续取景
        </button>
        <button
          class="primary"
          :disabled="!studio.saveable.value.length || studio.saving.value"
          @click="studio.saveAll()"
        >
          <Download :size="15" /> 保存全部已完成卡片
        </button>
      </div>
    </header>

    <div class="studio-grid">
      <aside class="studio-controls">
        <section class="control-block">
          <h3>取景来源</h3>
          <p class="control-hint">
            制作期间仍可在上方转动镜头、写手记。卡片采用哪一版构图，由你在这里决定。
          </p>
          <label :class="{ picked: mode === 'start' }">
            <input
              type="radio"
              name="framing"
              value="start"
              :checked="mode === 'start'"
              @change="studio.setMode('start')"
            />
            <span>
              <b>制作开始时的构图</b>
              <small>{{ startLabel }}</small>
            </span>
          </label>
          <label :class="{ picked: mode === 'latest' }">
            <input
              type="radio"
              name="framing"
              value="latest"
              :checked="mode === 'latest'"
              @change="studio.setMode('latest')"
            />
            <span>
              <b>最近一次确认的构图</b>
              <small>{{ latestLabel }}</small>
            </span>
          </label>
          <button class="text-button" @click="confirmFraming">
            <Frame :size="14" /> 把上方镜头记为最新构图并重画
          </button>
          <p v-if="studio.cancelled.value" class="control-hint warn">
            后续取景已停止。已完成的卡片可以单独保存，失败项可随时重试。
          </p>
        </section>

        <section class="control-block">
          <h3>画质与设备</h3>
          <p class="control-hint" :class="{ warn: judge.risky }">
            {{ judge.reason }}
          </p>
          <div class="tier-list">
            <button
              v-for="tier in QUALITY_ORDER"
              :key="tier"
              :class="{ picked: studio.defaultQuality.value === tier }"
              @click="pickTier(tier)"
            >
              <b>{{ tierSpec(tier).label }}</b>
              <small>{{ tierSpec(tier).short }}</small>
              <em>{{ tierSpec(tier).wide[0] }}×{{ tierSpec(tier).wide[1] }}</em>
            </button>
          </div>
          <p class="control-hint tier-detail">
            {{ tierSpec(studio.defaultQuality.value).detail }}
          </p>
          <p class="control-hint">
            每张卡片都会写明输出分辨率与纹理上限；受设备限制时会标明，不会悄悄降级。
          </p>
        </section>

        <section class="control-block">
          <h3>画质预演</h3>
          <p class="control-hint">
            用当前第一张卡片试渲染一次，不写入任何卡片，方便比较清晰度与速度。
          </p>
          <div class="tier-previews">
            <button
              v-for="tier in QUALITY_ORDER"
              :key="tier"
              class="tier-preview"
              :disabled="!jobs.length || studio.previewBusy.value === tier"
              @click="studio.previewTier(tier)"
            >
              <span class="tier-preview-media">
                <img
                  v-if="studio.previews.value[tier]?.url"
                  :src="studio.previews.value[tier]!.url"
                  alt=""
                />
                <span v-else class="tier-preview-empty">
                  {{
                    studio.previews.value[tier]?.status === "rendering"
                      ? "渲染中…"
                      : "点击试渲染"
                  }}
                </span>
              </span>
              <span class="tier-preview-copy">
                <b>{{ tierSpec(tier).label }}</b>
                <small>{{ tierSpec(tier).previewMs }}</small>
                <em>
                  纹理 {{ studio.plannedTexture(tier) }}px
                </em>
              </span>
              <span
                v-if="studio.previews.value[tier]?.status === 'failed'"
                class="tier-preview-error"
              >
                <X :size="11" /> 此档不可预览，可改用轻量
              </span>
            </button>
          </div>
        </section>
      </aside>

      <div class="studio-board">
        <p v-if="studio.latestNewer.value" class="studio-notice warn">
          你刚确认了一版更新的构图。当前卡片仍是旧的一版，可以
          <button class="inline-action" @click="confirmFraming">
            按最新构图重画
          </button>
          ，也可以留作「制作开始时的构图」。
        </p>
        <p
          v-if="studio.notice.value"
          class="studio-notice"
          :class="{ warn: studio.noticeKind.value === 'warn' }"
          role="status"
        >
          {{ studio.notice.value }}
        </p>
        <div class="board-top">
          <span class="board-count">
            已完成 <b>{{ studio.readyCount.value }}</b> / {{ jobs.length }}
            <template v-if="studio.failedCount.value">
              · 失败 <b class="bad">{{ studio.failedCount.value }}</b>
            </template>
          </span>
          <button class="view-toggle" @click="toggleView">
            <Images :size="14" />
            {{ activeView === "wide" ? "切换为窄屏预览" : "切换为宽屏预览" }}
          </button>
        </div>
        <div class="board-progress" aria-hidden="true">
          <i :style="{ width: `${Math.round(studio.progress.value * 100)}%` }" />
        </div>

        <p v-if="!jobs.length" class="board-empty">
          还没有选中的手记。回到「探索手记」，勾选几条记录后再制作明信片。
        </p>

        <ul class="card-list">
          <li v-for="job in jobs" :key="job.id" class="card-row">
            <div class="card-preview" :class="`is-${activeView}`">
              <PostcardArt
                v-if="job.artwork"
                :text="job.text"
                :artwork="job.artwork"
                :view="viewFor(job)"
                compact
              />
              <div v-else class="card-preview-placeholder">
                <span v-if="job.status === 'rendering'" class="spinner" />
                <span v-if="job.status === 'failed'">取景失败</span>
                <span v-else-if="job.status === 'cancelled'">已取消</span>
                <span v-else-if="job.status !== 'rendering'">等待取景</span>
                <i
                  v-if="job.status === 'rendering'"
                  :style="{ width: `${Math.round(job.progress * 100)}%` }"
                />
              </div>
            </div>
            <div class="card-meta">
              <div class="card-line">
                <small>{{ job.text.chapterTitle }} · {{ timecode(job.entry.time) }}</small>
                <span class="status" :class="job.status">{{
                  STATUS_LABEL[job.status]
                }}</span>
              </div>
              <h3>{{ job.text.hotspotTitle }}</h3>
              <p v-if="job.text.personName" class="card-person">
                {{ job.text.personName }} · {{ job.text.personRole }}
              </p>
              <p class="card-framing">
                {{
                  framingSourceLabel(
                    job.artwork?.framingSource ?? job.text.framingSource,
                  )
                }}
                <span v-if="job.artwork">· {{ formatFraming(job.artwork.camera) }}</span>
              </p>
              <p v-if="job.text.framingNote" class="card-fallback">
                {{ job.text.framingNote }}
              </p>
              <p v-if="denseText(job)" class="card-fallback">
                文字较长：人物与热点按方向固定在画面上，切换宽／窄屏时会重新定位，不会丢失对应关系。
              </p>
              <p v-if="job.error" class="card-error" role="alert">{{ job.error }}</p>
              <p v-if="job.warning" class="card-warn">{{ job.warning }}</p>
              <textarea
                :value="job.text.note"
                maxlength="500"
                aria-label="明信片上的手记"
                placeholder="给这张明信片补一句话（会同步到探索手记）…"
                @input="noteInput(job, $event)"
              />
              <div class="card-actions">
                <button
                  class="text-button"
                  :disabled="job.status !== 'failed' && job.status !== 'cancelled'"
                  @click="studio.retry(job, 'light')"
                >
                  <RefreshCw :size="13" /> 用轻量预览重试
                </button>
                <button
                  class="text-button"
                  :disabled="!job.artwork"
                  @click="studio.saveOne(job)"
                >
                  <Download :size="13" /> 单独保存
                </button>
                <button
                  class="text-button"
                  :disabled="!job.artwork"
                  @click="toggleCardView(job)"
                >
                  <Images :size="13" />
                  {{
                    viewFor(job) === "wide" ? "这张看窄屏" : "这张看宽屏"
                  }}
                </button>
                <button
                  class="text-button"
                  :disabled="!job.artwork"
                  @click="expanded = job.id"
                >
                  <ArrowUpRight :size="13" /> 打开这张明信片
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="expanded && expandedJob"
      class="card-modal"
      role="dialog"
      aria-modal="true"
      aria-label="明信片预览"
      @click.self="expanded = null"
    >
      <div class="card-modal-inner">
        <header>
          <span>{{ viewFor(expandedJob) === "wide" ? "宽屏预览" : "窄屏预览" }}</span>
          <button class="view-toggle" @click="toggleCardView(expandedJob)">
            <Images :size="14" />
            {{ viewFor(expandedJob) === "wide" ? "看窄屏" : "看宽屏" }}
          </button>
          <button class="close" aria-label="关闭预览" @click="expanded = null">
            <X />
          </button>
        </header>
        <PostcardArt
          v-if="expandedJob.artwork"
          :text="expandedJob.text"
          :artwork="expandedJob.artwork"
          :view="viewFor(expandedJob)"
        />
        <p class="modal-return-hint">
          导出的明信片会包含这张卡片的取景、人物摘录与返回线索。
        </p>
      </div>
    </div>
  </section>
</template>
