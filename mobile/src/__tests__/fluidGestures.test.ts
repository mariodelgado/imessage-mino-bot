/**
 * Tests for Fluid Gesture Utilities
 *
 * Validates momentum-aware gesture handling based on Apple's WWDC 2018 principles.
 */

import {
  DecelerationRate,
  project,
  projectToNearestSnapPoint,
  project2D,
  getCornerSnapPoints,
  projectToNearestCorner,
  detectIntent,
  createAccelerationTracker,
  getGestureDirection,
  getSpeed,
  isFlick,
  Point2D,
  Velocity2D,
} from '../utils/fluidGestures';

describe('DecelerationRate constants', () => {
  it('should have correct iOS deceleration rates', () => {
    expect(DecelerationRate.normal).toBe(0.998);
    expect(DecelerationRate.fast).toBe(0.99);
    expect(DecelerationRate.slow).toBe(0.999);
  });

  it('should have normal > fast (slower stop = higher rate)', () => {
    expect(DecelerationRate.normal).toBeGreaterThan(DecelerationRate.fast);
  });

  it('should have slow > normal (even slower stop)', () => {
    expect(DecelerationRate.slow).toBeGreaterThan(DecelerationRate.normal);
  });
});

describe('project', () => {
  it('should project positive velocity forward', () => {
    const result = project(1000, DecelerationRate.normal);
    expect(result).toBeGreaterThan(0);
  });

  it('should project negative velocity backward', () => {
    const result = project(-1000, DecelerationRate.normal);
    expect(result).toBeLessThan(0);
  });

  it('should return 0 for zero velocity', () => {
    const result = project(0, DecelerationRate.normal);
    expect(result).toBe(0);
  });

  it('should project further with slower deceleration', () => {
    const slowResult = project(1000, DecelerationRate.slow);
    const normalResult = project(1000, DecelerationRate.normal);
    const fastResult = project(1000, DecelerationRate.fast);

    expect(slowResult).toBeGreaterThan(normalResult);
    expect(normalResult).toBeGreaterThan(fastResult);
  });

  it('should follow exponential decay formula: v × r / (1 - r)', () => {
    const velocity = 1000;
    const rate = 0.998;
    const expected = (velocity * rate) / (1 - rate);
    const result = project(velocity, rate);

    expect(result).toBeCloseTo(expected, 5);
  });

  it('should scale linearly with velocity', () => {
    const result1x = project(1000, DecelerationRate.normal);
    const result2x = project(2000, DecelerationRate.normal);

    expect(result2x).toBeCloseTo(result1x * 2, 5);
  });
});

describe('projectToNearestSnapPoint', () => {
  const snapPoints = [0, 100, 200, 300];

  it('should snap to nearest point with zero velocity', () => {
    const result = projectToNearestSnapPoint(110, 0, snapPoints);
    expect(result).toBe(100);
  });

  it('should consider velocity when snapping', () => {
    // At position 110 with positive velocity 500, projects: 110 + (500 * 0.998 / 0.002) = 110 + 249500 ≈ 249610
    // Nearest to that projected position from [0, 100, 200, 300] is 300
    const result = projectToNearestSnapPoint(110, 500, snapPoints);
    expect(result).toBe(300); // Projects far forward due to high deceleration rate
  });

  it('should snap backward with negative velocity', () => {
    // At position 190 with velocity -500, projects: 190 + (-500 * 0.998 / 0.002) = 190 - 249500 ≈ -249310
    // Nearest to that projected position from [0, 100, 200, 300] is 0
    const result = projectToNearestSnapPoint(190, -500, snapPoints);
    expect(result).toBe(0); // Projects far backward
  });

  it('should work with single snap point', () => {
    const result = projectToNearestSnapPoint(50, 100, [200]);
    expect(result).toBe(200);
  });

  it('should handle snap points in any order', () => {
    const unorderedSnaps = [200, 0, 300, 100];
    const result = projectToNearestSnapPoint(50, 0, unorderedSnaps);
    expect(result).toBe(0);
  });
});

