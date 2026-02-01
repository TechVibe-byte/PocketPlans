import React, { useState, useMemo } from 'react';
import { WishlistItem, Category, Status, FilterState, SortField, Priority, Currency } from './types';
import { useWishlist } from './hooks/useWishlist';
import { useSettings } from './context/SettingsContext';
import { usePWA } from './hooks/usePWA';
import { ItemForm } from './components/ItemForm';
import { ItemCard } from './components/ItemCard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Button } from './components/ui/Button';
import { 
  Plus, Search, Filter, Download, Upload,
  Languages, Moon, Sun, LayoutGrid, ListFilter, Globe, PieChart, List,
  WifiOff, Smartphone
} from 'lucide-react';

type ViewMode = 'list' | 'analytics';

const App: React.FC = () => {
  // Hooks & Context
  const { items, fileInputRef, saveItem, deleteItem, exportCSV, triggerImport, handleFileUpload } = useWishlist();
  const { theme, toggleTheme, toggleLanguage, t, currency, setCurrency } = useSettings();
  const { isOffline, showInstallButton, installApp } = usePWA();

  // Local UI State
  const [view, setView] = useState<ViewMode>('list');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    priority: 'All',
    status: 'All'
  });
  const [sortField, setSortField] = useState<SortField>('createdAt');

  // Logic
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = filters.category === 'All' || item.category === filters.category;
        const matchesPriority = filters.priority === 'All' || item.priority === filters.priority;
        const matchesStatus = filters.status === 'All' || item.status === filters.status;
        return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
      })
      .sort((a, b) => {
        if (sortField === 'price') return b.price - a.price;
        if (sortField === 'priority') {
          const pMap = { [Priority.High]: 3, [Priority.Medium]: 2, [Priority.Low]: 1 };
          return pMap[b.priority] - pMap[a.priority];
        }
        return b.createdAt - a.createdAt;
      });
  }, [items, search, filters, sortField]);

  const stats = useMemo(() => {
    const total = filteredItems.reduce((acc, curr) => acc + curr.price, 0);
    return { count: filteredItems.length, total };
  }, [filteredItems]);

  const handleEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const formattedTotal = stats.total.toLocaleString('en-US', { style: 'currency', currency: currency });

  return (
    <div className="min-h-screen relative overflow-x-hidden text-gray-800 dark:text-gray-100 transition-colors duration-500">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
        accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
        className="hidden" 
      />

      {/* --- Liquid Background --- */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-400/20 dark:bg-purple-900/20 rounded-full blur-[80px] animate-blob mix-blend-multiply dark:mix-blend-screen"></div>
         <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-400/20 dark:bg-blue-900/20 rounded-full blur-[80px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen"></div>
         <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-indigo-400/20 dark:bg-indigo-900/20 rounded-full blur-[80px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen"></div>
      </div>

      {/* --- Header --- */}
      <header className="sticky top-0 z-30 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/20 dark:border-white/5 shadow-sm">
        
        {/* Offline Banner */}
        {isOffline && (
          <div className="bg-red-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 animate-in slide-in-from-top-0">
             <WifiOff size={12} />
             <span>Offline Mode - Changes saved locally</span>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                <LayoutGrid size={20} />
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
                {t.appTitle}
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* View Toggle */}
              <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1 mr-1 sm:mr-2">
                <button 
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <List size={18} />
                </button>
                <button 
                  onClick={() => setView('analytics')}
                  className={`p-1.5 rounded-md transition-all ${view === 'analytics' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <PieChart size={18} />
                </button>
              </div>

              <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 sm:p-2 rounded-full transition-colors ${showSettings ? 'bg-blue-500/20 text-blue-600' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
                 <Globe size={20} />
              </button>
              <button onClick={toggleLanguage} className="p-1.5 sm:p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <Languages size={20} />
              </button>
              <button onClick={toggleTheme} className="p-1.5 sm:p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
          </div>

          {/* Settings Dropdown */}
          <div className={`overflow-hidden transition-all duration-300 ${showSettings ? 'max-h-48 opacity-100 mb-3' : 'max-h-0 opacity-0'}`}>
             <div className="glass-panel p-3 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.currency}</span>
                    <select 
                      value={currency} 
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="p-1 rounded bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                </div>

                {showInstallButton && (
                  <Button onClick={installApp} variant="primary" size="sm" fullWidth className="justify-center">
                    <Smartphone size={16} className="mr-2" /> Install App
                  </Button>
                )}
             </div>
          </div>

          {/* Search & Filter Bar - Only in List View */}
          {view === 'list' && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-100/50 dark:bg-black/20 border border-transparent focus:bg-white dark:focus:bg-black/40 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none text-sm transition-all"
                  />
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-xl border transition-all duration-300 ${showFilters ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30' : 'bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 hover:bg-white dark:hover:bg-gray-800'}`}
                >
                  <ListFilter size={20} />
                </button>
              </div>

              {/* Collapsible Filters */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-80 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <div className="glass-panel rounded-xl p-3 grid grid-cols-2 gap-2">
                   <select 
                    className="p-2 rounded-lg bg-white/50 dark:bg-black/20 text-sm border border-white/20 dark:border-white/10 focus:ring-2 focus:ring-blue-500/30 outline-none"
                    value={filters.category}
                    onChange={(e) => setFilters({...filters, category: e.target.value as Category | 'All'})}
                   >
                     <option value="All">{t.filters.all} {t.labels.category}</option>
                     {Object.values(Category).map(c => <option key={c} value={c}>{t.categories[c]}</option>)}
                   </select>

                   <select 
                    className="p-2 rounded-lg bg-white/50 dark:bg-black/20 text-sm border border-white/20 dark:border-white/10 focus:ring-2 focus:ring-blue-500/30 outline-none"
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value as Status | 'All'})}
                   >
                     <option value="All">{t.filters.all} {t.labels.status}</option>
                     {Object.values(Status).map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
                   </select>
                   
                   <select 
                    className="p-2 rounded-lg bg-white/50 dark:bg-black/20 text-sm border border-white/20 dark:border-white/10 focus:ring-2 focus:ring-blue-500/30 outline-none"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                   >
                     <option value="createdAt">{t.filters.newest}</option>
                     <option value="price">{t.filters.priceHigh}</option>
                     <option value="priority">{t.filters.sortBy} {t.labels.priority}</option>
                   </select>

                   <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                     <Button size="sm" variant="ghost" onClick={exportCSV} className="justify-center border border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/5">
                        <Download size={14} className="mr-2" /> {t.export}
                     </Button>
                     <Button size="sm" variant="ghost" onClick={triggerImport} className="justify-center border border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/5">
                        <Upload size={14} className="mr-2" /> {t.import}
                     </Button>
                   </div>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4 relative z-10 min-h-[50vh]">
        
        {view === 'analytics' ? (
          <AnalyticsDashboard items={items} />
        ) : (
          <>
            {/* Stats Bar */}
            <div className="flex justify-between items-center text-sm px-4 py-2 rounded-full glass-panel shadow-sm">
               <span className="text-gray-600 dark:text-gray-300 font-medium">{stats.count} {t.count}</span>
               <span className="text-gray-600 dark:text-gray-300 font-medium">{t.total}: <span className="text-blue-600 dark:text-blue-400 font-bold">{formattedTotal}</span></span>
            </div>

            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                 <div className="relative w-28 h-28 flex items-center justify-center mb-8">
                    <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/10 rounded-full blur-xl animate-pulse-slow" />
                    <div className="absolute inset-0 bg-blue-400/10 dark:bg-blue-400/5 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10 border border-white/50 dark:border-white/10">
                        <Filter size={32} className="text-blue-600 dark:text-blue-400 opacity-90" />
                    </div>
                 </div>
                 <p className="text-lg font-medium text-gray-600 dark:text-gray-300 max-w-xs mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700">
                   {t.emptyState}
                 </p>
                 {showInstallButton && (
                    <Button onClick={installApp} variant="secondary" size="sm" className="mt-6">
                      <Smartphone size={16} className="mr-2" /> Install App
                    </Button>
                 )}
              </div>
            ) : (
              filteredItems.map(item => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  onEdit={handleEdit}
                  onDelete={setItemToDelete}
                />
              ))
            )}
          </>
        )}
      </main>

      {/* --- Floating Action Button --- */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
          className="group relative w-16 h-16 flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-105 active:scale-95 transition-all duration-300"
          aria-label={t.addItem}
        >
          <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Plus size={32} className="relative z-10" />
        </button>
      </div>

      {/* --- Modal --- */}
      <ItemForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSave={(data) => saveItem(data, editingItem?.id)}
        initialData={editingItem}
      />

      <ConfirmDialog 
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => { if(itemToDelete) deleteItem(itemToDelete); setItemToDelete(null); }}
        title={t.labels.deleteTitle}
        message={t.labels.confirmDelete}
        confirmLabel={t.labels.delete}
        cancelLabel={t.labels.cancel}
      />

    </div>
  );
};

export default App;