/**
 * Icon System - SF Symbols-inspired icons
 *
 * Uses @expo/vector-icons with SF Symbols styling.
 * Consistent sizing and accessibility.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { animations } from '../theme/tokens';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

// Icon size scale matching Apple HIG
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

type IconSize = keyof typeof iconSizes;

interface BaseIconProps {
  size?: IconSize | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// ============================================================================
// TAB BAR ICONS (with animation support)
// ============================================================================

interface TabIconProps extends BaseIconProps {
  focused?: boolean;
  badge?: number;
}

export function ChatIcon({ size = 'md', color, focused, badge }: TabIconProps) {
  const { colors } = useTheme();
  const iconColor = color || (focused ? colors.accent.primary : colors.foreground.tertiary);
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.2, animations.spring.bouncy),
        withSpring(1, animations.spring.gentle)
      );
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={focused ? 'chatbubble' : 'chatbubble-outline'}
          size={iconSize}
          color={iconColor}
        />
      </Animated.View>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.status.error }]}>
          <Animated.Text style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Animated.Text>
        </View>
      )}
    </View>
  );
}

export function BrowserIcon({ size = 'md', color, focused }: TabIconProps) {
  const { colors } = useTheme();
  const iconColor = color || (focused ? colors.accent.primary : colors.foreground.tertiary);
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.2, animations.spring.bouncy),
        withSpring(1, animations.spring.gentle)
      );
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? 'globe' : 'globe-outline'}
        size={iconSize}
        color={iconColor}
      />
    </Animated.View>
  );
}

export function SettingsIcon({ size = 'md', color, focused }: TabIconProps) {
  const { colors } = useTheme();
  const iconColor = color || (focused ? colors.accent.primary : colors.foreground.tertiary);
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (focused) {
      rotation.value = withSequence(
        withTiming(45, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) })
      );
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? 'settings' : 'settings-outline'}
        size={iconSize}
        color={iconColor}
      />
    </Animated.View>
  );
}

export function HomeIcon({ size = 'md', color, focused }: TabIconProps) {
  const { colors } = useTheme();
  const iconColor = color || (focused ? colors.accent.primary : colors.foreground.tertiary);
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.2, animations.spring.bouncy),
        withSpring(1, animations.spring.gentle)
      );
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? 'apps' : 'apps-outline'}
        size={iconSize}
        color={iconColor}
      />
    </Animated.View>
  );
}

// ============================================================================
// ACTION ICONS
// ============================================================================

export function SendIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.accent.primary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="send" size={iconSize} color={iconColor} />;
}

export function MicIcon({ size = 'md', color, style }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return (
    <View style={style}>
      <Ionicons name="mic-outline" size={iconSize} color={iconColor} />
    </View>
  );
}

export function AttachIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="attach" size={iconSize} color={iconColor} />;
}

export function CloseIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="close" size={iconSize} color={iconColor} />;
}

export function CheckIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.status.success;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="checkmark" size={iconSize} color={iconColor} />;
}

export function ChevronRightIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.tertiary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="chevron-forward" size={iconSize} color={iconColor} />;
}

export function ChevronDownIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.tertiary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="chevron-down" size={iconSize} color={iconColor} />;
}

// ============================================================================
// STATUS ICONS
// ============================================================================

interface StatusIconProps extends BaseIconProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export function ConnectionStatusIcon({ status, size = 'sm' }: StatusIconProps) {
  const { colors } = useTheme();
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (status === 'connecting') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1
      );
    } else {
      pulse.value = 1;
    }
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return colors.status.success;
      case 'connecting':
        return colors.status.warning;
      case 'disconnected':
      case 'error':
        return colors.status.error;
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'connected':
        return 'wifi';
      case 'connecting':
        return 'wifi-outline';
      case 'disconnected':
        return 'wifi-off-outline';
      case 'error':
        return 'alert-circle-outline';
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={getIcon() as any} size={iconSize} color={getStatusColor()} />
    </Animated.View>
  );
}

// ============================================================================
// ANIMATED LOADING ICON
// ============================================================================

interface LoadingIconProps extends BaseIconProps {
  active?: boolean;
}

export function LoadingIcon({ size = 'md', color, active = true }: LoadingIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.accent.primary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (active) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1
      );
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <AnimatedIonicons
      name="sync-outline"
      size={iconSize}
      color={iconColor}
      style={animatedStyle}
    />
  );
}

// ============================================================================
// BROWSER ACTION ICONS
// ============================================================================

export function SearchIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="search-outline" size={iconSize} color={iconColor} />;
}

export function ClickIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="finger-print-outline" size={iconSize} color={iconColor} />;
}

export function TypeIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="text-outline" size={iconSize} color={iconColor} />;
}

export function NavigateIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="navigate-outline" size={iconSize} color={iconColor} />;
}

export function ScreenshotIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="camera-outline" size={iconSize} color={iconColor} />;
}

// ============================================================================
// SETTINGS ICONS
// ============================================================================

export function ServerIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="server-outline" size={iconSize} color={iconColor} />;
}

export function AIIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="sparkles-outline" size={iconSize} color={iconColor} />;
}

export function NotificationIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="notifications-outline" size={iconSize} color={iconColor} />;
}

export function ThemeIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="moon-outline" size={iconSize} color={iconColor} />;
}

export function InfoIcon({ size = 'md', color }: BaseIconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.foreground.secondary;
  const iconSize = typeof size === 'number' ? size : iconSizes[size];

  return <Ionicons name="information-circle-outline" size={iconSize} color={iconColor} />;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
