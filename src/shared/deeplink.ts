import type { ReturnTarget } from "./types";

export type { ReturnTarget };

const HASH_KEY = "return=";

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeReturnHash(target: ReturnTarget): string {
  return `${HASH_KEY}${encodeBase64Url(JSON.stringify(target))}`;
}

export function parseReturnHash(hash: string): ReturnTarget | null {
  const value = hash.replace(/^#/, "");
  if (!value.startsWith(HASH_KEY)) return null;
  const raw = decodeBase64Url(value.slice(HASH_KEY.length));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<ReturnTarget>;
    if (
      typeof candidate.chapterId !== "string" ||
      !Number.isFinite(candidate.time) ||
      typeof candidate.time !== "number" ||
      !candidate.camera ||
      !Number.isFinite(candidate.camera.yaw) ||
      !Number.isFinite(candidate.camera.pitch) ||
      !Number.isFinite(candidate.camera.fov)
    ) {
      return null;
    }
    return {
      chapterId: candidate.chapterId,
      time: candidate.time,
      camera: {
        yaw: candidate.camera.yaw,
        pitch: candidate.camera.pitch,
        fov: candidate.camera.fov,
      },
      hotspotId:
        typeof candidate.hotspotId === "string" ? candidate.hotspotId : undefined,
      title: typeof candidate.title === "string" ? candidate.title : undefined,
    };
  } catch {
    return null;
  }
}

export function currentBaseUrl(): string {
  if (typeof window === "undefined") return "";
  if (!/^https?:$/.test(window.location.protocol)) return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export function buildReturnUrl(target: ReturnTarget, base?: string): string {
  const targetBase = base?.trim() || currentBaseUrl();
  const hash = encodeReturnHash(target);
  if (!targetBase) return `#${hash}`;
  return `${targetBase.replace(/#.*$/, "")}#${hash}`;
}
