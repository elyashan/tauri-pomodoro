import type { AdhdInsightsData } from "../../db";
import type { Translations } from "../../i18n";
import {
  IconBrain,
  IconClock,
  IconCoffee,
  IconCompass,
  IconFlame,
  IconSparkles,
  IconSun,
} from "../../components/Icons";

export interface AdhdInsightsCardProps {
  t: Translations;
  adhdInsights: AdhdInsightsData | null;
}

export function AdhdInsightsCard({ t, adhdInsights }: AdhdInsightsCardProps) {
  const startLbl = adhdInsights?.topStartMood
    ? t.moodLabels[adhdInsights.topStartMood]
    : null;
  const endLbl = adhdInsights?.topEndMood
    ? t.moodLabels[adhdInsights.topEndMood]
    : null;

  return (
    <div className="summary-section-card">
      <div className="summary-section-head">
        <span>{t.adhdTab}</span>
      </div>
      <div className="adhd-insights-wrap">
        <div className="adhd-cards-grid">
          <div className="adhd-card insight-threshold">
            <div className="adhd-card-title">
              <IconClock size={11} />
              <span>{t.adhdFocusThresholdTitle}</span>
            </div>
            <div className="adhd-card-desc">
              {t.adhdFocusThresholdDesc(
                adhdInsights?.avgFocusThresholdMins ?? null,
              )}
            </div>
          </div>

          <div className="adhd-card insight-trigger">
            <div className="adhd-card-title">
              <IconCompass size={11} />
              <span>{t.adhdTriggerRatioTitle}</span>
            </div>
            <div className="adhd-card-desc">
              {t.adhdTriggerRatioDesc(
                adhdInsights?.internalPct ?? 50,
                adhdInsights?.internalCount ?? 0,
                adhdInsights?.externalCount ?? 0,
              )}
            </div>
          </div>

          <div className="adhd-card insight-friction">
            <div className="adhd-card-title">
              <IconCoffee size={11} />
              <span>{t.adhdTransitionTitle}</span>
            </div>
            <div className="adhd-card-desc">
              {t.adhdTransitionDesc(
                adhdInsights?.avgBreakOvertimeMins ?? 0,
                adhdInsights?.overtimeBreakRatePct ?? 0,
              )}
            </div>
          </div>

          <div className="adhd-card insight-hyperfocus">
            <div className="adhd-card-title">
              <IconFlame size={11} />
              <span>{t.adhdCompletionTitle}</span>
            </div>
            <div className="adhd-card-desc">
              {t.adhdCompletionDesc(
                adhdInsights?.completionRatePct ?? 100,
                adhdInsights?.hyperfocusCount ?? 0,
              )}
              {(adhdInsights?.hyperfocusTotalMins ?? 0) > 0 && (
                <div className="adhd-hf-sub">
                  {t.hyperfocusInsightLabel}:{" "}
                  {t.formatDuration(
                    (adhdInsights?.hyperfocusTotalMins ?? 0) * 60,
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="adhd-card insight-chrono">
            <div className="adhd-card-title">
              <IconSun size={11} />
              <span>{t.adhdChronoTitle}</span>
            </div>
            <div className="adhd-card-desc">
              {t.adhdChronoDesc(
                adhdInsights?.peakFocusHoursLabel ?? null,
                adhdInsights?.mostDistractedHoursLabel ?? null,
              )}
            </div>
          </div>

          <div className="adhd-card insight-mood">
            <div className="adhd-card-title">
              <IconBrain size={11} />
              <span>{t.adhdMoodTitle}</span>
            </div>
            <div className="adhd-card-desc">
              {t.adhdMoodDesc(
                startLbl,
                endLbl,
                adhdInsights?.moodLoggedCount ?? 0,
              )}
            </div>
          </div>
        </div>

        <div className="adhd-tip-box">
          <IconSparkles size={12} className="adhd-tip-icon" />
          <span>
            {t.adhdDynamicTip(
              adhdInsights?.avgFocusThresholdMins ?? null,
              adhdInsights?.internalPct ?? 50,
              adhdInsights?.overtimeBreakRatePct ?? 0,
              adhdInsights?.topTriggerTag ?? null,
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
