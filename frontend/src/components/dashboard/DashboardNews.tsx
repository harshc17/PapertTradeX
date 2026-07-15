'use client';

import { useEffect, useState } from 'react';
import { Newspaper, Clock, RefreshCw, Sparkles } from 'lucide-react';

interface Article {
    headline: string;
    summary: string;
    time: string;
}

interface NewsData {
    title: string;
    articles: Article[];
    generatedAt?: string;
    cached?: boolean;
}

export default function DashboardNews() {
    const [news, setNews] = useState<NewsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchNews = () => {
        setLoading(true);
        setError(false);
        fetch('http://localhost:3001/api/ai/market-news')
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => {
                setNews(data);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const formatTime = (iso?: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
        });
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
        });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
                        <div className="w-36 h-4 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="w-24 h-5 bg-gray-100 rounded-lg animate-pulse" />
                </div>
                <div className="space-y-5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="animate-pulse">
                            <div className="w-4/5 h-4 bg-gray-100 rounded mb-2" />
                            <div className="w-full h-3 bg-gray-50 rounded mb-1" />
                            <div className="w-2/3 h-3 bg-gray-50 rounded mb-2" />
                            <div className="w-16 h-2.5 bg-gray-50 rounded" />
                        </div>
                    ))}
                </div>
                <p className="text-center text-xs text-gray-400 mt-5 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3 h-3 animate-pulse text-blue-400" />
                    AI is generating today's market news...
                </p>
            </div>
        );
    }

    if (error || !news || !news.articles?.length) {
        return (
            <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm text-center">
                <Newspaper className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400 mb-3">Could not load market news</p>
                <button onClick={fetchNews} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mx-auto">
                    <RefreshCw className="w-3 h-3" /> Try again
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm relative overflow-hidden">
            {/* Decorative gradient blob */}
            <div className="absolute -top-8 -right-8 w-36 h-36 bg-blue-50 rounded-full blur-[40px] opacity-70 pointer-events-none" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[16px] font-semibold text-[#3b4252] flex items-center gap-2">
                        <Newspaper className="w-5 h-5 text-blue-500" />
                        Stocks in news today
                    </h2>
                    <div className="flex items-center gap-2">
                        {news.generatedAt && (
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Updated {formatDate(news.generatedAt)} · {formatTime(news.generatedAt)}
                            </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI · Daily
                        </span>
                    </div>
                </div>

                {/* Subheadline if present */}
                {news.title && (
                    <p className="text-[12px] font-medium text-gray-500 mb-5 pb-4 border-b border-gray-50">
                        {news.title}
                    </p>
                )}

                {/* Articles */}
                <div className="space-y-5">
                    {news.articles.map((article, idx) => (
                        <div key={idx} className="group cursor-pointer">
                            <div className="flex items-start gap-3">
                                {/* Index number */}
                                <span className="text-[11px] font-bold text-gray-300 mt-1 w-4 flex-shrink-0">
                                    {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[14px] font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug mb-1">
                                        {article.headline}
                                    </h3>
                                    <p className="text-[12px] text-gray-500 leading-relaxed mb-1.5">
                                        {article.summary}
                                    </p>
                                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                        <Clock className="w-2.5 h-2.5" />
                                        {article.time}
                                    </div>
                                </div>
                            </div>
                            {idx < news.articles.length - 1 && (
                                <div className="mt-4 border-b border-gray-50" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        Generated by AI · Refreshes daily at midnight IST
                    </p>
                    {news.cached && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">cached</span>
                    )}
                </div>
            </div>
        </div>
    );
}
