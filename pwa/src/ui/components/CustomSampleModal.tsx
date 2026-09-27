import React from "react";
import { useTranslation } from "react-i18next";
import type { CowbellOverlayService, CustomVoiceSample } from "@forever-jukebox/shared/audio/CowbellOverlayService";
import { AUDIO_FILE_ACCEPT } from "./DropZone";
import { SymbolIcon } from "./SymbolIcon";
import {
  deleteStoredCustomSample,
  getStoredCustomSamples,
  saveStoredCustomSample,
} from "@/core/infrastructure/cache/customSampleStore";

interface CustomSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioContext: AudioContext | null;
  cowbellOverlay: CowbellOverlayService | null;
  onSamplesChange?: () => void;
}

export function CustomSampleModal({
  isOpen,
  onClose,
  audioContext,
  cowbellOverlay,
  onSamplesChange,
}: CustomSampleModalProps) {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [samples, setSamples] = React.useState<
    Array<{ id: string; name: string; duration: number }>
  >([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);

  const refreshSamples = React.useCallback(async () => {
    try {
      const stored = await getStoredCustomSamples();
      setSamples(
        stored.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration ?? 0,
        })),
      );
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      void refreshSamples();
    }
  }, [isOpen, refreshSamples]);

  if (!isOpen) {
    return null;
  }

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || !audioContext) {
      return;
    }
    setIsProcessing(true);
    setFeedback(null);
    let addedCount = 0;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(
          arrayBuffer.slice(0),
        );
        const id = `custom-sample-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const name = file.name.replace(/\.[^/.]+$/, "");
        const sampleEntry: CustomVoiceSample = {
          id,
          name,
          buffer: decoded,
        };

        // Add to live service immediately in real-time
        cowbellOverlay?.addCustomSample(sampleEntry);

        // Persist to IndexedDB
        await saveStoredCustomSample({
          id,
          name,
          data: arrayBuffer,
          createdAt: Date.now(),
          duration: decoded.duration,
        });

        addedCount += 1;
      } catch (err) {
        console.warn(`Failed to decode sample ${file.name}:`, err);
      }
    }

    setIsProcessing(false);
    if (addedCount > 0) {
      setFeedback(`Added ${addedCount} sample${addedCount > 1 ? "s" : ""} to live playback!`);
      void refreshSamples();
      onSamplesChange?.();
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    cowbellOverlay?.removeCustomSample(id);
    await deleteStoredCustomSample(id);
    void refreshSamples();
    onSamplesChange?.();
    setFeedback(`Removed "${name}"`);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handlePreview = (id: string) => {
    if (!cowbellOverlay) return;
    setPreviewingId(id);
    cowbellOverlay.previewSample(id);
    setTimeout(() => setPreviewingId(null), 1200);
  };

  const handleTriggerNow = () => {
    if (!cowbellOverlay) return;
    const played = cowbellOverlay.triggerVoiceSample();
    if (played) {
      setFeedback("Triggered voice sample in live mix!");
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-samples-title"
      onClick={onClose}
    >
      <div
        className="modal-panel gs-sample-modal-panel"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="modal-header">
          <div className="modal-header-main">
            <h2 id="custom-samples-title" className="gs-modal-title">
              <span className="gs-dot-live" />
              <span>CUSTOM VOICE & REMIX SAMPLES</span>
            </h2>
            <p className="gs-modal-subtitle">
              Add your own vocal drops, shoutouts, or sound effects. They are added to More Cowbell mode in real time!
            </p>
          </div>
          <div className="modal-header-actions">
            <button
              className="modal-close"
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <SymbolIcon className="modal-close-icon" name="close" />
            </button>
          </div>
        </div>

        <div className="modal-body gs-sample-modal-body">
          {feedback && <div className="gs-sample-feedback">{feedback}</div>}

          {/* Upload / Drag & Drop Target */}
          <div
            className={`gs-sample-dropzone ${isDragging ? "is-dragover" : ""} ${isProcessing ? "is-processing" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={AUDIO_FILE_ACCEPT}
              multiple
              style={{ display: "none" }}
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <svg
              className="gs-dropzone-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="gs-dropzone-text">
              <strong>{isProcessing ? "Decoding audio..." : "Click or Drop Audio Files Here"}</strong>
              <span>MP3, WAV, OGG, M4A, AAC, FLAC (Multiple files supported)</span>
            </div>
          </div>

          {/* User's Custom Samples */}
          <div className="gs-sample-section">
            <div className="gs-sample-section-header">
              <span>YOUR CUSTOM SAMPLES ({samples.length})</span>
              {samples.length > 0 && (
                <button
                  type="button"
                  className="gs-btn-trigger-mix"
                  onClick={handleTriggerNow}
                  title="Fire a sample right now over the music"
                >
                  <SymbolIcon name="play_arrow" />
                  <span>TEST SAMPLE IN MIX</span>
                </button>
              )}
            </div>

            {samples.length === 0 ? (
              <div className="gs-sample-empty">
                No custom samples yet. Drop an audio file above to hear your own voices during transitions!
              </div>
            ) : (
              <ul className="gs-sample-list">
                {samples.map((sample) => (
                  <li key={sample.id} className="gs-sample-item">
                    <div className="gs-sample-item-info">
                      <span className="gs-sample-name">{sample.name}</span>
                      {sample.duration > 0 && (
                        <span className="gs-sample-duration">
                          {sample.duration.toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <div className="gs-sample-item-actions">
                      <button
                        type="button"
                        className={`gs-btn-icon ${previewingId === sample.id ? "active" : ""}`}
                        onClick={() => handlePreview(sample.id)}
                        title="Audition sample"
                        aria-label={`Preview ${sample.name}`}
                      >
                        <SymbolIcon name="play_arrow" />
                      </button>
                      <button
                        type="button"
                        className="gs-btn-icon gs-btn-icon--danger"
                        onClick={() => void handleDelete(sample.id, sample.name)}
                        title="Delete sample"
                        aria-label={`Delete ${sample.name}`}
                      >
                        <SymbolIcon name="close" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Built-in Walken Pack Status */}
          <div className="gs-sample-pack-card">
            <div className="gs-sample-pack-left">
              <span className="gs-badge-gold">BUILT-IN</span>
              <div>
                <div className="gs-pack-title">Christopher Walken SNL Voice Pack</div>
                <div className="gs-pack-desc">
                  "I got a fever...", "More cowbell, baby!" quotes play alongside your custom samples.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="gs-btn-trigger-mix"
              onClick={handleTriggerNow}
              title="Audition random quote"
            >
              <SymbolIcon name="play_arrow" />
              <span>TEST NOW</span>
            </button>
          </div>
        </div>

        <div className="modal-footer gs-sample-modal-footer">
          <button
            type="button"
            className="tab-btn is-active"
            onClick={onClose}
          >
            <span>DONE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
