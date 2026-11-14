import {
  DistractionCategory,
  TagItem,
  TagKind,
  WorkStoryEntry,
  doesCategoryAddPenalty,
} from "../db";
import type { CropRegionPct } from "../screenshot";
import type { Translations } from "../i18n";
import { DISTRACT_CATEGORIES, TagFormState, formatClock } from "../constants";
import {
  InlineTagForm,
  PreviousReasonsChips,
  TagChipsSelector,
} from "./InlineTagForm";
import { ScreenshotCropper } from "./ScreenshotCropper";

export interface TagManagementHandlers {
  tagForm: TagFormState | null;
  onChangeTagForm: (next: TagFormState | null) => void;
  onSubmitTagForm: () => void;
  onAddNewTag: (kind: TagKind) => void;
  onEditTagItem: (tagId: number, currentName: string, kind: TagKind) => void;
  onDeleteTagItem: (tagId: number, name: string, kind: TagKind) => void;
}

export interface ShortBreakPromptModalProps {
  t: Translations;
  currentContext: string;
  recentContexts: string[];
  shortBreakDraft: string;
  onChangeDraft: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShortBreakPromptModal({
  t,
  currentContext,
  recentContexts,
  shortBreakDraft,
  onChangeDraft,
  onConfirm,
  onCancel,
}: ShortBreakPromptModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.shortBreakPromptTitle}</span>
      </div>
      <div className="stop-box-hint">{t.shortBreakPromptHint}</div>

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
                🎯 {currentContext}
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

      <div className="stop-box-actions">
        <button className="primary-btn" onClick={onConfirm}>
          {t.shortBreakStartBtn}
        </button>
        <button onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}

export interface WorkTopicModalProps extends TagManagementHandlers {
  t: Translations;
  workTags: TagItem[];
  selectedWorkTopicTag: string;
  workPrevReasons: string[];
  workTopicReasonText: string;
  isEditingWorkTags: boolean;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function WorkTopicModal({
  t,
  workTags,
  selectedWorkTopicTag,
  workPrevReasons,
  workTopicReasonText,
  isEditingWorkTags,
  tagForm,
  onChangeTagForm,
  onSubmitTagForm,
  onAddNewTag,
  onEditTagItem,
  onDeleteTagItem,
  onToggleEditTags,
  onSelectTag,
  onChangeReasonText,
  onSubmit,
  onCancel,
}: WorkTopicModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.whatAreYouWorkingOn}</span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("work")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button className="ghost-btn" onClick={onToggleEditTags}>
            {isEditingWorkTags ? t.doneEditing : t.editTags}
          </button>
        </div>
      </div>

      <InlineTagForm
        kind="work"
        tagForm={tagForm}
        t={t}
        onChangeTagForm={onChangeTagForm}
        onSubmitTagForm={onSubmitTagForm}
      />

      <div className="section-subhead">{t.selectTagHint}</div>
      <TagChipsSelector
        tags={workTags}
        selectedTag={selectedWorkTopicTag}
        isEditing={isEditingWorkTags}
        kind="work"
        onSelectTag={onSelectTag}
        onEditTag={onEditTagItem}
        onDeleteTag={onDeleteTagItem}
      />

      <PreviousReasonsChips
        reasons={workPrevReasons}
        label={t.previousReasons}
        onSelectReason={onChangeReasonText}
      />

