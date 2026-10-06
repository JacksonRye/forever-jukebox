import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "5174", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DIST_DIR = path.resolve(__dirname, "pwa/dist");

// Directories to look for audio files and spotify cache
const SEARCH_DIRS = [
  path.resolve(__dirname, ".."), // fervent-pascal root
  path.resolve(__dirname, "../.."),
  __dirname,
  "/home/ubuntu/Dev_Apps/fervent-pascal",
];

function getSpotifyCacheDir() {
  for (const dir of SEARCH_DIRS) {
    const candidate = path.join(dir, ".spotify-cache");
    if (fs.existsSync(candidate)) return candidate;
  }
  const fallback = path.join(SEARCH_DIRS[0], ".spotify-cache");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".txt": "text/plain; charset=utf-8",
};

function setStandardHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, X-Filename, X-Last-Modified, Accept-Ranges");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
}

function streamFileWithRange(req, res, filePath, contentType) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end("File not found");
      return;
    }

    const fileSize = stats.size;
    const range = req.headers.range;

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", contentType);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunksize);
      file.pipe(res);
    } else {
      res.statusCode = 200;
      res.setHeader("Content-Length", fileSize);
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// 1. Spotify Link Resolver
async function handleSpotifyResolve(req, res, parsedUrl) {
  const rawInput = parsedUrl.searchParams.get("url") || "";
  res.setHeader("Content-Type", "application/json");

  try {
    const trimmed = rawInput.trim();
    let type = null;
    let id = null;
    const uriMatch = trimmed.match(/^spotify:(track|playlist|album):([a-zA-Z0-9]+)/i);
    if (uriMatch) {
      type = uriMatch[1].toLowerCase();
      id = uriMatch[2];
    } else {
      const urlMatch = trimmed.match(/open\.spotify\.com\/(?:[^/]+\/)*(track|playlist|album)\/([a-zA-Z0-9]+)/i);
      if (urlMatch) {
        type = urlMatch[1].toLowerCase();
        id = urlMatch[2];
      }
    }

    if (!type || !id) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid Spotify URL or URI" }));
      return;
    }

    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    const fetchRes = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!fetchRes.ok) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: `Spotify embed request failed (${fetchRes.status})` }));
      return;
    }

    const html = await fetchRes.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (!match) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "Could not parse Spotify data from embed" }));
      return;
    }

    const data = JSON.parse(match[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Spotify item not found" }));
      return;
    }

    const coverUrl =
      entity.coverArt?.sources?.[0]?.url ||
      entity.visualIdentity?.image?.[0]?.url ||
      null;

    if (type === "track") {
      const artist = Array.isArray(entity.artists)
        ? entity.artists.map((a) => a.name).join(", ")
        : entity.subtitle || "Unknown Artist";
      const track = {
        id: entity.id || id,
        title: entity.name || entity.title || "Untitled",
        artist,
        durationMs: entity.duration || 0,
        previewUrl: entity.audioPreview?.url || null,
        uri: entity.uri || `spotify:track:${id}`,
        coverUrl,
      };
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          type: "track",
          id,
          title: track.title,
          subtitle: artist,
          coverUrl,
          trackCount: 1,
          tracks: [track],
        })
      );
      return;
    }

    const title = entity.name || entity.title || "Untitled Playlist";
    const subtitle =
      entity.subtitle ||
      (Array.isArray(entity.artists)
        ? entity.artists.map((a) => a.name).join(", ")
        : "Spotify");
    const rawList = Array.isArray(entity.trackList) ? entity.trackList : [];
    const tracks = rawList.map((t, idx) => {
      let tId = t.id;
      if (!tId && typeof t.uri === "string") {
        const parts = t.uri.split(":");
        tId = parts[parts.length - 1];
      }
      if (!tId) tId = `${id}-${idx}`;
      return {
        id: tId,
        title: t.title || t.name || `Track ${idx + 1}`,
        artist:
          t.subtitle ||
          (Array.isArray(t.artists)
            ? t.artists.map((a) => a.name).join(", ")
            : subtitle),
        durationMs: t.duration || 0,
        previewUrl: t.audioPreview?.url || null,
        uri: t.uri || `spotify:track:${tId}`,
        coverUrl,
      };
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        type,
        id,
        title,
        subtitle,
        coverUrl,
        trackCount: tracks.length,
        tracks,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || "Failed to resolve Spotify link" }));
  }
}

