'use client';

import { useState } from 'react';
import { Sparkles, BrainCircuit, CheckCircle2, AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';

export default function AIPortfolioAnalyst() {
    const { holdings, currentValue, totalInvested } = usePortfolio();
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generateAnalysis = async () => {
        if (holdings.length === 0) {
            setError("You don't have any holdings to analyze yet! Make some trades first.");
            return;
        }

        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('ptx_token') || localStorage.getItem('token') || '';
            const res = await fetch('http://localhost:3001/api/ai/portfolio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ holdings }),
            });

            if (res.status === 404) {
                throw new Error('Endpoint not found. Please restart your backend server (Ctrl+C then npm start)!');
            }
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch AI analysis');
            }

            const data = await res.json();
            setAnalysis(data);
        } catch (err: any) {
            setError(err.message || 'Something went wrong while generating analysis.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-[#1a1f2b] to-[#262c3e] rounded-[16px] border border-[#3b4252] p-6 shadow-lg relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-[#00b386] rounded-full blur-[60px] opacity-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-purple-500 rounded-full blur-[60px] opacity-20 pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[16px] font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        AI Portfolio Analyst
                    </h3>
                    {analysis && (
                        <button 
                            onClick={generateAnalysis}
                            disabled={loading}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>

                {!analysis && !loading && (
                    <div className="text-center py-4">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <BrainCircuit className="w-6 h-6 text-[#00b386]" />
                        </div>
                        <p className="text-sm text-gray-300 mb-4 px-2 leading-relaxed">
                            Let AI analyze your paper trading strategy, identify risks, and suggest improvements.
                        </p>
                        <button
                            onClick={generateAnalysis}
                            className="w-full py-2.5 bg-[#00b386] text-white text-sm font-semibold rounded-xl hover:bg-[#00a37a] transition-all shadow-[0_4px_12px_rgba(0,179,134,0.3)] hover:shadow-[0_6px_16px_rgba(0,179,134,0.4)]"
                        >
                            Generate Analysis
                        </button>
                        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                    </div>
                )}

                {loading && (
                    <div className="text-center py-6">
                        <div className="w-10 h-10 border-3 border-[#00b386]/30 border-t-[#00b386] rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm text-gray-400 animate-pulse">AI is analyzing your holdings...</p>
                    </div>
                )}

                {analysis && !loading && (
                    <div className="space-y-4">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <p className="text-sm text-gray-200 leading-relaxed">
                                {analysis.summary}
                            </p>
                        </div>

                        {analysis.strengths && analysis.strengths.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                    Strengths
                                </h4>
                                <ul className="space-y-1.5">
                                    {analysis.strengths.map((str: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-300 pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-2 before:w-1.5 before:h-1.5 before:bg-green-400/50 before:rounded-full">
                                            {str}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                                    Areas of Risk
                                </h4>
                                <ul className="space-y-1.5">
                                    {analysis.weaknesses.map((wk: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-300 pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-2 before:w-1.5 before:h-1.5 before:bg-orange-400/50 before:rounded-full">
                                            {wk}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {analysis.recommendations && analysis.recommendations.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                                    Recommendations
                                </h4>
                                <ul className="space-y-1.5">
                                    {analysis.recommendations.map((rec: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-300 pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-2 before:w-1.5 before:h-1.5 before:bg-yellow-400/50 before:rounded-full">
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
