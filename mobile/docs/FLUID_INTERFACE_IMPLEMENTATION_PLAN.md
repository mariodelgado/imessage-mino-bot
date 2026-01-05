# Fluid Interface Implementation Plan

## Vision: Apple + MercuryOS Fusion

This plan addresses the gap between our current cinematic effects and Apple's "Designing Fluid Interfaces" principles (WWDC 2018), infused with MercuryOS's philosophical approach.

### Core Philosophy

**Apple's Core Insight:**
> "When the tool feels like an extension of your mind... it stops feeling like a computer and starts feeling more like an extension of the natural world."

**MercuryOS Inspiration:**
- **Kiri (霧)** - "Fog" aesthetic: clarity only where needed, soft mist obscuring noise
- **Way of Inexertion** - Motion without resistance, then ease into equilibrium
- **Intent-Driven** - Interface responds to human intent, not explicit commands
- **Fluid Modeless** - No rigid state machines, continuous flow

---

## Gap Analysis & Implementation

### 1. Spring Physics Refinement

**Current State:** Generic spring configs (damping/stiffness/mass)
**Target:** Apple's simplified (damping ratio + response time) model

#### New Token System

```typescript
// src/theme/springs.ts

/**
 * Apple-style spring physics using damping ratio + response time
 *
 * dampingRatio: 0 = infinite oscillation, 1 = no overshoot, >1 = overdamped
 * response: How quickly the spring moves toward target (seconds)
 */

export const fluidSprings = {
  // No overshoot - for utility animations
  instant: { dampingRatio: 1, response: 0.2 },
  quick: { dampingRatio: 1, response: 0.3 },
  smooth: { dampingRatio: 1, response: 0.4 },

  // Subtle overshoot - for momentum gestures
  momentum: { dampingRatio: 0.8, response: 0.4 },
  flick: { dampingRatio: 0.75, response: 0.35 },

  // Playful bounce - for discovery/teaching
  bouncy: { dampingRatio: 0.65, response: 0.5 },
  playful: { dampingRatio: 0.6, response: 0.6 },

  // Heavy/dramatic - for significant transitions
  dramatic: { dampingRatio: 0.7, response: 0.8 },

  // MercuryOS "inexertion" - starts fast, settles slowly
  inexertion: { dampingRatio: 0.85, response: 0.5 },
};

/**
 * Convert damping ratio + response to Reanimated spring config
 */
export function toSpringConfig(spring: { dampingRatio: number; response: number }) {
  // Mathematical conversion
  const stiffness = Math.pow(2 * Math.PI / spring.response, 2);
  const damping = 4 * Math.PI * spring.dampingRatio / spring.response;

  return {
    damping,
    stiffness,
    mass: 1,
  };
}
```

**Files to modify:**
- `src/theme/tokens.ts` - Add new spring system
- `src/theme/springs.ts` - Create new file with conversion utilities

---

### 2. Velocity Projection System

**Current State:** Missing
**Target:** Momentum-aware gesture endpoints

#### Implementation

```typescript
// src/utils/fluidGestures.ts

/**
 * Project where a value will land given velocity and deceleration
 * Based on UIScrollView's deceleration rate
 *
 * From Apple WWDC 2018:
 * "Take the velocity of the PIP when thrown, mix in deceleration rate,
 *  and you get the projected position."
 */

// Standard iOS deceleration rates
export const DecelerationRate = {
  normal: 0.998,  // UIScrollView default
  fast: 0.99,     // Snappy scrolling
};

export function project(
  initialVelocity: number,
  decelerationRate: number = DecelerationRate.normal
): number {
  // Physics: how far will it travel before stopping?
  // Uses log to calculate distance based on exponential decay
  return (initialVelocity * decelerationRate) / (1 - decelerationRate);
}

/**
 * Find the nearest snap point considering momentum
 */
export function projectToNearestSnapPoint(
  currentValue: number,
  velocity: number,
  snapPoints: number[],
  decelerationRate: number = DecelerationRate.normal
): number {
  const projectedValue = currentValue + project(velocity, decelerationRate);

  // Find nearest snap point to projected position
  return snapPoints.reduce((nearest, point) =>
    Math.abs(point - projectedValue) < Math.abs(nearest - projectedValue)
      ? point
      : nearest
  );
}

/**
 * 2D projection for draggable elements
 */
export function project2D(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  decelerationRate: number = DecelerationRate.normal
): { x: number; y: number } {
  return {
    x: position.x + project(velocity.x, decelerationRate),
    y: position.y + project(velocity.y, decelerationRate),
  };
}
```

