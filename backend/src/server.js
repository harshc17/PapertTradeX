require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const MarketDataService = require('./services/MarketData');
const TradeEngine = require('./services/TradeEngine');
const { connectDB, User, Order, WeeklyChallenge, WeeklyChallengeTrade, seedAdmin } = require('./models');
const NSEClient = require('./services/NSEClient');
const HistoricalClient = require('./services/HistoricalClient');
const AIService = require('./services/AIService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'papertradex_secret_key_123'; // In prod, use env var

const marketDataService = new MarketDataService(io);
marketDataService.startPolling();

// Temporary override: allow orders outside market hours.
// Set to false when you want strict market-hours enforcement again.
const TEMP_ALLOW_AFTER_HOURS_TRADING = true;

// ── Connect to MongoDB + seed admin ─────────────────────────────────────────
(async () => {
    try {
        await connectDB();
        await seedAdmin();
    } catch (error) {
        console.error('[MongoDB] Startup error:', error.message);
    }
})();

const PORT = 3001;

app.get('/', (req, res) => res.send('PaperTradeX Backend Running'));

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    const { name, phone, email, password } = req.body;
    try {
        if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(409).json({ error: 'Email already registered' });

        const password_hash = await bcrypt.hash(password, 10);
        const user = await User.create({ name, phone, email, password_hash });

        const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email?.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'User not found' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- PROTECTED TRADING ROUTES ---

// Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
            return next();
        }

        // Allow a short grace window for recently expired but otherwise valid tokens.
        // This prevents random 403s in long-lived browser sessions in local/dev usage.
        if (err.name === 'TokenExpiredError') {
            try {
                const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
                const nowSec = Math.floor(Date.now() / 1000);
                const graceSec = 7 * 24 * 60 * 60; // 7 days
                if (decoded?.exp && (nowSec - decoded.exp) <= graceSec) {
                    req.user = { id: decoded.id, role: decoded.role };
                    return next();
                }
            } catch (_) {
                // fall through to 403
            }
        }

        return res.status(403).json({ error: 'Session expired. Please login again.' });
    });
}

