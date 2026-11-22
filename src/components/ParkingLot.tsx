import { useEffect, useState } from "react";
import type {
  ParkingItem,
  ParkingLotData,
  TimelineSessionItem,
  WorkStoryEntry,
} from "../db";
import type { Translations } from "../i18n";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFileText,
} from "./Icons";

export function renderParkingItemTooltip(item: ParkingItem): string {
  const parts: string[] = [];
  if (item.context_text) {
    parts.push(`🎯 ${item.context_text}`);
  }
  if (item.active_app || item.active_window) {
    parts.push(
      `🌐 ${item.active_app || ""}${
        item.active_window ? ` — ${item.active_window}` : ""
      }`,
    );
  }
  return parts.join(" • ");
}

export function buildSingleItemParkingData(item: ParkingItem): ParkingLotData {
  return {
    totalTasks: item.item_type === "task" ? 1 : 0,
    totalIdeas: item.item_type === "idea" ? 1 : 0,
    totalScreenshots: item.item_type === "screenshot" ? 1 : 0,
    pendingTasks:
      item.item_type === "task" && item.status !== "done" ? [item] : [],
    doneTasks:
      item.item_type === "task" && item.status === "done" ? [item] : [],
    unratedIdeas:
      item.item_type === "idea" && item.status === "unrated" ? [item] : [],
    importantIdeas:
      item.item_type === "idea" && item.status === "important" ? [item] : [],
    unimportantIdeas:
      item.item_type === "idea" && item.status === "unimportant" ? [item] : [],
    screenshotNotes: item.item_type === "screenshot" ? [item] : [],
  };
}

export interface ParkingTaskRowProps {
  item: ParkingItem;
  isDone: boolean;
  t: Translations;
  onToggleTask: (id: number, done: boolean) => void;
  onSyncSingleToDocs: (item: ParkingItem) => void;
  onDeleteEntry: (id: number) => void;
}

export function ParkingTaskRow({
  item,
  isDone,
  t,
  onToggleTask,
  onSyncSingleToDocs,
  onDeleteEntry,
}: ParkingTaskRowProps) {
  return (
    <div
      className="parking-todo-row"
      title={renderParkingItemTooltip(item)}
    >
      <label className="parking-todo-left">
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => onToggleTask(item.id, !isDone)}
        />
        <span className={`parking-todo-text ${isDone ? "done" : ""}`}>
          {item.content}
        </span>
      </label>
      <div className="parking-row-right">
        <button
          type="button"
          className={`docs-chip-btn ${item.keep_synced ? "synced" : ""}`}
          onClick={() => onSyncSingleToDocs(item)}
          title={item.keep_synced ? t.docsSyncedBadge : t.docsSyncSingleBtn}
        >
          {item.keep_synced ? (
            <IconCheck size={10} />
          ) : (
            <IconFileText size={10} />
          )}
        </button>
        <button
          type="button"
          className="tag-icon-btn del-btn"
          onClick={() => onDeleteEntry(item.id)}
          title={t.cancel}
        >
          <IconClose size={10} />
        </button>
      </div>
    </div>
  );
}

export interface ParkingIdeaRowProps {
  item: ParkingItem;
  t: Translations;
  onRateIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onSyncSingleToDocs: (item: ParkingItem) => void;
  onDeleteEntry: (id: number) => void;
  showUnimportantBtn?: boolean;
}

