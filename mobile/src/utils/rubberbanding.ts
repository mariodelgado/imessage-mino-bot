/**
 * Rubberbanding System
 *
 * Soft boundaries that gracefully indicate limits.
 *
 * From Apple WWDC 2018:
 * "The interface is gradually and softly letting you know there's nothing there.
 *  It's tracking you throughout."
 *
 * This creates that satisfying "stretchy" feeling when you pull past the edge
 * of scrollable content, or drag something beyond its allowed bounds.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** iOS default rubberband coefficient - proven to feel natural */
export const RUBBERBAND_COEFFICIENT = 0.55;

/** Slightly tighter resistance for more controlled elements */
export const RUBBERBAND_TIGHT = 0.35;

/** Looser resistance for more playful elements */
export const RUBBERBAND_LOOSE = 0.7;

// ============================================================================
// CORE RUBBERBANDING
// ============================================================================

/**
 * Apply rubberband resistance to a value that exceeds bounds
 *
 * When dragging past a boundary, movement gradually diminishes
 * using a logarithmic decay that creates the "stretchy" feel.
 *
 * @param offset - How far past the boundary (positive or negative)
 * @param limit - The total size/range of the bounded area
 * @param coefficient - Resistance factor (0-1, lower = more resistance)
 * @returns The rubberbanded value
 */
export function rubberband(
  offset: number,
  limit: number,
  coefficient: number = RUBBERBAND_COEFFICIENT
): number {
  // If within bounds, return as-is (no resistance)
  if (Math.abs(offset) <= 0) return offset;

  const sign = offset < 0 ? -1 : 1;
  const absOffset = Math.abs(offset);

  // Logarithmic decay creates the "stretchy" feel
  // Formula: limit × coefficient × ln(1 + absOffset / (coefficient × limit))
  const resistance =
    limit * coefficient * Math.log(1 + absOffset / (coefficient * limit));

  return sign * resistance;
}

/**
 * Worklet version for use in gesture handlers
 */
export function rubberbandWorklet(
  offset: number,
  limit: number,
  coefficient: number = 0.55
): number {
  'worklet';
  if (Math.abs(offset) <= 0) return offset;

  const sign = offset < 0 ? -1 : 1;
  const absOffset = Math.abs(offset);
  const resistance =
    limit * coefficient * Math.log(1 + absOffset / (coefficient * limit));

  return sign * resistance;
}

// ============================================================================
// CLAMPED RUBBERBANDING
// ============================================================================

/**
 * Apply rubberbanding within a specific range [min, max]
 *
 * Values within range pass through unchanged.
 * Values outside range get rubberband resistance applied.
 *
 * @param value - Current value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param coefficient - Resistance factor
 * @returns Value with rubberbanding applied if outside bounds
 */
export function rubberbandClamp(
  value: number,
  min: number,
  max: number,
  coefficient: number = RUBBERBAND_COEFFICIENT
): number {
  const range = max - min;

  if (value < min) {
    // Pulling past minimum
    const overscroll = min - value;
    return min - rubberband(overscroll, range, coefficient);
  }

  if (value > max) {
    // Pulling past maximum
    const overscroll = value - max;
    return max + rubberband(overscroll, range, coefficient);
  }

  // Within bounds
  return value;
}

/**
 * Worklet version for gesture handlers
 */
export function rubberbandClampWorklet(
  value: number,
  min: number,
  max: number,
  coefficient: number = 0.55
): number {
  'worklet';
  const range = max - min;

  if (value < min) {
    const overscroll = min - value;
    return min - rubberbandWorklet(overscroll, range, coefficient);
  }

  if (value > max) {
    const overscroll = value - max;
    return max + rubberbandWorklet(overscroll, range, coefficient);
  }

  return value;
}

// ============================================================================
// 2D RUBBERBANDING
// ============================================================================

export interface Bounds2D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RubberbandPoint {
  x: number;
  y: number;
}

/**
 * Apply rubberbanding to a 2D point within bounds
 */
export function rubberbandClamp2D(
  point: RubberbandPoint,
  bounds: Bounds2D,
  coefficient: number = RUBBERBAND_COEFFICIENT
): RubberbandPoint {
  return {
    x: rubberbandClamp(point.x, bounds.minX, bounds.maxX, coefficient),
    y: rubberbandClamp(point.y, bounds.minY, bounds.maxY, coefficient),
  };
}

/**
 * Worklet version for gesture handlers
 */
export function rubberbandClamp2DWorklet(
  x: number,
  y: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  coefficient: number = 0.55
): { x: number; y: number } {
  'worklet';
  return {
    x: rubberbandClampWorklet(x, minX, maxX, coefficient),
    y: rubberbandClampWorklet(y, minY, maxY, coefficient),
  };
}

// ============================================================================
// EDGE DETECTION
// ============================================================================

