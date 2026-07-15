import { Component, ScrollText, BarChart3, Clock } from 'lucide-react';

export default function ToolsSidebar() {
    const tools = [
        { name: 'IPO', icon: <Component className="h-5 w-5 text-blue-500" />, badge: '8 open' },
        { name: 'Bonds', icon: <ScrollText className="h-5 w-5 text-teal-500" /> },
        { name: 'ETF Screener', icon: <BarChart3 className="h-5 w-5 text-purple-500" /> },
        { name: 'Intraday Screener', icon: <Clock className="h-5 w-5 text-orange-500" /> },
    ];

    return (
        <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Products & Tools</h2>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {tools.map((tool) => (
                    <div key={tool.name} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                                {tool.icon}
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{tool.name}</span>
                        </div>
                        {tool.badge && (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">{tool.badge}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