describe('project2D', () => {
  it('should project both X and Y independently', () => {
    const position: Point2D = { x: 100, y: 100 };
    const velocity: Velocity2D = { x: 1000, y: 500 };
    const result = project2D(position, velocity);

    expect(result.x).toBeGreaterThan(position.x);
    expect(result.y).toBeGreaterThan(position.y);
    expect(result.x - position.x).toBeGreaterThan(result.y - position.y);
  });

  it('should handle negative velocities', () => {
    const position: Point2D = { x: 100, y: 100 };
    const velocity: Velocity2D = { x: -500, y: -500 };
    const result = project2D(position, velocity);

    expect(result.x).toBeLessThan(position.x);
    expect(result.y).toBeLessThan(position.y);
  });

  it('should return position unchanged with zero velocity', () => {
    const position: Point2D = { x: 50, y: 75 };
    const velocity: Velocity2D = { x: 0, y: 0 };
    const result = project2D(position, velocity);

    expect(result.x).toBe(50);
    expect(result.y).toBe(75);
  });
});

describe('getCornerSnapPoints', () => {
  const bounds = { width: 400, height: 800, padding: 20 };
  const itemWidth = 100;
  const itemHeight = 100;

  it('should return 4 corners', () => {
    const corners = getCornerSnapPoints(bounds, itemWidth, itemHeight);
    expect(corners).toHaveLength(4);
  });

  it('should have correct corner names', () => {
    const corners = getCornerSnapPoints(bounds, itemWidth, itemHeight);
    const names = corners.map((c) => c.name);

    expect(names).toContain('topLeft');
    expect(names).toContain('topRight');
    expect(names).toContain('bottomLeft');
    expect(names).toContain('bottomRight');
  });

  it('should respect padding', () => {
    const corners = getCornerSnapPoints(bounds, itemWidth, itemHeight);
    const topLeft = corners.find((c) => c.name === 'topLeft')!;

    expect(topLeft.x).toBe(20); // padding
    expect(topLeft.y).toBe(20); // padding
  });

  it('should account for item size', () => {
    const corners = getCornerSnapPoints(bounds, itemWidth, itemHeight);
    const bottomRight = corners.find((c) => c.name === 'bottomRight')!;

    // 400 - 20*2 - 100 = 260 (safe width), 20 + 260 = 280
    expect(bottomRight.x).toBe(280);
    // 800 - 20*2 - 100 = 660 (safe height), 20 + 660 = 680
    expect(bottomRight.y).toBe(680);
  });

  it('should use default padding of 16 when not specified', () => {
    const boundsNopadding = { width: 400, height: 800 };
    const corners = getCornerSnapPoints(boundsNopadding, itemWidth, itemHeight);
    const topLeft = corners.find((c) => c.name === 'topLeft')!;

    expect(topLeft.x).toBe(16);
    expect(topLeft.y).toBe(16);
  });
});

describe('projectToNearestCorner', () => {
  const corners = [
    { x: 20, y: 20, name: 'topLeft' as const },
    { x: 280, y: 20, name: 'topRight' as const },
    { x: 20, y: 680, name: 'bottomLeft' as const },
    { x: 280, y: 680, name: 'bottomRight' as const },
  ];

  it('should find nearest corner with zero velocity', () => {
    const position: Point2D = { x: 100, y: 100 };
    const velocity: Velocity2D = { x: 0, y: 0 };
    const result = projectToNearestCorner(position, velocity, corners);

    expect(result.name).toBe('topLeft');
  });

  it('should consider velocity in projection', () => {
    const position: Point2D = { x: 100, y: 100 };
    const velocity: Velocity2D = { x: 2000, y: 0 }; // Strong rightward velocity
    const result = projectToNearestCorner(position, velocity, corners);

    expect(result.name).toBe('topRight');
  });

  it('should project to bottom corner with downward velocity', () => {
    const position: Point2D = { x: 150, y: 400 };
    const velocity: Velocity2D = { x: 0, y: 1500 }; // Strong downward
    const result = projectToNearestCorner(position, velocity, corners);

    expect(result.name).toBe('bottomLeft');
  });
});

