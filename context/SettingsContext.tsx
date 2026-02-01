
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme, Currency } from '../types';
import { THEME_KEY, LANG_KEY, CURRENCY_KEY, TRANSLATIONS } from '../constants';

const API_KEY_STORAGE_KEY = 'wishlog_api_key_v1';

interface SettingsContextType {
  lang: Language;
  theme: Theme;
  currency: Currency;
  apiKey: string;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  setCurrency: (c: Currency) => void;
  setApiKey: (key: string) => void;
  t: typeof TRANSLATIONS['en'];
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [currency, setCurrencyState] = useState<Currency>('INR');
  const [apiKey, setApiKeyState] = useState<string>('');

  // Load settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
    const savedLang = localStorage.getItem(LANG_KEY) as Language;
    const savedCurrency = localStorage.getItem(CURRENCY_KEY) as Currency;
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);

    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLang(savedLang);
    else if (navigator.language.startsWith('te')) setLang('te');
    
    if (savedCurrency) setCurrencyState(savedCurrency);
    if (savedApiKey) setApiKeyState(savedApiKey);
    else if (process.env.API_KEY) setApiKeyState(process.env.API_KEY);
  }, []);

  // Persist changes
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(CURRENCY_KEY, currency);
  }, [currency]);

  const toggleLanguage = () => setLang(prev => prev === 'en' ? 'te' : 'en');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const setCurrency = (c: Currency) => setCurrencyState(c);
  
  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  };

  const t = TRANSLATIONS[lang];

  return (
    <SettingsContext.Provider value={{ 
      lang, 
      theme, 
      currency, 
      apiKey,
      toggleLanguage, 
      toggleTheme, 
      setCurrency,
      setApiKey,
      t 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