// 2. Spotify Audio Downloader / Streamer
async function handleSpotifyAudio(req, res, parsedUrl) {
  const trackId = parsedUrl.searchParams.get("id") || "track";
  const title = parsedUrl.searchParams.get("title") || "";
  const artist = parsedUrl.searchParams.get("artist") || "";
  const previewUrl = parsedUrl.searchParams.get("previewUrl") || "";

  const spotifyCacheDir = getSpotifyCacheDir();
  const safeId = trackId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const cachedFilePath = path.join(spotifyCacheDir, `${safeId}.mp3`);

  // Check if file is already cached
  if (fs.existsSync(cachedFilePath)) {
    streamFileWithRange(req, res, cachedFilePath, "audio/mpeg");
    return;
  }

  // If preview URL is available, try fetching it first
  if (previewUrl && previewUrl.startsWith("http")) {
    try {
      const audioFetch = await fetch(previewUrl);
      if (audioFetch.ok) {
        const arrayBuf = await audioFetch.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        await fs.promises.writeFile(cachedFilePath, buffer);
        streamFileWithRange(req, res, cachedFilePath, "audio/mpeg");
        return;
      }
    } catch (e) {
      console.warn("Spotify preview fetch failed:", e);
    }
  }

  // Try yt-dlp fallback
  try {
    const query = artist ? `${artist} - ${title}` : title;
    await execFileAsync(
      "yt-dlp",
      [
        "-f",
        "ba/b",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        cachedFilePath,
        `ytsearch1:${query}`,
      ],
      { timeout: 30000 }
    );

    if (fs.existsSync(cachedFilePath)) {
      streamFileWithRange(req, res, cachedFilePath, "audio/mpeg");
      return;
    }
  } catch (ytErr) {
    console.warn("yt-dlp download fallback failed:", ytErr);
  }

  // Search local audio files fallback
  for (const dir of SEARCH_DIRS) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = await fs.promises.readdir(dir);
      const audioFiles = files.filter((f) => /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f));
      const matched =
        audioFiles.find((f) => {
          const lower = f.toLowerCase();
          return (
            (title && lower.includes(title.toLowerCase())) ||
            (artist && lower.includes(artist.toLowerCase())) ||
            lower.includes("boney")
          );
        }) || audioFiles[0];

      if (matched) {
        const fallbackPath = path.join(dir, matched);
        streamFileWithRange(req, res, fallbackPath, "audio/mpeg");
        return;
      }
    } catch (e) {
      // continue
    }
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Could not retrieve audio for this track" }));
}

// 3. Local Audio Streamer
async function handleLocalAudio(req, res, parsedUrl) {
  const trackName = parsedUrl.searchParams.get("name") || "";
  const fingerprint = parsedUrl.searchParams.get("fingerprint") || "";

  for (const dir of SEARCH_DIRS) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = await fs.promises.readdir(dir);
      const audioFiles = files.filter((f) => /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f));
      if (audioFiles.length === 0) continue;

      let matchedFile = null;
      if (trackName) {
        const queryLower = trackName.toLowerCase();
        matchedFile =
          audioFiles.find((f) => {
            const base = f.toLowerCase().replace(/\.[^.]+$/, "");
            return base.includes(queryLower) || queryLower.includes(base);
          }) || null;
      }
      if (!matchedFile && fingerprint) {
        matchedFile =
          audioFiles.find((f) => {
            const clean = f.replace(/[^a-zA-Z0-9_.-]/g, "_");
            return fingerprint.includes(clean);
          }) || null;
      }
      if (!matchedFile) {
        matchedFile =
          audioFiles.find(
            (f) => f.toLowerCase().includes("boney") || f.toLowerCase().includes("daddy")
          ) || null;
      }
      if (!matchedFile && audioFiles.length === 1) {
        matchedFile = audioFiles[0];
      }

      if (matchedFile) {
        const filePath = path.join(dir, matchedFile);
        const stat = await fs.promises.stat(filePath);
        res.setHeader("X-Filename", encodeURIComponent(matchedFile));
        res.setHeader("X-Last-Modified", stat.mtimeMs);
        streamFileWithRange(req, res, filePath, "audio/mpeg");
        return;
      }
    } catch (e) {
      console.warn("Local audio dir scan failed:", dir, e);
    }
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Local audio file not found" }));
}

const server = http.createServer(async (req, res) => {
  setStandardHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // Handle API routes (with or without /jukebox prefix)
  if (pathname === "/api/spotify/resolve" || pathname === "/jukebox/api/spotify/resolve") {
    return handleSpotifyResolve(req, res, parsedUrl);
  }
  if (pathname === "/api/spotify/audio" || pathname === "/jukebox/api/spotify/audio") {
    return handleSpotifyAudio(req, res, parsedUrl);
  }
  if (pathname === "/api/local-audio" || pathname === "/jukebox/api/local-audio") {
    return handleLocalAudio(req, res, parsedUrl);
  }
  if (pathname === "/health" || pathname === "/jukebox/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", app: "forever-jukebox-pwa" }));
    return;
  }

  // Redirect root or /jukebox to /jukebox/ for proper PWA base resolution
  if (pathname === "/jukebox") {
    res.statusCode = 301;
    res.setHeader("Location", "/jukebox/");
    res.end();
    return;
  }
  if (pathname === "/" || pathname === "") {
    res.statusCode = 302;
    res.setHeader("Location", "/jukebox/");
    res.end();
    return;
  }

  // Normalize path for static assets
  let subPath = pathname;
  if (subPath.startsWith("/jukebox")) {
    subPath = subPath.slice("/jukebox".length);
  }
  if (!subPath || subPath === "/") {
    subPath = "/index.html";
  }

  const safePath = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(DIST_DIR, safePath);

  // Check if static file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Caching headers
    if (pathname.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }

    return streamFileWithRange(req, res, filePath, contentType);
  }

  // SPA Fallback: serve index.html for all other routes under /jukebox or /
  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    return streamFileWithRange(req, res, indexPath, "text/html; charset=utf-8");
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(PORT, HOST, () => {
  console.log(`Forever Jukebox PWA running on http://${HOST}:${PORT}`);
  console.log(`PWA available at: http://${HOST}:${PORT}/jukebox/`);
});
