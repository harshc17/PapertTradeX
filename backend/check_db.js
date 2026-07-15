require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://localhost:27017/papertradex');
    const db = mongoose.connection.db;
    const portfolios = await db.collection('portfolios').find({}).toArray();
    console.log(`Found ${portfolios.length} portfolio items.`);
    console.log(portfolios);
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users.`);
    process.exit(0);
}

check();