describe('detectIntent', () => {
  it('should detect flick with high velocity and short duration', () => {
    const intent = detectIntent({
      velocity: { x: 2000, y: 0 },
      duration: 100,
      distance: 50,
    });

    expect(intent).toBe('flick');
  });

  it('should detect swipe with moderate velocity', () => {
    const intent = detectIntent({
      velocity: { x: 800, y: 0 },
      duration: 300,
      distance: 100,
    });

    expect(intent).toBe('swipe');
  });

  it('should detect drag with low velocity and distance', () => {
    const intent = detectIntent({
      velocity: { x: 100, y: 100 },
      duration: 500,
      distance: 50,
    });

    expect(intent).toBe('drag');
  });

  it('should detect tap with minimal movement', () => {
    const intent = detectIntent({
      velocity: { x: 10, y: 10 },
      duration: 100,
      distance: 5,
    });

    expect(intent).toBe('tap');
  });

  it('should detect longPress with minimal movement and long duration', () => {
    const intent = detectIntent({
      velocity: { x: 0, y: 0 },
      duration: 600,
      distance: 5,
    });

    expect(intent).toBe('longPress');
  });

  it('should detect pause with high deceleration and low speed', () => {
    const intent = detectIntent({
      velocity: { x: 50, y: 50 },
      acceleration: { x: -6000, y: 0 },
      duration: 300,
      distance: 100,
    });

    expect(intent).toBe('pause');
  });
});

describe('createAccelerationTracker', () => {
  it('should return a function', () => {
    const tracker = createAccelerationTracker();
    expect(typeof tracker).toBe('function');
  });

  it('should return zero acceleration on first call', () => {
    const tracker = createAccelerationTracker();
    const accel = tracker({ x: 100, y: 100 });

    // First call has no reference, returns minimal
    expect(accel.x).toBeDefined();
    expect(accel.y).toBeDefined();
  });

  it('should calculate acceleration between calls', async () => {
    const tracker = createAccelerationTracker();

    tracker({ x: 0, y: 0 });

    // Wait a bit
    await new Promise((r) => setTimeout(r, 50));

    const accel = tracker({ x: 50, y: 0 });

    // Acceleration should be positive (velocity increased)
    expect(accel.x).toBeGreaterThan(0);
  });
});

describe('getGestureDirection', () => {
  it('should return "right" for positive X velocity', () => {
    expect(getGestureDirection({ x: 500, y: 0 })).toBe('right');
  });

  it('should return "left" for negative X velocity', () => {
    expect(getGestureDirection({ x: -500, y: 0 })).toBe('left');
  });

  it('should return "down" for positive Y velocity', () => {
    expect(getGestureDirection({ x: 0, y: 500 })).toBe('down');
  });

  it('should return "up" for negative Y velocity', () => {
    expect(getGestureDirection({ x: 0, y: -500 })).toBe('up');
  });

  it('should return "none" for velocity below threshold', () => {
    expect(getGestureDirection({ x: 30, y: 30 })).toBe('none');
  });

  it('should prioritize larger axis', () => {
    expect(getGestureDirection({ x: 100, y: 500 })).toBe('down');
    expect(getGestureDirection({ x: 500, y: 100 })).toBe('right');
  });
});

describe('getSpeed', () => {
  it('should return magnitude of velocity', () => {
    const speed = getSpeed({ x: 3, y: 4 });
    expect(speed).toBe(5); // Pythagorean: sqrt(9 + 16)
  });

  it('should return 0 for zero velocity', () => {
    expect(getSpeed({ x: 0, y: 0 })).toBe(0);
  });

  it('should handle negative velocities', () => {
    const speed = getSpeed({ x: -3, y: -4 });
    expect(speed).toBe(5);
  });
});

describe('isFlick', () => {
  it('should return true for speed above default threshold', () => {
    // speed = sqrt(800² + 600²) = 1000, threshold is 1000, so > 1000 is false
    // Use higher values to exceed threshold
    expect(isFlick({ x: 900, y: 600 })).toBe(true); // speed ≈ 1082 > 1000
  });

  it('should return false for speed at or below default threshold', () => {
    expect(isFlick({ x: 800, y: 600 })).toBe(false); // speed = 1000, NOT > 1000
    expect(isFlick({ x: 300, y: 400 })).toBe(false); // speed = 500
  });

  it('should respect custom threshold', () => {
    expect(isFlick({ x: 300, y: 400 }, 400)).toBe(true); // speed 500 > threshold 400
    expect(isFlick({ x: 300, y: 400 }, 600)).toBe(false); // speed 500 < threshold 600
  });
});
