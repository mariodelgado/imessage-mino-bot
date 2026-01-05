/**
 * Time Machine Effects - 3D starfield, depth tunnels, and temporal UI
 *
 * Inspired by Apple's Time Machine interface:
 * - Infinite starfield with depth layers
 * - 3D perspective tunnel
 * - Flowing timeline scrubber
 * - Warp speed transitions
 *
 * Creates a sense of moving through time/space - perfect for
 * showing conversation history, loading states, or transitions.
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
  withSpring,
  withDelay,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CENTER_X = SCREEN_WIDTH / 2;
const CENTER_Y = SCREEN_HEIGHT / 2;

// ============================================================================
// SINGLE STAR - A point of light in the starfield
// ============================================================================

interface StarProps {
  index: number;
  totalStars: number;
  speed: number;
  color: string;
}

function Star({ index, totalStars, speed, color }: StarProps) {
  // Distribute stars in a spiral pattern
  const angle = (index / totalStars) * Math.PI * 8 + Math.random() * 0.5;
  const baseRadius = 20 + (index / totalStars) * Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;
  const size = 1 + Math.random() * 2;

  const progress = useSharedValue(Math.random()); // Start at random position
  const twinkle = useSharedValue(0.5);

  useEffect(() => {
    const duration = (8000 + Math.random() * 4000) / speed;

    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1
    );

    // Random twinkle
    twinkle.value = withDelay(
      Math.random() * 2000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500 + Math.random() * 500 }),
          withTiming(0.3, { duration: 500 + Math.random() * 500 })
        ),
        -1
      )
    );
  }, [speed]);

  const starStyle = useAnimatedStyle(() => {
    // Stars move from outer edge toward center (reverse time machine feel)
    const currentRadius = baseRadius * (1 - progress.value * 0.8);
    const currentAngle = angle + progress.value * 0.3;

    const x = CENTER_X + Math.cos(currentAngle) * currentRadius;
    const y = CENTER_Y + Math.sin(currentAngle) * currentRadius;

    // Stars get bigger and brighter as they approach
    const depthScale = interpolate(
      progress.value,
      [0, 1],
      [0.3, 1.5],
      Extrapolation.CLAMP
    );

    return {
      left: x - size * depthScale / 2,
      top: y - size * depthScale / 2,
      width: size * depthScale,
      height: size * depthScale,
      opacity: twinkle.value * interpolate(progress.value, [0, 0.5, 1], [0.2, 0.8, 0.1]),
      transform: [{ scale: depthScale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.star,
        { backgroundColor: color, borderRadius: size },
        starStyle,
      ]}
    />
  );
}

// ============================================================================
// STARFIELD - Collection of animated stars
// ============================================================================

interface StarfieldProps {
  starCount?: number;
  speed?: number;
  color?: string;
  active?: boolean;
}

export function Starfield({
  starCount = 60,
  speed = 1,
  color,
  active = true,
}: StarfieldProps) {
  const { colors } = useTheme();
  const starColor = color || colors.foreground.primary;

  const stars = useMemo(
    () => Array.from({ length: starCount }, (_, i) => i),
    [starCount]
  );

  if (!active) return null;

  return (
    <View style={styles.starfieldContainer} pointerEvents="none">
      {stars.map((index) => (
        <Star
          key={index}
          index={index}
          totalStars={starCount}
          speed={speed}
          color={starColor}
        />
      ))}
    </View>
  );
}

// ============================================================================
// WARP TUNNEL - The 3D depth tunnel effect
// ============================================================================

interface TunnelRingProps {
  index: number;
  totalRings: number;
  speed: number;
  color: string;
}

function TunnelRing({ index, totalRings, speed, color }: TunnelRingProps) {
  const progress = useSharedValue(index / totalRings);

  useEffect(() => {
    const duration = 4000 / speed;

    progress.value = withDelay(
      (index / totalRings) * duration,
      withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1
      )
    );
  }, [speed, index, totalRings]);

  const ringStyle = useAnimatedStyle(() => {
    // Rings expand from center
    const size = interpolate(
      progress.value,
      [0, 1],
      [50, Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5]
    );

    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: interpolate(progress.value, [0, 0.3, 0.7, 1], [0, 0.6, 0.3, 0]),
      borderWidth: interpolate(progress.value, [0, 1], [3, 0.5]),
    };
  });

  return (
    <Animated.View
      style={[
        styles.tunnelRing,
        { borderColor: color },
        ringStyle,
      ]}
    />
  );
}

interface WarpTunnelProps {
  ringCount?: number;
  speed?: number;
  color?: string;
  active?: boolean;
}

export function WarpTunnel({
  ringCount = 8,
  speed = 1,
  color,
  active = true,
}: WarpTunnelProps) {
  const { colors } = useTheme();
  const ringColor = color || colors.accent.primary;

  const rings = useMemo(
    () => Array.from({ length: ringCount }, (_, i) => i),
    [ringCount]
  );

  if (!active) return null;

  return (
    <View style={styles.tunnelContainer} pointerEvents="none">
      {rings.map((index) => (
        <TunnelRing
          key={index}
          index={index}
          totalRings={ringCount}
          speed={speed}
          color={ringColor}
        />
      ))}
    </View>
  );
}

// ============================================================================
// TEMPORAL GRID - Receding grid lines like classic Time Machine
// ============================================================================

interface GridLineProps {
  isVertical: boolean;
  offset: number;
  color: string;
  speed: number;
}

function GridLine({ isVertical, offset, color, speed }: GridLineProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 3000 / speed, easing: Easing.linear }),
      -1
    );
  }, [speed]);

  const lineStyle = useAnimatedStyle(() => {
    if (isVertical) {
      // Vertical lines converge toward center
      const x = interpolate(
        progress.value,
        [0, 1],
        [offset < 0.5 ? -50 : SCREEN_WIDTH + 50, CENTER_X + (offset - 0.5) * 100]
      );
      return {
        left: x,
        height: SCREEN_HEIGHT,
        width: 1,
        opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.3, 0]),
      };
    } else {
      // Horizontal lines recede toward horizon
      const y = interpolate(
        progress.value,
        [0, 1],
        [SCREEN_HEIGHT + 20, CENTER_Y + (offset - 0.5) * 50]
      );
      return {
        top: y,
        width: SCREEN_WIDTH,
        height: 1,
        opacity: interpolate(progress.value, [0, 0.5, 1], [0.4, 0.2, 0]),
      };
    }
  });

  return (
    <Animated.View
      style={[
        styles.gridLine,
        { backgroundColor: color },
        lineStyle,
      ]}
    />
  );
}

interface TemporalGridProps {
  lineCount?: number;
  speed?: number;
  color?: string;
  active?: boolean;
}

export function TemporalGrid({
  lineCount = 12,
  speed = 1,
  color,
  active = true,
}: TemporalGridProps) {
  const { colors } = useTheme();
  const lineColor = color || `${colors.accent.primary}40`;

  const horizontalLines = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i / lineCount),
    [lineCount]
  );

  const verticalLines = useMemo(
    () => Array.from({ length: Math.floor(lineCount / 2) }, (_, i) => i / (lineCount / 2)),
    [lineCount]
  );

  if (!active) return null;

  return (
    <View style={styles.gridContainer} pointerEvents="none">
      {horizontalLines.map((offset, i) => (
        <GridLine
          key={`h-${i}`}
          isVertical={false}
          offset={offset}
          color={lineColor}
          speed={speed}
        />
      ))}
      {verticalLines.map((offset, i) => (
        <GridLine
          key={`v-${i}`}
          isVertical={true}
          offset={offset}
          color={lineColor}
          speed={speed * 0.5}
        />
      ))}
    </View>
  );
}

// ============================================================================
// WARP SPEED TRANSITION - The "jump" effect
// ============================================================================

interface WarpSpeedProps {
  active: boolean;
  onComplete?: () => void;
  color?: string;
}

export function WarpSpeed({ active, onComplete, color }: WarpSpeedProps) {
  const { colors } = useTheme();
  const warpColor = color || colors.accent.primary;

  const stretch = useSharedValue(1);
  const brightness = useSharedValue(0);

  useEffect(() => {
    if (active) {
      // Haptic feedback for the jump
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      stretch.value = withSequence(
        withTiming(5, { duration: 300, easing: Easing.in(Easing.exp) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })
      );

      brightness.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        })
      );
    }
  }, [active]);

  const warpStyle = useAnimatedStyle(() => ({
    opacity: brightness.value,
    transform: [{ scaleY: stretch.value }],
  }));

  if (!active) return null;

  return (
    <Animated.View style={[styles.warpOverlay, warpStyle]}>
      <LinearGradient
        colors={['transparent', warpColor, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </Animated.View>
  );
}

// ============================================================================
// TIMELINE SCRUBBER - Flowing time indicator
// ============================================================================

interface TimelineScrubberProps {
  position: number; // 0-1
  totalItems: number;
  color?: string;
  onPositionChange?: (position: number) => void;
}

export function TimelineScrubber({
  position,
  totalItems,
  color,
}: TimelineScrubberProps) {
  const { colors, isDark } = useTheme();
  const scrubberColor = color || colors.accent.primary;

  const animatedPosition = useSharedValue(position);

  useEffect(() => {
    animatedPosition.value = withSpring(position, {
      damping: 20,
      stiffness: 200,
    });
  }, [position]);

  // Generate tick marks
  const ticks = useMemo(
    () => Array.from({ length: Math.min(totalItems, 20) }, (_, i) => i),
    [totalItems]
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${animatedPosition.value * 100}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    left: `${animatedPosition.value * 100}%`,
    opacity: 0.5,
  }));

  return (
    <View style={styles.scrubberContainer}>
      {/* Track */}
      <View
        style={[
          styles.scrubberTrack,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        ]}
      >
        {/* Tick marks */}
        {ticks.map((_, i) => (
          <View
            key={i}
            style={[
              styles.scrubberTick,
              {
                left: `${(i / (ticks.length - 1)) * 100}%`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              },
            ]}
          />
        ))}

        {/* Glow behind indicator */}
        <Animated.View
          style={[
            styles.scrubberGlow,
            { backgroundColor: scrubberColor },
            glowStyle,
          ]}
        />

        {/* Active indicator */}
        <Animated.View
          style={[
            styles.scrubberIndicator,
            { backgroundColor: scrubberColor },
            indicatorStyle,
          ]}
        />
      </View>
    </View>
  );
}

