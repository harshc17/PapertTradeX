'use client';
import { useHoldings } from "@/context/HoldingsContext";

export default function InvestmentCard() {
    const { currentValue, totalReturns, totalReturnsPercent, totalInvested } = useHoldings();

    // Format helper
    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-full flex flex-col justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Your investments</h2>

            <div className="space-y-6">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current</p>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">₹{fmt(currentValue)}</p>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Total returns</span>
                        <span className={`text-sm font-medium ${totalReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalReturns >= 0 ? '+' : ''}₹{fmt(totalReturns)} ({fmt(totalReturnsPercent)}%)
                        </span>
                    </div>
                </div>

                <div className="pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Invested</span>
                    <span className="text-lg font-medium text-gray-900 dark:text-white">₹{fmt(totalInvested)}</span>
                </div>
            </div>
        </div>
    )
}
