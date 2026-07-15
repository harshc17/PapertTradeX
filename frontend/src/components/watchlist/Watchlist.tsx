'use client';
import { Bookmark, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { useHoldings } from '@/context/HoldingsContext';

export default function Watchlist() {
    const { watchlist, removeFromWatchlist } = useHoldings();

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Bookmark className="h-5 w-5 text-gray-500" />
                    My Watchlist
                </h2>
                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    + Add Stocks
                </button>
            </div>

            {watchlist.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    No stocks in watchlist
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {watchlist.map((stock) => (
                        <div key={stock.name} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-lg transition-all duration-200 group cursor-pointer relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                                    {stock.name.substring(0, 2)}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromWatchlist(stock.name);
                                    }}
                                    className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                    title="Remove from watchlist"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{stock.name}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-semibold text-gray-900 dark:text-white">₹{stock.price}</span>
                                    <span className={`text-xs font-medium flex items-center gap-1 ${stock.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                        {stock.change}
                                        {stock.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
