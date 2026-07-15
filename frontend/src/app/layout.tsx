import './globals.css'
import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import AppProviders from './providers'

const manrope = Manrope({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800'],
    display: 'swap',
    variable: '--font-body',
})

const sora = Sora({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-heading',
})

export const metadata: Metadata = {
    title: 'PaperTradeX — Paper Trading with Real Indian Stock Prices',
    description: 'Practice trading Indian stocks on NSE & BSE with ₹1 Lakh virtual money. Real-time prices, zero real risk.',
    keywords: 'paper trading, NSE, BSE, Indian stocks, virtual trading, stock market simulator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${manrope.variable} ${sora.variable} font-[var(--font-body)]`}>
                <AppProviders>
                    {children}
                </AppProviders>
            </body>
        </html>
    )
}
