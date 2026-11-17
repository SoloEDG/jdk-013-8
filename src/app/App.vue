<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Waves,
  ArrowUpRight,
  MapPin,
  MousePointer2,
  Eye,
  Headphones,
  BookOpen,
  Compass,
  ChevronRight,
  X,
  Images,
  Frame,
} from "lucide-vue-next";
import { PanoramaView } from "../features/panorama";
import { ChapterList, MediaPlayer, Transport } from "../features/chapters";
import { HotspotLayer, HotspotDetail } from "../features/hotspots";
import { InterviewPanel, PeopleList } from "../features/interviews";
import { JournalPanel } from "../features/journal";
import { PostcardStudio } from "../features/postcards";
import { formatFraming } from "../shared/geometry";
import { parseReturnHash } from "../shared/deeplink";
import { chapters } from "../shared/content";
import { createWorkspace } from "./workspace";
const w = createWorkspace(),
  about = ref(false),
  stage = ref<HTMLElement>(),
  fullError = ref("");
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.value?.requestFullscreen();
  } catch {
    fullError.value = "当前浏览器不支持全屏";
  }
}
function showStudio() {
  if (!w.journal.entries.value.length) {
    w.tab.value = "journal";
    w.announce("先在手记里挑选几条记录，再制作明信片。");
    return;
  }
  w.openStudio();
}
function confirmAndRedraw() {
  w.confirmFraming();
  if (w.studio.mode.value === "latest") w.studio.reapply();
  else w.studio.setMode("latest");
}
onMounted(() => {
  const target = parseReturnHash(window.location.hash);
  if (!target) return;
  const known = chapters.some((chapter) => chapter.id === target.chapterId);
  if (!known) {
    w.announce("这张明信片的章节已不存在，已回到第一章。", 6000);
    return;
  }
  w.dispatch({ type: "restore", target });
  // Keep the address shareable but avoid re-restoring on refresh loops.
  history.replaceState(null, "", window.location.pathname);
});
</script>
<template>
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="#" @click.prevent="w.tab.value = 'story'"
        ><span class="brand-icon"><Waves /></span
        ><b>岸线 <i>SHORELINE</i></b></a
      >
      <nav aria-label="主导航">
        <button
          :class="{ active: w.tab.value === 'story' }"
          @click="w.tab.value = 'story'"
        >
          互动纪录片</button
        ><button
          :class="{ active: w.tab.value === 'journal' }"
          @click="w.tab.value = 'journal'"
        >
          探索手记 <span>{{ w.journal.entries.value.length }}</span></button
        ><button
          :class="{ active: w.tab.value === 'studio' }"
          class="studio-nav"
          aria-label="明信片工作室"
          @click="showStudio"
        >
          <span class="studio-nav-text">明信片工作室</span> <Images :size="13" /></button
        ><button @click="about = true">
          关于本片 <ArrowUpRight :size="13" />
        </button>
      </nav>
      <div class="edition">一座海港的记忆 <span>VOL. 001</span></div>
    </header>
    <main>
      <div class="intro">
        <div>
          <p class="eyebrow"><span /> AN IMMERSIVE DOCUMENTARY</p>
          <h1>潮汐之间<span>Between the Tides</span></h1>
          <p class="intro-copy">把目光交给远方，把时间留给故事。</p>
        </div>
        <div class="intro-meta">
          <span>中国 · 东南沿海</span>
          <p>3 个章节 <i>/</i> 360° 自由探索 <i>/</i> 3 位讲述者</p>
        </div>
      </div>
      <template v-if="w.tab.value === 'story' || w.tab.value === 'studio'"
        ><div class="workspace" :class="{ 'workspace--studio': w.tab.value === 'studio' }">
          <section ref="stage" class="stage">
            <PanoramaView
              :controller="w.camera"
              :source="w.playback.chapter.value.panorama"
              ><MediaPlayer
                :playback="w.playback"
                :branch="!!w.branch.personId.value"
              />
              <div class="stage-shade" />
              <div class="stage-top">
                <span class="scene-badge"><span /> 360° 全景现场</span
                ><span class="location"
                  ><MapPin :size="13" />
                  {{ w.playback.chapter.value.location }}</span
                >
              </div>
              <HotspotLayer
                :items="w.discovery.visible.value"
                :camera="w.camera.camera"
                :enabled="w.discovery.enabled.value && !w.branch.personId.value"
                @open="w.dispatch({ type: 'hotspot', id: $event })"
              />
              <div class="scene-caption">
                <small
                  >CHAPTER 0{{
                    ["dawn", "craft", "night"].indexOf(
                      w.playback.state.chapterId,
                    ) + 1
                  }}</small
                >
                <h2>{{ w.playback.chapter.value.title }}</h2>
                <p>{{ w.playback.chapter.value.description }}</p>
              </div>
              <div class="framing-mark" aria-live="polite">
                <span class="framing-readout">
                  <Frame :size="13" /> {{ formatFraming(w.camera.camera) }}
                </span>
                <button
                  class="framing-confirm"
                  @click="w.confirmFraming()"
                >
                  记下这个构图
                </button>
              </div>
              <div class="drag-hint">
                <MousePointer2 :size="14" /> 按住拖动，环顾四周
              </div></PanoramaView
            ><HotspotDetail
              v-if="w.discovery.detail.value && !w.branch.personId.value"
              :hotspot="w.discovery.detail.value"
              :saved="w.journal.has(w.discovery.detail.value.id)"
              @close="w.discovery.close()"
              @save="w.save()"
              @interview="
                w.enterPerson(w.discovery.detail.value?.personId || '')
              "
            /><InterviewPanel
              :branch="w.branch"
              @back="w.dispatch({ type: 'return' })"
            /><Transport
              :playback="w.playback"
              :disabled="!!w.branch.personId.value"
              @reset="w.camera.reset()"
              @fullscreen="fullscreen"
            />
            <p v-if="fullError" role="status">{{ fullError }}</p>
          </section>
          <aside v-if="w.tab.value === 'story'" class="sidebar">
            <div class="section-heading">
              <h2>故事章节</h2>
              <span>CHAPTERS</span>
            </div>
            <p class="sidebar-copy">循着潮水，走进他们的日常。</p>
            <ChapterList
              :active="w.playback.state.chapterId"
              @select="w.dispatch({ type: 'chapter', id: $event })"
            />
            <div class="chapter-foot">
              <Headphones :size="15" /><span>建议佩戴耳机，沉浸聆听</span>
            </div>
            <div class="explore-toggle">
              <span><Eye :size="17" /> 场景探索热点</span
              ><button
                role="switch"
                aria-label="显示热点"
                :aria-checked="w.discovery.enabled.value"
                :class="{ on: w.discovery.enabled.value }"
                @click="w.discovery.enabled.value = !w.discovery.enabled.value"
              >
                <i />
              </button>
            </div>
            <div class="discovery-count">
              <span>已收集的故事</span
              ><b
                >{{
                  w.journal.entries.value.length.toString().padStart(2, "0")
                }}
                <em>/ 06</em></b
              >
            </div>
            <button class="journal-link" @click="w.tab.value = 'journal'">
              <BookOpen :size="15" /> 打开我的探索手记
              <ChevronRight :size="15" />
            </button>
            <button class="journal-link studio-link" @click="showStudio">
              <Images :size="15" /> 制作全景故事明信片
              <ChevronRight :size="15" />
            </button>
          </aside>
        </div>
        <section v-if="w.tab.value === 'story'" class="below">
          <div class="field-note">
            <small><Compass :size="14" /> EXPLORER'S NOTE</small>
            <h2>故事，不止一个方向。</h2>
            <p>
              试着转动视角，寻找画面里的微光。<br />每个热点都通向一段值得停留的时光。
            </p>
          </div>
          <div class="voices">
            <div class="section-heading">
              <h2>听见他们的故事</h2>
              <span>THE VOICES</span>
            </div>
            <PeopleList @open="w.enterPerson($event)" />
          </div></section></template
      ><PostcardStudio
        v-if="w.tab.value === 'studio'"
        :studio="w.studio"
        @close="w.closeStudio()"
        @confirm-framing="confirmAndRedraw"
      /><JournalPanel
        v-if="w.tab.value === 'journal'"
        :journal="w.journal"
        @revisit="w.dispatch({ type: 'revisit', entry: $event })"
        @create-postcards="w.openStudio($event)"
      />
      <footer>
        <span>SHORELINE ORIGINALS <i>© 2026</i></span
        ><span>让每一段平凡的生活，被看见。 <Waves :size="18" /></span>
      </footer>
    </main>
    <div v-if="w.toast.value" class="site-toast" role="status">
      {{ w.toast.value }}
    </div>
    <div v-if="about" class="modal-backdrop" @click.self="about = false">
      <section
        class="about"
        role="dialog"
        aria-modal="true"
        aria-label="关于本片"
      >
        <button class="close" aria-label="关闭关于" @click="about = false">
          <X /></button
        ><small>ABOUT THE FILM</small>
        <h2>潮汐之间</h2>
        <p>
          以海港、木船与灯塔为线索的互动纪录片演示。全景为原创程序绘制示意场景，章节影像为本地生成的潮汐动画；人物与口述内容均为虚构，用于体验非线性叙事。
        </p>
        <p>
          拖动环顾四周，滚轮调整视角；点击热点发现支线，返回主线继续观看。探索记录仅保存在此浏览器中。
        </p>
        <p>
          在探索手记里挑选几条记录，可以制作成可离线打开的全景故事明信片：卡片会带上当时的取景、人物摘录与返回现场线索。
        </p>
        <button class="primary" @click="about = false">开始探索 ↗</button>
      </section>
    </div>
  </div>
</template>
