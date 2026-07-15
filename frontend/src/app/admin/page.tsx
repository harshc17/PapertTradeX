'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            router.push('/login');
            return;
        }
        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'ADMIN') {
            router.push('/dashboard'); // Kick non-admins
            return;
        }
        setUser(parsed);
    }, []);

    if (!user) return <div className="p-10">Checking Admin Access...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
                <h1 className="text-2xl font-bold mb-4 text-red-600">Admin Panel</h1>
                <p className="mb-4">Welcome, Admin <strong>{user.username}</strong></p>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded border">
                        <h3 className="font-bold">System Status</h3>
                        <p className="text-green-500">Online</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border">
                        <h3 className="font-bold">Total Users</h3>
                        <p>2 (Demo)</p>
                    </div>
                </div>

                <div className="mt-8">
                    <h3 className="font-bold mb-2">Admin Actions</h3>
                    <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mr-2">Reset Market</button>
                    <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onClick={() => router.push('/dashboard')}>Go to Trading Dashboard</button>
                </div>
            </div>
        </div>
    );
}