// Comprehensive local search index with full Yahoo-compatible symbols
const LOCAL_STOCK_INDEX = [
    // Nifty 50 Blue Chips
    { symbol: 'RELIANCE.NS', shortname: 'Reliance Industries', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'TCS.NS', shortname: 'Tata Consultancy Services', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HDFCBANK.NS', shortname: 'HDFC Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'INFY.NS', shortname: 'Infosys', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ICICIBANK.NS', shortname: 'ICICI Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'SBIN.NS', shortname: 'State Bank of India', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HINDUNILVR.NS', shortname: 'Hindustan Unilever', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BAJFINANCE.NS', shortname: 'Bajaj Finance', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'KOTAKBANK.NS', shortname: 'Kotak Mahindra Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'LT.NS', shortname: 'Larsen & Toubro', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'AXISBANK.NS', shortname: 'Axis Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ASIANPAINT.NS', shortname: 'Asian Paints', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'MARUTI.NS', shortname: 'Maruti Suzuki', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'SUNPHARMA.NS', shortname: 'Sun Pharmaceutical', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'TATAMOTORS.NS', shortname: 'Tata Motors', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'WIPRO.NS', shortname: 'Wipro', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ULTRACEMCO.NS', shortname: 'UltraTech Cement', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ITC.NS', shortname: 'ITC Limited', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'NESTLEIND.NS', shortname: 'Nestle India', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'NTPC.NS', shortname: 'NTPC', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'POWERGRID.NS', shortname: 'Power Grid Corporation', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ONGC.NS', shortname: 'Oil and Natural Gas Corporation', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BHARTIARTL.NS', shortname: 'Bharti Airtel', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'M&M.NS', shortname: 'Mahindra & Mahindra', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'TECHM.NS', shortname: 'Tech Mahindra', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'TATASTEEL.NS', shortname: 'Tata Steel', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HCLTECH.NS', shortname: 'HCL Technologies', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'DIVISLAB.NS', shortname: "Divi's Laboratories", quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'DRREDDY.NS', shortname: "Dr. Reddy's Laboratories", quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'CIPLA.NS', shortname: 'Cipla', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'EICHERMOT.NS', shortname: 'Eicher Motors', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BAJAJFINSV.NS', shortname: 'Bajaj Finserv', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'GRASIM.NS', shortname: 'Grasim Industries', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'TITAN.NS', shortname: 'Titan Company', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HDFC.NS', shortname: 'HDFC', quoteType: 'EQUITY', exchange: 'NSE' },
    // Mid Caps / Popular
    { symbol: 'ZOMATO.NS', shortname: 'Zomato', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'PAYTM.NS', shortname: 'One 97 Communications (Paytm)', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'NYKAA.NS', shortname: 'FSN E-Commerce Ventures (Nykaa)', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'POLICYBZR.NS', shortname: 'PB Fintech (PolicyBazaar)', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ADANIENT.NS', shortname: 'Adani Enterprises', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ADANIPOWER.NS', shortname: 'Adani Power', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'ADANIPORTS.NS', shortname: 'Adani Ports', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'INDUSINDBK.NS', shortname: 'IndusInd Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BANKBARODA.NS', shortname: 'Bank of Baroda', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'CANBK.NS', shortname: 'Canara Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'PNB.NS', shortname: 'Punjab National Bank', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'IRFC.NS', shortname: 'Indian Railway Finance Corporation', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HAL.NS', shortname: 'Hindustan Aeronautics', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BEL.NS', shortname: 'Bharat Electronics', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BHEL.NS', shortname: 'Bharat Heavy Electricals', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'COALINDIA.NS', shortname: 'Coal India', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'RECLTD.NS', shortname: 'REC Limited', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'PFC.NS', shortname: 'Power Finance Corporation', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'VEDL.NS', shortname: 'Vedanta', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HINDALCO.NS', shortname: 'Hindalco Industries', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'JSWSTEEL.NS', shortname: 'JSW Steel', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HDFCAMC.NS', shortname: 'HDFC Asset Management', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'PIDILITIND.NS', shortname: 'Pidilite Industries', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HAVELLS.NS', shortname: 'Havells India', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'VOLTAS.NS', shortname: 'Voltas', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'TATAPOWER.NS', shortname: 'Tata Power', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'MRF.NS', shortname: 'MRF', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'HEROMOTOCO.NS', shortname: 'Hero MotoCorp', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'BAJAJ-AUTO.NS', shortname: 'Bajaj Auto', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'APOLLOHOSP.NS', shortname: 'Apollo Hospitals', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'MAXHEALTH.NS', shortname: 'Max Healthcare', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'FORTIS.NS', shortname: 'Fortis Healthcare', quoteType: 'EQUITY', exchange: 'NSE' },
    { symbol: 'IRCTC.NS', shortname: 'Indian Railway Catering & Tourism', quoteType: 'EQUITY', exchange: 'NSE' },
    // ETFs
    { symbol: 'NIFTYBEES.NS', shortname: 'Nippon India Nifty BeES ETF', quoteType: 'ETF', exchange: 'NSE' },
    { symbol: 'JUNIORBEES.NS', shortname: 'Nippon India Junior BeES ETF', quoteType: 'ETF', exchange: 'NSE' },
    { symbol: 'GOLDBEES.NS', shortname: 'Nippon India Gold BeES ETF', quoteType: 'ETF', exchange: 'NSE' },
    { symbol: 'BANKBEES.NS', shortname: 'Nippon India Bank BeES ETF', quoteType: 'ETF', exchange: 'NSE' },
    // Indices
    { symbol: '^NSEI', shortname: 'NIFTY 50', quoteType: 'INDEX', exchange: 'NSE' },
    { symbol: '^BSESN', shortname: 'SENSEX', quoteType: 'INDEX', exchange: 'BSE' },
    { symbol: '^NSEBANK', shortname: 'BANK NIFTY', quoteType: 'INDEX', exchange: 'NSE' },
    { symbol: '^NSMIDCP100', shortname: 'NIFTY MIDCAP 100', quoteType: 'INDEX', exchange: 'NSE' },
];

const STOCK_META = new Map(
    LOCAL_STOCK_INDEX.map(item => [item.symbol.replace(/\.(NS|BO)$/i, '').toUpperCase(), item])
);

function getSymbolMeta(symbol) {
    return STOCK_META.get(symbol.replace(/\.(NS|BO)$/i, '').toUpperCase()) || null;
}

function shouldPreferYahoo(symbol) {
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
    const meta = getSymbolMeta(bare);
    return bare.startsWith('^') || meta?.quoteType === 'ETF';
}

app.get('/api/market-status', (req, res) => {
    res.json({ isOpen: NSEClient.constructor.isMarketHours() });
});

const SEARCH_CACHE = {};
const SEARCH_CACHE_TTL = 60 * 1000 * 5; // 5 minutes

app.get('/api/search', async (req, res) => {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) return res.json({ quotes: [] });

    if (SEARCH_CACHE[q] && Date.now() - SEARCH_CACHE[q].timestamp < SEARCH_CACHE_TTL) {
        return res.json({ quotes: SEARCH_CACHE[q].data });
    }

    // 1. Always search local index first (instant, no API call)
    const localResults = LOCAL_STOCK_INDEX.filter(item =>
        item.symbol.toLowerCase().replace('.ns', '').includes(q) ||
        item.shortname.toLowerCase().includes(q)
    );

    // 2. If we need more results, ask Yahoo Finance (covers all Indian stocks/ETFs)
    if (localResults.length < 5) {
        try {
            const yhResults = await HistoricalClient.search(q);
            
            yhResults.forEach(y => {
                // Prioritize Indian exchanges
                const isIndian = y.exchange === 'NSI' || y.exchange === 'BSE' || (y.symbol && (y.symbol.endsWith('.NS') || y.symbol.endsWith('.BO')));
                if (isIndian && !localResults.find(l => l.symbol === y.symbol)) {
                    localResults.push({
                        symbol: y.symbol,
                        shortname: y.shortname || y.longname || y.symbol,
                        quoteType: y.quoteType || 'EQUITY',
                        exchange: y.exchange === 'NSI' ? 'NSE' : (y.exchange === 'BSE' ? 'BSE' : y.exchange)
                    });
                }
            });
        } catch (e) {
            console.error('[Search] Yahoo fallback failed:', e.message);
        }
    }

    const finalResults = localResults.slice(0, 10);
    SEARCH_CACHE[q] = { timestamp: Date.now(), data: finalResults };
    res.json({ quotes: finalResults });
});

