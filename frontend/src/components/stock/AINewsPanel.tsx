'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Calendar, Clock, RefreshCw, Newspaper } from 'lucide-react';

interface AINewsPanelProps {
    symbol: string;
    companyName?: string;
}

export default function AINewsPanel({ symbol, companyName }: AINewsPanelProps) {
    const [news, setNews] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchNews = () => {
        setLoading(true);
        setError(false);
        fetch(`http://localhost:3001/api/stock/${encodeURIComponent(symbol)}/news`)
            .then(r => r.ok ? r.json() : Promise.reject())
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
    }, [symbol]);

    const formatDateTime = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
            + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-5 h-5 bg-purple-100 rounded-full animate-pulse" />
                    <div className="w-32 h-4 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="w-3/4 h-6 bg-gray-100 rounded mb-3 animate-pulse" />
                <div className="w-1/2 h-4 bg-green-50 rounded mb-5 animate-pulse" />
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-3 bg-gray-50 rounded" style={{ width: `${100 - i * 8}%` }} />
                    ))}
                </div>
                <p className="text-center text-xs text-gray-400 mt-5 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3 h-3 animate-pulse text-purple-400" />
                    AI is generating news for {companyName || symbol}...
                </p>
            </div>
        );
    }

    if (error || !news || !news.title) {
        return (
            <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm text-center">
                <Newspaper className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400 mb-3">Could not load AI news for {companyName || symbol}</p>
                <button onClick={fetchNews}
                    className="text-xs text-purple-500 hover:underline flex items-center gap-1 mx-auto">
                    <RefreshCw className="w-3 h-3" /> Retry
                </button>
            </div>
        );
    }

    const paragraphs = (news.content || '')
        .split('\n')
        .filter((p: string) => p.trim() !== '');

    return (
        <div className="bg-white rounded-[16px] border border-gray-200/80 p-6 shadow-sm relative overflow-hidden">
            {/* Decorative blob */}
            <div className="absolute -top-8 -right-8 w-36 h-36 bg-purple-50 rounded-full blur-[40px] opacity-60 pointer-events-none" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[16px] font-semibold text-[#3b4252] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        AI News Analyst
                    </h3>
                    <div className="flex items-center gap-2">
                        {news.generatedAt && (
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(news.generatedAt)}
                            </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI · Daily
                        </span>
                    </div>
                </div>

                {/* Headline */}
                <h4 className="text-[18px] font-bold text-gray-900 leading-tight mb-2">
                    {news.title}
                </h4>

                {/* Summary */}
                <p className="text-[13px] font-medium text-[#00b386] mb-5 pb-4 border-b border-gray-50 leading-relaxed">
                    {news.summary}
                </p>

                {/* Full content */}
                <div className="text-[13px] text-gray-600 leading-relaxed space-y-3">
                    {paragraphs.map((para: string, i: number) => (
                        <p key={i}>{para}</p>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        AI-generated · Refreshes daily at midnight IST
                    </p>
                    {news.cached && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">cached</span>
                    )}
                </div>
            </div>
        </div>
    );
}
