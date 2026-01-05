/**
 * AirDrop Effects - Cinematic radial glows, ripples, and particle systems
 *
 * Mimics the magical AirDrop nearby detection UI:
 * - Pulsing radial gradient glows
 * - Expanding ripple rings
 * - Floating particle system
 * - Depth-aware blur layers
 *
 * This creates the "magical" Apple feel for connections and discoveries.
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// RADIAL GLOW - The core AirDrop "found someone" effect
// ============================================================================

interface RadialGlowProps {
  size?: number;
  color?: string;
  intensity?: number;
  active?: boolean;
  pulseSpeed?: number;
}

export function RadialGlow({
  size = 200,
  color,
  intensity = 0.6,
  active = true,
  pulseSpeed = 2000,
}: RadialGlowProps) {
  const { colors } = useTheme();
  const glowColor = color || colors.accent.primary;

  const pulse = useSharedValue(0.8);
  const innerPulse = useSharedValue(1);

  useEffect(() => {
    if (active) {
      // Outer glow - slow breathe
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: pulseSpeed, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: pulseSpeed, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      // Inner glow - faster, offset timing
      innerPulse.value = withDelay(
        pulseSpeed / 4,
        withRepeat(
          withSequence(
            withTiming(1.2, { duration: pulseSpeed * 0.8 }),
            withTiming(0.9, { duration: pulseSpeed * 0.8 })
          ),
          -1
        )
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
      innerPulse.value = withTiming(0, { duration: 300 });
    }
  }, [active, pulseSpeed]);

  const outerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.8, 1], [intensity * 0.3, intensity * 0.6]),
    transform: [{ scale: pulse.value }],
  }));

  const middleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.8, 1], [intensity * 0.5, intensity * 0.8]),
    transform: [{ scale: interpolate(pulse.value, [0.8, 1], [0.9, 1]) }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(innerPulse.value, [0.9, 1.2], [intensity * 0.7, intensity]),
    transform: [{ scale: interpolate(innerPulse.value, [0.9, 1.2], [0.85, 1]) }],
  }));

  return (
    <View style={[styles.glowContainer, { width: size, height: size }]}>
      {/* Outer haze */}
      <Animated.View
        style={[
          styles.glowLayer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: glowColor,
          },
          outerStyle,
        ]}
      />
      {/* Middle ring */}
      <Animated.View
        style={[
          styles.glowLayer,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: (size * 0.7) / 2,
            backgroundColor: glowColor,
          },
          middleStyle,
        ]}
      />
      {/* Inner core */}
      <Animated.View
        style={[
          styles.glowLayer,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
          },
          innerStyle,
        ]}
      >
        <LinearGradient
          colors={[`${glowColor}`, `${glowColor}80`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// RIPPLE RING - Expanding circles like AirDrop discovery
// ============================================================================

interface RippleRingProps {
  size?: number;
  color?: string;
  duration?: number;
  delay?: number;
  active?: boolean;
}

function SingleRipple({ size, color, duration, delay, index }: RippleRingProps & { index: number }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withDelay(
      delay! + index * (duration! / 3),
      withRepeat(
        withTiming(1.5, { duration: duration!, easing: Easing.out(Easing.ease) }),
        -1
      )
    );
    opacity.value = withDelay(
      delay! + index * (duration! / 3),
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: duration! * 0.3 }),
          withTiming(0, { duration: duration! * 0.7 })
        ),
        -1
      )
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.rippleRing,
        {
          width: size,
          height: size,
          borderRadius: size! / 2,
          borderColor: color,
        },
        ringStyle,
      ]}
    />
  );
}

export function RippleRings({
  size = 300,
  color,
  duration = 3000,
  delay = 0,
  active = true,
}: RippleRingProps) {
  const { colors } = useTheme();
  const rippleColor = color || colors.accent.primary;

  if (!active) return null;

  return (
    <View style={[styles.rippleContainer, { width: size, height: size }]}>
      {[0, 1, 2].map((index) => (
        <SingleRipple
          key={index}
          index={index}
          size={size}
          color={rippleColor}
          duration={duration}
          delay={delay}
          active={active}
        />
      ))}
    </View>
  );
}

