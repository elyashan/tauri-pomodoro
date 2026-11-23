import type { SummaryReasonsData } from "../../db";
import type { ActiveLang, Translations } from "../../i18n";
import { IconClock, IconStop, IconZap } from "../../components/Icons";
import type { SummaryReasonsTabType } from "./timelineUtils";

export interface ReasonsBreakdownCardProps {
  t: Translations;
  activeLang: ActiveLang;
  summaryReasonsTab: SummaryReasonsTabType;
  summaryReasonsData: SummaryReasonsData | null;
  expandedTags: Record<string, boolean>;
  onSetSummaryReasonsTab: (tab: SummaryReasonsTabType) => void;
  onToggleAccordionTag: (key: string) => void;
}

export function ReasonsBreakdownCard({
  t,
  activeLang,
  summaryReasonsTab,
  summaryReasonsData,
  expandedTags,
  onSetSummaryReasonsTab,
  onToggleAccordionTag,
}: ReasonsBreakdownCardProps) {
  const effectiveTab =
    summaryReasonsTab === "overtime" || summaryReasonsTab === "endings"
      ? summaryReasonsTab
      : "distractions";
  const activeList =
    effectiveTab === "overtime"
      ? (summaryReasonsData?.breakOvertimeTags ?? [])
      : effectiveTab === "endings"
        ? (summaryReasonsData?.endingTags ?? [])
        : (summaryReasonsData?.distractionTags ?? []);
  const totalCount =
    effectiveTab === "overtime"
      ? (summaryReasonsData?.totalBreakOvertimes ?? 0)
      : effectiveTab === "endings"
        ? (summaryReasonsData?.totalEndings ?? 0)
        : (summaryReasonsData?.totalDistractions ?? 0);
  const emptyMsg =
    effectiveTab === "overtime"
      ? activeLang === "tr"
        ? "Henüz mola gecikmesi kaydedilmedi."
        : "No break overtime recorded yet."
      : effectiveTab === "endings"
        ? t.noEndingReasons
        : t.noDistractions;

  return (
    <div className="summary-section-card">
      <div className="summary-section-head">
        <span>{t.breakdownTitle}</span>
      </div>

      <div className="summary-subtabs">
        <button
          className={`subtab-btn ${effectiveTab === "distractions" ? "active" : ""}`}
          onClick={() => onSetSummaryReasonsTab("distractions")}
          title={t.distractionReasonsTab}
        >
          <IconZap size={10} />
          <span>
            {t.distractionShortTab} (
            {summaryReasonsData?.totalDistractions ?? 0})
          </span>
        </button>
        <button
          className={`subtab-btn ${effectiveTab === "overtime" ? "active" : ""}`}
          onClick={() => onSetSummaryReasonsTab("overtime")}
          title={t.breakOvertimeTab}
        >
          <IconClock size={10} />
          <span>
            {t.breakOvertimeShortTab} (
            {summaryReasonsData?.totalBreakOvertimes ?? 0})
          </span>
        </button>
        <button
          className={`subtab-btn ${effectiveTab === "endings" ? "active" : ""}`}
          onClick={() => onSetSummaryReasonsTab("endings")}
          title={t.endingReasonsTab}
        >
          <IconStop size={10} />
          <span>
            {t.endingShortTab} ({summaryReasonsData?.totalEndings ?? 0})
          </span>
        </button>
      </div>

      <div className="accordion-list">
        {activeList.length === 0 ? (
          <div className="accordion-empty">{emptyMsg}</div>
        ) : (
          activeList.map((item) => {
            const expandKey = `${effectiveTab}:${item.tag}`;
            const isExpanded = !!expandedTags[expandKey];
            const pct =
              totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
            const displayTag =
              item.tag === "Tag Yok" || item.tag === "No Tag"
                ? t.noTagLabel
                : item.tag === "Diğer" || item.tag === "Other"
                  ? activeLang === "tr"
                    ? "Diğer"
                    : "Other"
                  : item.tag;
            return (
              <div key={item.tag} className="accordion-card">
                <div
                  className="accordion-header"
                  onClick={() => onToggleAccordionTag(expandKey)}
                >
                  <div className="accordion-title">
                    <span className="accordion-arrow">
                      {isExpanded ? "▾" : "▸"}
                    </span>
                    <span>{displayTag}</span>
                  </div>
                  <span className="accordion-count">
                    {t.timesCount(item.count, pct)}
                  </span>
                </div>
                {isExpanded && (
                  <div className="accordion-body">
                    {item.explanations.map((exp, idx) => (
                      <div key={idx} className="explanation-row">
                        <span className="explanation-text">
                          <span className="explanation-bullet">·</span>
                          {exp.reason}
                        </span>
                        <span className="explanation-badge">{exp.count}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
