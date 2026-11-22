import { useEffect, useState } from "react";
import {
  TagItem,
  TagKind,
  addTag,
  deleteTag,
  getTags,
  updateTag,
} from "../db";
import type { Translations } from "../i18n";
import { IconCheck, IconClose } from "./Icons";

type ManageableTagKind = keyof Translations["tagManagerKindLabels"];

const TAG_MANAGER_KINDS: ManageableTagKind[] = [
  "work",
  "distraction_impulsive_task",
  "distraction_idea",
  "distraction_internal",
  "distraction_external",
  "ending",
  "break_overtime",
];

function getDefaultSeedsForKind(
  kind: ManageableTagKind,
  t: Translations,
): string[] {
  switch (kind) {
    case "work":
      return t.defaultWorkTags;
    case "ending":
      return t.defaultEndingTags;
    case "break_overtime":
      return t.defaultBreakOvertimeTags;
    case "distraction_impulsive_task":
      return t.defaultCategoryTags.impulsive_task;
    case "distraction_idea":
      return t.defaultCategoryTags.idea;
    case "distraction_internal":
      return t.defaultCategoryTags.internal;
    case "distraction_external":
      return t.defaultCategoryTags.external;
  }
}

export interface TagManagerSectionProps {
  t: Translations;
  onTagsChanged?: (kind: TagKind) => void;
}

export function TagManagerSection({
  t,
  onTagsChanged,
}: TagManagerSectionProps) {
  const [selectedKind, setSelectedKind] = useState<ManageableTagKind>("work");
  const [tags, setTags] = useState<TagItem[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState("");

  const reloadTags = async (kind: ManageableTagKind) => {
    const loaded = await getTags(kind, getDefaultSeedsForKind(kind, t));
    setTags(loaded);
  };

  useEffect(() => {
    setEditingId(null);
    setEditingDraft("");
    reloadTags(selectedKind).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKind, t]);

  const handleAdd = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    await addTag(trimmed, selectedKind);
    setNewTagName("");
    await reloadTags(selectedKind);
    onTagsChanged?.(selectedKind);
  };

  const handleSaveRename = async (id: number) => {
    const trimmed = editingDraft.trim();
    if (trimmed) {
      await updateTag(id, trimmed, selectedKind);
      await reloadTags(selectedKind);
      onTagsChanged?.(selectedKind);
    }
    setEditingId(null);
    setEditingDraft("");
  };

  const handleDelete = async (id: number) => {
    await deleteTag(id);
    if (editingId === id) {
      setEditingId(null);
      setEditingDraft("");
    }
    await reloadTags(selectedKind);
    onTagsChanged?.(selectedKind);
  };

  return (
    <div className="settings-section no-drag">
      <div className="settings-label">{t.tagManagerTitle}</div>
      <div className="release-cmd-hint">{t.tagManagerHint}</div>

      <div className="penalty-selector tag-kind-grid">
        {TAG_MANAGER_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`penalty-btn ${selectedKind === kind ? "active" : ""}`}
            onClick={() => setSelectedKind(kind)}
            title={t.tagManagerKindLabels[kind]}
          >
            {t.tagManagerKindLabels[kind]}
          </button>
        ))}
      </div>

      {tags.length === 0 ? (
        <div className="release-cmd-hint" style={{ padding: "4px 2px" }}>
          {t.tagManagerEmpty}
        </div>
      ) : (
        <div className="break-reminder-chips-wrap">
          {tags.map((item) =>
            editingId === item.id ? (
              <span key={item.id} className="break-reminder-chip editing">
                <input
                  type="text"
                  className="plan-text-input tag-inline-rename-input"
                  value={editingDraft}
                  autoFocus
                  maxLength={28}
                  onChange={(e) => setEditingDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSaveRename(item.id);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                      setEditingDraft("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="break-reminder-chip-del save"
                  onClick={() => void handleSaveRename(item.id)}
                  title={t.add}
                >
                  <IconCheck size={9} />
                </button>
              </span>
            ) : (
              <span key={item.id} className="break-reminder-chip">
                <button
                  type="button"
                  className="tag-chip-rename-trigger"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingDraft(item.name);
                  }}
                  title={t.tagManagerHint}
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  className="break-reminder-chip-del"
                  onClick={() => void handleDelete(item.id)}
                  title={t.cancel}
                >
                  <IconClose size={9} />
                </button>
              </span>
            ),
          )}
        </div>
      )}

      <div className="checklist-add-row">
        <input
          type="text"
          className="plan-text-input"
          placeholder={t.tagManagerAddPlaceholder}
          value={newTagName}
          maxLength={28}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
        />
        <button
          type="button"
          className="primary-btn"
          style={{ fontSize: "10px", padding: "4px 10px" }}
          onClick={() => void handleAdd()}
        >
          {t.add}
        </button>
      </div>
    </div>
  );
}
