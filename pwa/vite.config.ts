import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import en from "./src/app/locales/en.json";

const execFileAsync = promisify(execFile);

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  const appBase = isDev ? "/" : "/offline/";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';"
    : "script-src 'self' 'wasm-unsafe-eval';";
  const csp = [
    "default-src 'self';",
    "connect-src 'self' blob: data: https://p.scdn.co https://open.spotify.com https://i.scdn.co https://image-cdn-ak.spotifycdn.com;",
    "img-src 'self' blob: data: https://i.scdn.co https://image-cdn-ak.spotifycdn.com https://*.spotifycdn.com https://*.scdn.co;",
    "media-src 'self' blob: data: https://p.scdn.co https://*.scdn.co;",
    scriptSrc,
    "style-src 'self' 'unsafe-inline';",
    "worker-src 'self' blob:;",
    "font-src 'self' data:;",
  ].join(" ");

  return {
    base: appBase,
    server: {
      port: 5174,
      strictPort: true,
    },
    optimizeDeps: {
      include: [
        "essentia.js/dist/essentia.js-core.es.js",
        "essentia.js/dist/essentia-wasm.es.js",
        "@ffmpeg/ffmpeg",
        "@ffmpeg/util",
      ],
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      {
        name: "pwa-csp",
        transformIndexHtml(html) {
          return html.replace("__PWA_CSP__", csp);
        },
      },
      {
        name: "local-audio-serve",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith("/api/local-audio")) {
              const url = new URL(req.url, "http://localhost:5174");
              const trackName = url.searchParams.get("name") || "";
              const fingerprint = url.searchParams.get("fingerprint") || "";
              const workspaceDir = path.resolve(
                fileURLToPath(new URL(".", import.meta.url)),
                "../..",
              );
              try {
                const files = await fs.promises.readdir(workspaceDir);
                const audioFiles = files.filter((f) =>
                  /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f),
                );
                let matchedFile: string | null = null;
                if (trackName) {
                  const queryLower = trackName.toLowerCase();
                  matchedFile =
                    audioFiles.find((f) => {
                      const base = f.toLowerCase().replace(/\.[^.]+$/, "");
                      return (
                        base.includes(queryLower) ||
                        queryLower.includes(base)
                      );
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
                      (f) =>
                        f.toLowerCase().includes("boney") ||
                        f.toLowerCase().includes("daddy"),
                    ) || null;
                }
                if (!matchedFile && audioFiles.length === 1) {
                  matchedFile = audioFiles[0];
                }
                if (matchedFile) {
                  const filePath = path.join(workspaceDir, matchedFile);
                  const stat = await fs.promises.stat(filePath);
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "audio/mpeg");
                  res.setHeader("Content-Length", stat.size);
                  res.setHeader("X-Filename", encodeURIComponent(matchedFile));
                  res.setHeader("X-Last-Modified", stat.mtimeMs);
                  res.setHeader("Access-Control-Allow-Origin", "*");
                  res.setHeader(
                    "Access-Control-Expose-Headers",
                    "X-Filename, X-Last-Modified",
                  );
                  const readStream = fs.createReadStream(filePath);
                  readStream.pipe(res);
                  return;
                }
              } catch (e) {
                console.error("Local audio serve error:", e);
              }
              res.statusCode = 404;
              res.end("Not found");
              return;
            }

            if (req.url && req.url.startsWith("/api/spotify/resolve")) {
              const url = new URL(req.url, "http://localhost:5174");
              const rawInput = url.searchParams.get("url") || "";
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              try {
                const trimmed = rawInput.trim();
                let type: "track" | "playlist" | "album" | null = null;
                let id: string | null = null;
                const uriMatch = trimmed.match(/^spotify:(track|playlist|album):([a-zA-Z0-9]+)/i);
                if (uriMatch) {
                  type = uriMatch[1].toLowerCase() as any;
                  id = uriMatch[2];
                } else {
                  const urlMatch = trimmed.match(/open\.spotify\.com\/(?:[^/]+\/)*(track|playlist|album)\/([a-zA-Z0-9]+)/i);
                  if (urlMatch) {
                    type = urlMatch[1].toLowerCase() as any;
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
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
                    ? entity.artists.map((a: any) => a.name).join(", ")
                    : (entity.subtitle || "Unknown Artist");
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
                  res.end(JSON.stringify({
                    type: "track",
                    id,
                    title: track.title,
                    subtitle: artist,
                    coverUrl,
                    trackCount: 1,
                    tracks: [track],
                  }));
                  return;
                }

                const title = entity.name || entity.title || "Untitled Playlist";
                const subtitle = entity.subtitle ||
                  (Array.isArray(entity.artists)
                    ? entity.artists.map((a: any) => a.name).join(", ")
                    : "Spotify");
                const rawList = Array.isArray(entity.trackList) ? entity.trackList : [];
                const tracks = rawList.map((t: any, idx: number) => {
                  let tId = t.id;
                  if (!tId && typeof t.uri === "string") {
                    const parts = t.uri.split(":");
                    tId = parts[parts.length - 1];
                  }
                  if (!tId) tId = `${id}-${idx}`;
                  return {
                    id: tId,
                    title: t.title || t.name || `Track ${idx + 1}`,
                    artist: t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(", ") : subtitle),
                    durationMs: t.duration || 0,
                    previewUrl: t.audioPreview?.url || null,
                    uri: t.uri || `spotify:track:${tId}`,
                    coverUrl,
                  };
                });

                res.statusCode = 200;
                res.end(JSON.stringify({
                  type,
                  id,
                  title,
                  subtitle,
                  coverUrl,
                  trackCount: tracks.length,
                  tracks,
                }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message || "Failed to resolve Spotify link" }));
                return;
              }
            }

            if (req.url && req.url.startsWith("/api/spotify/audio")) {
              const url = new URL(req.url, "http://localhost:5174");
              const trackId = url.searchParams.get("id") || "track";
              const title = url.searchParams.get("title") || "";
              const artist = url.searchParams.get("artist") || "";
              const previewUrl = url.searchParams.get("previewUrl") || "";
              const workspaceDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
              const spotifyCacheDir = path.resolve(workspaceDir, ".spotify-cache");
              if (!fs.existsSync(spotifyCacheDir)) {
                fs.mkdirSync(spotifyCacheDir, { recursive: true });
              }

              const safeId = trackId.replace(/[^a-zA-Z0-9_-]/g, "_");
              const cachedFilePath = path.join(spotifyCacheDir, `${safeId}.mp3`);

              if (fs.existsSync(cachedFilePath)) {
                const stat = await fs.promises.stat(cachedFilePath);
                res.statusCode = 200;
                res.setHeader("Content-Type", "audio/mpeg");
                res.setHeader("Content-Length", stat.size);
                res.setHeader("Access-Control-Allow-Origin", "*");
                fs.createReadStream(cachedFilePath).pipe(res);
                return;
              }

              if (previewUrl && previewUrl.startsWith("http")) {
                try {
                  const audioFetch = await fetch(previewUrl);
                  if (audioFetch.ok) {
                    const arrayBuf = await audioFetch.arrayBuffer();
                    const buffer = Buffer.from(arrayBuf);
                    await fs.promises.writeFile(cachedFilePath, buffer);
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "audio/mpeg");
                    res.setHeader("Content-Length", buffer.length);
                    res.setHeader("Access-Control-Allow-Origin", "*");
                    res.end(buffer);
                    return;
                  }
                } catch (e) {
                  console.warn("Spotify preview fetch failed:", e);
                }
              }

              try {
                const query = artist ? `${artist} - ${title}` : title;
                await execFileAsync("yt-dlp", [
                  "-f", "ba/b",
                  "-x", "--audio-format", "mp3",
                  "--audio-quality", "0",
                  "-o", cachedFilePath,
                  `ytsearch1:${query}`
                ], { timeout: 25000 });

                if (fs.existsSync(cachedFilePath)) {
                  const stat = await fs.promises.stat(cachedFilePath);
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "audio/mpeg");
                  res.setHeader("Content-Length", stat.size);
                  res.setHeader("Access-Control-Allow-Origin", "*");
                  fs.createReadStream(cachedFilePath).pipe(res);
                  return;
                }
              } catch (ytErr) {
                console.warn("yt-dlp download fallback failed:", ytErr);
              }

              try {
                const files = await fs.promises.readdir(workspaceDir);
                const audioFiles = files.filter(f => /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f));
                const matched = audioFiles.find(f => {
                  const lower = f.toLowerCase();
                  return (title && lower.includes(title.toLowerCase())) ||
                         (artist && lower.includes(artist.toLowerCase())) ||
                         lower.includes("boney");
                }) || audioFiles[0];
                if (matched) {
                  const fallbackPath = path.join(workspaceDir, matched);
                  const stat = await fs.promises.stat(fallbackPath);
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "audio/mpeg");
                  res.setHeader("Content-Length", stat.size);
                  res.setHeader("Access-Control-Allow-Origin", "*");
                  fs.createReadStream(fallbackPath).pipe(res);
                  return;
                }
              } catch (e) {
                // ignore
              }

              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ error: "Could not retrieve audio for this track" }));
              return;
            }

            next();
          });
        },
      },
      react(),
      VitePWA({
        injectRegister: null,
        // "autoUpdate" makes the new service worker skipWaiting + clientsClaim,
        // so it activates promptly instead of getting stuck in the waiting state
        // (which previously left installed clients frozen on a stale version).
        // Because we register manually in main.tsx with no controllerchange
        // handler, the page is NOT force-reloaded mid-session: the refreshed
        // precache surfaces on the next navigation/launch, preserving
        // long-running analysis/playback.
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "favicon-512.png", "worker.js", "madmom/**", "badges/**"],
        devOptions: {
          enabled: command === "serve",
          suppressWarnings: command === "serve",
        },
        manifest: {
          name: en.common.appName,
          short_name: en.common.appName,
          description: en.manifest.description,
          id: appBase,
          start_url: appBase,
          scope: appBase,
          display: "standalone",
          background_color: "#0c0f14",
          theme_color: "#0c0f14",
          icons: [
            {
              src: `${appBase}favicon.png`,
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: `${appBase}favicon-512.png`,
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          mode: "development",
          navigateFallback: `${appBase}index.html`,
          ...(isDev
            ? {}
            : {
                maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
                cleanupOutdatedCaches: true,
                globPatterns: ["**/*.{js,css,html,wasm,json,webmanifest,png,svg,ico,ttf,woff,woff2,wav}"],
                runtimeCaching: [
                  {
                    urlPattern: ({ request }) =>
                      request.mode === "navigate" ||
                      ["script", "style", "worker", "image", "font", "audio"].includes(request.destination),
                    handler: "CacheOnly",
                  },
                ],
              }),
        },
      }),
    ],
    build: {
      target: "es2021",
    },
    test: {
      environment: "jsdom",
    },
  };
});
