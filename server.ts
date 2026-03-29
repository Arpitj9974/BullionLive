import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));

// ── In-Memory Cache ────────────────────────────────────────────────────────────
interface CachedMarketData {
  gold_usd: number;
  silver_usd: number;
  platinum_usd: number;
  usd_inr_rate: number;
  gold_change_percent: number;
  silver_change_percent: number;
  platinum_change_percent: number;
  usd_inr_change_percent: number;
  cachedAt: number; // timestamp ms
}

const CACHE_TTL_MS = 60_000; // refresh every 60 seconds
const FETCH_TIMEOUT_MS = 8_000;

let cache: CachedMarketData | null = null;
let cacheRefreshing = false;

// ── Helpers ────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Core Data Fetcher ──────────────────────────────────────────────────────────
async function fetchLiveMarketData(): Promise<CachedMarketData> {
  console.log('[Cache] Fetching fresh market data...');

  // 1. Binance: PAXG/USDT ≈ Gold spot in USD
  const paxgPromise = fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', {}, 6000)
    .then(r => r.json())
    .catch(() => null);

  // 2. USD → INR exchange rate
  const exchangePromise = fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 6000)
    .then(r => r.json())
    .catch(() => null);

  // 3. Yahoo Finance for Silver & Platinum (parallel with above)
  const fetchYahoo = async (symbol: string) => {
    try {
      const r = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {}, 10000);
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return { price: meta.regularMarketPrice, prevClose: meta.chartPreviousClose };
    } catch {
      return null;
    }
  };

  const [paxg, exchange, ag, pt] = await Promise.all([
    paxgPromise,
    exchangePromise,
    fetchYahoo('SI=F'),
    fetchYahoo('PL=F'),
  ]);

  const gold_usd = paxg?.lastPrice ? parseFloat(paxg.lastPrice) : (cache?.gold_usd ?? 2680.00);
  const gold_change_pct = paxg?.priceChangePercent ? parseFloat(paxg.priceChangePercent) : (cache?.gold_change_percent ?? 0.42);
  const usd_inr = exchange?.rates?.INR ?? (cache?.usd_inr_rate ?? 84.83);

  const silver_usd = ag?.price ?? (cache?.silver_usd ?? 32.00);
  const silver_change_pct = ag ? ((ag.price - ag.prevClose) / ag.prevClose) * 100 : (cache?.silver_change_percent ?? -0.18);
  const platinum_usd = pt?.price ?? (cache?.platinum_usd ?? 970.00);
  const platinum_change_pct = pt ? ((pt.price - pt.prevClose) / pt.prevClose) * 100 : (cache?.platinum_change_percent ?? 0.31);

  console.log(`[Cache] Data ready — Gold: $${gold_usd.toFixed(2)}, Silver: $${silver_usd.toFixed(2)}, Pt: $${platinum_usd.toFixed(2)}, USD/INR: ₹${usd_inr.toFixed(2)}`);

  return {
    gold_usd,
    silver_usd,
    platinum_usd,
    usd_inr_rate: usd_inr,
    gold_change_percent: gold_change_pct,
    silver_change_percent: silver_change_pct,
    platinum_change_percent: platinum_change_pct,
    usd_inr_change_percent: 0.05,
    cachedAt: Date.now(),
  };
}

// ── Cache Refresh Logic ────────────────────────────────────────────────────────
async function refreshCache() {
  if (cacheRefreshing) return; // avoid overlapping fetches
  cacheRefreshing = true;
  try {
    cache = await fetchLiveMarketData();
    console.log('[Cache] ✅ Updated at', new Date().toLocaleTimeString());
  } catch (err: any) {
    console.warn('[Cache] ⚠️  Refresh failed:', err.message);
    // keep previous cache alive — don't wipe it
  } finally {
    cacheRefreshing = false;
  }
}

// ── Cache Refresh Logic ────────────────────────────────────────────────────────

// ── Server Startup Warm-up ─────────────────────────────────────────────────────
async function startupWarmup() {
  console.log('[Server] 🚀 Starting warm-up...');
  // Pre-warm the market data cache
  await refreshCache();
  console.log('[Server] ✅ Warm-up complete. Market data ready.');

  // Schedule background cache refresh every 60 seconds
  setInterval(refreshCache, CACHE_TTL_MS);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /api/market-prices — returns cached data instantly
app.get('/api/market-prices', async (_req, res) => {
  if (cache) {
    // Return cached data immediately — blazing fast
    const ageSeconds = Math.round((Date.now() - cache.cachedAt) / 1000);
    return res.json({ ...cache, dataAgeSeconds: ageSeconds });
  }

  // Cache not yet ready (very first request before warm-up finishes)
  try {
    const data = await fetchLiveMarketData();
    cache = data;
    return res.json({ ...data, dataAgeSeconds: 0 });
  } catch (err: any) {
    console.error('[Server] Critical error fetching market data:', err.message);
    return res.json({
      gold_usd: 2682.45, silver_usd: 32.15, platinum_usd: 970.10,
      usd_inr_rate: 84.83, gold_change_percent: 0.42,
      silver_change_percent: -0.18, platinum_change_percent: 0.31,
      usd_inr_change_percent: 0.05, cachedAt: Date.now(), dataAgeSeconds: -1,
    });
  }
});

// React catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, async () => {
  console.log(`[Server] Running on http://localhost:${port}`);
  await startupWarmup();
});
