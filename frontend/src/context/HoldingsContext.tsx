'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io } from 'socket.io-client';

export interface Holding {
    symbol: string;
    name: string;
    qty: number;
    avg: number;
    ltp: number; // Last Traded Price
    dayChange: number; // Percentage
    currentValue?: number;
    pnl?: number;
    pnlPercent?: number;
    currentPrice?: number;
}

export interface Order {
    id: string;
    symbol: string;
    name: string;
    qty: number;
    price: number;
    type: 'BUY' | 'SELL';
    status: 'SUCCESS'; // Simplified for demo
    timestamp: Date;
}

interface HoldingsContextType {
    holdings: Holding[];
    orders: Order[];
    buyStock: (stock: { symbol: string; name: string; price: number; change: number }, qty: number) => void;
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    totalReturnsPercent: number;
    dayReturns: number;
    watchlist: { name: string, price: string, change: string, isPositive: boolean }[];
    removeFromWatchlist: (name: string) => void;
}

const HoldingsContext = createContext<HoldingsContextType | undefined>(undefined);

export function HoldingsProvider({ children }: { children: ReactNode }) {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [livePreviousClose, setLivePreviousClose] = useState<Record<string, number>>({});
    const [watchlist, setWatchlist] = useState<{ name: string, price: string, change: string, isPositive: boolean }[]>([
        { name: 'TCS.NS', price: 'Loading...', change: '0 (0%)', isPositive: true },
        { name: 'INFY.NS', price: 'Loading...', change: '0 (0%)', isPositive: false },
        { name: 'HDFCBANK.NS', price: 'Loading...', change: '0 (0%)', isPositive: true },
        { name: 'ICICIBANK.NS', price: 'Loading...', change: '0 (0%)', isPositive: true },
        { name: 'SBIN.NS', price: 'Loading...', change: '0 (0%)', isPositive: false },
    ]);

    // Socket.io Connection
    useEffect(() => {
        const socket = io('http://localhost:3001');

        socket.on('connect', () => {
            console.log('Connected to Market Data Server');
            // Subscribe to all symbols we care about
            ['TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', '^NSEI', '^BSESN'].forEach(sym => socket.emit('subscribe', sym));
        });

        socket.on('market_update', (data: any) => {
            // Data format: { SYMBOL: { symbol, price, change, dayChange, timestamp } }

            const priceUpdates: Record<string, number> = {};
            const prevCloseUpdates: Record<string, number> = {};

            Object.entries(data || {}).forEach(([symbol, update]: [string, any]) => {
                if (typeof update?.price === 'number') {
                    priceUpdates[symbol] = update.price;
                    priceUpdates[symbol.replace(/\.(NS|BO)$/i, '')] = update.price;

                    const prevClose = typeof update?.change === 'number' && Number.isFinite(update.change)
                        ? update.price - update.change
                        : typeof update?.dayChange === 'number' && Number.isFinite(update.dayChange) && update.dayChange !== 0
                            ? update.price / (1 + (update.dayChange / 100))
                            : null;

                    if (typeof prevClose === 'number' && Number.isFinite(prevClose) && prevClose > 0) {
                        prevCloseUpdates[symbol] = prevClose;
                        prevCloseUpdates[symbol.replace(/\.(NS|BO)$/i, '')] = prevClose;
                    }
                }
            });

            if (Object.keys(priceUpdates).length > 0) {
                setLivePrices(prev => ({ ...prev, ...priceUpdates }));
            }

            if (Object.keys(prevCloseUpdates).length > 0) {
                setLivePreviousClose(prev => ({ ...prev, ...prevCloseUpdates }));
            }

            // 1. Update Holdings
            setHoldings(prev => {
                let hasChanges = false;
                const newHoldings = prev.map(h => {
                    const update = data[h.symbol] || data[h.name]; // Try both (our mock sends name as symbol often)
                    if (update) {
                        hasChanges = true;
                        return {
                            ...h,
                            ltp: update.price,
                            dayChange: update.dayChange
                        };
                    }
                    return h;
                });
                return hasChanges ? newHoldings : prev;
            });

            // 2. Update Watchlist
            setWatchlist(prev => {
                let hasChanges = false;
                const newWatchlist = prev.map(w => {
                    const update = data[w.name] || data[w.name.toUpperCase()];
                    if (update) {
                        hasChanges = true;
                        const isPositive = update.change >= 0;
                        const changeStr = `${update.change > 0 ? '+' : ''}${update.change} (${update.dayChange}%)`;
                        return {
                            ...w,
                            price: update.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                            change: changeStr,
                            isPositive
                        };
                    }
                    return w;
                });
                return hasChanges ? newWatchlist : prev;
            });
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const buyStock = (stock: { symbol: string; name: string; price: number; change: number }, qty: number) => {
        // Add to orders
        const newOrder: Order = {
            id: Math.random().toString(36).substr(2, 9),
            symbol: stock.symbol,
            name: stock.name,
            qty: qty,
            price: stock.price,
            type: 'BUY',
            status: 'SUCCESS',
            timestamp: new Date()
        };
        setOrders(prev => [newOrder, ...prev]);

        // Add/Update holdings
        setHoldings((prev) => {
            const existing = prev.find((h) => h.symbol === stock.symbol);
            if (existing) {
                // Update average price and quantity
                const totalCost = (existing.qty * existing.avg) + (qty * stock.price);
                const newQty = existing.qty + qty;
                const newAvg = totalCost / newQty;

                return prev.map((h) =>
                    h.symbol === stock.symbol
                        ? { ...h, qty: newQty, avg: newAvg, ltp: stock.price }
                        : h
                );
            } else {
                // Add new holding
                return [...prev, {
                    symbol: stock.symbol,
                    name: stock.name,
                    qty: qty,
                    avg: stock.price,
                    ltp: stock.price,
                    dayChange: stock.change // Simplified for demo
                }];
            }
        });
    };

    const removeFromWatchlist = (name: string) => {
        setWatchlist(prev => prev.filter(item => item.name !== name));
    };

    const totalInvested = holdings.reduce((acc, curr) => acc + (curr.qty * curr.avg), 0);
    const enrichedHoldings = holdings.map(h => {
        const currentPrice = livePrices[h.symbol] ?? h.ltp;
        const currentValue = h.qty * currentPrice;
        const investedValue = h.qty * h.avg;
        const pnl = currentValue - investedValue;
        const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
        return {
            ...h,
            ltp: currentPrice,
            currentPrice,
            currentValue,
            pnl,
            pnlPercent,
        };
    });

    const currentValue = enrichedHoldings.reduce((acc, curr) => acc + (curr.currentValue ?? 0), 0);
    const totalReturns = currentValue - totalInvested;
    const totalReturnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

    // 1D return = live P&L versus the latest known previous close.
    const dayReturns = enrichedHoldings.reduce((acc, curr) => {
        const prevClose = livePreviousClose[curr.symbol] ?? livePreviousClose[curr.symbol.replace(/\.(NS|BO)$/i, '')];
        if (!(prevClose > 0)) return acc;
        return acc + (curr.qty * (curr.currentPrice - prevClose));
    }, 0);

    return (
        <HoldingsContext.Provider value={{
            holdings: enrichedHoldings,
            orders,
            buyStock,
            totalInvested,
            currentValue,
            totalReturns,
            totalReturnsPercent,
            dayReturns,
            watchlist,
            removeFromWatchlist
        }}>
            {children}
        </HoldingsContext.Provider>
    );
}

export function useHoldings() {
    const context = useContext(HoldingsContext);
    if (context === undefined) {
        throw new Error('useHoldings must be used within a HoldingsProvider');
    }
    return context;
}
