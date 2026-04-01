# AR-AuAgPt — Live Precious Metals Tracker

Real-time **Gold (Au)**, **Silver (Ag)** & **Platinum (Pt)** price dashboard with institutional-grade spot data, USD/INR conversion, 30-year historical charts, and a value calculator.

## Features

- **Live Spot Prices** — Swissquote institutional spot (primary) + Yahoo Finance futures (fallback)
- **Dual Currency** — USD and INR with calibrated Indian import duty multipliers (IBJA-benchmarked)
- **Dual Units** — Per ounce + per 10g/kg weight benchmarks
- **30-Year Historical Charts** — Monthly price data with comparison mode
- **Value Calculator** — Supports grams, ounces, kilograms, and tola
- **PWA** — Installable on mobile with offline caching
- **High-Performance Backend** — In-memory cache with 60s refresh, zero cold-start latency

## Tech Stack

**Frontend:** React 19, Vite, TailwindCSS v4, Recharts, Framer Motion  
**Backend:** Express + TypeScript (tsx), Yahoo Finance 2, Swissquote API  
**Deployment:** Render / Railway (unified single-service deployment)

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/market-prices

## Deploy

### Railway (Recommended — no cold starts)
1. Push to GitHub
2. [Railway.app](https://railway.app/) → New Project → Deploy from GitHub
3. Generate a public domain under Settings → Networking

### Render
1. Push to GitHub
2. [Render.com](https://render.com/) → New Web Service
3. **Build Command:** `npm install && npm run build`
4. **Start Command:** `npm start`

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3001) |
| `GEMINI_API_KEY_1` | No | Optional Gemini API key |
| `VITE_GOLD_API_KEY` | No | Optional GoldAPI key |

## License

Apache-2.0
