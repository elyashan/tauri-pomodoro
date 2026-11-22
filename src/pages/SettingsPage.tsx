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
  BG_PRESETS,
  PENALTY_OPTIONS,
  RELEASE_COMMANDS,
  ShortcutStatus,
  TIMER_PRESETS,
  UI_SCALE_OPTIONS,
} from "../constants";
import { formatKeyCombo } from "../lib/keyCombo";
import { IconArrowLeft, IconClose } from "../components/Icons";
import { TagManagerSection } from "../components/TagManagerSection";

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

  return (
    <>
      <div className="top-bar">
        <span className="badge">{t.settingsTitle}</span>
        <button className="ghost-btn" onClick={onOpenMenu}>
          <IconArrowLeft size={12} />
          <span>{t.home}</span>
        </button>
      </div>

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

      {/* GLOBAL KISAYOLLAR (EKRAN ORTASINDA HIZLI TEK SATIR INPUT) */}
      <div className="settings-section no-drag">
        <div
          className="settings-label"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{t.shortcutsSectionTitle}</span>
          <button
            type="button"
            className="ghost-btn"
            style={{ fontSize: "9px", padding: "2px 6px" }}
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
                recordingShortcutFor === "distraction" ? null : "distraction",
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
          <div style={{ fontSize: "9px", color: "#fbbf24" }}>
            {t.shortcutRecordPressKeys}
          </div>
        )}

        {shortcutStatus && !shortcutStatus.distractionOk && (
          <div style={{ fontSize: "9px", color: "#fca5a5" }}>
            {shortcutStatus.distractionError}
          </div>
        )}
      </div>

      {/* ETİKET YÖNETİMİ (EKLE / DÜZENLE / SİL) */}
      <TagManagerSection t={t} onTagsChanged={onTagsChanged} />

      {/* ÇALIŞMA PLANLARI & MOLA AYARLARI */}
      <div className="settings-section">
        <div
          className="settings-label"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{t.editPlansTitle}</span>
          <button
            className="ghost-btn"
            style={{ fontSize: "9px", padding: "2px 6px" }}
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
                  t.planNames[currentEditPlan.id] || t.planNamePlaceholder
                }
                value={currentEditPlan.name}
                onChange={(e) =>
                  onUpdatePlanField(currentEditPlan.id, "name", e.target.value)
                }
              />
            </div>

            <div className="plan-field-row">
              <span className="plan-field-label">💼 {t.planWorkMins}</span>
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
                ☕ {t.planShortBreakMins}
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
                🌴 {t.planStandardBreakMins}
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
              <span className="plan-field-label">🎉 {t.planLongBreakMins}</span>
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
                🔄 {t.planLongBreakInterval}
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

      {/* ARKA PLAN RENK & OPAKLIK */}
      <div className="settings-section">
        <div className="settings-label">{t.bgColorLabel}</div>
        <div className="swatch-row">
          {BG_PRESETS.map((c) => (
            <button
              key={c}
              className={`swatch ${theme.bgColor === c ? "selected" : ""}`}
              style={{ background: c }}
              title={c}
              onClick={() => onUpdateTheme({ bgColor: c })}
            />
          ))}
          <input
            type="color"
            className="color-input"
            title={t.customColorTitle}
            value={theme.bgColor}
            onChange={(e) => onUpdateTheme({ bgColor: e.target.value })}
          />
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
      </div>

      {/* SAYAÇ RENGİ */}
      <div className="settings-section">
        <div className="settings-label slider-label">
          <span>{t.timerColorLabel}</span>
          <span className="timer-preview">50:00</span>
        </div>
        <div className="swatch-row">
          {TIMER_PRESETS.map((c) => (
            <button
              key={c}
              className={`swatch ${theme.timerColor === c ? "selected" : ""}`}
              style={{ background: c }}
              title={c}
              onClick={() => onUpdateTheme({ timerColor: c })}
            />
          ))}
          <input
            type="color"
            className="color-input"
            title={t.customColorTitle}
            value={theme.timerColor}
            onChange={(e) => onUpdateTheme({ timerColor: e.target.value })}
          />
        </div>
        <div
          className="settings-label"
          style={{ marginTop: "6px", marginBottom: "2px" }}
        >
          {t.timerStyleLabel}
        </div>
        <div
          className="penalty-selector"
          style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          {(
            [
              { id: "digital", label: `🔢 ${t.timerStyleDigital}` },
              { id: "pie", label: `◔ ${t.timerStylePie}` },
              { id: "candle", label: `🕯️ ${t.timerStyleCandle}` },
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
      </div>

      {/* ARKA PLAN ODAK SESİ (BROWN NOISE VB.) */}
      <div className="settings-section no-drag">
        <div className="settings-label">{t.ambientNoiseTitle}</div>
        <div className="penalty-selector ambient-sound-grid">
          {(["off", "brown", "pink", "white", "rain"] as AmbientSoundType[]).map(
            (snd) => (
              <button
                key={snd}
                type="button"
                className={`penalty-btn ${ambientNoise.sound === snd ? "active" : ""}`}
                onClick={() => onUpdateAmbientNoise({ sound: snd })}
              >
                {t.ambientSoundLabels[snd]}
              </button>
            ),
          )}
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
      <div className="settings-section no-drag">
        <div className="settings-label">{t.rescueSettingsTitle}</div>
        <div
          className="penalty-selector"
          style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          {(["breathing", "gaze", "physical"] as const).map((exKey) => (
            <button
              key={exKey}
              type="button"
              className={`penalty-btn ${rescueExercises[exKey] ? "active" : ""}`}
              onClick={() =>
                onUpdateRescueExercises({ [exKey]: !rescueExercises[exKey] })
              }
            >
              {t.rescueExerciseNames[exKey]}
            </button>
          ))}
        </div>
      </div>

      {/* MOLA HATIRLATICI NOTLARI */}
      <div className="settings-section no-drag">
        <div className="settings-label">{t.breakChecklistSettingsTitle}</div>
        {breakChecklistItems.length > 0 && (
          <div className="break-reminder-chips-wrap">
            {breakChecklistItems.map((item, idx) => (
              <span key={`${item}-${idx}`} className="break-reminder-chip">
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
                onUpdateBreakChecklistItems([...breakChecklistItems, val]);
                setNewChecklistItem("");
              }
            }}
            maxLength={50}
          />
          <button
            type="button"
            className="primary-btn"
            style={{ fontSize: "10px", padding: "4px 10px" }}
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

      <div className="settings-actions">
        <button
          title={t.autoStartOnBoot(autoStartOn)}
          onClick={onToggleAutoStart}
        >
          {t.autoStartOnBoot(autoStartOn)}
        </button>
        <button onClick={() => onUpdateTheme({ ...DEFAULT_THEME })}>
          {t.resetDefaultColors}
        </button>
      </div>

      {/* PENCERE BOYUTU ÖZELLEŞTİRME & STANDART BOYUTA DÖN */}
      <div className="settings-section">
        <div
          className="settings-label"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{t.windowSizeTitle}</span>
          {sizeSavedFlash && (
            <span
              style={{
                fontSize: "9px",
                color: "#4ade80",
                fontWeight: 700,
              }}
            >
              {t.sizeSavedBadge}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginBottom: "4px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 600 }}>
            {t.uiScaleLabel}
          </div>
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
        </div>
        <div style={{ fontSize: "9.5px", color: "#a1a1aa" }}>
          {t.windowSizeHint(currentWinSize.w, currentWinSize.h)}
        </div>
        <div className="settings-actions">
          <button className="primary-btn" onClick={onSaveCurrentWindowSize}>
            {t.saveCurrentSizeBtn}
          </button>
          <button onClick={onResetStandardSizes}>
            {t.resetStandardSizeBtn}
          </button>
        </div>
      </div>

      {/* UYGULAMA İÇİ GERİ BİLDİRİM (FEEDBACK) BÖLÜMÜ */}
      <div className="settings-section no-drag">
        <div
          className="settings-label"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>💬 {t.feedbackSectionTitle}</span>
          {feedbackCopied && (
            <span
              style={{
                fontSize: "9px",
                color: "#4ade80",
                fontWeight: 700,
              }}
            >
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
            {t.feedbackCatBug}
          </button>
          <button
            type="button"
            className={`feedback-cat-btn ${
              feedbackCat === "feature" ? "active" : ""
            }`}
            onClick={() => onSetFeedbackCat("feature")}
          >
            {t.feedbackCatFeature}
          </button>
          <button
            type="button"
            className={`feedback-cat-btn ${
              feedbackCat === "ui" ? "active" : ""
            }`}
            onClick={() => onSetFeedbackCat("ui")}
          >
            {t.feedbackCatUi}
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
            <div
              style={{
                fontSize: "9.5px",
                color: "#a1a1aa",
                textAlign: "center",
                padding: "4px",
              }}
            >
              {t.feedbackEmpty}
            </div>
          ) : (
            feedbacks.map((f) => (
              <div key={f.id} className="feedback-item">
                <div className="feedback-item-text">
                  <b>
                    {f.category === "bug"
                      ? "🐛"
                      : f.category === "feature"
                        ? "💡"
                        : "🎨"}
                  </b>{" "}
                  {f.message}
                </div>
                <button
                  className="tag-icon-btn del-btn"
                  onClick={() => onDeleteFeedbackItem(f.id)}
                  title={t.cancel}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="settings-section no-drag">
        <div className="settings-label">{t.releaseCommandsTitle}</div>
        <div className="release-cmd-hint">{t.releaseCommandsHint}</div>
        <div className="release-cmd-list">
          {RELEASE_COMMANDS.map((item) => {
            const isCopied = copiedCmd === item.cmd;
            return (
              <div key={item.id} className="release-cmd-row">
                <div className="release-cmd-meta">
                  <code className="release-cmd-code">{item.cmd}</code>
                  <span className="release-cmd-desc">{t[item.descKey]}</span>
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

      <div className="credits-bar">
        Credits by <b>Elyas</b>
      </div>
    </>
  );
}
