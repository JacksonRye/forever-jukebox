import { setCachedAudio, getCachedAudio } from "./analysisCache";

export interface SpotifyTrackItem {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  previewUrl: string | null;
  uri: string;
  coverUrl?: string | null;
}

export interface SpotifyPlaylistEntity {
  type: "track" | "playlist" | "album";
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string | null;
  trackCount: number;
  tracks: SpotifyTrackItem[];
}

const SPOTIFY_PLAYLIST_STORAGE_KEY = "fj-spotify-loaded-playlist";

export function getSavedSpotifyPlaylist(): SpotifyPlaylistEntity | null {
  try {
    const raw = localStorage.getItem(SPOTIFY_PLAYLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn("Failed to load saved Spotify playlist:", e);
  }
  return null;
}

export function setSavedSpotifyPlaylist(entity: SpotifyPlaylistEntity | null): void {
  try {
    if (!entity) {
      localStorage.removeItem(SPOTIFY_PLAYLIST_STORAGE_KEY);
    } else {
      localStorage.setItem(SPOTIFY_PLAYLIST_STORAGE_KEY, JSON.stringify(entity));
    }
  } catch (e) {
    console.warn("Failed to save Spotify playlist:", e);
  }
}

export function clearSavedSpotifyPlaylist(): void {
  setSavedSpotifyPlaylist(null);
}

export async function resolveSpotifyLink(input: string): Promise<SpotifyPlaylistEntity> {
  const query = new URLSearchParams({ url: input.trim() });
  const response = await fetch(`/api/spotify/resolve?${query.toString()}`);
  if (!response.ok) {
    let errMessage = "Could not resolve Spotify link";
    try {
      const errJson = await response.json();
      if (errJson?.error) errMessage = errJson.error;
    } catch {
      // Ignore JSON parse failure
    }
    throw new Error(errMessage);
  }
  const entity: SpotifyPlaylistEntity = await response.json();
  if (!entity || !Array.isArray(entity.tracks) || entity.tracks.length === 0) {
    throw new Error("No playable tracks found in Spotify link");
  }
  return entity;
}

export async function fetchSpotifyTrackAudio(track: SpotifyTrackItem): Promise<File> {
  // 1. Check if already cached in browser IndexedDB/OPFS
  const fingerprint = `spotify-${track.id}`;
  try {
    const cachedFile = await getCachedAudio(fingerprint);
    if (cachedFile) {
      return cachedFile;
    }
  } catch (e) {
    console.warn("Error checking cached audio for Spotify track:", e);
  }

  // 2. Fetch from backend audio resolver
  const params = new URLSearchParams({
    id: track.id,
    title: track.title,
    artist: track.artist,
  });
  if (track.previewUrl) {
    params.set("previewUrl", track.previewUrl);
  }

  const response = await fetch(`/api/spotify/audio?${params.toString()}`);
  if (!response.ok) {
    let errMsg = `Failed to fetch audio for "${track.title}"`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const blob = await response.blob();
  const safeFilename = `${track.artist ? `${track.artist} - ` : ""}${track.title}.mp3`
    .replace(/[/\\?%*:|"<>]/g, "_");
  const file = new File([blob], safeFilename, { type: blob.type || "audio/mpeg" });

  // Store in cache for zero-friction future playback
  try {
    await setCachedAudio(fingerprint, file);
  } catch (e) {
    console.warn("Could not cache fetched Spotify audio:", e);
  }

  return file;
}
