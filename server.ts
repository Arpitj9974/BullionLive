import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ quiet: true } as any);

const app = express();
const port = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));

// Helper: fetch with a 5-second timeout so we NEVER hang forever
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
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

async function fetchLiveMarketData() {
  console.log('[Server] Fetching live market data...');

  // 1. Binance: PAXG = 1 troy oz of gold, priced in USDT ≈ USD
  const paxgPromise = fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT')
    .then(r => r.json())
    .catch(() => null);

  // 2. Binance: Silver via XIDR proxy isn't reliable, use alternative
  // Metals price from frankfurter (free, no key) doesn't do metals, so use hardcoded ratios
  //   We use Binance's PAXG for gold and derive silver/platinum from typical market ratios

  // 3. USD → INR from open.er-api (free, no key needed)
  const exchangePromise = fetchWithTimeout('https://open.er-api.com/v6/latest/USD')
    .then(r => r.json())
    .catch(() => null);

  const [paxg, exchange] = await Promise.all([paxgPromise, exchangePromise]);

  const gold_usd = paxg?.lastPrice ? parseFloat(paxg.lastPrice) : 2680.00;
  const gold_change_pct = paxg?.priceChangePercent ? parseFloat(paxg.priceChangePercent) : 0.42;
  const usd_inr = exchange?.rates?.INR ?? 94.83;

  // 2. Silver & Platinum via Yahoo Finance (Free, no key needed, extremely reliable)
  // Silver Futures = 'SI=F', Platinum Futures = 'PL=F'
  let silver_usd = 70.00;
  let silver_change_pct = -0.18;
  let platinum_usd = 991.50;
  let platinum_change_pct = 0.31;
  
  try {
    const fetchYahoo = async (symbol: string) => {
      const r = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return {
        price: meta.regularMarketPrice,
        prevClose: meta.chartPreviousClose
      };
    };

    const [ag, pt] = await Promise.all([fetchYahoo('SI=F'), fetchYahoo('PL=F')]);

    if (ag?.price) {
      silver_usd = ag.price;
      silver_change_pct = ((ag.price - ag.prevClose) / ag.prevClose) * 100;
    }
    if (pt?.price) {
      platinum_usd = pt.price;
      platinum_change_pct = ((pt.price - pt.prevClose) / pt.prevClose) * 100;
    }
  } catch (e: any) {
    console.warn('[Server] Yahoo Finance fetch failed:', e.message);
  }

  return {
    gold_usd,
    silver_usd,
    platinum_usd,
    usd_inr_rate: usd_inr,
    gold_change_percent: gold_change_pct,
    silver_change_percent: silver_change_pct,
    platinum_change_percent: platinum_change_pct,
    usd_inr_change_percent: 0.05,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/market-prices', async (_req, res) => {
  try {
    const data = await fetchLiveMarketData();
    console.log('[Server] Market data OK:', JSON.stringify(data));
    res.json(data);
  } catch (err: any) {
    console.error('[Server] Critical error:', err.message);
    // Absolute last resort: realistic hardcoded 2026 values
    res.json({
      gold_usd: 2682.45, silver_usd: 32.15, platinum_usd: 992.10,
      usd_inr_rate: 94.83, gold_change_percent: 0.42,
      silver_change_percent: -0.18, platinum_change_percent: 0.31,
      usd_inr_change_percent: 0.05
    });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { marketData } = req.body;
  const key = process.env.GEMINI_API_KEY_1;

  if (!key) {
    return res.status(500).json({ error: 'API key is not configured.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });

    const prompt = `You are a senior precious metals market analyst. Here are today's live prices:
- Gold: $${marketData.gold_usd?.toFixed(2)}/oz (${marketData.gold_change_pct >= 0 ? '+' : ''}${marketData.gold_change_pct?.toFixed(2)}% today)
- Silver: $${marketData.silver_usd?.toFixed(2)}/oz (${marketData.silver_change_pct >= 0 ? '+' : ''}${marketData.silver_change_pct?.toFixed(2)}% today)
- Platinum: $${marketData.platinum_usd?.toFixed(2)}/oz (${marketData.platinum_change_pct >= 0 ? '+' : ''}${marketData.platinum_change_pct?.toFixed(2)}% today)
- USD/INR: ₹${marketData.usd_inr?.toFixed(2)}

Provide a concise market analysis in 3-4 bullet points covering:
1. Current price momentum and notable moves
2. Gold-Silver ratio and what it implies
3. Indian jewelry market perspective (INR impact)
4. Short-term outlook for precious metals investors

Keep it sharp, professional, and actionable. Use bullet points with **bold** for key figures.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    if (response.text) {
      console.log('[Gemini] Analysis generated successfully');
      return res.json({ analysis: response.text });
    }
  } catch (e: any) {
    console.warn('[Gemini] key failed:', e.message);
  }

  res.status(500).json({ error: 'AI Analysis unavailable right now.' });
});

// React Catch-all Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`[Server] Running on http://localhost:${port}`);
});
