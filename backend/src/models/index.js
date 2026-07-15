const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papertradex';

// ── Connect ─────────────────────────────────────────────────────────────────
async function connectDB() {
    await mongoose.connect(MONGODB_URI);
    console.log('[MongoDB] Connected ✓');
}

// ── Counter (for sequential readable order IDs) ──────────────────────────────
const counterSchema = new mongoose.Schema({
    _id: String,   // counter name, e.g. 'order_MARKET', 'order_LIMIT'
    seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

async function nextSeq(name) {
    const doc = await Counter.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    return doc.seq;
}

// ── User ─────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    name:          { type: String, required: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, default: '' },
    password_hash: { type: String, required: true },
    role:          { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    balance:       { type: Number, default: 100000 },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ── Portfolio ─────────────────────────────────────────────────────────────────
const portfolioSchema = new mongoose.Schema({
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symbol:       { type: String, required: true },
    quantity:     { type: Number, required: true },
    averagePrice: { type: Number, required: true },
}, { timestamps: true });

portfolioSchema.index({ user: 1, symbol: 1 }, { unique: true });
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// ── TransactionHistory ────────────────────────────────────────────────────────
const transactionHistorySchema = new mongoose.Schema({
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['BUY', 'SELL'], required: true },
    symbol:      { type: String, required: true },
    quantity:    { type: Number, required: true },
    price:       { type: Number, required: true },
    totalAmount: { type: Number, required: true },
}, { timestamps: true });

const TransactionHistory = mongoose.model('TransactionHistory', transactionHistorySchema);

// ── Order ─────────────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema({
    orderId:     { type: String, unique: true },  // 'M-1', 'L-2', etc.
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symbol:      { type: String, required: true },
    side:        { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity:    { type: Number, required: true },
    orderType:   { type: String, enum: ['MARKET', 'LIMIT'], required: true, default: 'MARKET' },
    limitPrice:  { type: Number, default: null },
    price:       { type: Number, default: null },       // fill price for MARKET / FILLED
    totalAmount: { type: Number, default: null },
    status:      { type: String, enum: ['OPEN', 'FILLED', 'CANCELLED'], default: 'OPEN' },
}, { timestamps: true });

// Add pre-save hook to auto-assign orderId
orderSchema.pre('save', async function () {
    if (!this.orderId) {
        const prefix = this.orderType === 'LIMIT' ? 'L' : 'M';
        const seq    = await nextSeq(`order_${prefix}`);
        this.orderId = `${prefix}-${seq}`;
    }
});

const Order = mongoose.model('Order', orderSchema);

// ── Weekly Challenge ────────────────────────────────────────────────────────
const weeklyChallengePositionSchema = new mongoose.Schema({
    symbol:       { type: String, required: true },
    quantity:     { type: Number, required: true, min: 0 },
    averagePrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const weeklyChallengeSchema = new mongoose.Schema({
    user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:         { type: String, enum: ['ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED'], default: 'ACTIVE' },
    initialBalance: { type: Number, default: 10000 },
    targetBalance:  { type: Number, default: 15000 },
    cashBalance:    { type: Number, default: 10000 },
    positions:      { type: [weeklyChallengePositionSchema], default: [] },
    startAt:        { type: Date, required: true },
    endAt:          { type: Date, required: true },
    completedAt:    { type: Date, default: null },
}, { timestamps: true });

weeklyChallengeSchema.index(
    { user: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

const WeeklyChallenge = mongoose.model('WeeklyChallenge', weeklyChallengeSchema);

const weeklyChallengeTradeSchema = new mongoose.Schema({
    challenge:   { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyChallenge', required: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['BUY', 'SELL'], required: true },
    symbol:      { type: String, required: true },
    quantity:    { type: Number, required: true },
    price:       { type: Number, required: true },
    totalAmount: { type: Number, required: true },
}, { timestamps: true });

weeklyChallengeTradeSchema.index({ challenge: 1, createdAt: -1 });
const WeeklyChallengeTrade = mongoose.model('WeeklyChallengeTrade', weeklyChallengeTradeSchema);


// ── Admin Seed ────────────────────────────────────────────────────────────────
async function seedAdmin() {
    const adminEmail = 'admin@papertradex.com';
    const existing   = await User.findOne({ email: adminEmail });
    if (!existing) {
        const hash = await bcrypt.hash('harsh1711', 10);
        await User.create({
            name: 'Harsh Admin', email: adminEmail,
            phone: '0000000000', password_hash: hash,
            role: 'ADMIN', balance: 100000,
        });
        console.log('[MongoDB] Admin seeded ✓');
    }
}

module.exports = {
    connectDB,
    User,
    Portfolio,
    TransactionHistory,
    Order,
    WeeklyChallenge,
    WeeklyChallengeTrade,
    seedAdmin,
};
