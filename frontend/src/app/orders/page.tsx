'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import Header from '@/components/dashboard/Header';
import { ClipboardList, X, Loader2 } from 'lucide-react';

export default function OrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const { orders, refreshOrders, cancelOrder } = usePortfolio();
    const router = useRouter();
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
        else refreshOrders();
    }, [user, authLoading]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleCancel = async (orderId: string) => {
        setCancellingId(orderId);
        try {
            await cancelOrder(orderId);
            showToast('success', 'Order cancelled successfully');
        } catch (e: any) {
            showToast('error', e.message || 'Failed to cancel order');
        } finally {
            setCancellingId(null);
        }
    };

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />

            {/* Toast */}
            {toast && (
                <div className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
                    toast.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {toast.message}
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-xl font-bold text-gray-900 mb-6">Orders</h1>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClipboardList className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders placed</h3>
                        <p className="text-gray-400 text-sm">Trades you make will appear here.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-900">All Orders ({orders.length})</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="px-6 py-3.5">Time</th>
                                        <th className="px-6 py-3.5">Type</th>
                                        <th className="px-6 py-3.5">Instrument</th>
                                        <th className="px-6 py-3.5 text-right">Qty</th>
                                        <th className="px-6 py-3.5 text-right">Price</th>
                                        <th className="px-6 py-3.5 text-right">Total</th>
                                        <th className="px-6 py-3.5 text-right">Status</th>
                                        <th className="px-6 py-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {orders.map(order => {
                                        const isBuy = order.side === 'BUY';
                                        const date = new Date(order.createdAt);
                                        const price = order.price ?? order.limitPrice ?? 0;
                                        const total = price * order.quantity;
                                        const isOpen = order.status === 'OPEN';
                                        const statusColor =
                                            order.status === 'FILLED'    ? 'bg-green-50 text-green-600' :
                                            order.status === 'OPEN'      ? 'bg-blue-50 text-blue-600'   :
                                            order.status === 'CANCELLED' ? 'bg-gray-100 text-gray-400'  :
                                                                           'bg-gray-100 text-gray-500';
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-6 py-4 text-xs text-gray-500">
                                                    <p>{date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    <p className="text-[10px]">{date.toLocaleDateString('en-IN')}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${isBuy ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
                                                        {order.side}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">
                                                            {order.symbol.replace('.NS', '').substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{order.symbol.replace('.NS', '')}</p>
                                                            <p className="text-[10px] text-gray-400">{order.orderType}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-gray-700">{order.quantity}</td>
                                                <td className="px-6 py-4 text-right text-sm text-gray-700">
                                                    ₹{fmt(price)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                                                    ₹{fmt(total)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${statusColor}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {/* Only OPEN limit orders can be cancelled */}
                                                    {isOpen && order.id.toString().startsWith('L-') ? (
                                                        <button
                                                            onClick={() => handleCancel(order.id.toString())}
                                                            disabled={cancellingId === order.id.toString()}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {cancellingId === order.id.toString() ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <X className="w-3 h-3" />
                                                            )}
                                                            Cancel
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-200 text-[10px]">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
