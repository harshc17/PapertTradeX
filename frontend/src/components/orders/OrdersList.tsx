'use client';
import { useHoldings } from '@/context/HoldingsContext';

export default function OrdersList() {
    const { orders } = useHoldings();

    if (orders.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No orders placed</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    Trades you make will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Orders ({orders.length})</h2>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            <th className="px-6 py-4 font-medium">Time</th>
                            <th className="px-6 py-4 font-medium">Type</th>
                            <th className="px-6 py-4 font-medium">Instrument</th>
                            <th className="px-6 py-4 font-medium text-right">Qty.</th>
                            <th className="px-6 py-4 font-medium text-right">Avg. Price</th>
                            <th className="px-6 py-4 font-medium text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {orders.map((order) => {
                            return (
                                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                                        {order.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        <div className="text-[10px]">{order.timestamp.toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.type === 'BUY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {order.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{order.name}</div>
                                        <div className="text-xs text-gray-400">{order.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                                        {order.qty}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                                        ₹{order.price.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                {order.status}
                                            </span>
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
