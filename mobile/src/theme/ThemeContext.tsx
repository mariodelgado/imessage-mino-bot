/**
 * Theme Context - Provides theme state and utilities throughout the app
 *
 * Supports automatic system theme detection and manual override.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, ColorTheme, ThemeMode } from './tokens';

const THEME_STORAGE_KEY = 'mino_theme_mode';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorTheme;
  isDark: boolean;
  setMode: (mode: ThemeMode | 'system') => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [userPreference, setUserPreference] = useState<ThemeMode | 'system'>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setUserPreference(saved);
      }
      setIsLoaded(true);
    });
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Force re-render when system theme changes
      if (userPreference === 'system') {
        setUserPreference('system');
      }
    });
    return () => subscription.remove();
  }, [userPreference]);

  // Resolve actual mode
  const mode: ThemeMode = useMemo(() => {
    if (userPreference === 'system') {
      return systemColorScheme === 'light' ? 'light' : 'dark';
    }
    return userPreference;
  }, [userPreference, systemColorScheme]);

  const setMode = async (newMode: ThemeMode | 'system') => {
    setUserPreference(newMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const toggleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({
      mode,
      colors: colors[mode],
      isDark: mode === 'dark',
      setMode,
      toggleTheme,
    }),
    [mode]
  );

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook for quick color access
export function useColors(): ColorTheme {
  const { colors } = useTheme();
  return colors;
}
