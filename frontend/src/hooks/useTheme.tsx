// Theme Context for Dark/Light Mode Toggle
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Get initial theme from localStorage or default to 'system'
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('devpulse-theme') as Theme) || 'dark';
    }
    return 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Resolve the actual theme based on 'system' preference
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(isDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Add current theme class
    root.classList.add(resolvedTheme);
    
    // Set theme color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#0a0a0f' : '#ffffff');
    }
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('devpulse-theme', newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Theme-aware color utilities
export function getThemeColors(theme: 'dark' | 'light') {
  return theme === 'dark' ? {
    background: {
      primary: '#0a0a0f',
      secondary: '#111118',
      card: 'rgba(17, 17, 24, 0.8)',
      cardHover: 'rgba(24, 24, 35, 0.9)',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
    },
    border: {
      color: 'rgba(255, 255, 255, 0.08)',
      hover: 'rgba(255, 255, 255, 0.15)',
    },
    accent: {
      primary: '#6366f1',
      secondary: '#22d3ee',
      success: '#34d399',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
  } : {
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      card: 'rgba(255, 255, 255, 0.9)',
      cardHover: 'rgba(255, 255, 255, 1)',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#94a3b8',
    },
    border: {
      color: 'rgba(0, 0, 0, 0.08)',
      hover: 'rgba(0, 0, 0, 0.15)',
    },
    accent: {
      primary: '#4f46e5',
      secondary: '#0891b2',
      success: '#10b981',
      warning: '#d97706',
      danger: '#dc2626',
    },
  };
}
