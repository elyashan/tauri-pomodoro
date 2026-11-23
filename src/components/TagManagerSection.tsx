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
import { IconCheck, IconClose, IconEdit } from "./Icons";

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

const TAG_KIND_CLASS: Record<ManageableTagKind, string> = {
  work: "work",
  distraction_impulsive_task: "task",
  distraction_idea: "idea",
  distraction_internal: "internal",
  distraction_external: "external",
  ending: "ending",
  break_overtime: "overtime",
};

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
      <div className="settings-label-row">
        <span className="settings-label">{t.tagManagerTitle}</span>
        <span className="summary-section-count">{tags.length}</span>
      </div>

      <div className="tag-kind-pills">
        {TAG_MANAGER_KINDS.map((kind) => {
          const dotClass = TAG_KIND_CLASS[kind];
          return (
            <button
              key={kind}
              type="button"
              className={`tag-kind-pill ${selectedKind === kind ? "active" : ""}`}
              onClick={() => setSelectedKind(kind)}
              title={t.tagManagerKindLabels[kind]}
            >
              <span className={`tag-kind-dot kind-${dotClass}`} />
              <span>{t.tagManagerKindLabels[kind]}</span>
            </button>
          );
        })}
      </div>

      <div className="tag-manager-subhead">
        <span>{t.tagManagerKindLabels[selectedKind]}</span>
        <span className="tag-manager-subhint">{t.tagManagerHint}</span>
      </div>

      {tags.length === 0 ? (
        <div className="tag-manager-empty">{t.tagManagerEmpty}</div>
      ) : (
        <div className="tag-manager-list">
          {tags.map((item) =>
            editingId === item.id ? (
              <div key={item.id} className="tag-manager-row editing">
                <input
                  type="text"
                  className="tag-manager-edit-input"
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
                <div className="tag-manager-edit-actions">
                  <button
                    type="button"
                    className="tag-row-icon-btn save"
                    onClick={() => void handleSaveRename(item.id)}
                    title={t.add}
                  >
                    <IconCheck size={11} />
                  </button>
                  <button
                    type="button"
                    className="tag-row-icon-btn"
                    onClick={() => {
                      setEditingId(null);
                      setEditingDraft("");
                    }}
                    title={t.cancel}
                  >
                    <IconClose size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <div key={item.id} className="tag-manager-row">
                <button
                  type="button"
                  className="tag-manager-name-btn"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingDraft(item.name);
                  }}
                  title={t.tagManagerHint}
                >
                  <span className="tag-manager-name-text">{item.name}</span>
                </button>
                <div className="tag-manager-row-actions">
                  <button
                    type="button"
                    className="tag-row-icon-btn"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingDraft(item.name);
                    }}
                    title={t.tagManagerHint}
                  >
                    <IconEdit size={11} />
                  </button>
                  <button
                    type="button"
                    className="tag-row-icon-btn del"
                    onClick={() => void handleDelete(item.id)}
                    title={t.cancel}
                  >
                    <IconClose size={11} />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="tag-manager-add-row">
        <input
          type="text"
          className="tag-manager-add-input"
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
          className="primary-btn tag-manager-add-btn"
          onClick={() => void handleAdd()}
        >
          {t.add}
        </button>
      </div>
    </div>
  );
}
