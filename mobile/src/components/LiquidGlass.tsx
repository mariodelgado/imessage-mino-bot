/**
 * Liquid Glass Components - iOS 26 Style Glassmorphism
 *
 * Premium glass effects with blur, refraction, and animated gradients.
 * Inspired by Apple's visionOS and iOS 26 design language.
 */

import React, { ReactNode, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { borderRadius, glass, shadows } from '../theme/tokens';

// ============================================================================
// LIQUID GLASS CARD
// ============================================================================

interface LiquidGlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: 'light' | 'medium' | 'strong' | 'intense';
  animated?: boolean;
  glowColor?: string;
  borderGlow?: boolean;
}

export function LiquidGlassCard({
  children,
  style,
  intensity = 'medium',
  animated = false,
  glowColor,
  borderGlow = false,
}: LiquidGlassCardProps) {
  const { isDark, colors } = useTheme();
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      shimmerProgress.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [animated]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmerProgress.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  const blurAmount = glass.blur[intensity];
  const tint = isDark ? 'dark' : 'light';

  return (
    <View
      style={[
        styles.glassContainer,
        borderGlow && {
          ...shadows.glow,
          shadowColor: glowColor || colors.accent.primary,
        },
        style,
      ]}
    >
      <BlurView
        intensity={blurAmount}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />

      {/* Glass border highlight */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.glassBorder,
          { borderColor: colors.border.glass },
        ]}
      />

      {/* Animated shimmer overlay */}
      {animated && (
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* Content */}
      <View style={styles.glassContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// LIQUID GLASS BUTTON
// ============================================================================

interface LiquidGlassButtonProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  glow?: boolean;
}

export function LiquidGlassButton({
  children,
  style,
  variant = 'default',
  size = 'md',
  glow = false,
}: LiquidGlassButtonProps) {
  const { isDark, colors } = useTheme();

  const getGlowColor = () => {
    switch (variant) {
      case 'primary':
        return colors.accent.primary;
      case 'danger':
        return colors.status.error;
      default:
        return colors.accent.primary;
    }
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16 },
    md: { paddingVertical: 12, paddingHorizontal: 20 },
    lg: { paddingVertical: 16, paddingHorizontal: 24 },
  };

  return (
    <View
      style={[
        styles.buttonContainer,
        sizeStyles[size],
        glow && { ...shadows.glow, shadowColor: getGlowColor() },
        style,
      ]}
    >
      <BlurView
        intensity={glass.blur.medium}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.buttonBorder,
          { borderColor: colors.border.glass },
        ]}
      />
      <View style={styles.buttonContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// LIQUID GLASS INPUT
// ============================================================================

interface LiquidGlassInputContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  focused?: boolean;
}

export function LiquidGlassInputContainer({
  children,
  style,
  focused = false,
}: LiquidGlassInputContainerProps) {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        styles.inputContainer,
        focused && { ...shadows.glow, shadowColor: colors.accent.primary },
        style,
      ]}
    >
      <BlurView
        intensity={glass.blur.light}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.inputBorder,
          {
            borderColor: focused
              ? colors.accent.primary
              : colors.border.glass,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      />
      <View style={styles.inputContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// LIQUID GLASS NAVBAR
// ============================================================================

interface LiquidGlassNavbarProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function LiquidGlassNavbar({ children, style }: LiquidGlassNavbarProps) {
  const { isDark, colors } = useTheme();

  return (
    <View style={[styles.navbarContainer, style]}>
      <BlurView
        intensity={glass.blur.strong}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.navbarBorder,
          { borderBottomColor: colors.border.glass },
        ]}
      />
      <View style={styles.navbarContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// LIQUID GLASS TAB BAR
// ============================================================================

interface LiquidGlassTabBarProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function LiquidGlassTabBar({ children, style }: LiquidGlassTabBarProps) {
  const { isDark, colors } = useTheme();

  return (
    <View style={[styles.tabBarContainer, style]}>
      <BlurView
        intensity={glass.blur.strong}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Top border glow */}
      <LinearGradient
        colors={[
          'transparent',
          isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        ]}
        style={styles.tabBarTopGlow}
      />

      <View
        style={[
          StyleSheet.absoluteFill,
          styles.tabBarBorder,
          { borderTopColor: colors.border.glass },
        ]}
      />
      <View style={styles.tabBarContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// LIQUID GLASS OVERLAY
// ============================================================================

interface LiquidGlassOverlayProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  visible?: boolean;
}

export function LiquidGlassOverlay({
  children,
  style,
}: LiquidGlassOverlayProps) {
  const { isDark } = useTheme();

  return (
    <View style={[styles.overlayContainer, style]}>
      <BlurView
        intensity={glass.blur.intense}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlayContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// ANIMATED LIQUID RING
// ============================================================================

interface LiquidRingProps {
  size?: number;
  color?: string;
}

export function LiquidRing({ size = 80, color }: LiquidRingProps) {
  const { colors } = useTheme();
  const ringColor = color || colors.accent.primary;

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1
    );
    scale.value = withRepeat(
      withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.ringContainer, { width: size, height: size }, animatedStyle]}>
      <LinearGradient
        colors={[ringColor, 'transparent', ringColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ring, { borderRadius: size / 2 }]}
      />
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Glass Card
  glassContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  glassBorder: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
  },
  glassContent: {
    padding: 16,
  },

  // Button
  buttonContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorder: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input
  inputContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    minHeight: 48,
  },
  inputBorder: {
    borderRadius: borderRadius.xl,
  },
  inputContent: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },

  // Navbar
  navbarContainer: {
    overflow: 'hidden',
  },
  navbarBorder: {
    borderBottomWidth: 0.5,
  },
  navbarContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Tab Bar
  tabBarContainer: {
    overflow: 'hidden',
  },
  tabBarTopGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  tabBarBorder: {
    borderTopWidth: 0.5,
  },
  tabBarContent: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },

  // Overlay
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Ring
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
  },
});
