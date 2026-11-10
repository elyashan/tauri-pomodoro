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

  // Çalışma Planları & Döngü & Kısa Mola
  plansTitle: string;
  selectPlan: string;
  planNames: Record<string, string>;
  planDetailTooltip: (
    name: string,
    workMins: number,
    shortMins: number,
    stdMins: number,
    longMins: number,
    interval: number,
  ) => string;
  planLockedDuringSession: string;
  planWorkMins: string;
  planShortBreakMins: string;
  planStandardBreakMins: string;
  planLongBreakMins: string;
  planLongBreakInterval: string;
  planLongBreakIntervalDesc: (n: number) => string;
  shortBreakBtn: (m: number) => string;
  shortBreakBtnTooltip: (m: number) => string;
  shortBreaksCountBadge: (n: number) => string;
  distractionsCountTooltip: (n: number) => string;
  distractedBtnCompact: (mins: number) => string;
  distractedBtnTooltip: (mins: number) => string;
  stopBtnTooltip: string;
  extendBreakCompact: string;
  extendBreakTooltip: string;
  cycleProgressBadge: (curr: number, total: number) => string;
  cycleTooltip: (curr: number, total: number, longMins: number) => string;
  standardBreakBadge: (m: number, curr: number, total: number) => string;
  longBreakBadge: (m: number, count: number) => string;
  shortBreakBadge: (m: number, count: number) => string;
  breakModeShortLabel: string;
  breakModeStdLabel: string;
  breakModeLongLabel: string;
  returnToWorkBtn: string;
  startWorkCompact: string;
  returnToWorkCompact: string;
  startSessionWithPlan: (name: string) => string;
  startSessionBtn: string;
  startSessionTooltip: string;
  finishSessionBtn: string;
  finishSessionTooltip: string;
  returnToWorkMenuBtn: string;
  returnToBreakMenuBtn: string;
  sessionIdleLabel: string;
  sessionIdleTooltip: string;
  sessionActiveTooltip: (
    modeLabel: string,
    topic: string,
    shortBreaks: number,
  ) => string;
  statusRunning: string;
  statusPaused: string;
  editPlansTitle: string;
  resetPlansDefault: string;
  savePlansSuccess: string;
  planNameLabel: string;
  planNamePlaceholder: string;
  workTagsShortTab: string;
  breakOvertimeShortTab: string;
  distractionShortTab: string;
  endingShortTab: string;
  filterTodayShort: string;
  filterAllShort: string;

  // Geri Bildirim (Feedback), Pencere Boyutu, Mini Widget & ADHD Öz-Farkındalık
  feedbackSectionTitle: string;
  feedbackPlaceholder: string;
  feedbackCatBug: string;
  feedbackCatFeature: string;
  feedbackCatUi: string;
  feedbackSaveBtn: string;
  feedbackCopyAllBtn: string;
  feedbackCopiedMsg: string;
  feedbackGithubBtn: string;
  feedbackEmpty: string;

  windowSizeTitle: string;
  windowSizeHint: (w: number, h: number) => string;
  saveCurrentSizeBtn: string;
  resetStandardSizeBtn: string;
  sizeSavedBadge: string;

  miniDockTooltip: string;
  restoreWindowTooltip: string;
  hideToTrayOnlyTooltip: string;

  triggerInternal: string;
  triggerExternal: string;
  triggerInternalTooltip: string;
  triggerExternalTooltip: string;

  adhdTab: string;
  adhdFocusThresholdTitle: string;
  adhdFocusThresholdDesc: (mins: number | null) => string;
  adhdTriggerRatioTitle: string;
  adhdTriggerRatioDesc: (intPct: number, intCnt: number, extCnt: number) => string;
  adhdChronoTitle: string;
  adhdChronoDesc: (peak: string | null, worst: string | null) => string;
  adhdTransitionTitle: string;
  adhdTransitionDesc: (avgMins: number, ratePct: number) => string;
  adhdCompletionTitle: string;
  adhdCompletionDesc: (pct: number, hyperCnt: number) => string;
  adhdDynamicTip: (
    thresholdMins: number | null,
    intPct: number,
    overtimeRate: number,
    topTag: string | null,
  ) => string;

  defaultDistractionTags: string[];
  defaultEndingTags: string[];
  defaultWorkTags: string[];
  defaultBreakOvertimeTags: string[];

  // v0.1.13 & v0.1.14: 6 Dikkat Kategorisi (3. şık SS Alma), Global Hızlı Yakalama, Otopark, Çalışma Hikayesi, Google Keep & Bulut Dashboard
  catImpulsiveTask: string;
  catIdea: string;
  catScreenshotNote: string;
  catInternal: string;
  catExternal: string;
  catEscape: string;
  catKeyHints: {
    impulsive_task: string;
    idea: string;
    screenshot_note: string;
    internal: string;
    external: string;
    escape: string;
  };
  noPenaltyParkingBadge: string;
  addsPenaltyBadge: (mins: number) => string;

  qcDistractHeader: string;
  qcSelectKeyHint: string;
  qcInputPlaceholders: {
    impulsive_task: string;
    idea: string;
    screenshot_note: string;
    internal: string;
    external: string;
    escape: string;
  };
  qcSwitchCatHint: string;
  qcActiveTabLabel: string;
  qcCurrentContextLabel: string;
  qcContextNone: string;
  qcReminderTitle: string;
  qcReminderCloseHint: string;
  qcContextHeader: string;
  qcContextPlaceholder: string;
  qcRecentContextsLabel: string;

  ssCropHint: string;
  ssResetCropBtn: string;
  ssRetakeBtn: string;
  ssReadyBadge: string;

  parkingBreakBannerTitle: string;
  parkingToggleBtn: (cnt: number) => string;
  parkingTab: string;
  parkingPendingTasks: string;
  parkingDoneTasks: string;
  parkingUnratedIdeas: string;
  parkingImportantIdeas: string;
  parkingUnimportantIdeas: string;
  parkingScreenshotNotes: string;
  parkingMarkImportant: string;
  parkingMarkUnimportant: string;
  parkingEmpty: string;

  keepSyncAllBtn: string;
  keepSyncSingleBtn: string;
  keepSyncedBadge: string;

  workStoryTab: string;
  workStoryTitle: string;
  workStorySub: string;
  workStoryEmpty: string;
  workStorySnapNowBtn: string;
  workStoryPeriodicBadge: string;
  workStoryNoteBadge: string;

  dashboardBtn: string;
  dashboardTitle: string;
  cloudAuthTitle: string;
  cloudEmailPlaceholder: string;
  cloudNamePlaceholder: string;
  cloudTokenPlaceholder: string;
  cloudServerPlaceholder: string;
  cloudSignInBtn: string;
  cloudSignOutBtn: string;
  cloudSyncNowBtn: string;
  cloudOnlineSynced: string;
  cloudOfflineQueued: (cnt: number) => string;

  cloudAuthSignedIn: string;
  syncRunning: string;
  manualSyncBtn: string;
  cloudAuthSignOut: string;
  cloudAuthSignIn: string;
  cloudAuthHint: string;
  pendingSyncQueueBadge: (cnt: number) => string;
  lastSyncLabel: string;
  dashboardUnfinishedTasks: string;
  dashboardFinishedTasks: string;
  noUnfinishedTasks: string;
  noFinishedTasks: string;
  dashboardImportantIdeas: string;
  noImportantIdeas: string;
  dashboardUnimportantIdeas: string;
  noUnimportantIdeas: string;
  workStoryDesc: string;
  contextStatsTitle: string;
  appDistractionTitle: string;
  ssCaptureActive: string;

  shortBreakPromptTitle: string;
  shortBreakPromptHint: string;
  shortBreakPromptPlaceholder: string;
  shortBreakStartBtn: string;
  shortBreakReminderPrefix: string;
  contextReminderPrefix: string;
  setContextBadgePlaceholder: string;

  contextShortTab: string;
  contextFullTab: string;
  appsShortTab: string;
  appsFullTab: string;
  noContextStats: string;
  noAppDistractions: string;

  shortcutsSectionTitle: string;
  shortcutDistractLabel: string;
  shortcutContextLabel: string;
  shortcutRecordPressKeys: string;
  shortcutResetBtn: string;
  shortcutTestBtn: string;
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

  // Çalışma Planları & Döngü & Kısa Mola
  plansTitle: "Plan",
  selectPlan: "Plan Seçimi",
  planNames: {
    classic: "Klasik",
    developer: "Geliştirici",
    ultradian: "Ultradian",
    custom: "Özel",
  },
  planDetailTooltip: (name, w, sb, std, lb, cyc) =>
    `${name}: ${w} dk çalışma • ${sb} dk kısa mola • ${std} dk standart mola • Her ${cyc} çalışmada ${lb} dk uzun mola`,
  planLockedDuringSession:
    "Aktif seans sürerken plan değiştirilemez. Önce seansı bitirin.",
  planWorkMins: "Çalışma Süresi (dk)",
  planShortBreakMins: "Kısa Mola (dk)",
  planStandardBreakMins: "Standart Mola (dk)",
  planLongBreakMins: "Uzun Mola (dk)",
  planLongBreakInterval: "Uzun Mola Döngüsü",
  planLongBreakIntervalDesc: (n: number) => `Her ${n} çalışmada bir uzun mola`,
  shortBreakBtn: (m: number) => `☕ ${m}dk`,
  shortBreakBtnTooltip: (m: number) =>
    `Kısa Mola (${m} dk) — Mevcut çalışma süreniz korunur`,
  shortBreaksCountBadge: (n: number) => `Seansta ${n} kısa mola verildi`,
  distractionsCountTooltip: (n: number) =>
    `Bu çalışmada ${n} kez dikkat dağılması kaydedildi`,
  distractedBtnCompact: (mins: number) => (mins > 0 ? `⚡ +${mins}dk` : "⚡"),
  distractedBtnTooltip: (mins: number) =>
    mins > 0
      ? `Dikkatim dağıldı (+${mins} dk ekle ve neden kaydet)`
      : "Dikkatim dağıldı (Süre eklemeden neden kaydet)",
  stopBtnTooltip: "Mevcut sayacı erken bitir veya sıfırla",
  extendBreakCompact: "+5dk",
  extendBreakTooltip: "Molayı 5 dakika uzat",
  cycleProgressBadge: (curr: number, total: number) => `${curr}/${total}`,
  cycleTooltip: (curr: number, total: number, longMins: number) =>
    `Uzun mola döngüsü: ${curr}/${total} tamamlandı (${total}. çalışma sonunda ${longMins} dk uzun mola)`,
  standardBreakBadge: (m: number, curr: number, total: number) =>
    `Standart Mola (${m} dk) • Döngü ${curr}/${total}`,
  longBreakBadge: (m: number, count: number) =>
    `Uzun Mola (${m} dk) • ${count}. çalışma tamamlandı`,
  shortBreakBadge: (m: number, count: number) =>
    `Kısa Mola (${m} dk) • #${count}`,
  breakModeShortLabel: "Kısa Mola",
  breakModeStdLabel: "Mola",
  breakModeLongLabel: "Uzun Mola",
  returnToWorkBtn: "Çalışmaya Dön",
  startWorkCompact: "▶ Çalışma",
  returnToWorkCompact: "▶ Dön",
  startSessionWithPlan: (name: string) => `▶ ${name} Başlat`,
  startSessionBtn: "▶ Seansı Başlat",
  startSessionTooltip: "Seçili planla yeni seans başlatır ve sayacı açar",
  finishSessionBtn: "⏹ Seansı Bitir",
  finishSessionTooltip: "Aktif seansı sonlandırır ve ilerlemeyi kaydeder",
  returnToWorkMenuBtn: "▶ Çalışmaya Dön",
  returnToBreakMenuBtn: "▶ Molaya Dön",
  sessionIdleLabel: "Aktif seans yok",
  sessionIdleTooltip:
    "Sayaç başlatmak için aşağıdan plan seçip 'Seansı Başlat'a tıklayın",
  sessionActiveTooltip: (modeLabel, topic, shortBreaks) =>
    `Aktif Seans • Mod: ${modeLabel} • Konu: ${topic || "Belirtilmedi"} • Kısa mola: ${shortBreaks}`,
  statusRunning: "Çalışıyor",
  statusPaused: "Duraklatıldı",
  editPlansTitle: "Çalışma & Mola Planları",
  resetPlansDefault: "Varsayılana Dön",
  savePlansSuccess: "Planlar kaydedildi!",
  planNameLabel: "Özel Ad",
  planNamePlaceholder: "Varsayılan ad kullanılır",
  workTagsShortTab: "Konu",
  breakOvertimeShortTab: "Gecikme",
  distractionShortTab: "Dağılma",
  endingShortTab: "Bitirme",
  filterTodayShort: "Bugün",
  filterAllShort: "Tümü",

  // Geri Bildirim (Feedback), Pencere Boyutu, Mini Widget & ADHD Öz-Farkındalık
  feedbackSectionTitle: "💬 Geri Bildirim & Notlarım",
  feedbackPlaceholder:
    "Uygulama hakkındaki hata, fikir veya tasarım notlarını buraya yaz (birden fazla satır yazabilirsin)...",
  feedbackCatBug: "🐛 Hata",
  feedbackCatFeature: "💡 Özellik",
  feedbackCatUi: "🎨 Tasarım",
  feedbackSaveBtn: "Kaydet",
  feedbackCopyAllBtn: "📋 Tümünü Kopyala",
  feedbackCopiedMsg: "Kopyalandı ✓",
  feedbackGithubBtn: "🐙 GitHub Issue",
  feedbackEmpty: "Henüz kayıtlı geri bildirim yok.",

  windowSizeTitle: "📐 Pencere Boyutu",
  windowSizeHint: (w, h) =>
    `Pencereyi kenarlarından sürükleyip büyütebilir/küçültebilirsin (Şu an: ${w}×${h}px)`,
  saveCurrentSizeBtn: "💾 Mevcut Boyutu Kaydet",
  resetStandardSizeBtn: "↺ Standart Boyuta Dön",
  sizeSavedBadge: "Boyut kaydedildi ✓",

  miniDockTooltip: "Sağ alt mini sayaç moduna küçült",
  restoreWindowTooltip: "Normal pencere boyutuna geri dön",
  hideToTrayOnlyTooltip: "Tamamen sistem tepsisine (tray) gizle",

  triggerInternal: "🧠 İçsel Dürtü",
  triggerExternal: "🔔 Dışsal Etken",
  triggerInternalTooltip:
    "Kendi aklına gelen düşünce, sıkılma, merak veya dürtüyle bölündün",
  triggerExternalTooltip:
    "Bildirim, telefon çalması, dış gürültü veya başka biri yüzünden bölündün",

  adhdTab: "🧠 Farkındalık",
  adhdFocusThresholdTitle: "⏱ Doğal Odak Eşiğin",
  adhdFocusThresholdDesc: (mins) =>
    mins !== null
      ? `Ortalama ${mins}. dakikada dikkatin dağılıyor`
      : "Veri için birkaç dağılma kaydı gerekiyor",
  adhdTriggerRatioTitle: "🧠 İçsel vs 🔔 Dışsal Bölünme",
  adhdTriggerRatioDesc: (intPct, intCnt, extCnt) =>
    `%${intPct} İçsel (${intCnt}) • %${100 - intPct} Dışsal (${extCnt})`,
  adhdChronoTitle: "☀️ Biyolojik Odak Saatlerin",
  adhdChronoDesc: (peak, worst) =>
    `Zirve: ${peak || "—"} • En Dağınık: ${worst || "—"}`,
  adhdTransitionTitle: "☕ Moladan Dönüş Direnci",
  adhdTransitionDesc: (avgMins, ratePct) =>
    ratePct > 0
      ? `Molaların %${ratePct}'i sarkıyor (Ort. +${avgMins} dk)`
      : "Molalardan zamanında dönüyorsun ✓",
  adhdCompletionTitle: "🎯 Tamamlama & Hiperodak",
  adhdCompletionDesc: (pct, hyperCnt) =>
    `%${pct} tamamlama • ${hyperCnt} hiperodak (35+ dk)`,
  adhdDynamicTip: (thresholdMins, intPct, overtimeRate, topTag) => {
    const parts: string[] = [];
    if (thresholdMins !== null && thresholdMins < 25) {
      parts.push(
        `💡 Dikkatin genelde ${thresholdMins}. dakikada dağılıyor; çalışma süreni ${Math.max(15, thresholdMins + 2)} dk yapıp döngüyü sıklaştırmak ADHD odak eşiğinle daha uyumlu olabilir.`,
      );
    } else if (thresholdMins !== null) {
      parts.push(
        `✨ Doğal odak eşiğin ${thresholdMins} dakika civarında — derin odak (Geliştirici) ritmine oldukça uygunsun.`,
      );
    }
    if (intPct >= 65) {
      parts.push(
        `🧠 Bölünmelerinin %${intPct}'i içsel dürtü kaynaklı${topTag ? ` (en sık: ${topTag})` : ""}. Aklına gelen şeyi "sonra bakılacaklar" notuna yazıp sayaca dönmeyi dene.`,
      );
    } else if (intPct > 0 && intPct <= 35) {
      parts.push(
        `🔔 Bölünmelerinin çoğu dışsal uyaranlardan geliyor${topTag ? ` (${topTag})` : ""}. Seans başında bildirimleri sessize almak odak süreni ciddi artıracaktır.`,
      );
    }
    if (overtimeRate >= 40) {
      parts.push(
        `⏰ Moladan çalışmaya geçişte "başlatma direnci" yaşıyorsun (%${overtimeRate} sarkma). Molada ekrana/sosyal medyaya girmek yerine hareket etmeyi dene.`,
      );
    }
    return parts.length > 0
      ? parts.join("\n\n")
      : "🌱 Seansların ve dikkat dağılma kayıtların biriktikçe burada senin ADHD odak profiline özel kişisel çıkarımlar belirecek.";
  },

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

  // v0.1.13 & v0.1.14
  catImpulsiveTask: "Dürtüsel Görev",
  catIdea: "Akla Gelen Fikir",
  catScreenshotNote: "📸 SS Notu",
  catInternal: "İçsel Tetikleyici",
  catExternal: "Dışsal Tetikleyici",
  catEscape: "Zorluktan Kaçış",
  catKeyHints: {
    impulsive_task: "1·G",
    idea: "2·F",
    screenshot_note: "3·S",
    internal: "4·İ",
    external: "5·D",
    escape: "6·Z",
  },
  noPenaltyParkingBadge: "+0dk • Otopark",
  addsPenaltyBadge: (mins) => (mins > 0 ? `+${mins}dk eklenir` : "+0dk"),

  qcDistractHeader: "⚡ Hızlı Yakala",
  qcSelectKeyHint:
    "1–6 veya harfe (1·G: Görev, 2·F: Fikir, 3·S: 📸 SS Alma, 4·İ: İçsel, 5·D: Dışsal, 6·Z: Kaçış) bas • Esc kapat",
  qcInputPlaceholders: {
    impulsive_task:
      "Molada yapılacak dürtüsel görevi yaz ve Enter'a bas (ek süre eklenmez)...",
    idea: "Aklına gelen fikri yaz ve Enter'a bas (ek süre eklenmez)...",
    screenshot_note:
      "Ekran görüntüsü için kısa notunu yaz ve Enter'a bas (fareyle bölge kırpabilirsin, ek süre eklenmez)...",
    internal: "İçsel tetikleyiciyi / düşünceyi yaz ve Enter'a bas...",
    external: "Dışsal uyaranı (bildirim, ses vb.) yaz ve Enter'a bas...",
    escape: "Zorlandığın / kaçtığın noktayı kısaca yaz ve Enter'a bas...",
  },
  qcSwitchCatHint: "Tab: Kategori değiştir • Enter: Kaydet • Esc: İptal",
  qcActiveTabLabel: "Son Açık Sekme",
  qcCurrentContextLabel: "Son Kalınan Meşguliyet",
  qcContextNone: "Meşguliyet belirtilmedi",
  qcReminderTitle: "🎯 Son Kalınan Meşguliyet — Kaldığın Yerden Devam Et:",
  qcReminderCloseHint: "Enter / Space / Esc ile hemen pencereye dön",
  qcContextHeader: "🎯 Şu An Neyle Meşgulsün? (Context)",
  qcContextPlaceholder:
    "Şu an odaklandığın spesifik işi yaz ve Enter'a bas (örn: Türev Test 2, API Auth)...",
  qcRecentContextsLabel: "Son meşguliyetler (Tıkla veya ↑↓):",

  ssCropHint: "✂️ Görüntü üzerinde fareyle sürükleyerek istediğin alanı kırpabilirsin",
  ssResetCropBtn: "Tam Ekran",
  ssRetakeBtn: "🔄 Yeniden Çek",
  ssReadyBadge: "📸 Ekran görüntüsü hazır",

  parkingBreakBannerTitle:
    "🅿️ Çalışırken aklına şunlar takılmıştı, şimdi bakabilirsin:",
  parkingToggleBtn: (cnt) => `🅿️ Otopark (${cnt})`,
  parkingTab: "🅿️ Otopark",
  parkingPendingTasks: "⏳ Yapılmayan Görevler",
  parkingDoneTasks: "✅ Yapılan Görevler",
  parkingUnratedIdeas: "💡 Bekleyen Fikirler",
  parkingImportantIdeas: "⭐ Önemli Fikirler",
  parkingUnimportantIdeas: "💤 Önemsiz Fikirler",
  parkingScreenshotNotes: "📸 Ekran Görüntüsü Notları (SS)",
  parkingMarkImportant: "⭐ Önemli",
  parkingMarkUnimportant: "💤 Önemsiz",
  parkingEmpty: "Otoparkta henüz kayıtlı dürtüsel görev, fikir veya ekran notu yok.",

  keepSyncAllBtn: "🟨 Google Keep'e Aktar / Senkronize Et",
  keepSyncSingleBtn: "🟨 Keep'e Gönder",
  keepSyncedBadge: "Keep ✓",

  workStoryTab: "📸 Hikaye",
  workStoryTitle: "📸 Çalışma Hikayesi (5 dk'da 1 SS + Açık Pencere + Context)",
  workStorySub:
    "Çalışırken her 5 dakikada bir ve 3·S ile aldığın ekran notlarıyla oluşan görsel çalışma zaman tüneli",
  workStoryEmpty:
    "Henüz çalışma hikayesi kaydı yok. Çalışma sayacı çalışırken her 5 dakikada bir otomatik ekran görüntüsü + açık pencere + context kaydedilir.",
  workStorySnapNowBtn: "📸 Şimdi Hikaye Karesi Al",
  workStoryPeriodicBadge: "⏱ 5dk Otomatik",
  workStoryNoteBadge: "📸 SS Notu",

  dashboardBtn: "📊 Dashboard",
  dashboardTitle: "📊 Kişisel Odak & Bulut Dashboard",
  cloudAuthTitle: "☁️ Google Hesabı & Bulut Senkronizasyonu (Çevrimdışı Destekli)",
  cloudEmailPlaceholder: "Google E-posta (örn: ad.soyad@gmail.com)",
  cloudNamePlaceholder: "Görünen İsim (örn: Elyas)",
  cloudTokenPlaceholder: "Google OAuth Access Token (opsiyonel, doğrudan Keep API için)",
  cloudServerPlaceholder: "Sunucu URL (varsayılan: http://localhost:4000)",
  cloudSignInBtn: "🔐 Google ile Bağlan",
  cloudSignOutBtn: "Çıkış",
  cloudSyncNowBtn: "🔄 Şimdi Senkronize Et",
  cloudOnlineSynced: "🟢 Bulut Güncel",
  cloudOfflineQueued: (cnt) => `🟠 Kuyrukta (${cnt})`,

  cloudAuthSignedIn: "Google hesabıyla oturum açıldı ve veriler senkronize edildi.",
  syncRunning: "Senkronize ediliyor...",
  manualSyncBtn: "Şimdi Senkronize Et",
  cloudAuthSignOut: "Çıkış Yap",
  cloudAuthSignIn: "Giriş Yap",
  cloudAuthHint:
    "Google OAuth Access Token opsiyoneldir. Girildiğinde Google Keep REST API ile doğrudan, girilmediğinde ise sunucu ve Web Bridge ile senkronize olur.",
  pendingSyncQueueBadge: (cnt) => `Bekleyen kuyruk: ${cnt}`,
  lastSyncLabel: "Son senkronizasyon",
  dashboardUnfinishedTasks: "Yapılmayan Görevler",
  dashboardFinishedTasks: "Yapılan Görevler",
  noUnfinishedTasks: "Bekleyen yapılmamış görev yok.",
  noFinishedTasks: "Henüz tamamlanmış görev yok.",
  dashboardImportantIdeas: "Önemli Fikirler",
  noImportantIdeas: "Önemli olarak işaretlenmiş fikir yok.",
  dashboardUnimportantIdeas: "Önemsiz / İncelenecek Fikirler",
  noUnimportantIdeas: "İncelenecek fikir yok.",
  workStoryDesc:
    "5 dakikada bir otomatik alınan ekran görüntüleri ve dikkat dağılma ekranından kaydedilen SS notlarıyla oluşan çalışma hikayesi",
  contextStatsTitle: "Meşguliyet Dağılımı",
  appDistractionTitle: "Açık Pencere & Sekmeler",
  ssCaptureActive: "📸 Ekran görüntüsü alınıyor...",

  shortBreakPromptTitle: "🎯 Şu An Neyle Meşgulsün? (Context)",
  shortBreakPromptHint:
    "Kısa molaya girmeden önce aktif meşguliyetini belirle; mola bitince kaldığın yeri hatırlatalım:",
  shortBreakPromptPlaceholder:
    "Şu an odaklandığın spesifik işi yaz (örn: Türev Test 2, API Auth)...",
  shortBreakStartBtn: "☕ Molaya Geç",
  shortBreakReminderPrefix: "🎯 Son Meşguliyet:",
  contextReminderPrefix: "🎯 Son Meşguliyet:",
  setContextBadgePlaceholder: "Meşguliyet",

  contextShortTab: "Bağlam",
  contextFullTab: "Meşguliyet (Context) Çalışma İstatistikleri",
  appsShortTab: "Sekme",
  appsFullTab: "Açık Uygulama & Sekme Bazlı Dağılmalar",
  noContextStats:
    "Henüz meşguliyet (context) kaydı yok. Kısayol ile o an neyle uğraştığını kaydedebilirsin.",
  noAppDistractions:
    "Henüz açık uygulama veya sekme bilgisi içeren dağılma kaydı yok.",

  shortcutsSectionTitle: "⌨️ Global Kısayollar (Ekran Ortasında Hızlı Input)",
  shortcutDistractLabel: "⚡ Dikkat / Görev / Fikir Yakala",
  shortcutContextLabel: "🎯 Aktif Meşguliyet (Context) Yaz",
  shortcutRecordPressKeys: "Tuş kombinasyonuna basın... (Esc iptal)",
  shortcutResetBtn: "Varsayılan Kısayollar",
  shortcutTestBtn: "Test",
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

  // Study Plans & Cycle & Short Break
  plansTitle: "Plan",
  selectPlan: "Select Plan",
  planNames: {
    classic: "Classic",
    developer: "Developer",
    ultradian: "Ultradian",
    custom: "Custom",
  },
  planDetailTooltip: (name, w, sb, std, lb, cyc) =>
    `${name}: ${w}m work • ${sb}m short break • ${std}m standard break • ${lb}m long break every ${cyc} cycles`,
  planLockedDuringSession:
    "Cannot change plan during an active session. Finish the session first.",
  planWorkMins: "Work Duration (min)",
  planShortBreakMins: "Short Break (min)",
  planStandardBreakMins: "Standard Break (min)",
  planLongBreakMins: "Long Break (min)",
  planLongBreakInterval: "Long Break Cycle",
  planLongBreakIntervalDesc: (n: number) => `Long break every ${n} work cycles`,
  shortBreakBtn: (m: number) => `☕ ${m}m`,
  shortBreakBtnTooltip: (m: number) =>
    `Take Short Break (${m} min) — keeps your current work timer`,
  shortBreaksCountBadge: (n: number) => `${n} short break(s) taken in this session`,
  distractionsCountTooltip: (n: number) =>
    `${n} distraction(s) recorded in this work interval`,
  distractedBtnCompact: (mins: number) => (mins > 0 ? `⚡ +${mins}m` : "⚡"),
  distractedBtnTooltip: (mins: number) =>
    mins > 0
      ? `Distracted (+${mins} min & log reason)`
      : "Distracted (log reason without adding time)",
  stopBtnTooltip: "End early or reset current timer",
  extendBreakCompact: "+5m",
  extendBreakTooltip: "Extend break by 5 minutes",
  cycleProgressBadge: (curr: number, total: number) => `${curr}/${total}`,
  cycleTooltip: (curr: number, total: number, longMins: number) =>
    `Long break cycle: ${curr}/${total} completed (${longMins} min long break after ${total} work cycles)`,
  standardBreakBadge: (m: number, curr: number, total: number) =>
    `Standard Break (${m} min) • Cycle ${curr}/${total}`,
  longBreakBadge: (m: number, count: number) =>
    `Long Break (${m} min) • Work #${count} finished`,
  shortBreakBadge: (m: number, count: number) =>
    `Short Break (${m} min) • #${count}`,
  breakModeShortLabel: "Short Break",
  breakModeStdLabel: "Break",
  breakModeLongLabel: "Long Break",
  returnToWorkBtn: "Return to Work",
  startWorkCompact: "▶ Work",
  returnToWorkCompact: "▶ Resume",
  startSessionWithPlan: (name: string) => `▶ Start ${name}`,
  startSessionBtn: "▶ Start Session",
  startSessionTooltip: "Start a new session with the selected plan",
  finishSessionBtn: "⏹ Finish Session",
  finishSessionTooltip: "End the active session and save your stats",
  returnToWorkMenuBtn: "▶ Back to Work",
  returnToBreakMenuBtn: "▶ Back to Break",
  sessionIdleLabel: "No active session",
  sessionIdleTooltip: "Pick a plan below and click 'Start Session' to begin",
  sessionActiveTooltip: (modeLabel, topic, shortBreaks) =>
    `Active Session • Mode: ${modeLabel} • Topic: ${topic || "None"} • Short breaks: ${shortBreaks}`,
  statusRunning: "Running",
  statusPaused: "Paused",
  editPlansTitle: "Study & Break Plans",
  resetPlansDefault: "Reset Default",
  savePlansSuccess: "Plans saved!",
  planNameLabel: "Custom Name",
  planNamePlaceholder: "Uses default localized name",
  workTagsShortTab: "Topic",
  breakOvertimeShortTab: "Overtime",
  distractionShortTab: "Distract",
  endingShortTab: "Stopped",
  filterTodayShort: "Today",
  filterAllShort: "All",

  // Feedback, Window Size, Mini Widget & ADHD Self-Realization
  feedbackSectionTitle: "💬 Feedback & My Notes",
  feedbackPlaceholder:
    "Write your bug reports, feature ideas, or UI notes here (multi-line supported)...",
  feedbackCatBug: "🐛 Bug",
  feedbackCatFeature: "💡 Feature",
  feedbackCatUi: "🎨 UI/Design",
  feedbackSaveBtn: "Save",
  feedbackCopyAllBtn: "📋 Copy All",
  feedbackCopiedMsg: "Copied ✓",
  feedbackGithubBtn: "🐙 GitHub Issue",
  feedbackEmpty: "No feedback notes saved yet.",

  windowSizeTitle: "📐 Window Size",
  windowSizeHint: (w, h) =>
    `Drag window edges to resize freely (Current: ${w}×${h}px)`,
  saveCurrentSizeBtn: "💾 Save Current Size",
  resetStandardSizeBtn: "↺ Reset Standard Size",
  sizeSavedBadge: "Size saved ✓",

  miniDockTooltip: "Minimize to bottom-right mini counter widget",
  restoreWindowTooltip: "Restore normal window size",
  hideToTrayOnlyTooltip: "Hide completely to system tray",

  triggerInternal: "🧠 Internal Impulse",
  triggerExternal: "🔔 External Trigger",
  triggerInternalTooltip:
    "Interrupted by your own thoughts, boredom, curiosity, or internal urge",
  triggerExternalTooltip:
    "Interrupted by a notification, phone call, noise, or another person",

  adhdTab: "🧠 Insights",
  adhdFocusThresholdTitle: "⏱ Natural Focus Threshold",
  adhdFocusThresholdDesc: (mins) =>
    mins !== null
      ? `You typically get distracted around minute ${mins}`
      : "Log a few distractions to discover your threshold",
  adhdTriggerRatioTitle: "🧠 Internal vs 🔔 External",
  adhdTriggerRatioDesc: (intPct, intCnt, extCnt) =>
    `${intPct}% Internal (${intCnt}) • ${100 - intPct}% External (${extCnt})`,
  adhdChronoTitle: "☀️ Peak Focus vs Distraction Hours",
  adhdChronoDesc: (peak, worst) =>
    `Peak: ${peak || "—"} • Most Distracted: ${worst || "—"}`,
  adhdTransitionTitle: "☕ Break-to-Work Friction",
  adhdTransitionDesc: (avgMins, ratePct) =>
    ratePct > 0
      ? `${ratePct}% of breaks run overtime (Avg +${avgMins} min)`
      : "Returning from breaks on time ✓",
  adhdCompletionTitle: "🎯 Completion & Hyperfocus",
  adhdCompletionDesc: (pct, hyperCnt) =>
    `${pct}% completed • ${hyperCnt} hyperfocus (35+ min)`,
  adhdDynamicTip: (thresholdMins, intPct, overtimeRate, topTag) => {
    const parts: string[] = [];
    if (thresholdMins !== null && thresholdMins < 25) {
      parts.push(
        `💡 Your attention usually drifts around minute ${thresholdMins}. Setting work intervals to ~${Math.max(15, thresholdMins + 2)} min can help you finish cycles before focus drops.`,
      );
    } else if (thresholdMins !== null) {
      parts.push(
        `✨ Your natural focus threshold is ~${thresholdMins} min — well suited for deep focus blocks.`,
      );
    }
    if (intPct >= 65) {
      parts.push(
        `🧠 ${intPct}% of your distractions are internal impulses${topTag ? ` (top: ${topTag})` : ""}. Keep a quick "parking lot" scratchpad for sudden thoughts.`,
      );
    } else if (intPct > 0 && intPct <= 35) {
      parts.push(
        `🔔 Most distractions are external triggers${topTag ? ` (${topTag})` : ""}. Silencing notifications before starting will protect your flow.`,
      );
    }
    if (overtimeRate >= 40) {
      parts.push(
        `⏰ You experience transition friction returning from breaks (${overtimeRate}% overtime). Avoiddopamine traps (scrolling) during short breaks.`,
      );
    }
    return parts.length > 0
      ? parts.join("\n\n")
      : "🌱 As you complete sessions and log distractions, personalized ADHD self-realization insights will appear here.";
  },

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

  // v0.1.13 & v0.1.14
  catImpulsiveTask: "Impulsive Task",
  catIdea: "Sudden Idea",
  catScreenshotNote: "📸 SS Note",
  catInternal: "Internal Trigger",
  catExternal: "External Trigger",
  catEscape: "Difficulty Escape",
  catKeyHints: {
    impulsive_task: "1·G",
    idea: "2·F",
    screenshot_note: "3·S",
    internal: "4·I",
    external: "5·D",
    escape: "6·Z",
  },
  noPenaltyParkingBadge: "+0m • Parking Lot",
  addsPenaltyBadge: (mins) => (mins > 0 ? `+${mins}m added` : "+0m"),

  qcDistractHeader: "⚡ Quick Capture",
  qcSelectKeyHint:
    "Press 1–6 or letter (1·G: Task, 2·F: Idea, 3·S: 📸 Screenshot, 4·I: Internal, 5·D: External, 6·Z: Escape) • Esc close",
  qcInputPlaceholders: {
    impulsive_task:
      "Type impulsive task for your break & press Enter (no time added)...",
    idea: "Type your idea & press Enter (no time added)...",
    screenshot_note:
      "Type a note for this screenshot & press Enter (drag to crop region, no time added)...",
    internal: "Type internal thought / urge & press Enter...",
    external: "Type external trigger (notification, noise...) & press Enter...",
    escape: "What felt hard or boring right now? Press Enter...",
  },
  qcSwitchCatHint: "Tab: Switch category • Enter: Save • Esc: Cancel",
  qcActiveTabLabel: "Last Open Tab",
  qcCurrentContextLabel: "Last Active Context",
  qcContextNone: "No active context set",
  qcReminderTitle: "🎯 Last Active Context — Resume Right Here:",
  qcReminderCloseHint: "Press Enter / Space / Esc to return immediately",
  qcContextHeader: "🎯 What Are You Occupied With Right Now? (Context)",
  qcContextPlaceholder:
    "Type what you're actively working on & press Enter (e.g. Calc Problem 4, Auth API)...",
  qcRecentContextsLabel: "Recent contexts (Click or ↑↓):",

  ssCropHint: "✂️ Drag on the preview image to crop a specific region",
  ssResetCropBtn: "Full Screen",
  ssRetakeBtn: "🔄 Retake",
  ssReadyBadge: "📸 Screenshot ready",

  parkingBreakBannerTitle:
    "🅿️ These popped into your head while working — check them now:",
  parkingToggleBtn: (cnt) => `🅿️ Parking (${cnt})`,
  parkingTab: "🅿️ Parking",
  parkingPendingTasks: "⏳ Unfinished Tasks",
  parkingDoneTasks: "✅ Completed Tasks",
  parkingUnratedIdeas: "💡 Unrated Ideas",
  parkingImportantIdeas: "⭐ Important Ideas",
  parkingUnimportantIdeas: "💤 Unimportant Ideas",
  parkingScreenshotNotes: "📸 Screenshot Notes (SS)",
  parkingMarkImportant: "⭐ Important",
  parkingMarkUnimportant: "💤 Minor",
  parkingEmpty: "No impulsive tasks, ideas, or screenshot notes in your parking lot yet.",

  keepSyncAllBtn: "🟨 Sync / Send to Google Keep",
  keepSyncSingleBtn: "🟨 Send to Keep",
  keepSyncedBadge: "Keep ✓",

  workStoryTab: "📸 Story",
  workStoryTitle: "📸 Work Story (5m Screenshot + Active Window + Context)",
  workStorySub:
    "Visual timeline of your focus session built from 5-minute periodic snapshots and 3·S screenshot notes",
  workStoryEmpty:
    "No work story snapshots yet. While the work timer is running, a snapshot + active window + context is captured every 5 minutes.",
  workStorySnapNowBtn: "📸 Capture Story Frame Now",
  workStoryPeriodicBadge: "⏱ 5m Auto",
  workStoryNoteBadge: "📸 SS Note",

  dashboardBtn: "📊 Dashboard",
  dashboardTitle: "📊 Personal Focus & Cloud Dashboard",
  cloudAuthTitle: "☁️ Google Account & Cloud Sync (Offline-First)",
  cloudEmailPlaceholder: "Google Email (e.g. name@gmail.com)",
  cloudNamePlaceholder: "Display Name",
  cloudTokenPlaceholder: "Google OAuth Access Token (optional, for direct Keep API)",
  cloudServerPlaceholder: "Server URL (default: http://localhost:4000)",
  cloudSignInBtn: "🔐 Connect with Google",
  cloudSignOutBtn: "Sign Out",
  cloudSyncNowBtn: "🔄 Sync Now",
  cloudOnlineSynced: "🟢 Cloud Synced",
  cloudOfflineQueued: (cnt) => `🟠 Queued (${cnt})`,

  cloudAuthSignedIn: "Signed in with Google and synchronized data.",
  syncRunning: "Syncing...",
  manualSyncBtn: "Sync Now",
  cloudAuthSignOut: "Sign Out",
  cloudAuthSignIn: "Sign In",
  cloudAuthHint:
    "Google OAuth Access Token is optional. When provided, direct Keep API is used; otherwise synced via Server & Web Bridge.",
  pendingSyncQueueBadge: (cnt) => `Pending queue: ${cnt}`,
  lastSyncLabel: "Last sync",
  dashboardUnfinishedTasks: "Unfinished Tasks",
  dashboardFinishedTasks: "Finished Tasks",
  noUnfinishedTasks: "No pending unfinished tasks.",
  noFinishedTasks: "No completed tasks yet.",
  dashboardImportantIdeas: "Important Ideas",
  noImportantIdeas: "No ideas marked as important.",
  dashboardUnimportantIdeas: "Minor / Unrated Ideas",
  noUnimportantIdeas: "No minor ideas.",
  workStoryDesc:
    "Work story formed by 5-minute periodic screenshots and screenshot notes taken from distraction screens",
  contextStatsTitle: "Active Contexts Breakdown",
  appDistractionTitle: "Open Windows & Tabs",
  ssCaptureActive: "📸 Capturing screen...",

  shortBreakPromptTitle: "🎯 What Are You Occupied With? (Context)",
  shortBreakPromptHint:
    "Set your active context before taking a short break; we'll remind you where you left off:",
  shortBreakPromptPlaceholder:
    "Type what you're actively working on (e.g. Calc Problem 4, Auth API)...",
  shortBreakStartBtn: "☕ Start Short Break",
  shortBreakReminderPrefix: "🎯 Last Context:",
  contextReminderPrefix: "🎯 Last Context:",
  setContextBadgePlaceholder: "Context",

  contextShortTab: "Context",
  contextFullTab: "Context Study Statistics",
  appsShortTab: "App/Tab",
  appsFullTab: "Distractions by Open App & Tab",
  noContextStats:
    "No context entries yet. Use the context global hotkey to log what you are working on.",
  noAppDistractions: "No app/tab distraction records logged yet.",

  shortcutsSectionTitle: "⌨️ Global Shortcuts (Centered Spotlight Input)",
  shortcutDistractLabel: "⚡ Capture Distraction / Task / Idea",
  shortcutContextLabel: "🎯 Log Current Context",
  shortcutRecordPressKeys: "Press shortcut keys... (Esc cancel)",
  shortcutResetBtn: "Default Shortcuts",
  shortcutTestBtn: "Test",
};

export const translations: Record<ActiveLang, Translations> = { tr, en };

export function resolveLanguage(pref: LangCode): ActiveLang {
  if (pref === "tr" || pref === "en") return pref;
  const sys = (navigator.language || "").toLowerCase();
  if (sys.startsWith("tr")) return "tr";
  return "en";
}
