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

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

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
  source?: string;  // "swissquote" or "yahoo"
}

const CACHE_TTL_MS = 60_000; // refresh every 60 seconds

let cache: CachedMarketData | null = null;
let cacheRefreshing = false;

// ── Swissquote Spot Price Fetcher (Institutional-grade, free, no API key) ─────
// Returns the TRUE global spot mid-price (bid+ask)/2 — NOT futures with premium
async function fetchSwissquoteSpot(instrument: string): Promise<number | null> {
  try {
    const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${instrument}/USD`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json() as any[];
    if (Array.isArray(data) && data.length > 0) {
      const prices = data[0]?.spreadProfilePrices?.[0];
      if (prices && prices.bid && prices.ask) {
        return (prices.bid + prices.ask) / 2; // true spot mid-price
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── USD/INR Rate Fetcher (Yahoo PRIMARY → Frankfurter ECB FALLBACK) ──────────
// Frankfurter uses European Central Bank data — no API key, no rate limits, works on all cloud servers
async function fetchUsdInrRate(): Promise<number | null> {
  // Try Yahoo Finance first (most accurate)
  try {
    const res = await yahooFinance.quote('INR=X') as any;
    if (res?.regularMarketPrice && res.regularMarketPrice > 50) {
      return res.regularMarketPrice as number;
    }
  } catch { /* fall through */ }

  // Fallback: Frankfurter ECB Free API (USD → INR via EUR bridge)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json() as any;
    if (data?.rates?.INR && data.rates.INR > 50) {
      console.log('[Cache] USD/INR from Frankfurter ECB:', data.rates.INR);
      return data.rates.INR as number;
    }
  } catch { /* fall through */ }

  return null;
}

async function fetchLiveMarketData(): Promise<CachedMarketData> {
  console.log('[Cache] Fetching fresh market data...');

  // Fetch from BOTH sources in parallel for maximum reliability
  const [xauSpot, xagSpot, xptSpot, yahooMap] = await Promise.all([
    fetchSwissquoteSpot('XAU'),
    fetchSwissquoteSpot('XAG'),
    fetchSwissquoteSpot('XPT'),
    (async () => {
      try {
        const results: any[] = (await yahooFinance.quote(['GC=F', 'SI=F', 'PL=F', 'INR=X'])) as any[];
        const map: Record<string, any> = {};
        for (const r of results) map[r.symbol] = r;
        return map;
      } catch (e: any) {
        console.warn('[Cache] Yahoo Finance error:', e.message);
        return {} as Record<string, any>;
      }
    })(),
  ]);

  // ── Use Swissquote SPOT as PRIMARY, Yahoo FUTURES as FALLBACK ──
  const gold_usd = xauSpot ?? yahooMap['GC=F']?.regularMarketPrice ?? cache?.gold_usd ?? 3100;
  const silver_usd = xagSpot ?? yahooMap['SI=F']?.regularMarketPrice ?? cache?.silver_usd ?? 34;
  const platinum_usd = xptSpot ?? yahooMap['PL=F']?.regularMarketPrice ?? cache?.platinum_usd ?? 1000;

  // USD/INR: Yahoo Finance → Frankfurter ECB → previous cache → hardcoded current rate
  const usd_inr = (await fetchUsdInrRate()) ?? cache?.usd_inr_rate ?? 85.5;

  // ── % changes always from Yahoo (Swissquote doesn't provide previous close) ──
  const computePercent = (sym: string, fallback: number) => {
    const q = yahooMap[sym];
    if (q?.regularMarketPrice && q?.regularMarketPreviousClose) {
      return ((q.regularMarketPrice - q.regularMarketPreviousClose) / q.regularMarketPreviousClose) * 100;
    }
    return fallback;
  };

  const gold_change_pct = computePercent('GC=F', cache?.gold_change_percent ?? 0);
  const silver_change_pct = computePercent('SI=F', cache?.silver_change_percent ?? 0);
  const platinum_change_pct = computePercent('PL=F', cache?.platinum_change_percent ?? 0);
  const usd_inr_change_pct = computePercent('INR=X', cache?.usd_inr_change_percent ?? 0);

  const source = xauSpot ? 'Swissquote Spot' : 'Yahoo Futures';
  console.log(`[Cache] [${source}] Gold: $${gold_usd.toFixed(2)}, Silver: $${silver_usd.toFixed(2)}, Pt: $${platinum_usd.toFixed(2)}, USD/INR: ₹${usd_inr.toFixed(2)}`);

  return {
    gold_usd,
    silver_usd,
    platinum_usd,
    usd_inr_rate: usd_inr,
    gold_change_percent: gold_change_pct,
    silver_change_percent: silver_change_pct,
    platinum_change_percent: platinum_change_pct,
    usd_inr_change_percent: usd_inr_change_pct,
    cachedAt: Date.now(),
    source,
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

// ── Server Startup Warm-up ─────────────────────────────────────────────────────
async function startupWarmup() {
  console.log('[Server] 🚀 Starting warm-up...');
  await refreshCache();
  console.log('[Server] ✅ Warm-up complete. Market data ready.');
  setInterval(refreshCache, CACHE_TTL_MS);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /api/market-prices — returns cached data instantly
app.get('/api/market-prices', (_req, res) => {
  if (cache) {
    const ageSeconds = Math.round((Date.now() - cache.cachedAt) / 1000);
    return res.json({ ...cache, dataAgeSeconds: ageSeconds });
  }

  // Fallback if cache isn't ready yet (should rarely happen after warmup)
  return res.json({
    gold_usd: 3100.00,
    silver_usd: 34.00,
    platinum_usd: 1000.00,
    usd_inr_rate: 85.00,
    gold_change_percent: 0.15,
    silver_change_percent: -0.10,
    platinum_change_percent: 0.25,
    usd_inr_change_percent: 0.05,
    cachedAt: Date.now(),
    dataAgeSeconds: -1,
    error: 'Market data is warming up...'
  });
});

// React catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`[Server] Running on http://localhost:${port}`);
  startupWarmup();
});
