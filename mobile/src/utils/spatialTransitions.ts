/**
 * Spatial Transitions System
 *
 * Ensures enter/exit animations follow consistent spatial logic.
 *
 * Key insight from Apple WWDC 2018:
 * "If something disappears one way, we expect it to emerge from where it came."
 *
 * This creates predictable, spatially-consistent transitions that match
 * the user's mental model of where elements exist in space.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TransitionDirection =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'center'
  | 'none';

export interface TransformState {
  translateX: number;
  translateY: number;
  scale: number;
  opacity: number;
}

export interface SpatialOrigin {
  direction: TransitionDirection;
  /** Optional specific X coordinate for custom origins */
  x?: number;
  /** Optional specific Y coordinate for custom origins */
  y?: number;
}

// ============================================================================
// SPATIAL REGISTRY
// ============================================================================

/**
 * Registry to track where elements came from
 * Used to ensure they exit back to their origin
 */
class SpatialRegistryClass {
  private origins = new Map<string, SpatialOrigin>();

  /**
   * Record where an element came from
   */
  setOrigin(id: string, origin: SpatialOrigin): void {
    this.origins.set(id, origin);
  }

  /**
   * Get the origin for an element
   */
  getOrigin(id: string): SpatialOrigin {
    return this.origins.get(id) || { direction: 'center' };
  }

  /**
   * Get just the direction
   */
  getDirection(id: string): TransitionDirection {
    return this.getOrigin(id).direction;
  }

  /**
   * Clear origin when element is fully dismissed
   */
  clear(id: string): void {
    this.origins.delete(id);
  }

  /**
   * Clear all origins (e.g., on navigation reset)
   */
  clearAll(): void {
    this.origins.clear();
  }

  /**
   * Check if origin is registered
   */
  has(id: string): boolean {
    return this.origins.has(id);
  }
}

export const SpatialRegistry = new SpatialRegistryClass();

// ============================================================================
// TRANSFORM PRESETS
// ============================================================================

/**
 * Standard transition distances
 */
const TRANSITION_DISTANCE = {
  horizontal: 100,
  vertical: 50,
  scale: 0.9,
};

/**
 * Get the initial (offscreen) transform for entering from a direction
 */
export function getEnterTransform(direction: TransitionDirection): TransformState {
  switch (direction) {
    case 'left':
      return {
        translateX: -TRANSITION_DISTANCE.horizontal,
        translateY: 0,
        scale: 1,
        opacity: 0,
      };
    case 'right':
      return {
        translateX: TRANSITION_DISTANCE.horizontal,
        translateY: 0,
        scale: 1,
        opacity: 0,
      };
    case 'up':
      return {
        translateX: 0,
        translateY: -TRANSITION_DISTANCE.vertical,
        scale: 1,
        opacity: 0,
      };
    case 'down':
      return {
        translateX: 0,
        translateY: TRANSITION_DISTANCE.vertical,
        scale: 1,
        opacity: 0,
      };
    case 'center':
      return {
        translateX: 0,
        translateY: 0,
        scale: TRANSITION_DISTANCE.scale,
        opacity: 0,
      };
    case 'none':
    default:
      return {
        translateX: 0,
        translateY: 0,
        scale: 1,
        opacity: 1,
      };
  }
}

/**
 * Get the visible (onscreen) transform
 */
export function getVisibleTransform(): TransformState {
  return {
    translateX: 0,
    translateY: 0,
    scale: 1,
    opacity: 1,
  };
}

/**
 * Get the exit transform (same as enter - goes back to origin)
 */
export function getExitTransform(direction: TransitionDirection): TransformState {
  // Exit is symmetric with enter - element goes back to where it came from
  return getEnterTransform(direction);
}

// ============================================================================
// DIRECTION UTILITIES
// ============================================================================

/**
 * Get the opposite direction (for symmetric transitions)
 */
export function getOppositeDirection(
  direction: TransitionDirection
): TransitionDirection {
  switch (direction) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    default:
      return direction;
  }
}

/**
 * Determine direction based on position relative to center
 */
export function directionFromPosition(
  x: number,
  y: number,
  centerX: number,
  centerY: number
): TransitionDirection {
  const dx = x - centerX;
  const dy = y - centerY;

  // If very close to center, use center transition
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
    return 'center';
  }

  // Determine primary axis
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  } else {
    return dy < 0 ? 'up' : 'down';
  }
}

/**
 * Determine direction based on velocity (for gesture-driven transitions)
 */
export function directionFromVelocity(
  velocityX: number,
  velocityY: number,
  threshold: number = 100
): TransitionDirection {
  const absX = Math.abs(velocityX);
  const absY = Math.abs(velocityY);

  // If velocity is too low, no clear direction
  if (absX < threshold && absY < threshold) {
    return 'none';
  }

  // Determine primary direction from velocity
  if (absX > absY) {
    return velocityX < 0 ? 'left' : 'right';
  } else {
    return velocityY < 0 ? 'up' : 'down';
  }
}

