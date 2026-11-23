import { useRef, useState } from "react";
import type { BioEventType } from "../../db";
import type { ActiveLang, Translations } from "../../i18n";
import {
  BIO_EVENT_TYPES,
  SLEEP_HOUR_OPTIONS,
  formatSleepHours,
} from "../../constants";
import { renderBioIcon } from "../../components/BioIcon";
import { TimeInput24 } from "../../components/TimeInput24";

export interface TimelineBioPopoverProps {
  t: Translations;
  activeLang: ActiveLang;
  selectedDateStr: string;
  onAddBioLog: (
    eventType: BioEventType,
    eventTime?: string,
    note?: string,
    sleepHours?: number | null,
    targetDateStr?: string,
  ) => Promise<void> | void;
  onClose: () => void;
}

export function TimelineBioPopover({
  t,
  activeLang,
  selectedDateStr,
  onAddBioLog,
  onClose,
}: TimelineBioPopoverProps) {
  const [bioTypeDraft, setBioTypeDraft] = useState<BioEventType>("coffee");
  const [bioTimeDraft, setBioTimeDraft] = useState(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [bioNoteDraft, setBioNoteDraft] = useState("");
  const [bioSleepDraft, setBioSleepDraft] = useState<number | null>(null);
  const submittingRef = useRef(false);

  const handleSubmit = async (overrideTime?: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const sleepVal = bioTypeDraft === "wake" ? bioSleepDraft : null;
      await onAddBioLog(
        bioTypeDraft,
        overrideTime ?? bioTimeDraft,
        bioNoteDraft.trim() || undefined,
        sleepVal,
        selectedDateStr,
      );
      setBioNoteDraft("");
      setBioSleepDraft(null);
      onClose();
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="vtimeline-bio-popover">
      <div className="bio-summary-row-top">
        <div className="bio-summary-type-pills">
          {BIO_EVENT_TYPES.map((evType) => (
            <button
              key={evType}
              type="button"
              className={`bio-type-chip ${bioTypeDraft === evType ? "active" : ""}`}
              onClick={() => {
                setBioTypeDraft(evType);
                if (evType !== "wake") {
                  setBioSleepDraft(null);
                }
              }}
              title={t.bioEventLabels[evType]}
            >
              <span className={`bio-ev-icon bio-${evType}`}>
                {renderBioIcon(evType, 12)}
              </span>
            </button>
          ))}
        </div>
        <TimeInput24
          value={bioTimeDraft}
          onChange={setBioTimeDraft}
          onSubmit={(normalized) => void handleSubmit(normalized)}
          onCancel={onClose}
        />
      </div>
      {bioTypeDraft === "wake" && (
        <div className="bio-sleep-row">
          <span className="bio-sleep-lbl">{t.bioSleepLabel}</span>
          <div className="bio-sleep-chips">
            {SLEEP_HOUR_OPTIONS.map((hrs) => (
              <button
                key={hrs}
                type="button"
                className={`bio-sleep-chip ${bioSleepDraft === hrs ? "active" : ""}`}
                onClick={() =>
                  setBioSleepDraft((cur) => (cur === hrs ? null : hrs))
                }
              >
                {formatSleepHours(hrs, activeLang)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="bio-summary-row-bottom">
        <input
          type="text"
          className="bio-note-input bio-summary-note-input"
          placeholder={t.bioNotePlaceholder}
          value={bioNoteDraft}
          onChange={(e) => setBioNoteDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          maxLength={60}
        />
        <button
          type="button"
          className="primary-btn bio-save-btn bio-summary-save-btn"
          onClick={() => void handleSubmit()}
        >
          {t.add}
        </button>
      </div>
    </div>
  );
}
