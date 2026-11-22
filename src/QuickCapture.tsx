import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  addCategoryTag,
  deleteTag,
  DistractionCategory,
  doesCategoryAddPenalty,
  getCategoryTagsByPopularity,
  getTopCategoryReasons,
  TagItem,
  TagKind,
  updateTag,
} from "./db";
import { ActiveLang, translations } from "./i18n";
import { DISTRACT_CATEGORIES } from "./constants";
import { isLightColor } from "./lib/color";
import { IconCheck, IconClose, IconEdit } from "./components/Icons";

interface FrontendContextSnapshot {
  currentContext: string;
  workTag: string;
  workReason: string;
  sessionActive: boolean;
  timerMode: string;
  distractPenaltyMins: number;
  lang: string;
  bgColor: string;
  recentContexts: string[];
  uiScale?: number;
}

interface CaptureOpenPayload {
  mode: "distraction" | "context";
  openSeq: number;
  activeApp: string;
  activeWindow: string;
  snapshot: FrontendContextSnapshot;
}

export interface CaptureSubmittedEvent {
  mode: "distraction" | "context";
  category?: DistractionCategory;
  tag?: string;
  text: string;
  newContext?: string;
  activeApp: string;
  activeWindow: string;
}

type CaptureStage = "category" | "tag" | "input" | "context" | "reminder";

function matchCategoryKey(key: string): DistractionCategory | null {
  const k = key.toLocaleLowerCase("tr-TR");
  if (k === "1" || k === "g" || k === "t") return "impulsive_task";
  if (k === "2" || k === "f") return "idea";
  if (k === "3" || k === "i" || k === "ı") return "internal";
  if (k === "4" || k === "d" || k === "e") return "external";
  return null;
}

