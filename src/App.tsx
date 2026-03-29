/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Coins, 
  History, 
  Calculator,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { fetchLivePrices, getCachedData, MarketData } from './services/marketService';
import { cn } from './lib/utils';

// Mock historical data for the chart
const generateMockHistory = (basePrice: number) => {
  return Array.from({ length: 10 }, (_, i) => ({
    time: `${i + 1}h ago`,
    price: basePrice + (Math.random() - 0.5) * (basePrice * 0.01)
  })).reverse();
};

import { historyData } from './data/historyData';

export default function App() {
  const [data, setData] = useState<MarketData | null>(() => getCachedData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [currency, setCurrency] = useState<'USD' | 'INR'>('INR');
  const [selectedHistoryMetal, setSelectedHistoryMetal] = useState<'gold' | 'silver' | 'platinum' | 'usd_inr'>('gold');
  const [calculator, setCalculator] = useState({ amount: 1, metal: 'gold' as keyof Omit<MarketData, 'exchangeRate' | 'isLive' | 'error' | 'dataAgeSeconds'>, unit: 'g' as 'g' | 'oz' | 'kg' | 'tola' });
  const [historyRange, setHistoryRange] = useState<number>(360);
  const isFetching = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const prices = await fetchLivePrices();
      setData(prices);
      setLastRefresh(new Date());
    } catch (err) {
      if (!silent) setError('Failed to fetch live market data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    // If we already have stale data from localStorage, fetch silently in background
    const hasCached = data !== null;
    loadData(hasCached); // silent if cached data is present
    // Auto-refresh every 90 seconds to keep data fresh
    const interval = setInterval(() => loadData(true), 90_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const goldHistory = data ? generateMockHistory(currency === 'USD' ? data.gold.priceUsd : data.gold.priceInr) : [];
  const silverHistory = data ? generateMockHistory(currency === 'USD' ? data.silver.priceUsd : data.silver.priceInr) : [];
  const platinumHistory = data ? generateMockHistory(currency === 'USD' ? data.platinum.priceUsd : data.platinum.priceInr) : [];
  const usdInrHistory = data ? generateMockHistory(data.exchangeRate.rate) : [];

  const detailedHistory = React.useMemo(() => {
    if (!data) return [];
    
    const rawHistory = historyData[selectedHistoryMetal === 'usd_inr' ? 'usd_inr' : selectedHistoryMetal];
    const currentPrice = selectedHistoryMetal === 'usd_inr' 
      ? data.exchangeRate.rate 
      : (currency === 'USD' ? data[selectedHistoryMetal].priceUsd : data[selectedHistoryMetal].priceInr);
    
    // Slice based on historyRange
    const slicedHistory = rawHistory.slice(-historyRange);
    const slicedUsdInr = historyData.usd_inr.slice(-historyRange);

    return slicedHistory.map((point, idx) => {
      let price = point.price;
      if (selectedHistoryMetal !== 'usd_inr' && currency === 'INR') {
        // Approximate historical INR conversion using the historical USD/INR rate
        const historicalRate = slicedUsdInr[idx]?.price || 83.5;
        if (selectedHistoryMetal === 'silver') {
          price = point.price * historicalRate * 32.1507; // Silver per kg
        } else {
          price = point.price * historicalRate / 3.11035; // Gold/Platinum per 10g
        }
      }
      
      // Adjust the last point to match current live price
      if (idx === slicedHistory.length - 1) {
        price = currentPrice;
      }

      return {
        date: point.label,
        price: price,
      };
    });
  }, [data, selectedHistoryMetal, currency, historyRange]);

  const calculateValue = () => {
    if (!data) return "0";
    
    let price = 0;
    if (currency === 'USD') {
      price = data[calculator.metal].priceUsd;
      // USD price is per ounce
      let weightInOz = calculator.amount;
      if (calculator.unit === 'g') weightInOz = calculator.amount / 31.1035;
      if (calculator.unit === 'kg') weightInOz = calculator.amount * 32.1507;
      if (calculator.unit === 'tola') weightInOz = (calculator.amount * 11.66) / 31.1035;
      return (weightInOz * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      // INR Logic
      if (calculator.metal !== 'silver') {
        // Price is per 10g for Gold, Platinum
        const pricePerGram = data[calculator.metal].priceInr / 10;
        let weightInGrams = calculator.amount;
        if (calculator.unit === 'oz') weightInGrams = calculator.amount * 31.1035;
        if (calculator.unit === 'kg') weightInGrams = calculator.amount * 1000;
        if (calculator.unit === 'tola') weightInGrams = calculator.amount * 11.66;
        return (weightInGrams * pricePerGram).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        // Silver price is per 1kg
        const pricePerGram = data.silver.priceInr / 1000;
        let weightInGrams = calculator.amount;
        if (calculator.unit === 'oz') weightInGrams = calculator.amount * 31.1035;
        if (calculator.unit === 'kg') weightInGrams = calculator.amount * 1000;
        if (calculator.unit === 'tola') weightInGrams = calculator.amount * 11.66;
        return (weightInGrams * pricePerGram).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans selection:bg-yellow-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
            </div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight whitespace-nowrap">AR-<span className="text-yellow-500">AuAgPt</span></h1>
            {data && (
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                data.isLive ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
              )}>
                <div className={cn("w-1 h-1 rounded-full", data.isLive ? "bg-green-500 animate-pulse" : "bg-orange-500")} />
                {data.isLive ? "Live" : "Demo"}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex bg-white/5 rounded-lg p-0.5 sm:p-1 border border-white/10">
              <button 
                onClick={() => setCurrency('USD')}
                className={cn(
                  "px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                  currency === 'USD' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                USD
              </button>
              <button 
                onClick={() => setCurrency('INR')}
                className={cn(
                  "px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                  currency === 'INR' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                INR
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-white/40">
              <Clock className="w-3 h-3" />
              <span>Updated: {lastRefresh.toLocaleTimeString()}</span>
              {data?.dataAgeSeconds !== undefined && data.dataAgeSeconds >= 0 && (
                <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/30 text-[10px]">
                  cache {data.dataAgeSeconds < 5 ? 'fresh' : `${data.dataAgeSeconds}s old`}
                </span>
              )}
            </div>
            <button 
              onClick={() => loadData(false)}
              disabled={loading}
              className="p-1.5 sm:p-2 hover:bg-white/5 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4 sm:w-5 sm:h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {(error || (data && !data.isLive)) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-xl flex items-center gap-3 text-sm",
              error ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-orange-500/10 border border-orange-500/20 text-orange-400"
            )}
          >
            <Info className="w-5 h-5 shrink-0" />
            <p>{error || data?.error}</p>
          </motion.div>
        )}

        {/* Price Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PriceCard 
            title="Gold" 
            price={currency === 'USD' ? data?.gold.priceUsd : data?.gold.priceInr} 
            change={data?.gold.change} 
            percent={data?.gold.changePercent}
            history={goldHistory}
            color="yellow"
            loading={loading}
            currency={currency}
            unit={currency === 'INR' ? '10g' : 'oz'}
            onClick={() => setSelectedHistoryMetal('gold')}
            isActive={selectedHistoryMetal === 'gold'}
          />
          
          <PriceCard 
            title="Silver" 
            price={currency === 'USD' ? data?.silver.priceUsd : data?.silver.priceInr} 
            change={data?.silver.change} 
            percent={data?.silver.changePercent}
            history={silverHistory}
            color="slate"
            loading={loading}
            currency={currency}
            unit={currency === 'INR' ? 'kg' : 'oz'}
            onClick={() => setSelectedHistoryMetal('silver')}
            isActive={selectedHistoryMetal === 'silver'}
          />

          <PriceCard 
            title="Platinum" 
            price={currency === 'USD' ? data?.platinum.priceUsd : data?.platinum.priceInr} 
            change={data?.platinum.change} 
            percent={data?.platinum.changePercent}
            history={platinumHistory}
            color="blue"
            loading={loading}
            currency={currency}
            unit={currency === 'INR' ? '10g' : 'oz'}
            onClick={() => setSelectedHistoryMetal('platinum')}
            isActive={selectedHistoryMetal === 'platinum'}
          />

          <PriceCard 
            title="USD / INR" 
            price={data?.exchangeRate.rate} 
            change={data?.exchangeRate.change} 
            percent={data?.exchangeRate.changePercent}
            history={usdInrHistory}
            color="emerald"
            loading={loading}
            currency={currency}
            unit="Rate"
            onClick={() => setSelectedHistoryMetal('usd_inr')}
            isActive={selectedHistoryMetal === 'usd_inr'}
          />
        </div>

        {/* Detailed History Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold capitalize">{selectedHistoryMetal.replace('_', ' ')} Price History</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                  {[
                    { label: '1Y', value: 12 },
                    { label: '3Y', value: 36 },
                    { label: '5Y', value: 60 },
                    { label: '10Y', value: 120 },
                    { label: '20Y', value: 240 },
                    { label: '25Y', value: 300 },
                    { label: 'All', value: 360 }
                  ].map((range) => (
                    <button 
                      key={range.label}
                      onClick={() => setHistoryRange(range.value)}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                        historyRange === range.value ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                      )}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-white/40 whitespace-nowrap">
                  Monthly in {selectedHistoryMetal === 'usd_inr' ? 'INR' : currency}
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={detailedHistory}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#ffffff20" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    interval={Math.max(0, Math.floor(historyRange / 10))} // Dynamic interval
                  />
                  <YAxis 
                    stroke="#ffffff20" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${selectedHistoryMetal === 'usd_inr' ? '₹' : (currency === 'INR' ? '₹' : '$')}${value > 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181B', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#EAB308' }}
                    formatter={(value: number) => [value.toLocaleString(undefined, { maximumFractionDigits: 2 }), 'Price']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#EAB308" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Historical Milestones
            </h3>
            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {detailedHistory.filter((_, i) => i % 12 === 0).slice().reverse().map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div>
                    <div className="text-xs font-medium text-white/80">{item.date}</div>
                    <div className="text-[10px] text-white/40">Yearly Snapshot</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{selectedHistoryMetal === 'usd_inr' ? '₹' : (currency === 'INR' ? '₹' : '$')}{item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calculator */}
          <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Value Calculator</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Metal Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['gold', 'silver', 'platinum'] as const).map((m) => (
                    <button 
                      key={m}
                      onClick={() => setCalculator(c => ({ ...c, metal: m }))}
                      className={cn(
                        "py-2 rounded-lg text-[10px] font-medium border transition-all capitalize",
                        calculator.metal === m 
                          ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500" 
                          : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex-1">
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Weight</label>
                  <input 
                    type="number" 
                    value={calculator.amount}
                    onChange={(e) => setCalculator(c => ({ ...c, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-yellow-500/50 transition-colors"
                    placeholder="0.00"
                  />
                </div>
                <div className="w-24 relative">
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Unit</label>
                  <div className="relative">
                    <select 
                      value={calculator.unit}
                      onChange={(e) => setCalculator(c => ({ ...c, unit: e.target.value as any }))}
                      className="w-full bg-white/10 border border-white/10 rounded-lg pl-2 pr-8 py-2.5 outline-none focus:border-yellow-500/50 transition-colors text-sm appearance-none cursor-pointer"
                    >
                      <option value="g" className="bg-[#18181B] text-white">Gram</option>
                      <option value="oz" className="bg-[#18181B] text-white">Ounce</option>
                      <option value="kg" className="bg-[#18181B] text-white">KG</option>
                      <option value="tola" className="bg-[#18181B] text-white">Tola (11.66g)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Estimated Value</div>
                <div className="text-3xl font-bold text-white">
                  {currency === 'INR' ? '₹' : '$'}{calculateValue()} <span className="text-sm text-white/40 font-normal">{currency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Market Sentiment / Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">Market Insights</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-sm font-medium text-white/80 mb-1">USD/INR Rate</h3>
                    <div className="text-2xl font-bold">
                      {data ? `₹${data.exchangeRate.rate.toFixed(2)}` : '--'}
                    </div>
                    <p className="text-xs text-white/40 mt-1">Current exchange rate for currency conversion.</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 className="text-sm font-medium text-white/80 mb-1">Market Status</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Live Market</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 text-sm text-white/60 leading-relaxed">
                  <p>
                    In India, high-value metals like gold and platinum are typically quoted per 10 grams, while silver is quoted per kilogram. 
                    The traditional "Tola" (approx. 11.66g) is also widely used in local jewelry markets.
                  </p>
                  <p>
                    Note: Local prices in India may vary slightly due to import duties (GST) and local taxes which are not included in these spot rates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-white/10 text-center text-white/20 text-xs">
        <p>© 2026 AR-AuAgPt. Powered by Gemini AI. Not financial advice.</p>
      </footer>
    </div>
  );
}

interface PriceCardProps {
  title: string;
  price?: number;
  change?: number;
  percent?: number;
  history: any[];
  color: 'yellow' | 'slate' | 'blue' | 'emerald';
  loading: boolean;
  currency: 'USD' | 'INR';
  unit: string;
  onClick?: () => void;
  isActive?: boolean;
}

function PriceCard({ title, price, change, percent, history, color, loading, currency, unit, onClick, isActive }: PriceCardProps) {
  const isPositive = (change || 0) >= 0;
  const accentColor = {
    yellow: '#EAB308',
    slate: '#94A3B8',
    blue: '#3B82F6',
    emerald: '#10B981'
  }[color];
  const symbol = currency === 'INR' ? '₹' : '$';

  return (
    <motion.div 
      layout
      onClick={onClick}
      className={cn(
        "bg-white/5 border rounded-2xl overflow-hidden relative group cursor-pointer transition-all duration-300",
        isActive ? "border-yellow-500/50 ring-1 ring-yellow-500/20" : "border-white/10 hover:border-white/20"
      )}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-4 rounded-full", {
              'bg-yellow-500': color === 'yellow',
              'bg-slate-400': color === 'slate',
              'bg-blue-500': color === 'blue',
              'bg-emerald-500': color === 'emerald'
            })} />
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          <div className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5",
            isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          )}>
            {percent ? `${Math.abs(percent).toFixed(1)}%` : '--%'}
          </div>
        </div>

        <div className="flex flex-col mb-4">
          <div className="flex items-baseline gap-1.5">
            <AnimatePresence mode="wait">
              <motion.span 
                key={price}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold tracking-tighter"
              >
                {price ? `${title === 'USD / INR' ? '₹' : symbol}${price.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${symbol}--`}
              </motion.span>
            </AnimatePresence>
            <span className="text-[10px] text-white/30 font-normal">/{unit}</span>
          </div>
        </div>

        <div className="h-[40px] w-full -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={accentColor} 
                strokeWidth={1.5}
                fillOpacity={1} 
                fill={`url(#gradient-${color})`} 
                isAnimationActive={!loading}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <RefreshCw className="w-4 h-4 animate-spin text-white/20" />
        </div>
      )}
    </motion.div>
  );
}
