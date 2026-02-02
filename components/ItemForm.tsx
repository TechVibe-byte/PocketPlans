
import React, { useState, useEffect } from 'react';
import { WishlistItem, Category, Priority, Status, EcommercePlatform } from '../types';
import { VALIDATION_LIMITS, ALLOWED_PROTOCOLS } from '../constants';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { X, Paperclip, AlertCircle, Image as ImageIcon, Sparkles, Loader2, Zap } from 'lucide-react';
// import { GoogleGenAI } from "@google/genai"; // AI removed for lightweight Microlink

interface ItemFormProps {
  initialData?: WishlistItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onFetchChange?: (isFetching: boolean, itemId?: string) => void;
}

interface ValidationErrors {
  name?: string;
  price?: string;
  platform?: string;
  link?: string;
  imageUrl?: string;
  notes?: string;
}

export const ItemForm: React.FC<ItemFormProps> = ({ initialData, isOpen, onClose, onSave, onFetchChange }) => {
  const { t } = useSettings(); // Removed apiKey dependency
  const { showToast } = useToast();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(Category.Others);
  const [price, setPrice] = useState<string>('');
  const [priority, setPriority] = useState<Priority>(Priority.Medium);
  const [status, setStatus] = useState<Status>(Status.Planned);
  const [platformType, setPlatformType] = useState<EcommercePlatform>(EcommercePlatform.Amazon);
  const [customPlatform, setCustomPlatform] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  const [isFetching, setIsFetching] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>('');
  
  const [errors, setErrors] = useState<ValidationErrors>({});

  const knownPlatforms = Object.values(EcommercePlatform) as string[];

  useEffect(() => {
    setErrors({});
    if (initialData) {
      setName(initialData.name);
      setCategory(initialData.category);
      setPrice(initialData.price.toString());
      setPriority(initialData.priority);
      setStatus(initialData.status);
      setNotes(initialData.notes || '');
      setLink(initialData.link || '');
      setImageUrl(initialData.imageUrl || '');

      const p = initialData.platform || EcommercePlatform.Other;
      if (knownPlatforms.includes(p) && p !== EcommercePlatform.Other) {
        setPlatformType(p as EcommercePlatform);
        setCustomPlatform('');
      } else {
        setPlatformType(EcommercePlatform.Other);
        setCustomPlatform(p === EcommercePlatform.Other ? '' : p);
      }

    } else {
      setName('');
      setCategory(Category.Others);
      setPrice('');
      setPriority(Priority.Medium);
      setStatus(Status.Planned);
      setPlatformType(EcommercePlatform.Amazon);
      setCustomPlatform('');
      setNotes('');
      setLink('');
      setImageUrl('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const detectPlatformFromUrl = (url: string): string => {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      if (hostname.includes('amazon')) return 'Amazon';
      if (hostname.includes('flipkart')) return 'Flipkart';
      if (hostname.includes('myntra')) return 'Myntra';
      if (hostname.includes('ajio')) return 'Ajio';
      return hostname.charAt(0).toUpperCase() + hostname.slice(1).split('.')[0];
    } catch {
      return '';
    }
  };

  const handleAutoFill = async () => {
    if (!link) return;
    
    // Simple URL validation
    try {
      new URL(link);
    } catch {
      setErrors({ ...errors, link: t.validation.invalidUrl });
      return;
    }

    setIsFetching(true);
    onFetchChange?.(true, initialData?.id);
    const platform = detectPlatformFromUrl(link);
    setFetchStatus(platform ? `Connecting to ${platform}...` : 'Fetching metadata...');

    try {
      // Use Microlink API (Free, No Key required for low volume)
      const encodedUrl = encodeURIComponent(link);
      const response = await fetch(`https://api.microlink.io/?url=${encodedUrl}&palette=true&audio=false&video=false`);
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limit exceeded. Try again later.");
        throw new Error("Failed to fetch link metadata");
      }

      const json = await response.json();
      const data = json.data;

      if (data) {
        let detailsFound = [];

        // 1. Set Name
        if (data.title) {
          // Cleanup title (remove " | Amazon.in" etc.)
          let cleanName = data.title.split('|')[0].split(' : ')[0].trim();
          if (cleanName.length > 80) cleanName = cleanName.substring(0, 77) + '...';
          setName(cleanName);
          detailsFound.push("Name");
        }

        // 2. Set Image
        if (data.image && data.image.url) {
          setImageUrl(data.image.url);
          detailsFound.push("Image");
        }

        // 3. Set Platform
        if (data.publisher) {
           const lowerPub = data.publisher.toLowerCase();
           if (lowerPub.includes('amazon')) setPlatformType(EcommercePlatform.Amazon);
           else if (lowerPub.includes('flipkart')) setPlatformType(EcommercePlatform.Flipkart);
           else if (lowerPub.includes('myntra')) setPlatformType(EcommercePlatform.Myntra);
           else if (lowerPub.includes('ajio')) setPlatformType(EcommercePlatform.Ajio);
           else {
              setPlatformType(EcommercePlatform.Other);
              setCustomPlatform(data.publisher);
           }
        } else if (platform) {
           // Fallback to URL detection
           const lowerPlat = platform.toLowerCase();
           if (lowerPlat.includes('amazon')) setPlatformType(EcommercePlatform.Amazon);
           else if (lowerPlat.includes('flipkart')) setPlatformType(EcommercePlatform.Flipkart);
           else if (lowerPlat.includes('myntra')) setPlatformType(EcommercePlatform.Myntra);
           else if (lowerPlat.includes('ajio')) setPlatformType(EcommercePlatform.Ajio);
        }

        // 4. Try to Extract Price (Improved Regex)
        // Check description first (often contains "Buy X for Rs Y"), then title
        const textsToCheck = [data.description, data.title];
        let priceFound = false;

        // Matches: ₹ 1,200 | Rs. 1200 | INR 1200 | Rs 1200
        // Does not require space after symbol
        const priceRegex = /(?:₹|rs\.?|inr)\s*[:\.\-]?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)/i;

        for (const text of textsToCheck) {
            if (!text) continue;
            const match = text.match(priceRegex);
            if (match && match[1]) {
                const extractedPrice = match[1].replace(/,/g, '');
                // Basic sanity check: ensure it's not a year like 2023 or 2024 if it's strictly 4 digits and starts with 20
                if (extractedPrice.length === 4 && (extractedPrice.startsWith('202'))) {
                    continue; // Skip likely years
                }
                setPrice(extractedPrice);
                priceFound = true;
                break;
            }
        }

        if (priceFound) {
            detailsFound.push("Price");
            showToast(`Auto-filled: ${detailsFound.join(', ')}`, "success");
        } else {
            // Inform user that Name/Image worked, but Price is missing (likely hidden by Amazon/Flipkart)
            showToast(`Fetched ${detailsFound.join(', ')}. Price not found in metadata.`, "success");
        }

      } else {
        throw new Error("No data found");
      }

    } catch (e: any) {
      console.error("Auto-fill failed", e);
      showToast(e.message || "Could not fetch details. Please fill manually.", "error");
    } finally {
      setIsFetching(false);
      onFetchChange?.(false, initialData?.id);
      setFetchStatus('');
    }
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = t.validation.required;
      isValid = false;
    } else if (name.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
      newErrors.name = t.validation.tooLong;
      isValid = false;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0 || numPrice > VALIDATION_LIMITS.PRICE_MAX) {
      newErrors.price = t.validation.invalidPrice;
      isValid = false;
    }

    if (platformType === EcommercePlatform.Other && customPlatform.length > VALIDATION_LIMITS.PLATFORM_MAX_LENGTH) {
      newErrors.platform = t.validation.tooLong;
      isValid = false;
    }

    const validateUrl = (urlStr: string, field: 'link' | 'imageUrl') => {
        if (!urlStr.trim()) return;
        try {
            const url = new URL(urlStr);
            if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
                newErrors[field] = t.validation.invalidUrl;
                isValid = false;
            }
        } catch (e) {
            newErrors[field] = t.validation.invalidUrl;
            isValid = false;
        }
        if (urlStr.length > VALIDATION_LIMITS.URL_MAX_LENGTH) {
            newErrors[field] = t.validation.tooLong;
            isValid = false;
        }
    };

    validateUrl(link, 'link');
    validateUrl(imageUrl, 'imageUrl');

    if (notes.length > VALIDATION_LIMITS.NOTES_MAX_LENGTH) {
      newErrors.notes = t.validation.tooLong;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    let finalPlatform = platformType as string;
    if (platformType === EcommercePlatform.Other) {
      finalPlatform = customPlatform.trim() || EcommercePlatform.Other;
    }

    const fixUrl = (u: string) => {
        let trimmed = u.trim();
        if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return `https://${trimmed}`;
        }
        return trimmed;
    };

    onSave({
      name: name.trim(),
      category,
      price: parseFloat(price) || 0,
      priority,
      status,
      platform: finalPlatform,
      notes: notes.trim(),
      link: fixUrl(link),
      imageUrl: fixUrl(imageUrl)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 border border-white/40 dark:border-white/10 bg-white/80 dark:bg-gray-900/80">
        
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/10">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            {initialData ? t.editItem : t.addItem}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 flex-1">
          
          {/* Link Field First to encourage Auto-fill */}
          <div>
             <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.link}</label>
             <div className="relative flex gap-2">
                <div className="relative flex-1 group">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 text-gray-500 group-focus-within:text-blue-500 group-focus-within:border-blue-500/50 transition-all duration-300 shadow-sm backdrop-blur-sm">
                        <Paperclip size={16} />
                    </div>
                    <input 
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className={`w-full pl-12 pr-3 py-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm transition-all border border-transparent hover:border-white/20 dark:hover:border-white/10 ${errors.link ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                      placeholder="https://www.amazon.in/..."
                    />
                </div>
                <button 
                  type="button"
                  onClick={handleAutoFill}
                  disabled={!link || isFetching}
                  className="px-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center min-w-[3rem]"
                  title="Auto-fill details from Link"
                >
                  {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                </button>
             </div>
             {errors.link && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {errors.link}</p>}
             {isFetching && !errors.link && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 animate-pulse font-medium">
                   <Loader2 size={12} className="animate-spin" /> 
                   {fetchStatus}
                </p>
             )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.name}</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${errors.name ? 'border-red-500 focus:ring-red-500/50' : ''}`}
              placeholder="e.g., Noise Cancelling Headphones"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.category}</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none"
              >
                {Object.values(Category).map(c => (
                  <option key={c} value={c} className="dark:bg-gray-900">{t.categories[c]}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.price}</label>
              <input 
                type="number" 
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${errors.price ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                placeholder="0.00"
              />
              {errors.price && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {errors.price}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.platform}</label>
            <div className="grid grid-cols-2 gap-4">
              <select 
                value={platformType}
                onChange={(e) => setPlatformType(e.target.value as EcommercePlatform)}
                className="w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none"
              >
                {Object.values(EcommercePlatform).map(p => (
                  <option key={p} value={p} className="dark:bg-gray-900">{t.platforms[p]}</option>
                ))}
              </select>
              
              {platformType === EcommercePlatform.Other && (
                <div>
                    <input 
                    type="text"
                    value={customPlatform}
                    onChange={(e) => setCustomPlatform(e.target.value)}
                    className={`w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all animate-in fade-in slide-in-from-left-2 ${errors.platform ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                    placeholder={t.labels.specifyPlatform}
                    />
                    {errors.platform && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {errors.platform}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.status}</label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none"
              >
                {Object.values(Status).map(s => (
                  <option key={s} value={s} className="dark:bg-gray-900">{t.statuses[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.priority}</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none"
              >
                {(Object.values(Priority) as Priority[]).map((p) => (
                  <option key={p} value={p} className="dark:bg-gray-900">{t.priorities[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
             <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.imageUrl}</label>
             <div className="relative group">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 text-gray-400 group-focus-within:text-blue-500 group-focus-within:border-blue-500/30 transition-all duration-300">
                    <ImageIcon size={16} />
                </div>
                <input 
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className={`w-full pl-12 pr-3 py-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none text-sm transition-all border border-transparent hover:border-white/20 dark:hover:border-white/10 ${errors.imageUrl ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  placeholder="https://images.com/preview.jpg"
                />
             </div>
             {errors.imageUrl && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {errors.imageUrl}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{t.labels.notes}</label>
            <textarea 
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`w-full p-3 rounded-xl glass-input text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none transition-all ${errors.notes ? 'border-red-500 focus:ring-red-500/50' : ''}`}
            />
            {errors.notes && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {errors.notes}</p>}
          </div>

          <div className="pt-2 flex gap-3">
             <Button type="button" variant="secondary" onClick={onClose} fullWidth className="glass-panel border-0 bg-gray-200/50 hover:bg-gray-200/80 dark:bg-gray-700/50 dark:hover:bg-gray-700/80">
              {t.labels.cancel}
             </Button>
             <Button type="submit" variant="primary" fullWidth className="shadow-lg shadow-blue-500/20">
              {t.labels.save}
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