// ============================================================================
// DEPTH FOG - Atmospheric depth effect
// ============================================================================

interface DepthFogProps {
  intensity?: number;
  color?: string;
  direction?: 'top' | 'bottom' | 'both';
}

export function DepthFog({
  intensity = 0.8,
  color,
  direction = 'bottom',
}: DepthFogProps) {
  const { isDark } = useTheme();
  const fogColor = color || (isDark ? '#000' : '#fff');

  const fogOpacity = useSharedValue(intensity * 0.5);

  useEffect(() => {
    fogOpacity.value = withRepeat(
      withSequence(
        withTiming(intensity, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(intensity * 0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [intensity]);

  const fogStyle = useAnimatedStyle(() => ({
    opacity: fogOpacity.value,
  }));

  return (
    <>
      {(direction === 'top' || direction === 'both') && (
        <Animated.View style={[styles.fogTop, fogStyle]}>
          <LinearGradient
            colors={[fogColor, 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {(direction === 'bottom' || direction === 'both') && (
        <Animated.View style={[styles.fogBottom, fogStyle]}>
          <LinearGradient
            colors={['transparent', fogColor]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </>
  );
}

// ============================================================================
// COMPOSED: TIME MACHINE SCENE
// ============================================================================

interface TimeMachineSceneProps {
  active?: boolean;
  speed?: number;
  variant?: 'starfield' | 'tunnel' | 'grid' | 'full';
  color?: string;
  intensity?: 'subtle' | 'normal' | 'intense';
}

export function TimeMachineScene({
  active = true,
  speed = 1,
  variant = 'full',
  color,
  intensity = 'normal',
}: TimeMachineSceneProps) {
  const { colors, isDark } = useTheme();
  const effectColor = color || colors.accent.primary;

  const intensityMap = {
    subtle: { stars: 30, rings: 4, lines: 6 },
    normal: { stars: 60, rings: 8, lines: 12 },
    intense: { stars: 100, rings: 12, lines: 20 },
  };

  const config = intensityMap[intensity];

  return (
    <View style={styles.sceneContainer} pointerEvents="none">
      {/* Base darkness */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#000' : '#0a0a15' },
        ]}
      />

      {/* Starfield */}
      {(variant === 'starfield' || variant === 'full') && (
        <Starfield
          starCount={config.stars}
          speed={speed}
          color={`${effectColor}CC`}
          active={active}
        />
      )}

      {/* Warp tunnel */}
      {(variant === 'tunnel' || variant === 'full') && (
        <WarpTunnel
          ringCount={config.rings}
          speed={speed}
          color={effectColor}
          active={active}
        />
      )}

      {/* Temporal grid */}
      {(variant === 'grid' || variant === 'full') && (
        <TemporalGrid
          lineCount={config.lines}
          speed={speed}
          color={effectColor}
          active={active}
        />
      )}

      {/* Depth fog */}
      <DepthFog
        intensity={intensity === 'intense' ? 0.9 : intensity === 'subtle' ? 0.5 : 0.7}
        direction="both"
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Starfield
  starfieldContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 3,
    shadowOpacity: 0.8,
  },

  // Warp Tunnel
  tunnelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tunnelRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },

  // Temporal Grid
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
  },

  // Warp Speed
  warpOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },

  // Timeline Scrubber
  scrubberContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scrubberTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  scrubberTick: {
    position: 'absolute',
    width: 2,
    height: 8,
    top: -2,
    marginLeft: -1,
    borderRadius: 1,
  },
  scrubberGlow: {
    position: 'absolute',
    width: 40,
    height: 20,
    top: -8,
    marginLeft: -20,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: 0.8,
  },
  scrubberIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    top: -6,
    marginLeft: -8,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowOpacity: 0.3,
  },

  // Depth Fog
  fogTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.3,
  },
  fogBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
  },

  // Scene Container
  sceneContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});

export default {
  Starfield,
  WarpTunnel,
  TemporalGrid,
  WarpSpeed,
  TimelineScrubber,
  DepthFog,
  TimeMachineScene,
};
