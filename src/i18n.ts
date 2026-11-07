export type LangCode = "auto" | "tr" | "en";
export type ActiveLang = "tr" | "en";

export interface Translations {
  work: string;
  break: string;
  menu: string;
  home: string;
  settings: string;
  summary: string;
  hideToTray: string;
  clickToEditTime: string;
  resumeHint: (mins: number) => string;
  start: string;
  pause: string;
  resume: string;
  stop: string;
  distractedBtnText: (mins: number) => string;
  orNewReason: string;
  add: string;
  cancel: string;
  other: string;
  totalWork: string;
  sessions: string;
  average: string;
  lastState: (work: string, brk: string) => string;
  switchToWork: string;
  switchToBreak: string;
  startNewDay: string;
  summaryTitle: string;
  summaryHoverHint: string;
  summaryBarDetails: (
    label: string,
    hours: string,
    sessions: number,
    avgMins: number,
  ) => { main: string; sub: string };
  distractionFreqHeader: (count: number) => string;
  filterToday: string;
  filterAll: string;
  noDistractions: string;
  timesCount: (count: number, pct: number) => string;
  settingsTitle: string;
  langLabel: string;
  langAuto: string;
  langTr: string;
  langEn: string;
  bgColorLabel: string;
  customColorTitle: string;
  opacityLabel: string;
  timerColorLabel: string;
  autoStartOnBoot: (on: boolean) => string;
  resetDefaultColors: string;
  versionLabel: (v: string) => string;
  checkUpdates: string;
  checkingUpdates: string;
  upToDate: string;
  checkErrorRetry: string;
  newVersionReady: (v: string) => string;
  installVersion: (v: string) => string;
  updateDownloading: (pct: number | null) => string;
  updateAvailableHint: string;
  todayLabel: string;
  formatDuration: (sec: number) => string;

  // Erken durdurma & Taglar
  earlyStopTitle: string;
  earlyStopWorkedTime: (mins: number) => string;
  finishWithoutTag: string;
  cancelReturn: string;
  addAndFinish: string;
  newTagPlaceholder: string;
  editTags: string;
  doneEditing: string;
  deleteTagConfirm: (name: string) => string;
  editTagPrompt: (name: string) => string;
  newTagPrompt: string;

  // Dikkat Dağılması pop-up & Ek süre
  distractionTitle: string;
  selectTagHint: string;
  previousReasons: string;
  distractExplanationPlaceholder: string;
  endingExplanationPlaceholder: string;
  saveAndAddMin: (mins: number) => string;
  distractPenaltySetting: string;

  // Özet haftalık görünüm, etiket kırılımı & sıfırlama
  viewWeekly: string;
  viewRecentDays: string;
  weeklyTotal: string;
  weeklyDailyAvg: string;
  weeklyDaysWorked: (days: number) => string;
  resetAllData: string;
  resetConfirmTitle: string;
  resetConfirmDesc: string;
  resetConfirmYes: string;
  dataResetSuccess: string;
  avgDistractionsPerSession: string;
  distractionReasonsTab: string;
  endingReasonsTab: string;
  workTagsTab: string;
  breakOvertimeTab: string;
  timelineTab: string;
  timelineTitle: string;
  noTimelineSessions: string;
  noEndingReasons: string;
  sessionCompleted: string;

  // Always on top & Export & Break presets
  alwaysOnTop: string;
  alwaysOnTopTooltip: (on: boolean) => string;
  exportDataBtn: string;
  exportDataSuccess: string;
  breakPreset7: string;
  breakPreset10: string;
  breakPreset20: string;
  breakPresetSetting: string;
  breakOverdueBadge: (time: string) => string;
  breakOverdueTitle: string;
  breakOverdueDesc: (time: string) => string;
  saveAndStartWork: string;
  skipAndStartWork: string;
  extendBreak5m: string;
  startWorkBtn: string;

  // Çalışma konusu (What are you working on)
  whatAreYouWorkingOn: string;
  workTopicPlaceholder: string;
  selectWorkTopic: string;
  changeWorkTopic: string;

