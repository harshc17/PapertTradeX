/**
 * StooqClient.js — Historical OHLCV data from Stooq.com
 *
 * Stooq provides free, high-quality historical price data for Indian stocks
 * via a simple CSV endpoint. No API key, no rate-limit headers needed.
 *
 * URL format:
 *   https://stooq.com/q/d/l/?s=HDFCBANK.NS&i=d&d1=20230101&d2=20240101
 *
 * Intervals: d=daily, w=weekly, m=monthly
 */

const axios = require('axios');

const STOOQ_BASE = 'https://stooq.com/q/d/l/';

// Period → { interval, lookbackDays }
// lookbackDays=null means fetch all available history
const PERIOD_MAP = {
    '1w':  { interval: 'd', lookbackDays: 8    },
    '1mo': { interval: 'd', lookbackDays: 32   },
    '3mo': { interval: 'd', lookbackDays: 93   },
    '6mo': { interval: 'd', lookbackDays: 185  },
    '1y':  { interval: 'd', lookbackDays: 367  },
    '5y':  { interval: 'w', lookbackDays: 1832 },
    'max': { interval: 'm', lookbackDays: null  },
};

/**
 * Parse Stooq CSV into array of OHLCV objects.
 * CSV format: Date,Open,High,Low,Close,Volume
 */
function parseCSV(csv) {
    const lines = (csv || '').trim().split('\n');
    if (lines.length < 2) return [];

    // Skip header line
    return lines
        .slice(1)
        .map(line => {
            const parts = line.split(',');
            if (parts.length < 5) return null;
            const [date, open, high, low, close, volume] = parts;
            const closeVal = parseFloat(close);
            if (isNaN(closeVal) || closeVal <= 0) return null;
            return {
                date:   new Date(date.trim()).toISOString(),
                open:   parseFloat(open)  || closeVal,
                high:   parseFloat(high)  || closeVal,
                low:    parseFloat(low)   || closeVal,
                close:  closeVal,
                volume: parseInt(volume || '0', 10),
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // ensure ascending
}

function toStooqDate(d) {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Ensure the symbol has .NS suffix for Indian NSE stocks.
 * Indices like NIFTY 50 use ^NSEI on Stooq.
 */
function toStooqSymbol(symbol) {
    if (symbol.startsWith('^')) {
        // Map common index symbols
        const indexMap = {
            '^NSEI':    '^nsei',
            '^NSEBANK': '^nsebank',
            '^BSESN':   '^bsesn',
        };
        return indexMap[symbol.toUpperCase()] || symbol.toLowerCase();
    }
    // For equities: ensure .ns suffix, lowercase
    return symbol.replace(/\.(NS|BO)$/i, '').toLowerCase() + '.ns';
}

module.exports = {
    /**
     * Fetch historical OHLCV data for a stock.
     * @param {string} symbol  e.g. "HDFCBANK.NS" or "TCS.NS"
     * @param {string} period  one of: 1w, 1mo, 3mo, 6mo, 1y, 5y, max
     * @returns {Array} sorted ascending array of { date, open, high, low, close, volume }
     */
    async historical(symbol, period) {
        const cfg = PERIOD_MAP[period] || PERIOD_MAP['1mo'];
        const stooqSym = toStooqSymbol(symbol);
        const now = new Date();

        let url = `${STOOQ_BASE}?s=${encodeURIComponent(stooqSym)}&i=${cfg.interval}`;

        if (cfg.lookbackDays !== null) {
            const d1 = new Date(now - cfg.lookbackDays * 86400000);
            url += `&d1=${toStooqDate(d1)}&d2=${toStooqDate(now)}`;
        }

        const r = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                'Referer': 'https://stooq.com/',
            },
            timeout: 12000,
        });

        const data = parseCSV(r.data);

        if (data.length === 0) {
            throw new Error(`Stooq returned no data for ${symbol} (period=${period})`);
        }

        return data;
    },
};
