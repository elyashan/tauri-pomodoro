// @llm-index: Plans, theme, ambient noise, break routines, shortcuts, autostart, updates & tag CRUD
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { disable, enable } from "@tauri-apps/plugin-autostart";
import {
  AmbientNoiseSettings,
  DEFAULT_AMBIENT_NOISE,
  DEFAULT_RESCUE_EXERCISES,
  DEFAULT_SHORTCUTS,
  DEFAULT_STUDY_PLANS,
  DEFAULT_THEME,
  GlobalShortcutSettings,
  RescueExerciseSettings,
  StudyPlan,
  TagItem,
  TagKind,
  ThemeSettings,
  TimerMode,
  addTag,
  deleteTag,
  getTags,
  saveActivePlanId,
  saveAmbientNoiseSettings,
  saveBreakChecklistItems,
  saveGlobalShortcuts,
  saveRescueExerciseSettings,
  saveStudyPlans,
  saveThemeSettings,
  updateTag,
} from "../db";
import {
  ShortcutStatus,
  TagFormState,
  UPDATE_CHECK_INTERVAL_MS,
} from "../constants";
import type { Translations } from "../i18n";
import { ambientNoiseEngine } from "../lib/ambientNoise";
import { UpdateStatus, checkForUpdate, installUpdate } from "../updater";

export interface UseAppSettingsAndTagsParams {
  loaded: boolean;
  t: Translations;
  sessionActive: boolean;
  timerMode: TimerMode;
  isRunning: boolean;
  workElapsedSec: number;
  currentWorkTag: string;
  setCurrentWorkTag: (tag: string) => void;
  setPlanDropdownOpen: (open: boolean) => void;
  setWorkSecondsLeft: (sec: number) => void;
  setBreakTotalSec: (sec: number) => void;
  setBreakSecondsLeft: (sec: number) => void;
  setIsRunning: (v: boolean) => void;
  onSaveBeforeUpdate: () => Promise<void>;
}