// ============================================================================
// PARTICLE SYSTEM - Floating magical particles
// ============================================================================

interface ParticleProps {
  index: number;
  containerSize: number;
  color: string;
}

function Particle({ index, containerSize, color }: ParticleProps) {
  const size = 3 + Math.random() * 4;
  const startAngle = (index / 12) * Math.PI * 2;
  const radius = containerSize * 0.3 + Math.random() * containerSize * 0.2;

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const randomDelay = Math.random() * 2000;
    const duration = 4000 + Math.random() * 2000;

    progress.value = withDelay(
      randomDelay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1
      )
    );

    opacity.value = withDelay(
      randomDelay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration * 0.2 }),
          withTiming(0.6, { duration: duration * 0.6 }),
          withTiming(0, { duration: duration * 0.2 })
        ),
        -1
      )
    );
  }, []);

  const particleStyle = useAnimatedStyle(() => {
    const angle = startAngle + progress.value * Math.PI * 0.5;
    const currentRadius = radius + progress.value * containerSize * 0.1;
    const x = Math.cos(angle) * currentRadius;
    const y = Math.sin(angle) * currentRadius - progress.value * 30;

    return {
      opacity: opacity.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: interpolate(progress.value, [0, 0.5, 1], [0.5, 1, 0.3]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: containerSize / 2 - size / 2,
          top: containerSize / 2 - size / 2,
        },
        particleStyle,
      ]}
    />
  );
}

interface ParticleFieldProps {
  size?: number;
  color?: string;
  particleCount?: number;
  active?: boolean;
}

export function ParticleField({
  size = 300,
  color,
  particleCount = 12,
  active = true,
}: ParticleFieldProps) {
  const { colors } = useTheme();
  const particleColor = color || colors.accent.primary;

  const particles = useMemo(
    () => Array.from({ length: particleCount }, (_, i) => i),
    [particleCount]
  );

  if (!active) return null;

  return (
    <View style={[styles.particleContainer, { width: size, height: size }]}>
      {particles.map((index) => (
        <Particle
          key={index}
          index={index}
          containerSize={size}
          color={particleColor}
        />
      ))}
    </View>
  );
}

// ============================================================================
// AURORA BACKGROUND - Cinematic flowing gradients
// ============================================================================

interface AuroraBackgroundProps {
  colors?: string[];
  intensity?: number;
  speed?: number;
}

