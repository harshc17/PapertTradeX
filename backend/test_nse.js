const axios = require('axios');

axios.get('https://www.nseindia.com', {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
    },
    timeout: 15000,
}).then(r => {
    console.log('STATUS:', r.status);
    const cookies = r.headers['set-cookie'];
    console.log('COOKIES:', cookies ? cookies.length + ' cookies set' : 'none');
    if (cookies) console.log('Sample:', cookies[0].split(';')[0]);
}).catch(e => {
    console.error('FAILED:', e.response?.status, e.code || e.message);
});
