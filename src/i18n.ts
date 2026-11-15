export type LangCode = "auto" | "tr" | "en";
export type ActiveLang = "tr" | "en";

const PLACEHOLDER_INSIGHT_TAGS = new Set([
  "Tag Yok",
  "No Tag",
  "Diğer",
  "Other",
  "",
]);

function sanitizeInsightTopTag(topTag: string | null): string | null {
  const trimmed = topTag?.trim() || "";
  return PLACEHOLDER_INSIGHT_TAGS.has(trimmed) ? null : trimmed;
}

export interface Translations {
  work: string;
  break: string;
  menu: string;
  home: string;
  settings: string;
  summary: string;
  resumeHint: (mins: number) => string;
  start: string;
  stop: string;
  add: string;
  cancel: string;
  other: string;
  totalWork: string;
  sessions: string;
  average: string;
  summaryTitle: string;
  summaryHoverHint: string;
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
  formatDuration: (sec: number) => string;

  // Erken durdurma & Taglar
  earlyStopTitle: string;
  earlyStopWorkedTime: (mins: number) => string;
  finishWithoutTag: string;
  cancelReturn: string;
  addAndFinish: string;
  editTags: string;
  doneEditing: string;
  deleteTagConfirm: (name: string) => string;
  editTagPrompt: (name: string) => string;
  newTagPrompt: string;
  newTagPlaceholder: string;
  addNewTagBtn: string;

  // Dikkat Dağılması pop-up & Ek süre
  distractionTitle: string;
  selectTagHint: string;
  previousReasons: string;
  distractExplanationPlaceholder: string;
  endingExplanationPlaceholder: string;
  saveAndAddMin: (mins: number) => string;
  distractPenaltySetting: string;

  // Özet haftalık görünüm, etiket kırılımı & sıfırlama
  summaryDailyTab: string;
  summaryWeeklyTab: string;
  weeklyTotal: string;
  weeklyDailyAvg: string;
  resetAllData: string;
  resetConfirmTitle: string;
  resetConfirmDesc: string;
  resetConfirmYes: string;
  avgDistractionsPerSession: string;
  distractionReasonsTab: string;
  endingReasonsTab: string;
  workTagsTab: string;
  breakOvertimeTab: string;
  noTimelineSessions: string;
  noEndingReasons: string;
  sessionCompleted: string;

  // Export & Break Overdue / Extension
  exportDataBtn: string;
  exportDataTooltip: (dirPath: string) => string;
  exportSavedMsg: (filePath: string) => string;
  todayBtn: string;
  calendarPickerTooltip: string;
  breakdownTitle: string;
  breakOverdueBadge: (time: string) => string;
  breakOverdueTitle: string;
  breakOverdueDesc: (time: string) => string;
  saveAndStartWork: string;
  skipAndStartWork: string;
  startWorkBtn: string;

  // Çalışma konusu (What are you working on)
  whatAreYouWorkingOn: string;
  workTopicPlaceholder: string;
  selectWorkTopic: string;
  changeWorkTopic: string;
  topicShortLabel: string;
  contextShortLabel: string;

