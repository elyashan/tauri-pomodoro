import { useRef, useState } from "react";
import type React from "react";
import type {
  ActiveDayStats,
  BioEventType,
  BioLogItem,
  MoodType,
  StudyPlan,
  TimerMode,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import type { UpdateStatus } from "../updater";
import {
  BIO_EVENT_TYPES,
  MOOD_TYPES,
  SLEEP_HOUR_OPTIONS,
  formatSleepHours,
} from "../constants";
import { TimeInput24 } from "../components/TimeInput24";
import { renderBioIcon } from "../components/BioIcon";
import {
  IconBriefcase,
  IconChart,
  IconChevronDown,
  IconClose,
  IconCoffee,
  IconGrip,
  IconLayers,
  IconMinimize,
  IconPlay,
  IconRepeat,
  IconSettings,
  IconStop,
  IconTag,
} from "../components/Icons";

export interface MenuPageProps {
  t: Translations;
  activeLang: ActiveLang;
  dayStats: ActiveDayStats;
  updateAvailable: boolean;
  updateStatus: UpdateStatus;
  sessionActive: boolean;
  isBreakAlarm: boolean;
  isRunning: boolean;
  timerMode: TimerMode;
  currentBreakShortName: string;
  fullTopicLabel: string;
  sessionShortBreakCount: number;
  currentCycleIndex: number;
  currentPlan: StudyPlan;
  studyPlans: StudyPlan[];
  activePlanId: string;
  planDropdownOpen: boolean;
  planDropdownRef: React.RefObject<HTMLDivElement | null>;
  liveClockStr: string;
  todayBioLogs: BioLogItem[];
  selectedStartMood: MoodType | null;
  getPlanDisplayName: (plan: StudyPlan) => string;
  onOpenDashboard?: () => void;
  onOpenSummary: () => void;
  onOpenSettings: () => void;
  onEnterMiniDock: () => void;
  onHideToTray: () => void;
  onInstallUpdate: () => void;
  onTogglePlanDropdown: () => void;
  onSelectPlan: (planId: string) => void;
  onOpenWorkTopicBox: () => void;
  onSelectStartMood: (mood: MoodType | null) => void;
  onAddBioLog: (
    eventType: BioEventType,
    eventTime?: string,
    note?: string,
    sleepHours?: number | null,
  ) => Promise<void> | void;
  onReturnToTimer: () => void;
  onFinishSession: () => void;
  onStartSession: () => void;
}

export function MenuPage({
  t,
  activeLang,
  dayStats,
  updateAvailable,
  updateStatus,
  sessionActive,
  isBreakAlarm,
  isRunning,
  timerMode,
  currentBreakShortName,
  fullTopicLabel,
  sessionShortBreakCount,
  currentCycleIndex,
  currentPlan,
  studyPlans,
  activePlanId,
  planDropdownOpen,
  planDropdownRef,
  liveClockStr,
  todayBioLogs,
  selectedStartMood,
  getPlanDisplayName,
  onOpenSummary,
  onOpenSettings,
  onEnterMiniDock,
  onHideToTray,
  onInstallUpdate,
  onTogglePlanDropdown,
  onSelectPlan,
  onOpenWorkTopicBox,
  onSelectStartMood,
  onAddBioLog,
  onReturnToTimer,
  onFinishSession,
  onStartSession,
}: MenuPageProps) {
  const [bioFormType, setBioFormType] = useState<BioEventType | null>(null);
  const [bioTimeDraft, setBioTimeDraft] = useState("");
  const [bioNoteDraft, setBioNoteDraft] = useState("");
  const [bioSleepDraft, setBioSleepDraft] = useState<number | null>(null);
  const [bioToast, setBioToast] = useState<string | null>(null);
  const submittingBioRef = useRef<boolean>(false);

  const getNowHm = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleToggleBioPill = (type: BioEventType) => {
    if (bioFormType === type) {
      setBioFormType(null);
      return;
    }
    setBioFormType(type);
    setBioTimeDraft(getNowHm());
    setBioNoteDraft("");
    setBioSleepDraft(null);
  };

  const handleSubmitBioForm = async (overrideHm?: string) => {
    if (!bioFormType || submittingBioRef.current) return;
    submittingBioRef.current = true;
    try {
      const hm = (overrideHm ?? bioTimeDraft).trim() || getNowHm();
      const note = bioNoteDraft.trim() || undefined;
      const kind = bioFormType;
      const sleepVal = kind === "wake" ? bioSleepDraft : null;
      await onAddBioLog(kind, hm, note, sleepVal);
      setBioFormType(null);
      setBioNoteDraft("");
      setBioSleepDraft(null);
      const msg = t.bioLoggedToast(t.bioEventLabels[kind], hm);
      setBioToast(msg);
      window.setTimeout(() => {
        setBioToast((cur) => (cur === msg ? null : cur));
      }, 2200);
    } finally {
      submittingBioRef.current = false;
    }
  };

  return (
    <>
      <div className="top-bar">
        <span className="badge">
          <IconGrip size={11} className="top-grip-icon" />
          <span>{dayStats.label}</span>
        </span>
        <div className="top-bar-right">
          <button
            className="ghost-btn"
            title={t.summaryTitle}
            onClick={onOpenSummary}
          >
            <IconChart size={12} />
            <span>{t.summary}</span>
          </button>
          <button
            className="icon-btn"
            title={t.settings}
            onClick={onOpenSettings}
          >
            <IconSettings size={13} />
            {updateAvailable && <span className="update-dot" />}
          </button>
          <button
            className="icon-btn"
            title={t.miniDockTooltip}
            onClick={onEnterMiniDock}
          >
            <IconMinimize size={13} />
          </button>
          <button
            className="icon-btn"
            title={t.hideToTrayOnlyTooltip}
            onClick={onHideToTray}
          >
            <IconClose size={12} />
          </button>
        </div>
      </div>

      {/* GÜNLÜK ÖZET ŞERİDİ (KUTUSUZ TİPOGRAFİK SATIR) */}
      <div className="stats-grid">
        <div className="stat-card" title={t.totalWork}>
          <div className="stat-val">{t.formatDuration(dayStats.totalSec)}</div>
          <div className="stat-lbl">{t.totalWork}</div>
        </div>
        <div className="stat-card" title={t.sessions}>
          <div className="stat-val">{dayStats.sessionCount}</div>
          <div className="stat-lbl">{t.sessions}</div>
        </div>
        <div className="stat-card" title={t.average}>
          <div className="stat-val">{t.formatDuration(dayStats.avgSec)}</div>
          <div className="stat-lbl">{t.average}</div>
        </div>
      </div>

      {(updateStatus.kind === "available" ||
        updateStatus.kind === "downloading") && (
        <div className="update-banner">
          {updateStatus.kind === "available" ? (
            <>
              <span>{t.newVersionReady(updateStatus.version)}</span>
              <button className="primary-btn" onClick={onInstallUpdate}>
                {t.installVersion(updateStatus.version)}
              </button>
            </>
          ) : (
            <span>{t.updateDownloading(updateStatus.percent)}</span>
          )}
        </div>
      )}

      {/* BİRLEŞİK ODAK & PLAN PANELİ */}
      <div className="focus-panel no-drag">
        {sessionActive ? (
          <div
            className={`session-status-bar ${
              isBreakAlarm
                ? "active-alarm"
                : timerMode === "work"
                  ? "active-work"
                  : "active-break"
            }`}
            title={t.sessionActiveTooltip(
              timerMode === "work" ? t.work : currentBreakShortName,
              fullTopicLabel,
              sessionShortBreakCount,
            )}
          >
            <div className="session-status-left">
              <span
                className={`status-dot ${
                  isBreakAlarm
                    ? "alarm"
                    : !isRunning
                      ? "paused"
                      : timerMode === "work"
                        ? "work"
                        : "break"
                }`}
              />
              <span className="session-mode-label">
                {timerMode === "work" ? (
                  <IconBriefcase size={11} />
                ) : (
                  <IconCoffee size={11} />
                )}
                <span>
                  {timerMode === "work" ? t.work : currentBreakShortName}
                </span>
              </span>
              <span className="session-state-tag">
                {isRunning ? t.statusRunning : t.statusPaused}
              </span>
            </div>
            <div className="session-status-right">
              <span
                className="cycle-badge"
                title={t.cycleTooltip(
                  currentCycleIndex,
                  currentPlan.longBreakInterval,
                  currentPlan.longBreakMins,
                )}
              >
                <IconRepeat size={10} />
                <span>
                  {currentCycleIndex}/{currentPlan.longBreakInterval}
                </span>
              </span>
              <span className="session-clock-pill">{liveClockStr}</span>
            </div>
          </div>
        ) : (
          <div className="session-status-bar" title={t.sessionIdleTooltip}>
            <div className="session-status-left">
              <span className="status-dot" />
              <span className="session-idle-text">{t.sessionIdleLabel}</span>
            </div>
            <span className="session-idle-meta">
              {getPlanDisplayName(currentPlan)} · {currentPlan.workMins}
              {activeLang === "tr" ? "dk" : "m"}
            </span>
          </div>
        )}

        <div className="focus-panel-divider" />

        <div className="plan-dropdown-wrap" ref={planDropdownRef}>
          <button
            type="button"
            className={`plan-dropdown-trigger ${
              planDropdownOpen ? "open" : ""
            }`}
            disabled={sessionActive}
            onClick={() => {
              if (!sessionActive) {
                onTogglePlanDropdown();
              }
            }}
            title={
              sessionActive
                ? t.planLockedDuringSession
                : t.planDetailTooltip(
                    getPlanDisplayName(currentPlan),
                    currentPlan.workMins,
                    currentPlan.shortBreakMins,
                    currentPlan.standardBreakMins,
                    currentPlan.longBreakMins,
                    currentPlan.longBreakInterval,
                  )
            }
          >
            <span className="plan-trigger-name">
              <IconLayers size={12} />
              <span>{getPlanDisplayName(currentPlan)}</span>
            </span>
            <span className="plan-trigger-meta">
              <span>
                {currentPlan.workMins}/{currentPlan.standardBreakMins}
                {activeLang === "tr" ? "dk" : "m"} ·{" "}
                {currentPlan.longBreakInterval}+1
              </span>
              {!sessionActive && (
                <IconChevronDown
                  size={12}
                  className={planDropdownOpen ? "chevron-rotated" : ""}
                />
              )}
            </span>
          </button>

          {planDropdownOpen && !sessionActive && (
            <div className="plan-dropdown-list">
              {studyPlans.map((p) => {
                const pName = getPlanDisplayName(p);
                const isSelected = p.id === activePlanId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`plan-dropdown-item ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() => onSelectPlan(p.id)}
                    title={t.planDetailTooltip(
                      pName,
                      p.workMins,
                      p.shortBreakMins,
                      p.standardBreakMins,
                      p.longBreakMins,
                      p.longBreakInterval,
                    )}
                  >
                    <span>{pName}</span>
                    <span className="plan-item-meta">
                      {p.workMins}/{p.standardBreakMins}
                      {activeLang === "tr" ? "dk" : "m"} ·{" "}
                      {p.longBreakInterval}+1
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="focus-panel-divider" />

        <div className="plan-meta-row">
          <button
            type="button"
            className="work-topic-badge menu-topic"
            onClick={onOpenWorkTopicBox}
            title={`${t.changeWorkTopic}: ${fullTopicLabel}`}
          >
            <IconTag size={11} />
            <span className="work-topic-text">{fullTopicLabel}</span>
          </button>

          <div className="plan-chips-row">
            <span
              className="plan-chip highlight"
              title={`${t.planWorkMins}: ${currentPlan.workMins}`}
            >
              <IconBriefcase size={10} />
              <span>{currentPlan.workMins}</span>
            </span>
            <span
              className="plan-chip"
              title={t.planBreaksChipTooltip(
                currentPlan.shortBreakMins,
                currentPlan.standardBreakMins,
                currentPlan.longBreakMins,
                currentPlan.longBreakInterval,
              )}
            >
              <IconCoffee size={10} />
              <span>
                {currentPlan.shortBreakMins}/{currentPlan.standardBreakMins}/
                {currentPlan.longBreakMins}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* BİYOLOJİK BAĞLAM BAR */}
      <div className="bio-bar-box no-drag">
        <div className="bio-bar-header">
          <span className="bio-bar-title">{t.bioContextTitle}</span>
          {bioToast && <span className="bio-toast">{bioToast}</span>}
        </div>
        <div className="bio-pills-row">
          {BIO_EVENT_TYPES.map((evType) => {
            const logsOfType = todayBioLogs.filter(
              (b) => b.event_type === evType,
            );
            const latest = logsOfType[logsOfType.length - 1];
            const isOpen = bioFormType === evType;
            return (
              <button
                key={evType}
                type="button"
                className={`bio-pill-btn ${latest ? "logged" : ""} ${isOpen ? "open" : ""}`}
                onClick={() => handleToggleBioPill(evType)}
                title={
                  latest?.note
                    ? `${t.bioEventLabels[evType]} ${latest.event_time}: ${latest.note}`
                    : t.bioEventLabels[evType]
                }
              >
                <span className="bio-pill-head">
                  <span className={`bio-ev-icon bio-${evType}`}>
                    {renderBioIcon(evType, 11)}
                  </span>
                  <span>{t.bioEventLabels[evType]}</span>
                </span>
                {latest && (
                  <span className="bio-pill-time">
                    {latest.event_time}
                    {evType === "wake" && latest.sleep_hours != null
                      ? ` · ${formatSleepHours(latest.sleep_hours, activeLang)}`
                      : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {bioFormType && (
          <div className="bio-inline-form">
            {bioFormType === "wake" && (
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
            <div className="bio-inline-row">
              <TimeInput24
                value={bioTimeDraft}
                onChange={setBioTimeDraft}
                onSubmit={(normalized) => void handleSubmitBioForm(normalized)}
                onCancel={() => setBioFormType(null)}
              />
              <input
                type="text"
                className="bio-note-input"
                placeholder={t.bioNotePlaceholder}
                value={bioNoteDraft}
                onChange={(e) => setBioNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmitBioForm();
                  } else if (e.key === "Escape") {
                    setBioFormType(null);
                  }
                }}
                maxLength={60}
                autoFocus
              />
              <button
                type="button"
                className="primary-btn bio-save-btn"
                onClick={() => void handleSubmitBioForm()}
              >
                {t.bioSaveBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BAŞLANGIÇ RUH HALİ (Sadece seans başlamadan) */}
      {!sessionActive && (
        <div className="mood-start-box no-drag">
          <div className="mood-strip-label">{t.moodPromptStart}</div>
          <div className="mood-pills-row">
            {MOOD_TYPES.map((m) => {
              const active = selectedStartMood === m;
              return (
                <button
                  key={m}
                  type="button"
                  className={`mood-pill-btn ${active ? "selected" : ""}`}
                  onClick={() => onSelectStartMood(active ? null : m)}
                  title={t.moodLabels[m]}
                >
                  <span className={`mood-dot mood-${m}`} />
                  <span>{t.moodLabels[m]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SEANS AKSİYON BUTONLARI & CREDITS */}
      <div className="menu-footer-group">
        <div className="menu-actions">
          {sessionActive ? (
            <>
              <button className="primary-btn" onClick={onReturnToTimer}>
                <IconPlay size={11} />
                <span>
                  {timerMode === "work"
                    ? t.returnToWorkMenuBtn
                    : t.returnToBreakMenuBtn}
                </span>
              </button>
              <button
                className="warn-btn"
                onClick={onFinishSession}
                title={t.finishSessionTooltip}
              >
                <IconStop size={11} />
                <span>{t.finishSessionBtn}</span>
              </button>
            </>
          ) : (
            <button
              className="primary-btn full-width"
              onClick={onStartSession}
              title={t.startSessionTooltip}
            >
              <IconPlay size={11} />
              <span>{t.startSessionBtn}</span>
            </button>
          )}
        </div>

        <div className="credits-bar">
          Credits by <b>Elyas</b>
        </div>
      </div>
    </>
  );
}
