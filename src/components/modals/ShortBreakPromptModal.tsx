import type { Translations } from "../../i18n";
import { IconCoffee } from "../Icons";

export interface ShortBreakPromptModalProps {
  t: Translations;
  currentContext: string;
  recentContexts: string[];
  shortBreakDraft: string;
  isDirectContextEdit?: boolean;
  onChangeDraft: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShortBreakPromptModal({
  t,
  currentContext,
  recentContexts,
  shortBreakDraft,
  isDirectContextEdit = false,
  onChangeDraft,
  onConfirm,
  onCancel,
}: ShortBreakPromptModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.shortBreakPromptTitle}</span>
      </div>

      <div className="stop-box-body">
        {!isDirectContextEdit && (
          <div className="stop-box-hint">{t.shortBreakPromptHint}</div>
        )}

        {(currentContext || recentContexts.length > 0) && (
          <div className="previous-reasons-box">
            <div className="previous-reasons-chips">
              {currentContext && (
                <button
                  type="button"
                  className={`reason-suggestion-chip ${
                    shortBreakDraft === currentContext ? "selected" : ""
                  }`}
                  onClick={() => onChangeDraft(currentContext)}
                >
                  {currentContext}
                </button>
              )}
              {recentContexts
                .filter((rc) => rc !== currentContext)
                .slice(0, 4)
                .map((rc) => (
                  <button
                    key={rc}
                    type="button"
                    className={`reason-suggestion-chip ${
                      shortBreakDraft === rc ? "selected" : ""
                    }`}
                    onClick={() => onChangeDraft(rc)}
                  >
                    {rc}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="new-reason-row">
          <textarea
            className="distract-textarea"
            rows={2}
            placeholder={t.shortBreakPromptPlaceholder}
            value={shortBreakDraft}
            autoFocus
            onChange={(e) => onChangeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onConfirm();
              }
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
      </div>

      <div className="stop-box-actions" style={{ justifyContent: "flex-end" }}>
        <button className="primary-btn" onClick={onConfirm}>
          {!isDirectContextEdit && <IconCoffee size={11} />}
          <span>
            {isDirectContextEdit ? t.doneEditing : t.shortBreakStartBtn}
          </span>
        </button>
        <button onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}
