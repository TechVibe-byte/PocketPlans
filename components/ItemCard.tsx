import React from 'react';
import { WishlistItem, Priority, Status } from '../types';
import { ALLOWED_PROTOCOLS } from '../constants';
import { useSettings } from '../context/SettingsContext';
import { Edit2, Trash2, MoreVertical, Calendar, ExternalLink, ShoppingBag, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ItemCardProps {
  item: WishlistItem;
  onEdit: (item: WishlistItem) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onEdit, onDelete, isLoading = false }) => {
  const { t, lang, currency } = useSettings();
  const [showMenu, setShowMenu] = React.useState(false);

  const priorityColors = {
    [Priority.High]: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-900/30',
    [Priority.Medium]: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200/50 dark:border-yellow-900/30',
    [Priority.Low]: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-900/30',
  };

  const statusBorderColor = {
    [Status.Planned]: 'border-l-blue-500',
    [Status.Bought]: 'border-l-green-500',
    [Status.Dropped]: 'border-l-gray-400',
  };

  const formattedDate = new Date(item.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'te-IN', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const isSafeLink = item.link && ALLOWED_PROTOCOLS.some(proto => item.link!.startsWith(proto));

  const formattedPrice = item.price.toLocaleString(lang === 'en' ? 'en-US' : 'te-IN', { 
    style: 'currency', 
    currency: currency 
  });

  return (
    <div className={`relative p-5 rounded-2xl glass-panel shadow-sm hover:shadow-md transition-all duration-300 border-l-[6px] ${statusBorderColor[item.status]} group ${isLoading ? 'opacity-70 ring-2 ring-blue-500/30 animate-pulse' : ''}`}>
      
      {isLoading && (
        <div className="absolute top-2 right-12 flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold animate-in fade-in zoom-in-90">
          <Loader2 size={10} className="animate-spin" />
          Updating...
        </div>
      )}

      <div className="flex gap-4">
        {/* Optional Image Thumbnail */}
        {item.imageUrl && (
            <div className="hidden sm:block w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
               <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=?'; }} />
            </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div className="pr-8">
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400 mb-1">
                {t.categories[item.category]}
              </span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 break-words leading-tight flex items-center gap-2">
                {item.name}
                {isSafeLink && (
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex text-blue-500/30 hover:text-blue-500 transition-colors p-1 rounded-md hover:bg-blue-500/10"
                    title={t.labels.visitLink}
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </h3>
            </div>

            <div className="absolute right-4 top-4">
              <div className="relative">
                <button 
                  onClick={() => setShowMenu(!showMenu)} 
                  disabled={isLoading}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all disabled:opacity-30"
                  aria-label="More options"
                >
                  <MoreVertical size={20} />
                </button>
                
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden animate-in zoom-in-95 duration-200 origin-top-right border border-black/5 dark:border-white/10">
                      <button 
                        onClick={() => { 
                          onEdit(item); 
                          setShowMenu(false); 
                        }}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <Edit2 size={14} className="text-blue-500" /> {t.editItem}
                      </button>
                      <button 
                        onClick={() => { 
                          onDelete(item.id); 
                          setShowMenu(false); 
                        }}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={14} /> {t.labels.delete}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${priorityColors[item.priority]}`}>
              {t.priorities[item.priority]}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-transparent">
              <Calendar size={12} /> {formattedDate}
            </span>
            {item.platform && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                <ShoppingBag size={12} /> {item.platform}
              </span>
            )}
            {item.imageUrl && (
                <span className="sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300">
                    <ImageIcon size={12} /> Image
                </span>
            )}
          </div>
        </div>
      </div>

      {item.notes && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-white/20 dark:border-white/5">
          {item.notes}
        </div>
      )}

      <div className="pt-4 mt-2 border-t border-black/5 dark:border-white/10 flex justify-between items-center">
         <div className="flex items-center gap-3">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-widest`}>
              {t.statuses[item.status]}
            </span>
            {isSafeLink && (
               <a 
                href={item.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"
               >
                 <ExternalLink size={14} /> {t.labels.visitLink}
               </a>
            )}
         </div>
         <span className="text-xl font-bold font-sans tracking-tight text-gray-900 dark:text-white">
            {formattedPrice}
         </span>
      </div>

    </div>
  );
};