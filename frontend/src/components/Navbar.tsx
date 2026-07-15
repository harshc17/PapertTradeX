import Link from 'next/link';
import { Search } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-2xl font-bold text-primary">PaperTradeX</Link>
                    <div className="hidden md:flex gap-6 text-sm font-medium">
                        <Link href="/" className="text-gray-900 border-b-2 border-primary">Explore</Link>
                        <Link href="#" className="text-gray-500 hover:text-gray-900">Investments</Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
