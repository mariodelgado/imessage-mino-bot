/**
 * Fluid Interface Utilities
 *
 * Core utilities for building Apple-level fluid interactions:
 * - Velocity projection for momentum-aware gestures
 * - Rubberbanding for soft boundaries
 * - Spatial transitions for consistent enter/exit animations
 *
 * These utilities work seamlessly with react-native-reanimated worklets.
 */

export * from './fluidGestures';
export * from './rubberbanding';
export * from './spatialTransitions';

// Re-export defaults for convenience
export { default as fluidGestures } from './fluidGestures';
export { default as rubberbanding } from './rubberbanding';
export { default as spatialTransitions } from './spatialTransitions';
