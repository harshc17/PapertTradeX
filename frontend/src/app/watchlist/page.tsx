'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import { Star, TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react';

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

const DEFAULT_WATCHLIST = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
    { symbol: 'TCS.NS', name: 'TCS' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    { symbol: 'INFY.NS', name: 'Infosys' },
    { symbol: 'ZOMATO.NS', name: 'Zomato' },
];

export default function WatchlistPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const addedSymbol = (searchParams.get('added') || '').toUpperCase();
    const [watchlist, setWatchlist] = useState<{ symbol: string; name: string }[]>([]);
    const [quotes, setQuotes] = useState<Record<string, { price: number; change: number; dayChange: number }>>({});
    const [addInput, setAddInput] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading]);

    useEffect(() => {
        const saved = localStorage.getItem('ptx_watchlist');
        const list = saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
        setWatchlist(list);
        const s = getSocket();
        list.forEach((item: any) => s.emit('subscribe', item.symbol));
        const onUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    if (typeof d?.price === 'number') next[sym] = { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 };
                });
                return next;
            });
        };
        s.on('market_update', onUpdate);
        return () => { s.off('market_update', onUpdate); };
    }, []);

    const saveWatchlist = (list: { symbol: string; name: string }[]) => {
        setWatchlist(list);
        localStorage.setItem('ptx_watchlist', JSON.stringify(list));
    };

    const removeFromWatchlist = (symbol: string) => {
        saveWatchlist(watchlist.filter(w => w.symbol !== symbol));
    };

    useEffect(() => {
        if (addInput.length < 2) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(addInput)}`);
                const data = await res.json();
                setSearchResults((data.quotes || []).slice(0, 5));
            } catch { setSearchResults([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [addInput]);

    const addToWatchlist = (symbol: string, name: string) => {
        if (watchlist.find(w => w.symbol === symbol)) return;
        const updated = [...watchlist, { symbol, name }];
        saveWatchlist(updated);
        getSocket().emit('subscribe', symbol);
        setAddInput('');
        setSearchResults([]);
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-3 mb-6">
                    <Star className="w-5 h-5 text-[#00b386]" />
                    <h1 className="text-xl font-bold text-gray-900">My Watchlist</h1>
                </div>

                {/* Add to Watchlist */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Add a stock</label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={addInput}
                            onChange={e => setAddInput(e.target.value)}
                            placeholder="Search by name or symbol (e.g. HDFC, Infosys)"
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b386]/20 focus:border-[#00b386] transition-all"
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-5 right-5 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                            {searchResults.map((r: any, i) => (
                                <div
                                    key={`${r.symbol}-${i}`}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                    onClick={() => addToWatchlist(r.symbol, r.shortname || r.symbol)}
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{r.shortname || r.symbol}</p>
                                        <p className="text-xs text-gray-400">{r.symbol}</p>
                                    </div>
                                    <span className="flex items-center gap-1 text-xs text-[#00b386] font-medium">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Watchlist */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    {watchlist.length === 0 ? (
                        <div className="p-12 text-center">
                            <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400">Your watchlist is empty. Add stocks above.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {watchlist.map(item => {
                                const q = quotes[item.symbol];
                                const isUp = (q?.change ?? 0) >= 0;
                                const isAdded = addedSymbol && item.symbol.toUpperCase() === addedSymbol;
                                return (
                                    <div
                                        key={item.symbol}
                                        className={`flex items-center justify-between px-5 py-4 transition-colors group ${
                                            isAdded
                                                ? 'bg-[#00b386]/10 ring-1 ring-inset ring-[#00b386]/25'
                                                : 'hover:bg-gray-50/60'
                                        }`}
                                    >
                                        <div
                                            className="flex items-center gap-3 flex-1 cursor-pointer"
                                            onClick={() => router.push(`/stock/${encodeURIComponent(item.symbol)}`)}
                                        >
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                {item.symbol.replace('.NS', '').substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#00b386] transition-colors">{item.name}</p>
                                                <p className="text-xs text-gray-400">{item.symbol} · NSE</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {q ? (
                                                <>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-gray-900">₹{fmt(q.price)}</p>
                                                        <div className={`flex items-center gap-1 justify-end text-xs font-semibold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                                                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                            {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                                        {isUp ? '+' : ''}{q.change.toFixed(2)}
                                                    </span>
                                                </>
                                            ) : (
                                                <div className="w-20 h-8 bg-gray-100 rounded-xl animate-pulse" />
                                            )}
                                            <button
                                                onClick={() => removeFromWatchlist(item.symbol)}
                                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
