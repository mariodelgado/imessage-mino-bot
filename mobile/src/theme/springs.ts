/**
 * Fluid Spring Physics System
 *
 * Apple-style spring physics using damping ratio + response time model.
 * Based on WWDC 2018: "Designing Fluid Interfaces"
 *
 * This simplified model is more intuitive than raw damping/stiffness/mass:
 * - dampingRatio: 0 = infinite oscillation, 1 = no overshoot, >1 = overdamped
 * - response: How quickly the spring moves toward target (seconds)
 *
 * Key insight from Apple:
 * "We avoid using the word 'duration' - it reinforces constant dynamic change.
 *  The spring is always moving, ready to move somewhere else."
 */

// ============================================================================
// FLUID SPRING PRESETS
// ============================================================================

export interface FluidSpring {
  dampingRatio: number;
  response: number;
}

/**
 * Apple-style spring presets organized by purpose
 */
export const fluidSprings = {
  // ─────────────────────────────────────────────────────────────────────────
  // NO OVERSHOOT - For utility animations where precision matters
  // ─────────────────────────────────────────────────────────────────────────

  /** Snappy utility animations - toggles, switches */
  instant: { dampingRatio: 1, response: 0.2 } as FluidSpring,

  /** Quick feedback - button presses, selections */
  quick: { dampingRatio: 1, response: 0.3 } as FluidSpring,

  /** Smooth transitions - content fades, opacity changes */
  smooth: { dampingRatio: 1, response: 0.4 } as FluidSpring,

  // ─────────────────────────────────────────────────────────────────────────
  // SUBTLE OVERSHOOT - For momentum gestures that feel connected
  // ─────────────────────────────────────────────────────────────────────────

  /** Momentum-carrying gestures - swipes with velocity */
  momentum: { dampingRatio: 0.8, response: 0.4 } as FluidSpring,

  /** Quick flicks - fast swipes, dismissals */
  flick: { dampingRatio: 0.75, response: 0.35 } as FluidSpring,

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYFUL BOUNCE - For discovery and teaching moments
  // ─────────────────────────────────────────────────────────────────────────

  /** Bouncy feedback - indicates more action possible */
  bouncy: { dampingRatio: 0.65, response: 0.5 } as FluidSpring,

  /** Playful interactions - discovery, tutorials */
  playful: { dampingRatio: 0.6, response: 0.6 } as FluidSpring,

  // ─────────────────────────────────────────────────────────────────────────
  // DRAMATIC / HEAVY - For significant transitions
  // ─────────────────────────────────────────────────────────────────────────

  /** Dramatic emphasis - important state changes */
  dramatic: { dampingRatio: 0.7, response: 0.8 } as FluidSpring,

  /** Heavy objects - panels, sheets, modals */
  heavy: { dampingRatio: 0.85, response: 0.6 } as FluidSpring,

  // ─────────────────────────────────────────────────────────────────────────
  // MERCURYOS INSPIRED - "Way of Inexertion"
  // ─────────────────────────────────────────────────────────────────────────

  /** Inexertion - starts fast, settles slowly into equilibrium */
  inexertion: { dampingRatio: 0.85, response: 0.5 } as FluidSpring,

  /** Kiri (霧) fog aesthetic - soft, ethereal movement */
  kiri: { dampingRatio: 0.9, response: 0.7 } as FluidSpring,
} as const;

export type FluidSpringPreset = keyof typeof fluidSprings;

// ============================================================================
// SPRING CONVERSION UTILITIES
// ============================================================================

/**
 * Convert damping ratio + response to Reanimated spring config
 *
 * Mathematical basis:
 * - stiffness = (2π / response)²
 * - damping = 4π × dampingRatio / response
 *
 * This produces spring configs that feel natural and predictable.
 */
export function toSpringConfig(spring: FluidSpring): {
  damping: number;
  stiffness: number;
  mass: number;
} {
  const stiffness = Math.pow((2 * Math.PI) / spring.response, 2);
  const damping = (4 * Math.PI * spring.dampingRatio) / spring.response;

  return {
    damping,
    stiffness,
    mass: 1,
  };
}

/**
 * Get Reanimated spring config from preset name
 */
export function getSpringConfig(preset: FluidSpringPreset) {
  return toSpringConfig(fluidSprings[preset]);
}

/**
 * Create custom spring with velocity preservation
 * Use when redirecting an animation mid-flight
 */
export function toSpringConfigWithVelocity(
  spring: FluidSpring,
  velocity: number
): {
  damping: number;
  stiffness: number;
  mass: number;
  velocity: number;
} {
  return {
    ...toSpringConfig(spring),
    velocity,
  };
}

// ============================================================================
// WORKLET-COMPATIBLE VERSIONS
// ============================================================================

/**
 * Worklet version of toSpringConfig for use in gesture handlers
 */
export function toSpringConfigWorklet(dampingRatio: number, response: number) {
  'worklet';
  const stiffness = Math.pow((2 * Math.PI) / response, 2);
  const damping = (4 * Math.PI * dampingRatio) / response;

  return {
    damping,
    stiffness,
    mass: 1,
  };
}

// ============================================================================
// SPRING BLENDING
// ============================================================================

/**
 * Blend between two springs based on a factor (0-1)
 * Useful for gesture-driven spring changes
 */
export function blendSprings(
  springA: FluidSpring,
  springB: FluidSpring,
  factor: number
): FluidSpring {
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return {
    dampingRatio:
      springA.dampingRatio + (springB.dampingRatio - springA.dampingRatio) * clampedFactor,
    response: springA.response + (springB.response - springA.response) * clampedFactor,
  };
}

/**
 * Worklet version for blending springs in gesture handlers
 */
export function blendSpringsWorklet(
  dampingA: number,
  responseA: number,
  dampingB: number,
  responseB: number,
  factor: number
) {
  'worklet';
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return {
    dampingRatio: dampingA + (dampingB - dampingA) * clampedFactor,
    response: responseA + (responseB - responseA) * clampedFactor,
  };
}

// ============================================================================
// VELOCITY-AWARE SPRING SELECTION
// ============================================================================

/**
 * Select appropriate spring based on velocity magnitude
 * Higher velocity = more bounce to preserve momentum feel
 */
export function springForVelocity(velocity: number): FluidSpring {
  const absVelocity = Math.abs(velocity);

  if (absVelocity > 2000) {
    return fluidSprings.flick;
  } else if (absVelocity > 1000) {
    return fluidSprings.momentum;
  } else if (absVelocity > 500) {
    return fluidSprings.quick;
  } else {
    return fluidSprings.smooth;
  }
}

/**
 * Worklet version for use in gesture handlers
 */
export function springForVelocityWorklet(velocity: number) {
  'worklet';
  const absVelocity = Math.abs(velocity);

  if (absVelocity > 2000) {
    // flick
    return { dampingRatio: 0.75, response: 0.35 };
  } else if (absVelocity > 1000) {
    // momentum
    return { dampingRatio: 0.8, response: 0.4 };
  } else if (absVelocity > 500) {
    // quick
    return { dampingRatio: 1, response: 0.3 };
  } else {
    // smooth
    return { dampingRatio: 1, response: 0.4 };
  }
}

export default fluidSprings;
