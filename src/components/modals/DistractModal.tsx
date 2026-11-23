import { useEffect, useRef, useState } from "react";
import {
  addCategoryTag,
  DistractionCategory,
  doesCategoryAddPenalty,
  getCategoryTagsByPopularity,
  getTopCategoryReasons,
  TagItem,
} from "../../db";
import type { Translations } from "../../i18n";
import { DISTRACT_CATEGORIES } from "../../constants";
import { IconCheck, IconClose } from "../Icons";

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
  canShowStuckRescue?: boolean;
  onOpenStuckRescue?: () => void;
  isWarmupPhase?: boolean;
  onPreferredHeightChange?: (height: number) => void;
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
  canShowStuckRescue,
  onOpenStuckRescue,
  isWarmupPhase = false,
  onPreferredHeightChange,
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
  const reasonsSeqRef = useRef<number>(0);

  useEffect(() => {
    requestAnimationFrame(() => boxRef.current?.focus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCategoryTagsByPopularity(category, t.defaultCategoryTags[category])
      .then((loaded) => {
        if (!cancelled) setCategoryTags(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [category, t]);

  const enterTagStage = (cat: DistractionCategory) => {
    if (cat !== category) {
      setCategoryTags([]);
    }
    setCategory(cat);
    setTagIdx(0);
    setSelectedTag("");
    setAddingTag(false);
    setNewTagInput("");
    setPopularEntries([]);
    setStage("tag");
    requestAnimationFrame(() => boxRef.current?.focus());
  };

  const confirmTagByIndex = async (idx: number) => {
    const seq = ++reasonsSeqRef.current;
    const chosen = idx <= 0 ? "" : categoryTags[idx - 1]?.name || "";
    setTagIdx(idx);
    setSelectedTag(chosen);
    setFocusedEntryIdx(-1);
    setPopularEntries([]);
    setStage("input");
    if (doesCategoryAddPenalty(category)) {
      const entries = await getTopCategoryReasons(category, chosen, 5).catch(
        () => [],
      );
      if (reasonsSeqRef.current === seq) {
        setPopularEntries(entries.slice(0, 5));
      }
    }
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

  useEffect(() => {
    if (!onPreferredHeightChange) return;
    const hasAppStrip = Boolean(
      detectedActiveApp.appName || detectedActiveApp.windowTitle,
    );
    const base = 224 + (hasAppStrip ? 18 : 0) + (isWarmupPhase ? 34 : 0);
    let nextH = base + 14;
    if (stage === "tag") {
      nextH = base + (addingTag ? 102 : 78);
    } else if (stage === "input") {
      const hasSug =
        doesCategoryAddPenalty(category) && popularEntries.length > 0;
      nextH = hasSug
        ? base + 108 + Math.min(5, popularEntries.length) * 29
        : base + 74;
    } else if (stage === "context") {
      nextH = base + 74 + (topContexts.length > 0 ? 64 : 0);
    }
    onPreferredHeightChange(nextH);
  }, [
    onPreferredHeightChange,
    stage,
    category,
    popularEntries.length,
    topContexts.length,
    addingTag,
    isWarmupPhase,
    detectedActiveApp.appName,
    detectedActiveApp.windowTitle,
  ]);

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
        <span className="stop-box-title">{t.distractionTitle}</span>
        <button className="ghost-btn" onClick={onCancel}>
          <IconClose size={11} />
        </button>
      </div>

      <div className="stop-box-body">
        <div className="active-app-strip">
          <div
            className="active-app-strip-row"
            title={`${t.qcCurrentContextLabel}: ${
              currentContext || fullTopicLabel
            }`}
          >
            <span className="strip-label">{t.qcCurrentContextLabel}:</span>{" "}
            <span>{currentContext || fullTopicLabel}</span>
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
              <span className="strip-label">{t.qcActiveTabLabel}:</span>{" "}
              <span>
                {detectedActiveApp.appName}
                {detectedActiveApp.windowTitle
                  ? ` — ${detectedActiveApp.windowTitle}`
                  : ""}
              </span>
            </div>
          )}
        </div>

        {isWarmupPhase && (
          <div className="warmup-no-penalty-note">{t.warmupNoPenaltyBadge}</div>
        )}

        <div className="cat5-grid">
          {DISTRACT_CATEGORIES.map((cat) => {
            const isSel = category === cat;
            const addsPen = !isWarmupPhase && doesCategoryAddPenalty(cat);
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
                  <IconCheck size={10} />
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
                  <IconClose size={10} />
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
                {!isWarmupPhase && doesCategoryAddPenalty(category)
                  ? t.saveAndAddMin(distractPenaltyMins)
                  : t.feedbackSaveBtn}
              </button>
            </div>
            {doesCategoryAddPenalty(category) && popularEntries.length > 0 && (
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
                        title={entry}
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
                {t.qcContextHeader}: <b>{noteText}</b>
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
                <IconCheck size={12} />
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
      </div>

      <div className="stop-box-actions">
        <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
          {stage === "category"
            ? t.qcStepCategoryHint
            : stage === "tag"
              ? t.qcStepTagHint
              : stage === "input"
                ? doesCategoryAddPenalty(category) && popularEntries.length > 0
                  ? t.qcStepInputHint
                  : t.qcStepInputNoSuggestionsHint
                : t.qcStepContextHint}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {canShowStuckRescue && onOpenStuckRescue && (
            <button
              type="button"
              className="stuck-link-btn"
              onClick={onOpenStuckRescue}
            >
              {t.stuckBtnLabel}
            </button>
          )}
          <button type="button" onClick={onCancel}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
