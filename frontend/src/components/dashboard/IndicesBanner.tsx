'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

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

const INDICES = [
    { symbol: '^NSEI',       label: 'NIFTY 50'   },
    { symbol: '^BSESN',      label: 'SENSEX'     },
    { symbol: '^NSEBANK',    label: 'BANKNIFTY'  },
    { symbol: '^MIDCPNIFTY', label: 'MIDCPNIFTY' },
    { symbol: '^FINNIFTY',   label: 'FINNIFTY'   },
];

export default function IndicesBanner() {
    const [quotes, setQuotes] = useState<Record<string, { price: number; change: number; dayChange: number }>>({});

    useEffect(() => {
        const s = getSocket();
        INDICES.forEach(i => s.emit('subscribe', i.symbol));

        const applyQuote = (sym: string, d: any) => {
            if (typeof d?.price !== 'number') return;
            setQuotes(prev => ({
                ...prev,
                [sym]: { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 },
            }));
        };

        const onUpdate = (payload: Record<string, any>) => {
            Object.entries(payload).forEach(([sym, d]: [string, any]) => applyQuote(sym, d));
        };

        const onPriceTick = (tick: Record<string, any>) => {
            if (typeof tick?.symbol !== 'string') return;
            applyQuote(tick.symbol, tick);
        };
        s.on('market_update', onUpdate);
        s.on('price_tick', onPriceTick);

        // ── Pre-fetch from REST endpoint so banner is never blank on load ──
        fetch('http://localhost:3001/api/indices')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                setQuotes(prev => {
                    const next = { ...prev };
                    Object.entries(data).forEach(([sym, d]: [string, any]) => {
                        if (typeof d?.price === 'number') next[sym] = { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 };
                    });
                    return next;
                });
            })
            .catch(() => {});

        const refreshTimer = setInterval(() => {
            fetch('http://localhost:3001/api/indices')
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (!data) return;
                    setQuotes(prev => {
                        const next = { ...prev };
                        Object.entries(data).forEach(([sym, d]: [string, any]) => {
                            if (typeof d?.price === 'number') next[sym] = { price: d.price, change: d.change ?? 0, dayChange: d.dayChange ?? 0 };
                        });
                        return next;
                    });
                })
                .catch(() => {});
        }, 10000);

        return () => {
            s.off('market_update', onUpdate);
            s.off('price_tick', onPriceTick);
            clearInterval(refreshTimer);
        };
    }, []);

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="bg-white border-b border-gray-100 overflow-hidden">
            <div className="flex items-center divide-x divide-gray-100 overflow-x-auto no-scrollbar">
                {INDICES.map(({ symbol, label }) => {
                    const q = quotes[symbol];
                    const isUp = (q?.change ?? 0) >= 0;
                    return (
                        <Link href={`/stock/${encodeURIComponent(symbol)}`} key={symbol} className="flex-shrink-0 px-6 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors group">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">{label}</span>
                            {q ? (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-bold text-gray-900">{fmt(q.price)}</span>
                                    <span className={`text-xs font-semibold flex items-center gap-0.5 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {isUp ? '+' : ''}{q.dayChange.toFixed(2)}%
                                    </span>
                                </div>
                            ) : (
                                <div className="w-28 h-4 bg-gray-100 rounded animate-pulse" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
