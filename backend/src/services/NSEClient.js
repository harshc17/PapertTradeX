/**
 * NSEClient.js — Wraps NSE India's unofficial public API
 *
 * NSE requires a valid browser session (cookie) obtained by hitting the homepage first.
 * This client handles that automatically and refreshes the session every 20 minutes.
 *
 * Backoff: if session init fails 3 consecutive times, backoff for up to 2 minutes
 * before retrying. This prevents hammering NSE when it returns 403.
 *
 * All data is sourced directly from NSE servers — most accurate source for Indian equities.
 * No API key required. No rate limits documented (but 3-5s polling is safe).
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BASE_HEADERS = {
    'User-Agent':               UA,
    'Accept-Language':          'en-US,en;q=0.9',
    'Accept-Encoding':          'gzip, deflate, br',
    'Connection':               'keep-alive',
    'Cache-Control':            'max-age=0',
    'Upgrade-Insecure-Requests':'1',
    'sec-fetch-dest':           'document',
    'sec-fetch-mode':           'navigate',
    'sec-fetch-site':           'none',
    'sec-fetch-user':           '?1',
};

// Backoff schedule (ms): 5s, 15s, 30s, 60s, 120s, then stay at 120s
const BACKOFF_SCHEDULE = [5000, 15000, 30000, 60000, 120000];

class NSEClient {
    constructor() {
        this._cookies      = '';
        this._cookieTs     = 0;
        this._failCount    = 0;      // consecutive session-init failures
        this._backoffUntil = 0;      // timestamp until which we do NOT retry session init
        this._initPromise  = null;   // deduplication: in-flight session init
        this._http = axios.create({ timeout: 12000 });
    }

    get _sessionValid() {
        return this._cookies && (Date.now() - this._cookieTs < 20 * 60 * 1000);
    }

    get _inBackoff() {
        return Date.now() < this._backoffUntil;
    }

    /** True once the backoff window just expired and we're about to retry */
    get _backoffJustExpired() {
        return this._failCount > 0 && !this._inBackoff && this._cookies === '';
    }

    async _initSession() {
        if (this._sessionValid) return;
        if (this._inBackoff) {
            return; // silently wait — backoff status was logged on entry
        }

        // Deduplicate: if another caller is already fetching the session, wait for theirs
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInit().finally(() => {
            this._initPromise = null;
        });
        return this._initPromise;
    }

    async _doInit() {
        try {
            const r = await this._http.get('https://www.nseindia.com', {
                headers: {
                    ...BASE_HEADERS,
                    Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
                },
                maxRedirects: 5,
            });
            const raw = r.headers['set-cookie'] || [];
            this._cookies   = (Array.isArray(raw) ? raw : [raw])
                .map(c => c.split(';')[0])
                .join('; ');
            this._cookieTs  = Date.now();
            this._failCount = 0;
            this._backoffUntil = 0;
            console.log('[NSE] Session initialized ✓');
        } catch (e) {
            this._failCount++;
            const backoffMs = BACKOFF_SCHEDULE[Math.min(this._failCount - 1, BACKOFF_SCHEDULE.length - 1)];
            this._backoffUntil = Date.now() + backoffMs;
            const status = e.response?.status || 'ECONNREFUSED';
            console.warn(`[NSE] Session init failed (${status}) — backoff ${backoffMs / 1000}s (attempt #${this._failCount})`);
        }
    }

    async _get(path, retries = 1) {
        await this._initSession();
        if (!this._cookies) throw new Error('NSE session not available');

        const url = `https://www.nseindia.com${path}`;
        try {
            const r = await this._http.get(url, {
                headers: {
                    ...BASE_HEADERS,
                    Accept:             'application/json, text/plain, */*',
                    Referer:            'https://www.nseindia.com/',
                    Cookie:             this._cookies,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            return r.data;
        } catch (e) {
            // Transient network timeout: retry once.
            if (retries > 0 && (e.code === 'ECONNABORTED' || String(e.message || '').includes('timeout'))) {
                return this._get(path, retries - 1);
            }
            // Session expired — refresh and retry once
            if (retries > 0 && (e.response?.status === 401 || e.response?.status === 403 || e.response?.status === 429)) {
                console.warn('[NSE] Auth error, refreshing session...');
                this._cookieTs = 0;
                this._cookies  = '';
                await this._initSession();
                return this._get(path, retries - 1);
            }
            throw e;
        }
    }

    // ──────────────── Public Methods ────────────────

    /**
     * Real-time quote for a single NSE equity.
     * @param {string} symbol  e.g. "HDFCBANK" or "HDFCBANK.NS"
     */
    async equityQuote(symbol) {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        return this._get(`/api/quote-equity?symbol=${encodeURIComponent(bare)}`);
    }

    /**
     * All constituent quotes for an NSE index.
     * e.g. "NIFTY 50", "NIFTY BANK", "NIFTY NEXT 50"
     */
    async indexConstituents(indexName) {
        return this._get(`/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`);
    }

    /**
     * All major indices (includes Sensex, Nifty 50, Bank Nifty, etc.)
     */
    async allIndices() {
        return this._get('/api/allIndices');
    }

    /**
     * Intraday chart data for an NSE equity (5-min candles, current day).
     * @param {string} symbol  e.g. "HDFCBANK"
     */
    async intradayChart(symbol) {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        return this._get(`/api/chart-databyindex?index=${bare}EQ&indices=false`);
    }

    /** Returns true if NSE market is likely open (Mon–Fri, 9:15–15:30 IST) */
    static isMarketHours() {
        const now = new Date();
        // Convert to IST
        const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        
        // 1. Weekend Check
        const day = ist.getDay(); // 0=Sun, 6=Sat
        if (day === 0 || day === 6) return false;

        // 2. Holiday Check (YYYY-MM-DD format)
        const dateString = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
        const NSE_HOLIDAYS = [
            // 2026 Known Trading Holidays
            '2026-01-26', // Republic Day
            '2026-03-20', // Id-ul-Fitr (Tentative)
            '2026-04-03', // Good Friday
            '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
            '2026-05-01', // Maharashtra Day
            '2026-08-15', // Independence Day
            '2026-10-02', // Mahatma Gandhi Jayanti
            '2026-11-09', // Diwali
            '2026-12-25', // Christmas
            
            // 2025 Known Trading Holidays
            '2025-01-26', '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', '2025-04-14', 
            '2025-04-18', '2025-05-01', '2025-08-15', '2025-08-27', '2025-10-02', '2025-10-21', 
            '2025-11-05', '2025-12-25'
        ];
        if (NSE_HOLIDAYS.includes(dateString)) return false;

        // 3. Time Check (9:15 to 15:30)
        const h = ist.getHours();
        const m = ist.getMinutes();
        const totalMin = h * 60 + m;
        return totalMin >= 9 * 60 + 15 && totalMin <= 15 * 60 + 30;
    }

    // ──────────────── Data Normalizer ────────────────

    /**
     * Normalize NSE's equityQuote response into our standard quote format.
     */
    static normalizeQuote(nsData, symbolWithSuffix) {
        const pi   = nsData?.priceInfo      || {};
        const info = nsData?.info           || {};
        const meta = nsData?.metadata       || {};
        const whl  = pi?.weekHighLow        || {};

        const mcapCr = parseFloat((meta.pdMarketCapFull || '').replace(/,/g, '')) || null;

        return {
            symbol:                     symbolWithSuffix,
            shortName:                  info.companyName || meta.companyName || symbolWithSuffix,
            regularMarketPrice:         pi.lastPrice      ?? 0,
            regularMarketChange:        pi.change         ?? 0,
            regularMarketChangePercent: pi.pChange        ?? 0,
            regularMarketPreviousClose: pi.previousClose  ?? 0,
            regularMarketOpen:          pi.open           ?? 0,
            regularMarketDayHigh:       pi.intraDayHighLow?.max ?? pi.dayHigh ?? 0,
            regularMarketDayLow:        pi.intraDayHighLow?.min ?? pi.dayLow  ?? 0,
            regularMarketVolume:        meta.totalTradedVolume  ?? 0,
            marketCap:                  mcapCr,
            marketCapUnit:              'Cr',
            fiftyTwoWeekHigh:           whl.max ?? null,
            fiftyTwoWeekLow:            whl.min ?? null,
            pe:                         parseFloat(meta.pdSymbolPe) || null,
            industry:                   meta.industry || info.industry || null,
            sector:                     nsData?.industryInfo?.sector || null,
            currency:                   'INR',
            exchange:                   'NSE',
            quoteType:                  'EQUITY',
            profile:                    null,
        };
    }
}

module.exports = new NSEClient();
