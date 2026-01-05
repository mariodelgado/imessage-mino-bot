/**
 * Fluid Gesture Utilities
 *
 * Momentum-aware gesture handling based on Apple's WWDC 2018 principles.
 *
 * Key insight from Apple:
 * "Take the velocity of the PIP when thrown, mix in deceleration rate,
 *  and you get the projected position."
 *
 * This enables gestures that feel like natural extensions of movement,
 * where the interface anticipates where you want to go based on momentum.
 */

// ============================================================================
// DECELERATION RATES
// ============================================================================

/**
 * Standard iOS deceleration rates
 * These match UIScrollView behavior for familiar feel
 */
export const DecelerationRate = {
  /** UIScrollView default - smooth, natural coasting */
  normal: 0.998,

  /** Snappier scrolling - faster stop, more responsive */
  fast: 0.99,

  /** Gentle coast - longer travel, floaty feel */
  slow: 0.999,
} as const;

export type DecelerationRateType = keyof typeof DecelerationRate;

// ============================================================================
// VELOCITY PROJECTION
// ============================================================================

/**
 * Project where a value will land given velocity and deceleration
 *
 * Physics: How far will content travel before stopping?
 * Uses exponential decay formula matching iOS scrolling.
 *
 * @param initialVelocity - Current velocity in points/second
 * @param decelerationRate - Rate of deceleration (0-1, higher = slower stop)
 * @returns Distance that will be traveled before stopping
 */
export function project(
  initialVelocity: number,
  decelerationRate: number = DecelerationRate.normal
): number {
  // Formula: velocity × rate / (1 - rate)
  // This calculates distance based on exponential decay
  return (initialVelocity * decelerationRate) / (1 - decelerationRate);
}

/**
 * Worklet version for use in gesture handlers
 */
export function projectWorklet(
  initialVelocity: number,
  decelerationRate: number = 0.998
): number {
  'worklet';
  return (initialVelocity * decelerationRate) / (1 - decelerationRate);
}

// ============================================================================
// SNAP POINT PROJECTION
// ============================================================================

/**
 * Find the nearest snap point considering momentum
 *
 * Instead of snapping to the closest point from current position,
 * we project where the gesture is GOING and snap to that.
 *
 * @param currentValue - Current position
 * @param velocity - Current velocity
 * @param snapPoints - Array of possible snap destinations
 * @param decelerationRate - Deceleration rate to use
 * @returns The snap point that best matches intended destination
 */
export function projectToNearestSnapPoint(
  currentValue: number,
  velocity: number,
  snapPoints: number[],
  decelerationRate: number = DecelerationRate.normal
): number {
  // Project to where the gesture is heading
  const projectedValue = currentValue + project(velocity, decelerationRate);

  // Find nearest snap point to projected position
  return snapPoints.reduce((nearest, point) =>
    Math.abs(point - projectedValue) < Math.abs(nearest - projectedValue)
      ? point
      : nearest
  );
}

/**
 * Worklet version for gesture handlers
 */
export function projectToNearestSnapPointWorklet(
  currentValue: number,
  velocity: number,
  snapPoints: readonly number[],
  decelerationRate: number = 0.998
): number {
  'worklet';
  const projectedValue = currentValue + projectWorklet(velocity, decelerationRate);

  let nearest = snapPoints[0];
  let nearestDistance = Math.abs(snapPoints[0] - projectedValue);

  for (let i = 1; i < snapPoints.length; i++) {
    const distance = Math.abs(snapPoints[i] - projectedValue);
    if (distance < nearestDistance) {
      nearest = snapPoints[i];
      nearestDistance = distance;
    }
  }

  return nearest;
}

// ============================================================================
// 2D PROJECTION
// ============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface Velocity2D {
  x: number;
  y: number;
}

/**
 * 2D projection for draggable elements
 * Projects both X and Y coordinates based on velocity
 */
export function project2D(
  position: Point2D,
  velocity: Velocity2D,
  decelerationRate: number = DecelerationRate.normal
): Point2D {
  return {
    x: position.x + project(velocity.x, decelerationRate),
    y: position.y + project(velocity.y, decelerationRate),
  };
}

/**
 * Worklet version for gesture handlers
 */
export function project2DWorklet(
  posX: number,
  posY: number,
  velX: number,
  velY: number,
  decelerationRate: number = 0.998
): { x: number; y: number } {
  'worklet';
  return {
    x: posX + projectWorklet(velX, decelerationRate),
    y: posY + projectWorklet(velY, decelerationRate),
  };
}

// ============================================================================
// CORNER SNAP (for Picture-in-Picture style elements)
// ============================================================================

export interface ScreenBounds {
  width: number;
  height: number;
  padding?: number;
}

