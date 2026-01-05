/**
 * Cinematic Effects System - Unified Apple-Level Experience Orchestration
 *
 * The conductor that weaves all effects into the fabric of the UI:
 * - Live Activities integration for persistent Lock Screen presence
 * - Global effect state management
 * - Haptic choreography synchronized to animations
 * - Contextual effect triggers based on app state
 *
 * This creates the "invisible" magic that makes Apple devices feel alive.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

// Import iOS Live Activity service
import {
  startThinkingActivity,
  showResponsePreview,
  showErrorState,
  stopActivity,
} from '../services/liveActivity';

// Import all cinematic components
import { DynamicIsland, DynamicIslandState, DynamicIslandActivity } from './DynamicIsland';
import {
  ParticleField,
  AuroraBackground,
  DiscoveryPulse,
} from './AirDropEffects';
import {
  Starfield,
  WarpSpeed,
} from './TimeMachineEffects';

// ============================================================================
// LIVE ACTIVITY TYPES - iOS Lock Screen Integration
// ============================================================================

export interface LiveActivityState {
  id: string;
  type: 'chat' | 'browse' | 'thinking' | 'download' | 'timer';
  title: string;
  subtitle?: string;
  progress?: number;
  startTime?: Date;
  estimatedEndTime?: Date;
  isActive: boolean;
  priority: 'low' | 'default' | 'high' | 'critical';
}

export interface LiveActivityUpdate {
  title?: string;
  subtitle?: string;
  progress?: number;
  priority?: LiveActivityState['priority'];
}

// ============================================================================
// HAPTIC CHOREOGRAPHY - Synchronized Feedback Patterns
// ============================================================================

export type HapticPattern =
  | 'success'
  | 'error'
  | 'warning'
  | 'selection'
  | 'impact_light'
  | 'impact_medium'
  | 'impact_heavy'
  | 'soft_pulse'
  | 'double_tap'
  | 'triple_pulse'
  | 'heartbeat'
  | 'notification'
  | 'warp_jump'
  | 'discovery'
  | 'scroll_stop'
  | 'morphing';

const hapticPatterns: Record<HapticPattern, () => Promise<void>> = {
  success: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  warning: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  selection: async () => {
    await Haptics.selectionAsync();
  },
  impact_light: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  impact_medium: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  impact_heavy: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  soft_pulse: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },
  double_tap: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((r) => setTimeout(r, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  triple_pulse: async () => {
    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 80));
    }
  },
  heartbeat: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 150));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 400));
  },
  notification: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    await new Promise((r) => setTimeout(r, 50));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },
  warp_jump: async () => {
    // Building anticipation then release
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    await new Promise((r) => setTimeout(r, 50));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 50));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 200));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  discovery: async () => {
    // Magical reveal
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((r) => setTimeout(r, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 150));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  scroll_stop: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  },
  morphing: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    await new Promise((r) => setTimeout(r, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
};

// ============================================================================
// EFFECT ORCHESTRATION STATE
// ============================================================================

export type EffectMode =
  | 'idle'
  | 'ambient'
  | 'active'
  | 'thinking'
  | 'browsing'
  | 'celebrating'
  | 'error'
  | 'warp'
  | 'discovery';

// ============================================================================
// CINEMATIC CONTEXT
// ============================================================================

interface CinematicContextValue {
  // Effect orchestration
  effectMode: EffectMode;
  setEffectMode: (mode: EffectMode) => void;
  intensity: 'subtle' | 'normal' | 'intense';
  setIntensity: (intensity: 'subtle' | 'normal' | 'intense') => void;

  // Dynamic Island
  showDynamicIsland: (
    activity: DynamicIslandActivity,
    title?: string,
    subtitle?: string
  ) => void;
  hideDynamicIsland: () => void;
  expandDynamicIsland: () => void;
  collapseDynamicIsland: () => void;
  setDynamicIslandProgress: (progress: number) => void;

  // Live Activities
  startLiveActivity: (activity: Omit<LiveActivityState, 'id' | 'isActive'>) => string;
  updateLiveActivity: (id: string, update: LiveActivityUpdate) => void;
  endLiveActivity: (id: string) => void;
  activeLiveActivities: LiveActivityState[];

  // Haptic orchestration
  playHaptic: (pattern: HapticPattern) => void;
  playHapticSequence: (patterns: HapticPattern[], delays?: number[]) => void;

  // Effect triggers
  triggerDiscovery: (x: number, y: number, color?: string) => void;
  triggerWarp: (onComplete?: () => void) => void;
  triggerCelebration: () => void;
  triggerError: () => void;

  // Ambient state (read-only)
  ambientEnabled: boolean;
  particlesEnabled: boolean;
  starsEnabled: boolean;

  // Ambient controls
  setAmbientEnabled: (enabled: boolean) => void;
  setParticlesEnabled: (enabled: boolean) => void;
  setStarsEnabled: (enabled: boolean) => void;
}

const CinematicContext = createContext<CinematicContextValue | null>(null);

export function useCinematic() {
  const context = useContext(CinematicContext);
  if (!context) {
    throw new Error('useCinematic must be used within CinematicProvider');
  }
  return context;
}

// ============================================================================
// CINEMATIC PROVIDER - The Orchestration Engine
// ============================================================================

interface CinematicProviderProps {
  children: React.ReactNode;
  defaultIntensity?: 'subtle' | 'normal' | 'intense';
  enableAmbient?: boolean;
}

export function CinematicProvider({
  children,
  defaultIntensity = 'normal',
  enableAmbient = true,
}: CinematicProviderProps) {
  const { colors } = useTheme();

  // Core state
  const [effectMode, setEffectMode] = useState<EffectMode>('idle');
  const [intensity, setIntensity] = useState<'subtle' | 'normal' | 'intense'>(defaultIntensity);
  const [ambientEnabled, setAmbientEnabled] = useState(enableAmbient);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [starsEnabled, setStarsEnabled] = useState(true);

  // Dynamic Island state
  const [islandState, setIslandState] = useState<DynamicIslandState>('hidden');
  const [islandActivity, setIslandActivity] = useState<DynamicIslandActivity>('idle');
  const [islandTitle, setIslandTitle] = useState<string>();
  const [islandSubtitle, setIslandSubtitle] = useState<string>();
  const [islandProgress, setIslandProgress] = useState<number>();

  // Live Activities
  const [liveActivities, setLiveActivities] = useState<LiveActivityState[]>([]);
  const activityIdCounter = useRef(0);

  // Effect triggers state
  const [discoveryPulses, setDiscoveryPulses] = useState<
    { id: string; x: number; y: number; color?: string }[]
  >([]);
  const [warpActive, setWarpActive] = useState(false);
  const warpCallback = useRef<(() => void) | null>(null);

  // App state tracking for background/foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Resume ambient effects
        if (ambientEnabled) {
          setEffectMode((prev) => (prev === 'idle' ? 'ambient' : prev));
        }
      } else if (nextAppState === 'background') {
        // Reduce to idle when backgrounded
        setEffectMode('idle');
      }
    });

    return () => subscription.remove();
  }, [ambientEnabled]);

  // Dynamic Island controls
  const showDynamicIsland = useCallback(
    (activity: DynamicIslandActivity, title?: string, subtitle?: string) => {
      setIslandActivity(activity);
      setIslandTitle(title);
      setIslandSubtitle(subtitle);
      setIslandState('compact');
      playHaptic('morphing');
    },
    []
  );

  const hideDynamicIsland = useCallback(() => {
    setIslandState('hidden');
    playHaptic('soft_pulse');
  }, []);

  const expandDynamicIsland = useCallback(() => {
    setIslandState('expanded');
    playHaptic('impact_medium');
  }, []);

  const collapseDynamicIsland = useCallback(() => {
    setIslandState('compact');
    playHaptic('impact_light');
  }, []);

  const setDynamicIslandProgress = useCallback((progress: number) => {
    setIslandProgress(progress);
  }, []);

  // Live Activity controls
  const startLiveActivity = useCallback(
    (activity: Omit<LiveActivityState, 'id' | 'isActive'>): string => {
      const id = `activity_${++activityIdCounter.current}`;
      const newActivity: LiveActivityState = {
        ...activity,
        id,
        isActive: true,
        startTime: new Date(),
      };
      setLiveActivities((prev) => [...prev, newActivity]);

      // Show in Dynamic Island
      const activityMap: Record<LiveActivityState['type'], DynamicIslandActivity> = {
        chat: 'thinking',
        browse: 'browsing',
        thinking: 'thinking',
        download: 'connecting',
        timer: 'idle',
      };
      showDynamicIsland(
        activityMap[activity.type],
        activity.title,
        activity.subtitle
      );

      playHaptic('notification');
      return id;
    },
    [showDynamicIsland]
  );

  const updateLiveActivity = useCallback(
    (id: string, update: LiveActivityUpdate) => {
      setLiveActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...update } : a))
      );

      // Sync with Dynamic Island
      if (update.title) setIslandTitle(update.title);
      if (update.subtitle) setIslandSubtitle(update.subtitle);
      if (update.progress !== undefined) setIslandProgress(update.progress);
    },
    []
  );

  const endLiveActivity = useCallback((id: string) => {
    setLiveActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: false } : a))
    );

    // Remove after animation
    setTimeout(() => {
      setLiveActivities((prev) => prev.filter((a) => a.id !== id));
    }, 500);

    playHaptic('success');
  }, []);

  // Haptic controls
  const playHaptic = useCallback((pattern: HapticPattern) => {
    hapticPatterns[pattern]?.();
  }, []);

  const playHapticSequence = useCallback(
    async (patterns: HapticPattern[], delays: number[] = []) => {
      for (let i = 0; i < patterns.length; i++) {
        await hapticPatterns[patterns[i]]?.();
        if (delays[i]) {
          await new Promise((r) => setTimeout(r, delays[i]));
        }
      }
    },
    []
  );

  // Effect triggers
  const triggerDiscovery = useCallback((x: number, y: number, color?: string) => {
    const id = `pulse_${Date.now()}`;
    setDiscoveryPulses((prev) => [...prev, { id, x, y, color }]);
    setEffectMode('discovery');
    playHaptic('discovery');

    // Auto-cleanup
    setTimeout(() => {
      setDiscoveryPulses((prev) => prev.filter((p) => p.id !== id));
      setEffectMode('ambient');
    }, 1000);
  }, []);

  const triggerWarp = useCallback((onComplete?: () => void) => {
    warpCallback.current = onComplete || null;
    setWarpActive(true);
    setEffectMode('warp');
    playHaptic('warp_jump');
  }, []);

  const handleWarpComplete = useCallback(() => {
    setWarpActive(false);
    setEffectMode('ambient');
    warpCallback.current?.();
    warpCallback.current = null;
  }, []);

  const triggerCelebration = useCallback(() => {
    setEffectMode('celebrating');
    playHapticSequence(['impact_light', 'impact_medium', 'impact_heavy', 'success'], [100, 100, 100]);

    setTimeout(() => setEffectMode('ambient'), 3000);
  }, [playHapticSequence]);

  const triggerError = useCallback(() => {
    setEffectMode('error');
    playHaptic('error');

    setTimeout(() => setEffectMode('ambient'), 2000);
  }, []);

  // Context value
  const contextValue = useMemo<CinematicContextValue>(
    () => ({
      effectMode,
      setEffectMode,
      intensity,
      setIntensity,
      showDynamicIsland,
      hideDynamicIsland,
      expandDynamicIsland,
      collapseDynamicIsland,
      setDynamicIslandProgress,
      startLiveActivity,
      updateLiveActivity,
      endLiveActivity,
      activeLiveActivities: liveActivities.filter((a) => a.isActive),
      playHaptic,
      playHapticSequence,
      triggerDiscovery,
      triggerWarp,
      triggerCelebration,
      triggerError,
      ambientEnabled,
      particlesEnabled,
      starsEnabled,
      setAmbientEnabled,
      setParticlesEnabled,
      setStarsEnabled,
    }),
    [
      effectMode,
      intensity,
      liveActivities,
      ambientEnabled,
      particlesEnabled,
      starsEnabled,
      showDynamicIsland,
      hideDynamicIsland,
      expandDynamicIsland,
      collapseDynamicIsland,
      setDynamicIslandProgress,
      startLiveActivity,
      updateLiveActivity,
      endLiveActivity,
      playHaptic,
      playHapticSequence,
      triggerDiscovery,
      triggerWarp,
      triggerCelebration,
      triggerError,
    ]
  );

  return (
    <CinematicContext.Provider value={contextValue}>
      {children}

      {/* Global Effect Layers */}
      <View style={styles.effectsContainer} pointerEvents="none">
        {/* Ambient background effects */}
        {ambientEnabled && effectMode !== 'idle' && (
          <AuroraBackground
            intensity={intensity === 'subtle' ? 0.1 : intensity === 'intense' ? 0.25 : 0.15}
            speed={10000}
          />
        )}

        {/* Starfield for certain modes */}
        {starsEnabled && (effectMode === 'thinking' || effectMode === 'browsing' || effectMode === 'warp') && (
          <Starfield
            starCount={intensity === 'subtle' ? 30 : intensity === 'intense' ? 80 : 50}
            speed={effectMode === 'warp' ? 3 : 1}
            active
          />
        )}

        {/* Discovery pulses */}
        {discoveryPulses.map((pulse) => (
          <DiscoveryPulse
            key={pulse.id}
            x={pulse.x}
            y={pulse.y}
            color={pulse.color || colors.accent.primary}
          />
        ))}

        {/* Warp speed effect */}
        <WarpSpeed
          active={warpActive}
          onComplete={handleWarpComplete}
          color={colors.accent.primary}
        />
      </View>

      {/* Dynamic Island - always on top */}
      <DynamicIsland
        state={islandState}
        activity={islandActivity}
        title={islandTitle}
        subtitle={islandSubtitle}
        progress={islandProgress}
        onPress={() => {
          if (islandState === 'compact') {
            expandDynamicIsland();
          } else if (islandState === 'expanded') {
            collapseDynamicIsland();
          }
        }}
        onLongPress={hideDynamicIsland}
      />
    </CinematicContext.Provider>
  );
}

