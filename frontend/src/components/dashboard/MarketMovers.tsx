'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { TrendingUp, TrendingDown } from 'lucide-react';

let socket: Socket | null = null;
function getSocket(): Socket {
    if (!socket) {
        socket = io('http://localhost:3001', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            timeout: 10000,
        });
    }
    return socket;
}

const STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance' },
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

type QuoteData = { symbol: string; name: string; price: number; dayChange: number; change: number };

function resolveMoverQuote(quotes: Record<string, QuoteData>, symbol: string): QuoteData | undefined {
    const upper = symbol.toUpperCase();
    const bare = upper.replace(/\.(NS|BO)$/i, '');
    return quotes[upper] || quotes[bare] || quotes[`${bare}.NS`];
}

export default function MarketMovers() {
    const router = useRouter();
    const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
    const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');

    useEffect(() => {
        const s = getSocket();
        STOCKS.forEach(st => s.emit('subscribe', st.symbol));

        s.on('market_update', (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    const normalizedSym = sym.endsWith('.NS') ? sym : `${sym}.NS`;
                    const meta = STOCKS.find(s => s.symbol === sym) || STOCKS.find(s => s.symbol === normalizedSym);
                    if (meta && typeof d?.price === 'number') {
                        next[meta.symbol] = { symbol: meta.symbol, name: meta.name, price: d.price, dayChange: d.dayChange ?? 0, change: d.change ?? 0 };
                    }
                });
                return next;
            });
        });

        return () => { s.off('market_update'); };
    }, []);

    const resolved = STOCKS
        .map(st => resolveMoverQuote(quotes, st.symbol))
        .filter((q): q is QuoteData => Boolean(q));

    const sorted = resolved
        .sort((a, b) => tab === 'gainers' ? b.dayChange - a.dayChange : a.dayChange - b.dayChange)
        .slice(0, 5);

    return (
        <div className="bg-white rounded-[16px] border border-gray-200/80 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-[16px] font-semibold text-[#3b4252]">Market Movers</h2>
                <div className="flex bg-gray-100 rounded-xl p-0.5">
                    <button
                        onClick={() => setTab('gainers')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === 'gainers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                        Top Gainers
                    </button>
                    <button
                        onClick={() => setTab('losers')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === 'losers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                        Top Losers
                    </button>
                </div>
            </div>

            <div className="divide-y divide-gray-50">
                {sorted.length > 0 ? sorted.map((q, idx) => {
                    const isUp = q.dayChange >= 0;
                    return (
                        <div
                            key={q.symbol}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                            onClick={() => router.push(`/stock/${encodeURIComponent(q.symbol)}`)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-300 w-4">{idx + 1}</span>
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 group-hover:text-[#00b386] transition-colors">
                                    {q.symbol.replace('.NS', '').substring(0, 2)}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 group-hover:text-[#00b386] transition-colors">{q.name}</p>
                                    <p className="text-[10px] text-gray-400">₹{q.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl ${
                                isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                            }`}>
                                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                            </span>
                        </div>
                    );
                }) : (
                    // Skeleton
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded-xl animate-pulse" />
                                <div className="space-y-1">
                                    <div className="w-24 h-3.5 bg-gray-100 rounded animate-pulse" />
                                    <div className="w-16 h-3 bg-gray-100 rounded animate-pulse" />
                                </div>
                            </div>
                            <div className="w-16 h-7 bg-gray-100 rounded-xl animate-pulse" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
