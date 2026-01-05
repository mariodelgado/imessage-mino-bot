/**
 * Dynamic Island - Apple-style Live Activity Container
 *
 * Morphs between compact and expanded states with fluid spring animations.
 * Mimics iOS 16+ Dynamic Island behavior for showing live activity states.
 *
 * States:
 * - compact: Small pill showing minimal info (like the actual Dynamic Island)
 * - expanded: Full card with detailed content and actions
 * - minimal: Tiny indicator dot
 */

import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { Body, Caption1, Caption2 } from './Typography';
import { spacing } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dynamic Island dimensions matching Apple's specs
const ISLAND_COMPACT_WIDTH = 126;
const ISLAND_COMPACT_HEIGHT = 37;
const ISLAND_EXPANDED_WIDTH = SCREEN_WIDTH - 32;
const ISLAND_EXPANDED_HEIGHT = 120;
const ISLAND_MINIMAL_SIZE = 12;

// Animation configs
const MORPH_SPRING = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

const EXPAND_SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 1,
};

// ============================================================================
// TYPES
// ============================================================================

export type DynamicIslandState = 'hidden' | 'minimal' | 'compact' | 'expanded';

export type DynamicIslandActivity =
  | 'idle'
  | 'connecting'
  | 'thinking'
  | 'browsing'
  | 'success'
  | 'error';

interface DynamicIslandProps {
  state: DynamicIslandState;
  activity: DynamicIslandActivity;
  title?: string;
  subtitle?: string;
  progress?: number; // 0-1
  onPress?: () => void;
  onLongPress?: () => void;
}

// ============================================================================
// ACTIVITY INDICATOR (Animated Orb)
// ============================================================================

interface ActivityOrbProps {
  activity: DynamicIslandActivity;
  size?: number;
}

function ActivityOrb({ activity, size = 32 }: ActivityOrbProps) {
  const { colors } = useTheme();
  const pulse = useSharedValue(1);
  const rotation = useSharedValue(0);
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (activity === 'thinking' || activity === 'connecting') {
      // Breathing pulse
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      // Slow rotation for energy feel
      rotation.value = withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1
      );
      // Glow pulse
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 })
        ),
        -1
      );
    } else if (activity === 'browsing') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1
      );
      rotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1
      );
    } else if (activity === 'success') {
      pulse.value = withSequence(
        withSpring(1.3, { damping: 8 }),
        withSpring(1, { damping: 12 })
      );
    } else if (activity === 'error') {
      pulse.value = withSequence(
        withTiming(1.2, { duration: 100 }),
        withTiming(0.9, { duration: 100 }),
        withTiming(1.1, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    } else {
      pulse.value = withSpring(1);
      rotation.value = withTiming(0);
      glow.value = withTiming(0.3);
    }
  }, [activity]);

  const getActivityColor = () => {
    switch (activity) {
      case 'connecting':
        return colors.status.warning;
      case 'thinking':
        return colors.accent.primary;
      case 'browsing':
        return colors.accent.secondary;
      case 'success':
        return colors.status.success;
      case 'error':
        return colors.status.error;
      default:
        return colors.foreground.muted;
    }
  };

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: pulse.value * 1.5 }],
  }));

  const activityColor = getActivityColor();

  return (
    <View style={[styles.orbContainer, { width: size, height: size }]}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.orbGlow,
          {
            width: size * 2,
            height: size * 2,
            backgroundColor: activityColor,
            borderRadius: size,
          },
          glowStyle,
        ]}
      />
      {/* Main orb */}
      <Animated.View style={orbStyle}>
        <LinearGradient
          colors={[activityColor, `${activityColor}80`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.orb,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        />
        {/* Inner highlight */}
        <View
          style={[
            styles.orbHighlight,
            {
              width: size * 0.4,
              height: size * 0.4,
              borderRadius: size * 0.2,
              top: size * 0.15,
              left: size * 0.15,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// WAVEFORM (for thinking state)
// ============================================================================

interface WaveformBarProps {
  bar: Animated.SharedValue<number>;
  color: string;
}

function WaveformBar({ bar, color }: WaveformBarProps) {
  const barStyle = useAnimatedStyle(() => ({
    height: interpolate(bar.value, [0.3, 1], [8, 20]),
    opacity: interpolate(bar.value, [0.3, 1], [0.5, 1]),
  }));

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        { backgroundColor: color },
        barStyle,
      ]}
    />
  );
}

interface WaveformProps {
  active: boolean;
  color: string;
}

function Waveform({ active, color }: WaveformProps) {
  const bars = [
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
  ];

  useEffect(() => {
    if (active) {
      bars.forEach((bar, index) => {
        bar.value = withDelay(
          index * 100,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 300 + Math.random() * 200 }),
              withTiming(0.3, { duration: 300 + Math.random() * 200 })
            ),
            -1
          )
        );
      });
    } else {
      bars.forEach((bar) => {
        bar.value = withTiming(0.3);
      });
    }
  }, [active]);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((bar, index) => (
        <WaveformBar key={index} bar={bar} color={color} />
      ))}
    </View>
  );
}

// ============================================================================
// PROGRESS RING
// ============================================================================

interface ProgressRingProps {
  progress: number;
  size: number;
  color: string;
}

