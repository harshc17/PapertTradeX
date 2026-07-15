'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/dashboard/Header';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Trophy, Target, Wallet, TrendingUp, Search, X } from 'lucide-react';

type ChallengePosition = {
    symbol: string;
    quantity: number;
    averagePrice: number;
    ltp: number;
    currentValue: number;
    pnl: number;
};

type ChallengeSnapshot = {
    id: string;
    status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
    startAt: string;
    endAt: string;
    initialBalance: number;
    targetBalance: number;
    cashBalance: number;
    equity: number;
    pnl: number;
    progressPercent: number;
    targetRemaining: number;
    positions: ChallengePosition[];
};

type ChallengeTrade = {
    _id: string;
    type: 'BUY' | 'SELL';
    symbol: string;
    quantity: number;
    price: number;
    totalAmount: number;
    createdAt: string;
};

type SearchQuote = {
    symbol: string;
    shortname?: string;
    quoteType?: string;
    exchange?: string;
};

const API = 'http://localhost:3001';

export default function ChallengePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [challenge, setChallenge] = useState<ChallengeSnapshot | null>(null);
    const [trades, setTrades] = useState<ChallengeTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [symbol, setSymbol] = useState('RELIANCE.NS');
    const [selectedName, setSelectedName] = useState('Reliance Industries');
    const [quantity, setQuantity] = useState('1');
    const [searchQuery, setSearchQuery] = useState('RELIANCE.NS');
    const [searchResults, setSearchResults] = useState<SearchQuote[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
    const [priceSource, setPriceSource] = useState('');
    const [priceLoading, setPriceLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const token = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';
    }, []);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchState = async () => {
        if (!token) return;
        const r = await fetch(`${API}/api/challenge/state`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Failed to load challenge state');
        const data = await r.json();
        setChallenge(data.challenge || null);
    };

    const fetchTrades = async () => {
        if (!token) return;
        const r = await fetch(`${API}/api/challenge/trades`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        setTrades(data.trades || []);
    };

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [authLoading, user, router]);

    useEffect(() => {
        const load = async () => {
            if (!token || !user) return;
            setLoading(true);
            try {
                await Promise.all([fetchState(), fetchTrades()]);
            } catch (e: any) {
                showToast('error', e.message || 'Unable to load challenge');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token, user]);

    useEffect(() => {
        if (!showResults || searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const r = await fetch(`${API}/api/search?q=${encodeURIComponent(searchQuery.trim())}`, {
                    signal: controller.signal,
                });
                if (!r.ok) return;
                const data = await r.json();
                const allowed = (data.quotes || []).filter((q: SearchQuote) => {
                    const kind = String(q.quoteType || 'EQUITY').toUpperCase();
                    return kind === 'EQUITY' || kind === 'ETF';
                });
                setSearchResults(allowed.slice(0, 8));
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    setSearchResults([]);
                }
            } finally {
                setSearchLoading(false);
            }
        }, 180);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [searchQuery, showResults]);

    useEffect(() => {
        if (!symbol) return;

        const loadPrice = async () => {
            setPriceLoading(true);
            try {
                const r = await fetch(`${API}/api/stock/${encodeURIComponent(symbol)}/realtime`);
                if (!r.ok) {
                    setSelectedPrice(null);
                    setPriceSource('');
                    return;
                }
                const data = await r.json();
                if (typeof data?.price === 'number') {
                    setSelectedPrice(data.price);
                    setPriceSource(data?.source || 'market');
                } else {
                    setSelectedPrice(null);
                    setPriceSource('');
                }
            } catch {
                setSelectedPrice(null);
                setPriceSource('');
            } finally {
                setPriceLoading(false);
            }
        };

        loadPrice();
    }, [symbol]);

    const acceptChallenge = async () => {
        if (!token) return;
        setAccepting(true);
        try {
            const r = await fetch(`${API}/api/challenge/accept`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Could not accept challenge');
            setChallenge(data.challenge);
            await fetchTrades();
            showToast('success', data.reused ? 'Active challenge resumed' : 'Challenge accepted: ₹10,000 allocated');
        } catch (e: any) {
            showToast('error', e.message || 'Could not accept challenge');
        } finally {
            setAccepting(false);
        }
    };

    const placeTrade = async () => {
        if (!token || !challenge) return;
        const qty = parseInt(quantity, 10);
        if (!qty || qty <= 0) {
            showToast('error', 'Enter valid quantity');
            return;
        }

        setPlacing(true);
        try {
            const r = await fetch(`${API}/api/challenge/trade`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ symbol, type: side, quantity: qty }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Trade failed');

            setChallenge(data.challenge);
            setQuantity('1');
            await fetchTrades();
            showToast('success', `${side} executed @ ₹${Number(data.filledPrice).toFixed(2)}`);
        } catch (e: any) {
            showToast('error', e.message || 'Trade failed');
        } finally {
            setPlacing(false);
        }
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const qty = parseInt(quantity, 10) || 0;
    const estimatedTotal = qty > 0 && selectedPrice ? qty * selectedPrice : 0;

    if (authLoading || !user) return null;

    return (
        <div className="min-h-screen bg-[#f6f7f9] font-sans">
            <Header />

            {toast && (
                <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                    toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {toast.message}
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-[26px] font-semibold text-[#3b4252]">Weekly Challenge</h1>
                        <p className="text-sm text-gray-500 mt-1">Can you make ₹15,000 from ₹10,000 in 7 days?</p>
                    </div>

                    {!challenge && (
                        <button
                            onClick={acceptChallenge}
                            disabled={accepting || loading}
                            className="h-11 px-5 rounded-xl bg-[#00b386] text-white font-semibold hover:bg-[#00a37a] disabled:opacity-60"
                        >
                            {accepting ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Starting...</span> : 'Accept Challenge'}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">Loading challenge...</div>
                ) : !challenge ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-8">
                        <div className="max-w-xl">
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">Challenge Rules</h2>
                            <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
                                <li>Separate virtual wallet of ₹10,000 (does not affect your main portfolio).</li>
                                <li>Buy and sell stocks independently inside this challenge.</li>
                                <li>Goal: reach ₹15,000 equity before 7 days end.</li>
                                <li>If market is closed, challenge P&L remains frozen at closing values.</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <section className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />Cash</p>
                                        <p className="text-lg font-semibold text-gray-900">₹{fmt(challenge.cashBalance)}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Equity</p>
                                        <p className="text-lg font-semibold text-gray-900">₹{fmt(challenge.equity)}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" />Target</p>
                                        <p className="text-lg font-semibold text-gray-900">₹{fmt(challenge.targetBalance)}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />P&L</p>
                                        <p className={`text-lg font-semibold ${challenge.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {challenge.pnl >= 0 ? '+' : ''}₹{fmt(challenge.pnl)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-gray-500">Progress to ₹15,000</span>
                                        <span className="font-semibold text-gray-800">{challenge.progressPercent.toFixed(2)}%</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#00b386] to-[#26d0a8]"
                                            style={{ width: `${Math.min(challenge.progressPercent, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">₹{fmt(challenge.targetRemaining)} remaining to hit target</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900">Challenge Holdings</h3>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                        challenge.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {challenge.status}
                                    </span>
                                </div>

                                {challenge.positions.length === 0 ? (
                                    <div className="p-6 text-sm text-gray-500">No challenge positions yet.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                                                    <th className="px-5 py-3">Symbol</th>
                                                    <th className="px-5 py-3 text-right">Qty</th>
                                                    <th className="px-5 py-3 text-right">Avg</th>
                                                    <th className="px-5 py-3 text-right">LTP</th>
                                                    <th className="px-5 py-3 text-right">P&L</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {challenge.positions.map((p) => (
                                                    <tr key={p.symbol}>
                                                        <td className="px-5 py-3 font-medium text-gray-900">{p.symbol}</td>
                                                        <td className="px-5 py-3 text-right text-gray-700">{p.quantity}</td>
                                                        <td className="px-5 py-3 text-right text-gray-700">₹{fmt(p.averagePrice)}</td>
                                                        <td className="px-5 py-3 text-right text-gray-700">₹{fmt(p.ltp)}</td>
                                                        <td className={`px-5 py-3 text-right font-semibold ${p.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {p.pnl >= 0 ? '+' : ''}₹{fmt(p.pnl)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="space-y-6">
                            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                <h3 className="font-semibold text-gray-900 mb-4">Place Challenge Trade</h3>

                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setSide('BUY')}
                                        className={`flex-1 h-10 rounded-lg font-semibold text-sm ${
                                            side === 'BUY' ? 'bg-[#00b386] text-white' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        BUY
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSide('SELL')}
                                        className={`flex-1 h-10 rounded-lg font-semibold text-sm ${
                                            side === 'SELL' ? 'bg-[#eb5b3c] text-white' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        SELL
                                    </button>
                                </div>

                                <label className="block text-xs font-medium text-gray-500 mb-1">Search stock or ETF</label>
                                <div className="relative mb-3">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowResults(true);
                                        }}
                                        onFocus={() => setShowResults(true)}
                                        placeholder="e.g. RELIANCE, GOLDBEES, NIFTYBEES"
                                        className="w-full h-10 pl-10 pr-10 rounded-lg border border-gray-200 text-sm"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSearchResults([]);
                                                setShowResults(false);
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}

                                    {showResults && (searchQuery.trim().length >= 2) && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20">
                                            {searchLoading ? (
                                                <div className="px-3 py-3 text-xs text-gray-500">Searching...</div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="px-3 py-3 text-xs text-gray-500">No stocks/ETFs found</div>
                                            ) : (
                                                <div className="max-h-56 overflow-auto">
                                                    {searchResults.map((q) => (
                                                        <button
                                                            key={`${q.symbol}-${q.exchange || ''}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setSymbol(q.symbol);
                                                                setSelectedName(q.shortname || q.symbol);
                                                                setSearchQuery(q.symbol);
                                                                setShowResults(false);
                                                            }}
                                                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                                        >
                                                            <p className="text-sm font-medium text-gray-900">{q.shortname || q.symbol}</p>
                                                            <p className="text-xs text-gray-500">{q.symbol}{q.quoteType ? ` · ${q.quoteType}` : ''}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                    <p className="font-semibold text-gray-800">Selected: {selectedName} ({symbol})</p>
                                    <p className="mt-1">
                                        Market price:{' '}
                                        {priceLoading ? 'Loading...' : (selectedPrice ? `₹${fmt(selectedPrice)}` : 'Unavailable')}
                                        {priceSource ? ` · ${priceSource}` : ''}
                                    </p>
                                </div>

                                <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 mb-4 text-sm"
                                />

                                <p className="text-xs text-gray-500 mb-4">
                                    Approx order value: ₹{fmt(estimatedTotal)}
                                </p>

                                <button
                                    type="button"
                                    onClick={placeTrade}
                                    disabled={placing || challenge.status !== 'ACTIVE' || !selectedPrice}
                                    className="w-full h-10 rounded-lg bg-gray-900 text-white font-semibold text-sm hover:bg-black disabled:opacity-60"
                                >
                                    {placing ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Placing...</span> : 'Execute Trade'}
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                <h3 className="font-semibold text-gray-900 mb-3">Recent Challenge Trades</h3>
                                {trades.length === 0 ? (
                                    <p className="text-sm text-gray-500">No challenge trades yet.</p>
                                ) : (
                                    <div className="space-y-2 max-h-80 overflow-auto pr-1">
                                        {trades.map((t) => (
                                            <div key={t._id} className="border border-gray-100 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-bold ${t.type === 'BUY' ? 'text-green-600' : 'text-red-500'}`}>{t.type}</span>
                                                    <span className="text-[11px] text-gray-400">{new Date(t.createdAt).toLocaleString('en-IN')}</span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-800 mt-1">{t.symbol}</p>
                                                <p className="text-xs text-gray-500 mt-1">Qty {t.quantity} @ ₹{fmt(t.price)} · ₹{fmt(t.totalAmount)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
}
