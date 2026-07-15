/**
 * AIService.js — Multi-Provider AI with automatic failover
 *
 * Provider priority (tries each in order, skips exhausted ones):
 *   1. Groq         (GROQ_API_KEY)      — very generous free limits, fastest
 *   2. OpenRouter   (OPENROUTER_API_KEY) — 50 req/day free, many models
 *   3. Gemini       (GEMINI_API_KEY)    — 200 req/day free (gemini-2.0-flash)
 *
 * All providers are OpenAI-compatible except Gemini (handled separately).
 * Falls back to graceful mock data if ALL providers are exhausted.
 */

// ─── Provider Configs ────────────────────────────────────────────────────────

const PROVIDERS = {
    groq: {
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        getKey: () => process.env.GROQ_API_KEY,
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        }),
        maxTokens: 1200,
    },
    openrouter: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        getKey: () => {
            // Collect all OpenRouter keys (primary + extras)
            const keys = [];
            const primary = process.env.OPENROUTER_API_KEY;
            if (primary) keys.push(primary);
            for (let i = 2; i <= 9; i++) {
                const k = process.env[`OPENROUTER_API_KEY_${i}`];
                if (k) keys.push(k);
            }
            return keys;
        },
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://papertradex.app',
            'X-Title': 'PaperTradeX',
        }),
        maxTokens: 1200,
    },
};

// Gemini uses a different API format — handled as a special case
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash'];

// ─── AIService ───────────────────────────────────────────────────────────────

class AIService {
    constructor() {
        // Track exhausted keys per provider { 'groq': Set, 'openrouter:sk-or-...' : true, etc. }
        this._exhausted = new Set();
        this._exhaustedDate = new Date().toDateString();

        // Log what's available
        const available = [];
        if (process.env.GROQ_API_KEY) available.push('Groq ✓');
        if (process.env.OPENROUTER_API_KEY) available.push('OpenRouter ✓');
        if (process.env.GEMINI_API_KEY) available.push('Gemini ✓');
        if (available.length > 0) {
            console.log(`[AIService] Providers loaded: ${available.join(', ')}`);
        } else {
            console.warn('[AIService] WARNING: No AI API keys configured. Using mock data.');
        }
    }

    _checkDayReset() {
        const today = new Date().toDateString();
        if (today !== this._exhaustedDate) {
            this._exhausted.clear();
            this._exhaustedDate = today;
            console.log('[AIService] New day — all rate limits reset ✓');
        }
    }