function ProgressRing({ progress, size, color }: ProgressRingProps) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withSpring(progress, { damping: 15 });
  }, [progress]);

  const ringStyle = useAnimatedStyle(() => {
    return {
      // Using border trick for progress ring
      borderTopColor: color,
      borderRightColor: animatedProgress.value > 0.25 ? color : 'transparent',
      borderBottomColor: animatedProgress.value > 0.5 ? color : 'transparent',
      borderLeftColor: animatedProgress.value > 0.75 ? color : 'transparent',
      transform: [{ rotate: `${animatedProgress.value * 360}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.progressRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
        },
        ringStyle,
      ]}
    />
  );
}

// ============================================================================
// MAIN DYNAMIC ISLAND COMPONENT
// ============================================================================

export function DynamicIsland({
  state,
  activity,
  title,
  subtitle,
  progress,
  onPress,
  onLongPress,
}: DynamicIslandProps) {
  const { colors, isDark } = useTheme();

  // Animated values for morphing
  const width = useSharedValue(ISLAND_COMPACT_WIDTH);
  const height = useSharedValue(ISLAND_COMPACT_HEIGHT);
  const borderRadiusValue = useSharedValue(ISLAND_COMPACT_HEIGHT / 2);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(-50);

  // Update dimensions based on state
  useEffect(() => {
    switch (state) {
      case 'hidden':
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withSpring(-100, MORPH_SPRING);
        break;
      case 'minimal':
        width.value = withSpring(ISLAND_MINIMAL_SIZE, MORPH_SPRING);
        height.value = withSpring(ISLAND_MINIMAL_SIZE, MORPH_SPRING);
        borderRadiusValue.value = withSpring(ISLAND_MINIMAL_SIZE / 2, MORPH_SPRING);
        opacity.value = withTiming(1);
        translateY.value = withSpring(0, MORPH_SPRING);
        break;
      case 'compact':
        width.value = withSpring(ISLAND_COMPACT_WIDTH, MORPH_SPRING);
        height.value = withSpring(ISLAND_COMPACT_HEIGHT, MORPH_SPRING);
        borderRadiusValue.value = withSpring(ISLAND_COMPACT_HEIGHT / 2, MORPH_SPRING);
        opacity.value = withTiming(1);
        translateY.value = withSpring(0, MORPH_SPRING);
        break;
      case 'expanded':
        width.value = withSpring(ISLAND_EXPANDED_WIDTH, EXPAND_SPRING);
        height.value = withSpring(ISLAND_EXPANDED_HEIGHT, EXPAND_SPRING);
        borderRadiusValue.value = withSpring(32, EXPAND_SPRING);
        opacity.value = withTiming(1);
        translateY.value = withSpring(0, EXPAND_SPRING);
        break;
    }
  }, [state]);

  // Haptic feedback on state change
  useEffect(() => {
    if (state === 'expanded') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (state === 'compact') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [state]);

  // Container animated style
  const containerStyle = useAnimatedStyle(() => ({
    width: width.value,
    height: height.value,
    borderRadius: borderRadiusValue.value,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const compactContentStyle = useAnimatedStyle(() => ({
    opacity: state === 'compact' ? withTiming(1) : withTiming(0),
  }));

  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: state === 'expanded' ? withTiming(1, { duration: 300 }) : withTiming(0, { duration: 150 }),
  }));

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress?.();
  }, [onLongPress]);

  if (state === 'hidden') return null;

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Background */}
        <View style={[StyleSheet.absoluteFill, styles.background]}>
          <BlurView
            intensity={isDark ? 40 : 60}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.85)' },
            ]}
          />
        </View>

        {/* Compact Content */}
        <Animated.View style={[styles.compactContent, compactContentStyle]}>
          <ActivityOrb activity={activity} size={24} />
          {activity === 'thinking' && (
            <Waveform active={activity === 'thinking'} color={colors.accent.primary} />
          )}
          {activity !== 'thinking' && title && (
            <Caption1 color="#FFFFFF" numberOfLines={1} style={styles.compactTitle}>
              {title}
            </Caption1>
          )}
          {progress !== undefined && (
            <ProgressRing progress={progress} size={20} color={colors.accent.primary} />
          )}
        </Animated.View>

        {/* Expanded Content */}
        <Animated.View style={[styles.expandedContent, expandedContentStyle]}>
          <View style={styles.expandedHeader}>
            <ActivityOrb activity={activity} size={40} />
            <View style={styles.expandedText}>
              <Body color="#FFFFFF" style={{ fontWeight: '600' }}>
                {title || 'Mino'}
              </Body>
              {subtitle && (
                <Caption2 color="rgba(255,255,255,0.6)">
                  {subtitle}
                </Caption2>
              )}
            </View>
          </View>

          {activity === 'thinking' && (
            <View style={styles.expandedWaveform}>
              <Waveform active color={colors.accent.primary} />
            </View>
          )}

          {progress !== undefined && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.accent.primary,
                      width: `${progress * 100}%`,
                    },
                  ]}
                />
              </View>
              <Caption2 color="rgba(255,255,255,0.5)">
                {Math.round(progress * 100)}%
              </Caption2>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    overflow: 'hidden',
    zIndex: 1000,
  },
  background: {
    borderRadius: 999,
    overflow: 'hidden',
  },

  // Orb
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlow: {
    position: 'absolute',
    opacity: 0.3,
  },
  orb: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  orbHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },

  // Progress Ring
  progressRing: {
    borderColor: 'transparent',
  },

  // Compact Content
  compactContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    gap: spacing[2],
  },
  compactTitle: {
    maxWidth: 60,
  },

  // Expanded Content
  expandedContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    justifyContent: 'space-between',
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  expandedText: {
    flex: 1,
  },
  expandedWaveform: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default DynamicIsland;
