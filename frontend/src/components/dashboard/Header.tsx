'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, TrendingUp, LogOut, ChevronDown, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const QUICK_SYMBOLS = [
    { symbol: 'RELIANCE.NS', shortname: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS.NS', shortname: 'TCS', exchange: 'NSE' },
    { symbol: 'HDFCBANK.NS', shortname: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'INFY.NS', shortname: 'Infosys', exchange: 'NSE' },
    { symbol: 'ICICIBANK.NS', shortname: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN.NS', shortname: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'ITC.NS', shortname: 'ITC', exchange: 'NSE' },
    { symbol: '^NSEI', shortname: 'NIFTY 50', exchange: 'NSE' },
    { symbol: '^BSESN', shortname: 'SENSEX', exchange: 'BSE' },
    { symbol: '^NSEBANK', shortname: 'BANK NIFTY', exchange: 'NSE' },
];

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, balance, logout, refreshBalance } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
    const [localResults, setLocalResults] = useState<any[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        refreshBalance();
        fetch('http://localhost:3001/api/market-status')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setMarketOpen(d.isOpen); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                setLocalResults([]);
                return;
            }

            const q = searchQuery.toLowerCase().trim();
            const instant = QUICK_SYMBOLS.filter(item =>
                item.symbol.toLowerCase().includes(q) ||
                item.shortname.toLowerCase().includes(q)
            ).slice(0, 5);
            setLocalResults(instant);

            if (searchAbortRef.current) searchAbortRef.current.abort();
            const controller = new AbortController();
            searchAbortRef.current = controller;

            try {
                const res = await fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(searchQuery)}`, {
                    signal: controller.signal,
                });
                const data = await res.json();
                setSearchResults((data.quotes || []).slice(0, 8));
            } catch (error) {
                if ((error as any)?.name !== 'AbortError') {
                    console.error('Search error:', error);
                }
            }
        };
        const t = setTimeout(fetchResults, 150);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const navItems = [
        { name: 'Explore', href: '/dashboard' },
        { name: 'Holdings', href: '/holdings' },
        { name: 'Orders', href: '/orders' },
        { name: 'Watchlist', href: '/watchlist' },
        { name: 'Weekly Challenge', href: '/challenge' },
    ];

    const fmtBalance = (n: number) =>
        n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return (
        <header className="sticky top-0 z-40 flex flex-col border-b border-white/60 bg-white/85 backdrop-blur-xl shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
            {/* Market Status Banner */}
            {marketOpen === false && (
                <div className="bg-orange-50 text-orange-600 text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    Market is closed right now
                </div>
            )}

            {/* Top Row */}
            <div className="flex items-center justify-between px-4 lg:px-6 py-3 gap-4">
                {/* Logo */}
                <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#00b386] to-[#16c79a] rounded-xl flex items-center justify-center shadow-[0_8px_18px_rgba(0,179,134,0.28)]">
                        <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-gray-900 hidden sm:block font-[var(--font-heading)]">PaperTradeX</span>
                </Link>

                {/* Search */}
                <div className="flex-1 max-w-xl relative" ref={searchRef}>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#00b386] transition-colors" />
                        <input
                            type="text"
                            id="stock-search-input"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={() => setShowResults(true)}
                            placeholder="Search stocks, ETFs, indices..."
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-200/90 rounded-xl bg-white/90 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b386]/20 focus:border-[#00b386] focus:bg-white transition-all text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Search Dropdown */}
                    {showResults && searchQuery.length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-80 overflow-y-auto z-50">
                            {(localResults.length > 0 || searchResults.length > 0) ? (
                                <>
                                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Search Results</p>
                                    </div>
                                    {(searchResults.length > 0 ? searchResults : localResults).map((result: any, i) => (
                                        <div
                                            key={`${result.symbol}-${i}`}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0"
                                            onClick={() => {
                                                router.push(`/stock/${encodeURIComponent(result.symbol)}`);
                                                setSearchQuery('');
                                                setShowResults(false);
                                            }}
                                        >
                                            <div>
                                                <div className="font-semibold text-gray-900 text-sm">{result.shortname || result.name || result.symbol}</div>
                                                <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                                                    {result.exchange && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{result.exchange}</span>}
                                                    <span>{result.symbol}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-300 group-hover:text-[#00b386] transition-colors">→</span>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className="px-4 py-6 text-center text-sm text-gray-400">No results found</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Balance Pill */}
                    {user && (
                        <div className="hidden md:flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
                            <span className="text-xs text-green-500">₹</span>
                            {fmtBalance(balance)}
                        </div>
                    )}

                    <button className="relative text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                    </button>

                    {/* User Menu */}
                    {user ? (
                        <div className="relative" ref={userMenuRef}>
                            <button
                                id="user-menu-btn"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-[#00b386] flex items-center justify-center text-white font-bold text-sm">
                                    {user.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                                        <p className="text-xs text-gray-500">{user.email}</p>
                                        <div className="mt-2 bg-green-50 rounded-lg px-2 py-1.5 flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Balance</span>
                                            <span className="text-sm font-bold text-green-600">₹{fmtBalance(balance)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/login" className="px-4 py-2 bg-[#00b386] text-white text-sm font-semibold rounded-lg hover:bg-[#00a37a] transition-colors">
                            Login
                        </Link>
                    )}
                </div>
            </div>

            {/* Bottom Nav */}
            <div className="px-4 lg:px-6 border-t border-gray-100/70">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {navItems.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`text-sm font-medium whitespace-nowrap px-3 py-2.5 my-1.5 rounded-lg transition-all ${
                                    isActive
                                        ? 'text-[#00b386] bg-[#00b386]/10 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/80'
                                }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