export function useAppSettingsAndTags({
  loaded,
  t,
  sessionActive,
  timerMode,
  isRunning,
  workElapsedSec,
  currentWorkTag,
  setCurrentWorkTag,
  setPlanDropdownOpen,
  setWorkSecondsLeft,
  setBreakTotalSec,
  setBreakSecondsLeft,
  setIsRunning,
  onSaveBeforeUpdate,
}: UseAppSettingsAndTagsParams) {
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>(DEFAULT_STUDY_PLANS);
  const [activePlanId, setActivePlanId] = useState<string>("developer");
  const [editingPlanId, setEditingPlanId] = useState<string>("developer");

  const currentPlan =
    studyPlans.find((p) => p.id === activePlanId) ||
    studyPlans[0] ||
    DEFAULT_STUDY_PLANS[0];

  const currentPlanWorkMinsRef = useRef<number>(currentPlan.workMins);
  currentPlanWorkMinsRef.current = currentPlan.workMins;

  const getPlanDisplayName = (plan: StudyPlan): string =>
    plan.name.trim() || t.planNames[plan.id] || plan.id;

  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const themeDirtyRef = useRef(false);
  const [ambientNoise, setAmbientNoise] = useState<AmbientNoiseSettings>(
    DEFAULT_AMBIENT_NOISE,
  );
  const [rescueExercises, setRescueExercises] = useState<RescueExerciseSettings>(
    DEFAULT_RESCUE_EXERCISES,
  );
  const [breakChecklistItems, setBreakChecklistItems] = useState<string[]>([]);

  const [shortcuts, setShortcuts] =
    useState<GlobalShortcutSettings>(DEFAULT_SHORTCUTS);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus | null>(
    null,
  );
  const [recordingShortcutFor, setRecordingShortcutFor] = useState<
    "distraction" | null
  >(null);
  const [autoStartOn, setAutoStartOn] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    kind: "idle",
  });

  // Tag listeleri & inline düzenleme formu
  const [tagForm, setTagForm] = useState<TagFormState | null>(null);
  const [workTags, setWorkTags] = useState<TagItem[]>([]);
  const [selectedWorkTopicTag, setSelectedWorkTopicTag] =
    useState<string>("Ders");
  const [endingTags, setEndingTags] = useState<TagItem[]>([]);
  const [selectedEndingTag, setSelectedEndingTag] = useState<string>("Diğer");
  const [breakOverdueTags, setBreakOverdueTags] = useState<TagItem[]>([]);
  const [selectedBreakOverdueTag, setSelectedBreakOverdueTag] =
    useState<string>("Telefon");

  const ambientShouldPlay =
    loaded &&
    ambientNoise.sound !== "off" &&
    (!ambientNoise.playOnlyInWork ||
      (sessionActive && timerMode === "work" && isRunning));

  useEffect(() => {
    ambientNoiseEngine.setConfig(
      ambientNoise.sound,
      ambientNoise.volume,
      ambientShouldPlay,
    );
  }, [ambientNoise.sound, ambientNoise.volume, ambientShouldPlay]);

  useEffect(() => {
    return () => {
      ambientNoiseEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!loaded || !themeDirtyRef.current) return;
    const tTimer = setTimeout(() => {
      saveThemeSettings(theme).catch((err) =>
        console.error("Renk ayarları kaydedilemedi:", err),
      );
    }, 400);
    return () => clearTimeout(tTimer);
  }, [theme, loaded]);

  useEffect(() => {
    if (!loaded || import.meta.env.DEV) return;
    const runCheck = async () => {
      const result = await checkForUpdate();
      if (result.kind === "available") setUpdateStatus(result);
    };
    const first = setTimeout(runCheck, 10_000);
    const interval = setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [loaded]);

  const handleSelectPlan = async (planId: string) => {
    setPlanDropdownOpen(false);
    if (sessionActive) return;
    setActivePlanId(planId);
    setEditingPlanId(planId);
    await saveActivePlanId(planId);
    const chosen = studyPlans.find((p) => p.id === planId);
    if (chosen) {
      setWorkSecondsLeft(chosen.workMins * 60);
      setBreakTotalSec(chosen.standardBreakMins * 60);
      setBreakSecondsLeft(chosen.standardBreakMins * 60);
    }
  };

  const handleUpdatePlanField = async (
    planId: string,
    field: keyof StudyPlan,
    value: string | number,
  ) => {
    const updated = studyPlans.map((p) => {
      if (p.id !== planId) return p;
      return { ...p, [field]: value };
    });
    setStudyPlans(updated);
    await saveStudyPlans(updated);
    if (
      planId === activePlanId &&
      field === "workMins" &&
      !isRunning &&
      workElapsedSec === 0 &&
      timerMode === "work"
    ) {
      setWorkSecondsLeft(Number(value) * 60);
    }
  };

  const handleResetPlansDefault = async () => {
    const fresh = DEFAULT_STUDY_PLANS.map((p) => ({ ...p }));
    setStudyPlans(fresh);
    await saveStudyPlans(fresh);
    const current = fresh.find((p) => p.id === activePlanId) || fresh[0];
    if (!isRunning && workElapsedSec === 0 && timerMode === "work") {
      setWorkSecondsLeft(current.workMins * 60);
    }
  };

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    themeDirtyRef.current = true;
    setTheme((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateAmbientNoise = (patch: Partial<AmbientNoiseSettings>) => {
    setAmbientNoise((prev) => {
      const next = { ...prev, ...patch };
      saveAmbientNoiseSettings(next).catch(() => {});
      return next;
    });
  };

  const handleUpdateRescueExercises = (
    patch: Partial<RescueExerciseSettings>,
  ) => {
    setRescueExercises((prev) => {
      const next = { ...prev, ...patch };
      saveRescueExerciseSettings(next).catch(() => {});
      return next;
    });
  };

  const handleUpdateBreakChecklistItems = (items: string[]) => {
    setBreakChecklistItems(items);
    saveBreakChecklistItems(items).catch(() => {});
  };

  const handleApplyShortcuts = async (next: GlobalShortcutSettings) => {
    setShortcuts(next);
    await saveGlobalShortcuts(next);
    const status = await invoke<ShortcutStatus>("update_global_shortcuts", {
      distractionShortcut: next.distractionShortcut,
      contextShortcut: next.contextShortcut,
    }).catch(() => null);
    if (status) setShortcutStatus(status);
  };

  const handleResetShortcuts = async () => {
    setRecordingShortcutFor(null);
    await handleApplyShortcuts({ ...DEFAULT_SHORTCUTS });
  };

  const openQuickCaptureFromUi = (mode: "distraction" | "context") => {
    invoke("open_quick_capture_manual", { mode }).catch(() => {});
  };

  const toggleAutoStart = async () => {
    if (autoStartOn) {
      await disable();
      setAutoStartOn(false);
    } else {
      await enable();
      setAutoStartOn(true);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateStatus({ kind: "checking" });
    setUpdateStatus(await checkForUpdate());
  };

  const handleInstallUpdate = async () => {
    setIsRunning(false);
    await installUpdate(setUpdateStatus, async () => {
      await onSaveBeforeUpdate();
      await saveThemeSettings(theme).catch(() => {});
    });
  };

  const handleAddNewTag = (kind: TagKind) => {
    setTagForm({ mode: "add", kind, value: "" });
  };

  const handleEditTagItem = (
    tagId: number,
    currentName: string,
    kind: TagKind,
  ) => {
    setTagForm({
      mode: "edit",
      kind,
      tagId,
      currentName,
      value: currentName,
    });
  };

  const handleDeleteTagItem = (tagId: number, name: string, kind: TagKind) => {
    setTagForm({
      mode: "delete",
      kind,
      tagId,
      currentName: name,
      value: name,
    });
  };

  const submitTagForm = async () => {
    if (!tagForm) return;
    const { mode, kind, tagId, currentName, value } = tagForm;
    const trimmed = value.trim();

    if (mode === "add") {
      if (!trimmed) return;
      const added = await addTag(trimmed, kind);
      const pickedName = added?.name || trimmed;
      if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
        setSelectedEndingTag(pickedName);
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
        setSelectedWorkTopicTag(pickedName);
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(
          await getTags("break_overtime", t.defaultBreakOvertimeTags),
        );
        setSelectedBreakOverdueTag(pickedName);
      }
    } else if (mode === "edit" && tagId !== undefined && currentName) {
      if (trimmed && trimmed !== currentName) {
        await updateTag(tagId, trimmed, kind);
        if (kind === "ending") {
          setEndingTags(await getTags("ending", t.defaultEndingTags));
          if (selectedEndingTag === currentName) setSelectedEndingTag(trimmed);
        } else if (kind === "work") {
          setWorkTags(await getTags("work", t.defaultWorkTags));
          if (currentWorkTag === currentName) setCurrentWorkTag(trimmed);
          if (selectedWorkTopicTag === currentName) {
            setSelectedWorkTopicTag(trimmed);
          }
        } else if (kind === "break_overtime") {
          setBreakOverdueTags(
            await getTags("break_overtime", t.defaultBreakOvertimeTags),
          );
          if (selectedBreakOverdueTag === currentName) {
            setSelectedBreakOverdueTag(trimmed);
          }
        }
      }
    } else if (mode === "delete" && tagId !== undefined) {
      await deleteTag(tagId);
      if (kind === "ending") {
        setEndingTags(await getTags("ending", t.defaultEndingTags));
      } else if (kind === "work") {
        setWorkTags(await getTags("work", t.defaultWorkTags));
      } else if (kind === "break_overtime") {
        setBreakOverdueTags(
          await getTags("break_overtime", t.defaultBreakOvertimeTags),
        );
      }
    }
    setTagForm(null);
  };

  const handleTagsChangedFromSettings = async (kind: TagKind) => {
    if (kind === "work") {
      setWorkTags(await getTags("work", t.defaultWorkTags));
    } else if (kind === "ending") {
      setEndingTags(await getTags("ending", t.defaultEndingTags));
    } else if (kind === "break_overtime") {
      setBreakOverdueTags(
        await getTags("break_overtime", t.defaultBreakOvertimeTags),
      );
    }
  };

  const refreshTagsForTranslations = async (nextT: Translations) => {
    setEndingTags(await getTags("ending", nextT.defaultEndingTags));
    setWorkTags(await getTags("work", nextT.defaultWorkTags));
    setBreakOverdueTags(
      await getTags("break_overtime", nextT.defaultBreakOvertimeTags),
    );
  };

  return {
    studyPlans,
    setStudyPlans,
    activePlanId,
    setActivePlanId,
    editingPlanId,
    setEditingPlanId,
    currentPlan,
    currentPlanWorkMinsRef,
    getPlanDisplayName,
    theme,
    setTheme,
    ambientNoise,
    setAmbientNoise,
    rescueExercises,
    setRescueExercises,
    breakChecklistItems,
    setBreakChecklistItems,
    shortcuts,
    setShortcuts,
    shortcutStatus,
    setShortcutStatus,
    recordingShortcutFor,
    setRecordingShortcutFor,
    autoStartOn,
    setAutoStartOn,
    appVersion,
    setAppVersion,
    updateStatus,
    tagForm,
    setTagForm,
    workTags,
    setWorkTags,
    selectedWorkTopicTag,
    setSelectedWorkTopicTag,
    endingTags,
    setEndingTags,
    selectedEndingTag,
    setSelectedEndingTag,
    breakOverdueTags,
    setBreakOverdueTags,
    selectedBreakOverdueTag,
    setSelectedBreakOverdueTag,
    handleSelectPlan,
    handleUpdatePlanField,
    handleResetPlansDefault,
    updateTheme,
    handleUpdateAmbientNoise,
    handleUpdateRescueExercises,
    handleUpdateBreakChecklistItems,
    handleApplyShortcuts,
    handleResetShortcuts,
    openQuickCaptureFromUi,
    toggleAutoStart,
    handleCheckUpdate,
    handleInstallUpdate,
    handleAddNewTag,
    handleEditTagItem,
    handleDeleteTagItem,
    submitTagForm,
    handleTagsChangedFromSettings,
    refreshTagsForTranslations,
  };
}