      <div className="new-reason-row">
        <textarea
          className="distract-textarea"
          rows={2}
          placeholder={t.workTopicPlaceholder}
          value={workTopicReasonText}
          autoFocus
          onChange={(e) => onChangeReasonText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        <button className="primary-btn" onClick={onSubmit}>
          {t.doneEditing}
        </button>
      </div>

      <div className="stop-box-actions">
        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
          Tag: <b>{selectedWorkTopicTag}</b>
        </span>
        <button onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}

export interface DistractModalProps extends TagManagementHandlers {
  t: Translations;
  currentContext: string;
  fullTopicLabel: string;
  detectedActiveApp: { appName: string; windowTitle: string };
  distractCategory: DistractionCategory;
  distractPenaltyMins: number;
  distractPreviewShot: string;
  distractCropBox: CropRegionPct | null;
  distractTags: TagItem[];
  selectedDistractTag: string;
  distractPreviousReasons: string[];
  distractReasonText: string;
  isEditingDistractTags: boolean;
  getCategoryDisplayName: (cat: DistractionCategory) => string;
  onChangeCategory: (cat: DistractionCategory) => void;
  onChangeCropBox: (box: CropRegionPct | null) => void;
  onRetakeScreenshot: () => void;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function DistractModal({
  t,
  currentContext,
  fullTopicLabel,
  detectedActiveApp,
  distractCategory,
  distractPenaltyMins,
  distractPreviewShot,
  distractCropBox,
  distractTags,
  selectedDistractTag,
  distractPreviousReasons,
  distractReasonText,
  isEditingDistractTags,
  tagForm,
  getCategoryDisplayName,
  onChangeTagForm,
  onSubmitTagForm,
  onAddNewTag,
  onEditTagItem,
  onDeleteTagItem,
  onChangeCategory,
  onChangeCropBox,
  onRetakeScreenshot,
  onToggleEditTags,
  onSelectTag,
  onChangeReasonText,
  onSubmit,
  onCancel,
}: DistractModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.distractionTitle}</span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("distraction")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button className="ghost-btn" onClick={onToggleEditTags}>
            {isEditingDistractTags ? t.doneEditing : t.editTags}
          </button>
        </div>
      </div>

      <InlineTagForm
        kind="distraction"
        tagForm={tagForm}
        t={t}
        onChangeTagForm={onChangeTagForm}
        onSubmitTagForm={onSubmitTagForm}
      />

      {/* Son Kalınan Context & Son Açık Uygulama / Sekme Şeridi */}
      <div className="active-app-strip">
        <div
          className="active-app-strip-row"
          title={`${t.qcCurrentContextLabel}: ${
            currentContext || fullTopicLabel
          }`}
        >
          🎯 <b>{t.qcCurrentContextLabel}:</b>{" "}
          {currentContext || fullTopicLabel}
        </div>
        {(detectedActiveApp.appName || detectedActiveApp.windowTitle) && (
          <div
            className="active-app-strip-row"
            title={`${detectedActiveApp.appName}${
              detectedActiveApp.windowTitle
                ? ` — ${detectedActiveApp.windowTitle}`
                : ""
            }`}
          >
            🌐 <b>{t.qcActiveTabLabel}:</b> {detectedActiveApp.appName}
            {detectedActiveApp.windowTitle
              ? ` — ${detectedActiveApp.windowTitle}`
              : ""}
          </div>
        )}
      </div>

      {/* 6 Kategori Seçici */}
      <div className="cat5-grid">
        {DISTRACT_CATEGORIES.map((cat) => {
          const isSel = distractCategory === cat;
          const addsPen = doesCategoryAddPenalty(cat);
          return (
            <button
              key={cat}
              type="button"
              className={`cat5-btn ${isSel ? "active" : ""} ${
                addsPen ? "has-pen" : "zero-pen"
              }`}
              onClick={() => onChangeCategory(cat)}
              title={`${t.catKeyHints[cat]} ${getCategoryDisplayName(cat)} (${
                addsPen
                  ? t.addsPenaltyBadge(distractPenaltyMins)
                  : t.noPenaltyParkingBadge
              })`}
            >
              <span className="cat5-key">{t.catKeyHints[cat]}</span>
              <span className="cat5-lbl">{getCategoryDisplayName(cat)}</span>
            </button>
          );
        })}
      </div>

      {/* 3·S Ekran Görüntüsü Notu Modu İçin Kompakt Önizleme & Bölge Kırpıcı */}
      {distractCategory === "screenshot_note" && (
        <ScreenshotCropper
          previewUrl={distractPreviewShot}
          cropBox={distractCropBox}
          onChangeCropBox={onChangeCropBox}
          onRetake={onRetakeScreenshot}
          cropHint={t.ssCropHint}
          resetCropLabel={t.ssResetCropBtn}
          retakeLabel="🔄"
          minCropPct={3}
          emptyPlaceholder={
            <div
              style={{
                fontSize: "9px",
                color: "#a1a1aa",
                textAlign: "center",
                padding: "6px",
              }}
            >
              {t.ssCaptureActive}
            </div>
          }
        />
      )}

      <div className="section-subhead">{t.selectTagHint}</div>
      <TagChipsSelector
        tags={distractTags}
        selectedTag={selectedDistractTag}
        isEditing={isEditingDistractTags}
        kind="distraction"
        onSelectTag={onSelectTag}
        onEditTag={onEditTagItem}
        onDeleteTag={onDeleteTagItem}
      />

