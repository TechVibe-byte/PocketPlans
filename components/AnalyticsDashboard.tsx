import React, { useMemo } from 'react';
import { WishlistItem, Category, Status } from '../types';
import { useSettings } from '../context/SettingsContext';
import { PieChart, BarChart2, TrendingUp } from 'lucide-react';

interface AnalyticsDashboardProps {
  items: WishlistItem[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ items }) => {
  const { t, currency } = useSettings();

  const data = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {
      [Status.Planned]: 0,
      [Status.Bought]: 0,
      [Status.Dropped]: 0
    };
    let totalPlanned = 0;
    let totalBought = 0;

    items.forEach(item => {
      // Sum price by category
      byCategory[item.category] = (byCategory[item.category] || 0) + item.price;
      
      // Count by status
      byStatus[item.status]++;

      if (item.status === Status.Planned) totalPlanned += item.price;
      if (item.status === Status.Bought) totalBought += item.price;
    });

    return { byCategory, byStatus, totalPlanned, totalBought };
  }, [items]);

  const maxCategoryValue = Math.max(...(Object.values(data.byCategory) as number[]), 1);
  const totalItems = items.length || 1;

  const formatPrice = (amount: number) => 
    amount.toLocaleString('en-US', { style: 'currency', currency });

  // Donut Chart Calculations
  const plannedCount = data.byStatus[Status.Planned];
  const boughtCount = data.byStatus[Status.Bought];
  const droppedCount = data.byStatus[Status.Dropped];
  const totalCount = items.length;

  // Degrees for conic-gradient
  const plannedDeg = totalCount ? (plannedCount / totalCount) * 360 : 0;
  const boughtDeg = totalCount ? (boughtCount / totalCount) * 360 : 0;
  const droppedDeg = totalCount ? (droppedCount / totalCount) * 360 : 0; // Remainder

  // Colors matching the UI theme
  const colorPlanned = '#3b82f6'; // blue-500
  const colorBought = '#22c55e'; // green-500
  const colorDropped = '#9ca3af'; // gray-400

  const donutGradient = `conic-gradient(
    ${colorPlanned} 0deg ${plannedDeg}deg,
    ${colorBought} ${plannedDeg}deg ${plannedDeg + boughtDeg}deg,
    ${colorDropped} ${plannedDeg + boughtDeg}deg 360deg
  )`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-blue-500">
          <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">{t.statuses.Planned}</h3>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatPrice(data.totalPlanned)}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-green-500">
          <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">{t.statuses.Bought}</h3>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatPrice(data.totalBought)}</p>
        </div>
      </div>

      {/* Spending by Category */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={20} className="text-blue-500" />
          <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.analytics.spendingByCategory}</h3>
        </div>
        <div className="space-y-4">
          {(Object.entries(data.byCategory) as [string, number][])
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
            <div key={cat}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-300 font-medium">{t.categories[cat as Category]}</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatPrice(amount)}</span>
              </div>
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                  style={{ width: `${(amount / maxCategoryValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {Object.keys(data.byCategory).length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">{t.emptyState}</p>
          )}
        </div>
      </div>

      {/* Items by Status (Pie/Donut Chart) */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center gap-2 mb-6">
          <PieChart size={20} className="text-indigo-500" />
          <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.analytics.itemsByStatus}</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Visual Chart */}
            <div className="relative w-40 h-40 flex-shrink-0">
                <div 
                    className="w-full h-full rounded-full shadow-inner"
                    style={{ background: totalCount > 0 ? donutGradient : '#e5e7eb' }}
                ></div>
                <div className="absolute inset-6 bg-white dark:bg-gray-900 rounded-full flex flex-col items-center justify-center shadow-sm">
                    <span className="text-2xl font-bold text-gray-800 dark:text-white">{totalCount}</span>
                    <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Total</span>
                </div>
            </div>

            {/* Legend / List */}
            <div className="flex-1 w-full space-y-3">
            {(Object.entries(data.byStatus) as [string, number][]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                    status === Status.Planned ? 'bg-blue-500' :
                    status === Status.Bought ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.statuses[status as Status]}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{count}</span>
                    <span className="text-xs text-gray-500">({Math.round((count / totalItems) * 100)}%)</span>
                </div>
                </div>
            ))}
            </div>
        </div>
      </div>
    </div>
  );
};