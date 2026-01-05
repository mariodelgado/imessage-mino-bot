/**
 * Tests for Spatial Transitions System
 *
 * Validates enter/exit animations follow consistent spatial logic.
 */

import {
  SpatialRegistry,
  getEnterTransform,
  getVisibleTransform,
  getExitTransform,
  getOppositeDirection,
  directionFromPosition,
  directionFromVelocity,
  interpolateTransform,
  getDismissProgress,
  shouldDismiss,
  registerNavigation,
  getNavigationTransition,
  TransitionDirection,
  TransformState,
} from '../utils/spatialTransitions';

describe('SpatialRegistry', () => {
  beforeEach(() => {
    SpatialRegistry.clearAll();
  });

  it('should store and retrieve origins', () => {
    SpatialRegistry.setOrigin('test', { direction: 'left' });
    expect(SpatialRegistry.getOrigin('test')).toEqual({ direction: 'left' });
  });

  it('should return center direction for unknown IDs', () => {
    expect(SpatialRegistry.getOrigin('unknown')).toEqual({ direction: 'center' });
  });

  it('should get just the direction', () => {
    SpatialRegistry.setOrigin('test', { direction: 'up', x: 100, y: 200 });
    expect(SpatialRegistry.getDirection('test')).toBe('up');
  });

  it('should clear individual origins', () => {
    SpatialRegistry.setOrigin('test', { direction: 'left' });
    SpatialRegistry.clear('test');
    expect(SpatialRegistry.has('test')).toBe(false);
  });

  it('should clear all origins', () => {
    SpatialRegistry.setOrigin('a', { direction: 'left' });
    SpatialRegistry.setOrigin('b', { direction: 'right' });
    SpatialRegistry.clearAll();

    expect(SpatialRegistry.has('a')).toBe(false);
    expect(SpatialRegistry.has('b')).toBe(false);
  });

  it('should check if origin exists', () => {
    SpatialRegistry.setOrigin('exists', { direction: 'down' });

    expect(SpatialRegistry.has('exists')).toBe(true);
    expect(SpatialRegistry.has('doesnt-exist')).toBe(false);
  });

  it('should store optional coordinates', () => {
    SpatialRegistry.setOrigin('coords', { direction: 'left', x: 50, y: 100 });
    const origin = SpatialRegistry.getOrigin('coords');

    expect(origin.x).toBe(50);
    expect(origin.y).toBe(100);
  });
});

describe('getEnterTransform', () => {
  it('should return offscreen position from left', () => {
    const transform = getEnterTransform('left');

    expect(transform.translateX).toBeLessThan(0);
    expect(transform.translateY).toBe(0);
    expect(transform.opacity).toBe(0);
    expect(transform.scale).toBe(1);
  });

  it('should return offscreen position from right', () => {
    const transform = getEnterTransform('right');

    expect(transform.translateX).toBeGreaterThan(0);
    expect(transform.translateY).toBe(0);
  });

  it('should return offscreen position from up', () => {
    const transform = getEnterTransform('up');

    expect(transform.translateY).toBeLessThan(0);
    expect(transform.translateX).toBe(0);
  });

  it('should return offscreen position from down', () => {
    const transform = getEnterTransform('down');

    expect(transform.translateY).toBeGreaterThan(0);
    expect(transform.translateX).toBe(0);
  });

  it('should return scaled from center', () => {
    const transform = getEnterTransform('center');

    expect(transform.translateX).toBe(0);
    expect(transform.translateY).toBe(0);
    expect(transform.scale).toBeLessThan(1);
    expect(transform.opacity).toBe(0);
  });

  it('should return visible state for none', () => {
    const transform = getEnterTransform('none');

    expect(transform.translateX).toBe(0);
    expect(transform.translateY).toBe(0);
    expect(transform.scale).toBe(1);
    expect(transform.opacity).toBe(1);
  });
});

describe('getVisibleTransform', () => {
  it('should return fully visible, unscaled, centered state', () => {
    const transform = getVisibleTransform();

    expect(transform.translateX).toBe(0);
    expect(transform.translateY).toBe(0);
    expect(transform.scale).toBe(1);
    expect(transform.opacity).toBe(1);
  });
});

describe('getExitTransform', () => {
  it('should be symmetric with enter transform', () => {
    const directions: TransitionDirection[] = ['left', 'right', 'up', 'down', 'center'];

    directions.forEach((dir) => {
      const enter = getEnterTransform(dir);
      const exit = getExitTransform(dir);

      expect(exit).toEqual(enter);
    });
  });
});

describe('getOppositeDirection', () => {
  it('should return opposite for horizontal', () => {
    expect(getOppositeDirection('left')).toBe('right');
    expect(getOppositeDirection('right')).toBe('left');
  });

  it('should return opposite for vertical', () => {
    expect(getOppositeDirection('up')).toBe('down');
    expect(getOppositeDirection('down')).toBe('up');
  });

  it('should return same for non-directional', () => {
    expect(getOppositeDirection('center')).toBe('center');
    expect(getOppositeDirection('none')).toBe('none');
  });
});

