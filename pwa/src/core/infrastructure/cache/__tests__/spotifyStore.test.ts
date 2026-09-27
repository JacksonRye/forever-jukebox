import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSavedSpotifyPlaylist,
  setSavedSpotifyPlaylist,
  clearSavedSpotifyPlaylist,
  resolveSpotifyLink,
  fetchSpotifyTrackAudio,
  SpotifyPlaylistEntity,
  SpotifyTrackItem,
} from "../spotifyStore";

describe("spotifyStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves and retrieves playlist entity to/from localStorage", () => {
    expect(getSavedSpotifyPlaylist()).toBeNull();

    const sampleEntity: SpotifyPlaylistEntity = {
      type: "playlist",
      id: "test123",
      title: "Test Playlist",
      subtitle: "Curator",
      coverUrl: "https://example.com/cover.jpg",
      trackCount: 1,
      tracks: [
        {
          id: "track1",
          title: "Track 1",
          artist: "Artist 1",
          durationMs: 180000,
          previewUrl: "https://example.com/preview.mp3",
          uri: "spotify:track:track1",
        },
      ],
    };

    setSavedSpotifyPlaylist(sampleEntity);
    expect(getSavedSpotifyPlaylist()).toEqual(sampleEntity);

    clearSavedSpotifyPlaylist();
    expect(getSavedSpotifyPlaylist()).toBeNull();
  });

  it("resolves Spotify link through /api/spotify/resolve", async () => {
    const mockEntity: SpotifyPlaylistEntity = {
      type: "track",
      id: "abc",
      title: "Song",
      subtitle: "Artist",
      coverUrl: null,
      trackCount: 1,
      tracks: [
        {
          id: "abc",
          title: "Song",
          artist: "Artist",
          durationMs: 120000,
          previewUrl: null,
          uri: "spotify:track:abc",
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockEntity), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await resolveSpotifyLink("https://open.spotify.com/track/abc");
    expect(fetchSpy).toHaveBeenCalledWith("/api/spotify/resolve?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Fabc");
    expect(result).toEqual(mockEntity);
  });

  it("throws descriptive error when /api/spotify/resolve fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(resolveSpotifyLink("https://open.spotify.com/track/xyz")).rejects.toThrow("Track not found");
  });

  it("fetches Spotify track audio and returns File object", async () => {
    const track: SpotifyTrackItem = {
      id: "track456",
      title: "Song Title",
      artist: "Singer",
      durationMs: 200000,
      previewUrl: "https://p.scdn.co/preview.mp3",
      uri: "spotify:track:track456",
    };

    const fakeAudioBlob = new Blob(["fake-audio-bytes"], { type: "audio/mpeg" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(fakeAudioBlob, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );

    const file = await fetchSpotifyTrackAudio(track);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("Singer - Song Title.mp3");
    expect(file.type).toBe("audio/mpeg");
  });
});