// ============================================================================
// EFFECT HOOKS - Easy integration into screens
// ============================================================================

/**
 * Hook to show thinking state with automatic cleanup
 * Integrates with both in-app Dynamic Island effect AND iOS Live Activities
 */
export function useThinkingEffect() {
  const { showDynamicIsland, hideDynamicIsland, setEffectMode } = useCinematic();
  const isThinking = useRef(false);

  const startThinking = useCallback(
    (title?: string) => {
      if (!isThinking.current) {
        isThinking.current = true;
        // In-app Dynamic Island visual effect
        showDynamicIsland('thinking', title || 'Thinking...');
        setEffectMode('thinking');
        // iOS Live Activity for lock screen presence
        startThinkingActivity();
      }
    },
    [showDynamicIsland, setEffectMode]
  );

  const stopThinking = useCallback(
    (success = true, response?: string) => {
      if (isThinking.current) {
        isThinking.current = false;
        // In-app Dynamic Island visual effect
        hideDynamicIsland();
        setEffectMode('ambient');
        // iOS Live Activity update
        if (success && response) {
          showResponsePreview(response);
        } else if (!success) {
          showErrorState();
        } else {
          stopActivity();
        }
      }
    },
    [hideDynamicIsland, setEffectMode]
  );

  return { startThinking, stopThinking, isThinking: isThinking.current };
}

