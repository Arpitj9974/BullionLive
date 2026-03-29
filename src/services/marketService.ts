
export interface MetalPrice {
  priceUsd: number;
  priceInr: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

export interface MarketData {
  gold: MetalPrice;
  silver: MetalPrice;
  platinum: MetalPrice;
  exchangeRate: {
    rate: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
  };
  isLive: boolean;
  dataAgeSeconds?: number; // how old the backend cache is
  error?: string;
}

const CACHE_KEY = 'ar_market_cache_v2'; // Changed version to force cache bypass
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; 

// India effective duty multipliers (Precision tuned to match IBJA/GoodReturns Retail Benchmark)
const INDIA_GOLD_DUTY   = 1.0705; // Matches ~₹1,47,300 at $4500 spot
const INDIA_SILVER_DUTY = 1.0727; // Matches ~₹2,28,300 at $69 spot
const INDIA_PLAT_DUTY   = 0.9995; // Matches ~₹56,900 at $1880 spot

function processMetal(usdPrice: number, changePercent: number, rate: number, metalType: 'gold' | 'silver' | 'platinum'): MetalPrice {
  let inrPrice: number;
  if (metalType === 'silver') {
    inrPrice = usdPrice * rate * 32.1507 * INDIA_SILVER_DUTY;
  } else if (metalType === 'platinum') {
    inrPrice = (usdPrice * rate / 3.11035) * INDIA_PLAT_DUTY;
  } else {
    inrPrice = (usdPrice * rate / 3.11035) * INDIA_GOLD_DUTY;
  }
  return {
    priceUsd: usdPrice,
    priceInr: inrPrice,
    change: usdPrice * (changePercent / 100),
    changePercent: changePercent || 0,
    lastUpdated: new Date().toISOString(),
  };
}

function parseServerResponse(result: any): MarketData {
  const rate = result.usd_inr_rate || 84.83;
  return {
    gold: processMetal(result.gold_usd, result.gold_change_percent || 0, rate, 'gold'),
    silver: processMetal(result.silver_usd, result.silver_change_percent || 0, rate, 'silver'),
    platinum: processMetal(result.platinum_usd, result.platinum_change_percent || 0, rate, 'platinum'),
    exchangeRate: {
      rate,
      change: rate * ((result.usd_inr_change_percent || 0.05) / 100),
      changePercent: result.usd_inr_change_percent || 0.05,
      lastUpdated: new Date().toISOString(),
    },
    isLive: true,
    dataAgeSeconds: result.dataAgeSeconds ?? 0,
  };
}

/** Try to load previously cached data from localStorage (instant, no network) */
export function getCachedData(): MarketData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_MAX_AGE_MS) return null; // too old
    return data as MarketData;
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: MarketData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Ignore storage errors
  }
}

/** Fetch fresh data from the backend (which returns cached data instantly) */
export async function fetchLivePrices(): Promise<MarketData> {
  try {
    const res = await fetch('/api/market-prices');
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const result = await res.json();
    const data = parseServerResponse(result);
    saveToLocalStorage(data);
    return data;
  } catch (error: any) {
    console.error('[marketService] Fetch failed:', error.message);
    // Return stale localStorage data as fallback rather than crashing
    const stale = getCachedData();
    if (stale) return { ...stale, isLive: false, error: 'Using cached data — could not reach server.' };
    return { ...getMockData(), isLive: false, error: 'Could not fetch live prices. Showing demo data.' };
  }
}

function getMockData(): Omit<MarketData, 'isLive' | 'error'> {
  return {
    gold: { priceUsd: 2682.45, priceInr: 161700, change: 11.2, changePercent: 0.42, lastUpdated: new Date().toISOString() },
    silver: { priceUsd: 32.15, priceInr: 256000, change: -0.06, changePercent: -0.18, lastUpdated: new Date().toISOString() },
    platinum: { priceUsd: 970.10, priceInr: 67800, change: 3.0, changePercent: 0.31, lastUpdated: new Date().toISOString() },
    exchangeRate: { rate: 84.83, change: 0.04, changePercent: 0.05, lastUpdated: new Date().toISOString() },
    dataAgeSeconds: 0,
  };
}
