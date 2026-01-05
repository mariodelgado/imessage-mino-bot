/**
 * Design Token System - iOS 26 HIG Compliant
 *
 * Comprehensive tokens for colors, typography, spacing, shadows, and animations.
 * Supports light/dark mode with semantic color naming.
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const palette = {
  // Primary Brand
  cyan: {
    50: '#E6FBFF',
    100: '#B3F3FF',
    200: '#80EBFF',
    300: '#4DE3FF',
    400: '#1ADBFF',
    500: '#00D4FF', // Primary
    600: '#00A8CC',
    700: '#007C99',
    800: '#005066',
    900: '#002433',
  },

  // Neutrals
  gray: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    850: '#1A1A1A',
    900: '#171717',
    950: '#0A0A0A',
  },

  // Semantic Colors
  success: {
    light: '#34D399',
    DEFAULT: '#10B981',
    dark: '#059669',
  },
  warning: {
    light: '#FBBF24',
    DEFAULT: '#F59E0B',
    dark: '#D97706',
  },
  error: {
    light: '#F87171',
    DEFAULT: '#EF4444',
    dark: '#DC2626',
  },
  info: {
    light: '#60A5FA',
    DEFAULT: '#3B82F6',
    dark: '#2563EB',
  },

  // Special
  transparent: 'transparent',
  black: '#000000',
  white: '#FFFFFF',
} as const;

// Semantic color themes
export const colors = {
  light: {
    // Backgrounds
    background: {
      primary: palette.gray[50],
      secondary: palette.white,
      tertiary: palette.gray[100],
      elevated: palette.white,
      glass: 'rgba(255, 255, 255, 0.72)',
      glassStrong: 'rgba(255, 255, 255, 0.85)',
    },

    // Foregrounds
    foreground: {
      primary: palette.gray[900],
      secondary: palette.gray[600],
      tertiary: palette.gray[500],
      muted: palette.gray[400],
      inverse: palette.white,
    },

    // Brand
    accent: {
      primary: palette.cyan[500],
      secondary: palette.cyan[600],
      muted: palette.cyan[100],
    },

    // Borders
    border: {
      default: palette.gray[200],
      subtle: palette.gray[100],
      strong: palette.gray[300],
      glass: 'rgba(255, 255, 255, 0.3)',
    },

    // Status
    status: {
      success: palette.success.DEFAULT,
      warning: palette.warning.DEFAULT,
      error: palette.error.DEFAULT,
      info: palette.info.DEFAULT,
    },

    // Interactive
    interactive: {
      default: palette.cyan[500],
      hover: palette.cyan[600],
      pressed: palette.cyan[700],
      disabled: palette.gray[300],
    },

    // Chat specific
    chat: {
      userBubble: palette.cyan[500],
      userText: palette.white,
      assistantBubble: palette.gray[100],
      assistantText: palette.gray[900],
      systemBubble: palette.gray[200],
      systemText: palette.gray[600],
    },
  },

  dark: {
    // Backgrounds
    background: {
      primary: palette.gray[950],
      secondary: palette.gray[900],
      tertiary: palette.gray[850],
      elevated: palette.gray[800],
      glass: 'rgba(26, 26, 26, 0.72)',
      glassStrong: 'rgba(26, 26, 26, 0.85)',
    },

    // Foregrounds
    foreground: {
      primary: palette.white,
      secondary: palette.gray[400],
      tertiary: palette.gray[500],
      muted: palette.gray[600],
      inverse: palette.gray[950],
    },

    // Brand
    accent: {
      primary: palette.cyan[400],
      secondary: palette.cyan[500],
      muted: 'rgba(0, 212, 255, 0.15)',
    },

    // Borders
    border: {
      default: palette.gray[800],
      subtle: palette.gray[850],
      strong: palette.gray[700],
      glass: 'rgba(255, 255, 255, 0.08)',
    },

    // Status
    status: {
      success: palette.success.light,
      warning: palette.warning.light,
      error: palette.error.light,
      info: palette.info.light,
    },

    // Interactive
    interactive: {
      default: palette.cyan[400],
      hover: palette.cyan[500],
      pressed: palette.cyan[600],
      disabled: palette.gray[700],
    },

    // Chat specific
    chat: {
      userBubble: palette.cyan[500],
      userText: palette.white,
      assistantBubble: palette.gray[850],
      assistantText: palette.white,
      systemBubble: palette.gray[800],
      systemText: palette.gray[400],
    },
  },
} as const;

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const typography = {
  // Large Title - 34pt
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.37,
  },
  // Title 1 - 28pt
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.36,
  },
  // Title 2 - 22pt
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.35,
  },
  // Title 3 - 20pt
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.38,
  },
  // Headline - 17pt semibold
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.41,
  },
  // Body - 17pt
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.41,
  },
  // Callout - 16pt
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.32,
  },
  // Subheadline - 15pt
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.24,
  },
  // Footnote - 13pt
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.08,
  },
  // Caption 1 - 12pt
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
  },
  // Caption 2 - 11pt
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.07,
  },
} as const;

// ============================================================================
// SPACING TOKENS (8pt baseline grid)
// ============================================================================

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: {
    shadowColor: palette.cyan[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  glowStrong: {
    shadowColor: palette.cyan[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
} as const;

// ============================================================================
// ANIMATION TOKENS
// ============================================================================

export const animations = {
  // Durations (ms)
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 400,
    slower: 500,
    slowest: 700,
  },

  // Spring configs for react-native-reanimated
  spring: {
    gentle: {
      damping: 20,
      stiffness: 100,
      mass: 1,
    },
    bouncy: {
      damping: 12,
      stiffness: 150,
      mass: 0.8,
    },
    snappy: {
      damping: 25,
      stiffness: 300,
      mass: 0.5,
    },
    smooth: {
      damping: 30,
      stiffness: 200,
      mass: 1,
    },
  },

  // Easing curves
  easing: {
    easeInOut: 'ease-in-out',
    easeOut: 'ease-out',
    easeIn: 'ease-in',
    linear: 'linear',
  },
} as const;

// ============================================================================
// GLASS/BLUR TOKENS
// ============================================================================

export const glass = {
  blur: {
    light: 10,
    medium: 20,
    strong: 40,
    intense: 60,
  },
  tint: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    strong: 'rgba(255, 255, 255, 0.3)',
  },
  border: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    strong: 'rgba(255, 255, 255, 0.3)',
  },
} as const;

// ============================================================================
// Z-INDEX TOKENS
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
} as const;

// ============================================================================
// HIT SLOP (minimum 44pt touch targets per Apple HIG)
// ============================================================================

export const hitSlop = {
  none: { top: 0, bottom: 0, left: 0, right: 0 },
  small: { top: 8, bottom: 8, left: 8, right: 8 },
  medium: { top: 12, bottom: 12, left: 12, right: 12 },
  large: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

// Export type helpers
export type ColorTheme = typeof colors.dark | typeof colors.light;
export type ThemeMode = 'light' | 'dark';
