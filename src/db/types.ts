// ---------------------------------------------------------------------------
// Core domain types, defaults, and constants for SQLite persistence
// ---------------------------------------------------------------------------

export type PageType =
  | "menu"
  | "timer"
  | "work"
  | "break"
  | "summary"
  | "settings"
  | "dashboard";
export type TimerMode = "work" | "break";
export type BreakKind = "standard" | "long" | "short";
export type LangCode = "auto" | "tr" | "en";

export type BioEventType = "wake" | "coffee" | "meds" | "meal";
export type MoodType =
  | "calm"
  | "focused"
  | "tired"
  | "scattered"
  | "overwhelmed"
  | "anxious"
  | "motivated";
export type MoodPhase = "start" | "end" | "checkin";
export type ParkingBucket = "today" | "maybe" | "archived";

export interface BioLogItem {
  id: number;
  day_id: number;
  event_type: BioEventType;
  event_time: string;
  note: string | null;
  sleep_hours: number | null;
  created_at: string;
}

export interface MoodLogItem {
  id: number;
  day_id: number;
  phase: MoodPhase;
  mood: MoodType;
  note: string | null;
  session_id: number | null;
  created_at: string;
}

export interface RuntimeState {
  sessionActive: boolean;
  mode: TimerMode;
  breakKind: BreakKind;
  breakTotalSec: number;
  breakElapsedSec: number;
  breakOverdueSec: number;
  breakOvertimeAccumSec: number;
  savedWorkSecondsLeft: number;
  savedWorkElapsedSec: number;
  workStartedAt: string | null;
  breakStartedAt: string | null;
  workTag: string;
  workReason: string;
  sessionDistractions: number;
  currentContext: string;
  activeContextLogId: number | null;
  contextStartedAtElapsedSec: number;
  shortBreakNote?: string;
  workPauseStartedAt?: number | null;
  isHyperfocus?: boolean;
  hyperfocusExtraSec?: number;
  sessionStartMood?: MoodType | null;
  sessionGroupId?: string | null;
  lastActiveAt?: number | null;
}

export type TimerVisualStyle = "digital" | "pie" | "candle";
export type AmbientSoundType = "off" | "brown" | "pink" | "white" | "rain";
export type AccentPreset =
  | "indigo"
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "rose";

export interface AmbientNoiseSettings {
  sound: AmbientSoundType;
  volume: number; // 0-100
  playOnlyInWork: boolean;
}

export const DEFAULT_AMBIENT_NOISE: AmbientNoiseSettings = {
  sound: "off",
  volume: 35,
  playOnlyInWork: true,
};

export interface RescueExerciseSettings {
  breathing: boolean;
  gaze: boolean;
  physical: boolean;
}

export const DEFAULT_RESCUE_EXERCISES: RescueExerciseSettings = {
  breathing: true,
  gaze: true,
  physical: true,
};

export interface ThemeSettings {
  bgColor: string; // "#rrggbb"
  bgOpacity: number; // 30-100 (%)
  timerColor: string; // "#rrggbb"
  uiScale: number; // 100 | 125 | 150
  timerStyle: TimerVisualStyle;
  accentColor?: AccentPreset;
}

export const DEFAULT_THEME: ThemeSettings = {
  bgColor: "#111216",
  bgOpacity: 96,
  timerColor: "#f2f4f8",
  uiScale: 100,
  timerStyle: "digital",
  accentColor: "indigo",
};

export interface AppState {
  page: PageType;
  work_seconds_left: number;
  work_elapsed_sec: number;
  break_seconds_left: number;
}

export interface ActiveDayStats {
  dayId: number;
  label: string;
  totalSec: number;
  sessionCount: number;
  avgSec: number;
}

export interface DaySummary {
  id: number;
  label: string;
  total_sec: number;
  session_count: number;
  is_active: number;
}

export type DistractionTrigger = "internal" | "external";
export type DistractionCategory =
  | "impulsive_task"
  | "idea"
  | "internal"
  | "external";

