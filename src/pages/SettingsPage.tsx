import { useState } from "react";
import {
  AmbientNoiseSettings,
  AmbientSoundType,
  DEFAULT_STUDY_PLANS,
  DEFAULT_THEME,
  FeedbackCategory,
  FeedbackItem,
  GlobalShortcutSettings,
  LangCode,
  RescueExerciseSettings,
  StudyPlan,
  TagKind,
  ThemeSettings,
  TimerVisualStyle,
} from "../db";
import type { ActiveLang, Translations } from "../i18n";
import type { UpdateStatus } from "../updater";
import {
  HARMONIOUS_TIMER_COLORS,
  PENALTY_OPTIONS,
  RELEASE_COMMANDS,
  ReleaseCommandPreset,
  ShortcutStatus,
  UI_SCALE_OPTIONS,
  resolveHarmoniousTimerColor,
} from "../constants";
import { isLightColor } from "../lib/color";
import { formatKeyCombo } from "../lib/keyCombo";
import {
  IconArrowLeft,
  IconClose,
  IconGrip,
  IconMoon,
  IconSun,
} from "../components/Icons";
import { TagManagerSection } from "../components/TagManagerSection";

type SettingsTab = "general" | "focus" | "tags" | "dev";

function formatReleaseDesc(
  item: ReleaseCommandPreset,
  appVersion: string,
  t: Translations,
  activeLang: ActiveLang,
): string {
  const m = appVersion.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return t[item.descKey];
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  const cur = `${major}.${minor}.${patch}`;
  const isTr = activeLang === "tr";
  if (item.id === "patch") {
    return `${isTr ? "Küçük yama" : "Patch bump"} (${cur} → ${major}.${minor}.${patch + 1})`;
  }
  if (item.id === "minor") {
    return `${isTr ? "Yeni özellik" : "Minor feature"} (${cur} → ${major}.${minor + 1}.0)`;
  }
  if (item.id === "major") {
    return `${isTr ? "Büyük sürüm" : "Major release"} (${cur} → ${major + 1}.0.0)`;
  }
  return t[item.descKey];
}

export interface SettingsPageProps {
  t: Translations;
  activeLang: ActiveLang;
  langPref: LangCode;
  distractPenaltyMins: number;
  shortcuts: GlobalShortcutSettings;
  shortcutStatus: ShortcutStatus | null;
  recordingShortcutFor: "distraction" | null;
  studyPlans: StudyPlan[];
  editingPlanId: string;
  theme: ThemeSettings;
  ambientNoise: AmbientNoiseSettings;
  rescueExercises: RescueExerciseSettings;
  breakChecklistItems: string[];
  autoStartOn: boolean;
  sizeSavedFlash: boolean;
  currentWinSize: { w: number; h: number };
  feedbackCopied: boolean;
  feedbackCat: FeedbackCategory;
  feedbackText: string;
  feedbacks: FeedbackItem[];
  appVersion: string;
  updateStatus: UpdateStatus;
  getPlanDisplayName: (plan: StudyPlan) => string;
  onOpenMenu: () => void;
  onLanguageChange: (lang: LangCode) => void;
  onPenaltyChange: (mins: number) => void;
  onResetShortcuts: () => void;
  onSetRecordingShortcutFor: (
    next:
      | "distraction"
      | null
      | ((cur: "distraction" | null) => "distraction" | null),
  ) => void;
  onApplyShortcuts: (next: GlobalShortcutSettings) => void;
  onOpenQuickCapture: (mode: "distraction" | "context") => void;
  onResetPlansDefault: () => void;
  onSetEditingPlanId: (id: string) => void;
  onUpdatePlanField: (
    planId: string,
    field: keyof StudyPlan,
    value: string | number,
  ) => void;
  onUpdateTheme: (patch: Partial<ThemeSettings>) => void;
  onUpdateAmbientNoise: (patch: Partial<AmbientNoiseSettings>) => void;
  onUpdateRescueExercises: (patch: Partial<RescueExerciseSettings>) => void;
  onUpdateBreakChecklistItems: (items: string[]) => void;
  onToggleAutoStart: () => void;
  onSaveCurrentWindowSize: () => void;
  onResetStandardSizes: () => void;
  onSetFeedbackCat: (cat: FeedbackCategory) => void;
  onSetFeedbackText: (text: string) => void;
  onAddFeedbackItem: () => void;
  onCopyAllFeedbacks: () => void;
  onOpenGithubFeedback: () => void;
  onDeleteFeedbackItem: (id: number) => void;
  onInstallUpdate: () => void;
  onCheckUpdate: () => void;
  onTagsChanged?: (kind: TagKind) => void;
}

