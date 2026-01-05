/**
 * Tests for Rubberbanding System
 *
 * Validates soft boundaries that gracefully indicate limits.
 */

import {
  RUBBERBAND_COEFFICIENT,
  RUBBERBAND_TIGHT,
  RUBBERBAND_LOOSE,
  rubberband,
  rubberbandClamp,
  rubberbandClamp2D,
  detectEdge,
  getOverscroll,
  isOverscrolling,
  getResistanceFactor,
  velocityAdjustedCoefficient,
  getSnapBackTarget,
} from '../utils/rubberbanding';

describe('rubberbanding constants', () => {
  it('should have iOS default coefficient of 0.55', () => {
    expect(RUBBERBAND_COEFFICIENT).toBe(0.55);
  });

  it('should have tighter coefficient for more resistance', () => {
    expect(RUBBERBAND_TIGHT).toBeLessThan(RUBBERBAND_COEFFICIENT);
    expect(RUBBERBAND_TIGHT).toBe(0.35);
  });

  it('should have looser coefficient for less resistance', () => {
    expect(RUBBERBAND_LOOSE).toBeGreaterThan(RUBBERBAND_COEFFICIENT);
    expect(RUBBERBAND_LOOSE).toBe(0.7);
  });
});

describe('rubberband', () => {
  it('should return 0 for zero offset', () => {
    expect(rubberband(0, 100)).toBe(0);
  });

  it('should return positive for positive offset', () => {
    expect(rubberband(50, 100)).toBeGreaterThan(0);
  });

  it('should return negative for negative offset', () => {
    expect(rubberband(-50, 100)).toBeLessThan(0);
  });

  it('should apply resistance (result < input)', () => {
    const result = rubberband(100, 200);
    expect(result).toBeLessThan(100);
    expect(result).toBeGreaterThan(0);
  });

  it('should apply more resistance as offset increases', () => {
    const limit = 200;
    const result50 = rubberband(50, limit);
    const result100 = rubberband(100, limit);
    const result200 = rubberband(200, limit);

    // Each doubling should NOT double the result (diminishing returns)
    expect(result100 / result50).toBeLessThan(2);
    expect(result200 / result100).toBeLessThan(2);
  });

  it('should apply less resistance with higher coefficient', () => {
    const offset = 100;
    const limit = 200;

    const tightResult = rubberband(offset, limit, RUBBERBAND_TIGHT);
    const normalResult = rubberband(offset, limit, RUBBERBAND_COEFFICIENT);
    const looseResult = rubberband(offset, limit, RUBBERBAND_LOOSE);

    expect(tightResult).toBeLessThan(normalResult);
    expect(normalResult).toBeLessThan(looseResult);
  });

  it('should preserve sign for large offsets', () => {
    expect(rubberband(500, 100)).toBeGreaterThan(0);
    expect(rubberband(-500, 100)).toBeLessThan(0);
  });
});

describe('rubberbandClamp', () => {
  const min = 0;
  const max = 100;

  it('should pass through values within bounds unchanged', () => {
    expect(rubberbandClamp(50, min, max)).toBe(50);
    expect(rubberbandClamp(0, min, max)).toBe(0);
    expect(rubberbandClamp(100, min, max)).toBe(100);
  });

  it('should apply rubberbanding when below min', () => {
    const result = rubberbandClamp(-50, min, max);
    expect(result).toBeLessThan(min);
    expect(result).toBeGreaterThan(-50); // Resistance applied
  });

  it('should apply rubberbanding when above max', () => {
    const result = rubberbandClamp(150, min, max);
    expect(result).toBeGreaterThan(max);
    expect(result).toBeLessThan(150); // Resistance applied
  });

  it('should be symmetric around bounds', () => {
    const belowMin = rubberbandClamp(-50, min, max);
    const aboveMax = rubberbandClamp(150, min, max);

    // Distance from boundary should be the same
    const distFromMin = min - belowMin;
    const distFromMax = aboveMax - max;

    expect(distFromMin).toBeCloseTo(distFromMax, 5);
  });
});

describe('rubberbandClamp2D', () => {
  const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 200 };

  it('should pass through points within bounds unchanged', () => {
    const result = rubberbandClamp2D({ x: 50, y: 100 }, bounds);
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });

  it('should clamp independently on each axis', () => {
    const result = rubberbandClamp2D({ x: 150, y: -50 }, bounds);

    expect(result.x).toBeGreaterThan(100); // Over X max
    expect(result.x).toBeLessThan(150); // With resistance
    expect(result.y).toBeLessThan(0); // Under Y min
    expect(result.y).toBeGreaterThan(-50); // With resistance
  });
});

