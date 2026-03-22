
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme, Currency } from '../types';
import { THEME_KEY, LANG_KEY, CURRENCY_KEY, SERP_KEY, TRANSLATIONS } from '../constants';

interface SettingsContextType {
  lang: Language;
  theme: Theme;
  currency: Currency;
  serpApiKey: string;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  setCurrency: (c: Currency) => void;
  setSerpApiKey: (k: string) => void;
  t: typeof TRANSLATIONS['en'];
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [currency, setCurrencyState] = useState<Currency>('INR');
  const [serpApiKey, setSerpApiKeyState] = useState<string>('');

  // Load settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
    const savedLang = localStorage.getItem(LANG_KEY) as Language;
    const savedCurrency = localStorage.getItem(CURRENCY_KEY) as Currency;
    const savedSerpKey = localStorage.getItem(SERP_KEY);

    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLang(savedLang);
    else if (navigator.language.startsWith('te')) setLang('te');
    
    if (savedCurrency) setCurrencyState(savedCurrency);
    if (savedSerpKey) setSerpApiKeyState(savedSerpKey);
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

  useEffect(() => {
    localStorage.setItem(SERP_KEY, serpApiKey);
  }, [serpApiKey]);

  const toggleLanguage = () => setLang(prev => prev === 'en' ? 'te' : 'en');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const setCurrency = (c: Currency) => setCurrencyState(c);
  const setSerpApiKey = (k: string) => setSerpApiKeyState(k);
  
  const t = TRANSLATIONS[lang];

  return (
    <SettingsContext.Provider value={{ 
      lang, 
      theme, 
      currency,
      serpApiKey,
      toggleLanguage, 
      toggleTheme, 
      setCurrency,
      setSerpApiKey,
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