export type Edge = 'none' | 'top' | 'bottom' | 'left' | 'right';

/**
 * Detect which edge is being pulled (if any)
 */
export function detectEdge(
  value: number,
  min: number,
  max: number,
  direction: 'horizontal' | 'vertical'
): Edge {
  if (value < min) {
    return direction === 'horizontal' ? 'left' : 'top';
  }
  if (value > max) {
    return direction === 'horizontal' ? 'right' : 'bottom';
  }
  return 'none';
}

/**
 * Worklet version
 */
export function detectEdgeWorklet(
  value: number,
  min: number,
  max: number,
  isHorizontal: boolean
): Edge {
  'worklet';
  if (value < min) {
    return isHorizontal ? 'left' : 'top';
  }
  if (value > max) {
    return isHorizontal ? 'right' : 'bottom';
  }
  return 'none';
}

// ============================================================================
// OVERSCROLL AMOUNT
// ============================================================================

/**
 * Calculate how much a value is beyond bounds
 * Positive = past max, Negative = past min, Zero = within bounds
 */
export function getOverscroll(value: number, min: number, max: number): number {
  if (value < min) return value - min;
  if (value > max) return value - max;
  return 0;
}

/**
 * Worklet version
 */
export function getOverscrollWorklet(
  value: number,
  min: number,
  max: number
): number {
  'worklet';
  if (value < min) return value - min;
  if (value > max) return value - max;
  return 0;
}

/**
 * Check if value is beyond bounds
 */
export function isOverscrolling(value: number, min: number, max: number): boolean {
  return value < min || value > max;
}

/**
 * Worklet version
 */
export function isOverscrollingWorklet(
  value: number,
  min: number,
  max: number
): boolean {
  'worklet';
  return value < min || value > max;
}

// ============================================================================
// RESISTANCE CURVES
// ============================================================================

/**
 * Calculate current resistance factor based on how far past bounds
 * Returns 0-1 where 0 = no resistance, 1 = maximum resistance
 */
export function getResistanceFactor(
  offset: number,
  limit: number,
  coefficient: number = RUBBERBAND_COEFFICIENT
): number {
  if (offset === 0) return 0;

  const absOffset = Math.abs(offset);
  const rubberbanded = rubberband(absOffset, limit, coefficient);

  // Resistance is how much the rubberbanding is "eating" our movement
  return 1 - rubberbanded / absOffset;
}

/**
 * Worklet version
 */
export function getResistanceFactorWorklet(
  offset: number,
  limit: number,
  coefficient: number = 0.55
): number {
  'worklet';
  if (offset === 0) return 0;

  const absOffset = Math.abs(offset);
  const rubberbanded = rubberbandWorklet(absOffset, limit, coefficient);

  return 1 - rubberbanded / absOffset;
}

// ============================================================================
// VELOCITY-ADJUSTED RUBBERBANDING
// ============================================================================

/**
 * Adjust coefficient based on velocity
 * Higher velocity = slightly less resistance for momentum feel
 */
export function velocityAdjustedCoefficient(
  baseCoefficient: number,
  velocity: number,
  maxVelocity: number = 2000
): number {
  const velocityFactor = Math.min(Math.abs(velocity) / maxVelocity, 1);
  // At max velocity, coefficient increases by up to 20%
  return baseCoefficient + velocityFactor * 0.2 * baseCoefficient;
}

/**
 * Worklet version
 */
export function velocityAdjustedCoefficientWorklet(
  baseCoefficient: number,
  velocity: number,
  maxVelocity: number = 2000
): number {
  'worklet';
  const velocityFactor = Math.min(Math.abs(velocity) / maxVelocity, 1);
  return baseCoefficient + velocityFactor * 0.2 * baseCoefficient;
}

// ============================================================================
// SNAP BACK CALCULATION
// ============================================================================

/**
 * Calculate the target value to snap back to when released beyond bounds
 */
export function getSnapBackTarget(
  value: number,
  min: number,
  max: number
): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Worklet version
 */
export function getSnapBackTargetWorklet(
  value: number,
  min: number,
  max: number
): number {
  'worklet';
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export default {
  RUBBERBAND_COEFFICIENT,
  RUBBERBAND_TIGHT,
  RUBBERBAND_LOOSE,
  rubberband,
  rubberbandWorklet,
  rubberbandClamp,
  rubberbandClampWorklet,
  rubberbandClamp2D,
  rubberbandClamp2DWorklet,
  detectEdge,
  detectEdgeWorklet,
  getOverscroll,
  getOverscrollWorklet,
  isOverscrolling,
  isOverscrollingWorklet,
  getResistanceFactor,
  getResistanceFactorWorklet,
  velocityAdjustedCoefficient,
  velocityAdjustedCoefficientWorklet,
  getSnapBackTarget,
  getSnapBackTargetWorklet,
};
