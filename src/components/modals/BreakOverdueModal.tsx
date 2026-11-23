import type { TagItem } from "../../db";
import type { Translations } from "../../i18n";
import { formatClock } from "../../constants";
import {
  InlineTagForm,
  PreviousReasonsChips,
  TagChipsSelector,
} from "../InlineTagForm";
import type { TagManagementHandlers } from "./types";

export interface BreakOverdueModalProps extends TagManagementHandlers {
  t: Translations;
  source?: "break" | "work_pause";
  totalOvertimeSec: number;
  breakOverdueTags: TagItem[];
  selectedBreakOverdueTag: string;
  breakOverduePrevReasons: string[];
  breakOverdueReasonText: string;
  isEditingBreakOverdueTags: boolean;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmit: (skipReason: boolean) => void;
}

export function BreakOverdueModal({
  t,
  source = "break",
  totalOvertimeSec,
  breakOverdueTags,
  selectedBreakOverdueTag,
  breakOverduePrevReasons,
  breakOverdueReasonText,
  isEditingBreakOverdueTags,
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
}: BreakOverdueModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">
          {source === "work_pause"
            ? t.workPauseOverdueTitle
            : t.breakOverdueTitle}
        </span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("break_overtime")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button className="ghost-btn" onClick={onToggleEditTags}>
            {isEditingBreakOverdueTags ? t.doneEditing : t.editTags}
          </button>
        </div>
      </div>

      <div className="stop-box-body">
        <div className="stop-box-hint">
          {source === "work_pause"
            ? t.workPauseOverdueDesc(formatClock(totalOvertimeSec))
            : t.breakOverdueDesc(formatClock(totalOvertimeSec))}
        </div>

        <InlineTagForm
          kind="break_overtime"
          tagForm={tagForm}
          t={t}
          onChangeTagForm={onChangeTagForm}
          onSubmitTagForm={onSubmitTagForm}
        />

        <TagChipsSelector
          tags={breakOverdueTags}
          selectedTag={selectedBreakOverdueTag}
          isEditing={isEditingBreakOverdueTags}
          kind="break_overtime"
          onSelectTag={onSelectTag}
          onEditTag={onEditTagItem}
          onDeleteTag={onDeleteTagItem}
        />

        <PreviousReasonsChips
          reasons={breakOverduePrevReasons}
          label={t.previousReasons}
          onSelectReason={onChangeReasonText}
        />

        <div className="new-reason-row">
          <textarea
            className="distract-textarea"
            rows={2}
            placeholder={t.distractExplanationPlaceholder}
            value={breakOverdueReasonText}
            autoFocus
            onChange={(e) => onChangeReasonText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(false);
              }
              if (e.key === "Escape") {
                onSubmit(true);
              }
            }}
          />
        </div>
      </div>

      <div className="stop-box-actions">
        <button className="primary-btn" onClick={() => onSubmit(false)}>
          {source === "work_pause" ? t.saveAndResumeWork : t.saveAndStartWork}
        </button>
        <button onClick={() => onSubmit(true)}>
          {source === "work_pause" ? t.skipAndResumeWork : t.skipAndStartWork}
        </button>
      </div>
    </div>
  );
}
