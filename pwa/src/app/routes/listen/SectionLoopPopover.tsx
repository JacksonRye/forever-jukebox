import React from "react";
import { useTranslation } from "react-i18next";
import { SymbolIcon } from "@/ui/components/SymbolIcon";
import type { LoopRange, TrackSectionSpan } from "@forever-jukebox/shared";

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SectionLoopPopover({
  isOpen,
  panelRef,
  buttonRef,
  sections,
  activeLoopRange,
  totalBeats,
  onSelectLoopRange,
  onToggle,
}: {
  isOpen: boolean;
  panelRef: React.RefObject<HTMLDivElement>;
  buttonRef: React.RefObject<HTMLButtonElement>;
  sections: TrackSectionSpan[];
  activeLoopRange: LoopRange | null;
  totalBeats: number;
  onSelectLoopRange: (range: LoopRange | null) => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const [showCustom, setShowCustom] = React.useState(false);
  const [customStart, setCustomStart] = React.useState<number>(0);
  const [customEnd, setCustomEnd] = React.useState<number>(
    Math.max(0, totalBeats - 1),
  );

  React.useEffect(() => {
    if (activeLoopRange) {
      setCustomStart(activeLoopRange.startBeatIndex);
      setCustomEnd(activeLoopRange.endBeatIndex);
    } else {
      setCustomStart(0);
      setCustomEnd(Math.max(0, totalBeats - 1));
    }
  }, [activeLoopRange, totalBeats]);

  const isSectionActive = (sec: TrackSectionSpan) => {
    if (!activeLoopRange) return false;
    return (
      activeLoopRange.startBeatIndex === sec.startBeatIndex &&
      activeLoopRange.endBeatIndex === sec.endBeatIndex
    );
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const maxIdx = Math.max(0, totalBeats - 1);
    const start = Math.max(0, Math.min(Number(customStart), maxIdx));
    const end = Math.max(start, Math.min(Number(customEnd), maxIdx));
    onSelectLoopRange({ startBeatIndex: start, endBeatIndex: end });
  };

  const isLoopActive = activeLoopRange !== null;

  const currentSectionName = React.useMemo(() => {
    if (!activeLoopRange) return null;
    const match = sections.find(
      (s) =>
        s.startBeatIndex === activeLoopRange.startBeatIndex &&
        s.endBeatIndex === activeLoopRange.endBeatIndex,
    );
    if (match) {
      return `Section ${match.index + 1}`;
    }
    return `Beats ${activeLoopRange.startBeatIndex}–${activeLoopRange.endBeatIndex}`;
  }, [activeLoopRange, sections]);

  return (
    <div className="section-loop-control-wrap">
      <div
        className={`section-loop-panel ${isOpen ? "" : "is-hidden"}`}
        ref={panelRef}
        role="dialog"
        aria-label={t("listen.loopSection", "Loop Section")}
      >
        <div className="section-loop-header">
          <div className="section-loop-title">
            <SymbolIcon className="section-loop-header-icon" name="repeat" />
            <span>{t("listen.loopSection", "Loop Section")}</span>
          </div>
          {isLoopActive ? (
            <button
              type="button"
              className="section-loop-clear-btn"
              onClick={() => onSelectLoopRange(null)}
              title={t("listen.clearLoop", "Turn off looping")}
            >
              {t("listen.turnOff", "Off")}
            </button>
          ) : null}
        </div>

        <div className="section-loop-list">
          <button
            type="button"
            className={`section-loop-item ${!isLoopActive ? "is-selected" : ""}`}
            onClick={() => onSelectLoopRange(null)}
          >
            <span className="section-loop-item-name">
              {t("listen.wholeSong", "Whole Song")}
            </span>
            <span className="section-loop-item-detail">
              {!isLoopActive ? (
                <SymbolIcon className="item-check-icon" name="check" />
              ) : (
                t("listen.loopOff", "Off")
              )}
            </span>
          </button>

          {sections.map((sec) => {
            const active = isSectionActive(sec);
            return (
              <button
                key={sec.index}
                type="button"
                className={`section-loop-item ${active ? "is-selected" : ""}`}
                onClick={() =>
                  onSelectLoopRange({
                    startBeatIndex: sec.startBeatIndex,
                    endBeatIndex: sec.endBeatIndex,
                  })
                }
              >
                <div className="section-loop-item-col">
                  <span className="section-loop-item-name">
                    {t("listen.section", "Section")} {sec.index + 1}
                  </span>
                  <span className="section-loop-item-time">
                    {formatSeconds(sec.startTime)} – {formatSeconds(sec.endTime)}
                  </span>
                </div>
                <div className="section-loop-item-col end">
                  <span className="section-loop-item-beats">
                    {sec.beatCount} {t("listen.beats", "beats")}
                  </span>
                  {active ? (
                    <SymbolIcon className="item-check-icon" name="check" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="section-loop-custom-footer">
          <button
            type="button"
            className="section-loop-custom-toggle"
            onClick={() => setShowCustom((prev) => !prev)}
          >
            <span>{t("listen.customRange", "Custom Range")}</span>
            <SymbolIcon
              className={`dropdown-chevron ${showCustom ? "is-open" : ""}`}
              name="expand_more"
            />
          </button>

          {showCustom ? (
            <form
              className="section-loop-custom-form"
              onSubmit={handleApplyCustom}
            >
              <div className="custom-range-inputs">
                <label className="custom-range-label">
                  <span>Start</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, totalBeats - 1)}
                    value={customStart}
                    onChange={(e) => setCustomStart(Number(e.target.value))}
                    className="custom-range-input"
                  />
                </label>
                <span className="custom-range-sep">–</span>
                <label className="custom-range-label">
                  <span>End</span>
                  <input
                    type="number"
                    min={customStart}
                    max={Math.max(0, totalBeats - 1)}
                    value={customEnd}
                    onChange={(e) => setCustomEnd(Number(e.target.value))}
                    className="custom-range-input"
                  />
                </label>
              </div>
              <button type="submit" className="custom-range-apply-btn">
                {t("listen.apply", "Apply")}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <button
        id="section-loop-button"
        className={`section-loop-button ${isLoopActive ? "is-active" : ""}`}
        type="button"
        ref={buttonRef}
        onClick={onToggle}
        title={
          isLoopActive
            ? `Looping ${currentSectionName}`
            : t("listen.loopSection", "Loop Section")
        }
        aria-label={
          isLoopActive
            ? `Looping ${currentSectionName}`
            : t("listen.loopSection", "Loop Section")
        }
        aria-expanded={isOpen}
      >
        <SymbolIcon
          className="loop-icon"
          name={isLoopActive ? "repeat_one" : "repeat"}
        />
        {isLoopActive && currentSectionName ? (
          <span className="section-loop-badge">
            {currentSectionName.replace("Section ", "S")}
          </span>
        ) : null}
      </button>
    </div>
  );
}
