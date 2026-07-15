'use client';
import { TrendingUp, Plus } from 'lucide-react';
import { useHoldings } from '@/context/HoldingsContext';

interface StockCardProps {
    name: string;
    symbol: string; // e.g. "IFCI"
    price: string;
    change: string;
    isPositive: boolean;
    logoUrl?: string; // Optional URL for logo
}

export default function StockCard({ name, symbol, price, change, isPositive, logoUrl }: StockCardProps) {
    const { buyStock } = useHoldings();

    const handleBuy = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigation if this is inside a link
        // Extract numeric price from string like "56.43" -> 56.43
        const numericPrice = parseFloat(price.replace(/,/g, ''));
        // Extract change percentage approx
        const numericChange = parseFloat(change.split('(')[1]?.replace('%)', '') || '0');

        buyStock({
            symbol,
            name,
            price: numericPrice,
            change: numericChange
        }, 1); // Buy 1 qty by default for demo

        alert(`Bought 1 qty of ${name}! Check Holdings.`);
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative">
            <button
                onClick={handleBuy}
                className="absolute top-3 right-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-full transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 z-10"
                title="Buy Stock"
            >
                <Plus className="h-5 w-5" />
            </button>
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg border border-gray-100 dark:border-gray-800 flex items-center justify-center bg-white dark:bg-gray-800 p-1 group-hover:border-gray-300 dark:group-hover:border-gray-700 transition-colors">
                    {/* Placeholder logo if none provided */}
                    {logoUrl ? (
                        <img src={logoUrl} alt={name} className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-xs font-bold text-gray-400">{symbol.substring(0, 2)}</span>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-6" title={name}>{name}</h3>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">₹{price}</p>
                <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {change}
                    {/* {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />} */}
                </div>
            </div>
        </div>
    )
}
