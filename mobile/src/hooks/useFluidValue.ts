/**
 * Fluid Value Hook
 *
 * A shared value primitive that can be seamlessly redirected at any point.
 *
 * Key insight from Apple WWDC 2018:
 * "The thought and gesture happen in parallel... you think with the gesture."
 *
 * Core principles:
 * - Never wait for animation to complete
 * - Spring physics naturally handle interruption (seamless curves)
 * - Velocity preservation for momentum continuity
 *
 * This is the foundation for all interruptible, redirectable animations.
 */

import { useCallback } from 'react';
import {
  useSharedValue,
  withSpring,
  cancelAnimation,
  SharedValue,
  WithSpringConfig,
} from 'react-native-reanimated';
import { toSpringConfig, fluidSprings, FluidSpringPreset } from '../theme/springs';

// ============================================================================
// TYPES
// ============================================================================

export interface FluidValueResult {
  /** The animated shared value */
  value: SharedValue<number>;
  /** Current velocity (for momentum preservation) */
  velocity: SharedValue<number>;
  /** Animate to target with optional spring preset */
  animateTo: (target: number, spring?: FluidSpringPreset, preserveVelocity?: boolean) => void;
  /** Set value immediately without animation */
  setImmediately: (target: number) => void;
  /** Cancel any running animation */
  cancel: () => void;
  /** Redirect animation to new target mid-flight (preserves velocity) */
  redirect: (target: number, spring?: FluidSpringPreset) => void;
}

export interface FluidValue2DResult {
  /** X coordinate */
  x: SharedValue<number>;
  /** Y coordinate */
  y: SharedValue<number>;
  /** X velocity */
  velocityX: SharedValue<number>;
  /** Y velocity */
  velocityY: SharedValue<number>;
  /** Animate to 2D target */
  animateTo: (
    targetX: number,
    targetY: number,
    spring?: FluidSpringPreset,
    preserveVelocity?: boolean
  ) => void;
  /** Set position immediately */
  setImmediately: (x: number, y: number) => void;
  /** Cancel all animations */
  cancel: () => void;
  /** Redirect to new position mid-flight */
  redirect: (targetX: number, targetY: number, spring?: FluidSpringPreset) => void;
}

// ============================================================================
// 1D FLUID VALUE
// ============================================================================

/**
 * Create an interruptible, redirectable animated value
 *
 * @param initialValue - Starting value
 * @returns Fluid value controls
 *
 * @example
 * ```tsx
 * const translateY = useFluidValue(0);
 *
 * // In gesture handler
 * .onEnd((e) => {
 *   // Redirects immediately, preserving momentum
 *   translateY.animateTo(snapPoint, 'momentum');
 * })
 *
 * // User taps during animation - instantly redirectable
 * .onBegin(() => {
 *   translateY.redirect(newTarget, 'quick');
 * })
 * ```
 */
export function useFluidValue(initialValue: number): FluidValueResult {
  const value = useSharedValue(initialValue);
  const velocity = useSharedValue(0);

  const animateTo = useCallback(
    (
      target: number,
      spring: FluidSpringPreset = 'smooth',
      preserveVelocity: boolean = true
    ) => {
      'worklet';
      // Cancel any running animation immediately
      cancelAnimation(value);

      // Build spring config
      const baseConfig = toSpringConfig(fluidSprings[spring]);
      const config: WithSpringConfig = {
        ...baseConfig,
        velocity: preserveVelocity ? velocity.value : 0,
      };

      // Start spring animation
      value.value = withSpring(target, config, (finished) => {
        if (finished) {
          velocity.value = 0;
        }
      });
    },
    []
  );

  const setImmediately = useCallback((target: number) => {
    'worklet';
    cancelAnimation(value);
    value.value = target;
    velocity.value = 0;
  }, []);

  const cancel = useCallback(() => {
    'worklet';
    cancelAnimation(value);
    velocity.value = 0;
  }, []);

  const redirect = useCallback(
    (target: number, spring: FluidSpringPreset = 'momentum') => {
      'worklet';
      // Redirect is just animateTo with velocity preserved
      cancelAnimation(value);

      const baseConfig = toSpringConfig(fluidSprings[spring]);
      const config: WithSpringConfig = {
        ...baseConfig,
        velocity: velocity.value, // Always preserve velocity for redirects
      };

      value.value = withSpring(target, config, (finished) => {
        if (finished) {
          velocity.value = 0;
        }
      });
    },
    []
  );

  return {
    value,
    velocity,
    animateTo,
    setImmediately,
    cancel,
    redirect,
  };
}