**Files to create:**
- `src/utils/fluidGestures.ts` - Projection utilities

---

### 3. Rubberbanding System

**Current State:** Missing
**Target:** Soft boundaries that gracefully indicate limits

#### Implementation

```typescript
// src/utils/rubberbanding.ts

/**
 * Rubberband resistance - gradually reduces movement past boundaries
 *
 * From Apple WWDC 2018:
 * "The interface is gradually and softly letting you know there's nothing there.
 *  It's tracking you throughout."
 */

const RUBBERBAND_COEFFICIENT = 0.55; // iOS default

/**
 * Apply rubberband resistance to a value that exceeds bounds
 */
export function rubberband(
  offset: number,
  limit: number,
  coefficient: number = RUBBERBAND_COEFFICIENT
): number {
  // If within bounds, return as-is
  if (Math.abs(offset) <= limit) return offset;

  const sign = offset < 0 ? -1 : 1;
  const absOffset = Math.abs(offset);

  // Logarithmic decay creates the "stretchy" feel
  // Formula: x * coefficient * ln(1 + absOffset / (coefficient * limit))
  const resistance = limit * coefficient *
    Math.log(1 + (absOffset - limit) / (coefficient * limit));

  return sign * (limit + resistance);
}

/**
 * Apply rubberbanding within a range
 */
export function rubberbandClamp(
  value: number,
  min: number,
  max: number,
  coefficient: number = RUBBERBAND_COEFFICIENT
): number {
  if (value < min) {
    return min - rubberband(min - value, max - min, coefficient);
  }
  if (value > max) {
    return max + rubberband(value - max, max - min, coefficient);
  }
  return value;
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
  if (Math.abs(offset) <= limit) return offset;

  const sign = offset < 0 ? -1 : 1;
  const absOffset = Math.abs(offset);
  const resistance = limit * coefficient *
    Math.log(1 + (absOffset - limit) / (coefficient * limit));

  return sign * (limit + resistance);
}
```

**Files to create:**
- `src/utils/rubberbanding.ts` - Rubberbanding utilities

---

### 4. Interruptible/Redirectable Animations

**Current State:** Animations complete before responding
**Target:** Any animation can be interrupted and redirected mid-flight

#### Key Principle
> "The thought and gesture happen in parallel... you think with the gesture."

#### Implementation Strategy

```typescript
// src/hooks/useFluidValue.ts

import { useSharedValue, withSpring, cancelAnimation } from 'react-native-reanimated';
import { toSpringConfig, fluidSprings } from '../theme/springs';

/**
 * A shared value that can be seamlessly redirected at any point
 *
 * Key insight from Apple:
 * - Never wait for animation to complete
 * - Spring physics naturally handle interruption (seamless curves)
 * - Use velocity preservation for momentum continuity
 */
export function useFluidValue(initialValue: number) {
  const value = useSharedValue(initialValue);
  const velocity = useSharedValue(0);

  const animateTo = (
    target: number,
    spring: keyof typeof fluidSprings = 'smooth',
    preserveVelocity = true
  ) => {
    'worklet';
    // Cancel any running animation
    cancelAnimation(value);

    // Apply spring with current velocity for seamless transition
    const config = toSpringConfig(fluidSprings[spring]);

    if (preserveVelocity) {
      config.velocity = velocity.value;
    }

    value.value = withSpring(target, config, (finished) => {
      if (finished) {
        velocity.value = 0;
      }
    });
  };

  const setImmediately = (target: number) => {
    'worklet';
    cancelAnimation(value);
    value.value = target;
    velocity.value = 0;
  };

  return {
    value,
    velocity,
    animateTo,
    setImmediately,
  };
}
```

#### Pattern for Components

```typescript
// Example: Redirectable sheet

function FluidSheet({ snapPoints, children }) {
  const translateY = useFluidValue(snapPoints[0]);
  const gestureState = useSharedValue<'idle' | 'dragging'>('idle');

  const gesture = Gesture.Pan()
    .onBegin(() => {
      gestureState.value = 'dragging';
      // Cancel any running animation - instant response
      cancelAnimation(translateY.value);
    })
    .onUpdate((e) => {
      // One-to-one tracking during gesture
      translateY.value.value = rubberbandWorklet(
        e.translationY,
        RUBBERBAND_LIMIT,
      );
      translateY.velocity.value = e.velocityY;
    })
    .onEnd((e) => {
      gestureState.value = 'idle';
      // Project to snap point using momentum
      const target = projectToNearestSnapPoint(
        translateY.value.value,
        e.velocityY,
        snapPoints
      );
      translateY.animateTo(target, 'momentum');
    });
}
```

