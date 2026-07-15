'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const router = useRouter();
    useEffect(() => {
        const token = localStorage.getItem('ptx_token') || localStorage.getItem('token');
        router.replace(token ? '/dashboard' : '/login');
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#00b386] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400 text-sm">Loading PaperTradeX...</p>
            </div>
        </div>
    );
}
