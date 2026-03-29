
export interface HistoryPoint {
  label: string;
  price: number;
  date: string;
}

export interface HistoricalData {
  gold: HistoryPoint[];
  silver: HistoryPoint[];
  platinum: HistoryPoint[];
  usd_inr: HistoryPoint[];
}

interface AnchorPoint {
  year: number;
  month: number;
  price: number;
}

const interpolate = (start: AnchorPoint, end: AnchorPoint, year: number, month: number) => {
  const startTotalMonths = start.year * 12 + start.month;
  const endTotalMonths = end.year * 12 + end.month;
  const currentTotalMonths = year * 12 + month;
  
  const progress = (currentTotalMonths - startTotalMonths) / (endTotalMonths - startTotalMonths);
  return start.price + (end.price - start.price) * progress;
};

const generate30YearMonthlyData = (): HistoricalData => {
  const data: HistoricalData = { gold: [], silver: [], platinum: [], usd_inr: [] };
  
  const anchors = {
    gold: [
      { year: 1996, month: 0, price: 400 },
      { year: 2000, month: 0, price: 280 },
      { year: 2005, month: 0, price: 440 },
      { year: 2008, month: 2, price: 950 },
      { year: 2011, month: 8, price: 1900 },
      { year: 2015, month: 11, price: 1060 },
      { year: 2020, month: 7, price: 2050 },
      { year: 2022, month: 0, price: 1800 },
      { year: 2024, month: 0, price: 2050 },
      { year: 2025, month: 0, price: 2700 },
      { year: 2026, month: 2, price: 4500 }
    ],
    silver: [
      { year: 1996, month: 0, price: 5.2 },
      { year: 2000, month: 0, price: 5.0 },
      { year: 2005, month: 0, price: 6.5 },
      { year: 2008, month: 2, price: 19 },
      { year: 2011, month: 3, price: 48 },
      { year: 2015, month: 11, price: 14 },
      { year: 2020, month: 7, price: 28 },
      { year: 2024, month: 0, price: 23 },
      { year: 2025, month: 0, price: 29 },
      { year: 2026, month: 2, price: 32 }
    ],
    platinum: [
      { year: 1996, month: 0, price: 400 },
      { year: 2000, month: 0, price: 430 },
      { year: 2005, month: 0, price: 850 },
      { year: 2008, month: 2, price: 2200 },
      { year: 2009, month: 0, price: 800 },
      { year: 2011, month: 0, price: 1750 },
      { year: 2016, month: 0, price: 850 },
      { year: 2020, month: 0, price: 950 },
      { year: 2024, month: 0, price: 900 },
      { year: 2026, month: 2, price: 992 }
    ],
    usd_inr: [
      { year: 1996, month: 0, price: 35 },
      { year: 2000, month: 0, price: 43.5 },
      { year: 2005, month: 0, price: 43.5 },
      { year: 2008, month: 0, price: 39 },
      { year: 2011, month: 0, price: 45 },
      { year: 2014, month: 0, price: 62 },
      { year: 2018, month: 0, price: 64 },
      { year: 2020, month: 0, price: 71 },
      { year: 2024, month: 0, price: 83 },
      { year: 2025, month: 0, price: 87 },
      { year: 2026, month: 2, price: 94.83 }
    ]
  };

  const startYear = 1996;
  const endYear = 2026;

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      if (year === endYear && month > 2) break;

      const date = new Date(year, month, 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const seed = year * 12 + month;
      const noise = (s: number) => (Math.sin(s) * 0.02); // Small 2% noise for realism

      const getPrice = (metalAnchors: AnchorPoint[]) => {
        let start = metalAnchors[0];
        let end = metalAnchors[metalAnchors.length - 1];
        
        for (let i = 0; i < metalAnchors.length - 1; i++) {
          const a1 = metalAnchors[i];
          const a2 = metalAnchors[i+1];
          const currentMonths = year * 12 + month;
          const a1Months = a1.year * 12 + a1.month;
          const a2Months = a2.year * 12 + a2.month;
          
          if (currentMonths >= a1Months && currentMonths <= a2Months) {
            start = a1;
            end = a2;
            break;
          }
        }
        
        const base = interpolate(start, end, year, month);
        return base * (1 + noise(seed));
      };

      data.gold.push({ label, price: parseFloat(getPrice(anchors.gold).toFixed(2)), date: date.toISOString() });
      data.silver.push({ label, price: parseFloat(getPrice(anchors.silver).toFixed(2)), date: date.toISOString() });
      data.platinum.push({ label, price: parseFloat(getPrice(anchors.platinum).toFixed(2)), date: date.toISOString() });
      data.usd_inr.push({ label, price: parseFloat(getPrice(anchors.usd_inr).toFixed(2)), date: date.toISOString() });
    }
  }
  return data;
};

export const historyData = generate30YearMonthlyData();