export function ParkingIdeaRow({
  item,
  t,
  onRateIdea,
  onSyncSingleToDocs,
  onDeleteEntry,
  showUnimportantBtn = true,
}: ParkingIdeaRowProps) {
  return (
    <div
      className="parking-idea-row"
      title={renderParkingItemTooltip(item)}
    >
      <span className="parking-todo-text">{item.content}</span>
      <div className="parking-idea-actions">
        <button
          type="button"
          className={`idea-rate-btn ${
            item.status === "important" ? "active-imp" : ""
          }`}
          onClick={() =>
            onRateIdea(
              item.id,
              item.status === "important" ? "unrated" : "important",
            )
          }
        >
          {t.parkingMarkImportant}
        </button>
        {showUnimportantBtn && (
          <button
            type="button"
            className={`idea-rate-btn ${
              item.status === "unimportant" ? "active-unimp" : ""
            }`}
            onClick={() =>
              onRateIdea(
                item.id,
                item.status === "unimportant" ? "unrated" : "unimportant",
              )
            }
          >
            {t.parkingMarkUnimportant}
          </button>
        )}
        <button
          type="button"
          className={`docs-chip-btn ${item.keep_synced ? "synced" : ""}`}
          onClick={() => onSyncSingleToDocs(item)}
          title={item.keep_synced ? t.docsSyncedBadge : t.docsSyncSingleBtn}
        >
          {item.keep_synced ? (
            <IconCheck size={10} />
          ) : (
            <IconFileText size={10} />
          )}
        </button>
        <button
          type="button"
          className="tag-icon-btn del-btn"
          onClick={() => onDeleteEntry(item.id)}
          title={t.cancel}
        >
          <IconClose size={10} />
        </button>
      </div>
    </div>
  );
}

export interface ParkingScreenshotRowProps {
  item: ParkingItem;
  t: Translations;
  onOpenLightbox: (entry: WorkStoryEntry) => void;
  onSyncSingleToDocs: (item: ParkingItem) => void;
  onDeleteEntry: (id: number) => void;
}

export function ParkingScreenshotRow({
  item,
  t,
  onOpenLightbox,
  onSyncSingleToDocs,
  onDeleteEntry,
}: ParkingScreenshotRowProps) {
  return (
    <div
      className="parking-ss-row"
      title={renderParkingItemTooltip(item)}
    >
      {item.screenshot_data && (
        <img
          src={item.screenshot_data}
          alt="ss"
          className="parking-ss-thumb"
          onClick={() =>
            onOpenLightbox({
              id: item.id,
              day_id: item.day_id,
              entry_type: "screenshot_note",
              screenshot_data: item.screenshot_data,
              active_app: item.active_app,
              active_window: item.active_window,
              context_text: item.context_text,
              work_tag: "",
              note: item.content,
              created_at: item.created_at,
              elapsed_work_sec: 0,
            })
          }
        />
      )}
      <span className="parking-todo-text">{item.content}</span>
      <div className="parking-row-right">
        <button
          type="button"
          className={`docs-chip-btn ${item.keep_synced ? "synced" : ""}`}
          onClick={() => onSyncSingleToDocs(item)}
          title={item.keep_synced ? t.docsSyncedBadge : t.docsSyncSingleBtn}
        >
          {item.keep_synced ? (
            <IconCheck size={10} />
          ) : (
            <IconFileText size={10} />
          )}
        </button>
        <button
          type="button"
          className="tag-icon-btn del-btn"
          onClick={() => onDeleteEntry(item.id)}
          title={t.cancel}
        >
          <IconClose size={10} />
        </button>
      </div>
    </div>
  );
}

export interface ParkingLotPanelProps {
  data: ParkingLotData;
  isBreakView: boolean;
  t: Translations;
  docsStatusMsg: string | null;
  onSyncAllToDocs: () => void;
  onSyncSingleToDocs: (item: ParkingItem) => void;
  onToggleTask: (id: number, done: boolean) => void;
  onRateIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteEntry: (id: number) => void;
  onOpenLightbox: (entry: WorkStoryEntry) => void;
}

type ParkingSectionKey =
  | "pending"
  | "done"
  | "unrated"
  | "important"
  | "unimportant"
  | "screenshots";

