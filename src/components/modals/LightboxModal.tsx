import { useEffect, useState } from "react";
import type { WorkStoryEntry } from "../../db";
import type { Translations } from "../../i18n";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconTrash,
} from "../Icons";

export interface LightboxModalProps {
  entry: WorkStoryEntry;
  entries?: WorkStoryEntry[];
  t: Translations;
  onSelectEntry?: (entry: WorkStoryEntry) => void;
  onClose: () => void;
  onDelete: (id: number) => void;
}

export function LightboxModal({
  entry,
  entries,
  t,
  onSelectEntry,
  onClose,
  onDelete,
}: LightboxModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const groupList = entries && entries.length > 1 ? entries : null;
  const curIdx = groupList
    ? Math.max(
        0,
        groupList.findIndex((item) => item.id === entry.id),
      )
    : 0;

  useEffect(() => {
    if (!isPlaying || !groupList || !onSelectEntry) return;
    const timer = window.setInterval(() => {
      onSelectEntry(groupList[(curIdx + 1) % groupList.length]);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isPlaying, groupList, curIdx, onSelectEntry]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && groupList && onSelectEntry) {
        e.preventDefault();
        setIsPlaying(false);
        onSelectEntry(
          groupList[(curIdx - 1 + groupList.length) % groupList.length],
        );
      } else if (e.key === "ArrowRight" && groupList && onSelectEntry) {
        e.preventDefault();
        setIsPlaying(false);
        onSelectEntry(groupList[(curIdx + 1) % groupList.length]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, groupList, onSelectEntry, curIdx]);

  return (
    <div className="lightbox-overlay no-drag" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-header">
          <span className="lightbox-title">
            {new Date(entry.created_at).toLocaleString()}
            {groupList ? ` (${curIdx + 1}/${groupList.length})` : ""}
          </span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {groupList && onSelectEntry && (
              <>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setIsPlaying(false);
                    onSelectEntry(
                      groupList[(curIdx - 1 + groupList.length) % groupList.length],
                    );
                  }}
                >
                  <IconChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setIsPlaying((p) => !p)}
                >
                  {isPlaying ? t.storyPauseBtn : t.storyPlayBtn}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setIsPlaying(false);
                    onSelectEntry(groupList[(curIdx + 1) % groupList.length]);
                  }}
                >
                  <IconChevronRight size={12} />
                </button>
              </>
            )}
            <button
              type="button"
              className="tag-icon-btn del-btn"
              onClick={() => onDelete(entry.id)}
              title={t.cancel}
            >
              <IconTrash size={12} />
            </button>
            <button type="button" className="tag-icon-btn" onClick={onClose}>
              <IconClose size={12} />
            </button>
          </div>
        </div>
        <div className="lightbox-img-wrap">
          <img
            src={entry.screenshot_data || ""}
            alt="full screenshot"
            className="lightbox-img"
          />
        </div>
        <div className="lightbox-footer">
          {entry.work_tag && (
            <div className="lightbox-meta-item">
              <b>{t.topicShortLabel}:</b> {entry.work_tag}
            </div>
          )}
          {entry.context_text && (
            <div className="lightbox-meta-item">
              <b>{t.contextShortLabel}:</b> {entry.context_text}
            </div>
          )}
          {entry.active_app && (
            <div className="lightbox-meta-item">
              <b>{t.qcActiveTabLabel}:</b> {entry.active_app}
              {entry.active_window ? ` — ${entry.active_window}` : ""}
            </div>
          )}
          {entry.note && (
            <div className="lightbox-meta-item">
              <b>{t.lightboxNoteLabel}</b> {entry.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
