
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { WishlistItem, Category, Priority, Status, EcommercePlatform } from '../types';
import { VALIDATION_LIMITS, ALLOWED_PROTOCOLS } from '../constants';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { X, Paperclip, AlertCircle, Image as ImageIcon, Loader2, Zap, Search } from 'lucide-react';

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
  const { t, serpApiKey } = useSettings();
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

  /**
   * Helper to parse price from string.
   * Supports: ₹, Rs, INR, $, USD, €, EUR, £, GBP
   */
  const extractPriceFromText = (text: string, requireSymbol: boolean = true): number | null => {
    if (!text) return null;
    const cleanText = text.toLowerCase().trim();

    // 0. Direct Number check (if symbol not required, usually from API fields)
    if (!requireSymbol) {
        const numeric = cleanText.replace(/[^\d.]/g, '');
        const val = parseFloat(numeric);
        if (!isNaN(val) && val > 0) return val;
    }

    // 1. Explicit patterns (High Confidence)
    // Matches: "price: ₹100", "mrp: rs 100", "at ₹100", "@ ₹100"
    const explicitPattern = /(?:price|mrp|deal|offer|cost|at|@)\s*[:\-\.]?\s*(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*([\d,]+(?:\.\d+)?)/i;
    const explicitMatch = cleanText.match(explicitPattern);
    if (explicitMatch && explicitMatch[1]) {
       return parseFloat(explicitMatch[1].replace(/,/g, ''));
    }

    // 2. Generic Currency pattern (Medium Confidence)
    const currencyPattern = /(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s*[:\.\-]?\s*([\d,]+(?:\.\d+)?)/gi;
    const matches = [...text.matchAll(currencyPattern)];
    
    for (const match of matches) {
        const priceStr = match[1].replace(/,/g, '');
        const priceVal = parseFloat(priceStr);
        const index = match.index || 0;
        
        // Context check: Avoid "Save ₹500", "Off ₹200"
        const context = text.substring(Math.max(0, index - 25), index).toLowerCase();
        if (context.includes('save') || context.includes('off') || context.includes('discount') || context.includes('emi') || context.includes('flat')) {
            continue;
        }
        
        return priceVal;
    }

    return null;
  };

  const fetchWithTimeout = async (url: string, timeout = 15000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            const abortError = new Error("Request timed out. Please check your connection.");
            abortError.name = 'AbortError';
            throw abortError;
        }
        throw error;
      }
  };

  const handleAutoFill = async () => {
    if (!link) return;
    
    try {
      new URL(link);
    } catch {
      setErrors({ ...errors, link: t.validation.invalidUrl });
      return;
    }

    setIsFetching(true);
    onFetchChange?.(true, initialData?.id);
    const platform = detectPlatformFromUrl(link);
    setFetchStatus(platform ? `Connecting to ${platform}...` : 'Starting fetch...');

    let dataFound = false;
    let detailsFound: string[] = [];
    let foundPrice: number | null = null;
    let resolvedUrl = link;
    let scrapedText = "";

    try {
      const encodedUrl = encodeURIComponent(link);
      
      // --- PHASE 1: Basic Scraping (Microlink) ---
      setFetchStatus('Fetching basic info...');
      const microlinkRes = await fetchWithTimeout(`https://api.microlink.io/?url=${encodedUrl}&palette=true&audio=false&video=false`);
      
      if (microlinkRes.ok) {
        const json = await microlinkRes.json();
        const data = json.data;

        if (data) {
            dataFound = true;
            scrapedText = `${data.title || ''} ${data.description || ''}`;
            
            if (data.url && data.url !== link) {
                resolvedUrl = data.url;
            }

            if (data.title) {
                let cleanName = data.title.split('|')[0].split(' : ')[0].split(' - ')[0].trim();
                if (cleanName.length > 80) cleanName = cleanName.substring(0, 77) + '...';
                setName(cleanName);
                if (!detailsFound.includes("Name")) detailsFound.push("Name");
            }
            
            if (data.image && data.image.url) {
                setImageUrl(data.image.url);
                detailsFound.push("Image");
            }

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
            } else {
                 const p = detectPlatformFromUrl(resolvedUrl);
                 if (p) {
                    if (p === 'Amazon') setPlatformType(EcommercePlatform.Amazon);
                    else if (p === 'Flipkart') setPlatformType(EcommercePlatform.Flipkart);
                    else setPlatformType(EcommercePlatform.Other); 
                 }
            }

            const textsToCheck = [data.description, data.title];
            for (const text of textsToCheck) {
                const p = extractPriceFromText(text, true); 
                if (p !== null) {
                    foundPrice = p;
                    break;
                }
            }
        }
      }

      // --- PHASE 2: Advanced Scraping (SerpApi) ---
      if (serpApiKey && !foundPrice) {
          setFetchStatus('Checking price sources (SerpApi)...');
          const searchUrl = encodeURIComponent(resolvedUrl);
          const serpRes = await fetchWithTimeout(`https://serpapi.com/search.json?engine=google&q=${searchUrl}&api_key=${serpApiKey}&num=1`);

          if (serpRes.ok) {
              const json = await serpRes.json();
              let serpPriceVal: number | null = null;

              if (json.product_result?.price) {
                 serpPriceVal = extractPriceFromText(json.product_result.price.toString(), false);
              }
              else if (json.shopping_results?.[0]?.price) {
                 serpPriceVal = extractPriceFromText(json.shopping_results[0].price.toString(), false);
              }
              else if (json.knowledge_graph?.price) {
                 serpPriceVal = extractPriceFromText(json.knowledge_graph.price.toString(), false);
              }
              else if (json.organic_results?.[0]) {
                  const organic = json.organic_results[0];
                  if (organic.rich_snippet?.top?.detected_extensions?.price) {
                      serpPriceVal = extractPriceFromText(organic.rich_snippet.top.detected_extensions.price.toString(), false);
                  }
                  else if (organic.price) {
                      serpPriceVal = extractPriceFromText(organic.price.toString(), false);
                  }
                  else if (organic.snippet) {
                      serpPriceVal = extractPriceFromText(organic.snippet, true);
                  }
                  else if (organic.title) {
                      const titlePrice = extractPriceFromText(organic.title, true);
                      if (titlePrice) serpPriceVal = titlePrice;
                  }
              }

              if (serpPriceVal !== null) {
                  foundPrice = serpPriceVal;
                  dataFound = true;
              }
          }
      }

      // --- PHASE 3: Gemini Fallback (Extract from text) ---
      if (!foundPrice && scrapedText && process.env.GEMINI_API_KEY) {
          try {
              setFetchStatus('Analyzing text with AI...');
              const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              const response = await genAI.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `Extract the product price from this text. Return ONLY the number. If multiple prices exist, return the main one. If no price, return "null". Text: "${scrapedText}"`,
              });
              const text = response.text?.trim();
              if (text && text !== 'null') {
                  const p = parseFloat(text.replace(/[^0-9.]/g, ''));
                  if (!isNaN(p) && p > 0) {
                      foundPrice = p;
                      dataFound = true;
                  }
              }
          } catch (aiErr) {
              console.warn("Gemini extraction failed", aiErr);
          }
      }

      if (foundPrice !== null) {
          setPrice(foundPrice.toString());
          if (!detailsFound.includes("Price")) detailsFound.push("Price");
      }

      if (dataFound || detailsFound.length > 0) {
        const msg = detailsFound.length > 0 
            ? `Auto-filled: ${detailsFound.join(', ')}` 
            : "Metadata found. Please verify price manually.";
        showToast(msg, "success");
      } else {
        throw new Error("No data found");
      }

    } catch (e: any) {
      console.error("Auto-fill failed", e);
      if (e.name === 'AbortError' || e.message?.includes('aborted')) {
         showToast("Request timed out. Please check your connection.", "error");
      } else if (e.message === "No data found") {
         showToast("Could not find product details automatically. Please fill manually.", "error");
      } else {
         showToast(e.message || "Could not fetch details. Please fill manually.", "error");
      }
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

    // Price validation: Allow empty (0), but if typed, must be valid.
    const numPrice = parseFloat(price);
    if (price !== '' && (isNaN(numPrice) || numPrice < 0 || numPrice > VALIDATION_LIMITS.PRICE_MAX)) {
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
          
          {/* Link Field & Auto-fill Button */}
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
                
                {/* Auto-fill Button */}
                <button 
                  type="button"
                  onClick={handleAutoFill}
                  disabled={!link || isFetching}
                  className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2 font-medium text-sm min-w-fit"
                  title="Auto-fill details from Link"
                >
                  {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} fill="currentColor" />}
                  <span className="hidden sm:inline">Auto-fill</span>
                </button>
             </div>
             
             {/* Errors & Status Feedback */}
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
