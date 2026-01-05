/**
 * Export Verification Tests
 *
 * Verifies all fluid interface utilities are correctly exported.
 */

import {
  // Springs
  fluidSprings,
  toSpringConfig,
  getSpringConfig,
  toSpringConfigWithVelocity,
  blendSprings,
  springForVelocity,
} from '../theme/springs';

import {
  // Fluid gestures
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
} from '../utils/fluidGestures';

import {
  // Rubberbanding
  RUBBERBAND_COEFFICIENT,
  rubberband,
  rubberbandClamp,
  rubberbandClamp2D,
  detectEdge,
  getOverscroll,
  isOverscrolling,
  getResistanceFactor,
} from '../utils/rubberbanding';

import {
  // Spatial transitions
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
} from '../utils/spatialTransitions';

describe('Export Verification', () => {
  describe('Springs exports', () => {
    it('should export fluidSprings', () => {
      expect(fluidSprings).toBeDefined();
      expect(fluidSprings.smooth).toBeDefined();
      expect(fluidSprings.inexertion).toBeDefined();
      expect(fluidSprings.kiri).toBeDefined();
    });

    it('should export toSpringConfig', () => {
      expect(typeof toSpringConfig).toBe('function');
      const config = toSpringConfig(fluidSprings.smooth);
      expect(config.damping).toBeDefined();
      expect(config.stiffness).toBeDefined();
    });

    it('should export getSpringConfig', () => {
      expect(typeof getSpringConfig).toBe('function');
      const config = getSpringConfig('smooth');
      expect(config.damping).toBeDefined();
    });

    it('should export toSpringConfigWithVelocity', () => {
      expect(typeof toSpringConfigWithVelocity).toBe('function');
    });

    it('should export blendSprings', () => {
      expect(typeof blendSprings).toBe('function');
    });

    it('should export springForVelocity', () => {
      expect(typeof springForVelocity).toBe('function');
    });
  });

  describe('Fluid gestures exports', () => {
    it('should export DecelerationRate', () => {
      expect(DecelerationRate).toBeDefined();
      expect(DecelerationRate.normal).toBe(0.998);
    });

    it('should export projection functions', () => {
      expect(typeof project).toBe('function');
      expect(typeof projectToNearestSnapPoint).toBe('function');
      expect(typeof project2D).toBe('function');
    });

    it('should export corner functions', () => {
      expect(typeof getCornerSnapPoints).toBe('function');
      expect(typeof projectToNearestCorner).toBe('function');
    });

    it('should export intent detection', () => {
      expect(typeof detectIntent).toBe('function');
      expect(typeof createAccelerationTracker).toBe('function');
    });

    it('should export gesture utilities', () => {
      expect(typeof getGestureDirection).toBe('function');
      expect(typeof getSpeed).toBe('function');
      expect(typeof isFlick).toBe('function');
    });
  });

  describe('Rubberbanding exports', () => {
    it('should export rubberband coefficient', () => {
      expect(RUBBERBAND_COEFFICIENT).toBe(0.55);
    });

    it('should export rubberband functions', () => {
      expect(typeof rubberband).toBe('function');
      expect(typeof rubberbandClamp).toBe('function');
      expect(typeof rubberbandClamp2D).toBe('function');
    });

    it('should export edge detection', () => {
      expect(typeof detectEdge).toBe('function');
    });

    it('should export overscroll utilities', () => {
      expect(typeof getOverscroll).toBe('function');
      expect(typeof isOverscrolling).toBe('function');
      expect(typeof getResistanceFactor).toBe('function');
    });
  });

  describe('Spatial transitions exports', () => {
    it('should export SpatialRegistry', () => {
      expect(SpatialRegistry).toBeDefined();
      expect(typeof SpatialRegistry.setOrigin).toBe('function');
      expect(typeof SpatialRegistry.getOrigin).toBe('function');
    });

    it('should export transform functions', () => {
      expect(typeof getEnterTransform).toBe('function');
      expect(typeof getVisibleTransform).toBe('function');
      expect(typeof getExitTransform).toBe('function');
    });

    it('should export direction utilities', () => {
      expect(typeof getOppositeDirection).toBe('function');
      expect(typeof directionFromPosition).toBe('function');
      expect(typeof directionFromVelocity).toBe('function');
    });

    it('should export interpolation and dismiss', () => {
      expect(typeof interpolateTransform).toBe('function');
      expect(typeof getDismissProgress).toBe('function');
      expect(typeof shouldDismiss).toBe('function');
    });

    it('should export navigation helpers', () => {
      expect(typeof registerNavigation).toBe('function');
      expect(typeof getNavigationTransition).toBe('function');
    });
  });
});
