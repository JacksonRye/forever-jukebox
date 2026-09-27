import React from "react";
import type { JukeboxAudioMode } from "@forever-jukebox/shared/audio/BufferedAudioPlayer";
import {
  resolveAudioModeFromUrl,
  resolveAudioIntensityFromUrl,
  writeAudioModeToUrl,
} from "@/app/routes/listen/audioMode";
import {
  resolveStoredBranchStatsEnabled,
  storeBranchStatsEnabled,
} from "@/app/routes/listen/preferences";

export type AppState = {
  file: File | null;
  setFile: (file: File | null) => void;
  isListenLoading: boolean;
  setIsListenLoading: (isLoading: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  audioMode: JukeboxAudioMode;
  setAudioMode: (mode: JukeboxAudioMode) => void;
  audioIntensity: number;
  setAudioIntensity: (intensity: number) => void;
  bringItHomeMode: boolean;
  setBringItHomeMode: (enabled: boolean) => void;
  branchStatsEnabled: boolean;
  setBranchStatsEnabled: (enabled: boolean) => void;
};

const AppStateContext = React.createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isListenLoading, setIsListenLoading] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [audioMode, setAudioModeState] = React.useState<JukeboxAudioMode>(() =>
    resolveAudioModeFromUrl()
  );
  const [audioIntensity, setAudioIntensityState] = React.useState<number>(() =>
    resolveAudioIntensityFromUrl()
  );
  const [bringItHomeMode, setBringItHomeMode] = React.useState<boolean>(false);
  const [branchStatsEnabled, setBranchStatsEnabledState] = React.useState<boolean>(() =>
    resolveStoredBranchStatsEnabled()
  );

  const setAudioMode = React.useCallback(
    (mode: JukeboxAudioMode) => {
      setAudioModeState(mode);
      writeAudioModeToUrl(mode, audioIntensity, true);
    },
    [audioIntensity]
  );

  const setAudioIntensity = React.useCallback(
    (intensity: number) => {
      setAudioIntensityState(intensity);
      writeAudioModeToUrl(audioMode, intensity, true);
    },
    [audioMode]
  );

  const setBranchStatsEnabled = React.useCallback((enabled: boolean) => {
    setBranchStatsEnabledState(enabled);
    storeBranchStatsEnabled(enabled);
  }, []);

  const value = React.useMemo<AppState>(
    () => ({
      file,
      setFile,
      isListenLoading,
      setIsListenLoading,
      isSettingsOpen,
      setIsSettingsOpen,
      audioMode,
      setAudioMode,
      audioIntensity,
      setAudioIntensity,
      bringItHomeMode,
      setBringItHomeMode,
      branchStatsEnabled,
      setBranchStatsEnabled,
    }),
    [
      file,
      isListenLoading,
      isSettingsOpen,
      audioMode,
      setAudioMode,
      audioIntensity,
      setAudioIntensity,
      bringItHomeMode,
      branchStatsEnabled,
      setBranchStatsEnabled,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateProvider missing");
  }
  return {
    file: ctx.file ?? null,
    setFile: ctx.setFile ?? (() => {}),
    isListenLoading: ctx.isListenLoading ?? false,
    setIsListenLoading: ctx.setIsListenLoading ?? (() => {}),
    isSettingsOpen: ctx.isSettingsOpen ?? false,
    setIsSettingsOpen: ctx.setIsSettingsOpen ?? (() => {}),
    audioMode: ctx.audioMode ?? "off",
    setAudioMode: ctx.setAudioMode ?? (() => {}),
    audioIntensity: ctx.audioIntensity ?? 100,
    setAudioIntensity: ctx.setAudioIntensity ?? (() => {}),
    bringItHomeMode: ctx.bringItHomeMode ?? false,
    setBringItHomeMode: ctx.setBringItHomeMode ?? (() => {}),
    branchStatsEnabled: ctx.branchStatsEnabled ?? false,
    setBranchStatsEnabled: ctx.setBranchStatsEnabled ?? (() => {}),
  };
}
