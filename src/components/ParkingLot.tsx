import type { ParkingItem, ParkingLotData, WorkStoryEntry } from "../db";
import type { Translations } from "../i18n";

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
          {item.keep_synced ? "✓" : "📄"}
        </button>
        <button
          type="button"
          className="tag-icon-btn del-btn"
          onClick={() => onDeleteEntry(item.id)}
          title={t.cancel}
        >
          ✕
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
          {item.keep_synced ? "✓" : "📄"}
        </button>
        <button
          type="button"
          className="tag-icon-btn del-btn"
          onClick={() => onDeleteEntry(item.id)}
          title={t.cancel}
        >
          ✕
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
          {item.keep_synced ? "✓" : "📄"}
        </button>
        <button
          type="button"
          className="tag-icon-btn del-btn"
          onClick={() => onDeleteEntry(item.id)}
          title={t.cancel}
        >
          ✕
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
  const totalAllCount =
    data.totalTasks + data.totalIdeas + data.totalScreenshots;

  return (
    <>
      <div className="parking-header-bar">
        {isBreakView ? (
          <div className="parking-banner-title">
            {t.parkingBreakBannerTitle}
          </div>
        ) : (
          <span className="section-subhead">
            {t.parkingTab} ({totalAllCount})
          </span>
        )}
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
            📄 Docs
          </button>
        </div>
      </div>

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
              <div className="parking-section-title">
                {t.parkingPendingTasks} ({data.pendingTasks.length})
              </div>
              {data.pendingTasks.map((it) => (
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
              <div className="parking-section-title">
                {t.parkingDoneTasks} ({data.doneTasks.length})
              </div>
              {data.doneTasks.map((it) => (
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
              <div className="parking-section-title">
                {t.parkingUnratedIdeas} ({data.unratedIdeas.length})
              </div>
              {data.unratedIdeas.map((it) => (
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
              <div className="parking-section-title">
                {t.parkingImportantIdeas} ({data.importantIdeas.length})
              </div>
              {data.importantIdeas.map((it) => (
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
              <div className="parking-section-title">
                {t.parkingUnimportantIdeas} ({data.unimportantIdeas.length})
              </div>
              {data.unimportantIdeas.map((it) => (
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
              <div className="parking-section-title">
                {t.parkingScreenshotNotes} ({data.screenshotNotes.length})
              </div>
              {data.screenshotNotes.map((it) => (
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

export interface WorkStoryGridProps {
  entries: WorkStoryEntry[];
  emptyMessage: string;
  emptyClassName?: string;
  onSelectEntry: (entry: WorkStoryEntry) => void;
}

export function WorkStoryGrid({
  entries,
  emptyMessage,
  emptyClassName,
  onSelectEntry,
}: WorkStoryGridProps) {
  if (entries.length === 0) {
    return emptyClassName ? (
      <div className={emptyClassName}>{emptyMessage}</div>
    ) : (
      <div
        style={{
          fontSize: "10px",
          color: "#a1a1aa",
          textAlign: "center",
          padding: "12px",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="work-story-grid">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="work-story-card"
          onClick={() => onSelectEntry(entry)}
        >
          <img
            src={entry.screenshot_data || ""}
            alt="screenshot"
            className="work-story-thumb"
            loading="lazy"
          />
          <div className="work-story-meta">
            <span className="work-story-time">
              {entry.created_at.slice(11, 16)} •{" "}
              {entry.entry_type === "periodic" ? "⏱ 5dk" : "📸 SS"}
            </span>
            {entry.active_app && (
              <span
                className="work-story-app"
                title={entry.active_window || entry.active_app}
              >
                🌐 {entry.active_app}
              </span>
            )}
            {entry.context_text && (
              <span className="work-story-ctx" title={entry.context_text}>
                🎯 {entry.context_text}
              </span>
            )}
            {entry.note && (
              <span className="work-story-note" title={entry.note}>
                {entry.note}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
