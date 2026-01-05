/**
 * Animated Components - Premium iOS animations
 *
 * Spring animations, micro-interactions, and gesture responses.
 */

import React, { useEffect, ReactNode } from 'react';
import {
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
  AccessibilityProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideInLeft,
  SlideInUp,
  SlideInDown,
  ZoomIn,
  ZoomOut,
  FadeInUp,
  FadeInDown,
  FadeOutUp,
  FadeOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { spacing } from '../theme/tokens';
import { toSpringConfig, fluidSprings } from '../theme/springs';

// ============================================================================
// ANIMATED PRESSABLE (with haptics and scale)
// ============================================================================

interface AnimatedPressableProps extends AccessibilityProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  scaleValue?: number;
}

export function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  haptic = 'light',
  scaleValue = 0.97,
  ...accessibilityProps
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const triggerHaptic = () => {
    switch (haptic) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'selection':
        Haptics.selectionAsync();
        break;
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(scaleValue, toSpringConfig(fluidSprings.quick));
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, toSpringConfig(fluidSprings.bouncy));
  };

  const handlePress = () => {
    if (haptic !== 'none') {
      triggerHaptic();
    }
    onPress?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...accessibilityProps}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

// ============================================================================
// STAGGER CONTAINER (for list animations)
// ============================================================================

interface StaggerItemProps {
  children: ReactNode;
  index: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function StaggerItem({
  children,
  index,
  delay = 50,
  style,
}: StaggerItemProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(index * delay)
        .duration(400)
        .springify()
        .damping(15)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

interface TypingIndicatorProps {
  color?: string;
  size?: number;
}

export function TypingIndicator({
  color = '#00D4FF',
  size = 8,
}: TypingIndicatorProps) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 300 }),
        withDelay(400, withTiming(0, { duration: 0 }))
      ),
      -1
    );
    dot2.value = withDelay(
      150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 }),
          withDelay(400, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );
    dot3.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 }),
          withDelay(400, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );
  }, []);

  const dotStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dot1.value, [0, 1], [0, -6]) }],
    opacity: interpolate(dot1.value, [0, 1], [0.4, 1]),
  }));

  const dotStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dot2.value, [0, 1], [0, -6]) }],
    opacity: interpolate(dot2.value, [0, 1], [0.4, 1]),
  }));

  const dotStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dot3.value, [0, 1], [0, -6]) }],
    opacity: interpolate(dot3.value, [0, 1], [0.4, 1]),
  }));

  return (
    <Animated.View style={styles.typingContainer}>
      <Animated.View
        style={[
          styles.dot,
          { width: size, height: size, backgroundColor: color },
          dotStyle1,
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { width: size, height: size, backgroundColor: color },
          dotStyle2,
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { width: size, height: size, backgroundColor: color },
          dotStyle3,
        ]}
      />
    </Animated.View>
  );
}

// ============================================================================
// PULSE INDICATOR
// ============================================================================

interface PulseIndicatorProps {
  size?: number;
  color?: string;
  active?: boolean;
}

export function PulseIndicator({
  size = 12,
  color = '#00D4FF',
  active = true,
}: PulseIndicatorProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 })
        ),
        -1
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 })
        ),
        -1
      );
    }
  }, [active]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulseContainer, { width: size * 2, height: size * 2 }]}>
      {active && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
            },
            pulseStyle,
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.pulseDot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </Animated.View>
  );
}

// ============================================================================
// SHIMMER SKELETON
// ============================================================================

interface ShimmerSkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function ShimmerSkeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: ShimmerSkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        shimmerStyle,
        style,
      ]}
    />
  );
}

// ============================================================================
// MESSAGE BUBBLE ANIMATION
// ============================================================================

interface MessageBubbleAnimatedProps {
  children: ReactNode;
  isUser?: boolean;
  index?: number;
}

export function MessageBubbleAnimated({
  children,
  isUser = false,
  index = 0,
}: MessageBubbleAnimatedProps) {
  const entering = isUser
    ? SlideInRight.delay(index * 30)
        .duration(300)
        .springify()
        .damping(18)
    : SlideInLeft.delay(index * 30)
        .duration(300)
        .springify()
        .damping(18);

  return <Animated.View entering={entering}>{children}</Animated.View>;
}

// ============================================================================
// SUCCESS CHECKMARK
// ============================================================================

interface SuccessCheckmarkProps {
  size?: number;
  color?: string;
  onComplete?: () => void;
}

export function SuccessCheckmark({
  size = 60,
  color = '#10B981',
  onComplete,
}: SuccessCheckmarkProps) {
  const scale = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, toSpringConfig(fluidSprings.bouncy));
    checkScale.value = withDelay(200, withSpring(1, toSpringConfig(fluidSprings.bouncy)));

    if (onComplete) {
      setTimeout(() => runOnJS(onComplete)(), 800);
    }
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View style={[styles.successContainer, { width: size, height: size }, circleStyle]}>
      <Animated.View
        style={[
          styles.successCircle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      />
      <Animated.Text style={[styles.checkmark, { fontSize: size * 0.5 }, checkStyle]}>
        ✓
      </Animated.Text>
    </Animated.View>
  );
}

// ============================================================================
// SHAKE ANIMATION (for errors)
// ============================================================================

interface ShakeViewProps {
  children: ReactNode;
  trigger?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ShakeView({ children, trigger, style }: ShakeViewProps) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (trigger) {
      translateX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

// ============================================================================
// EXPORT ENTERING/EXITING ANIMATIONS
// ============================================================================

export const Animations = {
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeInDown,
  FadeOutUp,
  FadeOutDown,
  SlideInRight,
  SlideInLeft,
  SlideInUp,
  SlideInDown,
  ZoomIn,
  ZoomOut,
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    padding: spacing[2],
  },
  dot: {
    borderRadius: 999,
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  pulseDot: {},
  skeleton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {},
  checkmark: {
    position: 'absolute',
    color: '#FFF',
    fontWeight: '700',
  },
});
