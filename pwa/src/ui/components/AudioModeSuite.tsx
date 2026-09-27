import React from "react";
import { useTranslation } from "react-i18next";
import type { JukeboxAudioMode } from "@forever-jukebox/shared/audio/BufferedAudioPlayer";
import {
  MAX_AUDIO_MODE_INTENSITY,
  MIN_AUDIO_MODE_INTENSITY,
  audioModeSupportsIntensity,
} from "@forever-jukebox/shared/audio/audioModes";
import {
  AUDIO_MODE_SECTIONS,
  audioModeLabel,
} from "@/app/routes/listen/audioMode";

interface AudioModeSuiteProps {
  selectedAudioMode: JukeboxAudioMode;
  onSelectMode: (mode: JukeboxAudioMode) => void;
  intensityPct: number;
  onIntensityChange: (intensity: number) => void;
  bringItHomeMode?: boolean;
  onToggleBringItHome?: (enabled: boolean) => void;
  branchStatsEnabled?: boolean;
  onToggleBranchStats?: (enabled: boolean) => void;
  compact?: boolean;
  onOpenCustomSamples?: () => void;
  customSampleCount?: number;
}

export function AudioModeSuite({
  selectedAudioMode,
  onSelectMode,
  intensityPct,
  onIntensityChange,
  bringItHomeMode = false,
  onToggleBringItHome,
  branchStatsEnabled = false,
  onToggleBranchStats,
  compact = false,
  onOpenCustomSamples,
  customSampleCount = 0,
}: AudioModeSuiteProps) {
  const { t } = useTranslation();
  const [lastIntensityMode, setLastIntensityMode] =
    React.useState<JukeboxAudioMode>("nightcore");

  React.useEffect(() => {
    if (audioModeSupportsIntensity(selectedAudioMode)) {
      setLastIntensityMode(selectedAudioMode);
    }
  }, [selectedAudioMode]);

  const showIntensity =
    audioModeSupportsIntensity(selectedAudioMode) ||
    (selectedAudioMode === "off" && intensityPct === 0);

  const handleModeClick = (mode: JukeboxAudioMode) => {
    if (mode === "off") {
      onSelectMode("off");
      onIntensityChange(0);
      return;
    }
    if (audioModeSupportsIntensity(mode)) {
      setLastIntensityMode(mode);
      if (intensityPct === 0) {
        onIntensityChange(100);
      }
    }
    onSelectMode(mode);
  };

  const handleSliderChange = (newVal: number) => {
    if (newVal === 0) {
      onSelectMode("off");
      onIntensityChange(0);
    } else {
      if (selectedAudioMode === "off") {
        onSelectMode(lastIntensityMode);
      }
      onIntensityChange(newVal);
    }
  };

  return (
    <div className={`gs-audio-suite ${compact ? "gs-audio-suite--compact" : ""}`}>
      <div className="gs-audio-suite__header">
        <div className="gs-section-eyebrow">
          <span className="gs-dot-live" />
          <span>AUDIO PROCESSING ENGINE</span>
        </div>
        <div className="gs-audio-suite__header-actions">
          {selectedAudioMode === "cowbell" && onOpenCustomSamples && (
            <button
              type="button"
              className="gs-btn-samples-header"
              onClick={onOpenCustomSamples}
              title="Add or manage custom voice samples"
            >
              <span>🎤 CUSTOM SAMPLES</span>
              <span className="gs-badge-sample-count">
                {customSampleCount}
              </span>
            </button>
          )}
          <div className="gs-audio-suite__active-badge">
            STATUS: <span className="gs-mono-white">
              {selectedAudioMode === "off"
                ? "OFF (PURE MASTER 0%)"
                : `${selectedAudioMode.toUpperCase().replace("_", " ")} (${intensityPct}%)`}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Mode: Standard Bit-Perfect Loop */}
      <div className="gs-audio-suite__row">
        <button
          type="button"
          className={`gs-mode-pill ${selectedAudioMode === "off" ? "active" : ""}`}
          onClick={() => handleModeClick("off")}
          title="Direct bit-perfect infinite looping without effect alterations (0% intensity)"
        >
          <span className="gs-mode-pill__indicator" />
          <span className="gs-mode-pill__label">OFF (PURE MASTER)</span>
        </button>
      </div>

      {/* Mode Categories */}
      {AUDIO_MODE_SECTIONS.map((section) => (
        <div key={section.titleKey} className="gs-audio-suite__group">
          <div className="gs-group-label">{t(section.titleKey)}</div>
          <div className="gs-mode-pills-grid">
            {section.options.map((option) => {
              const isActive = selectedAudioMode === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={`gs-mode-pill ${isActive ? "active" : ""}`}
                  onClick={() => handleModeClick(option)}
                  aria-pressed={isActive}
                >
                  <span className="gs-mode-pill__indicator" />
                  <span className="gs-mode-pill__label">{audioModeLabel(option, t)}</span>
                  {option === "cowbell" && isActive && onOpenCustomSamples && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="gs-mode-pill__action-badge"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCustomSamples();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onOpenCustomSamples();
                        }
                      }}
                      title="Manage custom voice samples"
                    >
                      🎤 {customSampleCount > 0 ? customSampleCount : "+"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Intensity Hairline Slider for intensity-compatible modes */}
      {showIntensity && (
        <div className="gs-intensity-container">
          <div className="gs-intensity-header">
            <span className="gs-intensity-label">
              {selectedAudioMode === "off" ? "MASTER INTENSITY (OFF)" : t("audioModes.intensity")}
            </span>
            <span className="gs-intensity-val">{intensityPct}%</span>
          </div>
          <input
            type="range"
            min={MIN_AUDIO_MODE_INTENSITY}
            max={MAX_AUDIO_MODE_INTENSITY}
            step={5}
            value={intensityPct}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="gs-hairline-slider"
            aria-label={t("audioModes.intensity")}
          />
        </div>
      )}

      {/* Secondary Precision Toggles: Bring It Home & Branch Stats */}
      {(onToggleBringItHome || onToggleBranchStats) && (
        <div className="gs-audio-suite__toggles">
          {onToggleBringItHome && (
            <button
              type="button"
              className={`gs-toggle-pill ${bringItHomeMode ? "active" : ""}`}
              onClick={() => onToggleBringItHome(!bringItHomeMode)}
              title="Steers the playback towards the outro instead of looping indefinitely"
            >
              <span className={`gs-toggle-switch ${bringItHomeMode ? "on" : ""}`}>
                <span className="gs-toggle-switch__thumb" />
              </span>
              <span className="gs-toggle-label">{t("tuning.bringItHome")}</span>
            </button>
          )}

          {onToggleBranchStats && (
            <button
              type="button"
              className={`gs-toggle-pill ${branchStatsEnabled ? "active" : ""}`}
              onClick={() => onToggleBranchStats(!branchStatsEnabled)}
              title="Shows detailed probabilistic branch information"
            >
              <span className={`gs-toggle-switch ${branchStatsEnabled ? "on" : ""}`}>
                <span className="gs-toggle-switch__thumb" />
              </span>
              <span className="gs-toggle-label">{t("tuning.showBranchStats")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
