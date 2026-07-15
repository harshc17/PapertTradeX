'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { TrendingUp, TrendingDown, ChevronRight, Wallet, BarChart3, Clock, Component, ScrollText, Search, Bot, Trophy } from 'lucide-react';
import AIPortfolioAnalyst from './AIPortfolioAnalyst';

export default function DashboardSidebar() {
    const { user, balance } = useAuth();
    const { holdings, totalInvested, currentValue, totalReturns, totalReturnsPercent, todayReturns, todayReturnsPercent } = usePortfolio();

    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const isProfit = totalReturns >= 0;

    const tools = [
        { name: 'Ask AI', icon: <Bot className="w-4 h-4 text-pink-500" />, href: '/ask-ai', badge: 'New' },
        { name: 'Stock Screener', icon: <Search className="w-4 h-4 text-blue-500" />, href: '/stock-screener' },
        { name: 'ETF Screener', icon: <BarChart3 className="w-4 h-4 text-purple-500" />, href: '/etf-screener' },
    ];

    return (
        <div className="space-y-5">
            {/* Portfolio Card */}
            {/* Portfolio Card */}
            <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[16px] font-semibold text-[#3b4252]">Your Portfolio</h3>
                    <Link href="/holdings" className="text-[13px] text-[#00b386] hover:underline font-medium">View all →</Link>
                </div>

                <div className="mb-6">
                    <p className="text-[14px] text-gray-500 mb-1">Current</p>
                    <h2 className="text-[28px] font-bold text-[#3b4252] tracking-tight">₹{fmt(currentValue)}</h2>
                </div>

                {holdings.length > 0 ? (
                    <>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center">
                                <span className="text-[14px] text-gray-500">1D returns</span>
                                <span className={`text-[14px] font-semibold ${todayReturns >= 0 ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                    {todayReturns >= 0 ? '+' : '-'}₹{fmt(Math.abs(todayReturns))} ({Math.abs(todayReturnsPercent).toFixed(2)}%)
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-[14px] text-gray-500">Total returns</span>
                                <span className={`text-[14px] font-semibold ${isProfit ? 'text-[#00b386]' : 'text-[#eb5b3c]'}`}>
                                    {isProfit ? '+' : '-'}₹{fmt(Math.abs(totalReturns))} ({Math.abs(totalReturnsPercent).toFixed(2)}%)
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-[14px] text-gray-500">Invested</span>
                                <span className="text-[14px] font-semibold text-[#3b4252]">₹{fmt(totalInvested)}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-center py-4">
                            <p className="text-[14px] text-gray-400 mb-3">No holdings yet.</p>
                            <Link href="/dashboard" className="text-[14px] font-semibold text-[#00b386] hover:underline">
                                Start investing →
                            </Link>
                        </div>
                    </>
                )}
            </div>

            {/* Products & Tools */}
            <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm">
                <h3 className="text-[16px] font-semibold text-[#3b4252] mb-4">Products & Tools</h3>
                <div className="space-y-1">
                    {tools.map(tool => (
                        <Link key={tool.name} href={tool.href}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gray-50 group-hover:bg-white flex items-center justify-center transition-colors">
                                    {tool.icon}
                                </div>
                                <span className="text-[14px] font-medium text-[#3b4252] group-hover:text-[#00b386] transition-colors">{tool.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {tool.badge && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-pink-100 text-[10px] font-bold text-pink-700 uppercase">{tool.badge}</span>
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#00b386] transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Weekly Challenge Card */}
            <Link href="/challenge" className="block group">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[16px] p-6 shadow-sm relative overflow-hidden transition-transform group-hover:-translate-y-1">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-[20px] -mr-10 -mt-10 pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Trophy className="w-5 h-5 text-white" />
                                <h3 className="text-[16px] font-bold text-white">Weekly Challenge</h3>
                            </div>
                            <p className="text-[13px] text-white/90">Compete & test your strategy!</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:bg-white/30 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </Link>

            {/* AI Portfolio Analyst */}
            <AIPortfolioAnalyst />
        </div>
    );
}
