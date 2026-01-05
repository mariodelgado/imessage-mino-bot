/**
 * Direct Manipulation Hook
 *
 * One-to-one touch tracking for fluid gestures.
 *
 * Key insight from Apple WWDC 2018:
 * "One-to-one tracking is extremely important. The moment touch and content
 *  stop tracking together, we immediately notice."
 *
 * During gesture: NO springs, NO easing - just direct position tracking
 * After release: Springs apply for momentum-based settling
 *
 * This creates the illusion that you're directly grabbing and moving the element.
 */

import { useCallback } from 'react';
import {
  useSharedValue,
  withSpring,
  cancelAnimation,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureType } from 'react-native-gesture-handler';
import {
  rubberbandClampWorklet,
  RUBBERBAND_COEFFICIENT,
} from '../utils/rubberbanding';
import {
  projectToNearestSnapPointWorklet,
  project2DWorklet,
} from '../utils/fluidGestures';
import { toSpringConfigWorklet } from '../theme/springs';

// ============================================================================
// TYPES
// ============================================================================

export interface Bounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface DragEvent {
  position: Position;
  velocity: Velocity;
  translation: Position;
}

export interface ReleaseEvent {
  position: Position;
  velocity: Velocity;
  projectedPosition: Position;
}

export interface DirectManipulationOptions {
  /** Initial position */
  initialPosition?: Position;
  /** Bounds for rubberbanding (optional) */
  bounds?: Bounds;
  /** Rubberband coefficient (0.35-0.7, default 0.55) */
  rubberbandCoefficient?: number;
  /** Snap points for X axis (optional) */
  snapPointsX?: number[];
  /** Snap points for Y axis (optional) */
  snapPointsY?: number[];
  /** Lock to X axis only */
  lockX?: boolean;
  /** Lock to Y axis only */
  lockY?: boolean;
  /** Callback when drag starts */
  onDragStart?: () => void;
  /** Callback during drag */
  onDragUpdate?: (event: DragEvent) => void;
  /** Callback when drag ends */
  onDragEnd?: (event: ReleaseEvent) => void;
  /** Spring damping ratio for settling (default 0.8) */
  settlingDampingRatio?: number;
  /** Spring response for settling (default 0.4) */
  settlingResponse?: number;
}

export interface DirectManipulationResult {
  /** Current X position (animated) */
  translateX: SharedValue<number>;
  /** Current Y position (animated) */
  translateY: SharedValue<number>;
  /** Whether currently being dragged */
  isDragging: SharedValue<boolean>;
  /** The configured pan gesture */
  gesture: GestureType;
  /** Programmatically animate to position */
  animateTo: (x: number, y: number) => void;
  /** Set position immediately */
  setPosition: (x: number, y: number) => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Create a directly manipulable element with one-to-one tracking
 *
 * @example
 * ```tsx
 * function DraggableCard() {
 *   const { translateX, translateY, gesture } = useDirectManipulation({
 *     bounds: { minX: 0, maxX: 300, minY: 0, maxY: 500 },
 *     snapPointsX: [0, 150, 300],
 *     onDragEnd: ({ projectedPosition }) => {
 *       console.log('Will settle at:', projectedPosition);
 *     },
 *   });
 *
 *   const animatedStyle = useAnimatedStyle(() => ({
 *     transform: [
 *       { translateX: translateX.value },
 *       { translateY: translateY.value },
 *     ],
 *   }));
 *
 *   return (
 *     <GestureDetector gesture={gesture}>
 *       <Animated.View style={animatedStyle}>
 *         <Card />
 *       </Animated.View>
 *     </GestureDetector>
 *   );
 * }
 * ```
 */
export function useDirectManipulation(
  options: DirectManipulationOptions = {}
): DirectManipulationResult {
  const {
    initialPosition = { x: 0, y: 0 },
    bounds,
    rubberbandCoefficient = RUBBERBAND_COEFFICIENT,
    snapPointsX,
    snapPointsY,
    lockX = false,
    lockY = false,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    settlingDampingRatio = 0.8,
    settlingResponse = 0.4,
  } = options;

  // Position values
  const translateX = useSharedValue(initialPosition.x);
  const translateY = useSharedValue(initialPosition.y);

  // Saved offset when gesture begins
  const savedOffsetX = useSharedValue(initialPosition.x);
  const savedOffsetY = useSharedValue(initialPosition.y);

  // Current velocity for momentum
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);

