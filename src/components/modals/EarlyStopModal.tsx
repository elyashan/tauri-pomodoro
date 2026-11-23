import type { TagItem } from "../../db";
import type { Translations } from "../../i18n";
import {
  InlineTagForm,
  PreviousReasonsChips,
  TagChipsSelector,
} from "../InlineTagForm";
import type { TagManagementHandlers } from "./types";

export interface EarlyStopModalProps extends TagManagementHandlers {
  t: Translations;
  workElapsedSec: number;
  endingTags: TagItem[];
  selectedEndingTag: string;
  endingPreviousReasons: string[];
  endingReasonText: string;
  isEditingEndingTags: boolean;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmitWithTag: (withTag: boolean) => void;
  onCancel: () => void;
}

export function EarlyStopModal({
  t,
  workElapsedSec,
  endingTags,
  selectedEndingTag,
  endingPreviousReasons,
  endingReasonText,
  isEditingEndingTags,
  tagForm,
  onChangeTagForm,
  onSubmitTagForm,
  onAddNewTag,
  onEditTagItem,
  onDeleteTagItem,
  onToggleEditTags,
  onSelectTag,
  onChangeReasonText,
  onSubmitWithTag,
  onCancel,
}: EarlyStopModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.earlyStopTitle}</span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("ending")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button className="ghost-btn" onClick={onToggleEditTags}>
            {isEditingEndingTags ? t.doneEditing : t.editTags}
          </button>
        </div>
      </div>
      <div className="stop-box-hint">
        {t.earlyStopWorkedTime(Math.floor(workElapsedSec / 60))}
      </div>

      <InlineTagForm
        kind="ending"
        tagForm={tagForm}
        t={t}
        onChangeTagForm={onChangeTagForm}
        onSubmitTagForm={onSubmitTagForm}
      />

      <TagChipsSelector
        tags={endingTags}
        selectedTag={selectedEndingTag}
        isEditing={isEditingEndingTags}
        kind="ending"
        onSelectTag={onSelectTag}
        onEditTag={onEditTagItem}
        onDeleteTag={onDeleteTagItem}
      />

      <PreviousReasonsChips
        reasons={endingPreviousReasons}
        label={t.previousReasons}
        onSelectReason={onChangeReasonText}
      />

      <div className="new-reason-row">
        <textarea
          className="distract-textarea"
          rows={2}
          placeholder={t.endingExplanationPlaceholder}
          value={endingReasonText}
          autoFocus
          onChange={(e) => onChangeReasonText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmitWithTag(true);
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        <button className="primary-btn" onClick={() => onSubmitWithTag(true)}>
          {t.addAndFinish}
        </button>
      </div>

      <div className="stop-box-actions">
        <button className="ghost-btn" onClick={() => onSubmitWithTag(false)}>
          {t.finishWithoutTag}
        </button>
        <button onClick={onCancel}>{t.cancelReturn}</button>
      </div>
    </div>
  );
}
