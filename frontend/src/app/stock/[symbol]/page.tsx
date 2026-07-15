'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/dashboard/Header';
import StockDetail from '@/components/stock/StockDetail';
import TradingPanel from '@/components/stock/TradingPanel';
import AINewsPanel from '@/components/stock/AINewsPanel';

const StockChart = dynamic(() => import('@/components/stock/StockChart'), {
    loading: () => <div className="h-[390px] rounded-2xl bg-white border border-gray-100 animate-pulse" />,
});

export default function StockPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading } = useAuth();
    const symbol = decodeURIComponent(params.symbol as string);

    useEffect(() => {
        if (!loading && !user) router.push('/login');
    }, [user, loading]);

    if (loading || !user) return null;

    return (
        <div className="min-h-screen bg-[#f6f7f9] font-sans">
            <Header />
            <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-7">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-8 space-y-5">
                        <StockDetail symbol={symbol} />
                        <StockChart symbol={symbol} />
                        <AINewsPanel symbol={symbol} companyName={decodeURIComponent(symbol).replace(/\.(NS|BO)$/i, '')} />
                    </div>

                    <div className="lg:col-span-4">
                        <TradingPanel symbol={symbol} />
                    </div>
                </div>
            </main>
        </div>
    );
}
