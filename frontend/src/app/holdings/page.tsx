'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import Header from '@/components/dashboard/Header';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';

export default function HoldingsPage() {
    const { user, balance, loading: authLoading } = useAuth();
    const { holdings, totalInvested, currentValue, totalReturns, totalReturnsPercent, todayReturns, todayReturnsPercent, refreshPortfolio } = usePortfolio();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
        else refreshPortfolio();
    }, [user, authLoading]);

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isProfit = totalReturns >= 0;
    const isTodayProfit = todayReturns >= 0;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-[26px] font-semibold text-[#3b4252] mb-6">Your investments</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Investments Summary Card */}
                    <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm">
                        <div className="mb-6">
                            <p className="text-[15px] text-gray-500 mb-1">Current</p>
                            <h2 className="text-[32px] font-bold text-[#3b4252] tracking-tight">₹{fmt(currentValue)}</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[15px] text-gray-500">1D returns</span>
                                <span className={`text-[15px] font-semibold ${isTodayProfit ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                    {isTodayProfit ? '+' : '-'}₹{fmt(Math.abs(todayReturns))} ({Math.abs(todayReturnsPercent).toFixed(2)}%)
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-[15px] text-gray-500">Total returns</span>
                                <span className={`text-[15px] font-semibold ${isProfit ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                    {isProfit ? '+' : '-'}₹{fmt(Math.abs(totalReturns))} ({Math.abs(totalReturnsPercent).toFixed(2)}%)
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-[15px] text-gray-500">Invested</span>
                                <span className="text-[15px] font-semibold text-[#3b4252]">₹{fmt(totalInvested)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Available Cash Card */}
                    <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm">
                        <div className="mb-6">
                            <p className="text-[15px] text-gray-500 mb-1">Available Cash</p>
                            <h2 className="text-[32px] font-bold text-[#00b386] tracking-tight">₹{fmt(balance)}</h2>
                        </div>
                        <div className="pt-4 mt-auto border-t border-gray-50">
                            <p className="text-[14px] text-gray-400">
                                Funds available for new investments
                            </p>
                        </div>
                    </div>
                </div>
                {holdings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No holdings yet</h3>
                        <p className="text-gray-400 text-sm mb-6">Start building your portfolio by exploring and buying stocks.</p>
                        <Link href="/dashboard" className="px-6 py-2.5 bg-[#00b386] text-white rounded-xl font-semibold text-sm hover:bg-[#00a37a] transition-colors">
                            Explore Stocks
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-900">Holdings ({holdings.length})</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="px-6 py-3.5">Company</th>
                                        <th className="px-6 py-3.5 text-right">Qty</th>
                                        <th className="px-6 py-3.5 text-right">Avg. Price</th>
                                        <th className="px-6 py-3.5 text-right">LTP</th>
                                        <th className="px-6 py-3.5 text-right">Current Value</th>
                                        <th className="px-6 py-3.5 text-right">P&L</th>
                                        <th className="px-6 py-3.5 text-right">Change</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {holdings.map(h => {
                                        const isUp = (h.pnl ?? 0) >= 0;
                                        return (
                                            <tr
                                                key={h.symbol}
                                                className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/stock/${encodeURIComponent(h.symbol)}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {h.symbol.replace('.NS', '').substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{h.symbol.replace('.NS', '')}</p>
                                                            <p className="text-xs text-gray-400">{h.symbol}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-gray-700">{h.quantity}</td>
                                                <td className="px-6 py-4 text-right text-sm text-gray-700">₹{fmt(h.averagePrice)}</td>
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">₹{fmt(h.currentPrice ?? h.averagePrice)}</td>
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">₹{fmt(h.currentValue ?? 0)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className={`text-sm font-semibold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                                                        {isUp ? '+' : ''}₹{fmt(Math.abs(h.pnl ?? 0))}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                                        {isUp ? '+' : ''}{(h.pnlPercent ?? 0).toFixed(2)}%
                                                    </span>
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