export default function QuickCapture() {
  const [payload, setPayload] = useState<CaptureOpenPayload>({
    mode: "distraction",
    openSeq: 0,
    activeApp: "",
    activeWindow: "",
    snapshot: {
      currentContext: "",
      workTag: "Ders",
      workReason: "",
      sessionActive: false,
      timerMode: "work",
      distractPenaltyMins: 1,
      lang: "tr",
      bgColor: "#1a1814",
      recentContexts: [],
    },
  });

  const [stage, setStage] = useState<CaptureStage>("category");
  const [category, setCategory] =
    useState<DistractionCategory>("impulsive_task");
  const [categoryTags, setCategoryTags] = useState<TagItem[]>([]);
  const [tagIdx, setTagIdx] = useState<number>(0); // 0 = No Tag
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [addingTag, setAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [editingTags, setEditingTags] = useState(false);
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null);
  const [renameTagDraft, setRenameTagDraft] = useState("");

  const [text, setText] = useState("");
  const [popularEntries, setPopularEntries] = useState<string[]>([]);
  const [focusedEntryIdx, setFocusedEntryIdx] = useState<number>(-1); // -1 = input

  const [contextText, setContextText] = useState("");
  const [focusedContextIdx, setFocusedContextIdx] = useState<number>(-1); // -1 = input

  const shellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const entryRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reminderTimerRef = useRef<number | null>(null);

  const lang: ActiveLang = payload.snapshot.lang === "en" ? "en" : "tr";
  const t = translations[lang];
  const uiScaleMult = Math.max(1, (payload?.snapshot?.uiScale ?? 100) / 100);

  const clearReminderTimer = () => {
    if (reminderTimerRef.current) {
      window.clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
  };

  const closeAndRestore = () => {
    clearReminderTimer();
    invoke("close_capture_and_restore_focus").catch(() => {});
  };

  const resizeForStage = (
    nextStage: CaptureStage,
    scalePct?: number,
    hasSuggestions?: boolean,
    entryCount = 0,
  ) => {
    const mult = Math.max(1, (scalePct ?? 100) / 100);
    const dims =
      nextStage === "reminder"
        ? { w: 540, h: 205 }
        : nextStage === "input"
          ? hasSuggestions && entryCount > 0
            ? { w: 580, h: 252 + Math.min(5, entryCount) * 34 }
            : { w: 580, h: 248 }
          : nextStage === "context"
            ? { w: 580, h: 325 }
            : { w: 580, h: 280 };
    invoke("set_capture_window_size", {
      width: Math.round(dims.w * mult),
      height: Math.round(dims.h * mult),
    }).catch(() => {});
  };

  const getCategoryLabel = (c: DistractionCategory): string => {
    switch (c) {
      case "impulsive_task":
        return t.catImpulsiveTask;
      case "idea":
        return t.catIdea;
      case "internal":
        return t.catInternal;
      case "external":
        return t.catExternal;
    }
  };

  const loadTagsForCategory = async (cat: DistractionCategory, l: ActiveLang) => {
    const trObj = translations[l];
    const loaded = await getCategoryTagsByPopularity(
      cat,
      trObj.defaultCategoryTags[cat],
    );
    setCategoryTags(loaded);
  };

  const applyOpenPayload = (next: CaptureOpenPayload) => {
    clearReminderTimer();
    setPayload(next);
    setCategory("impulsive_task");
    setTagIdx(0);
    setSelectedTag("");
    setAddingTag(false);
    setNewTagInput("");
    setEditingTags(false);
    setRenamingTagId(null);
    setRenameTagDraft("");
    setText("");
    setPopularEntries([]);
    setFocusedEntryIdx(-1);
    setContextText(next.snapshot.currentContext || "");
    setFocusedContextIdx(-1);
    setStage("category");
    resizeForStage("category", next.snapshot.uiScale);

    const nextLang: ActiveLang = next.snapshot.lang === "en" ? "en" : "tr";
    loadTagsForCategory("impulsive_task", nextLang).catch(() => {});

    requestAnimationFrame(() => {
      shellRef.current?.focus();
    });
  };

  useEffect(() => {
    invoke<CaptureOpenPayload>("get_capture_open_payload")
      .then((initial) => {
        applyOpenPayload(initial);
      })
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    listen<CaptureOpenPayload>("open-capture", (ev) => {
      applyOpenPayload(ev.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
      clearReminderTimer();
    };
  }, []);

  useEffect(() => {
    resizeForStage(
      stage,
      payload?.snapshot?.uiScale,
      doesCategoryAddPenalty(category),
      popularEntries.length,
    );
  }, [stage, category, popularEntries.length, payload?.snapshot?.uiScale]);

  useEffect(() => {
    document.documentElement.style.zoom = "";
    if (payload?.snapshot?.uiScale !== undefined) {
      invoke("set_window_zoom", { zoom: uiScaleMult }).catch(() => {});
    }
  }, [uiScaleMult, payload?.snapshot?.uiScale]);

  useEffect(() => {
    if (stage === "tag") {
      loadTagsForCategory(category, lang).catch(() => {});
    }
  }, [category, stage, lang]);

  const enterTagStage = (targetCat: DistractionCategory) => {
    setCategory(targetCat);
    setTagIdx(0);
    setSelectedTag("");
    setAddingTag(false);
    setNewTagInput("");
    setEditingTags(false);
    setRenamingTagId(null);
    setRenameTagDraft("");
    setPopularEntries([]);
    setStage("tag");
    loadTagsForCategory(targetCat, lang).catch(() => {});
    requestAnimationFrame(() => {
      shellRef.current?.focus();
    });
  };

  const enterInputStage = async (tagValue: string) => {
    setSelectedTag(tagValue);
    setFocusedEntryIdx(-1);
    setStage("input");
    if (doesCategoryAddPenalty(category)) {
      const entries = await getTopCategoryReasons(category, tagValue, 5).catch(
        () => [],
      );
      setPopularEntries(entries.slice(0, 5));
    } else {
      setPopularEntries([]);
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const confirmTagByIndex = (idx: number) => {
    const chosen = idx <= 0 ? "" : categoryTags[idx - 1]?.name || "";
    setTagIdx(idx);
    enterInputStage(chosen).catch(() => {});
  };

  const handleSaveNewTag = async () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) {
      setAddingTag(false);
      setNewTagInput("");
      requestAnimationFrame(() => shellRef.current?.focus());
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
    requestAnimationFrame(() => shellRef.current?.focus());
  };

  const handleSaveRenameTag = async (tagId: number) => {
    const trimmed = renameTagDraft.trim();
    if (trimmed) {
      const kind = `distraction_${category}` as TagKind;
      await updateTag(tagId, trimmed, kind);
      const updated = await getCategoryTagsByPopularity(
        category,
        t.defaultCategoryTags[category],
      );
      setCategoryTags(updated);
    }
    setRenamingTagId(null);
    setRenameTagDraft("");
    requestAnimationFrame(() => shellRef.current?.focus());
  };

  const handleDeleteCategoryTag = async (tagId: number) => {
    await deleteTag(tagId);
    const updated = await getCategoryTagsByPopularity(
      category,
      t.defaultCategoryTags[category],
    );
    setCategoryTags(updated);
    if (renamingTagId === tagId) {
      setRenamingTagId(null);
      setRenameTagDraft("");
    }
    setTagIdx((prev) => Math.min(prev, updated.length));
    requestAnimationFrame(() => shellRef.current?.focus());
  };

  const effectiveContext =
    payload.snapshot.currentContext.trim() ||
    (payload.snapshot.workTag
      ? `${payload.snapshot.workTag}${
          payload.snapshot.workReason ? `: ${payload.snapshot.workReason}` : ""
        }`
      : "");

  const isOffSession = !payload.snapshot.sessionActive;

  const emitDistractionAndFinish = async (
    finalNote: string,
    updatedContext?: string,
  ) => {
    const msg: CaptureSubmittedEvent = {
      mode: "distraction",
      category,
      tag: selectedTag || undefined,
      text: finalNote,
      newContext: updatedContext ? updatedContext.trim() : undefined,
      activeApp: payload.activeApp,
      activeWindow: payload.activeWindow,
    };
    await emitTo("main", "capture-submitted", msg).catch(() => {});

    const isTrigger = category === "internal" || category === "external";
    if (!isOffSession && !isTrigger && effectiveContext) {
      setStage("reminder");
      reminderTimerRef.current = window.setTimeout(() => {
        closeAndRestore();
      }, 1700);
    } else {
      closeAndRestore();
    }
  };

  const advanceFromInput = async (overrideNote?: string) => {
    const finalNote = (
      overrideNote !== undefined ? overrideNote : text
    ).trim();
    if (!finalNote) return;

    setText(finalNote);
    if (!isOffSession && (category === "internal" || category === "external")) {
      setContextText(payload.snapshot.currentContext || "");
      setFocusedContextIdx(-1);
      setStage("context");
      requestAnimationFrame(() => {
        contextInputRef.current?.focus();
        contextInputRef.current?.select();
      });
    } else {
      await emitDistractionAndFinish(finalNote);
    }
  };

  const recentContexts = payload.snapshot.recentContexts.slice(0, 5);

  const handleShellKeyDown = (e: React.KeyboardEvent) => {
    if (stage === "reminder") {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closeAndRestore();
      }
      return;
    }

    if (addingTag) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAddingTag(false);
        setNewTagInput("");
        requestAnimationFrame(() => shellRef.current?.focus());
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveNewTag().catch(() => {});
      }
      return;
    }

    if (renamingTagId !== null) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setRenamingTagId(null);
        setRenameTagDraft("");
        requestAnimationFrame(() => shellRef.current?.focus());
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRenameTag(renamingTagId).catch(() => {});
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (stage === "tag" && editingTags) {
        setEditingTags(false);
        requestAnimationFrame(() => shellRef.current?.focus());
        return;
      }
      if (stage === "category") {
        closeAndRestore();
      } else if (stage === "tag") {
        setStage("category");
        requestAnimationFrame(() => shellRef.current?.focus());
      } else if (stage === "input") {
        setStage("tag");
        requestAnimationFrame(() => shellRef.current?.focus());
      } else if (stage === "context") {
        // Save the distraction even if user skips context update
        emitDistractionAndFinish(text.trim(), undefined).catch(() => {});
      }
      return;
    }

    if (stage === "category") {
      if (e.key === "Tab" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = DISTRACT_CATEGORIES.indexOf(category);
        const step = e.shiftKey || e.key === "ArrowLeft" ? -1 : 1;
        const nextIdx =
          (idx + step + DISTRACT_CATEGORIES.length) %
          DISTRACT_CATEGORIES.length;
        setCategory(DISTRACT_CATEGORIES[nextIdx]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        enterTagStage(category);
        return;
      }
      const matched = matchCategoryKey(e.key);
      if (matched) {
        e.preventDefault();
        enterTagStage(matched);
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
          confirmTagByIndex(tagIdx);
        }
        return;
      }
      return;
    }

    if (stage === "input") {
      if (e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (popularEntries.length === 0) {
          inputRef.current?.focus();
          return;
        }
        const total = popularEntries.length + 1; // -1 mapped as index 0
        const currentPos = focusedEntryIdx + 1; // 0 = input, 1..N = entries
        const back = e.shiftKey || e.key === "ArrowUp";
        const nextPos = (currentPos + (back ? -1 : 1) + total) % total;
        const nextIdx = nextPos - 1;
        setFocusedEntryIdx(nextIdx);
        if (nextIdx === -1) {
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          inputRef.current?.blur();
          shellRef.current?.focus();
          requestAnimationFrame(() =>
            entryRowRefs.current[nextIdx]?.scrollIntoView({ block: "nearest" }),
          );
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (focusedEntryIdx >= 0 && popularEntries[focusedEntryIdx]) {
          advanceFromInput(popularEntries[focusedEntryIdx]).catch(() => {});
        } else {
          advanceFromInput().catch(() => {});
        }
        return;
      }
      if (e.key === " " && focusedEntryIdx >= 0 && popularEntries[focusedEntryIdx]) {
        e.preventDefault();
        setText(popularEntries[focusedEntryIdx]);
        setFocusedEntryIdx(-1);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      if (
        focusedEntryIdx >= 0 &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        setFocusedEntryIdx(-1);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return;
    }

    if (stage === "context") {
      if (e.key === "Tab") {
        e.preventDefault();
        if (recentContexts.length === 0) {
          contextInputRef.current?.focus();
          return;
        }
        const total = recentContexts.length + 1;
        const currentPos = focusedContextIdx + 1;
        const nextPos = (currentPos + (e.shiftKey ? -1 : 1) + total) % total;
        const nextIdx = nextPos - 1;
        setFocusedContextIdx(nextIdx);
        if (nextIdx === -1) {
          requestAnimationFrame(() => contextInputRef.current?.focus());
        } else {
          contextInputRef.current?.blur();
          shellRef.current?.focus();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosenContext =
          focusedContextIdx >= 0 && recentContexts[focusedContextIdx]
            ? recentContexts[focusedContextIdx]
            : contextText.trim();
        emitDistractionAndFinish(text.trim(), chosenContext).catch(() => {});
        return;
      }
      if (
        e.key === " " &&
        focusedContextIdx >= 0 &&
        recentContexts[focusedContextIdx]
      ) {
        e.preventDefault();
        setContextText(recentContexts[focusedContextIdx]);
        setFocusedContextIdx(-1);
        requestAnimationFrame(() => contextInputRef.current?.focus());
        return;
      }
      if (
        focusedContextIdx >= 0 &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        setFocusedContextIdx(-1);
        requestAnimationFrame(() => contextInputRef.current?.focus());
      }
    }
  };

  const isLight = isLightColor(payload.snapshot.bgColor);
  const addsPenalty = doesCategoryAddPenalty(category);
  const penaltyMins = payload.snapshot.distractPenaltyMins;
  const activeTabDisplay =
    payload.activeApp && payload.activeWindow
      ? `${payload.activeApp} — ${payload.activeWindow}`
      : payload.activeApp || payload.activeWindow || "—";

  const footerHint =
    stage === "category"
      ? t.qcStepCategoryHint
      : stage === "tag"
        ? t.qcStepTagHint
        : stage === "input"
          ? addsPenalty && popularEntries.length > 0
            ? t.qcStepInputHint
            : t.qcStepInputNoSuggestionsHint
          : t.qcStepContextHint;

  const handleShellMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "button, input, textarea, select, a, [role='button'], .no-drag, .qc-reminder-card",
      )
    ) {
      return;
    }
    shellRef.current?.focus();
    getCurrentWindow()
      .startDragging()
      .catch(() => {});
  };

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={handleShellKeyDown}
      onMouseDown={handleShellMouseDown}
      className={`qc-shell ${isLight ? "light-theme" : ""}`}
      style={
        {
          "--qc-bg": payload.snapshot.bgColor || "#1a1814",
        } as React.CSSProperties
      }
    >
      {stage === "reminder" ? (
        <div className="qc-reminder-card" onClick={closeAndRestore}>
          <div className="qc-reminder-header">{t.qcReminderTitle}</div>
          <div className="qc-reminder-context">
            {effectiveContext || t.qcContextNone}
          </div>
          {activeTabDisplay !== "—" && (
            <div className="qc-reminder-sub">🌐 {activeTabDisplay}</div>
          )}
          <div className="qc-reminder-hint">{t.qcReminderCloseHint}</div>
        </div>
      ) : (
        <>
          <div className="qc-top-strip">
            <div
              className="qc-context-pill"
              title={isOffSession ? t.qcOffSessionLabel : effectiveContext}
            >
              {isOffSession ? (
                <span>⠿ {t.qcOffSessionLabel}</span>
              ) : (
                <>
                  <span className="qc-muted">
                    ⠿ 🎯 {t.qcCurrentContextLabel}:
                  </span>{" "}
                  <span>{effectiveContext || t.qcContextNone}</span>
                </>
              )}
            </div>
            <div className="qc-tab-pill" title={activeTabDisplay}>
              <span className="qc-muted">🌐 {t.qcActiveTabLabel}:</span>{" "}
              <span>{activeTabDisplay}</span>
            </div>
          </div>

          <div className="qc-cat-row">
            {DISTRACT_CATEGORIES.map((cat) => {
              const isParking = !doesCategoryAddPenalty(cat) || isOffSession;
              const selected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  tabIndex={-1}
                  className={`qc-cat-pill ${selected ? "selected" : ""} ${
                    isParking ? "parking" : "penalty"
                  }`}
                  onClick={() => enterTagStage(cat)}
                >
                  <span className="qc-key-badge">{t.catKeyHints[cat]}</span>
                  <span className="qc-cat-name">{getCategoryLabel(cat)}</span>
                </button>
              );
            })}
          </div>

          {stage === "tag" && (
            <div className="qc-tags-row">
              {!editingTags && (
                <button
                  type="button"
                  tabIndex={-1}
                  className={`qc-tag-chip ${tagIdx === 0 ? "selected" : ""}`}
                  onClick={() => confirmTagByIndex(0)}
                >
                  {t.noTagLabel}
                </button>
              )}
              {categoryTags.map((tagItem, idx) =>
                editingTags && renamingTagId === tagItem.id ? (
                  <div key={tagItem.id} className="qc-tag-inline-form">
                    <input
                      type="text"
                      className="qc-tag-inline-input"
                      value={renameTagDraft}
                      onChange={(e) => setRenameTagDraft(e.target.value)}
                      autoFocus
                      maxLength={24}
                    />
                    <button
                      type="button"
                      className="qc-tag-inline-btn save"
                      onClick={() =>
                        handleSaveRenameTag(tagItem.id).catch(() => {})
                      }
                    >
                      <IconCheck size={10} />
                    </button>
                    <button
                      type="button"
                      className="qc-tag-inline-btn cancel"
                      onClick={() => {
                        setRenamingTagId(null);
                        setRenameTagDraft("");
                        requestAnimationFrame(() => shellRef.current?.focus());
                      }}
                    >
                      <IconClose size={10} />
                    </button>
                  </div>
                ) : editingTags ? (
                  <span key={tagItem.id} className="qc-tag-chip editing">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="qc-tag-rename-btn"
                      onClick={() => {
                        setRenamingTagId(tagItem.id);
                        setRenameTagDraft(tagItem.name);
                      }}
                      title={t.tagManagerHint}
                    >
                      {tagItem.name}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="qc-tag-del-btn"
                      onClick={() =>
                        handleDeleteCategoryTag(tagItem.id).catch(() => {})
                      }
                      title={t.cancel}
                    >
                      <IconClose size={9} />
                    </button>
                  </span>
                ) : (
                  <button
                    key={tagItem.id}
                    type="button"
                    tabIndex={-1}
                    className={`qc-tag-chip ${tagIdx === idx + 1 ? "selected" : ""}`}
                    onClick={() => confirmTagByIndex(idx + 1)}
                  >
                    {tagItem.name}
                  </button>
                ),
              )}
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
                      requestAnimationFrame(() => shellRef.current?.focus());
                    }}
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              ) : (
                !editingTags && (
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`qc-tag-chip add-chip ${
                      tagIdx === 1 + categoryTags.length ? "selected" : ""
                    }`}
                    onClick={() => {
                      setTagIdx(1 + categoryTags.length);
                      setAddingTag(true);
                      requestAnimationFrame(() =>
                        newTagInputRef.current?.focus(),
                      );
                    }}
                  >
                    {t.addNewTagBtn}
                  </button>
                )
              )}
              {!addingTag && (
                <button
                  type="button"
                  tabIndex={-1}
                  className={`qc-tag-chip edit-chip ${editingTags ? "active" : ""}`}
                  onClick={() => {
                    const next = !editingTags;
                    setEditingTags(next);
                    setRenamingTagId(null);
                    setRenameTagDraft("");
                    if (!next) {
                      requestAnimationFrame(() => shellRef.current?.focus());
                    }
                  }}
                  title={t.qcEditTagsTooltip}
                >
                  {editingTags ? (
                    <>
                      <IconCheck size={10} />
                      <span>{t.qcDoneEditingTags}</span>
                    </>
                  ) : (
                    <IconEdit size={10} />
                  )}
                </button>
              )}
            </div>
          )}

          {stage === "input" && (
            <>
              <div className="qc-step-hint">
                <span>
                  {getCategoryLabel(category)} •{" "}
                  {selectedTag || t.noTagLabel}
                </span>
              </div>
              <div className="qc-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  className={`qc-single-input ${
                    focusedEntryIdx === -1 ? "is-focused" : ""
                  }`}
                  value={text}
                  onFocus={() => setFocusedEntryIdx(-1)}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t.qcInputPlaceholders[category]}
                  maxLength={240}
                />
                {!isOffSession && (
                  <span
                    className={`qc-penalty-tag ${addsPenalty ? "penalty" : "parking"}`}
                  >
                    {addsPenalty
                      ? t.addsPenaltyBadge(penaltyMins)
                      : t.noPenaltyParkingBadge}
                  </span>
                )}
              </div>

              {addsPenalty && popularEntries.length > 0 && (
                <div className="qc-entries-box">
                  <div className="qc-entries-header">
                    {t.popularEntriesLabel}
                  </div>
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
                          onClick={() => advanceFromInput(entry).catch(() => {})}
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
                  🎯 {t.qcContextHeader} — {getCategoryLabel(category)}:{" "}
                  <strong>{text}</strong>
                </span>
              </div>
              <div className="qc-input-row">
                <input
                  ref={contextInputRef}
                  type="text"
                  className="qc-single-input"
                  value={contextText}
                  onFocus={() => setFocusedContextIdx(-1)}
                  onChange={(e) => setContextText(e.target.value)}
                  placeholder={t.qcContextPlaceholder}
                  maxLength={120}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="primary-btn"
                  onClick={() =>
                    emitDistractionAndFinish(
                      text.trim(),
                      contextText.trim(),
                    ).catch(() => {})
                  }
                >
                  <IconCheck size={13} />
                </button>
              </div>
              {recentContexts.length > 0 && (
                <div className="qc-recent-row">
                  <span className="qc-muted">{t.qcRecentContextsLabel}</span>
                  <div className="qc-recent-chips">
                    {recentContexts.map((ctx, idx) => (
                      <button
                        key={ctx}
                        type="button"
                        tabIndex={-1}
                        className={`qc-recent-chip ${
                          focusedContextIdx === idx ? "selected" : ""
                        }`}
                        onClick={() =>
                          emitDistractionAndFinish(text.trim(), ctx).catch(
                            () => {},
                          )
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

          <div className="qc-footer-hint">
            <span>{footerHint}</span>
            <button
              type="button"
              tabIndex={-1}
              className="qc-close-btn"
              onClick={closeAndRestore}
            >
              <span>Esc</span>
              <IconClose size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