export function ParkingLotPanel({
  data,
  isBreakView,
  t,
  docsStatusMsg,
  onSyncAllToDocs,
  onSyncSingleToDocs,
  onToggleTask,
  onRateIdea,
  onDeleteEntry,
  onOpenLightbox,
}: ParkingLotPanelProps) {
  const [openSections, setOpenSections] = useState<
    Record<ParkingSectionKey, boolean>
  >({
    pending: true,
    done: false,
    unrated: true,
    important: true,
    unimportant: false,
    screenshots: false,
  });

  const toggleSection = (key: ParkingSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalAllCount =
    data.totalTasks + data.totalIdeas + data.totalScreenshots;

  return (
    <>
      {isBreakView && (
        <div className="parking-header-bar">
          <div className="parking-banner-title">
            {t.parkingBreakBannerTitle}
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {docsStatusMsg && (
              <span className="docs-status-pill">{docsStatusMsg}</span>
            )}
            <button
              type="button"
              className="docs-sync-btn"
              onClick={onSyncAllToDocs}
              title={t.docsSyncAllBtn}
            >
              <IconFileText size={11} />
              <span>Docs</span>
            </button>
          </div>
        </div>
      )}

      {totalAllCount === 0 ? (
        <div
          style={{
            fontSize: "9.5px",
            color: "#a1a1aa",
            padding: "4px 2px",
            textAlign: "center",
          }}
        >
          {t.parkingEmpty}
        </div>
      ) : (
        <>
          {data.pendingTasks.length > 0 && (
            <>
              <button
                type="button"
                className="parking-section-title"
                onClick={() => toggleSection("pending")}
              >
                <span>{t.parkingPendingTasks} ({data.pendingTasks.length})</span>
                <span>{openSections.pending ? "▾" : "▸"}</span>
              </button>
              {openSections.pending &&
                data.pendingTasks.map((it) => (
                  <ParkingTaskRow
                    key={it.id}
                    item={it}
                    isDone={false}
                    t={t}
                    onToggleTask={onToggleTask}
                    onSyncSingleToDocs={onSyncSingleToDocs}
                    onDeleteEntry={onDeleteEntry}
                  />
                ))}
            </>
          )}

          {data.doneTasks.length > 0 && (
            <>
              <button
                type="button"
                className="parking-section-title"
                onClick={() => toggleSection("done")}
              >
                <span>{t.parkingDoneTasks} ({data.doneTasks.length})</span>
                <span>{openSections.done ? "▾" : "▸"}</span>
              </button>
              {openSections.done &&
                data.doneTasks.map((it) => (
                  <ParkingTaskRow
                    key={it.id}
                    item={it}
                    isDone={true}
                    t={t}
                    onToggleTask={onToggleTask}
                    onSyncSingleToDocs={onSyncSingleToDocs}
                    onDeleteEntry={onDeleteEntry}
                  />
                ))}
            </>
          )}

          {data.unratedIdeas.length > 0 && (
            <>
              <button
                type="button"
                className="parking-section-title"
                onClick={() => toggleSection("unrated")}
              >
                <span>{t.parkingUnratedIdeas} ({data.unratedIdeas.length})</span>
                <span>{openSections.unrated ? "▾" : "▸"}</span>
              </button>
              {openSections.unrated &&
                data.unratedIdeas.map((it) => (
                  <ParkingIdeaRow
                    key={it.id}
                    item={it}
                    t={t}
                    onRateIdea={onRateIdea}
                    onSyncSingleToDocs={onSyncSingleToDocs}
                    onDeleteEntry={onDeleteEntry}
                  />
                ))}
            </>
          )}

          {data.importantIdeas.length > 0 && (
            <>
              <button
                type="button"
                className="parking-section-title"
                onClick={() => toggleSection("important")}
              >
                <span>{t.parkingImportantIdeas} ({data.importantIdeas.length})</span>
                <span>{openSections.important ? "▾" : "▸"}</span>
              </button>
              {openSections.important &&
                data.importantIdeas.map((it) => (
                  <ParkingIdeaRow
                    key={it.id}
                    item={it}
                    t={t}
                    onRateIdea={onRateIdea}
                    onSyncSingleToDocs={onSyncSingleToDocs}
                    onDeleteEntry={onDeleteEntry}
                  />
                ))}
            </>
          )}

          {data.unimportantIdeas.length > 0 && (
            <>
              <button
                type="button"
                className="parking-section-title"
                onClick={() => toggleSection("unimportant")}
              >
                <span>{t.parkingUnimportantIdeas} ({data.unimportantIdeas.length})</span>
                <span>{openSections.unimportant ? "▾" : "▸"}</span>
              </button>
              {openSections.unimportant &&
                data.unimportantIdeas.map((it) => (
                  <ParkingIdeaRow
                    key={it.id}
                    item={it}
                    t={t}
                    onRateIdea={onRateIdea}
                    onSyncSingleToDocs={onSyncSingleToDocs}
                    onDeleteEntry={onDeleteEntry}
                  />
                ))}
            </>
          )}

          {data.screenshotNotes.length > 0 && (
            <>
              <button
                type="button"
                className="parking-section-title"
                onClick={() => toggleSection("screenshots")}
              >
                <span>{t.parkingScreenshotNotes} ({data.screenshotNotes.length})</span>
                <span>{openSections.screenshots ? "▾" : "▸"}</span>
              </button>
              {openSections.screenshots &&
                data.screenshotNotes.map((it) => (
                  <ParkingScreenshotRow
                    key={it.id}
                    item={it}
                    t={t}
                    onOpenLightbox={onOpenLightbox}
                    onSyncSingleToDocs={onSyncSingleToDocs}
                    onDeleteEntry={onDeleteEntry}
                  />
                ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function formatEntryClock(iso: string): string {
  const dt = new Date(iso);
  if (!Number.isNaN(dt.getTime())) {
    const h = String(dt.getHours()).padStart(2, "0");
    const m = String(dt.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  return iso.slice(11, 16) || "--:--";
}

function uniqueJoined(
  values: (string | null | undefined)[],
  limit = 3,
): string {
  const seen: string[] = [];
  for (const raw of values) {
    const val = (raw || "").trim();
    if (!val || seen.includes(val)) continue;
    seen.push(val);
    if (seen.length >= limit) break;
  }
  return seen.length > 0 ? seen.join(", ") : "—";
}

function parseEntryLocalHour(iso: string): number | null {
  const dt = new Date(iso);
  if (!Number.isNaN(dt.getTime())) {
    return dt.getHours() + dt.getMinutes() / 60 + dt.getSeconds() / 3600;
  }
  const hh = Number(iso.slice(11, 13));
  const mm = Number(iso.slice(14, 16));
  if (Number.isFinite(hh) && Number.isFinite(mm)) {
    return hh + mm / 60;
  }
  return null;
}

export function matchSessionStoryEntries(
  entries: WorkStoryEntry[],
  session: TimelineSessionItem,
): WorkStoryEntry[] {
  if (session.mode !== "work" || entries.length === 0) return [];
  const matched = entries.filter((e) => {
    const hour = parseEntryLocalHour(e.created_at);
    if (hour === null) return false;
    return hour >= session.startHour - 0.02 && hour <= session.endHour + 0.02;
  });
  return matched.sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
  );
}

export function buildSessionStoryTooltip(
  session: TimelineSessionItem,
  frames: WorkStoryEntry[],
  t: Translations,
  durationLabel: string,
): string {
  const label = session.tag || (session.mode === "work" ? t.work : t.break);
  const title = `${label} (${session.timeRangeLabel} • ${durationLabel})`;
  if (frames.length === 0) {
    const reasonLine = session.reason ? `\n🎯 ${session.reason}` : "";
    return `${title}${reasonLine}\n📸 ${t.workStoryEmpty}`;
  }
  const topicsSummary = uniqueJoined([
    session.tag,
    ...frames.map((f) => f.work_tag),
  ]);
  const contextsSummary = uniqueJoined([
    session.reason,
    ...frames.map((f) => f.context_text),
  ]);
  const appsSummary = uniqueJoined(frames.map((f) => f.note || f.active_app));
  return t.storyHoverTooltip(
    title,
    topicsSummary,
    contextsSummary,
    appsSummary,
    frames.length,
  );
}

export interface SessionStorySlideshowProps {
  sessionId: number;
  title: string;
  frames: WorkStoryEntry[];
  t: Translations;
  emptyMessage: string;
  onOpenFullscreen: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
  ) => void;
  onClose: () => void;
}

export function SessionStorySlideshow({
  sessionId,
  title,
  frames,
  t,
  emptyMessage,
  onOpenFullscreen,
  onClose,
}: SessionStorySlideshowProps) {
  const [frameIdx, setFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    setFrameIdx(0);
    setIsPlaying(false);
  }, [sessionId]);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isPlaying, frames.length]);

  if (frames.length === 0) {
    return (
      <div className="story-slideshow-box">
        <div className="story-slideshow-top">
          <span className="story-slideshow-title">🎬 {title}</span>
          <button type="button" className="tag-icon-btn" onClick={onClose}>
            <IconClose size={11} />
          </button>
        </div>
        <div
          style={{
            fontSize: "9.5px",
            color: "#a1a1aa",
            textAlign: "center",
            padding: "8px",
          }}
        >
          {emptyMessage}
        </div>
      </div>
    );
  }

  const safeIdx = Math.min(frameIdx, frames.length - 1);
  const currentFrame = frames[safeIdx];

  return (
    <div className="story-slideshow-box">
      <div className="story-slideshow-top">
        <span className="story-slideshow-title">
          🎬 {title} ({t.storyFramesCount(frames.length)})
        </span>
        <div className="story-slideshow-controls">
          {frames.length > 1 && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? t.storyPauseBtn : t.storyPlayBtn}
            </button>
          )}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onOpenFullscreen(currentFrame, frames)}
          >
            {t.storyFullscreenBtn}
          </button>
          <button type="button" className="tag-icon-btn" onClick={onClose}>
            <IconClose size={11} />
          </button>
        </div>
      </div>

      <div className="story-slideshow-stage">
        {frames.length > 1 && (
          <button
            type="button"
            className="story-slide-nav prev"
            onClick={() => {
              setIsPlaying(false);
              setFrameIdx((safeIdx - 1 + frames.length) % frames.length);
            }}
          >
            <IconChevronLeft size={13} />
          </button>
        )}
        <img
          src={currentFrame.screenshot_data || ""}
          alt="pomodoro frame"
          className="story-slide-img"
          onClick={() => onOpenFullscreen(currentFrame, frames)}
        />
        {frames.length > 1 && (
          <button
            type="button"
            className="story-slide-nav next"
            onClick={() => {
              setIsPlaying(false);
              setFrameIdx((safeIdx + 1) % frames.length);
            }}
          >
            <IconChevronRight size={13} />
          </button>
        )}
        <span className="story-slide-counter">
          {safeIdx + 1}/{frames.length} •{" "}
          {formatEntryClock(currentFrame.created_at)}
        </span>
      </div>

      <div className="story-step-strip">
        {frames.map((fr, idx) => (
          <button
            key={fr.id}
            type="button"
            className={`story-step-pill ${idx === safeIdx ? "active" : ""}`}
            onClick={() => {
              setIsPlaying(false);
              setFrameIdx(idx);
            }}
            title={`${formatEntryClock(fr.created_at)} • ${fr.context_text || fr.active_app || ""}`}
          >
            {idx * 5 + 5}dk ({formatEntryClock(fr.created_at)})
          </button>
        ))}
      </div>

      <div className="story-slide-meta">
        {currentFrame.work_tag && <span>💼 {currentFrame.work_tag}</span>}
        {currentFrame.context_text && (
          <span>🎯 {currentFrame.context_text}</span>
        )}
        {(currentFrame.active_app || currentFrame.active_window) && (
          <span>
            🌐 {currentFrame.active_app || ""}
            {currentFrame.active_window
              ? ` — ${currentFrame.active_window}`
              : ""}
          </span>
        )}
        {currentFrame.note && <span>📝 {currentFrame.note}</span>}
      </div>
    </div>
  );
}