export type TagKind =
  | "distraction"
  | "ending"
  | "work"
  | "break_overtime"
  | `distraction_${DistractionCategory}`;

export function doesCategoryAddPenalty(cat: DistractionCategory): boolean {
  return cat === "internal" || cat === "external";
}

export type ParkingItemType = "task" | "idea" | "screenshot";
export type ParkingStatus =
  | "pending"
  | "done"
  | "unrated"
  | "important"
  | "unimportant";

export interface ParkingItem {
  id: number;
  day_id: number;
  item_type: ParkingItemType;
  content: string;
  status: ParkingStatus;
  bucket: ParkingBucket;
  active_app: string | null;
  active_window: string | null;
  context_text: string | null;
  screenshot_data: string | null;
  keep_synced: number;
  keep_note_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParkingLotData {
  pendingTasks: ParkingItem[];
  doneTasks: ParkingItem[];
  maybeTasks: ParkingItem[];
  unratedIdeas: ParkingItem[];
  importantIdeas: ParkingItem[];
  unimportantIdeas: ParkingItem[];
  maybeIdeas: ParkingItem[];
  screenshotNotes: ParkingItem[];
  archivedItems: ParkingItem[];
  totalTasks: number;
  totalIdeas: number;
  totalScreenshots: number;
}

export type WorkStoryEntryType = "periodic" | "screenshot_note" | "distraction";

export interface WorkStoryEntry {
  id: number;
  day_id: number;
  entry_type: WorkStoryEntryType;
  context_text: string | null;
  work_tag: string | null;
  active_app: string | null;
  active_window: string | null;
  note: string | null;
  screenshot_data: string | null;
  elapsed_work_sec: number;
  created_at: string;
}

export interface CloudAuthState {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  accessToken?: string;
  serverUrl: string;
  googleClientId?: string;
  autoSyncKeep: boolean;
  googleDocId?: string | null;
  googleDocUrl?: string | null;
  lastSyncAt: string | null;
}

export const DEFAULT_CLOUD_AUTH: CloudAuthState = {
  userId: "",
  email: "",
  name: "",
  picture: "",
  accessToken: "",
  serverUrl: "http://localhost:4000",
  googleClientId: "",
  autoSyncKeep: true,
  googleDocId: null,
  googleDocUrl: null,
  lastSyncAt: null,
};

export interface SyncQueueItem {
  id: number;
  entity_type: string;
  payload_json: string;
  created_at: string;
}

export interface UserCloudSnapshot {
  study_days: unknown[];
  sessions: unknown[];
  distractions: unknown[];
  parking_items: unknown[];
  context_logs: unknown[];
  work_story_entries: unknown[];
  tags: unknown[];
  exported_at: string;
}

export interface ContextStatItem {
  contextText: string;
  totalDurationSec: number;
  entryCount: number;
  distractionCount: number;
  lastWorkTag: string | null;
  topApp: string | null;
}

export interface AppDistractionDetail {
  windowTitle: string;
  contextText: string | null;
  reason: string;
  category: DistractionCategory;
  count: number;
}

export interface AppDistractionGroup {
  appName: string;
  totalCount: number;
  details: AppDistractionDetail[];
}

export interface GlobalShortcutSettings {
  distractionShortcut: string;
  contextShortcut: string;
}

export const DEFAULT_SHORTCUTS: GlobalShortcutSettings = {
  distractionShortcut: "Ctrl+Alt+D",
  contextShortcut: "",
};

export type FeedbackCategory = "bug" | "feature" | "ui" | "other";

export interface FeedbackItem {
  id: number;
  category: FeedbackCategory;
  message: string;
  created_at: string;
}

export interface WindowSizePreset {
  width: number;
  height: number;
}

export type SizeTargetPage =
  | "timer"
  | "menu"
  | "summary"
  | "settings"
  | "dashboard";
export type CustomWindowSizes = Partial<Record<SizeTargetPage, WindowSizePreset>>;

export interface AdhdInsightsData {
  avgFocusThresholdMins: number | null;
  internalCount: number;
  externalCount: number;
  internalPct: number;
  peakFocusHoursLabel: string | null;
  mostDistractedHoursLabel: string | null;
  avgBreakOvertimeMins: number;
  overtimeBreakRatePct: number;
  completionRatePct: number;
  hyperfocusCount: number;
  hyperfocusTotalMins: number;
  topTriggerTag: string | null;
  moodLoggedCount: number;
  topStartMood: MoodType | null;
  topEndMood: MoodType | null;
}

export interface TagItem {
  id: number;
  name: string;
  kind: TagKind;
}

export interface TagSummaryItem {
  tag: string;
  count: number;
  explanations: { reason: string; count: number }[];
}

export interface SummaryReasonsData {
  workTags: TagSummaryItem[];
  breakOvertimeTags: TagSummaryItem[];
  distractionTags: TagSummaryItem[];
  endingTags: TagSummaryItem[];
  totalWorkSubjects: number;
  totalBreakOvertimes: number;
  totalDistractions: number;
  totalEndings: number;
  avgDistractionsPerSession: number;
}

export interface TimelineSessionItem {
  id: number;
  dayId: number;
  mode: "work" | "break" | "idle";
  durationSec: number;
  overtimeSec: number;
  hyperfocusSec: number;
  moodBefore: MoodType | null;
  moodAfter: MoodType | null;
  tag: string | null;
  reason: string | null;
  planName: string | null;
  roundIndex: number;
  isCompleted: boolean;
  sessionGroupId: string | null;
  startedAt: string;
  endedAt: string;
  startHour: number;
  endHour: number;
  timeRangeLabel: string;
  durationLabel: string;
}

export interface WeekDayStat {
  dayIndex: number;
  shortLabel: string;
  dateLabel: string;
  fullDateStr: string;
  total_sec: number;
  session_count: number;
  is_today: boolean;
}

export interface WeeklySummary {
  days: WeekDayStat[];
  totalSec: number;
  sessionCount: number;
  dailyAvgSec: number;
  activeDaysCount: number;
}

export interface StudyPlan {
  id: string; // "developer" | "classic" | "ultradian" | "custom"
  name: string;
  workMins: number;
  shortBreakMins: number;
  standardBreakMins: number;
  longBreakMins: number;
  longBreakInterval: number;
}

export const DEFAULT_STUDY_PLANS: StudyPlan[] = [
  {
    id: "classic",
    name: "",
    workMins: 25,
    shortBreakMins: 3,
    standardBreakMins: 5,
    longBreakMins: 25,
    longBreakInterval: 4,
  },
  {
    id: "developer",
    name: "",
    workMins: 50,
    shortBreakMins: 5,
    standardBreakMins: 10,
    longBreakMins: 30,
    longBreakInterval: 3,
  },
  {
    id: "ultradian",
    name: "",
    workMins: 90,
    shortBreakMins: 5,
    standardBreakMins: 20,
    longBreakMins: 45,
    longBreakInterval: 2,
  },
  {
    id: "custom",
    name: "",
    workMins: 40,
    shortBreakMins: 5,
    standardBreakMins: 10,
    longBreakMins: 25,
    longBreakInterval: 3,
  },
];

export const DEFAULT_WORK_SEC = 50 * 60;
export const DEFAULT_BREAK_SEC = 10 * 60;

export const DEFAULT_WINDOW_SIZES: Record<SizeTargetPage, WindowSizePreset> = {
  timer: { width: 336, height: 180 },
  menu: { width: 356, height: 472 },
  summary: { width: 428, height: 560 },
  settings: { width: 388, height: 520 },
  dashboard: { width: 690, height: 530 },
};

export interface DateRangeFilter {
  startIso: string;
  endIso: string;
}

export interface RecordDistractionParams {
  reason: string;
  tag?: string;
  elapsedWorkSec?: number;
  category?: DistractionCategory;
  activeApp?: string;
  activeWindow?: string;
  contextText?: string;
  penaltySec?: number;
  isOffSession?: boolean;
}

export interface ClearDataOptions {
  workTime: boolean;
  distractions: boolean;
}
