'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const API = 'http://localhost:3001';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    balance: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    balance: number;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string, phone: string) => Promise<void>;
    logout: () => void;
    refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('ptx_token');
        const storedUser = localStorage.getItem('ptx_user');
        if (storedToken && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(parsedUser);
                setBalance(parsedUser.balance || 0);
            } catch {
                localStorage.removeItem('ptx_token');
                localStorage.removeItem('ptx_user');
            }
        }
        setLoading(false);
    }, []);

    const refreshBalance = useCallback(async () => {
        const t = localStorage.getItem('ptx_token');
        if (!t) return;
        try {
            const res = await fetch(`${API}/api/portfolio`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setBalance(data.balance ?? 0);
                // Update stored user balance
                const storedUser = localStorage.getItem('ptx_user');
                if (storedUser) {
                    const u = JSON.parse(storedUser);
                    u.balance = data.balance;
                    localStorage.setItem('ptx_user', JSON.stringify(u));
                }
            }
        } catch (e) {
            // silent
        }
    }, []);

    const login = async (email: string, password: string) => {
        const res = await fetch(`${API}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        localStorage.setItem('ptx_token', data.token);
        localStorage.setItem('ptx_user', JSON.stringify(data.user));
        // legacy key for TradingPanel compatibility
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setBalance(data.user.balance ?? 0);
    };

    const register = async (name: string, email: string, password: string, phone: string) => {
        const res = await fetch(`${API}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, phone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        localStorage.setItem('ptx_token', data.token);
        localStorage.setItem('ptx_user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setBalance(data.user.balance ?? 100000);
    };

    const logout = () => {
        localStorage.removeItem('ptx_token');
        localStorage.removeItem('ptx_user');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        setBalance(0);
    };

    return (
        <AuthContext.Provider value={{ user, token, balance, loading, login, register, logout, refreshBalance }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
