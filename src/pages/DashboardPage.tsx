import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  ActiveDayStats,
  AppDistractionGroup,
  CloudAuthState,
  ContextStatItem,
  ParkingItem,
  ParkingLotData,
  WorkStoryEntry,
} from "../db";
import type { Translations } from "../i18n";
import {
  ParkingIdeaRow,
  ParkingTaskRow,
  WorkStoryGrid,
} from "../components/ParkingLot";

export interface DashboardPageProps {
  t: Translations;
  freqOnlyToday: boolean;
  cloudAuth: CloudAuthState;
  isOnline: boolean;
  pendingSyncCount: number;
  syncStatusMsg: string | null;
  isSyncingCloud: boolean;
  cloudEmailInput: string;
  cloudNameInput: string;
  cloudTokenInput: string;
  cloudServerInput: string;
  dayStats: ActiveDayStats;
  summaryParkingData: ParkingLotData;
  workStoryEntries: WorkStoryEntry[];
  contextStats: ContextStatItem[];
  appDistractions: AppDistractionGroup[];
  onToggleFreqFilter: () => void;
  onOpenSummary: () => void;
  onOpenMenu: () => void;
  onEnterMiniDock: () => void;
  onManualCloudSync: () => void;
  onGoogleSignOut: () => void;
  onGoogleSignIn: () => void;
  onSaveCloudToken: () => void;
  onSetCloudEmailInput: (val: string) => void;
  onSetCloudNameInput: (val: string) => void;
  onSetCloudTokenInput: (val: string) => void;
  onSetCloudServerInput: (val: string) => void;
  onSyncParkingToDocs: () => void;
  onSyncSingleItemToDocs: (item: ParkingItem) => void;
  onToggleParkingTask: (id: number, done: boolean) => void;
  onRateParkingIdea: (
    id: number,
    rating: "important" | "unimportant" | "unrated",
  ) => void;
  onDeleteParkingEntry: (id: number) => void;
  onOpenLightbox: (entry: WorkStoryEntry) => void;
}

