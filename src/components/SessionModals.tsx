import { useEffect, useRef, useState } from "react";
import {
  addCategoryTag,
  DistractionCategory,
  getCategoryTagsByPopularity,
  getTopCategoryReasons,
  TagItem,
  TagKind,
  WorkStoryEntry,
  doesCategoryAddPenalty,
} from "../db";
import type { Translations } from "../i18n";
import { DISTRACT_CATEGORIES, TagFormState, formatClock } from "../constants";
import {
  InlineTagForm,
  PreviousReasonsChips,
  TagChipsSelector,
} from "./InlineTagForm";

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
  isDirectContextEdit?: boolean;
  onChangeDraft: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShortBreakPromptModal({
  t,
  currentContext,
  recentContexts,
  shortBreakDraft,
  isDirectContextEdit = false,
  onChangeDraft,
  onConfirm,
  onCancel,
}: ShortBreakPromptModalProps) {
  return (
    <div className="stop-box">
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <div className="stop-box-header">
          <span className="stop-box-title">{t.shortBreakPromptTitle}</span>
        </div>
        {!isDirectContextEdit && (
          <div className="stop-box-hint">{t.shortBreakPromptHint}</div>
        )}

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
      </div>

      <div className="stop-box-actions" style={{ justifyContent: "flex-end" }}>
        <button className="primary-btn" onClick={onConfirm}>
          {isDirectContextEdit ? t.doneEditing : t.shortBreakStartBtn}
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
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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
        </div>
      </div>

      <div className="stop-box-actions" style={{ alignItems: "center" }}>
        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
          Tag: <b>{selectedWorkTopicTag}</b>
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="primary-btn" onClick={onSubmit}>
            {t.doneEditing}
          </button>
          <button onClick={onCancel}>{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

export interface DistractSubmissionPayload {
  category: DistractionCategory;
  tag: string;
  text: string;
  newContext?: string;
}

export interface DistractModalProps {
  t: Translations;
  currentContext: string;
  recentContexts: string[];
  fullTopicLabel: string;
  detectedActiveApp: { appName: string; windowTitle: string };
  distractPenaltyMins: number;
  getCategoryDisplayName: (cat: DistractionCategory) => string;
  onSubmit: (data: DistractSubmissionPayload) => void;
  onCancel: () => void;
}

type DistractStage = "category" | "tag" | "input" | "context";

export function DistractModal({
  t,
  currentContext,
  recentContexts,
  fullTopicLabel,
  detectedActiveApp,
  distractPenaltyMins,
  getCategoryDisplayName,
  onSubmit,
  onCancel,
}: DistractModalProps) {
  const [stage, setStage] = useState<DistractStage>("category");
  const [category, setCategory] =
    useState<DistractionCategory>("impulsive_task");
  const [categoryTags, setCategoryTags] = useState<TagItem[]>([]);
  const [tagIdx, setTagIdx] = useState<number>(0);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [addingTag, setAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  const [noteText, setNoteText] = useState("");
  const [popularEntries, setPopularEntries] = useState<string[]>([]);
  const [focusedEntryIdx, setFocusedEntryIdx] = useState<number>(-1);

  const [contextText, setContextText] = useState(currentContext || "");
  const [focusedContextIdx, setFocusedContextIdx] = useState<number>(-1);

  const boxRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const contextInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const entryRowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => boxRef.current?.focus());
  }, []);

  useEffect(() => {
    getCategoryTagsByPopularity(category, t.defaultCategoryTags[category])
      .then(setCategoryTags)
      .catch(() => {});
  }, [category, t]);

  const enterTagStage = (cat: DistractionCategory) => {
    setCategory(cat);
    setTagIdx(0);
    setSelectedTag("");
    setAddingTag(false);
    setNewTagInput("");
    setStage("tag");
    requestAnimationFrame(() => boxRef.current?.focus());
  };

  const confirmTagByIndex = async (idx: number) => {
    const chosen = idx <= 0 ? "" : categoryTags[idx - 1]?.name || "";
    setTagIdx(idx);
    setSelectedTag(chosen);
    setFocusedEntryIdx(-1);
    setStage("input");
    const entries = await getTopCategoryReasons(category, chosen, 5).catch(
      () => [],
    );
    setPopularEntries(entries);
    requestAnimationFrame(() => noteInputRef.current?.focus());
  };

  const handleSaveNewTag = async () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) {
      setAddingTag(false);
      setNewTagInput("");
      requestAnimationFrame(() => boxRef.current?.focus());
      return;
    }
    const created = await addCategoryTag(trimmed, category);
    const updated = await getCategoryTagsByPopularity(
      category,
      t.defaultCategoryTags[category],
    );
    setCategoryTags(updated);
    setAddingTag(false);
    setNewTagInput("");
    if (created) {
      const idx = updated.findIndex((item) => item.name === created.name);
      if (idx >= 0) {
        setTagIdx(idx + 1);
        setSelectedTag(created.name);
      }
    }
    requestAnimationFrame(() => boxRef.current?.focus());
  };

  const advanceFromInput = (overrideNote?: string) => {
    const finalNote = (
      overrideNote !== undefined ? overrideNote : noteText
    ).trim();
    if (!finalNote) return;

    setNoteText(finalNote);
    if (category === "internal" || category === "external") {
      setContextText(currentContext || "");
      setFocusedContextIdx(-1);
      setStage("context");
      requestAnimationFrame(() => {
        contextInputRef.current?.focus();
        contextInputRef.current?.select();
      });
    } else {
      onSubmit({
        category,
        tag: selectedTag,
        text: finalNote,
      });
    }
  };

  const topContexts = recentContexts.slice(0, 5);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (addingTag) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAddingTag(false);
        setNewTagInput("");
        requestAnimationFrame(() => boxRef.current?.focus());
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveNewTag().catch(() => {});
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (stage === "category") onCancel();
      else if (stage === "tag") {
        setStage("category");
        requestAnimationFrame(() => boxRef.current?.focus());
      } else if (stage === "input") {
        setStage("tag");
        requestAnimationFrame(() => boxRef.current?.focus());
      } else if (stage === "context") {
        onSubmit({
          category,
          tag: selectedTag,
          text: noteText.trim(),
        });
      }
      return;
    }

    if (stage === "category") {
      if (e.key === "Tab" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = DISTRACT_CATEGORIES.indexOf(category);
        const step = e.shiftKey || e.key === "ArrowLeft" ? -1 : 1;
        setCategory(
          DISTRACT_CATEGORIES[
            (idx + step + DISTRACT_CATEGORIES.length) %
              DISTRACT_CATEGORIES.length
          ],
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        enterTagStage(category);
        return;
      }
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        enterTagStage(DISTRACT_CATEGORIES[Number(e.key) - 1]);
      }
      return;
    }

    if (stage === "tag") {
      const addTagOptionIdx = 1 + categoryTags.length;
      const totalTagOptions = addTagOptionIdx + 1;
      if (e.key === "Tab" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey || e.key === "ArrowLeft" ? -1 : 1;
        const nextIdx = (tagIdx + step + totalTagOptions) % totalTagOptions;
        setTagIdx(nextIdx);
        setSelectedTag(
          nextIdx === 0 || nextIdx === addTagOptionIdx
            ? ""
            : categoryTags[nextIdx - 1]?.name || "",
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (tagIdx === addTagOptionIdx) {
          setAddingTag(true);
          requestAnimationFrame(() => newTagInputRef.current?.focus());
        } else {
          confirmTagByIndex(tagIdx).catch(() => {});
        }
      }
      return;
    }

    if (stage === "input") {
      if (e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (popularEntries.length === 0) {
          noteInputRef.current?.focus();
          return;
        }
        const total = popularEntries.length + 1;
        const curPos = focusedEntryIdx + 1;
        const back = e.shiftKey || e.key === "ArrowUp";
        const nextIdx = ((curPos + (back ? -1 : 1) + total) % total) - 1;
        setFocusedEntryIdx(nextIdx);
        if (nextIdx === -1) {
          requestAnimationFrame(() => noteInputRef.current?.focus());
        } else {
          noteInputRef.current?.blur();
          boxRef.current?.focus();
          requestAnimationFrame(() =>
            entryRowRefs.current[nextIdx]?.scrollIntoView({ block: "nearest" }),
          );
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (focusedEntryIdx >= 0 && popularEntries[focusedEntryIdx]) {
          advanceFromInput(popularEntries[focusedEntryIdx]);
        } else {
          advanceFromInput();
        }
        return;
      }
      if (
        e.key === " " &&
        focusedEntryIdx >= 0 &&
        popularEntries[focusedEntryIdx]
      ) {
        e.preventDefault();
        setNoteText(popularEntries[focusedEntryIdx]);
        setFocusedEntryIdx(-1);
        requestAnimationFrame(() => noteInputRef.current?.focus());
      }
      return;
    }

    if (stage === "context") {
      if (e.key === "Tab") {
        e.preventDefault();
        if (topContexts.length === 0) {
          contextInputRef.current?.focus();
          return;
        }
        const total = topContexts.length + 1;
        const curPos = focusedContextIdx + 1;
        const nextIdx = ((curPos + (e.shiftKey ? -1 : 1) + total) % total) - 1;
        setFocusedContextIdx(nextIdx);
        if (nextIdx === -1) {
          requestAnimationFrame(() => contextInputRef.current?.focus());
        } else {
          contextInputRef.current?.blur();
          boxRef.current?.focus();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosenContext =
          focusedContextIdx >= 0 && topContexts[focusedContextIdx]
            ? topContexts[focusedContextIdx]
            : contextText.trim();
        onSubmit({
          category,
          tag: selectedTag,
          text: noteText.trim(),
          newContext: chosenContext || undefined,
        });
      }
    }
  };

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="stop-box"
    >
      <div className="stop-box-header">
        <span className="stop-box-title">⠿ {t.distractionTitle}</span>
        <button className="ghost-btn" onClick={onCancel}>
          ✕
        </button>
      </div>

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

      {/* 4 Kategori Seçici */}
      <div className="cat5-grid">
        {DISTRACT_CATEGORIES.map((cat) => {
          const isSel = category === cat;
          const addsPen = doesCategoryAddPenalty(cat);
          return (
            <button
              key={cat}
              type="button"
              tabIndex={-1}
              className={`cat5-btn ${isSel ? "active" : ""} ${
                addsPen ? "has-pen" : "zero-pen"
              }`}
              onClick={() => enterTagStage(cat)}
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

      {stage === "tag" && (
        <div className="qc-tags-row">
          <button
            type="button"
            tabIndex={-1}
            className={`qc-tag-chip ${tagIdx === 0 ? "selected" : ""}`}
            onClick={() => confirmTagByIndex(0).catch(() => {})}
          >
            {t.noTagLabel}
          </button>
          {categoryTags.map((tagItem, idx) => (
            <button
              key={tagItem.id}
              type="button"
              tabIndex={-1}
              className={`qc-tag-chip ${tagIdx === idx + 1 ? "selected" : ""}`}
              onClick={() => confirmTagByIndex(idx + 1).catch(() => {})}
            >
              {tagItem.name}
            </button>
          ))}
          {addingTag ? (
            <div className="qc-tag-inline-form">
              <input
                ref={newTagInputRef}
                type="text"
                className="qc-tag-inline-input"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder={t.newTagPlaceholder}
                autoFocus
                maxLength={24}
              />
              <button
                type="button"
                className="qc-tag-inline-btn save"
                onClick={() => handleSaveNewTag().catch(() => {})}
              >
                ✓
              </button>
              <button
                type="button"
                className="qc-tag-inline-btn cancel"
                onClick={() => {
                  setAddingTag(false);
                  setNewTagInput("");
                  requestAnimationFrame(() => boxRef.current?.focus());
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              className={`qc-tag-chip add-chip ${
                tagIdx === 1 + categoryTags.length ? "selected" : ""
              }`}
              onClick={() => {
                setTagIdx(1 + categoryTags.length);
                setAddingTag(true);
                requestAnimationFrame(() => newTagInputRef.current?.focus());
              }}
            >
              {t.addNewTagBtn}
            </button>
          )}
        </div>
      )}

      {stage === "input" && (
        <>
          <div className="qc-step-hint">
            <span>
              {getCategoryDisplayName(category)} •{" "}
              {selectedTag || t.noTagLabel}
            </span>
          </div>
          <div className="new-reason-row">
            <input
              ref={noteInputRef}
              type="text"
              className={`distract-textarea ${
                focusedEntryIdx === -1 ? "is-focused" : ""
              }`}
              placeholder={t.qcInputPlaceholders[category]}
              value={noteText}
              onFocus={() => setFocusedEntryIdx(-1)}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={240}
            />
            <button
              type="button"
              className="primary-btn"
              onClick={() => advanceFromInput()}
            >
              {doesCategoryAddPenalty(category)
                ? t.saveAndAddMin(distractPenaltyMins)
                : t.feedbackSaveBtn}
            </button>
          </div>
          {popularEntries.length > 0 && (
            <div className="qc-entries-box">
              <div className="qc-entries-header">{t.popularEntriesLabel}</div>
              <div className="qc-entries-list">
                {popularEntries.map((entry, idx) => {
                  const isFocused = focusedEntryIdx === idx;
                  return (
                    <button
                      key={`${entry}-${idx}`}
                      ref={(el) => {
                        entryRowRefs.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      className={`qc-entry-row ${isFocused ? "selected" : ""}`}
                      onClick={() => advanceFromInput(entry)}
                    >
                      <span className="qc-entry-idx">
                        {isFocused ? "▶" : `${idx + 1}.`}
                      </span>
                      <span className="qc-entry-text">{entry}</span>
                      <span className="qc-entry-hint">
                        {isFocused ? "Enter ↵" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {stage === "context" && (
        <>
          <div className="qc-step-hint">
            <span>
              🎯 {t.qcContextHeader}: <b>{noteText}</b>
            </span>
          </div>
          <div className="new-reason-row">
            <input
              ref={contextInputRef}
              type="text"
              className="distract-textarea"
              placeholder={t.qcContextPlaceholder}
              value={contextText}
              onFocus={() => setFocusedContextIdx(-1)}
              onChange={(e) => setContextText(e.target.value)}
              maxLength={120}
            />
            <button
              type="button"
              className="primary-btn"
              onClick={() =>
                onSubmit({
                  category,
                  tag: selectedTag,
                  text: noteText.trim(),
                  newContext: contextText.trim() || undefined,
                })
              }
            >
              ✓
            </button>
          </div>
          {topContexts.length > 0 && (
            <div className="qc-recent-row">
              <span className="qc-muted">{t.qcRecentContextsLabel}</span>
              <div className="qc-recent-chips">
                {topContexts.map((ctx, idx) => (
                  <button
                    key={ctx}
                    type="button"
                    tabIndex={-1}
                    className={`qc-recent-chip ${
                      focusedContextIdx === idx ? "selected" : ""
                    }`}
                    onClick={() =>
                      onSubmit({
                        category,
                        tag: selectedTag,
                        text: noteText.trim(),
                        newContext: ctx,
                      })
                    }
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="stop-box-actions">
        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
          {stage === "category"
            ? t.qcStepCategoryHint
            : stage === "tag"
              ? t.qcStepTagHint
              : stage === "input"
                ? t.qcStepInputHint
                : t.qcStepContextHint}
        </span>
        <button type="button" onClick={onCancel}>
          {t.cancel}
        </button>
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
  source?: "break" | "work_pause";
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
  source = "break",
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
        <span className="stop-box-title">
          {source === "work_pause"
            ? t.workPauseOverdueTitle
            : t.breakOverdueTitle}
        </span>
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
        {source === "work_pause"
          ? t.workPauseOverdueDesc(formatClock(totalOvertimeSec))
          : t.breakOverdueDesc(formatClock(totalOvertimeSec))}
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
            if (e.key === "Escape") {
              onSubmit(true);
            }
          }}
        />
      </div>

      <div className="stop-box-actions">
        <button className="primary-btn" onClick={() => onSubmit(false)}>
          {source === "work_pause" ? t.saveAndResumeWork : t.saveAndStartWork}
        </button>
        <button onClick={() => onSubmit(true)}>
          {source === "work_pause" ? t.skipAndResumeWork : t.skipAndStartWork}
        </button>
      </div>
    </div>
  );
}

export interface LightboxModalProps {
  entry: WorkStoryEntry;
  entries?: WorkStoryEntry[];
  t: Translations;
  onSelectEntry?: (entry: WorkStoryEntry) => void;
  onClose: () => void;
  onDelete: (id: number) => void;
}

export function LightboxModal({
  entry,
  entries,
  t,
  onSelectEntry,
  onClose,
  onDelete,
}: LightboxModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const groupList = entries && entries.length > 1 ? entries : null;
  const curIdx = groupList
    ? Math.max(
        0,
        groupList.findIndex((item) => item.id === entry.id),
      )
    : 0;

  useEffect(() => {
    if (!isPlaying || !groupList || !onSelectEntry) return;
    const timer = window.setInterval(() => {
      onSelectEntry(groupList[(curIdx + 1) % groupList.length]);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isPlaying, groupList, curIdx, onSelectEntry]);

  return (
    <div className="lightbox-overlay no-drag" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-header">
          <span className="lightbox-title">
            📸 {new Date(entry.created_at).toLocaleString()}
            {groupList ? ` (${curIdx + 1}/${groupList.length})` : ""}
          </span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {groupList && onSelectEntry && (
              <>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setIsPlaying(false);
                    onSelectEntry(
                      groupList[(curIdx - 1 + groupList.length) % groupList.length],
                    );
                  }}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setIsPlaying((p) => !p)}
                >
                  {isPlaying ? t.storyPauseBtn : t.storyPlayBtn}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setIsPlaying(false);
                    onSelectEntry(groupList[(curIdx + 1) % groupList.length]);
                  }}
                >
                  ▶
                </button>
              </>
            )}
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
          {entry.work_tag && (
            <div className="lightbox-meta-item">
              💼 <b>{t.topicShortLabel}:</b> {entry.work_tag}
            </div>
          )}
          {entry.context_text && (
            <div className="lightbox-meta-item">
              🎯 <b>{t.contextShortLabel}:</b> {entry.context_text}
            </div>
          )}
          {entry.active_app && (
            <div className="lightbox-meta-item">
              🌐 <b>{t.qcActiveTabLabel}:</b> {entry.active_app}
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
