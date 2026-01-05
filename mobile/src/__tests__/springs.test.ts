/**
 * Tests for Fluid Spring Physics System
 *
 * Validates Apple-style spring physics conversions and utilities.
 */

import {
  fluidSprings,
  toSpringConfig,
  getSpringConfig,
  toSpringConfigWithVelocity,
  blendSprings,
  springForVelocity,
  FluidSpring,
} from '../theme/springs';

describe('fluidSprings presets', () => {
  it('should have all expected presets', () => {
    expect(fluidSprings.instant).toBeDefined();
    expect(fluidSprings.quick).toBeDefined();
    expect(fluidSprings.smooth).toBeDefined();
    expect(fluidSprings.momentum).toBeDefined();
    expect(fluidSprings.flick).toBeDefined();
    expect(fluidSprings.bouncy).toBeDefined();
    expect(fluidSprings.playful).toBeDefined();
    expect(fluidSprings.dramatic).toBeDefined();
    expect(fluidSprings.heavy).toBeDefined();
    expect(fluidSprings.inexertion).toBeDefined();
    expect(fluidSprings.kiri).toBeDefined();
  });

  it('should have valid dampingRatio values (0-1.5)', () => {
    Object.values(fluidSprings).forEach((spring) => {
      expect(spring.dampingRatio).toBeGreaterThan(0);
      expect(spring.dampingRatio).toBeLessThanOrEqual(1.5);
    });
  });

  it('should have valid response values (0.1-1.0 seconds)', () => {
    Object.values(fluidSprings).forEach((spring) => {
      expect(spring.response).toBeGreaterThan(0.1);
      expect(spring.response).toBeLessThanOrEqual(1.0);
    });
  });

  it('should have no-overshoot presets with dampingRatio = 1', () => {
    expect(fluidSprings.instant.dampingRatio).toBe(1);
    expect(fluidSprings.quick.dampingRatio).toBe(1);
    expect(fluidSprings.smooth.dampingRatio).toBe(1);
  });

  it('should have bouncy presets with dampingRatio < 1', () => {
    expect(fluidSprings.bouncy.dampingRatio).toBeLessThan(1);
    expect(fluidSprings.playful.dampingRatio).toBeLessThan(1);
    expect(fluidSprings.momentum.dampingRatio).toBeLessThan(1);
  });
});

describe('toSpringConfig', () => {
  it('should convert fluid spring to Reanimated config', () => {
    const config = toSpringConfig(fluidSprings.quick);

    expect(config).toHaveProperty('damping');
    expect(config).toHaveProperty('stiffness');
    expect(config).toHaveProperty('mass');
    expect(config.mass).toBe(1);
  });

  it('should produce positive damping and stiffness values', () => {
    Object.values(fluidSprings).forEach((spring) => {
      const config = toSpringConfig(spring);
      expect(config.damping).toBeGreaterThan(0);
      expect(config.stiffness).toBeGreaterThan(0);
    });
  });

  it('should produce higher stiffness for faster response', () => {
    const instantConfig = toSpringConfig(fluidSprings.instant);
    const dramaticConfig = toSpringConfig(fluidSprings.dramatic);

    // Instant (0.2s response) should be stiffer than dramatic (0.8s response)
    expect(instantConfig.stiffness).toBeGreaterThan(dramaticConfig.stiffness);
  });

  it('should use correct physics formula for stiffness', () => {
    const spring: FluidSpring = { dampingRatio: 1, response: 0.5 };
    const config = toSpringConfig(spring);

    // stiffness = (2π / response)²
    const expectedStiffness = Math.pow((2 * Math.PI) / 0.5, 2);
    expect(config.stiffness).toBeCloseTo(expectedStiffness, 5);
  });

  it('should use correct physics formula for damping', () => {
    const spring: FluidSpring = { dampingRatio: 0.8, response: 0.4 };
    const config = toSpringConfig(spring);

    // damping = 4π × dampingRatio / response
    const expectedDamping = (4 * Math.PI * 0.8) / 0.4;
    expect(config.damping).toBeCloseTo(expectedDamping, 5);
  });
});