// ============================================================================
// INTERPOLATION HELPERS
// ============================================================================

/**
 * Interpolate between two transform states
 */
export function interpolateTransform(
  from: TransformState,
  to: TransformState,
  progress: number
): TransformState {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return {
    translateX: from.translateX + (to.translateX - from.translateX) * clampedProgress,
    translateY: from.translateY + (to.translateY - from.translateY) * clampedProgress,
    scale: from.scale + (to.scale - from.scale) * clampedProgress,
    opacity: from.opacity + (to.opacity - from.opacity) * clampedProgress,
  };
}

/**
 * Worklet version for gesture handlers
 */
export function interpolateTransformWorklet(
  fromTranslateX: number,
  fromTranslateY: number,
  fromScale: number,
  fromOpacity: number,
  toTranslateX: number,
  toTranslateY: number,
  toScale: number,
  toOpacity: number,
  progress: number
): TransformState {
  'worklet';
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return {
    translateX: fromTranslateX + (toTranslateX - fromTranslateX) * clampedProgress,
    translateY: fromTranslateY + (toTranslateY - fromTranslateY) * clampedProgress,
    scale: fromScale + (toScale - fromScale) * clampedProgress,
    opacity: fromOpacity + (toOpacity - fromOpacity) * clampedProgress,
  };
}

// ============================================================================
// GESTURE-DRIVEN TRANSITION PROGRESS
// ============================================================================

/**
 * Calculate dismissal progress from gesture translation
 *
 * Returns 0-1 based on how far the gesture has moved toward dismissal
 */
export function getDismissProgress(
  direction: TransitionDirection,
  translationX: number,
  translationY: number,
  dismissThreshold: number = 150
): number {
  let progress = 0;

  switch (direction) {
    case 'left':
      progress = -translationX / dismissThreshold;
      break;
    case 'right':
      progress = translationX / dismissThreshold;
      break;
    case 'up':
      progress = -translationY / dismissThreshold;
      break;
    case 'down':
      progress = translationY / dismissThreshold;
      break;
    case 'center':
      // For center, use distance from center
      const distance = Math.sqrt(translationX ** 2 + translationY ** 2);
      progress = distance / dismissThreshold;
      break;
    default:
      progress = 0;
  }

  return Math.max(0, Math.min(1, progress));
}

/**
 * Worklet version
 */
export function getDismissProgressWorklet(
  direction: TransitionDirection,
  translationX: number,
  translationY: number,
  dismissThreshold: number = 150
): number {
  'worklet';
  let progress = 0;

  switch (direction) {
    case 'left':
      progress = -translationX / dismissThreshold;
      break;
    case 'right':
      progress = translationX / dismissThreshold;
      break;
    case 'up':
      progress = -translationY / dismissThreshold;
      break;
    case 'down':
      progress = translationY / dismissThreshold;
      break;
    case 'center':
      const distance = Math.sqrt(translationX * translationX + translationY * translationY);
      progress = distance / dismissThreshold;
      break;
    default:
      progress = 0;
  }

  return Math.max(0, Math.min(1, progress));
}

/**
 * Should dismiss based on progress and velocity
 */
export function shouldDismiss(
  progress: number,
  velocity: number,
  progressThreshold: number = 0.5,
  velocityThreshold: number = 500
): boolean {
  // Dismiss if progress exceeds threshold
  if (progress > progressThreshold) return true;

  // Dismiss if velocity is high enough in dismiss direction
  if (velocity > velocityThreshold && progress > 0.1) return true;

  return false;
}

/**
 * Worklet version
 */
export function shouldDismissWorklet(
  progress: number,
  velocity: number,
  progressThreshold: number = 0.5,
  velocityThreshold: number = 500
): boolean {
  'worklet';
  if (progress > progressThreshold) return true;
  if (velocity > velocityThreshold && progress > 0.1) return true;
  return false;
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Register an element's origin when navigating
 */
export function registerNavigation(
  elementId: string,
  fromDirection: TransitionDirection,
  coordinates?: { x: number; y: number }
): void {
  SpatialRegistry.setOrigin(elementId, {
    direction: fromDirection,
    x: coordinates?.x,
    y: coordinates?.y,
  });
}

/**
 * Get appropriate transition for a navigation
 */
export function getNavigationTransition(elementId: string): {
  entering: TransformState;
  visible: TransformState;
  exiting: TransformState;
} {
  const direction = SpatialRegistry.getDirection(elementId);

  return {
    entering: getEnterTransform(direction),
    visible: getVisibleTransform(),
    exiting: getExitTransform(direction),
  };
}

export default {
  SpatialRegistry,
  getEnterTransform,
  getVisibleTransform,
  getExitTransform,
  getOppositeDirection,
  directionFromPosition,
  directionFromVelocity,
  interpolateTransform,
  interpolateTransformWorklet,
  getDismissProgress,
  getDismissProgressWorklet,
  shouldDismiss,
  shouldDismissWorklet,
  registerNavigation,
  getNavigationTransition,
};