export function AuroraBackground({
  colors: customColors,
  intensity = 0.3,
  speed = 8000,
}: AuroraBackgroundProps) {
  const { colors, isDark } = useTheme();

  const auroraColors = customColors || [
    colors.accent.primary,
    colors.accent.secondary,
    colors.status.info,
  ];

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: speed * 4, easing: Easing.linear }),
      -1
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: speed, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: speed, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [speed]);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-rotation.value * 0.7}deg` },
      { scale: interpolate(scale.value, [1, 1.2], [1.1, 0.9]) },
    ],
  }));

  const blob3Style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value * 0.5}deg` },
      { scale: interpolate(scale.value, [1, 1.2], [0.95, 1.15]) },
    ],
  }));

  return (
    <View style={styles.auroraContainer}>
      <BlurView
        intensity={isDark ? 80 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.auroraBlob, styles.auroraBlob1, blob1Style]}>
        <LinearGradient
          colors={[`${auroraColors[0]}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.auroraBlob, styles.auroraBlob2, blob2Style]}>
        <LinearGradient
          colors={[`${auroraColors[1]}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={[styles.auroraBlob, styles.auroraBlob3, blob3Style]}>
        <LinearGradient
          colors={[`${auroraColors[2]}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// CONNECTION BEAM - Light beam connecting two points
// ============================================================================

interface ConnectionBeamProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  active?: boolean;
  width?: number;
}

export function ConnectionBeam({
  startX,
  startY,
  endX,
  endY,
  color,
  active = true,
  width = 2,
}: ConnectionBeamProps) {
  const { colors } = useTheme();
  const beamColor = color || colors.accent.primary;

  const progress = useSharedValue(0);
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (active) {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.5, { duration: 800 })
        ),
        -1
      );
    }
  }, [active]);

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const beamStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 0.5, 1], [0, length, 0]),
    opacity: glow.value,
    shadowOpacity: glow.value * 0.8,
  }));

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.beam,
        {
          left: startX,
          top: startY,
          height: width,
          backgroundColor: beamColor,
          transform: [{ rotate: `${angle}deg` }],
          transformOrigin: 'left center',
          shadowColor: beamColor,
        },
        beamStyle,
      ]}
    />
  );
}

// ============================================================================
// DISCOVERY PULSE - The "found" animation
// ============================================================================

interface DiscoveryPulseProps {
  x: number;
  y: number;
  color?: string;
  onComplete?: () => void;
}

export function DiscoveryPulse({ x, y, color, onComplete }: DiscoveryPulseProps) {
  const { colors } = useTheme();
  const pulseColor = color || colors.accent.primary;

  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    scale.value = withSpring(1.5, { damping: 8, stiffness: 100 });
    opacity.value = withTiming(0, { duration: 800 }, (finished) => {
      if (finished && onComplete) {
        runOnJS(onComplete)();
      }
    });
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.discoveryPulse,
        {
          left: x - 50,
          top: y - 50,
          backgroundColor: pulseColor,
        },
        pulseStyle,
      ]}
    />
  );
}

// ============================================================================
// COMPOSED: AIRDROP DISCOVERY EFFECT
// ============================================================================

interface AirDropDiscoveryProps {
  active?: boolean;
  color?: string;
  size?: number;
  showParticles?: boolean;
  showRipples?: boolean;
  intensity?: 'subtle' | 'normal' | 'intense';
}

export function AirDropDiscovery({
  active = true,
  color,
  size = 250,
  showParticles = true,
  showRipples = true,
  intensity = 'normal',
}: AirDropDiscoveryProps) {
  const { colors } = useTheme();
  const effectColor = color || colors.accent.primary;

  const intensityMap = {
    subtle: 0.3,
    normal: 0.6,
    intense: 0.9,
  };

  return (
    <View style={[styles.discoveryContainer, { width: size, height: size }]}>
      {/* Base glow */}
      <RadialGlow
        size={size}
        color={effectColor}
        intensity={intensityMap[intensity]}
        active={active}
      />

      {/* Ripple rings */}
      {showRipples && (
        <View style={StyleSheet.absoluteFill}>
          <RippleRings
            size={size}
            color={effectColor}
            active={active}
          />
        </View>
      )}

      {/* Floating particles */}
      {showParticles && (
        <View style={StyleSheet.absoluteFill}>
          <ParticleField
            size={size}
            color={effectColor}
            active={active}
            particleCount={intensity === 'intense' ? 18 : intensity === 'subtle' ? 8 : 12}
          />
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Radial Glow
  glowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowLayer: {
    position: 'absolute',
  },

  // Ripple Rings
  rippleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },

  // Particles
  particleContainer: {
    position: 'relative',
  },
  particle: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  // Aurora Background
  auroraContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  auroraBlob: {
    position: 'absolute',
    borderRadius: 999,
  },
  auroraBlob1: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    top: -SCREEN_WIDTH * 0.5,
    left: -SCREEN_WIDTH * 0.3,
  },
  auroraBlob2: {
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    top: SCREEN_HEIGHT * 0.3,
    right: -SCREEN_WIDTH * 0.4,
  },
  auroraBlob3: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    bottom: -SCREEN_WIDTH * 0.3,
    left: SCREEN_WIDTH * 0.1,
  },

  // Connection Beam
  beam: {
    position: 'absolute',
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },

  // Discovery Pulse
  discoveryPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  // Discovery Container
  discoveryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default {
  RadialGlow,
  RippleRings,
  ParticleField,
  AuroraBackground,
  ConnectionBeam,
  DiscoveryPulse,
  AirDropDiscovery,
};