describe('detectEdge', () => {
  const min = 0;
  const max = 100;

  describe('horizontal direction', () => {
    it('should return "left" when below min', () => {
      expect(detectEdge(-10, min, max, 'horizontal')).toBe('left');
    });

    it('should return "right" when above max', () => {
      expect(detectEdge(110, min, max, 'horizontal')).toBe('right');
    });

    it('should return "none" when within bounds', () => {
      expect(detectEdge(50, min, max, 'horizontal')).toBe('none');
    });
  });

  describe('vertical direction', () => {
    it('should return "top" when below min', () => {
      expect(detectEdge(-10, min, max, 'vertical')).toBe('top');
    });

    it('should return "bottom" when above max', () => {
      expect(detectEdge(110, min, max, 'vertical')).toBe('bottom');
    });

    it('should return "none" when within bounds', () => {
      expect(detectEdge(50, min, max, 'vertical')).toBe('none');
    });
  });
});

describe('getOverscroll', () => {
  const min = 0;
  const max = 100;

  it('should return 0 within bounds', () => {
    expect(getOverscroll(50, min, max)).toBe(0);
  });

  it('should return negative value when below min', () => {
    expect(getOverscroll(-30, min, max)).toBe(-30);
  });

  it('should return positive value when above max', () => {
    expect(getOverscroll(130, min, max)).toBe(30);
  });

  it('should return 0 exactly at boundaries', () => {
    expect(getOverscroll(0, min, max)).toBe(0);
    expect(getOverscroll(100, min, max)).toBe(0);
  });
});

describe('isOverscrolling', () => {
  const min = 0;
  const max = 100;

  it('should return false within bounds', () => {
    expect(isOverscrolling(50, min, max)).toBe(false);
  });

  it('should return true below min', () => {
    expect(isOverscrolling(-10, min, max)).toBe(true);
  });

  it('should return true above max', () => {
    expect(isOverscrolling(110, min, max)).toBe(true);
  });

  it('should return false exactly at boundaries', () => {
    expect(isOverscrolling(0, min, max)).toBe(false);
    expect(isOverscrolling(100, min, max)).toBe(false);
  });
});

describe('getResistanceFactor', () => {
  const limit = 100;

  it('should return 0 for zero offset', () => {
    expect(getResistanceFactor(0, limit)).toBe(0);
  });

  it('should increase resistance with larger offset', () => {
    const r50 = getResistanceFactor(50, limit);
    const r100 = getResistanceFactor(100, limit);
    const r200 = getResistanceFactor(200, limit);

    expect(r50).toBeLessThan(r100);
    expect(r100).toBeLessThan(r200);
  });

  it('should return value between 0 and 1', () => {
    const result = getResistanceFactor(100, 100);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('should approach 1 for very large offsets', () => {
    const result = getResistanceFactor(10000, 100);
    expect(result).toBeGreaterThan(0.8);
  });
});

describe('velocityAdjustedCoefficient', () => {
  const base = 0.55;

  it('should return base coefficient at zero velocity', () => {
    expect(velocityAdjustedCoefficient(base, 0)).toBe(base);
  });

  it('should increase coefficient with higher velocity', () => {
    const lowVel = velocityAdjustedCoefficient(base, 500);
    const highVel = velocityAdjustedCoefficient(base, 1500);

    expect(lowVel).toBeGreaterThan(base);
    expect(highVel).toBeGreaterThan(lowVel);
  });

  it('should cap increase at maxVelocity', () => {
    const atMax = velocityAdjustedCoefficient(base, 2000);
    const aboveMax = velocityAdjustedCoefficient(base, 5000);

    expect(aboveMax).toBe(atMax);
  });

  it('should increase by up to 20% at max velocity', () => {
    const atMax = velocityAdjustedCoefficient(base, 2000);
    expect(atMax).toBeCloseTo(base * 1.2, 5);
  });

  it('should handle negative velocity using absolute value', () => {
    const positive = velocityAdjustedCoefficient(base, 1000);
    const negative = velocityAdjustedCoefficient(base, -1000);

    expect(positive).toBe(negative);
  });
});

describe('getSnapBackTarget', () => {
  const min = 0;
  const max = 100;

  it('should return min when below min', () => {
    expect(getSnapBackTarget(-50, min, max)).toBe(min);
  });

  it('should return max when above max', () => {
    expect(getSnapBackTarget(150, min, max)).toBe(max);
  });

  it('should return value unchanged when within bounds', () => {
    expect(getSnapBackTarget(50, min, max)).toBe(50);
  });

  it('should return boundary when exactly at boundary', () => {
    expect(getSnapBackTarget(0, min, max)).toBe(0);
    expect(getSnapBackTarget(100, min, max)).toBe(100);
  });
});