**Files to create:**
- `src/hooks/useFluidValue.ts` - Interruptible animation primitive

---

### 5. Spatial Consistency System

**Current State:** Inconsistent enter/exit animations
**Target:** Symmetric paths that match mental model

#### Principles
> "If something disappears one way, we expect it to emerge from where it came."

#### Implementation

```typescript
// src/utils/spatialTransitions.ts

export type TransitionDirection = 'left' | 'right' | 'up' | 'down' | 'center';

/**
 * Track spatial origin for consistent enter/exit
 */
export const SpatialRegistry = {
  origins: new Map<string, TransitionDirection>(),

  setOrigin(id: string, direction: TransitionDirection) {
    this.origins.set(id, direction);
  },

  getOrigin(id: string): TransitionDirection {
    return this.origins.get(id) || 'center';
  },

  clear(id: string) {
    this.origins.delete(id);
  },
};

/**
 * Get animation config for entering from a direction
 */
export function getEnterTransform(direction: TransitionDirection) {
  switch (direction) {
    case 'left':
      return { translateX: -100, opacity: 0 };
    case 'right':
      return { translateX: 100, opacity: 0 };
    case 'up':
      return { translateY: -50, opacity: 0 };
    case 'down':
      return { translateY: 50, opacity: 0 };
    case 'center':
    default:
      return { scale: 0.9, opacity: 0 };
  }
}

/**
 * Get symmetric exit animation (reverse of enter)
 */
export function getExitTransform(direction: TransitionDirection) {
  const enter = getEnterTransform(direction);
  return enter; // Exit goes back to origin state
}
```

#### Component Pattern

```typescript
// Navigation transitions should remember origin

function openDetail(item: Item, fromDirection: TransitionDirection) {
  SpatialRegistry.setOrigin(item.id, fromDirection);
  navigation.navigate('Detail', { item });
}

// In the detail screen
function DetailScreen({ item }) {
  const origin = SpatialRegistry.getOrigin(item.id);

  // Enter from origin, exit back to origin
  return (
    <SpatialTransition
      direction={origin}
      entering={getEnterTransform(origin)}
      exiting={getExitTransform(origin)}
    >
      {/* content */}
    </SpatialTransition>
  );
}
```

**Files to create:**
- `src/utils/spatialTransitions.ts` - Spatial consistency utilities

---

### 6. One-to-One Touch Tracking

**Current State:** Some components don't track during gesture
**Target:** Content always follows finger precisely

#### Key Insight
> "One-to-one tracking is extremely important. The moment touch and content stop tracking together, we immediately notice."

#### Implementation Pattern

```typescript
// src/hooks/useDirectManipulation.ts

import { Gesture } from 'react-native-gesture-handler';

/**
 * Hook for direct manipulation with one-to-one tracking
 *
 * Key: During gesture, NO springs or easing - just direct position
 * Springs only apply after release
 */
export function useDirectManipulation({
  onStart,
  onDrag,
  onRelease,
  bounds,
}: DirectManipulationOptions) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedOffset = useSharedValue({ x: 0, y: 0 });
  const isDragging = useSharedValue(false);

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      savedOffset.value = { x: offsetX.value, y: offsetY.value };
      onStart?.(e);
    })
    .onUpdate((e) => {
      // DIRECT tracking - no animation, no delay
      let newX = savedOffset.value.x + e.translationX;
      let newY = savedOffset.value.y + e.translationY;

      // Apply rubberbanding at bounds (still tracks, but with resistance)
      if (bounds) {
        newX = rubberbandClamp(newX, bounds.minX, bounds.maxX);
        newY = rubberbandClamp(newY, bounds.minY, bounds.maxY);
      }

      offsetX.value = newX;
      offsetY.value = newY;

      onDrag?.({ x: newX, y: newY, velocity: { x: e.velocityX, y: e.velocityY } });
    })
    .onEnd((e) => {
      isDragging.value = false;
      onRelease?.({
        position: { x: offsetX.value, y: offsetY.value },
        velocity: { x: e.velocityX, y: e.velocityY },
      });
    });

  return {
    gesture,
    offsetX,
    offsetY,
    isDragging,
  };
}
```

---

### 7. Kiri (霧) Fog Aesthetic - MercuryOS Inspired

**Concept:** Clarity emerges where attention focuses, everything else softens into mist

