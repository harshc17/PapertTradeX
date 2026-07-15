'use client';

import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Quote = {
    symbol: string;
    shortname?: string;
    price?: number;
    change?: number;
    dayChange?: number;
    timestamp?: string | Date;
};

let socket: Socket | null = null;

function getSocket(): Socket {
    if (!socket) {
        socket = io(typeof window !== 'undefined' ? 'http://localhost:3001' : '', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            timeout: 10000,
        });
    }
    return socket;
}

const DEFAULT_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', 'TCS.NS', 'RELIANCE.NS', 'HDFCBANK.NS', 'INFY.NS'];

export default function LiveMarketTicker() {
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});
    const [inputSymbol, setInputSymbol] = useState('');

    useEffect(() => {
        const s = getSocket();

        // Subscribe to some default indices / stocks / ETF-like instruments
        DEFAULT_SYMBOLS.forEach(sym => s.emit('subscribe', sym));

        const onUpdate = (payload: Record<string, Quote>) => {
            setQuotes(prev => ({ ...prev, ...payload }));
        };

        s.on('market_update', onUpdate);

        return () => {
            s.off('market_update', onUpdate);
        };
    }, []);

    const sortedQuotes = useMemo(
        () =>
            Object.values(quotes).sort((a, b) =>
                (a.symbol || '').localeCompare(b.symbol || '')
            ),
        [quotes]
    );

    const handleAddSymbol = () => {
        const raw = inputSymbol.trim().toUpperCase();
        if (!raw) return;
        const s = getSocket();
        s.emit('subscribe', raw);
        setInputSymbol('');
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Live Market (≈1s updates)
                </h2>
                <div className="flex gap-2">
                    <input
                        value={inputSymbol}
                        onChange={e => setInputSymbol(e.target.value)}
                        placeholder="Add stock / ETF / F&O symbol"
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleAddSymbol}
                        className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        Add
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                            <th className="text-left py-2 pr-4">Symbol</th>
                            <th className="text-left py-2 pr-4">Name</th>
                            <th className="text-right py-2 pr-4">Last</th>
                            <th className="text-right py-2 pr-4">Change</th>
                            <th className="text-right py-2">Day %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedQuotes.map(q => {
                            const change = q.change ?? 0;
                            const pct = q.dayChange ?? 0;
                            const isUp = change >= 0;
                            return (
                                <tr
                                    key={q.symbol}
                                    className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                                >
                                    <td className="py-1 pr-4 font-semibold text-[11px]">
                                        {q.symbol}
                                    </td>
                                    <td className="py-1 pr-4 text-[11px] text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                                        {q.shortname || '-'}
                                    </td>
                                    <td className="py-1 pr-4 text-right text-[11px]">
                                        {q.price != null ? q.price.toFixed(2) : '-'}
                                    </td>
                                    <td
                                        className={`py-1 pr-4 text-right text-[11px] ${
                                            isUp ? 'text-emerald-500' : 'text-red-500'
                                        }`}
                                    >
                                        {change >= 0 ? '+' : ''}
                                        {change.toFixed(2)}
                                    </td>
                                    <td
                                        className={`py-1 text-right text-[11px] ${
                                            isUp ? 'text-emerald-500' : 'text-red-500'
                                        }`}
                                    >
                                        {pct >= 0 ? '+' : ''}
                                        {pct.toFixed(2)}%
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedQuotes.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="py-4 text-center text-xs text-gray-400"
                                >
                                    Waiting for live ticks...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

