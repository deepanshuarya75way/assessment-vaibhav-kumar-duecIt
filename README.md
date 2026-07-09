# DuecIt — Real-Time Coding Duel Platform

Real-time 1v1 coding duels with ELO-based matchmaking, synchronized start times, and dual game modes (Competitive & Practice).

## Architecture

- **Go backend** (`duecit/`) — REST API + WebSockets, MongoDB, Redis
- **Next.js frontend** (`duecit-web/`) — Duel UI, Monaco editor, admin panel

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts MongoDB, Redis, and a local Piston API on `http://localhost:2000/api/v2`. Piston starts without language runtimes, so install the languages used by the judge before running submissions. See [docs/piston-selfhost-plan.md](docs/piston-selfhost-plan.md) for the package install flow and the production VPS setup.

### 2. Start Go API

```bash
cd duecit
cp .env.example .env
go run ./cmd/server
```

API runs at `http://localhost:8080`

### 3. Start Next.js frontend

```bash
cd duecit-web
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

## Features

- ELO matchmaking (±200 rating window, category-specific DSA/DB ratings)
- Server-synced duel timers: **45s reading** → **10 min coding**
- Match ends when **both players submit** or **time runs out**
- Competitive & Practice modes with Codeforces-style UI
- Language selection in the duel editor (per player)
- Profile pages with rating history and recent duels
- OAuth login (Google, GitHub — configure in `.env`)
- Admin portal: monitoring + problems/test cases only (no matchmaking)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/user/me` | Current user |
| POST | `/api/match/queue/join` | Join matchmaking |
| POST | `/api/submission/:id/run` | Run against samples |
| POST | `/api/submission/:id/submit` | Submit for judging |
| WS | `/ws?token=<jwt>` | Real-time events |

## WebSocket Events

- `match:found` — Match created with problem & opponent
- `match:coding_start` — Coding phase begins
- `submission:progress` — Opponent submission status
- `match:finished` — Results with both codes & ELO changes
