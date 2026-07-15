const { User, Portfolio, TransactionHistory, Order } = require('../models');
const NSEClient = require('./NSEClient');

class TradeEngine {
    /**
     * Execute a trade (BUY/SELL) for a user.
     * For LIMIT orders: registers the order as OPEN and returns. Execution happens via processMarketTick.
     * For MARKET orders: immediately deducts/credits balance and updates portfolio.
     */
    async executeTrade(userId, type, symbol, quantity, currentPrice, orderType = 'MARKET', limitPrice = null, skipMarketCheck = false) {
        // skipMarketCheck is used by processMarketTick when filling limit orders internally
        // In a Paper Trading app, we allow 24/7 trading for testing purposes.
        // if (!skipMarketCheck && !NSEClient.constructor.isMarketHours()) {
        //     throw new Error('Market is closed. Try again when market is open');
        // }

        // ── Input Validation ────────────────────────────────────────────────────
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const qty = parseInt(quantity, 10);
        if (!qty || qty <= 0 || !Number.isInteger(qty)) {
            throw new Error('Quantity must be a positive whole number');
        }

        const price = parseFloat(currentPrice);
        if (!price || price <= 0) {
            throw new Error('Price must be greater than zero');
        }

        if (!['BUY', 'SELL'].includes(type)) {
            throw new Error('Order side must be BUY or SELL');
        }

        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Symbol is required');
        }

        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

        // ── LIMIT Order: register and return ────────────────────────────────────
        if (orderType === 'LIMIT') {
            const lp = parseFloat(limitPrice);
            if (!lp || lp <= 0) {
                throw new Error('Limit price must be greater than zero for LIMIT orders');
            }

            const order = new Order({
                user:      userId,
                symbol:    bare,
                side:      type,
                quantity:  qty,
                orderType,
                limitPrice: lp,
                status:    'OPEN',
            });
            await order.save(); // pre-save hook assigns orderId (L-N)

            return { success: true, orderId: order.orderId, status: order.status };
        }

        // ── MARKET Order: execute immediately (DELIVERY only) ──────────────────────
        const totalAmount = parseFloat((qty * price).toFixed(2));

        if (type === 'BUY') {
            if (user.balance < totalAmount) {
                throw new Error(
                    `Insufficient balance. Required: ₹${totalAmount.toFixed(2)}, Available: ₹${user.balance.toFixed(2)}`
                );
            }

            user.balance = parseFloat((user.balance - totalAmount).toFixed(2));
            await user.save();

            // Upsert portfolio position
            const position = await Portfolio.findOne({ user: userId, symbol: bare });
            if (position) {
                const totalCost     = (position.quantity * position.averagePrice) + totalAmount;
                position.quantity  += qty;
                position.averagePrice = parseFloat((totalCost / position.quantity).toFixed(4));
                await position.save();
            } else {
                await Portfolio.create({ user: userId, symbol: bare, quantity: qty, averagePrice: price });
            }

        } else if (type === 'SELL') {
            const position = await Portfolio.findOne({ user: userId, symbol: bare });
            if (!position) throw new Error(`You don't hold any ${bare} shares`);
            if (position.quantity < qty) {
                throw new Error(
                    `Insufficient holdings. You have ${position.quantity} share(s) of ${bare}, trying to sell ${qty}`
                );
            }

            position.quantity -= qty;
            if (position.quantity === 0) {
                await position.deleteOne();
            } else {
                await position.save();
            }

            user.balance = parseFloat((user.balance + totalAmount).toFixed(2));
            await user.save();
        }

        // Record transaction
        await TransactionHistory.create({ user: userId, type, symbol: bare, quantity: qty, price, totalAmount });

        // Save completed MARKET order for history
        const order = new Order({
            user:        userId,
            symbol:      bare,
            side:        type,
            quantity:    qty,
            orderType:   'MARKET',
            price,
            totalAmount,
            status:      'FILLED',
        });
        await order.save();

        return { success: true, newBalance: user.balance };
    }

    /**
     * Get all portfolio positions for a user.
     */
    async getPortfolio(userId) {
        return await Portfolio.find({ user: userId });
    }

    /**
     * Cancel an OPEN limit order. Only the order owner can cancel it.
     */
    async cancelOrder(orderId, userId) {
        // Accept either the readable orderId ('L-5') or MongoDB _id string
        const query = orderId.match(/^[LM]-\d+$/)
            ? { orderId, user: userId }
            : { _id: orderId, user: userId };

        const order = await Order.findOne(query);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'OPEN') throw new Error(`Cannot cancel order with status: ${order.status}`);

        order.status = 'CANCELLED';
        await order.save();
        return { success: true, orderId: order.orderId, status: order.status };
    }

    /**
     * Called on each price tick to fill any eligible OPEN limit orders.
     * BUY limit fills when price drops to or below limitPrice.
     * SELL limit fills when price rises to or above limitPrice.
     */
    async processMarketTick(symbol, currentPrice) {
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

        const openOrders = await Order.find({ symbol: bare, status: 'OPEN' });

        for (const order of openOrders) {
            const shouldFill =
                (order.side === 'BUY'  && currentPrice <= order.limitPrice) ||
                (order.side === 'SELL' && currentPrice >= order.limitPrice);

            if (!shouldFill) continue;

            try {
                await this.executeTrade(
                    order.user.toString(),
                    order.side,
                    order.symbol,
                    order.quantity,
                    currentPrice,
                    'MARKET',
                    null,
                    true
                );
                order.status = 'FILLED';
                order.price  = currentPrice;
                await order.save();
                console.log(`[TradeEngine] Limit order ${order.orderId} filled: ${order.side} ${order.quantity}x ${order.symbol} @ ₹${currentPrice}`);
            } catch (e) {
                console.error(`[TradeEngine] Failed to fill limit order ${order.orderId}:`, e.message);
            }
        }
    }
}

module.exports = new TradeEngine();