  // Çalışma Planları & Döngü & Kısa Mola
  planNames: Record<string, string>;
  planDetailTooltip: (
    name: string,
    workMins: number,
    shortMins: number,
    stdMins: number,
    longMins: number,
    interval: number,
  ) => string;
  planBreaksChipTooltip: (
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
  shortBreakBtn: (m: number) => string;
  shortBreakBtnTooltip: (m: number) => string;
  shortBreaksCountBadge: (n: number) => string;
  distractedBtnCompact: (mins: number) => string;
  distractedBtnTooltip: (mins: number) => string;
  stopBtnTooltip: string;
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
  uiScaleLabel: string;
  windowSizeHint: (w: number, h: number) => string;
  saveCurrentSizeBtn: string;
  resetStandardSizeBtn: string;
  sizeSavedBadge: string;

  miniDockTooltip: string;
  restoreWindowTooltip: string;
  hideToTrayOnlyTooltip: string;

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

  defaultCategoryTags: Record<
    "impulsive_task" | "idea" | "internal" | "external",
    string[]
  >;
  noTagLabel: string;
  defaultEndingTags: string[];
  defaultWorkTags: string[];
  defaultBreakOvertimeTags: string[];

  // 4 Dikkat Kategorisi, Global Hızlı Yakalama, Otopark, Çalışma Hikayesi & Bulut Dashboard
  catImpulsiveTask: string;
  catIdea: string;
  catInternal: string;
  catExternal: string;
  catKeyHints: {
    impulsive_task: string;
    idea: string;
    internal: string;
    external: string;
  };
  noPenaltyParkingBadge: string;
  addsPenaltyBadge: (mins: number) => string;

  qcInputPlaceholders: {
    impulsive_task: string;
    idea: string;
    internal: string;
    external: string;
  };
  qcStepCategoryHint: string;
  qcStepTagHint: string;
  qcStepInputHint: string;
  qcStepContextHint: string;
  popularEntriesLabel: string;
  qcActiveTabLabel: string;
  qcCurrentContextLabel: string;
  qcContextNone: string;
  qcReminderTitle: string;
  qcReminderCloseHint: string;
  qcContextHeader: string;
  qcContextPlaceholder: string;
  qcRecentContextsLabel: string;

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

  docsSyncAllBtn: string;
  docsSyncSingleBtn: string;
  docsSyncedBadge: string;
  openGoogleDocBtn: string;
  googleDocUrlHint: string;

  workStoryEmpty: string;
  storyFramesCount: (n: number) => string;
  storyPlayBtn: string;
  storyPauseBtn: string;
  storyFullscreenBtn: string;
  storyHoverTooltip: (
    title: string,
    topics: string,
    contexts: string,
    apps: string,
    count: number,
  ) => string;

  dashboardBtn: string;
  dashboardTitle: string;
  cloudAuthTitle: string;
  cloudEmailPlaceholder: string;
  cloudNamePlaceholder: string;
  cloudTokenPlaceholder: string;
  cloudServerPlaceholder: string;

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
  contextStatsTitle: string;
  appDistractionTitle: string;

  shortBreakPromptTitle: string;
  shortBreakPromptHint: string;
  shortBreakPromptPlaceholder: string;
  shortBreakStartBtn: string;
  contextReminderPrefix: string;

  contextShortTab: string;
  contextFullTab: string;
  appsShortTab: string;
  appsFullTab: string;
  noContextStats: string;
  noAppDistractions: string;

  shortcutsSectionTitle: string;
  shortcutDistractLabel: string;
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
  resumeHint: (mins) => `Kaldığın yer (${mins} dk çalışıldı)`,
  start: "Başlat",
  stop: "Durdur",
  add: "Ekle",
  cancel: "İptal",
  other: "Diğer",
  totalWork: "Toplam Çalışma",
  sessions: "Tur",
  average: "Ortalama",
  summaryTitle: "⠿ Çalışma ve Odak Özeti",
  summaryHoverHint: "Detay görmek için gün çubuklarının üzerine gel",
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
  formatDuration: (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.round((sec % 3600) / 60);
    if (hrs === 0) return `${mins} dk`;
    return `${hrs}s ${mins}dk`;
  },

  // Erken durdurma & Taglar
  earlyStopTitle: "Turu Erken Bitir (Neden & Tag)",
  earlyStopWorkedTime: (mins) => `${mins} dakika çalışıldı`,
  finishWithoutTag: "Tag'siz Bitir",
  cancelReturn: "Vazgeç / Devam Et",
  addAndFinish: "Bitir",
  editTags: "Tagları Düzenle",
  doneEditing: "Tamam",
  deleteTagConfirm: (name) => `"${name}" tag'ini silmek istiyor musunuz?`,
  editTagPrompt: (name) => `"${name}" için yeni tag adı:`,
  newTagPrompt: "Yeni tag adı girin:",
  newTagPlaceholder: "Yeni tag adı...",
  addNewTagBtn: "+ Tag",

  // Dikkat Dağılması pop-up & Ek süre
  distractionTitle: "Dikkat Dağılması Kaydet",
  selectTagHint: "Tag seç (isteğe bağlı):",
  previousReasons: "Önceki açıklamalar:",
  distractExplanationPlaceholder: "Açıklama yaz (veya yukarıdan seç)...",
  endingExplanationPlaceholder: "Açıklama yaz (veya yukarıdan seç)...",
  saveAndAddMin: (mins) => (mins > 0 ? `Kaydet (+${mins}dk)` : "Kaydet"),
  distractPenaltySetting: "Dikkat Dağılma Ekleme Süresi",

  // Özet haftalık görünüm, etiket kırılımı & sıfırlama
  summaryDailyTab: "Günlük",
  summaryWeeklyTab: "Haftalık",
  weeklyTotal: "Haftalık Toplam",
  weeklyDailyAvg: "Haftalık Günlük Ort.",
  resetAllData: "Verileri Sıfırla",
  resetConfirmTitle: "Veriler Sıfırlansın mı?",
  resetConfirmDesc:
    "Tüm geçmiş çalışma seansları, günler ve dikkat dağılma kayıtları tamamen silinecektir. Bu işlem geri alınamaz.",
  resetConfirmYes: "Evet, Tümünü Sıfırla",
  avgDistractionsPerSession: "Tur Başı Ort. Dikkat",
  distractionReasonsTab: "Dikkat Dağılmaları",
  endingReasonsTab: "Erken Bitirmeler",
  workTagsTab: "Çalışma Konuları",
  breakOvertimeTab: "Mola Gecikmeleri",
  noTimelineSessions: "Henüz kayıtlı zaman dilimi yok.",
  noEndingReasons: "Henüz kayıtlı erken bitirme nedeni yok.",
  sessionCompleted: "Çalışma Turu Tamamlandı! 🎉",

  // Export & Break
  exportDataBtn: "📥 Verileri İndir (JSON)",
  exportDataTooltip: (dirPath) =>
    `Tek JSON yedeği İndirilenler klasörüne kaydedilir (resimsiz & stories hariç):\n${dirPath}\\pomodoro-backup.json`,
  exportSavedMsg: (filePath) => `✓ Kaydedildi: ${filePath}`,
  todayBtn: "Bugün",
  calendarPickerTooltip: "Takvimden gün seç",
  breakdownTitle: "Dağılma, Gecikme & Erken Bitirme Kırılımı",
  breakOverdueBadge: (time: string) => `Mola Bitti! (+${time})`,
  breakOverdueTitle: "Mola Uzatma / Gecikme Sebebi",
  breakOverdueDesc: (time: string) =>
    `Molayı ${time} uzattın. Sebebini seçebilir veya not ekleyebilirsin:`,
  saveAndStartWork: "Kaydet & Çalışmaya Başla",
  skipAndStartWork: "Sebebi Geç & Başla",
  startWorkBtn: "Çalışmaya Başla",

  // Çalışma Konusu
  whatAreYouWorkingOn: "Ne Çalışıyorsun?",
  workTopicPlaceholder: "Ders, konu veya görev yaz (örn: Matematik, Rust)...",
  selectWorkTopic: "Konu Seç",
  changeWorkTopic: "Konu",
  topicShortLabel: "Konu",
  contextShortLabel: "Bağlam",

  // Çalışma Planları & Döngü & Kısa Mola
  planNames: {
    classic: "Klasik",
    developer: "Geliştirici",
    ultradian: "Ultradian",
    custom: "Özel",
  },
  planDetailTooltip: (name, w, sb, std, lb, cyc) =>
    `${name}: ${w} dk çalışma • ${sb} dk kısa mola • ${std} dk standart mola • Her ${cyc} çalışmada ${lb} dk uzun mola`,
  planBreaksChipTooltip: (sb, std, lb, cyc) =>
    `Kısa Mola: ${sb} dk • Standart Mola: ${std} dk • Uzun Mola: ${lb} dk (her ${cyc} döngüde)`,
  planLockedDuringSession:
    "Aktif seans sürerken plan değiştirilemez. Önce seansı bitirin.",
  planWorkMins: "Çalışma Süresi (dk)",
  planShortBreakMins: "Kısa Mola (dk)",
  planStandardBreakMins: "Standart Mola (dk)",
  planLongBreakMins: "Uzun Mola (dk)",
  planLongBreakInterval: "Uzun Mola Döngüsü",
  shortBreakBtn: (m: number) => `☕ ${m}dk`,
  shortBreakBtnTooltip: (m: number) =>
    `Kısa Mola (${m} dk) — Mevcut çalışma süreniz korunur`,
  shortBreaksCountBadge: (n: number) => `Bu oturumda ${n} kısa mola verildi`,
  distractedBtnCompact: (mins: number) => (mins > 0 ? `⚡ +${mins}dk` : "⚡"),
  distractedBtnTooltip: (mins: number) =>
    mins > 0
      ? `Dikkatim dağıldı (+${mins} dk ekle ve neden kaydet)`
      : "Dikkatim dağıldı (Süre eklemeden neden kaydet)",
  stopBtnTooltip: "Mevcut sayacı erken bitir veya sıfırla",
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
  startSessionBtn: "▶ Oturumu Başlat",
  startSessionTooltip: "Seçili planla yeni çalışma oturumu başlatır ve sayacı açar",
  finishSessionBtn: "⏹ Oturumu Bitir",
  finishSessionTooltip: "Aktif oturumu sonlandırır ve ilerlemeyi kaydeder",
  returnToWorkMenuBtn: "▶ Çalışmaya Dön",
  returnToBreakMenuBtn: "▶ Molaya Dön",
  sessionIdleLabel: "Aktif oturum yok",
  sessionIdleTooltip:
    "Sayaç başlatmak için aşağıdan plan seçip 'Oturumu Başlat'a tıklayın",
  sessionActiveTooltip: (modeLabel, topic, shortBreaks) =>
    `Aktif Oturum • Mod: ${modeLabel} • Konu: ${topic || "Belirtilmedi"} • Kısa mola: ${shortBreaks}`,
  statusRunning: "Çalışıyor",
  statusPaused: "Duraklatıldı",
  editPlansTitle: "Çalışma & Mola Planları",
  resetPlansDefault: "Varsayılana Dön",
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
  uiScaleLabel: "🔍 Ekran Ölçeği (UI Boyutu)",
  windowSizeHint: (w, h) =>
    `Pencereyi kenarlarından sürükleyip büyütebilir/küçültebilirsin (Şu an: ${w}×${h}px)`,
  saveCurrentSizeBtn: "💾 Mevcut Boyutu Kaydet",
  resetStandardSizeBtn: "↺ Standart Boyuta Dön",
  sizeSavedBadge: "Boyut kaydedildi ✓",

  miniDockTooltip: "Sağ alt mini sayaç moduna küçült",
  restoreWindowTooltip: "Normal pencere boyutuna geri dön",
  hideToTrayOnlyTooltip: "Tamamen sistem tepsisine (tray) gizle",

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
    const safeTopTag = sanitizeInsightTopTag(topTag);
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
        `🧠 Bölünmelerinin %${intPct}'i içsel dürtü kaynaklı${safeTopTag ? ` (en sık: ${safeTopTag})` : ""}. Aklına gelen şeyi "sonra bakılacaklar" notuna yazıp sayaca dönmeyi dene.`,
      );
    } else if (intPct > 0 && intPct <= 35) {
      parts.push(
        `🔔 Bölünmelerinin çoğu dışsal uyaranlardan geliyor${safeTopTag ? ` (${safeTopTag})` : ""}. Seans başında bildirimleri sessize almak odak süreni ciddi artıracaktır.`,
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

  defaultCategoryTags: {
    impulsive_task: ["Mesaj / E-posta", "Ufak İş", "Araştırma", "Alışveriş", "Düzenleme"],
    idea: ["Proje", "Özellik", "İçerik", "Hayat", "Not"],
    internal: ["Düşünceler", "Sosyal Medya", "Telefon", "Açlık / Kahve", "Yorgunluk", "Sıkılma"],
    external: ["Bildirim", "İnsanlar / Ses", "Telefon Çağrısı", "Acil İş", "Ortam"],
  },
  noTagLabel: "Tag Yok",
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

  // 4 Dikkat Kategorisi
  catImpulsiveTask: "Dürtüsel Görev",
  catIdea: "Akla Gelen Fikir",
  catInternal: "İçsel Tetikleyici",
  catExternal: "Dışsal Tetikleyici",
  catKeyHints: {
    impulsive_task: "1·G",
    idea: "2·F",
    internal: "3·İ",
    external: "4·D",
  },
  noPenaltyParkingBadge: "+0dk • Otopark",
  addsPenaltyBadge: (mins) => (mins > 0 ? `+${mins}dk eklenir` : "+0dk"),

  qcInputPlaceholders: {
    impulsive_task:
      "Molada yapılacak dürtüsel görevi yaz ve Enter'a bas (ek süre eklenmez)...",
    idea: "Aklına gelen fikri yaz ve Enter'a bas (ek süre eklenmez)...",
    internal: "İçsel tetikleyiciyi / düşünceyi yaz ve Enter'a bas...",
    external: "Dışsal uyaranı (bildirim, ses vb.) yaz ve Enter'a bas...",
  },
  qcStepCategoryHint: "Tab: Kategori • Enter: Seç • 1-4: Hızlı Seç • Esc: Kapat",
  qcStepTagHint: "Tab: Tag Seç • Enter: Onayla • Esc: Geri",
  qcStepInputHint: "Tab: Popüler Kayıtlar • Enter: Kaydet • Esc: Geri",
  qcStepContextHint: "Tab: Son Bağlamlar • Enter: Onayla • Esc: Geç",
  popularEntriesLabel: "Popüler kayıtlar (Tab ile seç):",
  qcActiveTabLabel: "Son Açık Sekme",
  qcCurrentContextLabel: "Aktif Bağlam",
  qcContextNone: "Belirtilmedi",
  qcReminderTitle: "🎯 Son Kalınan Meşguliyet — Kaldığın Yerden Devam Et:",
  qcReminderCloseHint: "Enter / Space / Esc ile hemen pencereye dön",
  qcContextHeader: "Bağlam (Context)",
  qcContextPlaceholder:
    "Şu an odaklandığın spesifik işi yaz ve Enter'a bas (örn: Türev Test 2, API Auth)...",
  qcRecentContextsLabel: "Son bağlamlar (Tab ile seç):",

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

  docsSyncAllBtn: "📄 Google Dokümanlara Aktar",
  docsSyncSingleBtn: "📄 Docs'a Gönder",
  docsSyncedBadge: "Docs ✓",
  openGoogleDocBtn: "📄 Odak Defteri Dokümanını Aç",
  googleDocUrlHint: "Google Docs ve Drive API ile canlı senkronize edilen dokümanınız",

  workStoryEmpty:
    "Henüz çalışma hikayesi kaydı yok. Çalışma sayacı çalışırken her 5 dakikada bir otomatik ekran görüntüsü + açık pencere + context kaydedilir.",
  storyFramesCount: (n) => `${n} kare • 5'er dk`,
  storyPlayBtn: "▶ Oynat",
  storyPauseBtn: "⏸ Duraklat",
  storyFullscreenBtn: "🔍 Büyüt",
  storyHoverTooltip: (title, topics, contexts, apps, count) =>
    `${title} (${count} kare)\n💼 Konu: ${topics}\n🎯 Bağlam: ${contexts}\n🌐 Uygulama / Not: ${apps}`,

  dashboardBtn: "Dashboard",
  dashboardTitle: "📊 Kişisel Odak & Bulut Dashboard",
  cloudAuthTitle: "☁️ Google Hesabı & Bulut Senkronizasyonu (Çevrimdışı Destekli)",
  cloudEmailPlaceholder: "Google E-posta (örn: ad.soyad@gmail.com)",
  cloudNamePlaceholder: "Görünen İsim (örn: Elyas)",
  cloudTokenPlaceholder: "Google OAuth Access Token (Docs & Drive API için)",
  cloudServerPlaceholder: "Sunucu URL (varsayılan: http://localhost:4000)",

  syncRunning: "Senkronize ediliyor...",
  manualSyncBtn: "Şimdi Senkronize Et",
  cloudAuthSignOut: "Çıkış Yap",
  cloudAuthSignIn: "Giriş Yap",
  cloudAuthHint:
    "Google OAuth Access Token girildiğinde '🎯 Pomodoro Odak & Fikir Defteri' Google Dokümanı ve Drive resimleri doğrudan resmi Google API ile güncellenir.",
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
  contextStatsTitle: "Meşguliyet Dağılımı",
  appDistractionTitle: "Açık Pencere & Sekmeler",

  shortBreakPromptTitle: "Aktif Bağlam",
  shortBreakPromptHint:
    "Kısa molaya girmeden önce aktif meşguliyetini belirle; mola bitince kaldığın yeri hatırlatalım:",
  shortBreakPromptPlaceholder:
    "Şu an odaklandığın spesifik işi yaz (örn: Türev Test 2, API Auth)...",
  shortBreakStartBtn: "☕ Molaya Geç",
  contextReminderPrefix: "🎯 Son Meşguliyet:",

  contextShortTab: "Bağlam",
  contextFullTab: "Meşguliyet (Context) Çalışma İstatistikleri",
  appsShortTab: "Sekme",
  appsFullTab: "Açık Uygulama & Sekme Bazlı Dağılmalar",
  noContextStats:
    "Henüz meşguliyet (context) kaydı yok. Konu alanından veya içsel/dışsal dağılma sonrası bağlam ekleyebilirsin.",
  noAppDistractions:
    "Henüz açık uygulama veya sekme bilgisi içeren dağılma kaydı yok.",

  shortcutsSectionTitle: "⌨️ Global Kısayollar (Ekran Ortasında Hızlı Input)",
  shortcutDistractLabel: "⚡ Dikkat / Görev / Fikir Yakala",
  shortcutRecordPressKeys: "Tuş kombinasyonuna basın... (Esc iptal)",
  shortcutResetBtn: "Varsayılan Kısayol",
  shortcutTestBtn: "Test",
};

const en: Translations = {
  work: "Work",
  break: "Break",
  menu: "Menu",
  home: "Home",
  settings: "Settings",
  summary: "Summary",
  resumeHint: (mins) => `Resumed (${mins} min worked)`,
  start: "Start",
  stop: "Stop",
  add: "Add",
  cancel: "Cancel",
  other: "Other",
  totalWork: "Total Work",
  sessions: "Rounds",
  average: "Average",
  summaryTitle: "⠿ Work & Focus Summary",
  summaryHoverHint: "Hover over day bars to view details",
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
  formatDuration: (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.round((sec % 3600) / 60);
    if (hrs === 0) return `${mins} min`;
    return `${hrs}h ${mins}m`;
  },

  // Erken durdurma & Taglar
  earlyStopTitle: "End Round Early (Reason & Tag)",
  earlyStopWorkedTime: (mins) => `${mins} minutes completed`,
  finishWithoutTag: "End Without Tag",
  cancelReturn: "Cancel / Continue",
  addAndFinish: "Finish",
  editTags: "Edit Tags",
  doneEditing: "Done",
  deleteTagConfirm: (name) => `Delete tag "${name}"?`,
  editTagPrompt: (name) => `Enter new name for "${name}":`,
  newTagPrompt: "Enter new tag name:",
  newTagPlaceholder: "New tag name...",
  addNewTagBtn: "+ Tag",

  // Dikkat Dağılması pop-up & Ek süre
  distractionTitle: "Record Distraction",
  selectTagHint: "Select Tag (Optional):",
  previousReasons: "Recent explanations:",
  distractExplanationPlaceholder: "Type explanation (or select above)...",
  endingExplanationPlaceholder: "Type explanation (or select above)...",
  saveAndAddMin: (mins) => (mins > 0 ? `Save (+${mins}m)` : "Save"),
  distractPenaltySetting: "Distraction Added Time",

  // Özet haftalık görünüm, etiket kırılımı & sıfırlama
  summaryDailyTab: "Daily",
  summaryWeeklyTab: "Weekly",
  weeklyTotal: "Weekly Total",
  weeklyDailyAvg: "Daily Avg (Week)",
  resetAllData: "Reset All Data",
  resetConfirmTitle: "Reset all data?",
  resetConfirmDesc:
    "All session history, days, and distraction records will be permanently erased. This cannot be undone.",
  resetConfirmYes: "Yes, Reset All",
  avgDistractionsPerSession: "Avg Distractions/Round",
  distractionReasonsTab: "Distractions",
  endingReasonsTab: "Early Stops",
  workTagsTab: "Work Topics",
  breakOvertimeTab: "Break Delays",
  noTimelineSessions: "No session intervals recorded yet.",
  noEndingReasons: "No early stop reasons recorded yet.",
  sessionCompleted: "Work Round Completed! 🎉",

  // Export & Break
  exportDataBtn: "📥 Export Data (JSON)",
  exportDataTooltip: (dirPath) =>
    `Single JSON backup saved to Downloads (no images or stories):\n${dirPath}\\pomodoro-backup.json`,
  exportSavedMsg: (filePath) => `✓ Saved: ${filePath}`,
  todayBtn: "Today",
  calendarPickerTooltip: "Pick a date from calendar",
  breakdownTitle: "Distractions, Overtime & Early Stops",
  breakOverdueBadge: (time: string) => `Break Over! (+${time})`,
  breakOverdueTitle: "Break Overdue Reason",
  breakOverdueDesc: (time: string) =>
    `Break exceeded by ${time}. Select reason or enter a note:`,
  saveAndStartWork: "Save & Start Work",
  skipAndStartWork: "Skip Reason & Start",
  startWorkBtn: "Start Work",

  // Study Topic
  whatAreYouWorkingOn: "What are you working on?",
  workTopicPlaceholder: "Enter topic or task (e.g. Math, Rust, Study)...",
  selectWorkTopic: "Select Topic",
  changeWorkTopic: "Work Topic",
  topicShortLabel: "Topic",
  contextShortLabel: "Context",

  // Study Plans & Cycle & Short Break
  planNames: {
    classic: "Classic",
    developer: "Developer",
    ultradian: "Ultradian",
    custom: "Custom",
  },
  planDetailTooltip: (name, w, sb, std, lb, cyc) =>
    `${name}: ${w}m work • ${sb}m short break • ${std}m standard break • ${lb}m long break every ${cyc} cycles`,
  planBreaksChipTooltip: (sb, std, lb, cyc) =>
    `Short Break: ${sb}m • Standard Break: ${std}m • Long Break: ${lb}m (every ${cyc} cycles)`,
  planLockedDuringSession:
    "Cannot change plan during an active session. Finish the session first.",
  planWorkMins: "Work Duration (min)",
  planShortBreakMins: "Short Break (min)",
  planStandardBreakMins: "Standard Break (min)",
  planLongBreakMins: "Long Break (min)",
  planLongBreakInterval: "Long Break Cycle",
  shortBreakBtn: (m: number) => `☕ ${m}m`,
  shortBreakBtnTooltip: (m: number) =>
    `Take Short Break (${m} min) — keeps your current work timer`,
  shortBreaksCountBadge: (n: number) => `${n} short break(s) taken in this session`,
  distractedBtnCompact: (mins: number) => (mins > 0 ? `⚡ +${mins}m` : "⚡"),
  distractedBtnTooltip: (mins: number) =>
    mins > 0
      ? `Distracted (+${mins} min & log reason)`
      : "Distracted (log reason without adding time)",
  stopBtnTooltip: "End early or reset current timer",
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
  startSessionBtn: "▶ Start Session",
  startSessionTooltip:
    "Start a new work session (set of Pomodoro rounds) with the selected plan",
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
  uiScaleLabel: "🔍 Display Scale (UI Size)",
  windowSizeHint: (w, h) =>
    `Drag window edges to resize freely (Current: ${w}×${h}px)`,
  saveCurrentSizeBtn: "💾 Save Current Size",
  resetStandardSizeBtn: "↺ Reset Standard Size",
  sizeSavedBadge: "Size saved ✓",

  miniDockTooltip: "Minimize to bottom-right mini counter widget",
  restoreWindowTooltip: "Restore normal window size",
  hideToTrayOnlyTooltip: "Hide completely to system tray",

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
    const safeTopTag = sanitizeInsightTopTag(topTag);
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
        `🧠 ${intPct}% of your distractions are internal impulses${safeTopTag ? ` (top: ${safeTopTag})` : ""}. Keep a quick "parking lot" scratchpad for sudden thoughts.`,
      );
    } else if (intPct > 0 && intPct <= 35) {
      parts.push(
        `🔔 Most distractions are external triggers${safeTopTag ? ` (${safeTopTag})` : ""}. Silencing notifications before starting will protect your flow.`,
      );
    }
    if (overtimeRate >= 40) {
      parts.push(
        `⏰ You experience transition friction returning from breaks (${overtimeRate}% overtime). Avoid dopamine traps (scrolling) during short breaks.`,
      );
    }
    return parts.length > 0
      ? parts.join("\n\n")
      : "🌱 As you complete sessions and log distractions, personalized ADHD self-realization insights will appear here.";
  },

  defaultCategoryTags: {
    impulsive_task: ["Message / Email", "Quick Chore", "Lookup", "Shopping", "Organize"],
    idea: ["Project", "Feature", "Content", "Life", "Note"],
    internal: ["Thoughts", "Social Media", "Phone", "Hunger / Coffee", "Fatigue", "Boredom"],
    external: ["Notification", "People / Noise", "Phone Call", "Urgent Task", "Environment"],
  },
  noTagLabel: "No Tag",
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

  // 4 Distraction Categories
  catImpulsiveTask: "Impulsive Task",
  catIdea: "Sudden Idea",
  catInternal: "Internal Trigger",
  catExternal: "External Trigger",
  catKeyHints: {
    impulsive_task: "1·G",
    idea: "2·F",
    internal: "3·I",
    external: "4·D",
  },
  noPenaltyParkingBadge: "+0m • Parking Lot",
  addsPenaltyBadge: (mins) => (mins > 0 ? `+${mins}m added` : "+0m"),

  qcInputPlaceholders: {
    impulsive_task:
      "Type impulsive task for your break & press Enter (no time added)...",
    idea: "Type your idea & press Enter (no time added)...",
    internal: "Type internal thought / urge & press Enter...",
    external: "Type external trigger (notification, noise...) & press Enter...",
  },
  qcStepCategoryHint: "Tab: Category • Enter: Select • 1-4: Quick Pick • Esc: Close",
  qcStepTagHint: "Tab: Select Tag • Enter: Confirm • Esc: Back",
  qcStepInputHint: "Tab: Popular Entries • Enter: Save • Esc: Back",
  qcStepContextHint: "Tab: Recent Contexts • Enter: Confirm • Esc: Skip",
  popularEntriesLabel: "Popular entries (Tab to select):",
  qcActiveTabLabel: "Last Open Tab",
  qcCurrentContextLabel: "Active Context",
  qcContextNone: "Not set",
  qcReminderTitle: "🎯 Last Active Context — Resume Right Here:",
  qcReminderCloseHint: "Press Enter / Space / Esc to return immediately",
  qcContextHeader: "Active Context",
  qcContextPlaceholder:
    "Type what you're actively working on & press Enter (e.g. Calc Problem 4, Auth API)...",
  qcRecentContextsLabel: "Recent contexts (Tab to select):",

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

  docsSyncAllBtn: "📄 Sync to Google Docs",
  docsSyncSingleBtn: "📄 Send to Docs",
  docsSyncedBadge: "Docs ✓",
  openGoogleDocBtn: "📄 Open Focus Notebook Doc",
  googleDocUrlHint: "Your living Google Doc synchronized via Google Docs & Drive API",

  workStoryEmpty:
    "No work story snapshots yet. While the work timer is running, a snapshot + active window + context is captured every 5 minutes.",
  storyFramesCount: (n) => `${n} frames • 5m intervals`,
  storyPlayBtn: "▶ Play",
  storyPauseBtn: "⏸ Pause",
  storyFullscreenBtn: "🔍 Expand",
  storyHoverTooltip: (title, topics, contexts, apps, count) =>
    `${title} (${count} frames)\n💼 Topic: ${topics}\n🎯 Context: ${contexts}\n🌐 App / Note: ${apps}`,

  dashboardBtn: "Dashboard",
  dashboardTitle: "📊 Personal Focus & Cloud Dashboard",
  cloudAuthTitle: "☁️ Google Account & Cloud Sync (Offline-First)",
  cloudEmailPlaceholder: "Google Email (e.g. name@gmail.com)",
  cloudNamePlaceholder: "Display Name",
  cloudTokenPlaceholder: "Google OAuth Access Token (for Docs & Drive API)",
  cloudServerPlaceholder: "Server URL (default: http://localhost:4000)",

  syncRunning: "Syncing...",
  manualSyncBtn: "Sync Now",
  cloudAuthSignOut: "Sign Out",
  cloudAuthSignIn: "Sign In",
  cloudAuthHint:
    "When a Google OAuth Access Token is provided, your '🎯 Pomodoro Odak & Fikir Defteri' Google Document and Drive screenshots are updated directly via official Google REST API.",
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
  contextStatsTitle: "Active Contexts Breakdown",
  appDistractionTitle: "Open Windows & Tabs",

  shortBreakPromptTitle: "Active Context",
  shortBreakPromptHint:
    "Set your active context before taking a short break; we'll remind you where you left off:",
  shortBreakPromptPlaceholder:
    "Type what you're actively working on (e.g. Calc Problem 4, Auth API)...",
  shortBreakStartBtn: "☕ Start Short Break",
  contextReminderPrefix: "🎯 Last Context:",

  contextShortTab: "Context",
  contextFullTab: "Context Study Statistics",
  appsShortTab: "App/Tab",
  appsFullTab: "Distractions by Open App & Tab",
  noContextStats:
    "No context entries yet. Set it from the Work Topic modal or after an internal/external distraction.",
  noAppDistractions: "No app/tab distraction records logged yet.",

  shortcutsSectionTitle: "⌨️ Global Shortcuts (Centered Spotlight Input)",
  shortcutDistractLabel: "⚡ Capture Distraction / Task / Idea",
  shortcutRecordPressKeys: "Press shortcut keys... (Esc cancel)",
  shortcutResetBtn: "Default Shortcut",
  shortcutTestBtn: "Test",
};

export const translations: Record<ActiveLang, Translations> = { tr, en };

export function resolveLanguage(pref: LangCode): ActiveLang {
  if (pref === "tr" || pref === "en") return pref;
  const sys = (navigator.language || "").toLowerCase();
  if (sys.startsWith("tr")) return "tr";
  return "en";
}
