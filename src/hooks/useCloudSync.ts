import { useEffect, useRef, useState } from "react";
import type React from "react";
import {
  CloudAuthState,
  DEFAULT_CLOUD_AUTH,
  ParkingLotData,
  WorkStoryEntry,
  getBreakParkingLotData,
  getParkingLotData,
  getPendingSyncCount,
  getWorkStoryEntries,
  loadCloudAuthState,
  saveCloudAuthState,
} from "../db";
import {
  signInWithGoogleAccount,
  signOutGoogleAccount,
  syncWithCloudServer,
} from "../cloudSync";

export interface UseCloudSyncOptions {
  loaded: boolean;
  syncRunningLabel: string;
  freqOnlyTodayRef: React.MutableRefObject<boolean>;
  onSyncedRefresh?: (
    summaryParking: ParkingLotData,
    breakParking: ParkingLotData,
    workStory: WorkStoryEntry[],
  ) => void;
}

export function useCloudSync({
  loaded,
  syncRunningLabel,
  freqOnlyTodayRef,
  onSyncedRefresh,
}: UseCloudSyncOptions) {
  const [cloudAuth, setCloudAuth] =
    useState<CloudAuthState>(DEFAULT_CLOUD_AUTH);
  const [cloudEmailInput, setCloudEmailInput] = useState<string>("");
  const [cloudNameInput, setCloudNameInput] = useState<string>("");
  const [cloudTokenInput, setCloudTokenInput] = useState<string>("");
  const [cloudServerInput, setCloudServerInput] = useState<string>(
    DEFAULT_CLOUD_AUTH.serverUrl,
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const syncInFlightRef = useRef<boolean>(false);

  const hydrateCloudSync = async () => {
    const [loadedAuth, pendingCnt] = await Promise.all([
      loadCloudAuthState(),
      getPendingSyncCount(),
    ]);
    setCloudAuth(loadedAuth);
    setCloudEmailInput(loadedAuth.email || "");
    setCloudNameInput(loadedAuth.name || "");
    setCloudTokenInput(loadedAuth.accessToken || "");
    setCloudServerInput(loadedAuth.serverUrl || DEFAULT_CLOUD_AUTH.serverUrl);
    setPendingSyncCount(pendingCnt);
  };

  const refreshPendingSyncCount = async () => {
    setPendingSyncCount(await getPendingSyncCount());
  };

  const triggerBackgroundCloudSync = async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const cnt = await getPendingSyncCount();
      setPendingSyncCount(cnt);
      const auth = await loadCloudAuthState();
      if (!auth.email) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        return;
      }
      const res = await syncWithCloudServer();
      setPendingSyncCount(res.pendingCount);
      if (res.ok) {
        setCloudAuth(await loadCloudAuthState());
      }
    } catch {
      // Ignore offline transient failures
    } finally {
      syncInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!loaded) return;
    const onOnline = () => {
      setIsOnline(true);
      void triggerBackgroundCloudSync();
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void triggerBackgroundCloudSync();
    const syncTimer = setInterval(() => {
      void triggerBackgroundCloudSync();
    }, 45_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(syncTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const handleGoogleSignIn = async () => {
    if (!cloudEmailInput.trim()) return;
    const res = await signInWithGoogleAccount({
      email: cloudEmailInput.trim(),
      name: cloudNameInput.trim() || undefined,
      accessToken: cloudTokenInput.trim() || undefined,
      serverUrl: cloudServerInput.trim() || undefined,
    });
    setCloudAuth(res.auth);
    setSyncStatusMsg(res.message);
    await triggerBackgroundCloudSync();
    setTimeout(() => setSyncStatusMsg(null), 2500);
  };

  const handleGoogleSignOut = async () => {
    const auth = await signOutGoogleAccount();
    setCloudAuth(auth);
    setCloudEmailInput("");
    setCloudNameInput("");
    setCloudTokenInput("");
    setSyncStatusMsg(null);
  };

  const handleSaveCloudToken = async () => {
    const nextAuth = { ...cloudAuth, accessToken: cloudTokenInput.trim() };
    await saveCloudAuthState(nextAuth);
    setCloudAuth(nextAuth);
    setSyncStatusMsg("Google Token kaydedildi!");
    setTimeout(() => setSyncStatusMsg(null), 3000);
  };

  const handleManualCloudSync = async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setIsSyncingCloud(true);
    setSyncStatusMsg(syncRunningLabel);
    try {
      const res = await syncWithCloudServer();
      setPendingSyncCount(res.pendingCount);
      setSyncStatusMsg(res.message);
      setCloudAuth(await loadCloudAuthState());
      const [pData, bData, wStory] = await Promise.all([
        getParkingLotData(freqOnlyTodayRef.current),
        getBreakParkingLotData(),
        getWorkStoryEntries(freqOnlyTodayRef.current, 80),
      ]);
      onSyncedRefresh?.(pData, bData, wStory);
    } catch (err) {
      setSyncStatusMsg(String(err));
    } finally {
      syncInFlightRef.current = false;
      setIsSyncingCloud(false);
      setTimeout(() => setSyncStatusMsg(null), 3500);
    }
  };

  return {
    cloudAuth,
    cloudEmailInput,
    setCloudEmailInput,
    cloudNameInput,
    setCloudNameInput,
    cloudTokenInput,
    setCloudTokenInput,
    cloudServerInput,
    setCloudServerInput,
    pendingSyncCount,
    isOnline,
    syncStatusMsg,
    isSyncingCloud,
    hydrateCloudSync,
    refreshPendingSyncCount,
    triggerBackgroundCloudSync,
    handleGoogleSignIn,
    handleGoogleSignOut,
    handleSaveCloudToken,
    handleManualCloudSync,
  };
}