const STOCK_CACHE = {};
const STOCK_CACHE_TTL = 10 * 1000; // 10 seconds (live enough, but avoids API spam)
const NSE_FAIL_CACHE = {};
const NSE_FAIL_TTL = 5 * 60 * 1000;
const CLOSED_PRICE_CACHE = {};

function markNseFailure(symbol) {
    NSE_FAIL_CACHE[symbol] = Date.now();
}

function recentlyFailedNse(symbol) {
    return NSE_FAIL_CACHE[symbol] && (Date.now() - NSE_FAIL_CACHE[symbol] < NSE_FAIL_TTL);
}

function getIstDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const get = (type) => parts.find(part => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatUtcDateKey(dateObj) {
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getPreviousBusinessDayKeyFromIstDate(istDateKey) {
    const [y, m, d] = istDateKey.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));

    do {
        dt.setUTCDate(dt.getUTCDate() - 1);
    } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);

    return formatUtcDateKey(dt);
}

function getClosedMarketSessionKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const pick = (type) => parts.find(p => p.type === type)?.value;
    const weekday = pick('weekday');
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    const hour = Number(pick('hour'));
    const minute = Number(pick('minute'));
    const todayKey = `${year}-${month}-${day}`;

    // Weekends should freeze to last business day's close.
    if (weekday === 'Sat' || weekday === 'Sun') {
        return getPreviousBusinessDayKeyFromIstDate(todayKey);
    }

    // Before market open (09:15 IST), still use previous business day's close.
    if (hour < 9 || (hour === 9 && minute < 15)) {
        return getPreviousBusinessDayKeyFromIstDate(todayKey);
    }

    // During/after same-day market close window, freeze to today's close.
    return todayKey;
}

async function getClosedMarketPrice(symbol, fallbackPrice = null) {
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
    const dateKey = getClosedMarketSessionKey();
    const frozen = CLOSED_PRICE_CACHE[bare];

    if (frozen?.dateKey === dateKey && typeof frozen.price === 'number') {
        return frozen;
    }

    const cached = marketDataService.cache[bare] || marketDataService.cache[bare + '.NS'];
    let price = null;
    let source = 'cache';

    try {
        const chartPrice = await HistoricalClient.latestPrice(bare);
        if (typeof chartPrice === 'number' && chartPrice > 0) {
            price = chartPrice;
            source = 'close';
        }
    } catch {
        // Use the last known in-memory price if chart data is unavailable.
    }

    if (!(price > 0) && typeof fallbackPrice === 'number' && fallbackPrice > 0) {
        price = fallbackPrice;
        source = 'fallback';
    }

    if (!(price > 0) && typeof cached?.price === 'number' && cached.price > 0) {
        price = cached.price;
        source = 'cache';
    }

    if (!(price > 0)) return null;

    const entry = {
        dateKey,
        price,
        source,
        timestamp: new Date(),
    };
    CLOSED_PRICE_CACHE[bare] = entry;

    const cacheEntry = {
        symbol: bare,
        shortname: cached?.shortname || bare,
        price,
        prevPrice: cached?.prevPrice ?? price,
        change: cached?.change ?? 0,
        dayChange: cached?.dayChange ?? 0,
        timestamp: entry.timestamp,
        isClosedMarketPrice: true,
    };
    marketDataService.cache[bare] = cacheEntry;
    marketDataService.cache[bare + '.NS'] = cacheEntry;

    return entry;
}

async function resolveChallengePrice(symbol) {
    const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
    const marketOpen = NSEClient.constructor.isMarketHours();
    const cached = marketDataService.cache[bare] || marketDataService.cache[bare + '.NS'];

    if (!marketOpen) {
        const closed = await getClosedMarketPrice(bare, cached?.price ?? null);
        if (closed?.price) return { symbol: bare, price: closed.price, source: `closed-${closed.source}` };
    }

    if (cached?.price) {
        return { symbol: bare, price: cached.price, source: 'cache' };
    }

    if (marketOpen && !shouldPreferYahoo(bare) && !recentlyFailedNse(bare)) {
        try {
            const ns = await NSEClient.equityQuote(bare);
            if (ns?.priceInfo?.lastPrice) {
                const price = ns.priceInfo.lastPrice;
                return { symbol: bare, price, source: 'nse' };
            }
        } catch {
            markNseFailure(bare);
        }
    }

    const yahooPrice = await HistoricalClient.latestPrice(bare);
    if (yahooPrice && yahooPrice > 0) {
        return { symbol: bare, price: yahooPrice, source: 'yahoo' };
    }

    throw new Error(`Price not available for ${bare}`);
}

async function loadCurrentChallenge(userId) {
    const challenge = await WeeklyChallenge.findOne({
        user: userId,
        status: { $in: ['ACTIVE', 'COMPLETED'] },
    }).sort({ createdAt: -1 });
    if (!challenge) return null;

    if (challenge.endAt.getTime() < Date.now() && challenge.status === 'ACTIVE') {
        challenge.status = 'EXPIRED';
        await challenge.save();
        return null;
    }

    if (challenge.endAt.getTime() < Date.now() && challenge.status === 'COMPLETED') {
        return null;
    }

    return challenge;
}