/**
 * Hook to show browsing state with progress
 * Integrates with both in-app Dynamic Island effect AND iOS Live Activities
 */
export function useBrowsingEffect() {
  const {
    showDynamicIsland,
    hideDynamicIsland,
    setDynamicIslandProgress,
    setEffectMode,
  } = useCinematic();

  const startBrowsing = useCallback(
    (url?: string) => {
      // In-app Dynamic Island visual effect
      showDynamicIsland('browsing', 'Searching...', url);
      setEffectMode('browsing');
      setDynamicIslandProgress(0);
      // iOS Live Activity for lock screen presence
      startThinkingActivity();
    },
    [showDynamicIsland, setEffectMode, setDynamicIslandProgress]
  );

  const updateProgress = useCallback(
    (progress: number) => {
      setDynamicIslandProgress(progress);
    },
    [setDynamicIslandProgress]
  );

  const completeBrowsing = useCallback(
    (success = true, result?: string) => {
      setDynamicIslandProgress(1);
      setTimeout(() => {
        // In-app Dynamic Island visual effect
        hideDynamicIsland();
        setEffectMode('ambient');
        // iOS Live Activity update
        if (success && result) {
          showResponsePreview(result);
        } else if (!success) {
          showErrorState();
        } else {
          stopActivity();
        }
      }, 500);
    },
    [hideDynamicIsland, setEffectMode, setDynamicIslandProgress]
  );

  return { startBrowsing, updateProgress, completeBrowsing };
}

