# CLAUDE.md — The Forever Jukebox (Eternal Jukebox)

## What It Is
The Eternal Jukebox (Forever Jukebox) is an audio visualization and infinite playback engine. It deconstructs tracks into beats, segments, and harmonic vectors, computing similarity matrices to create smooth, infinite non-linear audio loops in real time.

---

## Tech Stack
- **Backend**: Node.js, Express (`server.js`)
- **Frontend**: Vanilla JS, HTML5 Audio, Canvas 2D/WebGL dynamic graph visualizer, PWA
- **Package Manager**: npm
- **Process Manager**: systemd (`forever-jukebox.service` on port `5174`)
- **Public Domain**: Cloudflare Tunnel (`cloudflared-jukebox.service` $\rightarrow$ `jukebox.retake.cloud`)

---

## How to Run & Deploy

### Production Service (systemd)
```bash
# Restart the jukebox daemon
sudo systemctl restart forever-jukebox.service

# Inspect live logs
sudo journalctl -u forever-jukebox.service -f

# Verify status
sudo systemctl status forever-jukebox.service
```

### Development / Local Run
```bash
cd /home/ubuntu/Dev_Apps/forever-jukebox
PORT=5174 node server.js
```

### Docker (Alternative)
```bash
docker-compose up -d
```

---

## Secrets & Config (Names Only)
Stored in `.env` (derived from `.env.example`):
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `PORT` (default: `5174`)
- `HOST` (default: `0.0.0.0`)

---

## Conventions & Rules
1. **Audio Similarity Calculations**:
   - Timbre and pitch vector distances must preserve threshold metrics in `engine/` to avoid jarring musical skips.
2. **Offline & PWA Support**:
   - Cache manifest and service workers must maintain playback functionality for cached tracks.

---

## Known Gotchas
- **Live Deployment Path**: The systemd service currently runs `/usr/bin/node server.js` from `/home/ubuntu/Dev_Apps/fervent-pascal/forever-jukebox`. When making production updates, ensure changes are mirrored or deployed to that active directory.
- **Port Conflict**: Port `5174` is bound to `0.0.0.0`. Ensure other dev servers (like Vite default 5173/5174) do not collide.