#### Implementation

```typescript
// src/components/KiriFocus.tsx

/**
 * Focus-based blur system inspired by MercuryOS's "Kiri" aesthetic
 *
 * Elements blur based on distance from focus point,
 * creating depth and guiding attention naturally
 */

interface KiriFocusProps {
  focusPoint: { x: number; y: number };
  children: React.ReactNode;
  maxBlur?: number;
  radius?: number;
}

export function KiriFocusProvider({
  focusPoint,
  children,
  maxBlur = 10,
  radius = 200,
}: KiriFocusProps) {
  return (
    <KiriFocusContext.Provider value={{ focusPoint, maxBlur, radius }}>
      {children}
    </KiriFocusContext.Provider>
  );
}

/**
 * Wrap elements that should blur based on focus distance
 */
export function KiriElement({
  position,
  children
}: {
  position: { x: number; y: number };
  children: React.ReactNode;
}) {
  const { focusPoint, maxBlur, radius } = useKiriFocus();

  const blurAmount = useDerivedValue(() => {
    const distance = Math.sqrt(
      Math.pow(position.x - focusPoint.x, 2) +
      Math.pow(position.y - focusPoint.y, 2)
    );

    // Blur increases with distance from focus
    const normalizedDistance = Math.min(distance / radius, 1);
    return normalizedDistance * maxBlur;
  });

  return (
    <Animated.View style={useAnimatedStyle(() => ({
      // Note: RN doesn't support blur animation directly,
      // would need BlurView with animated intensity
    }))}>
      {children}
    </Animated.View>
  );
}
```

---

### 8. Intent Detection System

**Concept:** Infer user intent from gesture characteristics before completion

#### Implementation

```typescript
// src/utils/intentDetection.ts

/**
 * Detect gesture intent from acceleration/velocity patterns
 *
 * From Apple: "There's a huge spike in acceleration when you pause.
 * The faster you stop, the faster we can detect it."
 */

export type GestureIntent =
  | 'scroll'
  | 'swipe'
  | 'tap'
  | 'longPress'
  | 'pause'  // Finger stopped mid-gesture
  | 'flick'
  | 'drag';

interface GestureMetrics {
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  duration: number;
  distance: number;
}

export function detectIntent(metrics: GestureMetrics): GestureIntent {
  const speed = Math.sqrt(
    metrics.velocity.x ** 2 + metrics.velocity.y ** 2
  );
  const accel = Math.sqrt(
    metrics.acceleration.x ** 2 + metrics.acceleration.y ** 2
  );

  // High deceleration = pause
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

/**
 * Track acceleration (rate of velocity change)
 */
export function trackAcceleration() {
  let lastVelocity = { x: 0, y: 0, time: Date.now() };

  return (currentVelocity: { x: number; y: number }) => {
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
```

---

## Implementation Order

### Phase 1: Foundation (Week 1)
1. Create `src/theme/springs.ts` with Apple-style spring system
2. Create `src/utils/fluidGestures.ts` with projection
3. Create `src/utils/rubberbanding.ts`
4. Update existing spring configs in tokens.ts

### Phase 2: Primitives (Week 2)
5. Create `src/hooks/useFluidValue.ts`
6. Create `src/hooks/useDirectManipulation.ts`
7. Create `src/utils/intentDetection.ts`

### Phase 3: Integration (Week 3)
8. Update AnimatedPressable with new springs
9. Add rubberbanding to scrollable components
10. Make DynamicIsland redirectable
11. Update CoverFlow with projection

### Phase 4: Polish (Week 4)
12. Implement spatial consistency in navigation
13. Add Kiri fog focus system
14. Tune all spring values through testing
15. Verify haptic choreography

---

## Testing Checklist

For each component, verify:

- [ ] **Response:** No perceptible delay to first frame
- [ ] **Interruption:** Can redirect any animation immediately
- [ ] **Tracking:** One-to-one during gesture
- [ ] **Boundaries:** Rubberbanding at edges
- [ ] **Momentum:** Velocity projection for endpoints
- [ ] **Spatial:** Symmetric enter/exit paths
- [ ] **Springs:** Appropriate bounciness for context
- [ ] **Haptics:** Feedback synchronized to key moments

---

## References

- [WWDC 2018: Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/)
- [MercuryOS Design Philosophy](https://www.mercuryos.com)
- [React Native Reanimated Spring Animation](https://docs.swmansion.com/react-native-reanimated/)
- [Gesture Handler Documentation](https://docs.swmansion.com/react-native-gesture-handler/)