      <PreviousReasonsChips
        reasons={distractPreviousReasons}
        label={t.previousReasons}
        onSelectReason={onChangeReasonText}
      />

      <div className="new-reason-row">
        <textarea
          className="distract-textarea"
          rows={2}
          placeholder={t.qcInputPlaceholders[distractCategory]}
          value={distractReasonText}
          autoFocus
          onChange={(e) => onChangeReasonText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const idx = DISTRACT_CATEGORIES.indexOf(distractCategory);
              const next =
                DISTRACT_CATEGORIES[
                  (idx + (e.shiftKey ? DISTRACT_CATEGORIES.length - 1 : 1)) %
                    DISTRACT_CATEGORIES.length
                ];
              onChangeCategory(next);
              return;
            }
            if (e.altKey && ["1", "2", "3", "4", "5", "6"].includes(e.key)) {
              e.preventDefault();
              onChangeCategory(DISTRACT_CATEGORIES[Number(e.key) - 1]);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        <button className="primary-btn" onClick={onSubmit}>
          {doesCategoryAddPenalty(distractCategory)
            ? t.saveAndAddMin(distractPenaltyMins)
            : `${t.feedbackSaveBtn} (${t.noPenaltyParkingBadge})`}
        </button>
      </div>

      <div className="stop-box-actions">
        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
          Tag: <b>{selectedDistractTag}</b>
        </span>
        <button onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}

export interface EarlyStopModalProps extends TagManagementHandlers {
  t: Translations;
  workElapsedSec: number;
  endingTags: TagItem[];
  selectedEndingTag: string;
  endingPreviousReasons: string[];
  endingReasonText: string;
  isEditingEndingTags: boolean;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmitWithTag: (withTag: boolean) => void;
  onCancel: () => void;
}

export function EarlyStopModal({
  t,
  workElapsedSec,
  endingTags,
  selectedEndingTag,
  endingPreviousReasons,
  endingReasonText,
  isEditingEndingTags,
  tagForm,
  onChangeTagForm,
  onSubmitTagForm,
  onAddNewTag,
  onEditTagItem,
  onDeleteTagItem,
  onToggleEditTags,
  onSelectTag,
  onChangeReasonText,
  onSubmitWithTag,
  onCancel,
}: EarlyStopModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.earlyStopTitle}</span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("ending")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button className="ghost-btn" onClick={onToggleEditTags}>
            {isEditingEndingTags ? t.doneEditing : t.editTags}
          </button>
        </div>
      </div>
      <div className="stop-box-hint">
        {t.earlyStopWorkedTime(Math.floor(workElapsedSec / 60))}
      </div>

      <InlineTagForm
        kind="ending"
        tagForm={tagForm}
        t={t}
        onChangeTagForm={onChangeTagForm}
        onSubmitTagForm={onSubmitTagForm}
      />

      <TagChipsSelector
        tags={endingTags}
        selectedTag={selectedEndingTag}
        isEditing={isEditingEndingTags}
        kind="ending"
        onSelectTag={onSelectTag}
        onEditTag={onEditTagItem}
        onDeleteTag={onDeleteTagItem}
      />

      <PreviousReasonsChips
        reasons={endingPreviousReasons}
        label={t.previousReasons}
        onSelectReason={onChangeReasonText}
      />

