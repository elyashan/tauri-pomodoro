import type { SummaryReasonsData, WeekDayStat, WeeklySummary } from "../../db";
import type { ActiveLang, Translations } from "../../i18n";

export interface WeeklyChartSectionProps {
  t: Translations;
  activeLang: ActiveLang;
  selectedDateStr: string;
  weeklySummary: WeeklySummary | null;
  summaryReasonsData: SummaryReasonsData | null;
  hoveredWeekDay: WeekDayStat | null;
  maxWeeklyHours: number;
  onSelectDate: (dateStr: string, openDaily?: boolean) => void;
  onSetHoveredWeekDay: (day: WeekDayStat | null) => void;
}

export function WeeklyChartSection({
  t,
  activeLang,
  selectedDateStr,
  weeklySummary,
  summaryReasonsData,
  hoveredWeekDay,
  maxWeeklyHours,
  onSelectDate,
  onSetHoveredWeekDay,
}: WeeklyChartSectionProps) {
  return (
    <>
      <div className="weekly-stats-grid">
        <div className="stat-card">
          <div className="stat-val">
            {t.formatDuration(weeklySummary?.totalSec ?? 0)}
          </div>
          <div className="stat-lbl">{t.weeklyTotal}</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">
            {t.formatDuration(weeklySummary?.dailyAvgSec ?? 0)}
          </div>
          <div className="stat-lbl">{t.weeklyDailyAvg}</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">
            {summaryReasonsData?.avgDistractionsPerSession ?? 0}
          </div>
          <div className="stat-lbl">{t.avgDistractionsPerSession}</div>
        </div>
      </div>

      <div className="tooltip-banner">
        {hoveredWeekDay ? (
          <>
            <span className="tooltip-banner-main">
              <b>{hoveredWeekDay.shortLabel}</b> ({hoveredWeekDay.dateLabel}):{" "}
              {(hoveredWeekDay.total_sec / 3600).toFixed(1)}{" "}
              {activeLang === "tr" ? "sa" : "h"}
            </span>
            <span className="tooltip-banner-meta">
              {hoveredWeekDay.session_count} {t.sessions.toLowerCase()} ·{" "}
              {t.formatDuration(hoveredWeekDay.total_sec)}
            </span>
          </>
        ) : (
          <span className="tooltip-banner-hint">{t.summaryHoverHint}</span>
        )}
      </div>

      <div
        className="chart-area"
        onMouseLeave={() => {
          const sel =
            weeklySummary?.days.find(
              (x) => x.fullDateStr === selectedDateStr,
            ) ?? null;
          onSetHoveredWeekDay(sel);
        }}
      >
        {weeklySummary?.days.map((d) => {
          const hours = d.total_sec / 3600;
          const scaledPct =
            maxWeeklyHours > 0 ? (hours / maxWeeklyHours) * 85 : 0;
          const heightPct = Math.max(6, scaledPct);
          const isHovered = hoveredWeekDay?.dayIndex === d.dayIndex;
          const isSelected = d.fullDateStr === selectedDateStr;
          return (
            <div
              key={d.dayIndex}
              className={`bar-col ${isSelected ? "selected-col" : ""}`}
              onMouseEnter={() => onSetHoveredWeekDay(d)}
              onClick={() => {
                onSelectDate(d.fullDateStr, true);
                onSetHoveredWeekDay(d);
              }}
            >
              <span className="bar-val">
                {hours.toFixed(1)}
                {activeLang === "tr" ? "s" : "h"}
              </span>
              <div
                className={`bar-fill ${
                  isSelected ? "active-bar" : isHovered ? "hover-bar" : ""
                } ${d.is_today ? "today-bar" : ""}`}
                style={{ height: `${heightPct}%` }}
              />
              <span
                className={`bar-label ${
                  isSelected ? "selected" : ""
                } ${d.is_today ? "today" : ""}`}
              >
                {d.shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