export function SettingsPage({
  t,
  activeLang,
  langPref,
  distractPenaltyMins,
  shortcuts,
  shortcutStatus,
  recordingShortcutFor,
  studyPlans,
  editingPlanId,
  theme,
  ambientNoise,
  rescueExercises,
  breakChecklistItems,
  autoStartOn,
  sizeSavedFlash,
  currentWinSize,
  feedbackCopied,
  feedbackCat,
  feedbackText,
  feedbacks,
  appVersion,
  updateStatus,
  getPlanDisplayName,
  onOpenMenu,
  onLanguageChange,
  onPenaltyChange,
  onResetShortcuts,
  onSetRecordingShortcutFor,
  onApplyShortcuts,
  onOpenQuickCapture,
  onResetPlansDefault,
  onSetEditingPlanId,
  onUpdatePlanField,
  onUpdateTheme,
  onUpdateAmbientNoise,
  onUpdateRescueExercises,
  onUpdateBreakChecklistItems,
  onToggleAutoStart,
  onSaveCurrentWindowSize,
  onResetStandardSizes,
  onSetFeedbackCat,
  onSetFeedbackText,
  onAddFeedbackItem,
  onCopyAllFeedbacks,
  onOpenGithubFeedback,
  onDeleteFeedbackItem,
  onInstallUpdate,
  onCheckUpdate,
  onTagsChanged,
}: SettingsPageProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const handleCopyReleaseCmd = (cmd: string) => {
    navigator.clipboard?.writeText(cmd).catch(() => {});
    setCopiedCmd(cmd);
    window.setTimeout(() => {
      setCopiedCmd((cur) => (cur === cmd ? null : cur));
    }, 1800);
  };

  const currentEditPlan =
    studyPlans.find((p) => p.id === editingPlanId) ||
    studyPlans[0] ||
    DEFAULT_STUDY_PLANS[0];

  const isLightMode = isLightColor(theme.bgColor);
  const currentResolvedTimer = resolveHarmoniousTimerColor(
    theme.timerColor,
    isLightMode,
  );

  const handleSelectThemeMode = (mode: "dark" | "light") => {
    const nextIsLight = mode === "light";
    const mapped = resolveHarmoniousTimerColor(theme.timerColor, nextIsLight);
    onUpdateTheme({
      bgColor: nextIsLight ? "#f5f6f8" : "#111216",
      timerColor: mapped.color,
    });
  };

  return (
    <>
      <div className="top-bar">
        <span className="badge">
          <IconGrip size={11} className="top-grip-icon" />
          <span>{t.settingsTitle}</span>
        </span>
        <button className="ghost-btn" onClick={onOpenMenu}>
          <IconArrowLeft size={12} />
          <span>{t.home}</span>
        </button>
      </div>

      {/* 4 SEKMELİ LINEAR AYAR ÇUBUĞU */}
      <div className="linear-tabs settings-nav-tabs no-drag">
        {(
          [
            { id: "general", label: t.settingsTabGeneral },
            { id: "focus", label: t.settingsTabFocus },
            { id: "tags", label: t.settingsTabTags },
            { id: "dev", label: t.settingsTabDev },
          ] as { id: SettingsTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`linear-tab-btn ${settingsTab === tab.id ? "active" : ""}`}
            onClick={() => setSettingsTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-scroll-body no-drag">
        {settingsTab === "general" && (
          <>
            {/* DİL SEÇİMİ */}
            <div className="settings-section">
              <div className="settings-label">{t.langLabel}</div>
              <div className="lang-switcher">
                <button
                  className={`lang-btn ${langPref === "auto" ? "active" : ""}`}
                  onClick={() => onLanguageChange("auto")}
                >
                  {t.langAuto}
                </button>
                <button
                  className={`lang-btn ${langPref === "tr" ? "active" : ""}`}
                  onClick={() => onLanguageChange("tr")}
                >
                  {t.langTr}
                </button>
                <button
                  className={`lang-btn ${langPref === "en" ? "active" : ""}`}
                  onClick={() => onLanguageChange("en")}
                >
                  {t.langEn}
                </button>
              </div>
            </div>

            {/* TEMA, OPAKILIK & SAYAÇ GÖRÜNÜMÜ */}
            <div className="settings-section">
              <div className="settings-label-row">
                <span className="settings-label">{t.settingsTabAppearance}</span>
                <button
                  type="button"
                  className="ghost-btn settings-mini-btn"
                  onClick={() => onUpdateTheme({ ...DEFAULT_THEME })}
                >
                  {t.resetDefaultColors}
                </button>
              </div>

              <div className="theme-mode-switcher">
                <button
                  type="button"
                  className={`theme-mode-btn ${!isLightMode ? "active" : ""}`}
                  onClick={() => handleSelectThemeMode("dark")}
                >
                  <IconMoon size={12} />
                  <span>{t.themeDarkLabel}</span>
                </button>
                <button
                  type="button"
                  className={`theme-mode-btn ${isLightMode ? "active" : ""}`}
                  onClick={() => handleSelectThemeMode("light")}
                >
                  <IconSun size={12} />
                  <span>{t.themeLightLabel}</span>
                </button>
              </div>

              <div className="settings-label slider-label">
                <span>{t.opacityLabel}</span>
                <span>%{theme.bgOpacity}</span>
              </div>
              <input
                type="range"
                className="range-input"
                min={30}
                max={100}
                value={theme.bgOpacity}
                onChange={(e) =>
                  onUpdateTheme({ bgOpacity: Number(e.target.value) })
                }
              />

              <div className="settings-sub-label">{t.timerStyleLabel}</div>
              <div
                className="penalty-selector"
                style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
              >
                {(
                  [
                    { id: "digital", label: t.timerStyleDigital },
                    { id: "pie", label: t.timerStylePie },
                    { id: "candle", label: t.timerStyleCandle },
                  ] as { id: TimerVisualStyle; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`penalty-btn ${theme.timerStyle === opt.id ? "active" : ""}`}
                    onClick={() => onUpdateTheme({ timerStyle: opt.id })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="settings-label slider-label">
                <span>{t.timerColorLabel}</span>
                <span
                  className="timer-preview"
                  style={{ color: currentResolvedTimer.color }}
                >
                  50:00
                </span>
              </div>
              <div className="timer-color-swatches">
                {HARMONIOUS_TIMER_COLORS.map((item) => {
                  const isSelected = currentResolvedTimer.id === item.id;
                  const targetHex = isLightMode ? item.light : item.dark;
                  const label =
                    item.id === "neutral"
                      ? activeLang === "tr"
                        ? "Nötr"
                        : "Neutral"
                      : t.accentLabels[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`timer-color-dot-btn ${isSelected ? "active" : ""}`}
                      onClick={() => onUpdateTheme({ timerColor: targetHex })}
                      title={label}
                    >
                      <span
                        className="timer-color-dot-inner"
                        style={{ backgroundColor: item.swatch }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DİKKAT DAĞILMA CEZA SÜRESİ */}
            <div className="settings-section">
              <div className="settings-label">{t.distractPenaltySetting}</div>
              <div
                className="penalty-selector"
                style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
              >
                {PENALTY_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    className={`penalty-btn ${distractPenaltyMins === mins ? "active" : ""}`}
                    onClick={() => onPenaltyChange(mins)}
                  >
                    {mins === 0
                      ? "0"
                      : `+${mins}${activeLang === "tr" ? "dk" : "m"}`}
                  </button>
                ))}
              </div>
            </div>

            {/* GLOBAL KISAYOLLAR */}
            <div className="settings-section">
              <div className="settings-label-row">
                <span className="settings-label">{t.shortcutsSectionTitle}</span>
                <button
                  type="button"
                  className="ghost-btn settings-mini-btn"
                  onClick={onResetShortcuts}
                >
                  {t.shortcutResetBtn}
                </button>
              </div>

              <div className="shortcut-setting-row">
                <span className="shortcut-lbl" title={t.shortcutDistractLabel}>
                  {t.shortcutDistractLabel}
                </span>
                <button
                  type="button"
                  className={`shortcut-record-btn ${
                    recordingShortcutFor === "distraction" ? "recording" : ""
                  }`}
                  onClick={() =>
                    onSetRecordingShortcutFor(
                      recordingShortcutFor === "distraction"
                        ? null
                        : "distraction",
                    )
                  }
                  onBlur={() =>
                    onSetRecordingShortcutFor((cur) =>
                      cur === "distraction" ? null : cur,
                    )
                  }
                  onKeyDown={(e) => {
                    if (recordingShortcutFor !== "distraction") return;
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onSetRecordingShortcutFor(null);
                      return;
                    }
                    const combo = formatKeyCombo(e);
                    if (combo) {
                      e.preventDefault();
                      onSetRecordingShortcutFor(null);
                      onApplyShortcuts({
                        ...shortcuts,
                        distractionShortcut: combo,
                      });
                    }
                  }}
                  title={t.shortcutRecordPressKeys}
                >
                  {recordingShortcutFor === "distraction"
                    ? "..."
                    : shortcuts.distractionShortcut}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => onOpenQuickCapture("distraction")}
                >
                  {t.shortcutTestBtn}
                </button>
              </div>

              {recordingShortcutFor && (
                <div className="settings-inline-notice warn">
                  {t.shortcutRecordPressKeys}
                </div>
              )}

              {shortcutStatus && !shortcutStatus.distractionOk && (
                <div className="settings-inline-notice error">
                  {shortcutStatus.distractionError}
                </div>
              )}
            </div>

            {/* SİSTEM & PENCERE BOYUTU */}
            <div className="settings-section">
              <div className="settings-label-row">
                <span className="settings-label">{t.windowSizeTitle}</span>
                {sizeSavedFlash && (
                  <span className="settings-saved-flash">
                    {t.sizeSavedBadge}
                  </span>
                )}
              </div>

              <div className="settings-sub-label">{t.uiScaleLabel}</div>
              <div
                className="penalty-selector"
                style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
              >
                {UI_SCALE_OPTIONS.map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    className={`penalty-btn ${theme.uiScale === scale ? "active" : ""}`}
                    onClick={() => onUpdateTheme({ ...theme, uiScale: scale })}
                  >
                    %{scale}
                  </button>
                ))}
              </div>

              <div className="settings-hint-text">
                {t.windowSizeHint(currentWinSize.w, currentWinSize.h)}
              </div>

              <div className="settings-actions">
                <button
                  className="primary-btn"
                  onClick={onSaveCurrentWindowSize}
                >
                  {t.saveCurrentSizeBtn}
                </button>
                <button onClick={onResetStandardSizes}>
                  {t.resetStandardSizeBtn}
                </button>
              </div>

              <div className="settings-actions">
                <button
                  className={`settings-toggle-wide ${autoStartOn ? "active" : ""}`}
                  title={t.autoStartOnBoot(autoStartOn)}
                  onClick={onToggleAutoStart}
                >
                  {t.autoStartOnBoot(autoStartOn)}
                </button>
              </div>
            </div>
          </>
        )}

        {settingsTab === "focus" && (
          <>
            {/* ÇALIŞMA PLANLARI & MOLA AYARLARI */}
            <div className="settings-section">
              <div className="settings-label-row">
                <span className="settings-label">{t.editPlansTitle}</span>
                <button
                  className="ghost-btn settings-mini-btn"
                  onClick={onResetPlansDefault}
                >
                  {t.resetPlansDefault}
                </button>
              </div>

              <div className="plans-settings-wrapper">
                <div className="plans-selector-tabs">
                  {studyPlans.map((p) => (
                    <button
                      key={p.id}
                      className={`plan-tab-btn ${editingPlanId === p.id ? "active" : ""}`}
                      onClick={() => onSetEditingPlanId(p.id)}
                    >
                      {getPlanDisplayName(p)}
                    </button>
                  ))}
                </div>

                <div className="plans-editor-card">
                  <div className="plan-field-row">
                    <span className="plan-field-label">{t.planNameLabel}</span>
                    <input
                      className="plan-text-input"
                      placeholder={
                        t.planNames[currentEditPlan.id] ||
                        t.planNamePlaceholder
                      }
                      value={currentEditPlan.name}
                      onChange={(e) =>
                        onUpdatePlanField(
                          currentEditPlan.id,
                          "name",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="plan-field-row">
                    <span className="plan-field-label">{t.planWorkMins}</span>
                    <input
                      type="number"
                      className="plan-number-input"
                      min={1}
                      max={240}
                      value={currentEditPlan.workMins}
                      onChange={(e) =>
                        onUpdatePlanField(
                          currentEditPlan.id,
                          "workMins",
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                    />
                  </div>

                  <div className="plan-field-row">
                    <span className="plan-field-label">
                      {t.planShortBreakMins}
                    </span>
                    <input
                      type="number"
                      className="plan-number-input"
                      min={1}
                      max={60}
                      value={currentEditPlan.shortBreakMins}
                      onChange={(e) =>
                        onUpdatePlanField(
                          currentEditPlan.id,
                          "shortBreakMins",
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                    />
                  </div>

                  <div className="plan-field-row">
                    <span className="plan-field-label">
                      {t.planStandardBreakMins}
                    </span>
                    <input
                      type="number"
                      className="plan-number-input"
                      min={1}
                      max={90}
                      value={currentEditPlan.standardBreakMins}
                      onChange={(e) =>
                        onUpdatePlanField(
                          currentEditPlan.id,
                          "standardBreakMins",
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                    />
                  </div>

                  <div className="plan-field-row">
                    <span className="plan-field-label">
                      {t.planLongBreakMins}
                    </span>
                    <input
                      type="number"
                      className="plan-number-input"
                      min={1}
                      max={180}
                      value={currentEditPlan.longBreakMins}
                      onChange={(e) =>
                        onUpdatePlanField(
                          currentEditPlan.id,
                          "longBreakMins",
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                    />
                  </div>

                  <div className="plan-field-row">
                    <span className="plan-field-label">
                      {t.planLongBreakInterval}
                    </span>
                    <input
                      type="number"
                      className="plan-number-input"
                      min={1}
                      max={12}
                      value={currentEditPlan.longBreakInterval}
                      onChange={(e) =>
                        onUpdatePlanField(
                          currentEditPlan.id,
                          "longBreakInterval",
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ARKA PLAN ODAK SESİ */}
            <div className="settings-section">
              <div className="settings-label">{t.ambientNoiseTitle}</div>
              <div className="penalty-selector ambient-sound-grid">
                {(
                  ["off", "brown", "pink", "white", "rain"] as AmbientSoundType[]
                ).map((snd) => (
                  <button
                    key={snd}
                    type="button"
                    className={`penalty-btn ${ambientNoise.sound === snd ? "active" : ""}`}
                    onClick={() => onUpdateAmbientNoise({ sound: snd })}
                  >
                    {t.ambientSoundLabels[snd]}
                  </button>
                ))}
              </div>
              {ambientNoise.sound !== "off" && (
                <>
                  <div className="settings-label slider-label">
                    <span>{t.ambientVolumeLabel}</span>
                    <span>%{ambientNoise.volume}</span>
                  </div>
                  <input
                    type="range"
                    className="range-input"
                    min={5}
                    max={100}
                    value={ambientNoise.volume}
                    onChange={(e) =>
                      onUpdateAmbientNoise({ volume: Number(e.target.value) })
                    }
                  />
                  <button
                    type="button"
                    className={`penalty-btn ambient-work-toggle ${
                      ambientNoise.playOnlyInWork ? "active" : ""
                    }`}
                    onClick={() =>
                      onUpdateAmbientNoise({
                        playOnlyInWork: !ambientNoise.playOnlyInWork,
                      })
                    }
                  >
                    {t.ambientOnlyWorkToggle(ambientNoise.playOnlyInWork)}
                  </button>
                </>
              )}
            </div>

            {/* BAŞLAYAMIYORUM EGZERSİZLERİ */}
            <div className="settings-section">
              <div className="settings-label">{t.rescueSettingsTitle}</div>
              <div className="rescue-toggle-list">
                {(["breathing", "gaze", "physical"] as const).map((exKey) => {
                  const enabled = Boolean(rescueExercises[exKey]);
                  return (
                    <button
                      key={exKey}
                      type="button"
                      className={`rescue-toggle-row ${enabled ? "active" : ""}`}
                      aria-pressed={enabled}
                      onClick={() =>
                        onUpdateRescueExercises({
                          [exKey]: !enabled,
                        })
                      }
                    >
                      <span className="rescue-toggle-name">
                        {t.rescueExerciseNames[exKey]}
                      </span>
                      <span
                        className={`linear-switch ${enabled ? "on" : ""}`}
                        aria-hidden="true"
                      >
                        <span className="linear-switch-thumb" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MOLA HATIRLATICI NOTLARI */}
            <div className="settings-section">
              <div className="settings-label">
                {t.breakChecklistSettingsTitle}
              </div>
              {breakChecklistItems.length > 0 && (
                <div className="break-reminder-chips-wrap">
                  {breakChecklistItems.map((item, idx) => (
                    <span
                      key={`${item}-${idx}`}
                      className="break-reminder-chip"
                    >
                      <span className="break-reminder-chip-txt">{item}</span>
                      <button
                        type="button"
                        className="break-reminder-chip-del"
                        onClick={() =>
                          onUpdateBreakChecklistItems(
                            breakChecklistItems.filter((_, i) => i !== idx),
                          )
                        }
                        title={t.cancel}
                      >
                        <IconClose size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="checklist-add-row">
                <input
                  type="text"
                  className="plan-text-input"
                  placeholder={t.breakChecklistPlaceholder}
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = newChecklistItem.trim();
                      if (!val) return;
                      onUpdateBreakChecklistItems([
                        ...breakChecklistItems,
                        val,
                      ]);
                      setNewChecklistItem("");
                    }
                  }}
                  maxLength={50}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    const val = newChecklistItem.trim();
                    if (!val) return;
                    onUpdateBreakChecklistItems([...breakChecklistItems, val]);
                    setNewChecklistItem("");
                  }}
                >
                  {t.add}
                </button>
              </div>
            </div>
          </>
        )}

        {settingsTab === "tags" && (
          <TagManagerSection t={t} onTagsChanged={onTagsChanged} />
        )}

        {settingsTab === "dev" && (
          <>
            {/* UYGULAMA İÇİ GERİ BİLDİRİM */}
            <div className="settings-section">
              <div className="settings-label-row">
                <span className="settings-label">{t.feedbackSectionTitle}</span>
                {feedbackCopied && (
                  <span className="settings-saved-flash">
                    {t.feedbackCopiedMsg}
                  </span>
                )}
              </div>

              <div className="feedback-cat-row">
                <button
                  type="button"
                  className={`feedback-cat-btn ${
                    feedbackCat === "bug" ? "active" : ""
                  }`}
                  onClick={() => onSetFeedbackCat("bug")}
                >
                  <span className="feedback-dot bug" />
                  <span>{t.feedbackCatBug}</span>
                </button>
                <button
                  type="button"
                  className={`feedback-cat-btn ${
                    feedbackCat === "feature" ? "active" : ""
                  }`}
                  onClick={() => onSetFeedbackCat("feature")}
                >
                  <span className="feedback-dot feature" />
                  <span>{t.feedbackCatFeature}</span>
                </button>
                <button
                  type="button"
                  className={`feedback-cat-btn ${
                    feedbackCat === "ui" ? "active" : ""
                  }`}
                  onClick={() => onSetFeedbackCat("ui")}
                >
                  <span className="feedback-dot ui" />
                  <span>{t.feedbackCatUi}</span>
                </button>
              </div>

              <div className="new-reason-row">
                <textarea
                  className="distract-textarea"
                  rows={2}
                  placeholder={t.feedbackPlaceholder}
                  value={feedbackText}
                  onChange={(e) => onSetFeedbackText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onAddFeedbackItem();
                    }
                  }}
                />
                <button className="primary-btn" onClick={onAddFeedbackItem}>
                  {t.feedbackSaveBtn}
                </button>
              </div>

              <div className="settings-actions">
                <button
                  className="ghost-btn"
                  disabled={feedbacks.length === 0}
                  onClick={onCopyAllFeedbacks}
                >
                  {t.feedbackCopyAllBtn} ({feedbacks.length})
                </button>
                <button className="ghost-btn" onClick={onOpenGithubFeedback}>
                  {t.feedbackGithubBtn}
                </button>
              </div>

              <div className="feedback-list">
                {feedbacks.length === 0 ? (
                  <div className="settings-empty-msg">{t.feedbackEmpty}</div>
                ) : (
                  feedbacks.map((f) => (
                    <div key={f.id} className="feedback-item">
                      <div className="feedback-item-text">
                        <span className={`feedback-dot ${f.category}`} />
                        <span>{f.message}</span>
                      </div>
                      <button
                        className="tag-icon-btn del-btn"
                        onClick={() => onDeleteFeedbackItem(f.id)}
                        title={t.cancel}
                      >
                        <IconClose size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SÜRÜM & YAYINLAMA KOMUTLARI */}
            <div className="settings-section">
              <div className="settings-label">{t.releaseCommandsTitle}</div>
              <div className="release-cmd-hint">{t.releaseCommandsHint}</div>
              <div className="release-cmd-list">
                {RELEASE_COMMANDS.map((item) => {
                  const isCopied = copiedCmd === item.cmd;
                  return (
                    <div key={item.id} className="release-cmd-row">
                      <div className="release-cmd-meta">
                        <code className="release-cmd-code">{item.cmd}</code>
                        <span className="release-cmd-desc">
                          {formatReleaseDesc(item, appVersion, t, activeLang)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`release-copy-btn ${isCopied ? "copied" : ""}`}
                        onClick={() => handleCopyReleaseCmd(item.cmd)}
                      >
                        {isCopied ? t.copiedLabel : t.copyBtn}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="update-row">
              <span>{t.versionLabel(appVersion)}</span>
              {updateStatus.kind === "available" ? (
                <button className="primary-btn" onClick={onInstallUpdate}>
                  {t.installVersion(updateStatus.version)}
                </button>
              ) : updateStatus.kind === "downloading" ? (
                <span>{t.updateDownloading(updateStatus.percent)}</span>
              ) : (
                <button
                  className="ghost-btn"
                  disabled={updateStatus.kind === "checking"}
                  onClick={onCheckUpdate}
                >
                  {updateStatus.kind === "checking"
                    ? t.checkingUpdates
                    : updateStatus.kind === "up-to-date"
                      ? t.upToDate
                      : updateStatus.kind === "error"
                        ? t.checkErrorRetry
                        : t.checkUpdates}
                </button>
              )}
            </div>
            {updateStatus.kind === "error" && (
              <div className="update-error" title={updateStatus.message}>
                {updateStatus.message}
              </div>
            )}
          </>
        )}

        <div className="credits-bar">
          Credits by <b>Elyas</b>
        </div>
      </div>
    </>
  );
}
