import { useState } from "react";
import type { ClearDataOptions } from "../../db";
import type { Translations } from "../../i18n";

export interface SummaryResetConfirmProps {
  t: Translations;
  onResetData: (options: ClearDataOptions) => void;
  onCancel: () => void;
}

export function SummaryResetConfirm({
  t,
  onResetData,
  onCancel,
}: SummaryResetConfirmProps) {
  const [resetWorkTime, setResetWorkTime] = useState(true);
  const [resetDistractions, setResetDistractions] = useState(true);

  return (
    <div className="reset-confirm-box no-drag">
      <div className="reset-confirm-title">{t.resetConfirmTitle}</div>
      <div className="reset-confirm-desc">{t.resetConfirmDesc}</div>
      <div className="reset-options-list">
        <label className="reset-option-row">
          <input
            type="checkbox"
            checked={resetWorkTime}
            onChange={(e) => setResetWorkTime(e.target.checked)}
          />
          <div className="reset-option-copy">
            <div className="reset-option-title">{t.resetOptionWorkTitle}</div>
            <div className="reset-option-desc">{t.resetOptionWorkDesc}</div>
          </div>
        </label>
        <label className="reset-option-row">
          <input
            type="checkbox"
            checked={resetDistractions}
            onChange={(e) => setResetDistractions(e.target.checked)}
          />
          <div className="reset-option-copy">
            <div className="reset-option-title">
              {t.resetOptionDistractionsTitle}
            </div>
            <div className="reset-option-desc">
              {t.resetOptionDistractionsDesc}
            </div>
          </div>
        </label>
      </div>
      <div className="btn-row" style={{ marginTop: "8px" }}>
        <button
          className="warn-btn"
          disabled={!resetWorkTime && !resetDistractions}
          onClick={() =>
            onResetData({
              workTime: resetWorkTime,
              distractions: resetDistractions,
            })
          }
        >
          {resetWorkTime && resetDistractions
            ? t.resetConfirmYes
            : t.resetConfirmSelected}
        </button>
        <button onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}
