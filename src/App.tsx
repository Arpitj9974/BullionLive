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
import { historyData } from './data/historyData';

export default function App() {
  const [data, setData] = useState<MarketData | null>(() => getCachedData());
  const [loading, setLoading] = useState(!getCachedData());
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('INR');
  const [selectedHistoryMetal, setSelectedHistoryMetal] = useState<'gold' | 'silver' | 'platinum' | 'usd_inr'>('gold');
  const [calculator, setCalculator] = useState({ amount: 1, metal: 'gold' as keyof Omit<MarketData, 'exchangeRate' | 'isLive' | 'error' | 'dataAgeSeconds'>, unit: 'g' as 'g' | 'oz' | 'kg' | 'tola' });
  const [historyRange, setHistoryRange] = useState<number>(360);
  const [comparisonMode, setComparisonMode] = useState(false);
  const isFetching = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const prices = await fetchLivePrices();
      setData(prices);
    } catch (err) {
      if (!silent) setError('Failed to fetch live market data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    const hasCached = !!data;
    loadData(hasCached); 
    const interval = setInterval(() => loadData(true), 90_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const getNormalizedHistory = (metal: 'gold' | 'silver' | 'platinum' | 'usd_inr') => {
    if (!data) return [];
    const raw = historyData[metal === 'usd_inr' ? 'usd_inr' : metal].slice(-historyRange);
    const usdInrRaw = historyData.usd_inr.slice(-historyRange);
    const firstPoint = raw[0]?.price || 0;
    const firstUsdInr = usdInrRaw[0]?.price || 83.5;

    return raw.map((point, idx) => {
      let price = point.price;
      const currentUsdInr = usdInrRaw[idx]?.price || 83.5;

      if (metal !== 'usd_inr' && currency === 'INR') {
        if (metal === 'silver') price = point.price * currentUsdInr * 32.1507;
        else price = (point.price * currentUsdInr) / 3.11035;
      }

      // Percentage change from the first point in range
      let baseVal = firstPoint;
      if (metal !== 'usd_inr' && currency === 'INR') {
        if (metal === 'silver') baseVal = firstPoint * firstUsdInr * 32.1507;
        else baseVal = (firstPoint * firstUsdInr) / 3.11035;
      }

      return {
        date: point.label,
        price,
        percentage: baseVal === 0 ? 0 : ((price - baseVal) / baseVal) * 100
      };
    });
  };

  const currentHistory = React.useMemo(() => getNormalizedHistory(selectedHistoryMetal), [data, selectedHistoryMetal, currency, historyRange]);
  
  const comparisonData = React.useMemo(() => {
    if (!comparisonMode || !data) return [];
    const gold = getNormalizedHistory('gold');
    const silver = getNormalizedHistory('silver');
    const platinum = getNormalizedHistory('platinum');

    return gold.map((g, idx) => ({
      date: g.date,
      gold: g.percentage,
      silver: silver[idx]?.percentage || 0,
      platinum: platinum[idx]?.percentage || 0,
    }));
  }, [data, comparisonMode, currency, historyRange]);

  const calculateValue = () => {
    if (!data) return "0";
    if (currency === 'USD') {
      const price = data[calculator.metal].priceUsd;
      let weightInOz = calculator.amount;
      if (calculator.unit === 'g') weightInOz = calculator.amount / 31.1035;
      if (calculator.unit === 'kg') weightInOz = calculator.amount * 32.1507;
      if (calculator.unit === 'tola') weightInOz = (calculator.amount * 11.66) / 31.1035;
      return (weightInOz * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      if (calculator.metal !== 'silver') {
        const pricePerGram = data[calculator.metal].priceInr / 10;
        let weightInGrams = calculator.amount;
        if (calculator.unit === 'oz') weightInGrams = calculator.amount * 31.1035;
        if (calculator.unit === 'kg') weightInGrams = calculator.amount * 1000;
        if (calculator.unit === 'tola') weightInGrams = calculator.amount * 11.66;
        return (weightInGrams * pricePerGram).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
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
              {(['USD', 'INR'] as const).map((curr) => (
                <button 
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={cn(
                    "px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                    currency === curr ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                >
                  {curr}
                </button>
              ))}
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
        {/* Only show error banner for actual failures, not during background warm-up */}
        {(error && !error.includes('warm-up')) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl flex items-center gap-3 text-sm bg-red-500/10 border border-red-500/20 text-red-400"
          >
            <Info className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Price Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !data ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <PriceCard 
                title="Gold" 
                price={currency === 'USD' ? data?.gold.priceUsd : data?.gold.priceInr} 
                change={data?.gold.change} 
                percent={data?.gold.changePercent}
                history={data ? getNormalizedHistory('gold') : []}
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
                history={data ? getNormalizedHistory('silver') : []}
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
                history={data ? getNormalizedHistory('platinum') : []}
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
                history={data ? getNormalizedHistory('usd_inr') : []}
                color="emerald"
                loading={loading}
                currency={currency}
                unit="Rate"
                onClick={() => setSelectedHistoryMetal('usd_inr')}
                isActive={selectedHistoryMetal === 'usd_inr'}
              />
            </>
          )}
        </div>

        {/* Detailed History Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-semibold capitalize">
                    {comparisonMode ? "Market Comparison" : `${selectedHistoryMetal.replace('_', ' ')} Price History`}
                  </h2>
                </div>
                <button 
                  onClick={() => setComparisonMode(!comparisonMode)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                    comparisonMode 
                      ? "bg-yellow-500 text-black border-yellow-500" 
                      : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                  )}
                >
                  {comparisonMode ? "Close Comparison" : "Comparison Mode"}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                  {[
                    { label: '1Y', value: 12 },
                    { label: '3Y', value: 36 },
                    { label: '5Y', value: 60 },
                    { label: '10Y', value: 120 },
                    { label: '20Y', value: 240 },
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
                  {comparisonMode ? "Rel % Chart" : `Monthly in ${selectedHistoryMetal === 'usd_inr' ? 'INR' : currency}`}
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full relative">
              {loading && !data ? (
                <div className="absolute inset-0 bg-white/5 animate-pulse rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {comparisonMode ? (
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(historyRange / 10))} />
                      <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181B', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '11px' } }
                        itemStyle={{ padding: '2px 0' }}
                        formatter={(val: number, name: string) => [`${val.toFixed(2)}%`, name.charAt(0).toUpperCase() + name.slice(1)]}
                      />
                      <Line type="monotone" dataKey="gold" stroke="#EAB308" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="silver" stroke="#94A3B8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="platinum" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={currentHistory}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(historyRange / 10))} />
                      <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${selectedHistoryMetal === 'usd_inr' ? '₹' : (currency === 'INR' ? '₹' : '$')}${v > 1000 ? (v/1000).toFixed(1) + 'k' : v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181B', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#EAB308' }}
                        formatter={(value: number) => [value.toLocaleString(undefined, { maximumFractionDigits: 2 }), 'Price']}
                      />
                      <Area type="monotone" dataKey="price" stroke="#EAB308" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col h-[440px]">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Historical Milestones
            </h3>
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {loading && !data ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-white/5 animate-pulse rounded-xl" />)
              ) : (
                currentHistory.filter((_, i) => i % 12 === 0).slice().reverse().map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div>
                      <div className="text-xs font-medium text-white/80">{item.date}</div>
                      <div className="text-[10px] text-white/40">Market Snapshot</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{selectedHistoryMetal === 'usd_inr' ? '₹' : (currency === 'INR' ? '₹' : '$')}{item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calculator */}
          <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            {loading && !data ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 w-1/2 bg-white/10 rounded" />
                <div className="h-10 w-full bg-white/10 rounded" />
                <div className="h-20 w-full bg-white/10 rounded" />
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            {loading && !data ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-10 w-1/3 bg-white/10 rounded" />
                <div className="grid grid-cols-2 gap-6">
                   <div className="h-32 bg-white/10 rounded" />
                   <div className="h-32 bg-white/10 rounded" />
                </div>
              </div>
            ) : (
              <>
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
                      <p className="text-xs text-white/40 mt-1">Current market exchange rate.</p>
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
                      In India, prices for precious metals are subject to local taxes and customs duties. 
                      This dashboard uses global spot data fine-tuned to mirror Indian retail benchmarks (IBJA).
                    </p>
                    <p>
                      Tip: Use Comparison Mode above to see which metal is leading the market move in real-time.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-white/10 text-center text-white/20 text-xs">
        <p>© 2026 AR-AuAgPt. Powered by High-Performance Caching. Not financial advice.</p>
      </footer>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-4 w-1/3 bg-white/10 rounded" />
        <div className="h-4 w-1/4 bg-white/10 rounded" />
      </div>
      <div className="h-8 w-2/3 bg-white/10 rounded" />
      <div className="h-[40px] w-full bg-white/10 rounded" />
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
  const accentColor = { yellow: '#EAB308', slate: '#94A3B8', blue: '#3B82F6', emerald: '#10B981' }[color];
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
