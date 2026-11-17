import type { Camera, Hotspot } from "../../../shared/types";

export type QualityTier = "light" | "balanced" | "detailed";

/** Which framing a card should borrow from the live scene. */
export type FramingMode = "start" | "latest";

/** Resolved framing source stored on a card. */
export type FramingSource = FramingMode | "entry";

export type CardStatus =
  | "queued"
  | "rendering"
  | "ready"
  | "failed"
  | "cancelled";

/** A camera state the visitor explicitly confirmed in the live scene. */
export interface StartFraming {
  chapterId: string;
  camera: Camera;
  time: number;
  at: number;
}

export interface ConfirmedFraming {
  chapterId: string;
  camera: Camera;
  time: number;
  at: number;
}

export interface EntrySnapshot {
  id: string;
  hotspotId: string;
  chapterId: string;
  time: number;
  camera: Camera;
  title: string;
  note: string;
  createdAt: number;
}

export interface PostcardText {
  hotspotId: string;
  hotspotKind: Hotspot["kind"];
  hotspotTitle: string;
  chapterId: string;
  chapterTitle: string;
  chapterSubtitle: string;
  location: string;
  time: number;
  createdAt: number;
  personId?: string;
  personName?: string;
  personRole?: string;
  quote: string;
  quoteLabel: string;
  quoteIsPerson: boolean;
  note: string;
  framing: Camera;
  framingSource: FramingSource;
  framingAt: number;
  framingNote?: string;
}

/** Where the hotspot pin lands on one card image. */
export interface PostcardMark {
  left: number;
  top: number;
  /** centre: inside the frame; edge: cropped but direction is known; behind: out of lens. */
  state: "center" | "edge" | "behind";
  hint: string;
  rotate: number;
}

export interface PostcardImages {
  wide: string;
  narrow: string;
  wideSize: { width: number; height: number };
  narrowSize: { width: number; height: number };
  textureWidth: number;
  bytes: number;
}

export interface PostcardArtwork {
  images: PostcardImages;
  camera: Camera;
  framingSource: FramingSource;
  quality: QualityTier;
  chapterId: string;
  marks: { wide: PostcardMark; narrow: PostcardMark };
  framingNote?: string;
  renderedAt: number;
}

export interface PostcardJob {
  id: string;
  entry: EntrySnapshot;
  mode: FramingMode;
  status: CardStatus;
  progress: number;
  version: number;
  text: PostcardText;
  quality: QualityTier;
  artwork?: PostcardArtwork;
  error?: string;
  warning?: string;
}

export interface DeviceProfile {
  maxTextureSize: number;
  memoryGB: number;
  cores: number;
  risky: boolean;
  recommended: QualityTier;
  reason: string;
}

export interface ResolvedFraming {
  camera: Camera;
  source: FramingSource;
  at: number;
  /** The chosen live framing belongs to a different chapter and was not used. */
  crossChapter: boolean;
  note?: string;
}

export interface TierPreview {
  status: "idle" | "rendering" | "ready" | "failed";
  url?: string;
  error?: string;
  textureWidth: number;
  outputLabel: string;
  capped: boolean;
}
