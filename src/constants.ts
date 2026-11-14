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
  "screenshot_note",
  "internal",
  "external",
  "escape",
];

export const EMPTY_PARKING: ParkingLotData = {
  pendingTasks: [],
  doneTasks: [],
  unratedIdeas: [],
  importantIdeas: [],
  unimportantIdeas: [],
  screenshotNotes: [],
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

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
