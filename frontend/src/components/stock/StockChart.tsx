'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Filler,
    ChartOptions,
    ChartData,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, RefreshCw, Wifi, WifiOff } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type HistoryPoint = {
    date: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
};

type Period = {
    label: string;
    value: string;
    fmt: 'time' | 'dayTime' | 'date' | 'monthYear' | 'year';
    maxTicks: number;
};

/* ─── Period Config ──────────────────────────────────────────────────────────── */
const PERIODS: Period[] = [
    { label: '1D', value: '1d', fmt: 'time', maxTicks: 8 },
    { label: '1W', value: '1w', fmt: 'dayTime', maxTicks: 7 },
    { label: '1M', value: '1mo', fmt: 'date', maxTicks: 8 },
    { label: '6M', value: '6mo', fmt: 'date', maxTicks: 6 },
    { label: '1Y', value: '1y', fmt: 'date', maxTicks: 6 },
    { label: '5Y', value: '5y', fmt: 'monthYear', maxTicks: 5 },
    { label: 'ALL', value: 'max', fmt: 'year', maxTicks: 6 },
];

/* ─── Formatters ─────────────────────────────────────────────────────────────── */
function formatLabel(dateStr: string, fmt: Period['fmt']): string {
    const d = new Date(dateStr);
    switch (fmt) {
        case 'time':
            return d.toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
            });
        case 'dayTime':
            return d.toLocaleDateString('en-IN', {
                weekday: 'short', timeZone: 'Asia/Kolkata',
            }) + ' ' + d.toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
            });
        case 'date':
            return d.toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
            });
        case 'monthYear':
            return d.toLocaleDateString('en-IN', {
                month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata',
            });
        case 'year':
            return d.getFullYear().toString();
        default:
            return d.toLocaleDateString('en-IN');
    }
}