  defaultDistractionTags: string[];
  defaultEndingTags: string[];
  defaultWorkTags: string[];
  defaultBreakOvertimeTags: string[];
}

const tr: Translations = {
  work: "Çalışma",
  break: "Mola",
  menu: "Menü",
  home: "Ana Sayfa",
  settings: "Ayarlar",
  summary: "Özet",
  hideToTray: "Arka plana (sağ alt tepsiye) gizle",
  clickToEditTime: "Dakikayı ayarlamak için tıkla",
  resumeHint: (mins) => `Kaldığın yer (${mins} dk çalışıldı)`,
  start: "Başlat",
  pause: "Duraklat",
  resume: "Devam Et",
  stop: "Durdur",
  distractedBtnText: (mins) => (mins > 0 ? `+${mins}dk Dağıldım` : "Dağıldım"),
  orNewReason: "Veya yeni neden yaz...",
  add: "Ekle",
  cancel: "İptal",
  other: "Diğer",
  totalWork: "Toplam Çalışma",
  sessions: "Seans",
  average: "Ortalama",
  lastState: (w, b) => `Son durum: Çalışma ${w} • Mola ${b}`,
  switchToWork: "Çalışmaya Geç",
  switchToBreak: "Molaya Geç",
  startNewDay: "Seansı Bitir (Yeni Seans)",
  summaryTitle: "⠿ Çalışma ve Odak Özeti",
  summaryHoverHint: "Detay görmek için gün çubuklarının üzerine gel",
  summaryBarDetails: (label, hours, sessions, avgMins) => ({
    main: `${label}: ${hours} sa`,
    sub: `${sessions} seans • Ort: ${avgMins} dk`,
  }),
  distractionFreqHeader: (count) => `Dikkat Dağılma Sıklığı (${count})`,
  filterToday: "Filtre: Bugün",
  filterAll: "Filtre: Genel",
  noDistractions: "Henüz kayıtlı dikkat dağılma nedeni yok.",
  timesCount: (count, pct) => `${count} kez (%${pct})`,
  settingsTitle: "⠿ Ayarlar",
  langLabel: "Uygulama Dili",
  langAuto: "Otomatik (Sistem)",
  langTr: "Türkçe",
  langEn: "English",
  bgColorLabel: "Arka plan rengi",
  customColorTitle: "Özel renk seç",
  opacityLabel: "Opaklık",
  timerColorLabel: "Sayaç rengi",
  autoStartOnBoot: (on) => `Açılışta başlat: ${on ? "Açık" : "Kapalı"}`,
  resetDefaultColors: "Varsayılan renkler",
  versionLabel: (v) => `Sürüm v${v || "?"}`,
  checkUpdates: "Güncellemeleri denetle",
  checkingUpdates: "Denetleniyor...",
  upToDate: "Güncel ✓",
  checkErrorRetry: "Hata, tekrar dene",
  newVersionReady: (v) => `Yeni sürüm hazır: v${v}`,
  installVersion: (v) => `v${v} yükle`,
  updateDownloading: (pct) =>
    `Güncelleme indiriliyor${pct !== null ? ` %${pct}` : "..."}`,
  updateAvailableHint: "Yeni sürüm mevcut",
  todayLabel: "Bugün",
  formatDuration: (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.round((sec % 3600) / 60);
    if (hrs === 0) return `${mins} dk`;
    return `${hrs}s ${mins}dk`;
  },

  // Erken durdurma & Taglar
  earlyStopTitle: "Seansı Bitir (Neden & Tag)",
  earlyStopWorkedTime: (mins) => `${mins} dakika çalışıldı`,
  finishWithoutTag: "Tag'siz Bitir",
  cancelReturn: "Vazgeç / Devam Et",
  addAndFinish: "Bitir",
  newTagPlaceholder: "Yeni tag veya açıklama...",
  editTags: "Tagları Düzenle",
  doneEditing: "Tamam",
  deleteTagConfirm: (name) => `"${name}" tag'ini silmek istiyor musunuz?`,
  editTagPrompt: (name) => `"${name}" için yeni tag adı:`,
  newTagPrompt: "Yeni tag adı girin:",

  // Dikkat Dağılması pop-up & Ek süre
  distractionTitle: "Dikkat Dağılması Kaydet",
  selectTagHint: "Tag seç (isteğe bağlı):",
  previousReasons: "Önceki açıklamalar:",
  distractExplanationPlaceholder: "Açıklama yaz (veya yukarıdan seç)...",
  endingExplanationPlaceholder: "Açıklama yaz (veya yukarıdan seç)...",
  saveAndAddMin: (mins) => (mins > 0 ? `Kaydet (+${mins}dk)` : "Kaydet"),
  distractPenaltySetting: "Dikkat Dağılma Ekleme Süresi",

  // Özet haftalık görünüm, etiket kırılımı & sıfırlama
  viewWeekly: "Haftalık Görünüm",
  viewRecentDays: "Son Günler",
  weeklyTotal: "Haftalık Toplam",
  weeklyDailyAvg: "Haftalık Günlük Ort.",
  weeklyDaysWorked: (days) => `${days}/7 gün çalışıldı`,
  resetAllData: "Verileri Sıfırla",
  resetConfirmTitle: "Veriler Sıfırlansın mı?",
  resetConfirmDesc:
    "Tüm geçmiş çalışma seansları, günler ve dikkat dağılma kayıtları tamamen silinecektir. Bu işlem geri alınamaz.",
  resetConfirmYes: "Evet, Tümünü Sıfırla",
  dataResetSuccess: "Tüm veriler başarıyla sıfırlandı.",
  avgDistractionsPerSession: "Seans Başı Ort. Dikkat",
  distractionReasonsTab: "Dikkat Dağılmaları",
  endingReasonsTab: "Erken Bitirmeler",
  workTagsTab: "Çalışma Konuları",
  breakOvertimeTab: "Mola Gecikmeleri",
  timelineTab: "24s Çizelge",
  timelineTitle: "24 Saatlik Zaman Çizelgesi",
  noTimelineSessions: "Henüz kayıtlı zaman dilimi yok.",
  noEndingReasons: "Henüz kayıtlı erken bitirme nedeni yok.",
  sessionCompleted: "Seans Tamamlandı! 🎉",

  // Always on top & Export & Break
  alwaysOnTop: "Her Zaman Üstte",
  alwaysOnTopTooltip: (on: boolean) =>
    on
      ? "Her Zaman Üstte: Açık (Kapatmak için tıkla)"
      : "Her Zaman Üstte: Kapalı (Sabitlemek için tıkla)",
  exportDataBtn: "📥 Verileri İndir (JSON)",
  exportDataSuccess: "Veriler başarıyla dışa aktarıldı.",
  breakPreset7: "7 dk (Kısa)",
  breakPreset10: "10 dk (Standart)",
  breakPreset20: "20 dk (Uzun)",
  breakPresetSetting: "Varsayılan Mola Süresi",
  breakOverdueBadge: (time: string) => `Mola Bitti! (+${time})`,
  breakOverdueTitle: "Mola Uzatma / Gecikme Sebebi",
  breakOverdueDesc: (time: string) =>
    `Molayı ${time} uzattın. Sebebini seçebilir veya not ekleyebilirsin:`,
  saveAndStartWork: "Kaydet & Çalışmaya Başla",
  skipAndStartWork: "Sebebi Geç & Başla",
  extendBreak5m: "+5 dk Molayı Uzat",
  startWorkBtn: "Çalışmaya Başla",

  // Çalışma Konusu
  whatAreYouWorkingOn: "Ne Çalışıyorsun?",
  workTopicPlaceholder: "Ders, konu veya görev yaz (örn: Matematik, Rust)...",
  selectWorkTopic: "Konu Seç",
  changeWorkTopic: "Çalışma Konusunu Değiştir",

  defaultDistractionTags: [
    "Telefon",
    "Sosyal Medya",
    "Çevre / İnsanlar",
    "Açlık / Mola",
    "Düşünceler",
    "Diğer",
  ],
  defaultEndingTags: [
    "Toplantı",
    "Yemek",
    "Mola İhtiyacı",
    "Acil İş",
    "Ders Bitti",
    "Yorgunluk",
    "Diğer",
  ],
  defaultWorkTags: [
    "Ders",
    "Kodlama",
    "Proje",
    "Kitap",
    "Matematik",
    "Sınav Hazırlık",
    "Diğer",
  ],
  defaultBreakOvertimeTags: [
    "Telefon",
    "Sohbet",
    "Yemek / İçecek",
    "Dizi / Video",
    "Dinlenme İhtiyacı",
    "İş Araya Girdi",
    "Diğer",
  ],
};

