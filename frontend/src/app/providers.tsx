'use client';

import { AuthProvider } from '@/context/AuthContext';
import { PortfolioProvider } from '@/context/PortfolioContext';
import { HoldingsProvider } from '@/context/HoldingsContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <PortfolioProvider>
                <HoldingsProvider>
                    {children}
                </HoldingsProvider>
            </PortfolioProvider>
        </AuthProvider>
    );
}