describe('directionFromPosition', () => {
  const center = { x: 200, y: 300 };

  it('should return left when position is left of center', () => {
    expect(directionFromPosition(50, 300, center.x, center.y)).toBe('left');
  });

  it('should return right when position is right of center', () => {
    expect(directionFromPosition(350, 300, center.x, center.y)).toBe('right');
  });

  it('should return up when position is above center', () => {
    expect(directionFromPosition(200, 100, center.x, center.y)).toBe('up');
  });

  it('should return down when position is below center', () => {
    expect(directionFromPosition(200, 500, center.x, center.y)).toBe('down');
  });

  it('should return center when very close to center', () => {
    expect(directionFromPosition(205, 305, center.x, center.y)).toBe('center');
  });

  it('should prioritize larger axis difference', () => {
    // X distance = 100, Y distance = 50 -> horizontal wins
    expect(directionFromPosition(300, 350, center.x, center.y)).toBe('right');
    // X distance = 50, Y distance = 100 -> vertical wins
    expect(directionFromPosition(250, 400, center.x, center.y)).toBe('down');
  });
});

describe('directionFromVelocity', () => {
  it('should return left for negative X velocity', () => {
    expect(directionFromVelocity(-500, 0)).toBe('left');
  });

  it('should return right for positive X velocity', () => {
    expect(directionFromVelocity(500, 0)).toBe('right');
  });

  it('should return up for negative Y velocity', () => {
    expect(directionFromVelocity(0, -500)).toBe('up');
  });

  it('should return down for positive Y velocity', () => {
    expect(directionFromVelocity(0, 500)).toBe('down');
  });

  it('should return none for velocity below threshold', () => {
    expect(directionFromVelocity(50, 50)).toBe('none');
  });

  it('should use custom threshold', () => {
    expect(directionFromVelocity(150, 0, 200)).toBe('none');
    expect(directionFromVelocity(250, 0, 200)).toBe('right');
  });
});

describe('interpolateTransform', () => {
  const from: TransformState = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    opacity: 0,
  };

  const to: TransformState = {
    translateX: 100,
    translateY: 50,
    scale: 0.5,
    opacity: 1,
  };

  it('should return from state at progress 0', () => {
    const result = interpolateTransform(from, to, 0);
    expect(result).toEqual(from);
  });

  it('should return to state at progress 1', () => {
    const result = interpolateTransform(from, to, 1);
    expect(result).toEqual(to);
  });

  it('should interpolate at progress 0.5', () => {
    const result = interpolateTransform(from, to, 0.5);

    expect(result.translateX).toBe(50);
    expect(result.translateY).toBe(25);
    expect(result.scale).toBe(0.75);
    expect(result.opacity).toBe(0.5);
  });

  it('should clamp progress below 0', () => {
    const result = interpolateTransform(from, to, -0.5);
    expect(result).toEqual(from);
  });

  it('should clamp progress above 1', () => {
    const result = interpolateTransform(from, to, 1.5);
    expect(result).toEqual(to);
  });
});

describe('getDismissProgress', () => {
  const threshold = 150;

  it('should return 0 when not moved', () => {
    expect(getDismissProgress('left', 0, 0, threshold)).toBe(0);
  });

  it('should track leftward dismissal', () => {
    expect(getDismissProgress('left', -75, 0, threshold)).toBe(0.5);
    expect(getDismissProgress('left', -150, 0, threshold)).toBe(1);
  });

  it('should track rightward dismissal', () => {
    expect(getDismissProgress('right', 75, 0, threshold)).toBe(0.5);
    expect(getDismissProgress('right', 150, 0, threshold)).toBe(1);
  });

  it('should track upward dismissal', () => {
    expect(getDismissProgress('up', 0, -75, threshold)).toBe(0.5);
  });

  it('should track downward dismissal', () => {
    expect(getDismissProgress('down', 0, 75, threshold)).toBe(0.5);
  });

  it('should use distance for center direction', () => {
    // Distance of (90, 120) = 150 = threshold
    expect(getDismissProgress('center', 90, 120, threshold)).toBe(1);
  });

  it('should clamp progress between 0 and 1', () => {
    expect(getDismissProgress('right', 300, 0, threshold)).toBe(1);
    expect(getDismissProgress('right', -50, 0, threshold)).toBe(0); // Wrong direction
  });
});

describe('shouldDismiss', () => {
  it('should dismiss when progress exceeds threshold', () => {
    expect(shouldDismiss(0.6, 0)).toBe(true);
  });

  it('should not dismiss when progress is below threshold', () => {
    expect(shouldDismiss(0.4, 0)).toBe(false);
  });

  it('should dismiss with high velocity and some progress', () => {
    expect(shouldDismiss(0.2, 600)).toBe(true);
  });

  it('should not dismiss with high velocity but no progress', () => {
    expect(shouldDismiss(0.05, 1000)).toBe(false);
  });

  it('should respect custom thresholds', () => {
    expect(shouldDismiss(0.4, 0, 0.3)).toBe(true);
    expect(shouldDismiss(0.4, 0, 0.5)).toBe(false);
    expect(shouldDismiss(0.2, 400, 0.5, 300)).toBe(true);
  });
});

describe('registerNavigation and getNavigationTransition', () => {
  beforeEach(() => {
    SpatialRegistry.clearAll();
  });

  it('should register and retrieve navigation', () => {
    registerNavigation('screen1', 'right');
    const transition = getNavigationTransition('screen1');

    expect(transition.entering).toEqual(getEnterTransform('right'));
    expect(transition.visible).toEqual(getVisibleTransform());
    expect(transition.exiting).toEqual(getExitTransform('right'));
  });

  it('should store optional coordinates', () => {
    registerNavigation('screen2', 'up', { x: 100, y: 200 });
    const origin = SpatialRegistry.getOrigin('screen2');

    expect(origin.x).toBe(100);
    expect(origin.y).toBe(200);
  });

  it('should default to center for unregistered elements', () => {
    const transition = getNavigationTransition('unknown');

    expect(transition.entering).toEqual(getEnterTransform('center'));
  });
});
