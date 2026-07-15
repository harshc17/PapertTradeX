'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import Header from '@/components/dashboard/Header';
import { TrendingUp, TrendingDown, Search, Filter } from 'lucide-react';

const ETFS = [
    { symbol: 'NIFTYBEES.NS', name: 'Nippon India ETF Nifty BeES', category: 'Equity' },
    { symbol: 'BANKBEES.NS', name: 'Nippon India ETF Bank BeES', category: 'Sectoral' },
    { symbol: 'ITBEES.NS', name: 'Nippon India ETF IT BeES', category: 'Sectoral' },
    { symbol: 'GOLDBEES.NS', name: 'Nippon India ETF Gold BeES', category: 'Commodity' },
    { symbol: 'LIQUIDBEES.NS', name: 'Nippon India ETF Liquid BeES', category: 'Debt' },
    { symbol: 'MON100.NS', name: 'Motilal Oswal Nasdaq 100 ETF', category: 'Global' },
    { symbol: 'CPSEETF.NS', name: 'CPSE ETF', category: 'Thematic' },
    { symbol: 'SETFNIF50.NS', name: 'SBI ETF Nifty 50', category: 'Equity' },
    { symbol: 'ICICINIFTY.NS', name: 'ICICI Prudential Nifty ETF', category: 'Equity' },
    { symbol: 'KOTAKBKETF.NS', name: 'Kotak Banking ETF', category: 'Sectoral' },
];

type QuoteData = { symbol: string; price: number; change: number; dayChange: number };

export default function EtfScreenerPage() {
    const router = useRouter();
    const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchResults, setSearchResults] = useState<typeof ETFS>([]);
    const subbedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const s = getSocket();

        const onUpdate = (payload: Record<string, any>) => {
            setQuotes(prev => {
                const next = { ...prev };
                Object.entries(payload).forEach(([sym, d]: [string, any]) => {
                    const normalizedSym = sym.endsWith('.NS') ? sym : `${sym}.NS`;
                    if (typeof d?.price === 'number') {
                        next[normalizedSym] = {
                            symbol: normalizedSym,
                            price: d.price,
                            change: d.change ?? 0,
                            dayChange: d.dayChange ?? 0,
                        };
                    }
                });
                return next;
            });
        };

        s.on('market_update', onUpdate);

        return () => {
            s.off('market_update', onUpdate);
        };
    }, []);

    // API Search Effect
    useEffect(() => {
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const controller = new AbortController();
        fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (data.quotes) {
                    const results = data.quotes.map((q: any) => ({
                        symbol: q.symbol,
                        name: q.shortname || q.name || q.symbol,
                        category: q.exchange || 'ETF'
                    }));
                    setSearchResults(results);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('Search error:', err);
            });

        return () => controller.abort();
    }, [searchTerm]);

    const categories = ['All', ...Array.from(new Set(ETFS.map(e => e.category)))];

    const filteredETFs = searchTerm.length >= 2 
        ? searchResults 
        : ETFS.filter(etf => {
            const matchesSearch = etf.name.toLowerCase().includes(searchTerm.toLowerCase()) || etf.symbol.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || etf.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });

    // Dynamic subscription for new symbols
    useEffect(() => {
        const s = getSocket();
        
        filteredETFs.forEach(etf => {
            if (!subbedRef.current.has(etf.symbol)) {
                subbedRef.current.add(etf.symbol);
                s.emit('subscribe', etf.symbol);
                
                fetch(`http://localhost:3001/api/stock/${encodeURIComponent(etf.symbol)}/realtime`)
                    .then(r => r.ok ? r.json() : null)
                    .then(d => {
                        if (d && typeof d.price === 'number') {
                            setQuotes(prev => ({
                                ...prev,
                                [etf.symbol]: {
                                    symbol: etf.symbol,
                                    price: d.price,
                                    change: d.change ?? 0,
                                    dayChange: d.dayChange ?? 0,
                                }
                            }));
                        }
                    })
                    .catch(() => null);
            }
        });
    }, [filteredETFs]);

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold text-[#3b4252]">ETF Screener</h1>
                        <p className="text-gray-500 text-sm mt-1">Discover and track top performing Exchange Traded Funds</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search all ETFs..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00b386]/20 focus:border-[#00b386] w-full md:w-64 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Categories - Only show when not searching globally */}
                {searchTerm.length < 2 && (
                    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                        <Filter className="w-4 h-4 text-gray-400 mr-2" />
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                    selectedCategory === cat
                                        ? 'bg-[#3b4252] text-white shadow-sm'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {searchTerm.length >= 2 && (
                    <div className="mb-4 text-sm text-gray-500">
                        Showing global search results for <span className="font-semibold text-gray-900">"{searchTerm}"</span>
                    </div>
                )}

                <div className="bg-white rounded-[16px] border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">ETF Name</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4 text-right">LTP</th>
                                    <th className="px-6 py-4 text-right">Change</th>
                                    <th className="px-6 py-4 text-right">1D Return</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredETFs.length > 0 ? (
                                    filteredETFs.map(etf => {
                                        const q = quotes[etf.symbol];
                                        const isUp = (q?.change ?? 0) >= 0;
                                        const initials = etf.symbol.substring(0, 2);

                                        return (
                                            <tr
                                                key={etf.symbol}
                                                className="hover:bg-gray-50/60 transition-colors cursor-pointer group"
                                                onClick={() => router.push(`/stock/${encodeURIComponent(etf.symbol)}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-[11px] font-bold text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="text-[14px] font-semibold text-[#3b4252] group-hover:text-[#00b386] transition-colors">{etf.name}</p>
                                                            <p className="text-[12px] text-gray-400">{etf.symbol.replace('.NS', '')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-lg">
                                                        {etf.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {q ? (
                                                        <p className="text-[14px] font-bold text-[#3b4252]">₹{fmt(q.price)}</p>
                                                    ) : (
                                                        <div className="w-16 h-4 bg-gray-100 rounded animate-pulse ml-auto" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {q ? (
                                                        <div className={`flex items-center justify-end gap-1 ${isUp ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                                            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                            <span className="text-[13px] font-semibold">{isUp ? '+' : ''}{fmt(q.change)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-4 bg-gray-100 rounded animate-pulse ml-auto" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {q ? (
                                                        <span className={`text-[12px] font-bold px-2.5 py-1.5 rounded-lg ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                                            {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <div className="w-14 h-6 bg-gray-100 rounded-lg animate-pulse ml-auto" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); router.push(`/stock/${encodeURIComponent(etf.symbol)}`); }}
                                                        className="px-4 py-1.5 text-[13px] font-semibold text-[#00b386] border border-[#00b386] rounded-xl hover:bg-[#00b386] hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        Invest
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                                            {searchTerm.length >= 2 ? `No ETFs found matching "${searchTerm}".` : "No ETFs found matching your criteria."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
