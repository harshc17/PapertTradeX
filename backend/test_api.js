require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'papertradex_secret_key_123';
const token = jwt.sign({ id: '69e7017df1e0795e50713582', role: 'USER' }, JWT_SECRET, { expiresIn: '24h' });

fetch('http://localhost:3001/api/portfolio', {
    headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(data => {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
