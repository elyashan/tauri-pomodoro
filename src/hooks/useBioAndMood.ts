import { useState } from "react";
import {
  BioEventType,
  BioLogItem,
  MoodType,
  addBioLog,
  deleteBioLog,
  getBioLogs,
  getDateBoundsIso,
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

  const hydrateTodayBioLogs = async () => {
    setTodayBioLogs(await getBioLogs(true));
  };

  const handleAddBioLog = async (
    eventType: BioEventType,
    eventTime?: string,
    note?: string,
    sleepHours?: number | null,
    targetDateStr?: string,
  ) => {
    await addBioLog(eventType, eventTime, note, sleepHours, targetDateStr);
    setTodayBioLogs(await getBioLogs(true));
    if (page === "summary") {
      const dayRange = getDateBoundsIso(targetDateStr || selectedSummaryDate);
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

  return {
    selectedStartMood,
    setSelectedStartMood,
    sessionStartMood,
    setSessionStartMood,
    todayBioLogs,
    setTodayBioLogs,
    summaryBioLogs,
    setSummaryBioLogs,
    hydrateTodayBioLogs,
    handleAddBioLog,
    handleDeleteBioLog,
  };
}