// ============================================================================
// 2D FLUID VALUE
// ============================================================================

/**
 * Create an interruptible 2D animated position
 *
 * @param initialX - Starting X coordinate
 * @param initialY - Starting Y coordinate
 * @returns 2D fluid value controls
 *
 * @example
 * ```tsx
 * const position = useFluidValue2D(0, 0);
 *
 * // In pan gesture
 * .onUpdate((e) => {
 *   position.x.value = e.translationX;
 *   position.y.value = e.translationY;
 *   position.velocityX.value = e.velocityX;
 *   position.velocityY.value = e.velocityY;
 * })
 * .onEnd(() => {
 *   position.animateTo(snapX, snapY, 'momentum');
 * })
 * ```
 */
export function useFluidValue2D(
  initialX: number,
  initialY: number
): FluidValue2DResult {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);

  const animateTo = useCallback(
    (
      targetX: number,
      targetY: number,
      spring: FluidSpringPreset = 'smooth',
      preserveVelocity: boolean = true
    ) => {
      'worklet';
      cancelAnimation(x);
      cancelAnimation(y);

      const baseConfig = toSpringConfig(fluidSprings[spring]);

      const configX: WithSpringConfig = {
        ...baseConfig,
        velocity: preserveVelocity ? velocityX.value : 0,
      };
      const configY: WithSpringConfig = {
        ...baseConfig,
        velocity: preserveVelocity ? velocityY.value : 0,
      };

      x.value = withSpring(targetX, configX, (finished) => {
        if (finished) velocityX.value = 0;
      });
      y.value = withSpring(targetY, configY, (finished) => {
        if (finished) velocityY.value = 0;
      });
    },
    []
  );

  const setImmediately = useCallback((newX: number, newY: number) => {
    'worklet';
    cancelAnimation(x);
    cancelAnimation(y);
    x.value = newX;
    y.value = newY;
    velocityX.value = 0;
    velocityY.value = 0;
  }, []);

  const cancel = useCallback(() => {
    'worklet';
    cancelAnimation(x);
    cancelAnimation(y);
    velocityX.value = 0;
    velocityY.value = 0;
  }, []);

  const redirect = useCallback(
    (targetX: number, targetY: number, spring: FluidSpringPreset = 'momentum') => {
      'worklet';
      cancelAnimation(x);
      cancelAnimation(y);

      const baseConfig = toSpringConfig(fluidSprings[spring]);

      const configX: WithSpringConfig = {
        ...baseConfig,
        velocity: velocityX.value,
      };
      const configY: WithSpringConfig = {
        ...baseConfig,
        velocity: velocityY.value,
      };

      x.value = withSpring(targetX, configX, (finished) => {
        if (finished) velocityX.value = 0;
      });
      y.value = withSpring(targetY, configY, (finished) => {
        if (finished) velocityY.value = 0;
      });
    },
    []
  );

  return {
    x,
    y,
    velocityX,
    velocityY,
    animateTo,
    setImmediately,
    cancel,
    redirect,
  };
}

// ============================================================================
// WORKLET-ONLY UTILITIES
// ============================================================================

/**
 * Worklet function to animate a shared value with fluid spring
 * Use when you need direct control within a gesture handler
 */
export function fluidAnimateToWorklet(
  value: SharedValue<number>,
  target: number,
  dampingRatio: number,
  response: number,
  velocity: number = 0
): void {
  'worklet';
  cancelAnimation(value);

  const stiffness = Math.pow((2 * Math.PI) / response, 2);
  const damping = (4 * Math.PI * dampingRatio) / response;

  value.value = withSpring(target, {
    damping,
    stiffness,
    mass: 1,
    velocity,
  });
}

/**
 * Create a spring config worklet for use in gesture handlers
 */
export function createSpringConfigWorklet(
  dampingRatio: number,
  response: number,
  velocity: number = 0
): WithSpringConfig {
  'worklet';
  const stiffness = Math.pow((2 * Math.PI) / response, 2);
  const damping = (4 * Math.PI * dampingRatio) / response;

  return {
    damping,
    stiffness,
    mass: 1,
    velocity,
  };
}

export default {
  useFluidValue,
  useFluidValue2D,
  fluidAnimateToWorklet,
  createSpringConfigWorklet,
};
