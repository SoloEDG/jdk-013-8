export interface Camera {
  yaw: number;
  pitch: number;
  fov: number;
}
export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  panorama: string;
  video: string;
  location: string;
  description: string;
}
export interface Hotspot {
  id: string;
  chapterId: string;
  title: string;
  kind: "person" | "archive" | "sound";
  start: number;
  end: number;
  yaw: number;
  pitch: number;
  summary: string;
  personId?: string;
}
export interface Person {
  id: string;
  name: string;
  role: string;
  quote: string;
  paragraphs: string[];
}
export interface Position {
  chapterId: string;
  time: number;
  camera: Camera;
  playing: boolean;
}
export interface Entry {
  id: string;
  hotspotId: string;
  chapterId: string;
  time: number;
  camera: Camera;
  title: string;
  note: string;
  createdAt: number;
}
export type Command =
  | { type: "chapter"; id: string }
  | { type: "seek"; time: number }
  | { type: "hotspot"; id: string }
  | { type: "return" }
  | { type: "revisit"; entry: Entry };