async function computeChallengeSnapshot(challengeDoc) {
    const challenge = challengeDoc.toObject ? challengeDoc.toObject() : challengeDoc;
    const positions = challenge.positions || [];

    const positionDetails = await Promise.all(
        positions.map(async (p) => {
            const q = await resolveChallengePrice(p.symbol);
            const currentValue = p.quantity * q.price;
            const invested = p.quantity * p.averagePrice;
            const pnl = currentValue - invested;
            return {
                symbol: p.symbol,
                quantity: p.quantity,
                averagePrice: p.averagePrice,
                ltp: q.price,
                currentValue: parseFloat(currentValue.toFixed(2)),
                pnl: parseFloat(pnl.toFixed(2)),
            };
        })
    );

    const positionsValue = positionDetails.reduce((acc, p) => acc + p.currentValue, 0);
    const equity = parseFloat((challenge.cashBalance + positionsValue).toFixed(2));
    const progressPercent = parseFloat(((equity / challenge.targetBalance) * 100).toFixed(2));
    const targetRemaining = parseFloat(Math.max(challenge.targetBalance - equity, 0).toFixed(2));

    return {
        id: challenge._id,
        status: challenge.status,
        startAt: challenge.startAt,
        endAt: challenge.endAt,
        initialBalance: challenge.initialBalance,
        targetBalance: challenge.targetBalance,
        cashBalance: parseFloat(challenge.cashBalance.toFixed(2)),
        equity,
        pnl: parseFloat((equity - challenge.initialBalance).toFixed(2)),
        progressPercent,
        targetRemaining,
        positions: positionDetails,
    };
}

