'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AuthPage() {
    const router = useRouter();
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (isLogin) {
                await login(email, password);
                router.push('/dashboard');
            } else {
                await register(name, email, password, phone);
                setSuccess('Account created! Redirecting...');
                setTimeout(() => router.push('/dashboard'), 1000);
            }
        } catch (e: any) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const switchTab = (toLogin: boolean) => {
        setIsLogin(toLogin);
        setError('');
        setSuccess('');
    };

    return (
        <div className="min-h-screen flex font-sans">
            {/* Left Panel - Brand */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#00b386] via-[#00a37a] to-[#007a5c] flex-col justify-between p-12 relative overflow-hidden">
                {/* Background decorative circles */}
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full bg-white opacity-5"></div>
                    <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full bg-white opacity-5"></div>
                    <div className="absolute top-1/2 left-[-40px] w-40 h-40 rounded-full bg-white opacity-5"></div>
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                            <TrendingUp className="w-6 h-6 text-[#00b386]" />
                        </div>
                        <span className="text-white text-2xl font-bold tracking-tight">PaperTradeX</span>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Trade Indian Stocks<br />
                        <span className="text-green-200">Without Real Risk</span>
                    </h2>
                    <p className="text-green-100 text-lg mb-10 leading-relaxed">
                        Practice trading with ₹1 Lakh virtual money. Real NSE/BSE prices, zero real risk.
                    </p>

                    <div className="space-y-4">
                        {[
                            'Real-time NSE & BSE stock prices',
                            '₹1,00,000 virtual money to start',
                            'Track P&L with live charts',
                            'Buy & sell Indian stocks anytime'
                        ].map((feat) => (
                            <div key={feat} className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-200 flex-shrink-0" />
                                <span className="text-green-100 text-sm">{feat}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom stat */}
                <div className="relative z-10 flex gap-8">
                    <div>
                        <p className="text-white text-2xl font-bold">₹1L</p>
                        <p className="text-green-200 text-sm">Starting Balance</p>
                    </div>
                    <div>
                        <p className="text-white text-2xl font-bold">5000+</p>
                        <p className="text-green-200 text-sm">Indian Stocks</p>
                    </div>
                    <div>
                        <p className="text-white text-2xl font-bold">Live</p>
                        <p className="text-green-200 text-sm">Market Data</p>
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-8 h-8 bg-[#00b386] rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-900">PaperTradeX</span>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {isLogin ? 'Welcome back 👋' : 'Create your account'}
                    </h1>
                    <p className="text-gray-500 text-sm mb-8">
                        {isLogin
                            ? 'Login to your PaperTradeX account to continue trading.'
                            : 'Sign up and get ₹1 Lakh to start paper trading instantly.'}
                    </p>

                    {/* Tab Toggle */}
                    <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
                        <button
                            type="button"
                            onClick={() => switchTab(true)}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                                isLogin
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            onClick={() => switchTab(false)}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                                !isLogin
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Error / Success Alerts */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {success}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Harsh Sharma"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b386]/30 focus:border-[#00b386] transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="+91 98765 43210"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b386]/30 focus:border-[#00b386] transition-all text-sm"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b386]/30 focus:border-[#00b386] transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b386]/30 focus:border-[#00b386] transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            id="auth-submit-btn"
                            disabled={loading}
                            className="w-full py-3.5 bg-[#00b386] hover:bg-[#00a37a] text-white font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group text-sm shadow-lg shadow-[#00b386]/20 mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {isLogin ? 'Logging in...' : 'Creating Account...'}
                                </span>
                            ) : (
                                <>
                                    {isLogin ? 'Login to PaperTradeX' : 'Create Account — Free'}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-gray-500 text-xs mt-6">
                        By continuing, you agree to our{' '}
                        <span className="text-[#00b386] cursor-pointer hover:underline">Terms of Service</span>
                        {' '}and{' '}
                        <span className="text-[#00b386] cursor-pointer hover:underline">Privacy Policy</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
