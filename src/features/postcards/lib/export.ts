import { buildReturnUrl, encodeReturnHash } from "../../../shared/deeplink";
import { formatFraming } from "../../../shared/geometry";
import { timecode } from "../../../shared/format";
import type { PostcardMark, PostcardText, QualityTier } from "../model/types";

export interface ExportCard {
  text: PostcardText;
  wide: string;
  narrow: string;
  wideSize: { width: number; height: number };
  narrowSize: { width: number; height: number };
  marks: { wide: PostcardMark; narrow: PostcardMark };
  quality: QualityTier;
  framingSourceLabel: string;
  chapterTitle: string;
}

export interface ExportMeta {
  title: string;
  baseUrl: string;
  createdAt: number;
  chapterTitles: string[];
  qualityLabel: string;
}

const KIND_LABEL: Record<PostcardText["hotspotKind"], string> = {
  person: "人物访谈",
  archive: "历史档案",
  sound: "声音现场",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function pin(mark: PostcardMark, text: PostcardText): string {
  const name = text.personName
    ? escapeHtml(text.personName)
    : escapeHtml(text.hotspotTitle);
  const align = mark.left > 78 ? " pin--end" : mark.left < 22 ? " pin--start" : "";
  return `<div class="pin pin--${mark.state}${align}" style="left:${mark.left.toFixed(
    2,
  )}%;top:${mark.top.toFixed(2)}%">
  <span class="pin-dot" aria-hidden="true"></span>
  <span class="pin-text"><b>${name}</b><small>${escapeHtml(mark.hint)}</small></span>
</div>`;
}

function figure(
  card: ExportCard,
  view: "wide" | "narrow",
  index: number,
): string {
  const src = view === "wide" ? card.wide : card.narrow;
  const size = view === "wide" ? card.wideSize : card.narrowSize;
  const mark = view === "wide" ? card.marks.wide : card.marks.narrow;
  return `<figure class="framing framing--${view}">
  <div class="frame">
    <img src="${src}" width="${size.width}" height="${size.height}" alt="${escapeHtml(
      `${card.text.chapterTitle} · ${card.text.hotspotTitle} 的取景`,
    )}" />
    ${pin(mark, card.text)}
    <span class="frame-label">${view === "wide" ? "宽屏取景" : "窄屏取景"}</span>
  </div>
  <figcaption>${
    mark.state === "center" ? "" : `${escapeHtml(mark.hint)} · `
  }${escapeHtml(formatFraming(card.text.framing))}</figcaption>
</figure>`;
}

function cardHtml(card: ExportCard, index: number, baseUrl: string): string {
  const t = card.text;
  const token = encodeReturnHash({
    chapterId: t.chapterId,
    time: t.time,
    camera: t.framing,
    hotspotId: t.hotspotId,
    title: t.hotspotTitle,
  });
  const url = buildReturnUrl(
    {
      chapterId: t.chapterId,
      time: t.time,
      camera: t.framing,
      hotspotId: t.hotspotId,
      title: t.hotspotTitle,
    },
    baseUrl,
  );
  const linkOnly = url.startsWith("#");
  const returnControl = linkOnly
    ? `<span class="return-link return-link--offline" title="请在影片页面的地址后追加下方线索">回到这个镜头 ↗</span>`
    : `<a class="return-link" href="${escapeHtml(url)}" data-return-token="${escapeHtml(
        token,
      )}">回到这个镜头 ↗</a>`;
  const returnHint = linkOnly
    ? `本文件没有记录影片地址，请打开影片页面，并在地址后追加 <code>#${escapeHtml(
        token,
      )}</code>。取景来源：${escapeHtml(card.framingSourceLabel)}。`
    : `若链接失效，可在影片页面地址后追加 <code>#${escapeHtml(
        token,
      )}</code>。取景来源：${escapeHtml(card.framingSourceLabel)}。`;
  const person = t.personName
    ? `<p class="person"><b>${escapeHtml(t.personName)}</b><span>${escapeHtml(
        t.personRole ?? "",
      )}</span></p>`
    : "";
  const note = t.note.trim()
    ? `<div class="note"><span class="note-label">我的记录</span><p>${multiline(
        t.note,
      )}</p></div>`
    : `<div class="note note--empty"><span class="note-label">我的记录</span><p>（这张明信片没有附加记录，画面本身即是注脚。）</p></div>`;
  return `<article class="card" data-index="${index + 1}" data-view="wide">
  <header class="card-head">
    <span class="eyebrow">POSTCARD ${String(index + 1).padStart(2, "0")}</span>
    <span class="chapter">${escapeHtml(t.chapterTitle)}${
      t.chapterSubtitle ? ` · ${escapeHtml(t.chapterSubtitle)}` : ""
    }</span>
    <div class="view-switch" role="group" aria-label="切换取景预览">
      <button type="button" data-view-btn="wide" aria-pressed="true">宽屏</button>
      <button type="button" data-view-btn="narrow" aria-pressed="false">窄屏</button>
    </div>
  </header>
  <div class="card-main">
  <div class="views">
    ${figure(card, "wide", index)}
    ${figure(card, "narrow", index)}
  </div>
  <div class="card-body">
    <div class="subject">
      <span class="kind">${KIND_LABEL[t.hotspotKind]} · ${escapeHtml(
        t.location,
      )}</span>
      <h2>${escapeHtml(t.hotspotTitle)}</h2>
      ${person}
    </div>
    <blockquote aria-label="${escapeHtml(t.quoteLabel)}">
      <span class="quote-mark" aria-hidden="true">“</span>
      <p>${multiline(t.quote)}</p>
      <footer>${escapeHtml(t.quoteLabel)}</footer>
    </blockquote>
    ${note}
    <div class="return">
      <div class="return-copy">
        <span class="note-label">返回线索</span>
        <p>${escapeHtml(t.chapterTitle)} · ${timecode(t.time)} · ${escapeHtml(
          formatFraming(t.framing),
        )}</p>
      </div>
      ${returnControl}
      <p class="return-hint">${returnHint}</p>
    </div>
  </div>
  </div>
</article>`;
}

const STYLE = `
:root{color-scheme:dark;--ink:#e9ebe4;--muted:#8fa397;--accent:#b4d5c0;--line:#ffffff17;--paper:#10191b}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 600px at 20% -10%,#1b2f30,#0b1415 70%);color:var(--ink);font:14px/1.7 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.sheet{max-width:1180px;margin:0 auto;padding:50px 28px 80px}
.masthead{border-bottom:1px solid var(--line);padding-bottom:26px;margin-bottom:36px;display:flex;gap:18px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap}
.masthead h1{font:500 34px/1.25 "Noto Serif SC","Songti SC",serif;letter-spacing:4px;margin:0 0 8px}
.masthead p{margin:0;color:var(--muted);font-size:12px;letter-spacing:1px}
.masthead .meta{color:#7d9487;font-size:11px;letter-spacing:1px;text-align:right}
.card{border:1px solid var(--line);border-radius:6px;background:#14202299;padding:26px;margin-bottom:34px;break-inside:avoid}
.card-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.eyebrow{font-size:9px;letter-spacing:2.5px;color:var(--accent)}
.chapter{font-size:12px;color:#9fb4a6}
.view-switch{margin-left:auto;display:flex;border:1px solid var(--line);border-radius:3px;overflow:hidden}
.view-switch button{font:inherit;font-size:11px;color:#9fb4a6;background:none;border:0;padding:6px 14px;cursor:pointer}
.view-switch button[aria-pressed="true"]{background:#b4d5c022;color:#e5f0e3}
.views{display:grid;gap:18px}
.framing{margin:0;min-width:0}
.frame{position:relative;overflow:hidden;border-radius:3px;background:#0c1517;border:1px solid #ffffff0d}
.framing--wide .frame{aspect-ratio:16/9}
.framing--narrow .frame{aspect-ratio:4/5}
.frame img{display:block;width:100%;height:100%;object-fit:cover}
.frame-label{position:absolute;left:10px;bottom:10px;font-size:9px;letter-spacing:1.5px;color:#dfe9df;background:#0b1516b8;border:1px solid #ffffff24;padding:4px 7px;border-radius:2px}
figcaption{font-size:10px;color:#82988a;margin-top:8px;letter-spacing:.5px}
.pin{position:absolute;width:0;height:0;text-shadow:0 1px 6px #000}
.pin-dot{position:absolute;left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#f2e3b6;box-shadow:0 0 0 5px #f2e3b62e,0 0 0 1px #0c1517aa}
.pin-text{position:absolute;top:0;left:13px;transform:translateY(-50%);display:flex;flex-direction:column;line-height:1.35;background:#0b1516c9;border:1px solid #ffffff22;border-radius:3px;padding:4px 7px;max-width:190px}
.pin-text b{font-size:11px;font-weight:500;color:#f3ecdd;white-space:nowrap}
.pin-text small{font-size:9px;color:#c3d2c2;white-space:nowrap}
.pin--behind .pin-dot{background:#e0b48b;box-shadow:0 0 0 5px #e0b48b2b,0 0 0 1px #0c1517aa}
.pin--end .pin-text{left:auto;right:13px;text-align:right;align-items:flex-end}
.pin--edge .pin-text{background:#0b1516d9}
.card[data-view="wide"] .framing--narrow,.card[data-view="narrow"] .framing--wide{display:none}
.card[data-view="wide"] .views{grid-template-columns:minmax(0,1fr)}
.card[data-view="narrow"] .views{grid-template-columns:minmax(0,1fr);max-width:520px}
.card-body{margin-top:24px;display:grid;gap:22px}
.subject .kind{font-size:9px;letter-spacing:2px;color:#8fab96}
.subject h2{font:500 26px/1.35 "Noto Serif SC","Songti SC",serif;letter-spacing:2px;margin:8px 0 10px}
.person{display:flex;align-items:baseline;gap:10px;margin:0;font-size:12px;color:#c8d6c5}
.person b{font-weight:500}
.person span{font-size:10px;color:#7f968a}
blockquote{margin:0;padding:18px 22px;border-left:2px solid #6f8f7c;background:#0f1a1c;border-radius:2px;position:relative}
blockquote p{margin:0;font:19px/1.8 "Noto Serif SC","Songti SC",serif;color:#dbe3d4;overflow-wrap:anywhere}
blockquote footer{margin-top:10px;font-size:10px;color:#8aa290;letter-spacing:.5px}
.quote-mark{position:absolute;top:2px;left:8px;font-size:34px;color:#6f8f7c66}
.note{border-top:1px dashed #ffffff1c;padding-top:16px}
.note-label{display:block;font-size:9px;letter-spacing:2px;color:#8fab96;margin-bottom:7px}
.note p{margin:0;font-size:13px;color:#c2d0c1;overflow-wrap:anywhere;white-space:normal}
.note--empty p{color:#728779;font-style:italic}
.return{border-top:1px solid var(--line);padding-top:16px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
.return-copy p{margin:0;font-size:11px;color:#9db0a3}
.return-link{margin-left:auto;color:#18372b;background:#b7d2bc;border-radius:2px;text-decoration:none;font-size:12px;padding:9px 15px;white-space:nowrap}
.return-link--offline{background:#3d5147;color:#c9dbcb;border:1px dashed #9fb9a46b;cursor:help}
.return-hint{flex-basis:100%;margin:0;font-size:10px;color:#728779;line-height:1.8;overflow-wrap:anywhere}
.return-hint code{background:#0b1516;border:1px solid #ffffff17;border-radius:2px;padding:1px 5px;font-size:9px;word-break:break-all}
.print-note{border:1px solid var(--line);border-radius:4px;padding:18px 20px;color:#8fa397;font-size:11px;letter-spacing:.4px}
.print-note b{color:#c3d4c5;font-weight:500}
@media (min-width:900px){
 .card[data-view="narrow"] .card-main{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:28px;align-items:start}
 .card[data-view="narrow"] .views{grid-template-columns:minmax(0,1fr);max-width:none}
 .card[data-view="narrow"] .card-body{grid-template-columns:minmax(0,1fr);margin-top:0}
 .card[data-view="wide"] .card-body{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:start}
 .card[data-view="wide"] .subject{grid-column:1}
 .card[data-view="wide"] blockquote{grid-column:2;grid-row:1/span 2}
 .card[data-view="wide"] .note{grid-column:1}
 .card[data-view="wide"] .return{grid-column:1/-1}
}
@media print{
 body{background:#fff;color:#111}
 .sheet{padding:0;max-width:none}
 .card{background:none;border-color:#ccc;break-inside:avoid}
 .view-switch{display:none}
 .print-note{display:none}
}
`;

const SCRIPT = `
(function(){
  document.querySelectorAll('.card').forEach(function(card){
    card.querySelectorAll('[data-view-btn]').forEach(function(button){
      button.addEventListener('click',function(){
        var view=button.getAttribute('data-view-btn');
        card.setAttribute('data-view',view);
        card.querySelectorAll('[data-view-btn]').forEach(function(other){
          other.setAttribute('aria-pressed', String(other===button));
        });
      });
    });
  });
})();
`;

export function buildPostcardHtml(cards: ExportCard[], meta: ExportMeta): string {
  const stamp = new Date(meta.createdAt).toLocaleString("zh-CN");
  const chapters = Array.from(new Set(meta.chapterTitles)).join(" · ");
  const body = cards.map((card, i) => cardHtml(card, i, meta.baseUrl)).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(meta.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="sheet">
  <header class="masthead">
    <div>
      <h1>${escapeHtml(meta.title)}</h1>
      <p>从「潮汐之间」带回的 ${cards.length} 个瞬间 · ${escapeHtml(chapters)}</p>
    </div>
    <div class="meta">${escapeHtml(meta.qualityLabel)}<br />导出 ${escapeHtml(stamp)}</div>
  </header>
  ${body}
  <p class="print-note"><b>这张明信片可以离线打开。</b>画面与文字都写在同一个文件里，不依赖网络；每张卡片的「回到这个镜头」会把影片带回当时的章节、时间与视角。可用页面右上角的宽屏 / 窄屏按钮切换取景预览。</p>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFilename(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
