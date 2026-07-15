'use client';
import { useHoldings } from '@/context/HoldingsContext';

export default function HoldingsList() {
    const { holdings } = useHoldings();

    if (holdings.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">💼</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No holdings yet</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    Start building your portfolio by exploring and buying stocks from the dashboard.
                </p>
            </div>
        );
    }

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Stocks ({holdings.length})</h2>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search holdings..."
                        className="text-sm border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-transparent focus:outline-none focus:border-blue-500 w-64"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            <th className="px-6 py-4 font-medium">Company</th>
                            <th className="px-6 py-4 font-medium text-right">Qty.</th>
                            <th className="px-6 py-4 font-medium text-right">Avg. Price</th>
                            <th className="px-6 py-4 font-medium text-right">LTP</th>
                            <th className="px-6 py-4 font-medium text-right">Cur. Value</th>
                            <th className="px-6 py-4 font-medium text-right">P&L</th>
                            <th className="px-6 py-4 font-medium text-right">Net Chg.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {holdings.map((stock) => {
                            const currentValue = stock.qty * stock.ltp;
                            const investedValue = stock.qty * stock.avg;
                            const pnl = currentValue - investedValue;
                            const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
                            const isProfit = pnl >= 0;

                            return (
                                <tr key={stock.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{stock.name}</div>
                                        <div className="text-xs text-gray-400">{stock.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300">{stock.qty}</td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300">₹{stock.avg.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">₹{stock.ltp.toFixed(2)}</div>
                                        <div className={`text-xs mt-0.5 ${stock.dayChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {stock.dayChange > 0 ? '+' : ''}{stock.dayChange}%
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                                        ₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <div className={`${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                            {isProfit ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                            ({pnlPercent.toFixed(2)}%)
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`text-xs font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'} bg-gray-100 dark:bg-gray-800 py-1 px-2 rounded inline-block`}>
                                            {isProfit ? 'PROFIT' : 'LOSS'}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