function formatINR(v: number, decimals = 2): string {
    return '₹' + v.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatVol(v: number): string {
    if (!v) return '—';
    if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)} K`;
    return String(v);
}

/* ─── Singleton Socket ───────────────────────────────────────────────────────── */
let _socket: Socket | null = null;
function getSocket(): Socket {
    if (!_socket) {
        _socket = io('http://localhost:3001', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            timeout: 10000,
        });
    }
    return _socket;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */
export default function StockChart({ symbol }: { symbol: string }) {
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [activePeriod, setActivePeriod] = useState<Period>(PERIODS[2]); // default 1M
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [livePrice, setLivePrice] = useState<number | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [lastPriceTs, setLastPriceTs] = useState<number>(Date.now());
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    // prevClose = yesterday's closing price, used as the 1D return anchor.
    // Comes from the /history API response (Yahoo chart meta or NSE cache).
    const [prevClose, setPrevClose] = useState<number | null>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

    /* ─── Fetch chart data ─────────────────────────────────────────────────────── */
    const fetchHistory = useCallback((period: Period) => {
        setLoading(true);
        setError(false);
        setHistory([]);
        setPrevClose(null);

        fetch(
            `http://localhost:3001/api/stock/${encodeURIComponent(symbol)}/history?period=${period.value}`
        )
            .then(r => r.ok ? r.json() : Promise.reject('bad response'))
            .then(data => {
                const pts: HistoryPoint[] = (data.data || [])
                    .filter((h: any) => h.close && h.close > 0)
                    .map((h: any) => ({
                        date: h.date,
                        close: h.close,
                        open: h.open,
                        high: h.high,
                        low: h.low,
                        volume: h.volume ?? 0,
                    }));
                setHistory(pts);
                // Capture prevClose for 1D — the true anchor for 1D return calculation.
                if (typeof data.prevClose === 'number' && data.prevClose > 0) {
                    setPrevClose(data.prevClose);
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [symbol]);

    /* ─── Period change ─────────────────────────────────────────────────────────── */
    useEffect(() => {
        fetchHistory(activePeriod);

        // Auto-refresh chart data every 60s when on 1D
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        if (activePeriod.value === '1d') {
            refreshTimerRef.current = setInterval(() => fetchHistory(activePeriod), 60_000);
        }
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [activePeriod, fetchHistory]);

    /* ─── WebSocket — live price tick ────────────────────────────────────────────── */
    useEffect(() => {
        const s = getSocket();
        s.emit('subscribe', symbol);

        const onTick = (payload: any) => {
            if (payload.symbol === bare && typeof payload.price === 'number') {
                setLivePrice(payload.price);
                setIsLive(true);
                setLastPriceTs(Date.now());
            }
        };

        const onUpdate = (payload: Record<string, any>) => {
            const entry = payload[bare] || payload[symbol];
            if (typeof entry?.price === 'number') {
                setLivePrice(entry.price);
                setIsLive(true);
                setLastPriceTs(Date.now());
            }
        };

        s.on('price_tick', onTick);
        s.on('market_update', onUpdate);

        // Mark stale after 8s without a tick
        const staleTimer = setInterval(() => {
            if (Date.now() - lastPriceTs > 8000) setIsLive(false);
        }, 3000);

        return () => {
            s.off('price_tick', onTick);
            s.off('market_update', onUpdate);
            clearInterval(staleTimer);
        };
    }, [symbol, bare]);

    /* ─── Derived values ─────────────────────────────────────────────────────────── */
    const displayHistory = history;
    const firstClose = displayHistory.length > 0 ? displayHistory[0].close : null;
    const lastClose = displayHistory.length > 0 ? displayHistory[displayHistory.length - 1].close : null;
    const currentDisp = (activePeriod.value === '1d' && livePrice) ? livePrice : lastClose;

    // For 1D: use prevClose (yesterday's session close) as the return baseline — NOT the
    // first intraday bar — so the figure matches what broker apps show.
    // For all other periods: use the first data point in the series.
    const baseline = (activePeriod.value === '1d' && prevClose != null && prevClose > 0)
        ? prevClose
        : firstClose;

    const priceChange = (baseline && currentDisp) ? currentDisp - baseline : 0;
    const pctChange = (baseline && baseline > 0 && currentDisp)
        ? ((currentDisp - baseline) / baseline) * 100
        : 0;
    const isPositive = priceChange >= 0;

    const color = isPositive ? '#10b981' : '#ef4444';
    const colorBg = isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)';

    const labels = displayHistory.map(h => formatLabel(h.date, activePeriod.fmt));
    const closes = displayHistory.map(h => h.close);
    const volumes = displayHistory.map(h => h.volume ?? 0);
    const hasVolume = volumes.some(v => v > 0);

    // If on 1D and we have livePrice, extend chart with current live point
    const chartLabels = [...labels];
    const chartCloses = [...closes];
    if (activePeriod.value === '1d' && livePrice && displayHistory.length > 0) {
        const now = new Date();
        const liveFmt = formatLabel(now.toISOString(), 'time');
        if (chartLabels[chartLabels.length - 1] !== liveFmt) {
            chartLabels.push(liveFmt);
            chartCloses.push(livePrice);
        } else {
            chartCloses[chartCloses.length - 1] = livePrice;
        }
    }

    /* ─── Chart.js datasets ────────────────────────────────────────────────────── */
    const lineData: ChartData<'line'> = {
        labels: chartLabels,
        datasets: [{
            label: 'Price',
            data: chartCloses,
            borderColor: color,
            backgroundColor: (ctx: any) => {
                const chart = ctx.chart;
                const { ctx: c, chartArea } = chart;
                if (!chartArea) return colorBg;
                const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                if (isPositive) {
                    g.addColorStop(0, 'rgba(16,185,129,0.22)');
                    g.addColorStop(0.5, 'rgba(16,185,129,0.08)');
                    g.addColorStop(1, 'rgba(16,185,129,0.00)');
                } else {
                    g.addColorStop(0, 'rgba(239,68,68,0.18)');
                    g.addColorStop(0.5, 'rgba(239,68,68,0.06)');
                    g.addColorStop(1, 'rgba(239,68,68,0.00)');
                }
                return g;
            },
            fill: true,
            tension: activePeriod.value === '1d' ? 0.15 : 0.3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderWidth: 2,
        }],
    };

    const lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onHover: (_: any, elements: any[]) => {
            setHoverIdx(elements.length > 0 ? elements[0].index : null);
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#64748b',
                bodyColor: '#f8fafc',
                padding: 14,
                borderColor: '#1e293b',
                borderWidth: 1,
                cornerRadius: 10,
                displayColors: false,
                callbacks: {
                    title: (items: any[]) => items[0]?.label || '',
                    label: (ctx: any) => {
                        const i = ctx.dataIndex;
                        const p = displayHistory[i];
                        if (!p) return `Close: ${formatINR(ctx.raw)}`;
                        const lines = [`Close:  ${formatINR(p.close)}`];
                        if (p.open != null) lines.push(`Open:   ${formatINR(p.open)}`);
                        if (p.high != null) lines.push(`High:   ${formatINR(p.high)}`);
                        if (p.low != null) lines.push(`Low:    ${formatINR(p.low)}`);
                        if (p.volume) lines.push(`Vol:    ${formatVol(p.volume)}`);
                        return lines;
                    },
                },
            },
        },
        scales: {
            x: {
                display: true,
                grid: { display: false },
                ticks: {
                    color: '#94a3b8',
                    font: { size: 10, family: 'Inter, sans-serif' },
                    maxTicksLimit: activePeriod.maxTicks,
                    maxRotation: 0,
                    autoSkip: true,
                },
                border: { display: false },
            },
            y: {
                display: true,
                position: 'right' as const,
                grid: { color: 'rgba(148,163,184,0.08)', drawTicks: false },
                ticks: {
                    color: '#94a3b8',
                    font: { size: 10, family: 'Inter, sans-serif' },
                    padding: 8,
                    callback: (v: any) => formatINR(Number(v), 0),
                },
                border: { display: false },
            },
        },
        animation: { duration: 400 },
    };

    const volData: ChartData<'bar'> = {
        labels: chartLabels,
        datasets: [{
            label: 'Volume',
            data: volumes,
            backgroundColor: volumes.map((_, i) => {
                const isGreen = i === 0 || closes[i] >= closes[i - 1];
                return isGreen ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.30)';
            }),
            borderRadius: 2,
            borderSkipped: false,
        }],
    };

    const volOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
            x: { display: false, grid: { display: false } },
            y: {
                display: false,
                grid: { display: false },
                border: { display: false },
            },
        },
        animation: { duration: 200 },
    };

    /* ─── Hover tooltip ──────────────────────────────────────────────────────────── */
    const hoverPt = hoverIdx != null ? displayHistory[hoverIdx] : null;

    /* ─── Render ──────────────────────────────────────────────────────────────────── */
    return (
        <div className="bg-transparent">
            <div className="relative h-[390px]">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#00b386] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-gray-400">Loading chart...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2">
                        <WifiOff className="w-8 h-8 text-gray-300" />
                        <p className="text-sm text-gray-400">Failed to load chart data</p>
                        <button
                            onClick={() => fetchHistory(activePeriod)}
                            className="text-xs text-[#00b386] hover:underline font-medium"
                        >
                            Retry
                        </button>
                    </div>
                ) : displayHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-gray-400">No data for this period</p>
                    </div>
                ) : (
                    <>
                        <div className="h-[320px] relative">
                            <Line data={lineData} options={lineOptions} />
                        </div>
                        {hasVolume && (
                            <div className="h-10 mt-1 relative opacity-70">
                                <Bar data={volData} options={volOptions} />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                {PERIODS.map((p) => (
                    <button
                        key={p.value}
                        onClick={() => setActivePeriod(p)}
                        className={`h-9 min-w-[48px] px-3.5 rounded-full border text-xs sm:text-sm font-medium transition-all ${
                            activePeriod.value === p.value
                                ? 'bg-white border-[#4a4f63] text-[#31354a]'
                                : 'bg-white/70 border-gray-200 text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}

                <button
                    onClick={() => fetchHistory(activePeriod)}
                    disabled={loading}
                    className="h-9 w-9 rounded-full border border-gray-200 bg-white grid place-items-center text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    title="Refresh chart"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {hoverPt && (
                <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-2.5 flex-wrap">
                    <span>O {formatINR(hoverPt.open ?? hoverPt.close)}</span>
                    <span>H {formatINR(hoverPt.high ?? hoverPt.close)}</span>
                    <span>L {formatINR(hoverPt.low ?? hoverPt.close)}</span>
                    <span>C {formatINR(hoverPt.close)}</span>
                    {(hoverPt.volume ?? 0) > 0 && <span>Vol {formatVol(hoverPt.volume!)}</span>}
                </div>
            )}

            <div className="mt-1 text-[10px] text-gray-400">
                {isLive ? 'Live updates on' : 'Live updates delayed'} · {displayHistory.length} points · {activePeriod.value === '1d' ? 'NSE intraday' : 'Yahoo OHLCV'}
            </div>
        </div>
    );
}