  // Drag state
  const isDragging = useSharedValue(false);

  // Build the pan gesture
  const gesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      // Cancel any running animations for instant response
      cancelAnimation(translateX);
      cancelAnimation(translateY);

      // Save current position as offset
      savedOffsetX.value = translateX.value;
      savedOffsetY.value = translateY.value;

      isDragging.value = true;

      if (onDragStart) {
        runOnJS(onDragStart)();
      }
    })
    .onUpdate((event) => {
      'worklet';
      // Calculate new position with direct 1:1 tracking
      let newX = lockX ? savedOffsetX.value : savedOffsetX.value + event.translationX;
      let newY = lockY ? savedOffsetY.value : savedOffsetY.value + event.translationY;

      // Apply rubberbanding at bounds
      if (bounds) {
        if (bounds.minX !== undefined && bounds.maxX !== undefined && !lockX) {
          newX = rubberbandClampWorklet(
            newX,
            bounds.minX,
            bounds.maxX,
            rubberbandCoefficient
          );
        }
        if (bounds.minY !== undefined && bounds.maxY !== undefined && !lockY) {
          newY = rubberbandClampWorklet(
            newY,
            bounds.minY,
            bounds.maxY,
            rubberbandCoefficient
          );
        }
      }

      // Update position (DIRECT - no animation)
      translateX.value = newX;
      translateY.value = newY;

      // Track velocity for momentum
      velocityX.value = event.velocityX;
      velocityY.value = event.velocityY;

      if (onDragUpdate) {
        runOnJS(onDragUpdate)({
          position: { x: newX, y: newY },
          velocity: { x: event.velocityX, y: event.velocityY },
          translation: { x: event.translationX, y: event.translationY },
        });
      }
    })
    .onEnd((event) => {
      'worklet';
      isDragging.value = false;

      // Calculate projected position based on velocity
      const projected = project2DWorklet(
        translateX.value,
        translateY.value,
        event.velocityX,
        event.velocityY,
        0.998 // normal deceleration
      );

      // Determine target position
      let targetX = projected.x;
      let targetY = projected.y;

      // Snap to points if defined
      if (snapPointsX && snapPointsX.length > 0 && !lockX) {
        targetX = projectToNearestSnapPointWorklet(
          translateX.value,
          event.velocityX,
          snapPointsX,
          0.998
        );
      }

      if (snapPointsY && snapPointsY.length > 0 && !lockY) {
        targetY = projectToNearestSnapPointWorklet(
          translateY.value,
          event.velocityY,
          snapPointsY,
          0.998
        );
      }

      // Clamp to bounds (hard clamp for final position)
      if (bounds) {
        if (bounds.minX !== undefined && bounds.maxX !== undefined) {
          targetX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
        }
        if (bounds.minY !== undefined && bounds.maxY !== undefined) {
          targetY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));
        }
      }

      // Build spring config with velocity preservation
      const springConfig = toSpringConfigWorklet(
        settlingDampingRatio,
        settlingResponse
      );

      // Animate to target with momentum
      if (!lockX) {
        translateX.value = withSpring(targetX, {
          ...springConfig,
          velocity: event.velocityX,
        });
      }

      if (!lockY) {
        translateY.value = withSpring(targetY, {
          ...springConfig,
          velocity: event.velocityY,
        });
      }

      if (onDragEnd) {
        runOnJS(onDragEnd)({
          position: { x: translateX.value, y: translateY.value },
          velocity: { x: event.velocityX, y: event.velocityY },
          projectedPosition: { x: targetX, y: targetY },
        });
      }
    });

  // Programmatic animation
  const animateTo = useCallback((x: number, y: number) => {
    'worklet';
    cancelAnimation(translateX);
    cancelAnimation(translateY);

    const springConfig = toSpringConfigWorklet(settlingDampingRatio, settlingResponse);

    translateX.value = withSpring(x, springConfig);
    translateY.value = withSpring(y, springConfig);
  }, [settlingDampingRatio, settlingResponse]);

  // Immediate position set
  const setPosition = useCallback((x: number, y: number) => {
    'worklet';
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    translateX.value = x;
    translateY.value = y;
  }, []);

  return {
    translateX,
    translateY,
    isDragging,
    gesture,
    animateTo,
    setPosition,
  };
}