// ─── Stock Detail (NSE primary → Yahoo Finance fallback) ────────────────────
app.get('/api/stock/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        const yahooPreferred = shouldPreferYahoo(bare);

        if (STOCK_CACHE[bare] && Date.now() - STOCK_CACHE[bare].timestamp < STOCK_CACHE_TTL) {
            return res.json(STOCK_CACHE[bare].data);
        }

        // ── 1. Try NSE (preferred — rich data when market is open) ──
        if (!yahooPreferred && !recentlyFailedNse(bare)) {
            try {
                const nsData = await NSEClient.equityQuote(bare);
                if (nsData?.priceInfo?.lastPrice) {
                const pi      = nsData?.priceInfo    || {};
                const info    = nsData?.info         || {};
                const meta    = nsData?.metadata     || {};
                const whl     = pi?.weekHighLow      || {};
                const ihLow   = pi?.intraDayHighLow  || {};
                const indInfo = nsData?.industryInfo || {};
                const secInfo = nsData?.securityInfo || {};

                const issuedShares = parseFloat(String(secInfo.issuedSize || '0').replace(/,/g, ''));
                const marketCapCr  = issuedShares > 0 && pi.lastPrice
                    ? parseFloat(((pi.lastPrice * issuedShares) / 1e7).toFixed(2))
                    : null;

                let currentPrice = pi.lastPrice ?? 0;
                
                // If market is closed, the user requested that the chart's final data point 
                // is the absolute source of truth to avoid visual discrepancies.
                if (!NSEClient.constructor.isMarketHours()) {
                    const closedPrice = await getClosedMarketPrice(bare, currentPrice);
                    if (closedPrice) currentPrice = closedPrice.price;
                }

                const data = {
                    symbol:                     bare + '.NS',
                    shortName:                  info.companyName || meta.companyName || bare,
                    regularMarketPrice:         currentPrice,
                    regularMarketChange:        pi.change         ?? 0,
                    regularMarketChangePercent: pi.pChange        ?? 0,
                    regularMarketPreviousClose: pi.previousClose  ?? 0,
                    regularMarketOpen:          pi.open           ?? 0,
                    regularMarketDayHigh:       ihLow.max         ?? 0,
                    regularMarketDayLow:        ihLow.min         ?? 0,
                    regularMarketVolume:        nsData?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume ?? 0,
                    vwap:                       pi.vwap           ?? null,
                    marketCap:                  marketCapCr,
                    marketCapUnit:              'Cr',
                    fiftyTwoWeekHigh:           whl.max           ?? null,
                    fiftyTwoWeekLow:            whl.min           ?? null,
                    fiftyTwoWeekHighDate:       whl.maxDate       ?? null,
                    fiftyTwoWeekLowDate:        whl.minDate       ?? null,
                    pe:                         meta.pdSymbolPe   ? parseFloat(meta.pdSymbolPe) : null,
                    sectorPe:                   meta.pdSectorPe   ? parseFloat(meta.pdSectorPe) : null,
                    industry:                   meta.industry     || indInfo.basicIndustry || null,
                    sector:                     indInfo.sector    || indInfo.macro || null,
                    indices:                    (meta.pdSectorIndAll || []).slice(0, 5),
                    currency:                   'INR',
                    exchange:                   'NSE',
                    quoteType:                  'EQUITY',
                    profile:                    null,
                    dataSource:                 'nse',
                };
                STOCK_CACHE[bare] = { timestamp: Date.now(), data };
                return res.json(data);
            }
            } catch {
                markNseFailure(bare);
            }
        }

        // ── 2. Yahoo Finance fallback (works when market is closed) ──
        if (!yahooPreferred && !recentlyFailedNse(bare)) {
            console.log(`[Stock] NSE unavailable for ${bare}, using Yahoo Finance fallback`);
        }
        markNseFailure(bare);
        const yhSymbol = bare + '.NS';
        const yData = await HistoricalClient.quoteDetail(bare);

        if (!yData) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        // Also try to get 52-week range from chart summary
        let w52High = yData.fiftyTwoWeekHigh ?? null;
        let w52Low  = yData.fiftyTwoWeekLow  ?? null;
        
        let currentPrice = yData.regularMarketPrice ?? 0;
        if (!NSEClient.constructor.isMarketHours()) {
            const closedPrice = await getClosedMarketPrice(bare, currentPrice);
            if (closedPrice) currentPrice = closedPrice.price;
        }

        const data = {
            symbol:                     yhSymbol,
            shortName:                  yData.shortName || yData.longName || bare,
            regularMarketPrice:         currentPrice,
            regularMarketChange:        yData.regularMarketChange        ?? 0,
            regularMarketChangePercent: yData.regularMarketChangePercent ?? 0,
            regularMarketPreviousClose: yData.regularMarketPreviousClose ?? 0,
            regularMarketOpen:          yData.regularMarketOpen          ?? 0,
            regularMarketDayHigh:       yData.regularMarketDayHigh       ?? 0,
            regularMarketDayLow:        yData.regularMarketDayLow        ?? 0,
            regularMarketVolume:        yData.regularMarketVolume        ?? 0,
            vwap:                       null,
            marketCap:                  yData.marketCap ? yData.marketCap / 1e7 : null, // convert to Cr
            marketCapUnit:              'Cr',
            fiftyTwoWeekHigh:           w52High,
            fiftyTwoWeekLow:            w52Low,
            fiftyTwoWeekHighDate:       null,
            fiftyTwoWeekLowDate:        null,
            pe:                         yData.trailingPE ?? null,
            sectorPe:                   null,
            industry:                   yData.industry   ?? null,
            sector:                     yData.sector     ?? null,
            indices:                    [],
            currency:                   yData.currency   ?? 'INR',
            exchange:                   'NSE',
            quoteType:                  yData.quoteType  ?? 'EQUITY',
            profile:                    null,
            dataSource:                 'yahoo',
        };
        STOCK_CACHE[bare] = { timestamp: Date.now(), data };
        return res.json(data);
    } catch (error) {
        console.error('[Stock] Detail error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── AI Generated News — per-symbol daily cache ────────────────────────────
// Each symbol's AI news is generated once per calendar day (IST) and cached.
const _stockNewsCache = new Map(); // key: "SYMBOL:DATE", value: newsObject

app.get('/api/stock/:symbol/news', async (req, res) => {
    const { symbol } = req.params;
    try {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        const today = _todayIST ? _todayIST() : new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        const cacheKey = `${bare}:${today}`;

        // Return cached result if available
        if (_stockNewsCache.has(cacheKey)) {
            return res.json({ ..._stockNewsCache.get(cacheKey), cached: true });
        }

        const meta = getSymbolMeta(bare);
        const companyName = meta?.shortname || bare;

        console.log(`[AI Stock News] Generating for ${bare} (${companyName})`);
        const news = await AIService.generateNews(bare, companyName);
        const result = { ...news, generatedAt: new Date().toISOString() };
        _stockNewsCache.set(cacheKey, result);

        // Prune old cache entries (keep only today's data)
        for (const [k] of _stockNewsCache) {
            if (!k.endsWith(today)) _stockNewsCache.delete(k);
        }

        res.json({ ...result, cached: false });
    } catch (error) {
        console.error('[AI News] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/ai/portfolio', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        const { holdings } = req.body;
        
        if (!holdings || !Array.isArray(holdings)) {
            return res.status(400).json({ error: "Holdings data is required" });
        }
        
        const analysis = await AIService.analyzePortfolio(holdings, user.balance);
        res.json(analysis);
    } catch (error) {
        console.error('[AI Portfolio] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { question, history } = req.body;
        if (!question || typeof question !== 'string') {
            return res.status(400).json({ error: "Valid question string is required." });
        }
        
        const answer = await AIService.askQuestion(question, history || []);
        res.json({ answer });
    } catch (error) {
        console.error('[AI Chat] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── Daily-cached AI Market News ─────────────────────────────────────────────
// News is generated ONCE per day via AI and cached in-memory.
// At midnight IST, the cache expires and new news is generated on next request.
let _newsCache = null;
let _newsCacheDate = '';

function _todayIST() {
    return new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

app.get('/api/ai/market-news', async (req, res) => {
    try {
        const today = _todayIST();
        // Serve cached news if it was generated today
        if (_newsCache && _newsCacheDate === today) {
            return res.json({ ..._newsCache, cached: true });
        }
        // Generate fresh news
        console.log('[AI Market News] Generating fresh news for', today);
        const news = await AIService.generateMarketNews();
        _newsCache = { ...news, generatedAt: new Date().toISOString() };
        _newsCacheDate = today;
        res.json({ ..._newsCache, cached: false });
    } catch (error) {
        console.error('[AI Market News] Error:', error.message);
        // Return stale cache if available rather than erroring
        if (_newsCache) return res.json({ ..._newsCache, cached: true });
        res.status(500).json({ error: error.message });
    }
});

// Force-refresh endpoint (admin/debug use)
app.post('/api/ai/market-news/refresh', async (req, res) => {
    try {
        console.log('[AI Market News] Force refreshing news...');
        _newsCache = null;
        _newsCacheDate = '';
        const news = await AIService.generateMarketNews();
        _newsCache = { ...news, generatedAt: new Date().toISOString() };
        _newsCacheDate = _todayIST();
        res.json({ ..._newsCache, cached: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/indices', async (req, res) => {
    const INDEX_KEYS = ['^NSEI', '^BSESN', '^NSEBANK', '^MIDCPNIFTY', '^FINNIFTY'];
    const INDEX_LABELS = {
        '^NSEI': 'NIFTY 50',
        '^BSESN': 'SENSEX',
        '^NSEBANK': 'BANK NIFTY',
        '^MIDCPNIFTY': 'MIDCPNIFTY',
        '^FINNIFTY': 'FINNIFTY',
    };
    // Yahoo Finance symbols for the indices it supports
    const YAHOO_SYMBOLS = {
        '^NSEI': '^NSEI',
        '^BSESN': '^BSESN',
        '^NSEBANK': '^NSEBANK',
        // MIDCPNIFTY and FINNIFTY are NOT on Yahoo — use NSE allIndices only
    };
    // NSE allIndices name → our key (for direct NSE fallback)
    const NSE_NAME_MAP = {
        'NIFTY 50':                  '^NSEI',
        'NIFTY BANK':                '^NSEBANK',
        'NIFTY MIDCAP SELECT':       '^MIDCPNIFTY',
        'NIFTY FINANCIAL SERVICES':  '^FINNIFTY',
        'S&P BSE SENSEX':            '^BSESN',
        'S&P BSE Sensex':            '^BSESN',
        'BSE SENSEX':                '^BSESN',
        'SENSEX':                    '^BSESN',
    };

    const result = {};

    // Step 1: check in-memory cache
    for (const key of INDEX_KEYS) {
        const cached = marketDataService.cache[key];
        if (cached) result[key] = cached;
    }

    const missing = INDEX_KEYS.filter(k => !result[k]);
    if (missing.length > 0) {
        // Step 2: call NSE allIndices directly for any missing (catches MIDCPNIFTY & FINNIFTY)
        try {
            const nseData = await NSEClient.allIndices();
            const indices = nseData?.data || [];
            for (const idx of indices) {
                const key = NSE_NAME_MAP[idx.index];
                if (!key || result[key]) continue;
                const d = {
                    symbol:    key,
                    shortname: INDEX_LABELS[key] || idx.index,
                    price:     idx.last         ?? 0,
                    prevPrice: marketDataService.cache[key]?.price ?? (idx.last ?? 0),
                    change:    idx.variation     ?? 0,
                    dayChange: idx.percentChange ?? 0,
                    timestamp: new Date(),
                };
                marketDataService.cache[key] = d;
                result[key] = d;
            }
        } catch {
            // NSE unavailable — fall through to Yahoo for the ones it supports
        }

        // Step 3: Yahoo Finance fallback for remaining missing (NSEI, BSESN, NSEBANK only)
        await Promise.allSettled(
            missing.map(async (key) => {
                if (result[key] || !YAHOO_SYMBOLS[key]) return;
                try {
                    const q = await HistoricalClient.indexQuote(YAHOO_SYMBOLS[key]);
                    if (!q) return;
                    const d = {
                        symbol:    key,
                        shortname: INDEX_LABELS[key] || key,
                        price:     q.price,
                        prevPrice: q.prevClose,
                        change:    q.change,
                        dayChange: q.dayChange,
                        timestamp: new Date(),
                    };
                    marketDataService.cache[key] = d;
                    result[key] = d;
                } catch {
                    // silent
                }
            })
        );
    }

    res.json(result);
});



// ─── Realtime Price (cache → NSE → Yahoo Finance fallback) ──────────────────
app.get('/api/stock/:symbol/realtime', async (req, res) => {
    const { symbol } = req.params;
    try {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        const yahooPreferred = shouldPreferYahoo(bare);
        const marketOpen = NSEClient.constructor.isMarketHours();
        const cached = marketDataService.cache[bare] || marketDataService.cache[bare + '.NS'];

        if (!marketOpen) {
            const closedPrice = await getClosedMarketPrice(bare, cached?.price ?? null);
            const frozenCache = marketDataService.cache[bare] || marketDataService.cache[bare + '.NS'] || cached;

            if (closedPrice) {
                return res.json({
                    symbol:    bare,
                    price:     closedPrice.price,
                    change:    frozenCache?.change    ?? 0,
                    dayChange: frozenCache?.dayChange ?? 0,
                    timestamp: closedPrice.timestamp,
                    source:    `closed-market-${closedPrice.source}`,
                    marketOpen: false,
                });
            }

            if (cached) {
                return res.json({ ...cached, source: 'closed-market-cache', marketOpen: false });
            }
        }

        // 1. Check in-memory cache first (fast path — data is <= 5s old)
        if (cached && (Date.now() - new Date(cached.timestamp).getTime()) < 5000) {
            return res.json({
                symbol:    bare,
                price:     cached.price,
                change:    cached.change,
                dayChange: cached.dayChange,
                timestamp: cached.timestamp,
                source:    'cache',
            });
        }

        // 2. Try fresh NSE fetch (works during market hours)
        if (!yahooPreferred && !recentlyFailedNse(bare)) {
            try {
                const ns = await NSEClient.equityQuote(bare);
                if (ns?.priceInfo?.lastPrice) {
                const pi = ns.priceInfo;
                marketDataService.subscribe(bare);
                return res.json({
                    symbol:    bare,
                    price:     pi.lastPrice,
                    change:    pi.change    ?? 0,
                    dayChange: pi.pChange   ?? 0,
                    timestamp: new Date(),
                    source:    'nse',
                });
            }
            } catch {
                markNseFailure(bare);
            }
        }

        // 3. Yahoo Finance fallback — get latest close from chart data
        try {
            const price = await HistoricalClient.latestPrice(bare);
            if (price) {
                // Also cache this value
                const entry = cached || {};
                return res.json({
                    symbol:    bare,
                    price:     price,
                    change:    entry.change    ?? 0,
                    dayChange: entry.dayChange ?? 0,
                    timestamp: new Date(),
                    source:    'yahoo',
                });
            }
        } catch { /* Yahoo also failed */ }

        // 4. Return stale cache if available (better than nothing)
        if (cached) {
            return res.json({ ...cached, source: 'stale-cache' });
        }

        res.status(404).json({ error: 'Price not available' });
    } catch (error) {
        console.error('[Realtime] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── Chart History (NSE intraday for 1D + Yahoo Finance for all other periods) ──
app.get('/api/stock/:symbol/history', async (req, res) => {
    const { symbol } = req.params;
    const { period = '1mo' } = req.query;

    try {
        let data = [];
        let prevClose = null;
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
        const yahooPreferred = shouldPreferYahoo(bare);

        if (period === '1d' && !yahooPreferred) {
            // ── 1D: Try NSE intraday chart (5-min candles) first ──
            try {
                const raw = await NSEClient.intradayChart(bare);
                const points = raw?.grapthData || raw?.graphData || [];
                const nseData = points
                    .filter(([ts, price]) => price && price > 0)
                    .map(([ts, price]) => ({
                        date:   new Date(ts).toISOString(),
                        open:   price,
                        high:   price,
                        low:    price,
                        close:  price,
                        volume: 0,
                    }));

                if (nseData.length >= 5) {
                    data = nseData;
                    console.log(`[Chart] NSE 1D: ${nseData.length} points for ${bare}`);
                }
            } catch (_) { }

            // ── Fallback: Yahoo Finance 2-min bars for the last trading day ──
            if (!data || data.length < 5) {
                console.log(`[Chart] 1D NSE empty for ${symbol}, using Yahoo Finance 2m bars`);
                try {
                    const yhResult = await HistoricalClient.historical(symbol, '1d');
                    data = yhResult.data;
                    prevClose = yhResult.prevClose;
                } catch (yErr) {
                    console.warn('[Chart] Yahoo 1D also failed:', yErr.message);
                }
            }

            // NSE path: derive prevClose from cache if not already set.
            // NSE's `change` = absolute delta vs. previous close → prevClose = price – change.
            if (!prevClose) {
                const cached = marketDataService.cache[bare] || marketDataService.cache[bare + '.NS'];
                if (cached?.price != null && cached?.change != null) {
                    const derived = parseFloat((cached.price - cached.change).toFixed(2));
                    if (derived > 0) prevClose = derived;
                }
            }
        } else {
            // ── 1W → MAX: Yahoo Finance chart() — reliable for historical OHLCV ──
            const yhResult = await HistoricalClient.historical(symbol, period);
            data = yhResult.data;
            // prevClose is only meaningful for 1D; null for longer periods
        }

        res.json({ data: data || [], prevClose });
    } catch (error) {
        console.error('[Chart] History error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/portfolio', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const portfolio = await TradeEngine.getPortfolio(userId);
        const user = await User.findById(userId);
        res.json({ balance: user.balance, holdings: portfolio });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/challenge/accept', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const existing = await loadCurrentChallenge(userId);
        if (existing) {
            const snapshot = await computeChallengeSnapshot(existing);
            return res.json({ success: true, challenge: snapshot, reused: true });
        }

        const startAt = new Date();
        const endAt = new Date(startAt.getTime() + (7 * 24 * 60 * 60 * 1000));

        const challenge = await WeeklyChallenge.create({
            user: userId,
            status: 'ACTIVE',
            initialBalance: 10000,
            targetBalance: 15000,
            cashBalance: 10000,
            positions: [],
            startAt,
            endAt,
        });

        const snapshot = await computeChallengeSnapshot(challenge);
        res.json({ success: true, challenge: snapshot, reused: false });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/challenge/state', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const challenge = await loadCurrentChallenge(userId);
        if (!challenge) {
            return res.json({ challenge: null });
        }

        const snapshot = await computeChallengeSnapshot(challenge);

        if (snapshot.equity >= snapshot.targetBalance && challenge.status === 'ACTIVE') {
            challenge.status = 'COMPLETED';
            challenge.completedAt = new Date();
            await challenge.save();
            snapshot.status = 'COMPLETED';
        }

        res.json({ challenge: snapshot });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/challenge/trade', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { symbol, type, quantity } = req.body;

        const challenge = await loadCurrentChallenge(userId);
        if (!challenge) {
            return res.status(400).json({ error: 'No active challenge. Accept the weekly challenge first.' });
        }
        if (challenge.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'Challenge is already completed for this week.' });
        }

        const side = String(type || '').toUpperCase();
        if (!['BUY', 'SELL'].includes(side)) {
            return res.status(400).json({ error: 'Trade type must be BUY or SELL' });
        }

        const qty = parseInt(quantity, 10);
        if (!qty || qty <= 0 || !Number.isInteger(qty)) {
            return res.status(400).json({ error: 'Quantity must be a positive whole number' });
        }

        if (!symbol || typeof symbol !== 'string') {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        const quote = await resolveChallengePrice(symbol);
        const bare = quote.symbol;
        const price = quote.price;
        const totalAmount = parseFloat((qty * price).toFixed(2));

        const positions = challenge.positions || [];
        const idx = positions.findIndex(p => p.symbol === bare);

        if (side === 'BUY') {
            if (challenge.cashBalance < totalAmount) {
                return res.status(400).json({
                    error: `Insufficient challenge cash. Required: ₹${totalAmount.toFixed(2)}, Available: ₹${challenge.cashBalance.toFixed(2)}`,
                });
            }

            challenge.cashBalance = parseFloat((challenge.cashBalance - totalAmount).toFixed(2));

            if (idx >= 0) {
                const p = positions[idx];
                const newQty = p.quantity + qty;
                const newAvg = ((p.quantity * p.averagePrice) + totalAmount) / newQty;
                p.quantity = newQty;
                p.averagePrice = parseFloat(newAvg.toFixed(4));
            } else {
                positions.push({ symbol: bare, quantity: qty, averagePrice: price });
            }
        } else {
            if (idx < 0 || positions[idx].quantity < qty) {
                return res.status(400).json({ error: `Insufficient challenge holdings for ${bare}` });
            }

            const p = positions[idx];
            p.quantity -= qty;
            challenge.cashBalance = parseFloat((challenge.cashBalance + totalAmount).toFixed(2));

            if (p.quantity === 0) {
                positions.splice(idx, 1);
            }
        }

        challenge.positions = positions;
        await challenge.save();

        await WeeklyChallengeTrade.create({
            challenge: challenge._id,
            user: userId,
            type: side,
            symbol: bare,
            quantity: qty,
            price,
            totalAmount,
        });

        const snapshot = await computeChallengeSnapshot(challenge);

        if (snapshot.equity >= snapshot.targetBalance && challenge.status === 'ACTIVE') {
            challenge.status = 'COMPLETED';
            challenge.completedAt = new Date();
            await challenge.save();
            snapshot.status = 'COMPLETED';
        }

        res.json({ success: true, filledPrice: price, challenge: snapshot });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/challenge/trades', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const challenge = await loadCurrentChallenge(userId);
        if (!challenge) return res.json({ trades: [] });

        const trades = await WeeklyChallengeTrade.find({ challenge: challenge._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ trades });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/trade', authenticateToken, async (req, res) => {
    const { symbol, type, quantity, price, orderType = 'MARKET', limitPrice } = req.body;
    const userId = req.user.id;
    try {
        if (!TEMP_ALLOW_AFTER_HOURS_TRADING && !NSEClient.constructor.isMarketHours()) {
            return res.status(403).json({ error: 'Market is closed. Buying and selling are disabled.' });
        }
        const result = await TradeEngine.executeTrade(userId, type, symbol, quantity, price, orderType, limitPrice, false);
        res.json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // All orders (MARKET + LIMIT, all statuses) sorted newest first
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
        const mapped = orders.map(o => ({
            id:          o.orderId,
            symbol:      o.symbol,
            side:        o.side,
            quantity:    o.quantity,
            orderType:   o.orderType,
            limitPrice:  o.limitPrice ?? null,
            price:       o.price ?? o.limitPrice ?? null,
            totalAmount: o.totalAmount ?? null,
            status:      o.status,
            createdAt:   o.createdAt,
        }));
        res.json({ orders: mapped });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const result = await TradeEngine.cancelOrder(req.params.id, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});


io.on('connection', (socket) => {
    // Subscribe: mark symbol as priority + send cached value immediately
    socket.on('subscribe', (symbol) => {
        const data = marketDataService.subscribe(symbol);
        if (data) socket.emit('market_update', { [symbol]: data });
    });

    // Deprioritize: user navigated away from stock detail page
    socket.on('deprioritize', (symbol) => {
        marketDataService.deprioritize(symbol);
    });

    socket.on('disconnect', () => {
        // Nothing extra needed; MarketData keeps tracking subscribers set
    });
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