    /** OpenAI-compatible request (used for Groq + OpenRouter) */
    async _openaiRequest(baseUrl, model, headers, messages, maxTokens) {
        const res = await fetch(baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens }),
        });

        if (res.status === 429 || res.status === 503) {
            throw Object.assign(new Error(`Rate limited (${res.status})`), { rateLimited: true });
        }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(`API error ${res.status}: ${JSON.stringify(body)}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
    }

    /** Gemini REST request */
    async _geminiRequest(prompt) {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error('No Gemini key');

        for (const model of GEMINI_MODELS) {
            const exhaustKey = `gemini:${model}`;
            if (this._exhausted.has(exhaustKey)) continue;

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                }
            );

            const data = await res.json();

            if (res.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
                console.warn(`[AIService] Gemini ${model} exhausted — trying next...`);
                this._exhausted.add(exhaustKey);
                continue;
            }
            if (!res.ok) throw new Error(`Gemini error ${res.status}`);

            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }

        throw Object.assign(new Error('All Gemini models exhausted'), { rateLimited: true });
    }

    /**
     * Core method: tries providers in priority order, auto-rotates on 429
     * Returns the AI text response or null if all providers are exhausted.
     */
    async _generate(systemPrompt, userMessage, fullMessages = null) {
        this._checkDayReset();

        const messages = fullMessages || [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ];
        const combinedPrompt = `${systemPrompt}\n\n${userMessage}`;

        // ── 1. Try Groq ──────────────────────────────────────────────────────
        const groqKey = process.env.GROQ_API_KEY;
        if (groqKey && !this._exhausted.has('groq')) {
            try {
                const p = PROVIDERS.groq;
                console.log('[AIService] Trying Groq...');
                const text = await this._openaiRequest(
                    p.baseUrl, p.model, p.headers(groqKey), messages, p.maxTokens
                );
                if (text) { console.log('[AIService] Groq ✓'); return text; }
            } catch (e) {
                if (e.rateLimited) {
                    console.warn('[AIService] Groq rate limited — rotating...');
                    this._exhausted.add('groq');
                } else {
                    console.warn('[AIService] Groq error:', e.message);
                }
            }
        }

        // ── 2. Try OpenRouter (all keys) ─────────────────────────────────────
        const orKeys = (() => {
            const keys = [];
            const primary = process.env.OPENROUTER_API_KEY;
            if (primary) keys.push(primary);
            for (let i = 2; i <= 9; i++) {
                const k = process.env[`OPENROUTER_API_KEY_${i}`];
                if (k) keys.push(k);
            }
            return keys;
        })();

        for (const key of orKeys) {
            const exhaustKey = `or:${key.slice(-8)}`;
            if (this._exhausted.has(exhaustKey)) continue;
            try {
                const p = PROVIDERS.openrouter;
                console.log('[AIService] Trying OpenRouter...');
                const text = await this._openaiRequest(
                    p.baseUrl, p.model, p.headers(key), messages, p.maxTokens
                );
                if (text) { console.log('[AIService] OpenRouter ✓'); return text; }
            } catch (e) {
                if (e.rateLimited) {
                    console.warn(`[AIService] OpenRouter key ...${key.slice(-8)} exhausted — rotating...`);
                    this._exhausted.add(exhaustKey);
                } else {
                    console.warn('[AIService] OpenRouter error:', e.message);
                }
            }
        }

        // ── 3. Try Gemini ─────────────────────────────────────────────────────
        if (process.env.GEMINI_API_KEY) {
            try {
                console.log('[AIService] Trying Gemini...');
                const text = await this._geminiRequest(combinedPrompt);
                if (text) { console.log('[AIService] Gemini ✓'); return text; }
            } catch (e) {
                if (!e.rateLimited) console.warn('[AIService] Gemini error:', e.message);
            }
        }

        console.warn('[AIService] All providers exhausted — using mock data');
        return null;
    }

    /** Parse JSON from LLM response (strips markdown fences) */
    _parseJSON(text) {
        const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        // Extract JSON object if there's surrounding text
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(clean);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // generateNews(symbol, companyName)
    // ─────────────────────────────────────────────────────────────────────────
    async generateNews(symbol, companyName) {
        try {
            const text = await this._generate(
                'You are a professional financial journalist for the Indian stock market. Always respond with ONLY raw JSON — no markdown, no code fences, no extra text.',
                `Generate a realistic news report for ${companyName || symbol} (${symbol}).
Include a strategic business update (expansion, partnership, earnings guidance, or market analysis). No catastrophic events.
Return ONLY a JSON object with exactly these keys:
{ "title": "headline string", "summary": "1-2 sentence overview", "content": "2-3 paragraphs of detailed news" }`
            );

            if (!text) throw new Error('No response');
            const result = this._parseJSON(text);
            result.date = new Date().toISOString();
            return result;
        } catch (error) {
            console.warn(`[AIService] generateNews fallback for ${symbol}:`, error.message);
            return {
                title: `${companyName || symbol} Market Update`,
                summary: `${companyName || symbol} continues steady operations amid current market conditions.`,
                content: `Analysts tracking ${companyName || symbol} note stable fundamentals as the company navigates sector-wide trends. Institutional activity remains measured ahead of the next earnings cycle.\n\nInvestors are monitoring key support levels while awaiting fresh catalysts for the stock.`,
                date: new Date().toISOString()
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // analyzePortfolio(holdings, balance)
    // ─────────────────────────────────────────────────────────────────────────
    async analyzePortfolio(holdings, balance) {
        try {
            const holdingList = holdings.length > 0
                ? holdings.map(h => `${h.symbol}: ${h.quantity} shares @ ₹${h.averagePrice} (LTP: ₹${h.currentPrice}, P&L: ₹${h.pnl})`).join('\n')
                : 'No current holdings.';
            const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);

            const text = await this._generate(
                'You are an expert financial advisor for the Indian stock market. Always respond with ONLY raw JSON — no markdown, no code fences.',
                `Analyze this paper trading portfolio and give constructive, encouraging feedback.
Cash Balance: ₹${balance.toFixed(2)}
Total Holdings Value: ₹${totalValue.toFixed(2)}
Holdings:
${holdingList}

Return ONLY a JSON object with these keys:
{ "summary": "2-3 sentence overall assessment", "strengths": ["strength1", "strength2"], "weaknesses": ["weakness1"], "recommendations": ["advice1", "advice2"] }`
            );

            if (!text) throw new Error('No response');
            return this._parseJSON(text);
        } catch (error) {
            console.warn('[AIService] analyzePortfolio fallback:', error.message);
            return {
                summary: "Your portfolio shows a good start in paper trading. Keep diversifying across sectors for balanced risk.",
                strengths: ["Active position management", "Cash reserves maintained"],
                weaknesses: ["Consider broader sector diversification"],
                recommendations: ["Monitor stop-loss levels regularly", "Review holdings after each earnings season"]
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // askQuestion(question, history)
    // ─────────────────────────────────────────────────────────────────────────
    async askQuestion(question, history = []) {
        try {
            const systemPrompt = `You are an expert financial advisor and stock market assistant for PaperTradeX, an Indian paper trading platform.
IMPORTANT: ONLY answer questions related to finance, stock markets, trading, investing, ETFs, indices, economics, and related financial topics.
If the user asks something completely unrelated, politely decline and redirect to finance topics.
Provide helpful, accurate, and concise responses formatted in Markdown.`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.slice(-8).map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content,
                })),
                { role: 'user', content: question },
            ];

            const text = await this._generate(systemPrompt, question, messages);
            return text || "I'm sorry, all AI providers are currently rate-limited. Please try again in a few minutes.";
        } catch (error) {
            console.warn('[AIService] askQuestion fallback:', error.message);
            return "I'm sorry, my servers are busy right now. Please try again in a moment.";
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // generateMarketNews()
    // ─────────────────────────────────────────────────────────────────────────
    async generateMarketNews() {
        try {
            const text = await this._generate(
                'You are an expert financial journalist for the Indian stock market. Always respond with ONLY raw JSON — no markdown, no code fences, no extra text.',
                `Generate a realistic, simulated market news summary for today's Indian stock market.
Return ONLY a JSON object:
{
  "title": "Brief overall market headline for today",
  "articles": [
    { "headline": "specific news headline", "summary": "1-2 sentences", "time": "1 hour ago" }
  ]
}
Generate exactly 4 diverse articles covering Banking, IT, Auto, FMCG, or general indices.`
            );

            if (!text) throw new Error('No response');
            return this._parseJSON(text);
        } catch (error) {
            console.warn('[AIService] generateMarketNews fallback:', error.message);
            return {
                title: "Indian Market Snapshot",
                articles: [
                    { headline: "Nifty 50 Consolidates Near Key Resistance", summary: "Benchmark index trades sideways as investors await RBI commentary on interest rates.", time: "1 hour ago" },
                    { headline: "Banking Sector Under Mild Pressure", summary: "HDFC Bank and ICICI Bank witness profit booking after recent rally.", time: "2 hours ago" },
                    { headline: "IT Stocks Gain on Positive US Cues", summary: "TCS and Infosys lead gains as US tech sentiment improves ahead of earnings.", time: "3 hours ago" },
                    { headline: "Auto Sector Sees Strong Retail Sales Data", summary: "Monthly auto sales data beats expectations, boosting M&M and Tata Motors.", time: "4 hours ago" }
                ]
            };
        }
    }
}

module.exports = new AIService();