export interface Corner {
  x: number;
  y: number;
  name: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

/**
 * Calculate corner positions for PIP-style snapping
 */
export function getCornerSnapPoints(
  bounds: ScreenBounds,
  itemWidth: number,
  itemHeight: number
): Corner[] {
  const padding = bounds.padding ?? 16;
  const safeWidth = bounds.width - padding * 2 - itemWidth;
  const safeHeight = bounds.height - padding * 2 - itemHeight;

  return [
    { x: padding, y: padding, name: 'topLeft' },
    { x: padding + safeWidth, y: padding, name: 'topRight' },
    { x: padding, y: padding + safeHeight, name: 'bottomLeft' },
    { x: padding + safeWidth, y: padding + safeHeight, name: 'bottomRight' },
  ];
}

/**
 * Find nearest corner considering velocity
 */
export function projectToNearestCorner(
  position: Point2D,
  velocity: Velocity2D,
  corners: Corner[],
  decelerationRate: number = DecelerationRate.normal
): Corner {
  const projected = project2D(position, velocity, decelerationRate);

  return corners.reduce((nearest, corner) => {
    const nearestDist = Math.sqrt(
      Math.pow(nearest.x - projected.x, 2) + Math.pow(nearest.y - projected.y, 2)
    );
    const cornerDist = Math.sqrt(
      Math.pow(corner.x - projected.x, 2) + Math.pow(corner.y - projected.y, 2)
    );
    return cornerDist < nearestDist ? corner : nearest;
  });
}

// ============================================================================
// GESTURE INTENT DETECTION
// ============================================================================

/**
 * Detect gesture intent from velocity characteristics
 *
 * From Apple: "There's a huge spike in acceleration when you pause.
 * The faster you stop, the faster we can detect it."
 */
export type GestureIntent =
  | 'scroll'
  | 'swipe'
  | 'tap'
  | 'longPress'
  | 'pause'
  | 'flick'
  | 'drag';

interface GestureMetrics {
  velocity: Velocity2D;
  acceleration?: Velocity2D;
  duration: number;
  distance: number;
}

export function detectIntent(metrics: GestureMetrics): GestureIntent {
  const speed = Math.sqrt(
    metrics.velocity.x ** 2 + metrics.velocity.y ** 2
  );

  const accel = metrics.acceleration
    ? Math.sqrt(metrics.acceleration.x ** 2 + metrics.acceleration.y ** 2)
    : 0;

  // High deceleration = pause (finger stopped mid-gesture)
  if (accel > 5000 && speed < 100) {
    return 'pause';
  }

  // High velocity, short duration = flick
  if (speed > 1500 && metrics.duration < 200) {
    return 'flick';
  }

  // Moderate velocity = swipe
  if (speed > 500) {
    return 'swipe';
  }

  // Slow with distance = drag
  if (metrics.distance > 20 && speed < 500) {
    return 'drag';
  }

  // Minimal movement = tap or long press
  if (metrics.distance < 10) {
    return metrics.duration > 500 ? 'longPress' : 'tap';
  }

  return 'scroll';
}

// ============================================================================
// ACCELERATION TRACKING
// ============================================================================

/**
 * Track acceleration (rate of velocity change)
 * Returns a function that calculates acceleration from current velocity
 */
export function createAccelerationTracker() {
  let lastVelocity = { x: 0, y: 0, time: Date.now() };

  return (currentVelocity: Velocity2D): Velocity2D => {
    const now = Date.now();
    const dt = (now - lastVelocity.time) / 1000;

    if (dt === 0) return { x: 0, y: 0 };

    const acceleration = {
      x: (currentVelocity.x - lastVelocity.x) / dt,
      y: (currentVelocity.y - lastVelocity.y) / dt,
    };

    lastVelocity = { ...currentVelocity, time: now };
    return acceleration;
  };
}

// ============================================================================
// GESTURE DIRECTION
// ============================================================================

export type GestureDirection = 'up' | 'down' | 'left' | 'right' | 'none';

/**
 * Determine primary gesture direction from velocity
 */
export function getGestureDirection(velocity: Velocity2D): GestureDirection {
  const threshold = 50; // Minimum velocity to register direction

  if (Math.abs(velocity.x) < threshold && Math.abs(velocity.y) < threshold) {
    return 'none';
  }

  if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
    return velocity.x > 0 ? 'right' : 'left';
  } else {
    return velocity.y > 0 ? 'down' : 'up';
  }
}

/**
 * Worklet version for gesture handlers
 */
export function getGestureDirectionWorklet(
  velX: number,
  velY: number
): GestureDirection {
  'worklet';
  const threshold = 50;

  if (Math.abs(velX) < threshold && Math.abs(velY) < threshold) {
    return 'none';
  }

  if (Math.abs(velX) > Math.abs(velY)) {
    return velX > 0 ? 'right' : 'left';
  } else {
    return velY > 0 ? 'down' : 'up';
  }
}

// ============================================================================
// VELOCITY MAGNITUDE
// ============================================================================

/**
 * Calculate velocity magnitude (speed)
 */
export function getSpeed(velocity: Velocity2D): number {
  return Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
}

/**
 * Worklet version
 */
export function getSpeedWorklet(velX: number, velY: number): number {
  'worklet';
  return Math.sqrt(velX * velX + velY * velY);
}

/**
 * Check if velocity exceeds threshold (is a "flick")
 */
export function isFlick(velocity: Velocity2D, threshold: number = 1000): boolean {
  return getSpeed(velocity) > threshold;
}

/**
 * Worklet version
 */
export function isFlickWorklet(
  velX: number,
  velY: number,
  threshold: number = 1000
): boolean {
  'worklet';
  return getSpeedWorklet(velX, velY) > threshold;
}

export default {
  DecelerationRate,
  project,
  projectWorklet,
  projectToNearestSnapPoint,
  projectToNearestSnapPointWorklet,
  project2D,
  project2DWorklet,
  getCornerSnapPoints,
  projectToNearestCorner,
  detectIntent,
  createAccelerationTracker,
  getGestureDirection,
  getGestureDirectionWorklet,
  getSpeed,
  getSpeedWorklet,
  isFlick,
  isFlickWorklet,
};
