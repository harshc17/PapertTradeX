'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { CheckCircle2, Settings, XCircle, Loader2, ChevronDown } from 'lucide-react';

type Toast = { type: 'success' | 'error'; message: string };

// Temporary override: allow placing orders even when market is closed.
const TEMP_ALLOW_AFTER_HOURS_TRADING = true;

export default function TradingPanel({ symbol }: { symbol: string }) {
    const { user, balance, refreshBalance } = useAuth();
    const { executeTrade, refreshPortfolio } = usePortfolio();

    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);

    useEffect(() => {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        const s = getSocket();
        // Subscribe using both forms so the server marks it as priority
        s.emit('subscribe', symbol);
        s.emit('subscribe', bare);

        const onUpdate = (payload: Record<string, any>) => {
            // Server caches under both bare ('RELIANCE') and bare+'.NS' ('RELIANCE.NS')
            const entry = payload[bare] ?? payload[symbol] ?? payload[bare + '.NS'];
            if (typeof entry?.price === 'number') {
                setCurrentPrice(entry.price);
                setPriceChange(entry.dayChange ?? 0);
            }
        };
        s.on('market_update', onUpdate);
        return () => { s.off('market_update', onUpdate); };
    }, [symbol]);

    // ── Fetch initial price via REST while waiting for first WS tick ──────────
    useEffect(() => {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        fetch(`http://localhost:3001/api/stock/${encodeURIComponent(bare)}/realtime`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (typeof data?.price === 'number' && currentPrice === null) {
                    setCurrentPrice(data.price);
                    setPriceChange(data.dayChange ?? 0);
                }
            })
            .catch(() => {});
    }, [symbol]);

    useEffect(() => {
        fetch('http://localhost:3001/api/market-status')
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (typeof d?.isOpen === 'boolean') setMarketOpen(d.isOpen);
            })
            .catch(() => {});
    }, []);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) { showToast('error', 'Please login to trade'); return; }
        if (!TEMP_ALLOW_AFTER_HOURS_TRADING && marketOpen !== true) { showToast('error', 'Market is closed. Buying and selling are disabled.'); return; }
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) { showToast('error', 'Enter a valid quantity'); return; }
        const price = orderType === 'MARKET' ? (currentPrice || 0) : parseFloat(limitPrice);
        if (!price || price <= 0) { showToast('error', 'Enter a valid price'); return; }

        setLoading(true);
        try {
            const result = await executeTrade(
                symbol,
                side,
                qty,
                price,
                orderType,
                orderType === 'LIMIT' ? price : undefined
            );
            if (orderType === 'LIMIT') {
                showToast('success', `Limit order placed! Order ID: ${result.orderId}`);
            } else {
                showToast('success', `${side} ${qty} shares @ ₹${price.toFixed(2)} executed!`);
            }
            setQuantity('');
            setLimitPrice('');
            await refreshBalance();
            await refreshPortfolio();
        } catch (err: any) {
            showToast('error', err.message || 'Trade failed');
        } finally {
            setLoading(false);
        }
    };

    const estimatedTotal = (() => {
        const qty = parseInt(quantity) || 0;
        const price = orderType === 'MARKET' ? (currentPrice || 0) : (parseFloat(limitPrice) || 0);
        return qty * price;
    })();
    const nsePrice = currentPrice ?? 0;
    const bsePrice = nsePrice > 0 ? nsePrice + 0.35 : 0;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-20">
            {/* Toast */}
            {toast && (
                <div className={`absolute top-4 right-4 left-4 z-50 flex items-center gap-2 p-3 rounded-xl text-sm font-medium shadow-lg border ${
                    toast.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                    {toast.message}
                </div>
            )}

            <div className="px-6 pt-5 pb-3 border-b border-gray-200">
                <h2 className="text-[22px] sm:text-[24px] font-semibold text-[#31354a] leading-none">{symbol.replace('.NS', '')}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                    NSE ₹{nsePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({priceChange.toFixed(2)}%) · BSE ₹{bsePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="ml-1 border-b border-dashed border-gray-400 text-[#31354a]">Depth</span>
                </p>
                {!TEMP_ALLOW_AFTER_HOURS_TRADING && marketOpen === false && (
                    <p className="text-xs font-semibold text-red-500 mt-2">Market is closed. Buying and selling are disabled.</p>
                )}
                {!TEMP_ALLOW_AFTER_HOURS_TRADING && marketOpen === null && (
                    <p className="text-xs font-semibold text-gray-500 mt-2">Checking market status...</p>
                )}
            </div>

            <div className="px-6 border-b border-gray-200">
                <div className="flex gap-8 text-sm sm:text-base font-semibold tracking-wide text-gray-400">
                    <button
                        type="button"
                        onClick={() => setSide('BUY')}
                        disabled={!TEMP_ALLOW_AFTER_HOURS_TRADING && marketOpen !== true}
                        className={`relative py-4 ${side === 'BUY' ? 'text-[#00b386]' : 'text-gray-400'}`}
                    >
                        BUY
                        {side === 'BUY' && <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-[#00b386]" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSide('SELL')}
                        disabled={!TEMP_ALLOW_AFTER_HOURS_TRADING && marketOpen !== true}
                        className={`relative py-4 ${side === 'SELL' ? 'text-[#e65a3a]' : 'text-gray-400'}`}
                    >
                        SELL
                        {side === 'SELL' && <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-[#e65a3a]" />}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button type="button" className="h-7 px-3.5 rounded-full border border-gray-200 text-gray-500 text-[11px] sm:text-xs font-medium">MTF 3.85x</button>
                    <button type="button" className="h-7 w-7 rounded-full border border-gray-200 text-gray-500 grid place-items-center"><Settings className="w-3.5 h-3.5" /></button>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="text-[11px] sm:text-xs text-[#4b5065] font-medium inline-flex items-center gap-1">Qty NSE <ChevronDown className="w-3.5 h-3.5" /></div>
                    <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        required
                        className="h-11 px-3.5 border-2 border-[#4a4f63] rounded-md text-sm text-[#31354a] outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                    <button
                        type="button"
                        onClick={() => setOrderType(orderType === 'MARKET' ? 'LIMIT' : 'MARKET')}
                        className="text-left text-[11px] sm:text-xs text-[#4b5065] font-medium inline-flex items-center gap-1"
                    >
                        Price {orderType === 'MARKET' ? 'Market' : 'Limit'} <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {orderType === 'MARKET' ? (
                        <div className="h-11 rounded-md bg-gray-100 text-[#4a4f63] text-sm font-semibold grid place-items-center">At market</div>
                    ) : (
                        <input
                            type="number"
                            step="0.05"
                            min="0.01"
                            value={limitPrice}
                            onChange={e => setLimitPrice(e.target.value)}
                            required
                            className="h-11 px-3.5 border-2 border-[#4a4f63] rounded-md text-sm text-[#31354a] outline-none"
                        />
                    )}
                </div>

                <div className="pt-10 border-t border-gray-200 mt-4">
                    <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 mb-3">
                        <span>Balance : ₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        <span>Approx req. : ₹{estimatedTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>

                    <button
                        id="place-order-btn"
                        type="submit"
                        disabled={loading || !currentPrice || (!TEMP_ALLOW_AFTER_HOURS_TRADING && marketOpen !== true)}
                        className={`w-full h-11 rounded-[10px] font-semibold text-sm sm:text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            side === 'BUY' ? 'bg-[#00b386] hover:bg-[#00a079]' : 'bg-[#e65a3a] hover:bg-[#d84f31]'
                        }`}
                    >
                        {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span> : side === 'BUY' ? 'Buy' : 'Sell'}
                    </button>
                </div>
            </form>
        </div>
    );
}
