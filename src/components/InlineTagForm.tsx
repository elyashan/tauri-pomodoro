import type { TagItem, TagKind } from "../db";
import type { Translations } from "../i18n";
import type { TagFormState } from "../constants";

export interface InlineTagFormProps {
  kind: TagKind;
  tagForm: TagFormState | null;
  t: Translations;
  onChangeTagForm: (next: TagFormState | null) => void;
  onSubmitTagForm: () => void;
}

export function InlineTagForm({
  kind,
  tagForm,
  t,
  onChangeTagForm,
  onSubmitTagForm,
}: InlineTagFormProps) {
  if (!tagForm || tagForm.kind !== kind) return null;

  if (tagForm.mode === "delete") {
    return (
      <div className="inline-tag-form delete-mode">
        <span
          className="inline-tag-label"
          title={t.deleteTagConfirm(tagForm.currentName || "")}
        >
          {t.deleteTagConfirm(tagForm.currentName || "")}
        </span>
        <button className="warn-btn" onClick={onSubmitTagForm}>
          ✓
        </button>
        <button onClick={() => onChangeTagForm(null)}>{t.cancel}</button>
      </div>
    );
  }

  return (
    <div className="inline-tag-form">
      <input
        className="inline-tag-input"
        placeholder={
          tagForm.mode === "add"
            ? t.newTagPrompt
            : t.editTagPrompt(tagForm.currentName || "")
        }
        value={tagForm.value}
        autoFocus
        onChange={(e) => onChangeTagForm({ ...tagForm, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmitTagForm();
          if (e.key === "Escape") onChangeTagForm(null);
        }}
      />
      <button className="primary-btn" onClick={onSubmitTagForm}>
        {tagForm.mode === "add" ? t.add : t.doneEditing}
      </button>
      <button onClick={() => onChangeTagForm(null)}>{t.cancel}</button>
    </div>
  );
}

export interface TagChipsSelectorProps {
  tags: TagItem[];
  selectedTag: string;
  isEditing: boolean;
  kind: TagKind;
  onSelectTag: (tagName: string) => void;
  onEditTag: (tagId: number, currentName: string, kind: TagKind) => void;
  onDeleteTag: (tagId: number, name: string, kind: TagKind) => void;
}

export function TagChipsSelector({
  tags,
  selectedTag,
  isEditing,
  kind,
  onSelectTag,
  onEditTag,
  onDeleteTag,
}: TagChipsSelectorProps) {
  return (
    <div className="reason-chips stop-chips">
      {tags.map((tag) => {
        const isSelected = selectedTag === tag.name;
        return (
          <div
            key={tag.id}
            className={`tag-chip-wrap ${isSelected ? "selected" : ""}`}
          >
            <button
              className="tag-chip-btn"
              onClick={() => onSelectTag(tag.name)}
            >
              {tag.name}
            </button>
            {isEditing && (
              <span className="tag-actions">
                <button
                  className="tag-icon-btn"
                  onClick={() => onEditTag(tag.id, tag.name, kind)}
                >
                  ✎
                </button>
                <button
                  className="tag-icon-btn del-btn"
                  onClick={() => onDeleteTag(tag.id, tag.name, kind)}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface PreviousReasonsChipsProps {
  reasons: string[];
  label: string;
  onSelectReason: (reason: string) => void;
}

export function PreviousReasonsChips({
  reasons,
  label,
  onSelectReason,
}: PreviousReasonsChipsProps) {
  const topFive = reasons.slice(0, 5);
  if (topFive.length === 0) return null;
  return (
    <div className="previous-reasons-box">
      <div className="section-subhead">{label}</div>
      <div className="previous-reasons-chips">
        {topFive.map((r) => (
          <button
            key={r}
            className="reason-suggestion-chip"
            title={r}
            onClick={() => onSelectReason(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