// ============================================================================
// 1D VERTICAL MANIPULATION (for sheets, drawers)
// ============================================================================

export interface VerticalManipulationOptions {
  /** Snap points (Y positions) */
  snapPoints: number[];
  /** Initial snap point index */
  initialSnapIndex?: number;
  /** Minimum Y (top bound) */
  minY?: number;
  /** Maximum Y (bottom bound) */
  maxY?: number;
  /** Rubberband coefficient */
  rubberbandCoefficient?: number;
  /** Called when settling to a snap point */
  onSnapChange?: (index: number) => void;
}

export interface VerticalManipulationResult {
  translateY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  currentSnapIndex: SharedValue<number>;
  gesture: GestureType;
  snapTo: (index: number) => void;
}

/**
 * Specialized hook for vertical sheets/drawers with snap points
 *
 * @example
 * ```tsx
 * function BottomSheet() {
 *   const { translateY, gesture, snapTo } = useVerticalManipulation({
 *     snapPoints: [0, 300, 600], // Collapsed, half, full
 *     initialSnapIndex: 0,
 *     onSnapChange: (index) => console.log('Snapped to:', index),
 *   });
 *
 *   return (
 *     <GestureDetector gesture={gesture}>
 *       <Animated.View style={useAnimatedStyle(() => ({
 *         transform: [{ translateY: translateY.value }],
 *       }))}>
 *         <SheetContent />
 *       </Animated.View>
 *     </GestureDetector>
 *   );
 * }
 * ```
 */
export function useVerticalManipulation(
  options: VerticalManipulationOptions
): VerticalManipulationResult {
  const {
    snapPoints,
    initialSnapIndex = 0,
    minY,
    maxY,
    rubberbandCoefficient = RUBBERBAND_COEFFICIENT,
    onSnapChange,
  } = options;

  const translateY = useSharedValue(snapPoints[initialSnapIndex]);
  const savedOffset = useSharedValue(snapPoints[initialSnapIndex]);
  const isDragging = useSharedValue(false);
  const currentSnapIndex = useSharedValue(initialSnapIndex);

  const effectiveMinY = minY ?? Math.min(...snapPoints);
  const effectiveMaxY = maxY ?? Math.max(...snapPoints);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      cancelAnimation(translateY);
      savedOffset.value = translateY.value;
      isDragging.value = true;
    })
    .onUpdate((event) => {
      'worklet';
      let newY = savedOffset.value + event.translationY;

      // Apply rubberbanding at edges
      newY = rubberbandClampWorklet(
        newY,
        effectiveMinY,
        effectiveMaxY,
        rubberbandCoefficient
      );

      translateY.value = newY;
    })
    .onEnd((event) => {
      'worklet';
      isDragging.value = false;

      // Find target snap point using velocity projection
      const targetY = projectToNearestSnapPointWorklet(
        translateY.value,
        event.velocityY,
        snapPoints,
        0.998
      );

      // Find snap index
      const newIndex = snapPoints.indexOf(targetY);
      if (newIndex !== currentSnapIndex.value) {
        currentSnapIndex.value = newIndex;
        if (onSnapChange) {
          runOnJS(onSnapChange)(newIndex);
        }
      }

      // Animate to snap point with momentum
      const springConfig = toSpringConfigWorklet(0.8, 0.4);
      translateY.value = withSpring(targetY, {
        ...springConfig,
        velocity: event.velocityY,
      });
    });

  const snapTo = useCallback((index: number) => {
    'worklet';
    if (index >= 0 && index < snapPoints.length) {
      cancelAnimation(translateY);
      currentSnapIndex.value = index;

      const springConfig = toSpringConfigWorklet(0.8, 0.4);
      translateY.value = withSpring(snapPoints[index], springConfig);

      if (onSnapChange) {
        runOnJS(onSnapChange)(index);
      }
    }
  }, [snapPoints, onSnapChange]);

  return {
    translateY,
    isDragging,
    currentSnapIndex,
    gesture,
    snapTo,
  };
}

export default {
  useDirectManipulation,
  useVerticalManipulation,
};