      <div className="new-reason-row">
        <textarea
          className="distract-textarea"
          rows={2}
          placeholder={t.endingExplanationPlaceholder}
          value={endingReasonText}
          autoFocus
          onChange={(e) => onChangeReasonText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmitWithTag(true);
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        <button className="primary-btn" onClick={() => onSubmitWithTag(true)}>
          {t.addAndFinish}
        </button>
      </div>

      <div className="stop-box-actions">
        <button className="ghost-btn" onClick={() => onSubmitWithTag(false)}>
          {t.finishWithoutTag}
        </button>
        <button onClick={onCancel}>{t.cancelReturn}</button>
      </div>
    </div>
  );
}

export interface BreakOverdueModalProps extends TagManagementHandlers {
  t: Translations;
  totalOvertimeSec: number;
  breakOverdueTags: TagItem[];
  selectedBreakOverdueTag: string;
  breakOverduePrevReasons: string[];
  breakOverdueReasonText: string;
  isEditingBreakOverdueTags: boolean;
  onToggleEditTags: () => void;
  onSelectTag: (tagName: string) => void;
  onChangeReasonText: (val: string) => void;
  onSubmit: (skipReason: boolean) => void;
}

export function BreakOverdueModal({
  t,
  totalOvertimeSec,
  breakOverdueTags,
  selectedBreakOverdueTag,
  breakOverduePrevReasons,
  breakOverdueReasonText,
  isEditingBreakOverdueTags,
  tagForm,
  onChangeTagForm,
  onSubmitTagForm,
  onAddNewTag,
  onEditTagItem,
  onDeleteTagItem,
  onToggleEditTags,
  onSelectTag,
  onChangeReasonText,
  onSubmit,
}: BreakOverdueModalProps) {
  return (
    <div className="stop-box">
      <div className="stop-box-header">
        <span className="stop-box-title">{t.breakOverdueTitle}</span>
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            className="ghost-btn"
            onClick={() => onAddNewTag("break_overtime")}
            title={t.newTagPrompt}
          >
            + Tag
          </button>
          <button className="ghost-btn" onClick={onToggleEditTags}>
            {isEditingBreakOverdueTags ? t.doneEditing : t.editTags}
          </button>
        </div>
      </div>

      <div className="stop-box-hint">
        {t.breakOverdueDesc(formatClock(totalOvertimeSec))}
      </div>

      <InlineTagForm
        kind="break_overtime"
        tagForm={tagForm}
        t={t}
        onChangeTagForm={onChangeTagForm}
        onSubmitTagForm={onSubmitTagForm}
      />

      <TagChipsSelector
        tags={breakOverdueTags}
        selectedTag={selectedBreakOverdueTag}
        isEditing={isEditingBreakOverdueTags}
        kind="break_overtime"
        onSelectTag={onSelectTag}
        onEditTag={onEditTagItem}
        onDeleteTag={onDeleteTagItem}
      />

      <PreviousReasonsChips
        reasons={breakOverduePrevReasons}
        label={t.previousReasons}
        onSelectReason={onChangeReasonText}
      />

      <div className="new-reason-row">
        <textarea
          className="distract-textarea"
          rows={2}
          placeholder={t.distractExplanationPlaceholder}
          value={breakOverdueReasonText}
          autoFocus
          onChange={(e) => onChangeReasonText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(false);
            }
            if (e.key === "Escape") onSubmit(true);
          }}
        />
      </div>

      <div className="stop-box-actions">
        <button className="primary-btn" onClick={() => onSubmit(false)}>
          {t.saveAndStartWork}
        </button>
        <button onClick={() => onSubmit(true)}>{t.skipAndStartWork}</button>
      </div>
    </div>
  );
}

export interface LightboxModalProps {
  entry: WorkStoryEntry;
  t: Translations;
  onClose: () => void;
  onDelete: (id: number) => void;
}

export function LightboxModal({
  entry,
  t,
  onClose,
  onDelete,
}: LightboxModalProps) {
  return (
    <div className="lightbox-overlay no-drag" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-header">
          <span className="lightbox-title">
            📸{" "}
            {entry.entry_type === "periodic"
              ? "5dk Periyodik Ekran Kaydı"
              : "📸 Ekran Alıntısı Notu"}{" "}
            • {entry.created_at.replace("T", " ").slice(0, 16)}
          </span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              type="button"
              className="tag-icon-btn del-btn"
              onClick={() => onDelete(entry.id)}
              title={t.cancel}
            >
              🗑
            </button>
            <button type="button" className="tag-icon-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="lightbox-img-wrap">
          <img
            src={entry.screenshot_data || ""}
            alt="full screenshot"
            className="lightbox-img"
          />
        </div>
        <div className="lightbox-footer">
          {entry.context_text && (
            <div className="lightbox-meta-item">
              🎯 <b>Meşguliyet:</b> {entry.context_text}
            </div>
          )}
          {entry.active_app && (
            <div className="lightbox-meta-item">
              🌐 <b>Uygulama / Sekme:</b> {entry.active_app}
              {entry.active_window ? ` — ${entry.active_window}` : ""}
            </div>
          )}
          {entry.note && (
            <div className="lightbox-meta-item">
              📝 <b>Not:</b> {entry.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