const en: Translations = {
  work: "Work",
  break: "Break",
  menu: "Menu",
  home: "Home",
  settings: "Settings",
  summary: "Summary",
  hideToTray: "Minimize to system tray",
  clickToEditTime: "Click to adjust minutes",
  resumeHint: (mins) => `Resumed (${mins} min worked)`,
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  stop: "Stop",
  distractedBtnText: (mins) => (mins > 0 ? `+${mins}m Distracted` : "Distracted"),
  orNewReason: "Or enter a new reason...",
  add: "Add",
  cancel: "Cancel",
  other: "Other",
  totalWork: "Total Work",
  sessions: "Sessions",
  average: "Average",
  lastState: (w, b) => `Last state: Work ${w} • Break ${b}`,
  switchToWork: "Switch to Work",
  switchToBreak: "Switch to Break",
  startNewDay: "Finish Session (Start New)",
  summaryTitle: "⠿ Work & Focus Summary",
  summaryHoverHint: "Hover over day bars to view details",
  summaryBarDetails: (label, hours, sessions, avgMins) => ({
    main: `${label}: ${hours} h`,
    sub: `${sessions} sessions • Avg: ${avgMins} min`,
  }),
  distractionFreqHeader: (count) => `Distraction Frequency (${count})`,
  filterToday: "Filter: Today",
  filterAll: "Filter: All-Time",
  noDistractions: "No distractions recorded yet.",
  timesCount: (count, pct) => `${count} times (${pct}%)`,
  settingsTitle: "⠿ Settings",
  langLabel: "Language",
  langAuto: "Auto (System)",
  langTr: "Türkçe",
  langEn: "English",
  bgColorLabel: "Background Color",
  customColorTitle: "Choose custom color",
  opacityLabel: "Opacity",
  timerColorLabel: "Timer Color",
  autoStartOnBoot: (on) => `Launch on startup: ${on ? "On" : "Off"}`,
  resetDefaultColors: "Default colors",
  versionLabel: (v) => `Version v${v || "?"}`,
  checkUpdates: "Check for updates",
  checkingUpdates: "Checking...",
  upToDate: "Up to date ✓",
  checkErrorRetry: "Error, try again",
  newVersionReady: (v) => `New version available: v${v}`,
  installVersion: (v) => `Install v${v}`,
  updateDownloading: (pct) =>
    `Downloading update${pct !== null ? ` ${pct}%` : "..."}`,
  updateAvailableHint: "New version available",
  todayLabel: "Today",
  formatDuration: (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.round((sec % 3600) / 60);
    if (hrs === 0) return `${mins} min`;
    return `${hrs}h ${mins}m`;
  },

  // Erken durdurma & Taglar
  earlyStopTitle: "End Session (Reason & Tag)",
  earlyStopWorkedTime: (mins) => `${mins} minutes completed`,
  finishWithoutTag: "End Without Tag",
  cancelReturn: "Cancel / Continue",
  addAndFinish: "Finish",
  newTagPlaceholder: "New tag or explanation...",
  editTags: "Edit Tags",
  doneEditing: "Done",
  deleteTagConfirm: (name) => `Delete tag "${name}"?`,
  editTagPrompt: (name) => `Enter new name for "${name}":`,
  newTagPrompt: "Enter new tag name:",

  // Dikkat Dağılması pop-up & Ek süre
  distractionTitle: "Record Distraction",
  selectTagHint: "Select Tag (Optional):",
  previousReasons: "Recent explanations:",
  distractExplanationPlaceholder: "Type explanation (or select above)...",
  endingExplanationPlaceholder: "Type explanation (or select above)...",
  saveAndAddMin: (mins) => (mins > 0 ? `Save (+${mins}m)` : "Save"),
  distractPenaltySetting: "Distraction Added Time",

  // Özet haftalık görünüm, etiket kırılımı & sıfırlama
  viewWeekly: "Weekly View",
  viewRecentDays: "Recent Days",
  weeklyTotal: "Weekly Total",
  weeklyDailyAvg: "Daily Avg (Week)",
  weeklyDaysWorked: (days) => `${days}/7 days worked`,
  resetAllData: "Reset All Data",
  resetConfirmTitle: "Reset all data?",
  resetConfirmDesc:
    "All session history, days, and distraction records will be permanently erased. This cannot be undone.",
  resetConfirmYes: "Yes, Reset All",
  dataResetSuccess: "All data has been reset.",
  avgDistractionsPerSession: "Avg Distractions/Session",
  distractionReasonsTab: "Distractions",
  endingReasonsTab: "Early Stops",
  workTagsTab: "Work Topics",
  breakOvertimeTab: "Break Delays",
  timelineTab: "24h Timeline",
  timelineTitle: "24-Hour Timeline",
  noTimelineSessions: "No session intervals recorded yet.",
  noEndingReasons: "No early stop reasons recorded yet.",
  sessionCompleted: "Session Completed! 🎉",

  // Always on top & Export & Break
  alwaysOnTop: "Always on Top",
  alwaysOnTopTooltip: (on: boolean) =>
    on
      ? "Always on Top: On (Click to unpin)"
      : "Always on Top: Off (Click to pin)",
  exportDataBtn: "📥 Export Data (JSON)",
  exportDataSuccess: "Data exported successfully.",
  breakPreset7: "7 m (Short)",
  breakPreset10: "10 m (Standard)",
  breakPreset20: "20 m (Long)",
  breakPresetSetting: "Default Break Duration",
  breakOverdueBadge: (time: string) => `Break Over! (+${time})`,
  breakOverdueTitle: "Break Overdue Reason",
  breakOverdueDesc: (time: string) =>
    `Break exceeded by ${time}. Select reason or enter a note:`,
  saveAndStartWork: "Save & Start Work",
  skipAndStartWork: "Skip Reason & Start",
  extendBreak5m: "+5 m Extend Break",
  startWorkBtn: "Start Work",

  // Study Topic
  whatAreYouWorkingOn: "What are you working on?",
  workTopicPlaceholder: "Enter topic or task (e.g. Math, Rust, Study)...",
  selectWorkTopic: "Select Topic",
  changeWorkTopic: "Change Work Topic",

  defaultDistractionTags: [
    "Phone",
    "Social Media",
    "People / Noise",
    "Hunger / Rest",
    "Thoughts",
    "Other",
  ],
  defaultEndingTags: [
    "Meeting",
    "Meal",
    "Need a Break",
    "Urgent Task",
    "Topic Finished",
    "Fatigue",
    "Other",
  ],
  defaultWorkTags: [
    "Study",
    "Coding",
    "Project",
    "Reading",
    "Math",
    "Exam Prep",
    "Other",
  ],
  defaultBreakOvertimeTags: [
    "Phone",
    "Chatting",
    "Meal / Drink",
    "Video / TV",
    "Needed Rest",
    "Interruption",
    "Other",
  ],
};

export const translations: Record<ActiveLang, Translations> = { tr, en };

export function resolveLanguage(pref: LangCode): ActiveLang {
  if (pref === "tr" || pref === "en") return pref;
  const sys = (navigator.language || "").toLowerCase();
  if (sys.startsWith("tr")) return "tr";
  return "en";
}
