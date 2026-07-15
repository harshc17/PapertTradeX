// Debug NSE response structure for market cap fields
const axios = require('./node_modules/axios');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function test() {
    const home = await axios.get('https://www.nseindia.com', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const cookies = (home.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const hdrs = { 'User-Agent': UA, Cookie: cookies, Referer: 'https://www.nseindia.com/', 'X-Requested-With': 'XMLHttpRequest' };

    const r = await axios.get('https://www.nseindia.com/api/quote-equity?symbol=HDFCBANK', { headers: hdrs, timeout: 10000 });
    const d = r.data;

    console.log('=== metadata keys ===');
    console.log(Object.keys(d.metadata || {}));
    console.log('\n=== metadata values ===');
    console.log(JSON.stringify(d.metadata, null, 2));
    console.log('\n=== priceInfo keys ===');
    console.log(Object.keys(d.priceInfo || {}));
    console.log('\n=== industryInfo ===');
    console.log(JSON.stringify(d.industryInfo, null, 2));
}
test().catch(console.error);