/**
 * Hook for Live Activity management
 */
export function useLiveActivity(type: LiveActivityState['type']) {
  const { startLiveActivity, updateLiveActivity, endLiveActivity } = useCinematic();
  const activityId = useRef<string | null>(null);

  const start = useCallback(
    (title: string, subtitle?: string) => {
      if (!activityId.current) {
        activityId.current = startLiveActivity({ type, title, subtitle, priority: 'default' });
      }
      return activityId.current;
    },
    [startLiveActivity, type]
  );

  const update = useCallback(
    (updates: LiveActivityUpdate) => {
      if (activityId.current) {
        updateLiveActivity(activityId.current, updates);
      }
    },
    [updateLiveActivity]
  );

  const end = useCallback(() => {
    if (activityId.current) {
      endLiveActivity(activityId.current);
      activityId.current = null;
    }
  }, [endLiveActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityId.current) {
        endLiveActivity(activityId.current);
      }
    };
  }, [endLiveActivity]);

  return { start, update, end, isActive: !!activityId.current };
}

// ============================================================================
// AMBIENT LAYER - Background visual atmosphere
// ============================================================================

interface AmbientLayerProps {
  variant?: 'aurora' | 'stars' | 'particles' | 'full';
  intensity?: 'subtle' | 'normal' | 'intense';
}

