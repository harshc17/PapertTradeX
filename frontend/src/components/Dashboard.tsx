'use client';
import { useEffect, useState } from 'react';

export default function Dashboard({ balance, holdings, marketData }: any) {
    const [totalValue, setTotalValue] = useState(0);
    const [todaysGain, setTodaysGain] = useState(0);

    useEffect(() => {
        let currentHoldingsValue = 0;
        let investedValue = 0;
        holdings.forEach((item: any) => {
            const price = marketData[item.symbol]?.price || item.averagePrice;
            currentHoldingsValue += price * item.quantity;
            investedValue += item.averagePrice * item.quantity;
        });
        setTotalValue(currentHoldingsValue);
        setTodaysGain(currentHoldingsValue - investedValue);
    }, [holdings, marketData]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">You have <span className="text-gray-500 ml-2 text-sm">₹{balance.toFixed(2)} available</span></h2>
            <div className="flex gap-12 mb-8">
                <div>
                    <p className="text-sm text-gray-500 mb-1">Current Value</p>
                    <h3 className="text-3xl font-bold">₹{totalValue.toFixed(2)}</h3>
                </div>
                <div>
                    <p className="text-sm text-gray-500 mb-1">Total Returns</p>
                    <h3 className={`text-3xl font-bold ${todaysGain >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {todaysGain >= 0 ? '+' : ''}₹{Math.abs(todaysGain).toFixed(2)}
                    </h3>
                </div>
            </div>

            <h4 className="text-md font-medium mb-4">Holdings ({holdings.length})</h4>
            <div className="space-y-4">
                {holdings.map((item: any) => {
                    const price = marketData[item.symbol]?.price || item.averagePrice;
                    const gain = (price - item.averagePrice) * item.quantity;
                    return (
                        <div key={item.symbol} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                            <div>
                                <p className="font-semibold">{item.symbol}</p>
                                <p className="text-xs text-gray-500">{item.quantity} shares • Avg ₹{item.averagePrice.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-medium">₹{(price * item.quantity).toFixed(2)}</p>
                                <p className={`text-xs ${gain >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                    {gain >= 0 ? '+' : ''}₹{Math.abs(gain).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
