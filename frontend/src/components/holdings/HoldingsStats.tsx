'use client';
import { useHoldings } from '@/context/HoldingsContext';

export default function HoldingsStats() {
    const { currentValue, totalReturns, totalReturnsPercent, dayReturns, totalInvested } = useHoldings();

    // Format helper
    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dayReturnsPercent = currentValue > 0 ? (dayReturns / currentValue) * 100 : 0;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Your investments</h1>
            
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8">
                <div className="space-y-6">
                    {/* Current */}
                    <div className="flex justify-between items-baseline">
                        <p className="text-gray-600 dark:text-gray-400">Current</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">₹{fmt(currentValue)}</p>
                    </div>

                    {/* 1D Returns */}
                    <div className="flex justify-between items-center">
                        <p className="text-gray-600 dark:text-gray-400">1D returns</p>
                        <p className={`text-lg font-semibold flex items-center gap-2 ${dayReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {dayReturns >= 0 ? '+' : ''}₹{fmt(Math.abs(dayReturns))} 
                            <span className="text-sm">({dayReturnsPercent >= 0 ? '+' : ''}{fmt(dayReturnsPercent)}%)</span>
                        </p>
                    </div>

                    {/* Total Returns */}
                    <div className="flex justify-between items-center">
                        <p className="text-gray-600 dark:text-gray-400">Total returns</p>
                        <p className={`text-lg font-semibold flex items-center gap-2 ${totalReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalReturns >= 0 ? '+' : ''}₹{fmt(Math.abs(totalReturns))} 
                            <span className="text-sm">({totalReturnsPercent > 0 ? '+' : ''}{fmt(totalReturnsPercent)}%)</span>
                        </p>
                    </div>

                    {/* Invested */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-gray-600 dark:text-gray-400">Invested</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹{fmt(totalInvested)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
