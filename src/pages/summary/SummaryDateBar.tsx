import { parseLocalDateStr, toLocalDateStr } from "../../db";
import type { WeeklySummary } from "../../db";
import type { ActiveLang, Translations } from "../../i18n";
import { IconChevronLeft, IconChevronRight } from "../../components/Icons";
import type { SummaryTabType } from "./timelineUtils";

export interface SummaryDateBarProps {
  t: Translations;
  activeLang: ActiveLang;
  summaryTab: SummaryTabType;
  selectedDateStr: string;
  weeklySummary: WeeklySummary | null;
  onSelectDate: (dateStr: string, openDaily?: boolean) => void;
  onShiftDate: (deltaDays: number) => void;
}

export function SummaryDateBar({
  t,
  activeLang,
  summaryTab,
  selectedDateStr,
  weeklySummary,
  onSelectDate,
  onShiftDate,
}: SummaryDateBarProps) {
  const todayStr = toLocalDateStr();
  const parsedSelectedDate = parseLocalDateStr(selectedDateStr);
  const dateDisplayLabel =
    summaryTab === "weekly" && weeklySummary?.days?.length === 7
      ? `${weeklySummary.days[0].dateLabel} – ${weeklySummary.days[6].dateLabel}`
      : parsedSelectedDate.toLocaleDateString(
          activeLang === "tr" ? "tr-TR" : "en-US",
          { weekday: "short", day: "numeric", month: "short", year: "numeric" },
        );

  return (
    <div className="summary-date-bar no-drag">
      <div className="summary-date-top">
        <div className="summary-date-nav">
          <button
            type="button"
            className="ghost-btn summary-nav-arrow"
            onClick={() => onShiftDate(summaryTab === "weekly" ? -7 : -1)}
          >
            <IconChevronLeft size={12} />
          </button>
          <span className="summary-date-label">{dateDisplayLabel}</span>
          <button
            type="button"
            className="ghost-btn summary-nav-arrow"
            onClick={() => onShiftDate(summaryTab === "weekly" ? 7 : 1)}
          >
            <IconChevronRight size={12} />
          </button>
        </div>
        <div className="summary-date-actions">
          {selectedDateStr !== todayStr && (
            <button
              type="button"
              className="summary-today-btn"
              onClick={() => onSelectDate(todayStr)}
            >
              {t.todayBtn}
            </button>
          )}
          <input
            type="date"
            className="summary-date-input"
            value={selectedDateStr}
            title={t.calendarPickerTooltip}
            onChange={(e) => {
              if (e.target.value) onSelectDate(e.target.value);
            }}
          />
        </div>
      </div>

      {weeklySummary && weeklySummary.days.length > 0 && (
        <div className="summary-week-strip">
          {weeklySummary.days.map((d) => {
            const isSelected = d.fullDateStr === selectedDateStr;
            const hasWork = d.total_sec > 0;
            return (
              <button
                key={d.dayIndex}
                type="button"
                className={`summary-day-pill ${isSelected ? "active" : ""} ${hasWork ? "has-work" : ""}`}
                onClick={() => {
                  onSelectDate(d.fullDateStr, summaryTab === "weekly");
                }}
                title={`${d.shortLabel} (${d.dateLabel}): ${t.formatDuration(d.total_sec)}`}
              >
                <span className="summary-day-short">{d.shortLabel}</span>
                <span className="summary-day-pill-num">
                  {Number(d.fullDateStr.split("-")[2]) || d.dateLabel}
                </span>
                <span className="summary-day-dot" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