describe('getSpringConfig', () => {
  it('should return config for preset names', () => {
    const config = getSpringConfig('bouncy');

    expect(config).toHaveProperty('damping');
    expect(config).toHaveProperty('stiffness');
    expect(config).toHaveProperty('mass');
  });

  it('should match direct toSpringConfig call', () => {
    const fromGetConfig = getSpringConfig('quick');
    const fromToSpringConfig = toSpringConfig(fluidSprings.quick);

    expect(fromGetConfig).toEqual(fromToSpringConfig);
  });
});

describe('toSpringConfigWithVelocity', () => {
  it('should include velocity in the config', () => {
    const config = toSpringConfigWithVelocity(fluidSprings.momentum, 500);

    expect(config).toHaveProperty('velocity');
    expect(config.velocity).toBe(500);
  });

  it('should preserve spring physics alongside velocity', () => {
    const configWithVelocity = toSpringConfigWithVelocity(fluidSprings.quick, 1000);
    const configWithoutVelocity = toSpringConfig(fluidSprings.quick);

    expect(configWithVelocity.damping).toBe(configWithoutVelocity.damping);
    expect(configWithVelocity.stiffness).toBe(configWithoutVelocity.stiffness);
    expect(configWithVelocity.mass).toBe(configWithoutVelocity.mass);
  });

  it('should handle negative velocity', () => {
    const config = toSpringConfigWithVelocity(fluidSprings.flick, -800);
    expect(config.velocity).toBe(-800);
  });
});

describe('blendSprings', () => {
  it('should return springA when factor is 0', () => {
    const blended = blendSprings(fluidSprings.quick, fluidSprings.bouncy, 0);

    expect(blended.dampingRatio).toBe(fluidSprings.quick.dampingRatio);
    expect(blended.response).toBe(fluidSprings.quick.response);
  });

  it('should return springB when factor is 1', () => {
    const blended = blendSprings(fluidSprings.quick, fluidSprings.bouncy, 1);

    expect(blended.dampingRatio).toBe(fluidSprings.bouncy.dampingRatio);
    expect(blended.response).toBe(fluidSprings.bouncy.response);
  });

  it('should interpolate at factor 0.5', () => {
    const blended = blendSprings(fluidSprings.quick, fluidSprings.bouncy, 0.5);

    const expectedDamping =
      (fluidSprings.quick.dampingRatio + fluidSprings.bouncy.dampingRatio) / 2;
    const expectedResponse =
      (fluidSprings.quick.response + fluidSprings.bouncy.response) / 2;

    expect(blended.dampingRatio).toBeCloseTo(expectedDamping, 5);
    expect(blended.response).toBeCloseTo(expectedResponse, 5);
  });

  it('should clamp factor below 0', () => {
    const blended = blendSprings(fluidSprings.quick, fluidSprings.bouncy, -0.5);

    expect(blended.dampingRatio).toBe(fluidSprings.quick.dampingRatio);
    expect(blended.response).toBe(fluidSprings.quick.response);
  });

  it('should clamp factor above 1', () => {
    const blended = blendSprings(fluidSprings.quick, fluidSprings.bouncy, 1.5);

    expect(blended.dampingRatio).toBe(fluidSprings.bouncy.dampingRatio);
    expect(blended.response).toBe(fluidSprings.bouncy.response);
  });
});

describe('springForVelocity', () => {
  it('should return flick spring for very high velocity (>2000)', () => {
    const spring = springForVelocity(2500);
    expect(spring).toEqual(fluidSprings.flick);
  });

  it('should return momentum spring for high velocity (1000-2000)', () => {
    const spring = springForVelocity(1500);
    expect(spring).toEqual(fluidSprings.momentum);
  });

  it('should return quick spring for medium velocity (500-1000)', () => {
    const spring = springForVelocity(750);
    expect(spring).toEqual(fluidSprings.quick);
  });

  it('should return smooth spring for low velocity (<500)', () => {
    const spring = springForVelocity(200);
    expect(spring).toEqual(fluidSprings.smooth);
  });

  it('should handle negative velocities using absolute value', () => {
    const spring = springForVelocity(-2500);
    expect(spring).toEqual(fluidSprings.flick);
  });

  it('should handle zero velocity', () => {
    const spring = springForVelocity(0);
    expect(spring).toEqual(fluidSprings.smooth);
  });
});