export function DashboardPage({
  t,
  freqOnlyToday,
  cloudAuth,
  isOnline,
  pendingSyncCount,
  syncStatusMsg,
  isSyncingCloud,
  cloudEmailInput,
  cloudNameInput,
  cloudTokenInput,
  cloudServerInput,
  dayStats,
  summaryParkingData,
  workStoryEntries,
  contextStats,
  appDistractions,
  onToggleFreqFilter,
  onOpenSummary,
  onOpenMenu,
  onEnterMiniDock,
  onManualCloudSync,
  onGoogleSignOut,
  onGoogleSignIn,
  onSaveCloudToken,
  onSetCloudEmailInput,
  onSetCloudNameInput,
  onSetCloudTokenInput,
  onSetCloudServerInput,
  onSyncParkingToDocs,
  onSyncSingleItemToDocs,
  onToggleParkingTask,
  onRateParkingIdea,
  onDeleteParkingEntry,
  onOpenLightbox,
}: DashboardPageProps) {
  const nonImportantIdeas = [
    ...summaryParkingData.unratedIdeas,
    ...summaryParkingData.unimportantIdeas,
  ];

  return (
    <div className="dashboard-container">
      <div className="top-bar">
        <div className="top-bar-left" style={{ gap: "6px" }}>
          <span className="badge">📊 {t.dashboardTitle}</span>
          <button
            type="button"
            className="ghost-btn"
            onClick={onToggleFreqFilter}
            title={freqOnlyToday ? t.filterToday : t.filterAll}
          >
            {freqOnlyToday ? t.filterTodayShort : t.filterAllShort}
          </button>
        </div>
        <div className="top-bar-right">
          <button
            className="ghost-btn"
            onClick={onOpenSummary}
            title={t.summaryTitle}
          >
            📈 {t.summary}
          </button>
          <button className="ghost-btn" onClick={onOpenMenu}>
            ← {t.home}
          </button>
          <button
            className="icon-btn"
            title={t.miniDockTooltip}
            onClick={onEnterMiniDock}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="dashboard-scroll">
        {/* BULUT VE GOOGLE AUTH ÇUBUĞU */}
        <div className="cloud-auth-bar">
          {cloudAuth.email ? (
            <div className="cloud-auth-logged">
              <div className="cloud-user-meta">
                <span className="cloud-online-dot" />
                <span className="cloud-user-name">
                  🟢 <b>{cloudAuth.email}</b>
                  {cloudAuth.name ? ` (${cloudAuth.name})` : ""}
                </span>
                <span className="cloud-sync-meta">
                  {isOnline ? "🌐 Online" : "📴 Offline"} •{" "}
                  {t.pendingSyncQueueBadge(pendingSyncCount)}
                  {cloudAuth.lastSyncAt && (
                    <>
                      {" "}
                      • {t.lastSyncLabel}: {cloudAuth.lastSyncAt.slice(11, 16)}
                    </>
                  )}
                </span>
              </div>
              <div className="cloud-auth-actions">
                {syncStatusMsg && (
                  <span className="docs-status-pill">{syncStatusMsg}</span>
                )}
                <button
                  type="button"
                  className="docs-sync-btn"
                  onClick={() => {
                    const url =
                      cloudAuth.googleDocUrl || "https://docs.google.com/";
                    openUrl(url).catch(() => window.open(url, "_blank"));
                  }}
                  title={t.googleDocUrlHint}
                >
                  {t.openGoogleDocBtn}
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={isSyncingCloud}
                  onClick={onManualCloudSync}
                >
                  🔄 {isSyncingCloud ? t.syncRunning : t.manualSyncBtn}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={onGoogleSignOut}
                >
                  {t.cloudAuthSignOut}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  marginTop: "6px",
                }}
              >
                <input
                  type="password"
                  className="cloud-input"
                  style={{ flex: 1 }}
                  placeholder={t.cloudTokenPlaceholder}
                  value={cloudTokenInput}
                  onChange={(e) => onSetCloudTokenInput(e.target.value)}
                />
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={onSaveCloudToken}
                >
                  💾 Token Kaydet
                </button>
              </div>
            </div>
          ) : (
            <div className="cloud-auth-signin-box">
              <div className="cloud-signin-header">
                <span style={{ fontWeight: 600, fontSize: "11px" }}>
                  ☁️ {t.cloudAuthTitle}
                </span>
                <span className="cloud-sync-meta">
                  {isOnline
                    ? "🌐 Çevrimiçi"
                    : "📴 Çevrimdışı (Kuyruk Aktif)"}{" "}
                  • {t.pendingSyncQueueBadge(pendingSyncCount)}
                </span>
              </div>
              <div className="cloud-signin-fields">
                <input
                  type="email"
                  className="cloud-input"
                  placeholder={t.cloudEmailPlaceholder}
                  value={cloudEmailInput}
                  onChange={(e) => onSetCloudEmailInput(e.target.value)}
                />
                <input
                  type="text"
                  className="cloud-input"
                  placeholder={t.cloudNamePlaceholder}
                  value={cloudNameInput}
                  onChange={(e) => onSetCloudNameInput(e.target.value)}
                />
                <input
                  type="password"
                  className="cloud-input"
                  placeholder={t.cloudTokenPlaceholder}
                  value={cloudTokenInput}
                  onChange={(e) => onSetCloudTokenInput(e.target.value)}
                />
                <input
                  type="text"
                  className="cloud-input"
                  placeholder={t.cloudServerPlaceholder}
                  value={cloudServerInput}
                  onChange={(e) => onSetCloudServerInput(e.target.value)}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={onGoogleSignIn}
                >
                  {t.cloudAuthSignIn}
                </button>
              </div>
              <div
                style={{ fontSize: "9px", color: "#a1a1aa", marginTop: "2px" }}
              >
                {t.cloudAuthHint}
              </div>
            </div>
          )}
        </div>

        {/* KPI KARTLARI */}
        <div className="dashboard-kpi-grid">
          <div className="stat-card">
            <div className="stat-val">{t.formatDuration(dayStats.totalSec)}</div>
            <div className="stat-lbl">{t.totalWork}</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{dayStats.sessionCount}</div>
            <div className="stat-lbl">{t.sessions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">
              {summaryParkingData.pendingTasks.length}
            </div>
            <div className="stat-lbl">{t.dashboardUnfinishedTasks}</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">
              {summaryParkingData.doneTasks.length}
            </div>
            <div className="stat-lbl">{t.dashboardFinishedTasks}</div>
          </div>
        </div>

        {/* ÇİFT KOLONLU GÖSTERGE ALANI */}
        <div className="dashboard-split-grid">
          {/* SOL KOLON: GÖREVLER & FİKİRLER */}
          <div className="dashboard-col">
            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  ⏳ {t.dashboardUnfinishedTasks} (
                  {summaryParkingData.pendingTasks.length})
                </span>
                <button
                  type="button"
                  className="docs-sync-btn"
                  onClick={onSyncParkingToDocs}
                  title={t.docsSyncAllBtn}
                >
                  📄 Docs
                </button>
              </div>
              <div className="dashboard-list">
                {summaryParkingData.pendingTasks.length === 0 ? (
                  <div className="dashboard-empty-msg">
                    {t.noUnfinishedTasks}
                  </div>
                ) : (
                  summaryParkingData.pendingTasks.map((it) => (
                    <ParkingTaskRow
                      key={it.id}
                      item={it}
                      isDone={false}
                      t={t}
                      onToggleTask={onToggleParkingTask}
                      onSyncSingleToDocs={onSyncSingleItemToDocs}
                      onDeleteEntry={onDeleteParkingEntry}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  ✅ {t.dashboardFinishedTasks} (
                  {summaryParkingData.doneTasks.length})
                </span>
              </div>
              <div className="dashboard-list">
                {summaryParkingData.doneTasks.length === 0 ? (
                  <div className="dashboard-empty-msg">{t.noFinishedTasks}</div>
                ) : (
                  summaryParkingData.doneTasks.map((it) => (
                    <ParkingTaskRow
                      key={it.id}
                      item={it}
                      isDone={true}
                      t={t}
                      onToggleTask={onToggleParkingTask}
                      onSyncSingleToDocs={onSyncSingleItemToDocs}
                      onDeleteEntry={onDeleteParkingEntry}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  ⭐ {t.dashboardImportantIdeas} (
                  {summaryParkingData.importantIdeas.length})
                </span>
              </div>
              <div className="dashboard-list">
                {summaryParkingData.importantIdeas.length === 0 ? (
                  <div className="dashboard-empty-msg">
                    {t.noImportantIdeas}
                  </div>
                ) : (
                  summaryParkingData.importantIdeas.map((it) => (
                    <ParkingIdeaRow
                      key={it.id}
                      item={it}
                      t={t}
                      showUnimportantBtn={false}
                      onRateIdea={onRateParkingIdea}
                      onSyncSingleToDocs={onSyncSingleItemToDocs}
                      onDeleteEntry={onDeleteParkingEntry}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  💤 {t.dashboardUnimportantIdeas} ({nonImportantIdeas.length})
                </span>
              </div>
              <div className="dashboard-list">
                {nonImportantIdeas.length === 0 ? (
                  <div className="dashboard-empty-msg">
                    {t.noUnimportantIdeas}
                  </div>
                ) : (
                  nonImportantIdeas.map((it) => (
                    <ParkingIdeaRow
                      key={it.id}
                      item={it}
                      t={t}
                      showUnimportantBtn={false}
                      onRateIdea={onRateParkingIdea}
                      onSyncSingleToDocs={onSyncSingleItemToDocs}
                      onDeleteEntry={onDeleteParkingEntry}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SAĞ KOLON: ÇALIŞMA HİKAYESİ & MEŞGULİYET / SEKME ANALİZİ */}
          <div className="dashboard-col">
            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  📸 {t.workStoryTitle} ({workStoryEntries.length})
                </span>
                <span style={{ fontSize: "9px", color: "#a1a1aa" }}>
                  {t.workStoryDesc}
                </span>
              </div>
              <WorkStoryGrid
                entries={workStoryEntries}
                emptyMessage={t.workStoryEmpty}
                emptyClassName="dashboard-empty-msg"
                onSelectEntry={onOpenLightbox}
              />
            </div>

            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  🎯 {t.contextStatsTitle} ({contextStats.length})
                </span>
              </div>
              <div className="dashboard-list">
                {contextStats.length === 0 ? (
                  <div className="dashboard-empty-msg">{t.noContextStats}</div>
                ) : (
                  contextStats.map((ctx) => (
                    <div key={ctx.contextText} className="dashboard-stat-row">
                      <div className="dashboard-stat-main">
                        <span style={{ fontWeight: 600 }}>
                          🎯 {ctx.contextText}
                        </span>
                        <span className="dashboard-stat-sub">
                          {ctx.lastWorkTag && `💼 ${ctx.lastWorkTag} `}
                          {ctx.topApp && `• 🌐 ${ctx.topApp}`}
                        </span>
                      </div>
                      <span className="dashboard-stat-badge">
                        {t.formatDuration(ctx.totalDurationSec)} • ⚡
                        {ctx.distractionCount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-section-card">
              <div className="dashboard-section-header">
                <span className="dashboard-card-title">
                  🌐 {t.appDistractionTitle} (
                  {appDistractions.reduce((acc, g) => acc + g.totalCount, 0)})
                </span>
              </div>
              <div className="dashboard-list">
                {appDistractions.length === 0 ? (
                  <div className="dashboard-empty-msg">
                    {t.noAppDistractions}
                  </div>
                ) : (
                  appDistractions.map((grp) => (
                    <div key={grp.appName} className="dashboard-stat-row">
                      <div className="dashboard-stat-main">
                        <span style={{ fontWeight: 600 }}>
                          🌐 {grp.appName}
                        </span>
                        {grp.details[0]?.windowTitle && (
                          <span className="dashboard-stat-sub">
                            {grp.details[0].windowTitle}
                          </span>
                        )}
                      </div>
                      <span className="dashboard-stat-badge">
                        {grp.totalCount}x
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
