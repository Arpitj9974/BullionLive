
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
  error?: string;
}

export async function fetchLivePrices(): Promise<MarketData> {
  try {
    const res = await fetch('/api/market-prices');
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed with status ${res.status}`);
    }

    const result = await res.json();
    const now = new Date().toISOString();
    const rate = result.usd_inr_rate || 83.5;

    // India spot metal prices include:
    // - 15% Basic Customs Duty
    // - 3% GST on gold/silver jewellery (10% on raw import)
    // - ~5% IGST + assorted cess
    // Net effective loading on imported silver/gold ≈ 18-21%
    const INDIA_GOLD_DUTY  = 1.185; // ~18.5% effective: 10% BCD + 3% GST + ~5.5% other
    const INDIA_SILVER_DUTY = 1.21;  // ~21% effective: 15% BCD + 3% GST + 3% agri cess
    const INDIA_PLAT_DUTY  = 1.185; // Same as gold

    const processMetal = (usdPrice: number, changePercent: number, isSilver: boolean = false, isPlatinum: boolean = false) => {
      let inrPrice: number;
      if (isSilver) {
        // Silver: USD/oz → INR/kg, then apply India duties
        inrPrice = usdPrice * rate * 32.1507 * INDIA_SILVER_DUTY;
      } else {
        // Gold & Platinum: USD/oz → INR/10g, then apply India duties
        inrPrice = (usdPrice * rate / 3.11035) * INDIA_GOLD_DUTY;
      }
      return {
        priceUsd: usdPrice,
        priceInr: inrPrice,
        change: (usdPrice * (changePercent / 100)),
        changePercent: changePercent || 0,
        lastUpdated: now
      };
    };

    return {
      gold: processMetal(result.gold_usd, result.gold_change_percent || 0.5),
      silver: processMetal(result.silver_usd, result.silver_change_percent || -0.2, true),
      platinum: processMetal(result.platinum_usd, result.platinum_change_percent || 0.3),
      exchangeRate: {
        rate: rate,
        change: rate * ((result.usd_inr_change_percent || 0.05) / 100),
        changePercent: result.usd_inr_change_percent || 0.05,
        lastUpdated: now
      },
      isLive: true
    };

    } catch (error: any) {
    console.error("Gemini Market Fetch Error:", error);
    let errorMsg = "Gemini AI search failed. Showing demo prices.";
    if (error.message && error.message.includes("429")) {
      errorMsg = "Gemini API Quota Exhausted (Error 429). Please update your API key in the .env file.";
    }
    return { ...getMockData(), isLive: false, error: errorMsg };
  }
}

function getMockData(): Omit<MarketData, 'isLive' | 'error'> {
  const now = new Date().toISOString();
  return {
    gold: { priceUsd: 2150.45, priceInr: 57500, change: 12.5, changePercent: 0.58, lastUpdated: now },
    silver: { priceUsd: 24.30, priceInr: 72500, change: -0.15, changePercent: -0.62, lastUpdated: now },
    platinum: { priceUsd: 920.10, priceInr: 24500, change: 5.20, changePercent: 0.57, lastUpdated: now },
    exchangeRate: { rate: 83.5, change: 0.04, changePercent: 0.05, lastUpdated: now }
  };
}
