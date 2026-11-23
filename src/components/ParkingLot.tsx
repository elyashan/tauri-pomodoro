import { useEffect, useState } from "react";
import type {
  ParkingBucket,
  ParkingItem,
  ParkingLotData,
  TimelineSessionItem,
  WorkStoryEntry,
} from "../db";
import type { Translations } from "../i18n";
import {
  IconArchive,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconClose,
  IconRestore,
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

function ParkingBucketButtons({
  item,
  t,
  onChangeBucket,
}: {
  item: ParkingItem;
  t: Translations;
  onChangeBucket?: (id: number, bucket: ParkingBucket) => void;
}) {
  if (!onChangeBucket) return null;
  const cur: ParkingBucket = item.bucket || "today";
  return (
    <div className="parking-bucket-actions">
      {cur !== "today" && (
        <button
          type="button"
          className="parking-bucket-icon-btn"
          onClick={() => onChangeBucket(item.id, "today")}
          title={t.moveToToday}
        >
          <IconRestore size={10} />
        </button>
      )}
      {cur !== "maybe" && (
        <button
          type="button"
          className="parking-bucket-icon-btn"
          onClick={() => onChangeBucket(item.id, "maybe")}
          title={t.moveToMaybe}
        >
          <IconClock size={10} />
        </button>
      )}
      {cur !== "archived" && (
        <button
          type="button"
          className="parking-bucket-icon-btn"
          onClick={() => onChangeBucket(item.id, "archived")}
          title={t.moveToArchive}
        >
          <IconArchive size={10} />
        </button>
      )}
    </div>
  );
}

export interface ParkingTaskRowProps {
  item: ParkingItem;
  isDone: boolean;
  t: Translations;
  onToggleTask: (id: number, done: boolean) => void;
  onDeleteEntry: (id: number) => void;
  onChangeBucket?: (id: number, bucket: ParkingBucket) => void;
}

export function ParkingTaskRow({
  item,
  isDone,
  t,
  onToggleTask,
  onDeleteEntry,
  onChangeBucket,
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
        <ParkingBucketButtons
          item={item}
          t={t}
          onChangeBucket={onChangeBucket}
        />
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
  onDeleteEntry: (id: number) => void;
  onChangeBucket?: (id: number, bucket: ParkingBucket) => void;
  showUnimportantBtn?: boolean;
}

export function ParkingIdeaRow({
  item,
  t,
  onRateIdea,
  onDeleteEntry,
  onChangeBucket,
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
        <ParkingBucketButtons
          item={item}
          t={t}
          onChangeBucket={onChangeBucket}
        />
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
  onOpenLightbox: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
    source?: "story" | "parking",
  ) => void;
  onDeleteEntry: (id: number) => void;
  onChangeBucket?: (id: number, bucket: ParkingBucket) => void;
}

export function ParkingScreenshotRow({
  item,
  t,
  onOpenLightbox,
  onDeleteEntry,
  onChangeBucket,
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
            onOpenLightbox(
              {
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
              },
              undefined,
              "parking",
            )
          }
        />
      )}
      <span className="parking-todo-text">{item.content}</span>
      <div className="parking-row-right">
        <ParkingBucketButtons
          item={item}
          t={t}
          onChangeBucket={onChangeBucket}
        />
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
  onToggleTask: (id: number, done: boolean) => void;
  onRateIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteEntry: (id: number) => void;
  onOpenLightbox: (
    entry: WorkStoryEntry,
    groupFrames?: WorkStoryEntry[],
    source?: "story" | "parking",
  ) => void;
  onChangeBucket?: (id: number, bucket: ParkingBucket) => void;
  onBreakLayoutChange?: (openRows: number, sections: number) => void;
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
  onToggleTask,
  onRateIdea,
  onDeleteEntry,
  onOpenLightbox,
  onChangeBucket,
  onBreakLayoutChange,
}: ParkingLotPanelProps) {
  const [activeBucket, setActiveBucket] = useState<ParkingBucket>("today");
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

  useEffect(() => {
    if (!isBreakView || !onBreakLayoutChange) return;
    const defs: [ParkingSectionKey, number][] = [
      ["pending", data.pendingTasks.length],
      ["done", data.doneTasks.length],
      ["unrated", data.unratedIdeas.length],
      ["important", data.importantIdeas.length],
      ["unimportant", data.unimportantIdeas.length],
      ["screenshots", data.screenshotNotes.length],
    ];
    let sections = 0;
    let openRows = 0;
    for (const [k, len] of defs) {
      if (len > 0) {
        sections += 1;
        if (openSections[k]) openRows += len;
      }
    }
    onBreakLayoutChange(openRows, sections);
  }, [
    isBreakView,
    onBreakLayoutChange,
    openSections,
    data.pendingTasks.length,
    data.doneTasks.length,
    data.unratedIdeas.length,
    data.importantIdeas.length,
    data.unimportantIdeas.length,
    data.screenshotNotes.length,
  ]);

  const toggleSection = (key: ParkingSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const todayCount =
    data.totalTasks + data.totalIdeas + data.totalScreenshots;
  const maybeCount =
    (data.maybeTasks?.length ?? 0) + (data.maybeIdeas?.length ?? 0);
  const archivedCount = data.archivedItems?.length ?? 0;
  const effectiveBucket: ParkingBucket = isBreakView ? "today" : activeBucket;

  const renderGenericItemRow = (it: ParkingItem) => {
    if (it.item_type === "task") {
      return (
        <ParkingTaskRow
          key={it.id}
          item={it}
          isDone={it.status === "done"}
          t={t}
          onToggleTask={onToggleTask}
          onDeleteEntry={onDeleteEntry}
          onChangeBucket={onChangeBucket}
        />
      );
    }
    if (it.item_type === "screenshot") {
      return (
        <ParkingScreenshotRow
          key={it.id}
          item={it}
          t={t}
          onOpenLightbox={onOpenLightbox}
          onDeleteEntry={onDeleteEntry}
          onChangeBucket={onChangeBucket}
        />
      );
    }
    return (
      <ParkingIdeaRow
        key={it.id}
        item={it}
        t={t}
        onRateIdea={onRateIdea}
        onDeleteEntry={onDeleteEntry}
        onChangeBucket={onChangeBucket}
      />
    );
  };

  return (
    <>
      {!isBreakView && (
        <div className="parking-bucket-tabs">
          <button
            type="button"
            className={`parking-bucket-tab ${effectiveBucket === "today" ? "active" : ""}`}
            onClick={() => setActiveBucket("today")}
          >
            {t.parkingBucketToday} ({todayCount})
          </button>
          <button
            type="button"
            className={`parking-bucket-tab ${effectiveBucket === "maybe" ? "active" : ""}`}
            onClick={() => setActiveBucket("maybe")}
          >
            {t.parkingBucketMaybe} ({maybeCount})
          </button>
          <button
            type="button"
            className={`parking-bucket-tab ${effectiveBucket === "archived" ? "active" : ""}`}
            onClick={() => setActiveBucket("archived")}
          >
            {t.parkingBucketArchived} ({archivedCount})
          </button>
        </div>
      )}

      {effectiveBucket === "maybe" ? (
        maybeCount === 0 ? (
          <div className="parking-empty-hint">{t.parkingMaybeEmpty}</div>
        ) : (
          <>
            {(data.maybeTasks || []).map(renderGenericItemRow)}
            {(data.maybeIdeas || []).map(renderGenericItemRow)}
          </>
        )
      ) : effectiveBucket === "archived" ? (
        archivedCount === 0 ? (
          <div className="parking-empty-hint">{t.parkingArchivedEmpty}</div>
        ) : (
          (data.archivedItems || []).map(renderGenericItemRow)
        )
      ) : todayCount === 0 ? (
        <div className="parking-empty-hint">{t.parkingEmpty}</div>
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
                <span className="parking-section-chevron">{openSections.pending ? "▾" : "▸"}</span>
              </button>
              {openSections.pending &&
                data.pendingTasks.map((it) => (
                  <ParkingTaskRow
                    key={it.id}
                    item={it}
                    isDone={false}
                    t={t}
                    onToggleTask={onToggleTask}
                    onDeleteEntry={onDeleteEntry}
                    onChangeBucket={onChangeBucket}
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
                <span className="parking-section-chevron">{openSections.done ? "▾" : "▸"}</span>
              </button>
              {openSections.done &&
                data.doneTasks.map((it) => (
                  <ParkingTaskRow
                    key={it.id}
                    item={it}
                    isDone={true}
                    t={t}
                    onToggleTask={onToggleTask}
                    onDeleteEntry={onDeleteEntry}
                    onChangeBucket={onChangeBucket}
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
                <span className="parking-section-chevron">{openSections.unrated ? "▾" : "▸"}</span>
              </button>
              {openSections.unrated &&
                data.unratedIdeas.map((it) => (
                  <ParkingIdeaRow
                    key={it.id}
                    item={it}
                    t={t}
                    onRateIdea={onRateIdea}
                    onDeleteEntry={onDeleteEntry}
                    onChangeBucket={onChangeBucket}
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
                <span className="parking-section-chevron">{openSections.important ? "▾" : "▸"}</span>
              </button>
              {openSections.important &&
                data.importantIdeas.map((it) => (
                  <ParkingIdeaRow
                    key={it.id}
                    item={it}
                    t={t}
                    onRateIdea={onRateIdea}
                    onDeleteEntry={onDeleteEntry}
                    onChangeBucket={onChangeBucket}
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
                <span className="parking-section-chevron">{openSections.unimportant ? "▾" : "▸"}</span>
              </button>
              {openSections.unimportant &&
                data.unimportantIdeas.map((it) => (
                  <ParkingIdeaRow
                    key={it.id}
                    item={it}
                    t={t}
                    onRateIdea={onRateIdea}
                    onDeleteEntry={onDeleteEntry}
                    onChangeBucket={onChangeBucket}
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
                <span className="parking-section-chevron">{openSections.screenshots ? "▾" : "▸"}</span>
              </button>
              {openSections.screenshots &&
                data.screenshotNotes.map((it) => (
                  <ParkingScreenshotRow
                    key={it.id}
                    item={it}
                    t={t}
                    onOpenLightbox={onOpenLightbox}
                    onDeleteEntry={onDeleteEntry}
                    onChangeBucket={onChangeBucket}
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

export function matchSessionStoryEntries(
  entries: WorkStoryEntry[],
  session: TimelineSessionItem,
): WorkStoryEntry[] {
  if (session.mode !== "work" || entries.length === 0) return [];
  const startMs = new Date(session.startedAt).getTime();
  const endMs = new Date(session.endedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
  const matched = entries.filter((e) => {
    const entryMs = new Date(e.created_at).getTime();
    if (!Number.isFinite(entryMs)) return false;
    return entryMs >= startMs - 90_000 && entryMs <= endMs + 90_000;
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
  extraMeta?: string | null,
): string {
  const label = session.tag || (session.mode === "work" ? t.work : t.break);
  const title = `${label} (${session.timeRangeLabel} • ${durationLabel})`;
  const metaLine = extraMeta?.trim() ? `\n📋 ${extraMeta.trim()}` : "";
  if (frames.length === 0) {
    const reasonLine = session.reason ? `\n🎯 ${session.reason}` : "";
    return `${title}${metaLine}${reasonLine}\n📸 ${t.workStoryEmpty}`;
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
  const body = t.storyHoverTooltip(
    title,
    topicsSummary,
    contextsSummary,
    appsSummary,
    frames.length,
  );
  if (!metaLine) return body;
  const nlIdx = body.indexOf("\n");
  return nlIdx >= 0
    ? `${body.slice(0, nlIdx)}${metaLine}${body.slice(nlIdx)}`
    : `${body}${metaLine}`;
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
          <span className="story-slideshow-title">{title}</span>
          <button type="button" className="tag-icon-btn" onClick={onClose}>
            <IconClose size={11} />
          </button>
        </div>
        <div
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
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
          {title} ({t.storyFramesCount(frames.length)})
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
        {frames.map((fr, idx) => {
          const minsLabel =
            fr.elapsed_work_sec > 0
              ? Math.max(1, Math.round(fr.elapsed_work_sec / 60))
              : (idx + 1) * 5;
          return (
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
              {minsLabel}dk ({formatEntryClock(fr.created_at)})
            </button>
          );
        })}
      </div>

      <div className="story-slide-meta">
        {currentFrame.work_tag && <span>{currentFrame.work_tag}</span>}
        {currentFrame.context_text && <span>{currentFrame.context_text}</span>}
        {(currentFrame.active_app || currentFrame.active_window) && (
          <span>
            {currentFrame.active_app || ""}
            {currentFrame.active_window
              ? ` — ${currentFrame.active_window}`
              : ""}
          </span>
        )}
        {currentFrame.note && <span>{currentFrame.note}</span>}
      </div>
    </div>
  );
}
