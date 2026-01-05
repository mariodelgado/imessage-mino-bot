/**
 * Live Activity Service for Mino
 *
 * Displays AI responses and thinking state on the iOS lock screen
 * and Dynamic Island using expo-live-activity.
 *
 * Requires iOS 16.2+ and iPhone 14 Pro+ for Dynamic Island.
 */

import * as LiveActivity from 'expo-live-activity';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface MinoActivityState {
  title: string;
  subtitle?: string;
  isThinking?: boolean;
  progress?: number;
  estimatedEndTime?: number;
}

// Store for managing active activities
let currentActivityId: string | undefined;
let thinkingTimer: ReturnType<typeof setInterval> | undefined;

// ============================================================================
// MINO KIRI-STYLE CONFIG
// ============================================================================

// MercuryOS Kiri-inspired styling - dark, moonlight incandescence
const KiriConfig: LiveActivity.LiveActivityConfig = {
  backgroundColor: '#0A0A0A',
  titleColor: '#FFFFFF',
  subtitleColor: 'rgba(255, 255, 255, 0.6)',
  progressViewTint: 'rgba(255, 255, 255, 0.9)',
  progressViewLabelColor: 'rgba(255, 255, 255, 0.4)',
  timerType: 'circular',
  padding: { horizontal: 16, top: 12, bottom: 12 },
  imagePosition: 'left',
  imageAlign: 'center',
};

// ============================================================================
// PLATFORM CHECK
// ============================================================================

function isLiveActivitySupported(): boolean {
  // Only iOS 16.2+ supports Live Activities
  if (Platform.OS !== 'ios') {
    return false;
  }

  // Check iOS version
  const iosVersion = parseInt(Platform.Version as string, 10);
  return iosVersion >= 16;
}

// ============================================================================
// ACTIVITY LIFECYCLE
// ============================================================================

/**
 * Start a "thinking" Live Activity when Mino is processing
 */
export function startThinkingActivity(): string | undefined {
  if (!isLiveActivitySupported()) {
    console.log('[LiveActivity] Not supported on this platform');
    return undefined;
  }

  // Stop any existing activity first
  if (currentActivityId) {
    stopActivity();
  }

  const state: LiveActivity.LiveActivityState = {
    title: 'Mino is thinking',
    subtitle: 'Processing your request...',
    progressBar: {
      progress: 0.1,
    },
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  const activityId = LiveActivity.startActivity(state, KiriConfig);
  currentActivityId = activityId || undefined;

  // Animated progress for thinking state
  if (currentActivityId) {
    let progress = 0.1;
    thinkingTimer = setInterval(() => {
      // Ease progress up to 0.9 (never complete until actual response)
      progress = Math.min(0.9, progress + 0.05 * (1 - progress));
      updateThinkingProgress(progress);
    }, 500);
  }

  return currentActivityId;
}

/**
 * Update thinking progress
 */
function updateThinkingProgress(progress: number): void {
  if (!currentActivityId) return;

  const state: LiveActivity.LiveActivityState = {
    title: 'Mino is thinking',
    subtitle: getThinkingSubtitle(progress),
    progressBar: {
      progress,
    },
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  LiveActivity.updateActivity(currentActivityId, state);
}

/**
 * Get contextual subtitle based on progress
 */
function getThinkingSubtitle(progress: number): string {
  if (progress < 0.3) return 'Processing your request...';
  if (progress < 0.5) return 'Searching for answers...';
  if (progress < 0.7) return 'Analyzing information...';
  return 'Almost there...';
}

/**
 * Show response preview in Live Activity
 */
export function showResponsePreview(
  response: string,
  durationMs: number = 5000
): void {
  if (!isLiveActivitySupported() || !currentActivityId) return;

  // Clear thinking timer
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = undefined;
  }

  // Truncate response for lock screen
  const truncatedResponse =
    response.length > 100 ? response.substring(0, 97) + '...' : response;

  const state: LiveActivity.LiveActivityState = {
    title: 'Mino',
    subtitle: truncatedResponse,
    progressBar: {
      progress: 1.0,
    },
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  LiveActivity.updateActivity(currentActivityId, state);

  // Auto-dismiss after duration
  setTimeout(() => {
    stopActivity();
  }, durationMs);
}

/**
 * Show error state in Live Activity
 */
export function showErrorState(errorMessage?: string): void {
  if (!isLiveActivitySupported() || !currentActivityId) return;

  // Clear thinking timer
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = undefined;
  }

  const state: LiveActivity.LiveActivityState = {
    title: 'Mino',
    subtitle: errorMessage || 'Something went wrong. Tap to try again.',
    progressBar: {
      progress: 1.0,
    },
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  LiveActivity.updateActivity(currentActivityId, state);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    stopActivity();
  }, 3000);
}

/**
 * Stop the current Live Activity
 */
export function stopActivity(): void {
  // Clear thinking timer
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = undefined;
  }

  if (!currentActivityId) return;

  const finalState: LiveActivity.LiveActivityState = {
    title: 'Mino',
    subtitle: 'Response complete',
    progressBar: {
      progress: 1.0,
    },
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  LiveActivity.stopActivity(currentActivityId, finalState);
  currentActivityId = undefined;
}

/**
 * Check if there's an active Live Activity
 */
export function hasActiveActivity(): boolean {
  return currentActivityId !== undefined;
}

/**
 * Get the current activity ID
 */
export function getCurrentActivityId(): string | undefined {
  return currentActivityId;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Start a timed activity (e.g., for long-running tasks)
 */
export function startTimedActivity(
  title: string,
  subtitle: string,
  durationMs: number
): string | undefined {
  if (!isLiveActivitySupported()) return undefined;

  // Stop any existing activity
  if (currentActivityId) {
    stopActivity();
  }

  const endTime = Date.now() + durationMs;

  const state: LiveActivity.LiveActivityState = {
    title,
    subtitle,
    progressBar: {
      date: endTime,
    },
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  const activityId = LiveActivity.startActivity(state, KiriConfig);
  currentActivityId = activityId || undefined;
  return currentActivityId;
}

/**
 * Update activity with custom state
 */
export function updateActivity(
  title: string,
  subtitle: string,
  progress?: number
): void {
  if (!currentActivityId) return;

  const state: LiveActivity.LiveActivityState = {
    title,
    subtitle,
    progressBar: progress !== undefined ? { progress } : undefined,
    imageName: 'mino_icon',
    dynamicIslandImageName: 'mino_icon_small',
  };

  LiveActivity.updateActivity(currentActivityId, state);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  isSupported: isLiveActivitySupported,
  startThinking: startThinkingActivity,
  showResponse: showResponsePreview,
  showError: showErrorState,
  stop: stopActivity,
  hasActive: hasActiveActivity,
  getActivityId: getCurrentActivityId,
  startTimed: startTimedActivity,
  update: updateActivity,
};
