import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CachedAnalysisTrack,
  deleteCachedAnalysis,
  getCachedAudio,
  listCachedAnalysisTracks,
  setCachedAudio,
} from "@/core/infrastructure/cache/analysisCache";
import { formatDuration } from "@/shared/utils/format";
import { AUDIO_FILE_ACCEPT, DropZone } from "@/ui/components/DropZone";
import { SymbolIcon } from "@/ui/components/SymbolIcon";
import { CompassMotif } from "@/ui/components/CompassMotif";
import { AudioModeSuite } from "@/ui/components/AudioModeSuite";
import {
  SpotifyPlaylistEntity,
  SpotifyTrackItem,
  clearSavedSpotifyPlaylist,
  fetchSpotifyTrackAudio,
  getSavedSpotifyPlaylist,
  resolveSpotifyLink,
  setSavedSpotifyPlaylist,
} from "@/core/infrastructure/cache/spotifyStore";
import { useAppState } from "../state/AppState";
import { useTranslation } from "react-i18next";

export function Home() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    setFile,
    audioMode,
    setAudioMode,
    audioIntensity,
    setAudioIntensity,
    bringItHomeMode,
    setBringItHomeMode,
    branchStatsEnabled,
    setBranchStatsEnabled,
  } = useAppState();

  const [cachedTracks, setCachedTracks] = useState<CachedAnalysisTrack[]>([]);
  const [isLoadingCachedTracks, setIsLoadingCachedTracks] = useState(false);
  const [deletingFingerprint, setDeletingFingerprint] = useState<string | null>(null);
  const [cachedTrackError, setCachedTrackError] = useState<string | null>(null);

  const [spotifyUrlInput, setSpotifyUrlInput] = useState("");
  const [isResolvingSpotify, setIsResolvingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [loadedPlaylist, setLoadedPlaylist] = useState<SpotifyPlaylistEntity | null>(() => getSavedSpotifyPlaylist());
  const [processingTrackId, setProcessingTrackId] = useState<string | null>(null);

  const handleLoadSpotify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const input = spotifyUrlInput.trim();
    if (!input) return;
    setIsResolvingSpotify(true);
    setSpotifyError(null);
    try {
      const entity = await resolveSpotifyLink(input);
      setLoadedPlaylist(entity);
      setSavedSpotifyPlaylist(entity);
      setSpotifyUrlInput("");
    } catch (err: any) {
      setSpotifyError(err?.message || "Failed to resolve Spotify link");
    } finally {
      setIsResolvingSpotify(false);
    }
  };

  const handleClearPlaylist = () => {
    setLoadedPlaylist(null);
    clearSavedSpotifyPlaylist();
    setSpotifyError(null);
  };

  const handleProcessSpotifyTrack = async (track: SpotifyTrackItem) => {
    setProcessingTrackId(track.id);
    setSpotifyError(null);
    try {
      const file = await fetchSpotifyTrackAudio(track);
      handleFile(file);
    } catch (err: any) {
      setSpotifyError(err?.message || `Failed to prepare audio for "${track.title}"`);
      setProcessingTrackId(null);
    }
  };

  const handleFile = (file: File) => {
    setFile(file);
    navigate("/listen");
  };

  const handlePlayCachedTrack = async (track: CachedAnalysisTrack) => {
    try {
      const cachedFile = await getCachedAudio(track.fingerprint);
      if (cachedFile) {
        handleFile(cachedFile);
        return;
      }
    } catch (err) {
      console.warn("Cached audio lookup failed:", err);
    }

    try {
      const query = new URLSearchParams({
        name: track.title || track.artist || "",
        fingerprint: track.fingerprint,
      });
      const res = await fetch(`/api/local-audio?${query.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const filenameHeader = res.headers.get("X-Filename");
        const filename = filenameHeader
          ? decodeURIComponent(filenameHeader)
          : (track.title ? `${track.title}.mp3` : "track.mp3");
        const file = new File([blob], filename, {
          type: blob.type || "audio/mpeg",
        });
        await setCachedAudio(track.fingerprint, file);
        handleFile(file);
        return;
      }
    } catch (err) {
      console.warn("Local audio fetch failed:", err);
    }

    cachedFileInputRef.current?.click();
  };

  const refreshCachedTracks = useCallback(async () => {
    setIsLoadingCachedTracks(true);
    setCachedTrackError(null);
    try {
      const tracks = await listCachedAnalysisTracks();
      setCachedTracks(tracks);
    } catch {
      setCachedTrackError(t("home.loadFailed"));
      setCachedTracks([]);
    } finally {
      setIsLoadingCachedTracks(false);
    }
  }, [t]);

  useEffect(() => {
    if (location.pathname !== "/") {
      return;
    }
    refreshCachedTracks().catch((err) => {
      console.warn(`Failed to refresh cached tracks: ${String(err)}`);
    });
  }, [location.pathname, refreshCachedTracks]);

  const onDeleteCachedTrack = useCallback(async (fingerprint: string) => {
    setDeletingFingerprint(fingerprint);
    setCachedTrackError(null);
    try {
      await deleteCachedAnalysis(fingerprint);
      setCachedTracks((prev) => prev.filter((track) => track.fingerprint !== fingerprint));
    } catch {
      setCachedTrackError(t("home.deleteFailed"));
    } finally {
      setDeletingFingerprint((current) => (current === fingerprint ? null : current));
    }
  }, [t]);

  const handleDeleteCachedTrack = useCallback(
    (fingerprint: string) => {
      onDeleteCachedTrack(fingerprint).catch((err) => {
        console.warn(`Failed to delete cached analysis: ${String(err)}`);
      });
    },
    [onDeleteCachedTrack],
  );

  const cachedFileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="gs-dual-chamber">
      {/* Left Chamber: Swiss Atmospheric Brand Sanctuary */}
      <section className="gs-chamber-left">
        <div className="gs-brand-block">
          <span className="gs-brand-mark">FOREVER JUKEBOX®</span>
          <span className="gs-brand-tagline">
            SWISS HIGH-HOROLOGY AUDIO ENGINE
          </span>
        </div>

        <div className="gs-compass-chamber">
          <CompassMotif size={280} />
          <div className="gs-compass-caption">
            <span className="gs-coord-tag">COORDINATES: 47.3769° N, 8.5417° E</span>
            <span className="gs-precision-tag">BEAT SYNCHRONIZATION: 100% BIT-PERFECT</span>
          </div>
        </div>

        <div className="gs-chamber-footer">
          <div className="gs-provenance">
            © FOREVER JUKEBOX · IN-BROWSER WASM DSP · ZERO EXTERNAL API DEPENDENCIES
          </div>
        </div>
      </section>

      {/* Right Chamber: Elevated Interaction & Controls */}
      <section className="gs-chamber-right">
        <div className="panel home-panel gs-card-surface">
          {/* Quick Audio Mode Switcher: 1-Click Access directly on Home Screen */}
          <AudioModeSuite
            selectedAudioMode={audioMode}
            onSelectMode={setAudioMode}
            intensityPct={audioIntensity}
            onIntensityChange={setAudioIntensity}
            bringItHomeMode={bringItHomeMode}
            onToggleBringItHome={setBringItHomeMode}
            branchStatsEnabled={branchStatsEnabled}
            onToggleBranchStats={setBranchStatsEnabled}
          />

          <div className="gs-separator-hairline" />

          {/* Audio Input / Drop Zone */}
          <div className="gs-dropzone-wrapper">
            <div className="gs-section-eyebrow">
              <span className="gs-dot-live" />
              <span>AUDIO INPUT SOURCE</span>
            </div>
            <DropZone onFile={handleFile} />
            <div className="gs-format-badges">
              <span>SUPPORTED FORMATS:</span>
              <span className="gs-badge">MP3</span>
              <span className="gs-badge">WAV</span>
              <span className="gs-badge">FLAC</span>
              <span className="gs-badge">AAC</span>
              <span className="gs-badge">OGG</span>
            </div>
          </div>

          <div className="gs-separator-hairline" />

          {/* Spotify Music Link / Playlist Input */}
          <div className="gs-spotify-section">
            <div className="gs-section-eyebrow">
              <span className="gs-dot-live" />
              <span>SPOTIFY TRACK & PLAYLIST IMPORT</span>
            </div>

            <form className="gs-spotify-bar" onSubmit={handleLoadSpotify}>
              <div className="gs-spotify-input-wrap">
                <span className="gs-spotify-icon-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.625.625 0 01-.861.206c-2.358-1.441-5.326-1.767-8.823-.968a.626.626 0 11-.277-1.221c3.824-.874 7.108-.5 9.755 1.122a.625.625 0 01.206.861zm1.225-2.723a.782.782 0 01-1.077.257c-2.699-1.659-6.814-2.14-10.007-1.171a.782.782 0 11-.453-1.497c3.65-1.107 8.196-.573 11.28 1.334a.782.782 0 01.257 1.077zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.938.938 0 11-.545-1.794c3.541-1.074 9.42-.871 13.208 1.378a.938.938 0 01-1.044 1.572z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  className="gs-spotify-input"
                  placeholder="PASTE SPOTIFY TRACK OR PLAYLIST LINK..."
                  value={spotifyUrlInput}
                  onChange={(e) => setSpotifyUrlInput(e.target.value)}
                  disabled={isResolvingSpotify}
                />
              </div>
              <button
                type="submit"
                className="gs-spotify-submit-btn"
                disabled={isResolvingSpotify || !spotifyUrlInput.trim()}
              >
                {isResolvingSpotify ? "LOADING..." : "LOAD SONGS"}
              </button>
            </form>

            {spotifyError && (
              <p className="gs-error-hint">{spotifyError}</p>
            )}

            {/* Loaded Playlist / Tracks Queue */}
            {loadedPlaylist && (
              <div className="gs-spotify-playlist-card">
                <div className="gs-spotify-playlist-header">
                  <div className="gs-spotify-playlist-info">
                    {loadedPlaylist.coverUrl ? (
                      <img
                        src={loadedPlaylist.coverUrl}
                        alt={loadedPlaylist.title}
                        className="gs-spotify-cover"
                      />
                    ) : (
                      <div className="gs-spotify-cover-placeholder">♫</div>
                    )}
                    <div className="gs-spotify-playlist-titles">
                      <span className="gs-spotify-playlist-title" title={loadedPlaylist.title}>
                        {loadedPlaylist.title}
                      </span>
                      <span className="gs-spotify-playlist-sub">
                        {loadedPlaylist.subtitle} · {loadedPlaylist.trackCount} {loadedPlaylist.trackCount === 1 ? "TRACK" : "TRACKS"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gs-spotify-clear-btn"
                    onClick={handleClearPlaylist}
                    title="Clear loaded playlist"
                  >
                    CLEAR
                  </button>
                </div>

                <ul className="gs-spotify-track-list">
                  {loadedPlaylist.tracks.map((track, idx) => {
                    const isProcessing = processingTrackId === track.id;
                    const durationSec = Math.round(track.durationMs / 1000);
                    const durationFormatted = durationSec > 0 ? formatDuration(durationSec) : "";
                    const isCached = cachedTracks.some(c =>
                      c.fingerprint === `spotify-${track.id}` ||
                      (c.title && c.title.toLowerCase() === track.title.toLowerCase())
                    );

                    return (
                      <li key={track.id || idx} className="gs-spotify-track-item">
                        <div className="gs-spotify-track-left">
                          <span className="gs-spotify-track-idx">{(idx + 1).toString().padStart(2, "0")}</span>
                          <div className="gs-spotify-track-meta">
                            <span className="gs-spotify-track-name" title={track.title}>
                              {track.title}
                            </span>
                            <span className="gs-spotify-track-artist" title={track.artist}>
                              {track.artist}
                            </span>
                          </div>
                        </div>

                        <div className="gs-spotify-track-right">
                          {durationFormatted && (
                            <span className="gs-spotify-track-dur">{durationFormatted}</span>
                          )}
                          <button
                            type="button"
                            className={`gs-process-btn ${isCached ? "is-cached" : ""}`}
                            onClick={() => handleProcessSpotifyTrack(track)}
                            disabled={isProcessing}
                            title={isCached ? "Play cached infinite track" : "Process track into Infinite Jukebox"}
                          >
                            {isProcessing ? "PROCESSING..." : isCached ? "PLAY" : "PROCESS"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="gs-separator-hairline" />

          {/* Cached Tracks Section */}
          <div className="cached-tracks">
            <h2 className="cached-tracks__title">
              <span>{t("home.cachedAnalysis")}</span>
              <span className="cached-tracks__title-hint">
                {t("home.cachedHint")}
              </span>
            </h2>
            {isLoadingCachedTracks ? <p className="gs-subtle-hint">{t("home.loadingCached")}</p> : null}
            {!isLoadingCachedTracks && cachedTrackError ? (
              <p className="gs-error-hint">{cachedTrackError}</p>
            ) : null}
            {!isLoadingCachedTracks && !cachedTrackError && cachedTracks.length === 0 ? (
              <p className="gs-empty-hint">{t("home.noCached")}</p>
            ) : null}
            {!isLoadingCachedTracks && !cachedTrackError && cachedTracks.length > 0 ? (
              <ul className="cached-tracks__list">
                {cachedTracks.map((track) => {
                  const title =
                    track.title ??
                    t("home.cachedTrack", {
                      id: track.fingerprint.slice(0, 8),
                    });
                  const label = track.artist
                    ? `${title} — ${track.artist}`
                    : title;
                  const details = track.durationSeconds
                    ? formatDuration(Math.round(track.durationSeconds))
                    : null;
                  const isDeleting = deletingFingerprint === track.fingerprint;

                  return (
                    <li key={track.fingerprint} className="cached-tracks__item">
                      <div
                        className="cached-tracks__content"
                        style={{ cursor: "pointer" }}
                        onClick={() => handlePlayCachedTrack(track)}
                        title="Play this track instantly"
                      >
                        <div className="gs-track-ident">
                          <span className="gs-track-icon">▶</span>
                          <span className="cached-tracks__name" title={label}>
                            {label}
                          </span>
                        </div>
                        {details ? (
                          <span className="cached-tracks__meta">{details}</span>
                        ) : null}
                      </div>
                      <div className="gs-cached-actions">
                        <button
                          type="button"
                          className="gs-play-cta-btn"
                          onClick={() => handlePlayCachedTrack(track)}
                          title="Play this track"
                        >
                          PLAY
                        </button>
                        <button
                          className="cached-tracks__delete"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCachedTrack(track.fingerprint);
                          }}
                          disabled={isDeleting}
                          aria-label={t("home.deleteNamed", { label })}
                          title={t("home.deleteTitle")}
                        >
                          <SymbolIcon className="cached-tracks__delete-icon" name="close" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <input
            ref={cachedFileInputRef}
            type="file"
            accept={AUDIO_FILE_ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
        </div>
      </section>
    </div>
  );
}
