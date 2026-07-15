'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { TrendingUp, TrendingDown, ArrowUpRight, RefreshCw } from 'lucide-react';
import MarketMovers from './MarketMovers';
import DashboardNews from './DashboardNews';

const INDEX_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY'];
const INDEX_LABELS: Record<string, string> = { 
    '^NSEI': 'NIFTY 50', 
    '^BSESN': 'SENSEX', 
    '^NSEBANK': 'BANKNIFTY', 
    '^MIDCPNIFTY': 'MIDCPNIFTY', 
    '^FINNIFTY': 'FINNIFTY' 
};

const TOP_STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
    { symbol: 'TCS.NS', name: 'TCS' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    { symbol: 'INFY.NS', name: 'Infosys' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
    { symbol: 'SBIN.NS', name: 'SBI' },
    { symbol: 'ITC.NS', name: 'ITC' },
    { symbol: 'AXISBANK.NS', name: 'Axis Bank' },
    { symbol: 'WIPRO.NS', name: 'Wipro' },
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance' },
];

type QuoteData = { symbol: string; price: number; change: number; dayChange: number; shortname?: string };

function normalizeQuote(sym: string, d: any): QuoteData | null {
    if (typeof d?.price !== 'number') return null;
    return {
        symbol: sym,
        price: d.price,
        change: d.change ?? 0,
        dayChange: d.dayChange ?? 0,
        shortname: d.shortname,
    };
}

function resolveQuote(quotes: Record<string, QuoteData>, symbol: string): QuoteData | undefined {
    const upper = symbol.toUpperCase();
    const bare = upper.replace(/\.(NS|BO)$/i, '');
    return quotes[upper] || quotes[bare] || quotes[`${bare}.NS`];
}

export default function DashboardMarket() {
    const router = useRouter();
    const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const s = getSocket();
        const allSymbols = [...INDEX_SYMBOLS, ...TOP_STOCKS.map(s => s.symbol)];
        allSymbols.forEach(sym => s.emit('subscribe', sym));

        const onUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    const q = normalizeQuote(sym, d);
                    if (!q) return;
                    next[sym] = q;

                    // Handle both symbol forms from backend broadcasts (RELIANCE and RELIANCE.NS)
                    if (!sym.startsWith('^')) {
                        if (sym.endsWith('.NS')) {
                            next[sym.replace(/\.NS$/i, '')] = { ...q, symbol: sym.replace(/\.NS$/i, '') };
                        } else {
                            next[`${sym}.NS`] = { ...q, symbol: `${sym}.NS` };
                        }
                    }
                });
                return next;
            });
            setLastUpdated(new Date());
        };

        const onPriceTick = (tick: Record<string, any>) => {
            if (typeof tick?.symbol !== 'string') return;
            const q = normalizeQuote(tick.symbol, tick);
            if (!q) return;

            setQuotes(prev => {
                const next = { ...prev };
                next[tick.symbol] = q;
                if (!tick.symbol.startsWith('^')) {
                    if (tick.symbol.endsWith('.NS')) {
                        next[tick.symbol.replace(/\.NS$/i, '')] = { ...q, symbol: tick.symbol.replace(/\.NS$/i, '') };
                    } else {
                        next[`${tick.symbol}.NS`] = { ...q, symbol: `${tick.symbol}.NS` };
                    }
                }
                return next;
            });
            setLastUpdated(new Date());
        };

        s.on('market_update', onUpdate);
        s.on('price_tick', onPriceTick);

        const hydrateQuotes = async () => {
            try {
                const [indicesRes, ...stockRes] = await Promise.all([
                    fetch('http://localhost:3001/api/indices').then(r => r.ok ? r.json() : null).catch(() => null),
                    ...TOP_STOCKS.map(st =>
                        fetch(`http://localhost:3001/api/stock/${encodeURIComponent(st.symbol)}/realtime`)
                            .then(r => r.ok ? r.json() : null)
                            .catch(() => null)
                    ),
                ]);

                setQuotes(prev => {
                    const next = { ...prev };

                    if (indicesRes) {
                        Object.entries(indicesRes).forEach(([sym, d]: [string, any]) => {
                            const q = normalizeQuote(sym, d);
                            if (q) next[sym] = q;
                        });
                    }

                    stockRes.forEach((d: any) => {
                        const sym = String(d?.symbol || '').toUpperCase();
                        if (!sym || typeof d?.price !== 'number') return;
                        const key = sym.endsWith('.NS') ? sym : `${sym}.NS`;
                        next[key] = {
                            symbol: key,
                            price: d.price,
                            change: d.change ?? 0,
                            dayChange: d.dayChange ?? 0,
                            shortname: key,
                        };
                    });

                    return next;
                });

                setLastUpdated(new Date());
            } catch {
                // silent fallback failure
            }
        };

        hydrateQuotes();

        const refreshTimer = setInterval(() => {
            hydrateQuotes();
        }, 8000);

        return () => {
            s.off('market_update', onUpdate);
            s.off('price_tick', onPriceTick);
            clearInterval(refreshTimer);
        };
    }, []);


    const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const fmtLarge = (n: number) => {
        if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
        if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
        return n.toLocaleString('en-IN');
    };

    return (
        <div className="space-y-8">
            {/* Market Indices */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-semibold text-[#3b4252]">Market Overview</h2>
                    {lastUpdated && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <div className="w-1.5 h-1.5 bg-[#00b386] rounded-full animate-pulse" />
                            Live · {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {INDEX_SYMBOLS.map(sym => {
                        const q = resolveQuote(quotes, sym);
                        const isUp = (q?.change ?? 0) >= 0;
                        return (
                            <Link href={`/stock/${encodeURIComponent(sym)}`} key={sym} className="block group">
                                <div className="bg-white rounded-[16px] border border-gray-200/80 p-4 group-hover:shadow-md group-hover:border-blue-200 transition-all h-full cursor-pointer flex flex-col justify-center">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 group-hover:text-blue-500 transition-colors">{INDEX_LABELS[sym]}</p>
                                    {q ? (
                                        <>
                                            <p className="text-[20px] font-bold text-[#3b4252] tracking-tight">{fmt(q.price)}</p>
                                            <div className={`flex items-center gap-1 mt-0.5 ${isUp ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                <span className="text-[12px] font-medium tracking-tight">
                                                    {isUp ? '+' : ''}{fmt(q.change)} ({isUp ? '+' : ''}{q.dayChange.toFixed(2)}%)
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-10 flex items-center">
                                            <div className="w-16 h-4 bg-gray-100 rounded-md animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* Top Stocks */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-semibold text-[#3b4252]">Top Stocks</h2>
                    <button className="text-[13px] text-[#00b386] hover:underline font-medium">View all →</button>
                </div>
                <div className="bg-white rounded-[16px] border border-gray-200/80 overflow-hidden shadow-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        <div className="col-span-5">Company</div>
                        <div className="col-span-3 text-right">Price</div>
                        <div className="col-span-2 text-right">Change</div>
                        <div className="col-span-2 text-right">Action</div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {TOP_STOCKS.map(stock => {
                            const q = resolveQuote(quotes, stock.symbol);
                            const isUp = (q?.change ?? 0) >= 0;
                            const initials = stock.symbol.replace('.NS', '').substring(0, 2);
                            return (
                                <div
                                    key={stock.symbol}
                                    className="grid grid-cols-12 px-5 py-4 items-center hover:bg-gray-50/60 transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/stock/${encodeURIComponent(stock.symbol)}`)}
                                >
                                    <div className="col-span-5 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:from-[#00b386]/10 group-hover:to-[#00b386]/20 group-hover:text-[#00b386] transition-all flex-shrink-0">
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#00b386] transition-colors">{stock.name}</p>
                                            <p className="text-xs text-gray-400">{stock.symbol.replace('.NS', '')} · NSE</p>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-right">
                                        {q ? (
                                            <p className="text-sm font-bold text-gray-900">₹{fmt(q.price)}</p>
                                        ) : (
                                            <div className="w-16 h-4 bg-gray-100 rounded animate-pulse ml-auto" />
                                        )}
                                    </div>
                                    <div className="col-span-2 text-right">
                                        {q ? (
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${isUp ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                                {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                            </span>
                                        ) : (
                                            <div className="w-12 h-5 bg-gray-100 rounded animate-pulse ml-auto" />
                                        )}
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        <button
                                            id={`buy-btn-${stock.symbol}`}
                                            onClick={e => { e.stopPropagation(); router.push(`/stock/${encodeURIComponent(stock.symbol)}`); }}
                                            className="px-3 py-1.5 text-xs font-semibold text-[#00b386] border border-[#00b386] rounded-lg hover:bg-[#00b386] hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            Buy
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Market Movers */}
            <section>
                <MarketMovers />
            </section>

            {/* AI Stock News */}
            <section>
                <DashboardNews />
            </section>
        </div>
    );
}
