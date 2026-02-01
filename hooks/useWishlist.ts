import React, { useState, useEffect, useRef } from 'react';
import { WishlistItem, EcommercePlatform, Category, Priority, Status } from '../types';
import { STORAGE_KEY, VALIDATION_LIMITS } from '../constants';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

export const useWishlist = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [lastActionTime, setLastActionTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { t } = useSettings();

  // Load data
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem(STORAGE_KEY);
      if (savedItems) setItems(JSON.parse(savedItems));
    } catch (error) {
      console.error("Failed to load local storage data", error);
      showToast("Failed to load saved items", "error");
    }
  }, []);

  // Persist data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Helpers
  const isRateLimited = () => {
    const now = Date.now();
    if (now - lastActionTime < VALIDATION_LIMITS.RATE_LIMIT_MS) {
      showToast(t.validation.rateLimit, "error");
      return true;
    }
    setLastActionTime(now);
    return false;
  };

  const sanitizeString = (str: string, maxLength: number): string => {
    if (!str) return '';
    return str.replace(/[<>]/g, '').slice(0, maxLength);
  };

  // Actions
  const saveItem = (itemData: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>, editingId?: string) => {
    const now = Date.now();
    
    const cleanData = {
      ...itemData,
      name: sanitizeString(itemData.name, VALIDATION_LIMITS.NAME_MAX_LENGTH),
      notes: sanitizeString(itemData.notes || '', VALIDATION_LIMITS.NOTES_MAX_LENGTH),
      platform: sanitizeString(itemData.platform || '', VALIDATION_LIMITS.PLATFORM_MAX_LENGTH),
      imageUrl: itemData.imageUrl ? sanitizeString(itemData.imageUrl, VALIDATION_LIMITS.URL_MAX_LENGTH) : undefined,
      price: Math.max(VALIDATION_LIMITS.PRICE_MIN, Math.min(itemData.price, VALIDATION_LIMITS.PRICE_MAX))
    };

    if (editingId) {
      setItems(prev => prev.map(item => 
        item.id === editingId 
          ? { ...item, ...cleanData, updatedAt: now } 
          : item
      ));
      showToast("Item updated successfully", "success");
    } else {
      const newItem: WishlistItem = {
        ...cleanData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      setItems(prev => [newItem, ...prev]);
      showToast("Item added successfully", "success");
    }
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    showToast("Item deleted", "success");
  };

  const exportCSV = () => {
    if (isRateLimited()) return;

    const headers = ['Name', 'Category', 'Price', 'Priority', 'Status', 'Platform', 'Notes', 'Link', 'Created Date', 'Image URL'];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        `"${item.name.replace(/"/g, '""')}"`,
        item.category,
        item.price,
        item.priority,
        item.status,
        item.platform || EcommercePlatform.Other,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
        `"${(item.link || '').replace(/"/g, '""')}"`,
        new Date(item.createdAt).toISOString().split('T')[0],
        `"${(item.imageUrl || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wishlog_export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast("Export started", "success");
  };

  const triggerImport = () => {
    if (isRateLimited()) return;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const parseCSVLine = (text: string) => {
    const result = [];
    let curr = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuote && text[i+1] === '"') {
                curr += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            result.push(curr);
            curr = '';
        } else {
            curr += char;
        }
    }
    result.push(curr);
    return result;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isRateLimited()) {
       if (event.target) event.target.value = '';
       return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast("File too large (Max 5MB)", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const cleanContent = content.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, "");
        const lines = cleanContent.split(/\r?\n/).filter(line => line.trim() !== '');
        const dataLines = lines.slice(1); // Skip header
        const newItems: WishlistItem[] = [];
        const now = Date.now();

        dataLines.forEach((line) => {
          const cols = parseCSVLine(line);
          if (cols.length < 5) return;

          let name, categoryStr, priceStr, priorityStr, statusStr;
          let platformStr = '', notes = '', link = '', dateStr = '', imageUrl = '';
          const trimmedCols = cols.map(c => c.trim());

          // Handle variable column lengths for backward compatibility
          if (trimmedCols.length >= 10) {
              [name, categoryStr, priceStr, priorityStr, statusStr, platformStr, notes, link, dateStr, imageUrl] = trimmedCols;
          } else if (trimmedCols.length === 9) {
              [name, categoryStr, priceStr, priorityStr, statusStr, platformStr, notes, link, dateStr] = trimmedCols;
          } else if (trimmedCols.length === 8) {
              [name, categoryStr, priceStr, priorityStr, statusStr, notes, link, dateStr] = trimmedCols;
              platformStr = EcommercePlatform.Other;
          } else {
              [name, categoryStr, priceStr, priorityStr, statusStr] = trimmedCols;
              if (trimmedCols.length > 5) notes = trimmedCols[5];
              if (trimmedCols.length > 6) dateStr = trimmedCols[6];
              platformStr = EcommercePlatform.Other;
              link = '';
          }
          
          const category = Object.values(Category).includes(categoryStr as Category) ? categoryStr as Category : Category.Others;
          const priority = Object.values(Priority).includes(priorityStr as Priority) ? priorityStr as Priority : Priority.Medium;
          const status = Object.values(Status).includes(statusStr as Status) ? statusStr as Status : Status.Planned;
          
          const cleanName = sanitizeString(name || 'Untitled', VALIDATION_LIMITS.NAME_MAX_LENGTH);
          const cleanPlatform = sanitizeString(platformStr || EcommercePlatform.Other, VALIDATION_LIMITS.PLATFORM_MAX_LENGTH);
          const cleanNotes = sanitizeString(notes || '', VALIDATION_LIMITS.NOTES_MAX_LENGTH);
          
          let cleanLink = '';
          if (link && (link.startsWith('http://') || link.startsWith('https://'))) {
              cleanLink = sanitizeString(link, VALIDATION_LIMITS.URL_MAX_LENGTH);
          }

          let cleanImageUrl = '';
          if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
             cleanImageUrl = sanitizeString(imageUrl, VALIDATION_LIMITS.URL_MAX_LENGTH);
          }

          const cleanPriceStr = priceStr ? priceStr.replace(/[^0-9.]/g, '') : '0';
          let price = parseFloat(cleanPriceStr);
          if (isNaN(price) || price < 0) price = 0;
          if (price > VALIDATION_LIMITS.PRICE_MAX) price = VALIDATION_LIMITS.PRICE_MAX;

          const newItem: WishlistItem = {
            id: crypto.randomUUID(),
            name: cleanName,
            category,
            price,
            priority,
            status,
            platform: cleanPlatform,
            notes: cleanNotes,
            link: cleanLink,
            imageUrl: cleanImageUrl,
            createdAt: dateStr && !isNaN(Date.parse(dateStr)) ? new Date(dateStr).getTime() : now,
            updatedAt: now
          };
          newItems.push(newItem);
        });

        if (newItems.length > 0) {
          setItems(prev => [...prev, ...newItems]);
          showToast(t.importSuccess.replace('{count}', newItems.length.toString()), "success");
        } else {
          showToast(t.importError, "error");
        }
      } catch (err) {
        console.error("Import failed:", err);
        showToast(t.importError, "error");
      }
    };
    reader.readAsText(file);
  };

  return {
    items,
    fileInputRef,
    saveItem,
    deleteItem,
    exportCSV,
    triggerImport,
    handleFileUpload
  };
};