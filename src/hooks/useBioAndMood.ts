import { useState } from "react";
import {
  BioEventType,
  BioLogItem,
  MoodLogItem,
  MoodType,
  addBioLog,
  addMoodLog,
  deleteBioLog,
  deleteMoodLog,
  getBioLogs,
  getDateBoundsIso,
  getMoodLogs,
} from "../db";
import type { NavPage } from "../constants";

export interface UseBioAndMoodOptions {
  page: NavPage;
  selectedSummaryDate: string;
}

export function useBioAndMood({
  page,
  selectedSummaryDate,
}: UseBioAndMoodOptions) {
  const [selectedStartMood, setSelectedStartMood] = useState<MoodType | null>(
    null,
  );
  const [sessionStartMood, setSessionStartMood] = useState<MoodType | null>(
    null,
  );
  const [todayBioLogs, setTodayBioLogs] = useState<BioLogItem[]>([]);
  const [summaryBioLogs, setSummaryBioLogs] = useState<BioLogItem[]>([]);
  const [summaryMoodLogs, setSummaryMoodLogs] = useState<MoodLogItem[]>([]);

  const hydrateTodayBioLogs = async () => {
    setTodayBioLogs(await getBioLogs(true));
  };

  const handleAddBioLog = async (
    eventType: BioEventType,
    eventTime?: string,
    note?: string,
  ) => {
    await addBioLog(eventType, eventTime, note);
    setTodayBioLogs(await getBioLogs(true));
    if (page === "summary") {
      const dayRange = getDateBoundsIso(selectedSummaryDate);
      setSummaryBioLogs(await getBioLogs(false, dayRange));
    }
  };

  const handleDeleteBioLog = async (id: number) => {
    await deleteBioLog(id);
    setTodayBioLogs(await getBioLogs(true));
    if (page === "summary") {
      const dayRange = getDateBoundsIso(selectedSummaryDate);
      setSummaryBioLogs(await getBioLogs(false, dayRange));
    }
  };

  const handleAddMoodCheckin = async (mood: MoodType) => {
    await addMoodLog(mood, "checkin");
    if (page === "summary") {
      const dayRange = getDateBoundsIso(selectedSummaryDate);
      setSummaryMoodLogs(await getMoodLogs(false, dayRange));
    }
  };

  const handleDeleteMoodLog = async (id: number) => {
    await deleteMoodLog(id);
    if (page === "summary") {
      const dayRange = getDateBoundsIso(selectedSummaryDate);
      setSummaryMoodLogs(await getMoodLogs(false, dayRange));
    }
  };

  return {
    selectedStartMood,
    setSelectedStartMood,
    sessionStartMood,
    setSessionStartMood,
    todayBioLogs,
    setTodayBioLogs,
    summaryBioLogs,
    setSummaryBioLogs,
    summaryMoodLogs,
    setSummaryMoodLogs,
    hydrateTodayBioLogs,
    handleAddBioLog,
    handleDeleteBioLog,
    handleAddMoodCheckin,
    handleDeleteMoodLog,
  };
}
