# PaperTradeX

Paper trading for Indian equities and ETFs — practice buys, sells, and portfolio management with **live market data**, without risking real money.

| Layer | Stack |
|-------|--------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, Chart.js |
| Backend | Node.js, Express, Socket.IO, Mongoose |
| Market data | Yahoo Finance, NSE-oriented quote pipeline |
| AI (optional) | Groq · OpenRouter · Gemini |
| Database | MongoDB |

**Repo:** [github.com/harshc17/PapertTradeX](https://github.com/harshc17/PapertTradeX)

---

## Features

| Area | What you get |
|------|----------------|
| **Auth** | Register and login with JWT sessions |
| **Dashboard** | Market overview, portfolio snapshot, movers, indices |
| **Trading** | Stock detail pages with charts and paper buy/sell |
| **Portfolio** | Holdings, order history, watchlist |
| **Discovery** | Stock screener and ETF screener |
| **Challenge** | Weekly paper-trading challenge flow |
| **AI** | Ask-AI assistant and news / portfolio analysis panels |
| **Live data** | Real-time quote updates over Socket.IO |

### App routes

| Path | Page |
|------|------|
| `/login` | Sign in / register |
| `/dashboard` | Main market & portfolio hub |
| `/stock/[symbol]` | Chart, quote, and trade panel |
| `/holdings` | Open positions |
| `/orders` | Order history |
| `/watchlist` | Saved symbols |
| `/stock-screener` | Equity screener |
| `/etf-screener` | ETF screener |
| `/challenge` | Weekly challenge |
| `/ask-ai` | AI assistant |
| `/admin` | Admin tools |

---

## Project structure

```
PaperTradeX/
├── frontend/                 # Next.js UI (src/app, components, contexts)
├── backend/
│   ├── src/
│   │   ├── server.js         # Express API + Socket.IO
│   │   ├── models/           # MongoDB models
│   │   └── services/         # Market data, trade engine, AI, NSE clients
│   └── .env.example          # Env template (copy to .env)
├── database_schema.sql       # Schema reference
├── package.json              # Root scripts (run both apps)
└── README.md
```

---

## Prerequisites

- **Node.js** 18 or newer
- **npm**
- **MongoDB** running locally, or a cloud URI (Atlas, etc.)

---

## Quick start

```bash
git clone https://github.com/harshc17/PapertTradeX.git
cd PapertTradeX

# Install root + backend + frontend deps
npm run install:all

# Backend environment
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```bash
MONGODB_URI=mongodb://localhost:27017/papertradex

# Optional — enable AI features
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
```

Start both servers from the repo root:

```bash
npm start
```

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:3001 |

### Run separately

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

### Root scripts

| Script | Command | What it does |
|--------|---------|--------------|
| Install everything | `npm run install:all` | Installs root, backend, and frontend deps |
| Start both | `npm start` | Backend (3001) + frontend (3000) via concurrently |
| Backend only | `npm run server` | `nodemon` on the Express API |
| Frontend only | `npm run client` | Next.js dev server |

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. **Do not commit** real keys.

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes* | MongoDB connection string (*defaults to local if omitted) |
| `GROQ_API_KEY` | No | Primary AI provider (fast free tier) |
| `OPENROUTER_API_KEY` | No | Fallback AI provider |
| `GEMINI_API_KEY` | No | Google Gemini for AI features |

---

## How it works

1. **Frontend** talks to the Express API for auth, portfolio, orders, and stock metadata.
2. **Backend** fetches quotes / history via market-data services and runs the paper **TradeEngine**.
3. **Socket.IO** pushes live price updates to the client ticker and dashboards.
4. **MongoDB** stores users, holdings, orders, and watchlists.
5. Optional **AI** keys power Ask-AI and news/portfolio analysis when configured.

On first startup with a reachable database, the backend seeds initial market-related data as needed.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend fails to start | Confirm MongoDB is running and `MONGODB_URI` is correct |
| Empty / stale prices | Check network access for market-data providers; watch backend logs |
| AI panels error / empty | Set at least one of `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` |
| Frontend can't reach API | Ensure backend is on port **3001** and CORS is not blocked locally |
| Port already in use | Stop other processes on 3000/3001, or change ports in config |

---

## Notes

- This is **paper trading only** — no real brokerage or money movement.
- Unauthenticated users are redirected to `/login`; signed-in users land on `/dashboard`.
- Keep secrets in `backend/.env` only.

## License

Private / personal project unless otherwise noted.