export function AmbientLayer({
  variant = 'full',
  intensity = 'subtle',
}: AmbientLayerProps) {
  const { colors } = useTheme();
  const { effectMode, ambientEnabled } = useCinematic();

  if (!ambientEnabled || effectMode === 'idle') return null;

  const intensityMap = {
    subtle: { particles: 8, stars: 20, aurora: 0.08 },
    normal: { particles: 15, stars: 40, aurora: 0.15 },
    intense: { particles: 25, stars: 60, aurora: 0.25 },
  };

  const config = intensityMap[intensity];

  return (
    <View style={styles.ambientContainer} pointerEvents="none">
      {(variant === 'aurora' || variant === 'full') && (
        <AuroraBackground intensity={config.aurora} />
      )}
      {(variant === 'stars' || variant === 'full') && (
        <Starfield starCount={config.stars} speed={0.5} />
      )}
      {(variant === 'particles' || variant === 'full') && (
        <ParticleField
          particleCount={config.particles}
          color={colors.accent.primary}
        />
      )}
    </View>
  );
}

// ============================================================================
// CINEMATIC TRANSITION - Page transition wrapper
// ============================================================================

interface CinematicTransitionProps {
  children: React.ReactNode;
  variant?: 'fade' | 'warp' | 'discovery' | 'slide';
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

export function CinematicTransition({
  children,
  variant = 'fade',
  onTransitionStart,
  onTransitionEnd,
}: CinematicTransitionProps) {
  const { playHaptic, triggerWarp } = useCinematic();
  const progress = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      onTransitionStart?.();

      if (variant === 'warp') {
        triggerWarp();
      }

      progress.value = withTiming(1, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(onTransitionEnd || (() => {}))();
        }
      });

      playHaptic('morphing');
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    switch (variant) {
      case 'warp':
        return {
          opacity: interpolate(progress.value, [0, 0.3, 1], [0, 1, 1]),
          transform: [
            { scale: interpolate(progress.value, [0, 0.5, 1], [0.8, 1.05, 1]) },
          ],
        };
      case 'discovery':
        return {
          opacity: progress.value,
          transform: [
            { scale: interpolate(progress.value, [0, 0.7, 1], [0.9, 1.02, 1]) },
          ],
        };
      case 'slide':
        return {
          opacity: progress.value,
          transform: [
            { translateY: interpolate(progress.value, [0, 1], [50, 0]) },
          ],
        };
      default: // fade
        return {
          opacity: progress.value,
        };
    }
  });

  return <Animated.View style={[styles.transitionContainer, animatedStyle]}>{children}</Animated.View>;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  effectsContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  ambientContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  transitionContainer: {
    flex: 1,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CinematicProvider,
  useCinematic,
  useThinkingEffect,
  useBrowsingEffect,
  useLiveActivity,
  AmbientLayer,
  CinematicTransition,
};
