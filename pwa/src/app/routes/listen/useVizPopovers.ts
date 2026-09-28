import React from "react";
import type { PlayMode } from "./types";

// Volume, pan, and section loop popovers: mutually exclusive, closed by outside clicks.
export function useVizPopovers({ playMode }: { playMode: PlayMode }) {
  const [isVolumeOpen, setIsVolumeOpen] = React.useState(false);
  const [isPanOpen, setIsPanOpen] = React.useState(false);
  const [isLoopOpen, setIsLoopOpen] = React.useState(false);
  const volumeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const volumePanelRef = React.useRef<HTMLDivElement | null>(null);
  const panButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const panPanelRef = React.useRef<HTMLDivElement | null>(null);
  const loopButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const loopPanelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isVolumeOpen && !isPanOpen && !isLoopOpen) {
      return;
    }
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (volumePanelRef.current?.contains(target)) {
        return;
      }
      if (volumeButtonRef.current?.contains(target)) {
        return;
      }
      if (panPanelRef.current?.contains(target)) {
        return;
      }
      if (panButtonRef.current?.contains(target)) {
        return;
      }
      if (loopPanelRef.current?.contains(target)) {
        return;
      }
      if (loopButtonRef.current?.contains(target)) {
        return;
      }
      setIsVolumeOpen(false);
      setIsPanOpen(false);
      setIsLoopOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, [isVolumeOpen, isPanOpen, isLoopOpen]);

  React.useEffect(() => {
    if (playMode !== "autocanonizer") {
      setIsPanOpen(false);
    }
  }, [playMode]);

  const toggleVolume = () => {
    setIsPanOpen(false);
    setIsLoopOpen(false);
    setIsVolumeOpen((prev) => !prev);
  };

  const togglePan = () => {
    setIsVolumeOpen(false);
    setIsLoopOpen(false);
    setIsPanOpen((prev) => !prev);
  };

  const toggleLoop = () => {
    setIsVolumeOpen(false);
    setIsPanOpen(false);
    setIsLoopOpen((prev) => !prev);
  };

  return {
    isVolumeOpen,
    isPanOpen,
    isLoopOpen,
    toggleVolume,
    togglePan,
    toggleLoop,
    volumeButtonRef,
    volumePanelRef,
    panButtonRef,
    panPanelRef,
    loopButtonRef,
    loopPanelRef,
  };
}
