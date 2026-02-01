import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme, Currency } from '../types';
import { THEME_KEY, LANG_KEY, CURRENCY_KEY, TRANSLATIONS } from '../constants';

interface SettingsContextType {
  lang: Language;
  theme: Theme;
  currency: Currency;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  setCurrency: (c: Currency) => void;
  t: typeof TRANSLATIONS['en'];
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [currency, setCurrencyState] = useState<Currency>('INR');

  // Load settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
    const savedLang = localStorage.getItem(LANG_KEY) as Language;
    const savedCurrency = localStorage.getItem(CURRENCY_KEY) as Currency;

    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLang(savedLang);
    else if (navigator.language.startsWith('te')) setLang('te');
    
    if (savedCurrency) setCurrencyState(savedCurrency);
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

  const t = TRANSLATIONS[lang];

  return (
    <SettingsContext.Provider value={{ 
      lang, 
      theme, 
      currency, 
      toggleLanguage, 
      toggleTheme, 
      setCurrency,
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