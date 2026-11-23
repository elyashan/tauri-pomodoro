import type { TagItem } from "../../db";
import type { Translations } from "../../i18n";
import {
  InlineTagForm,
  PreviousReasonsChips,
  TagChipsSelector,
} from "../InlineTagForm";
import { IconCheck } from "../Icons";
import type { TagManagementHandlers } from "./types";

export interface WorkTopicModalProps extends TagManagementHandlers {
  t: Translations;
  workTags: TagItem[];
  selectedWorkTopicTag: string;
  workPrevReasons: string[];
  workTopicReasonText: string;
  isEditingWorkTags: boolean;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function WorkTopicModal({
  t,
  workTags,
  selectedWorkTopicTag,
  workPrevReasons,
  workTopicReasonText,
  isEditingWorkTags,
  tagForm,
  onChangeTagForm,
  onSubmitTagForm,
  onAddNewTag,
  onEditTagItem,
  onDeleteTagItem,
  onToggleEditTags,
  onSelectTag,
  onChangeReasonText,
  onSubmit,
  onCancel,
}: WorkTopicModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.whatAreYouWorkingOn}</span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("work")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button
            className={`ghost-btn ${isEditingWorkTags ? "active" : ""}`}
            onClick={onToggleEditTags}
          >
            {isEditingWorkTags ? (
              <>
                <IconCheck size={10} />
                <span>{t.editTags}</span>
              </>
            ) : (
              t.editTags
            )}
          </button>
        </div>
      </div>

      <div className="stop-box-body">
        <InlineTagForm
          kind="work"
          tagForm={tagForm}
          t={t}
          onChangeTagForm={onChangeTagForm}
          onSubmitTagForm={onSubmitTagForm}
        />

        <div className="section-subhead">{t.selectTagHint}</div>
        <TagChipsSelector
          tags={workTags}
          selectedTag={selectedWorkTopicTag}
          isEditing={isEditingWorkTags}
          kind="work"
          onSelectTag={onSelectTag}
          onEditTag={onEditTagItem}
          onDeleteTag={onDeleteTagItem}
        />

        <PreviousReasonsChips
          reasons={workPrevReasons}
          label={t.previousReasons}
          onSelectReason={onChangeReasonText}
        />

        <div className="new-reason-row">
          <textarea
            className="distract-textarea"
            rows={2}
            placeholder={t.workTopicPlaceholder}
            value={workTopicReasonText}
            autoFocus
            onChange={(e) => onChangeReasonText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
      </div>

      <div className="stop-box-actions" style={{ alignItems: "center" }}>
        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
          Tag: <b>{selectedWorkTopicTag}</b>
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="primary-btn" onClick={onSubmit}>
            {t.doneEditing}
          </button>
          <button onClick={onCancel}>{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}
