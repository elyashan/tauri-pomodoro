import type { DistractionCategory, ParkingLotData, TagKind } from "./db";

export interface ShortcutStatus {
  distractionShortcut: string;
  contextShortcut: string;
  distractionOk: boolean;
  distractionError: string | null;
  contextOk: boolean;
  contextError: string | null;
}

export interface TagFormState {
  mode: "add" | "edit" | "delete";
  kind: TagKind;
  tagId?: number;
  currentName?: string;
  value: string;
}

export type NavPage = "menu" | "timer" | "summary" | "settings" | "dashboard";

export const DISTRACT_CATEGORIES: DistractionCategory[] = [
  "impulsive_task",
  "idea",
  "internal",
  "external",
];

export const EMPTY_PARKING: ParkingLotData = {
  pendingTasks: [],
  doneTasks: [],
  maybeTasks: [],
  unratedIdeas: [],
  importantIdeas: [],
  unimportantIdeas: [],
  maybeIdeas: [],
  screenshotNotes: [],
  archivedItems: [],
  totalTasks: 0,
  totalIdeas: 0,
  totalScreenshots: 0,
};

export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 saat

export const BG_PRESETS = [
  "#1a1814",
  "#0f172a",
  "#1e1b4b",
  "#052e16",
  "#3f0d12",
  "#27272a",
  "#e7e5e4",
];

export const TIMER_PRESETS = [
  "#ffffff",
  "#fbbf24",
  "#60a5fa",
  "#4ade80",
  "#f87171",
  "#c084fc",
  "#18181b",
];

export const PENALTY_OPTIONS = [0, 1, 2, 3, 5];
export const UI_SCALE_OPTIONS = [100, 125, 150] as const;

export const BIO_EVENT_TYPES = ["wake", "coffee", "meds", "meal"] as const;
export const BIO_EVENT_EMOJIS: Record<(typeof BIO_EVENT_TYPES)[number], string> = {
  wake: "🌅",
  coffee: "☕",
  meds: "💊",
  meal: "🍽️",
};

export const MOOD_TYPES = [
  "calm",
  "focused",
  "tired",
  "anxious",
  "motivated",
] as const;
export const MOOD_EMOJIS: Record<(typeof MOOD_TYPES)[number], string> = {
  calm: "😌",
  focused: "🎯",
  tired: "😴",
  anxious: "😰",
  motivated: "🔥",
};

export interface ReleaseCommandPreset {
  id: string;
  cmd: string;
  descKey:
    | "releasePatchDesc"
    | "releaseMinorDesc"
    | "releaseMajorDesc"
    | "releaseExactDesc"
    | "releaseDryDesc";
}

export const RELEASE_COMMANDS: ReleaseCommandPreset[] = [
  { id: "patch", cmd: "node scripts/release.mjs patch", descKey: "releasePatchDesc" },
  { id: "minor", cmd: "node scripts/release.mjs minor", descKey: "releaseMinorDesc" },
  { id: "major", cmd: "node scripts/release.mjs major", descKey: "releaseMajorDesc" },
  { id: "exact", cmd: "node scripts/release.mjs 1.2.0", descKey: "releaseExactDesc" },
  { id: "dry", cmd: "node scripts/release.mjs patch --dry-run", descKey: "releaseDryDesc" },
];

export function getWarmupDurationSec(workMins: number): number {
  if (workMins < 8) return 0;
  const mins = Math.min(5, Math.max(1, Math.round(workMins * 0.1)));
  return mins * 60;
}

export function getFinalStretchSec(workMins: number): number {
  if (workMins < 6) return 60;
  const mins = Math.min(5, Math.max(2, Math.round(workMins * 0.12)));
  return mins * 60;
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
