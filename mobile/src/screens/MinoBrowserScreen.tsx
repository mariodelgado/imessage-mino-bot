/**
 * Mino Browser Screen - Elite iOS 26 Browser Automation Viewer
 *
 * Premium features:
 * - Liquid glass header and overlays
 * - Smooth spring animations
 * - Gesture-based controls
 * - Real-time screenshot streaming
 * - Full HIG compliance
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  SlideInUp,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useMinoStore } from '../stores/minoStore';
import { useTheme } from '../theme';
import {
  useBrowsingEffect,
  AmbientLayer,
} from '../components/CinematicEffects';
import {
  LiquidGlassCard,
  AnimatedPressable,
  PulseIndicator,
  StaggerItem,
} from '../components';
import {
  Title2,
  Body,
  Subheadline,
  Footnote,
  Caption1,
  Caption2,
  Label,
} from '../components/Typography';
import {
  SearchIcon,
  ClickIcon,
  TypeIcon,
  NavigateIcon,
  ScreenshotIcon,
  CloseIcon,
} from '../components/Icons';
import { spacing, borderRadius } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCREENSHOT_ASPECT_RATIO = 16 / 9;

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  const { colors } = useTheme();

  const examples = [
    'Search for the best pizza near me',
    'Find the weather in Tokyo',
    'Look up React Native documentation',
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={styles.emptyContainer}
    >
      <Animated.View
        entering={FadeInUp.delay(100).duration(500).springify()}
        style={styles.emptyIconWrapper}
      >
        <Animated.Text style={styles.emptyIcon}>🌐</Animated.Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <Title2 color={colors.foreground.primary} align="center">
          No Active Browser Session
        </Title2>
        <Subheadline
          color={colors.foreground.secondary}
          align="center"
          style={styles.emptySubtitle}
        >
          Ask Mino to browse the web for you. For example:
        </Subheadline>
      </Animated.View>

      <View style={styles.examplesWrapper}>
        {examples.map((example, index) => (
          <StaggerItem key={example} index={index} delay={100}>
            <LiquidGlassCard style={styles.exampleCard} intensity="strong">
              <Subheadline color={colors.accent.primary} style={styles.exampleText}>
                "{example}"
              </Subheadline>
            </LiquidGlassCard>
          </StaggerItem>
        ))}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================

interface StatusBadgeProps {
  status: 'starting' | 'active' | 'completed' | 'error';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const { colors } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'starting':
        return { color: colors.status.warning, text: 'Starting...' };
      case 'active':
        return { color: colors.status.success, text: 'Browsing' };
      case 'completed':
        return { color: colors.accent.primary, text: 'Completed' };
      case 'error':
        return { color: colors.status.error, text: 'Error' };
      default:
        return { color: colors.foreground.muted, text: 'Unknown' };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}
    >
      <View style={styles.statusBadgeContent}>
        {status === 'active' ? (
          <PulseIndicator size={8} color={config.color} active />
        ) : (
          <View
            style={[styles.statusDot, { backgroundColor: config.color }]}
          />
        )}
        <Caption1 color={config.color} style={styles.statusLabel}>
          {config.text}
        </Caption1>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// LIQUID GLASS HEADER
// ============================================================================

interface HeaderProps {
  goal: string;
  url: string;
  status: 'starting' | 'active' | 'completed' | 'error';
  onStop: () => void;
}

function Header({ goal, url, status, onStop }: HeaderProps) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View
      entering={SlideInUp.duration(400).springify()}
      style={styles.headerContainer}
    >
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background.glass },
        ]}
      />
      <View style={[styles.headerBorder, { borderBottomColor: colors.border.glass }]} />

      <View style={styles.headerContent}>
        <View style={styles.headerTop}>
          <StatusBadge status={status} />

          {status === 'active' && (
            <AnimatedPressable onPress={onStop} haptic="heavy">
              <View style={[styles.stopButton, { backgroundColor: colors.status.error }]}>
                <CloseIcon size="xs" color="#FFF" />
                <Caption1 color="#FFF" style={styles.stopButtonText}>
                  Stop
                </Caption1>
              </View>
            </AnimatedPressable>
          )}
        </View>

        <Subheadline
          color={colors.foreground.primary}
          numberOfLines={2}
          style={styles.goalText}
        >
          {goal}
        </Subheadline>

        <Caption2 color={colors.foreground.muted} numberOfLines={1}>
          {url}
        </Caption2>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// SCREENSHOT VIEWER
// ============================================================================

interface ScreenshotViewerProps {
  screenshot: string | null;
  status: 'starting' | 'active' | 'completed' | 'error';
}

function ScreenshotViewer({ screenshot, status }: ScreenshotViewerProps) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={[
        styles.screenshotContainer,
        { backgroundColor: isDark ? '#111' : '#F5F5F5' },
      ]}
    >
      {screenshot ? (
        <Image
          source={{ uri: `data:image/png;base64,${screenshot}` }}
          style={styles.screenshot}
          resizeMode="contain"
          accessibilityLabel="Browser screenshot"
        />
      ) : (
        <View style={styles.screenshotPlaceholder}>
          <ScreenshotIcon size="2xl" color={colors.foreground.muted} />
          <Footnote color={colors.foreground.muted} style={styles.placeholderText}>
            {status === 'starting'
              ? 'Loading browser...'
              : 'Waiting for screenshot...'}
          </Footnote>
        </View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// ACTION LOG
// ============================================================================

interface ActionItemProps {
  action: string;
  thought?: string;
  timestamp: Date;
  index: number;
}

function ActionItem({ action, thought, timestamp, index }: ActionItemProps) {
  const { colors } = useTheme();

  const getActionIcon = () => {
    const lower = action.toLowerCase();
    if (lower.includes('click') || lower.includes('tap')) {
      return <ClickIcon size="sm" color={colors.accent.primary} />;
    }
    if (lower.includes('type') || lower.includes('input') || lower.includes('fill')) {
      return <TypeIcon size="sm" color={colors.accent.primary} />;
    }
    if (lower.includes('navigate') || lower.includes('go to') || lower.includes('visit')) {
      return <NavigateIcon size="sm" color={colors.accent.primary} />;
    }
    if (lower.includes('search') || lower.includes('find')) {
      return <SearchIcon size="sm" color={colors.accent.primary} />;
    }
    if (lower.includes('screenshot') || lower.includes('capture')) {
      return <ScreenshotIcon size="sm" color={colors.accent.primary} />;
    }
    return <View style={[styles.actionDot, { backgroundColor: colors.accent.primary }]} />;
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(300).springify()}
      layout={Layout.springify()}
      style={styles.actionItem}
    >
      <View style={styles.actionIconContainer}>{getActionIcon()}</View>
      <View style={styles.actionContent}>
        <Body color={colors.foreground.primary}>{action}</Body>
        {thought && (
          <Footnote color={colors.foreground.secondary} style={styles.thoughtText}>
            {thought}
          </Footnote>
        )}
        <Caption2 color={colors.foreground.muted} style={styles.actionTime}>
          {timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Caption2>
      </View>
    </Animated.View>
  );
}

interface ActionLogProps {
  actions: { action: string; thought?: string; timestamp: Date }[];
}

function ActionLog({ actions }: ActionLogProps) {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (actions.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [actions.length]);

  return (
    <View style={styles.actionLogContainer}>
      <Label color={colors.foreground.tertiary} style={styles.actionLogTitle}>
        Actions
      </Label>
      <ScrollView
        ref={scrollViewRef}
        style={styles.actionLog}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.actionLogContent}
      >
        {actions.length === 0 ? (
          <Footnote color={colors.foreground.muted}>
            No actions yet...
          </Footnote>
        ) : (
          actions.map((action, index) => (
            <ActionItem
              key={`${action.action}-${index}`}
              action={action.action}
              thought={action.thought}
              timestamp={action.timestamp}
              index={index}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// RESULT/ERROR DISPLAY
// ============================================================================

interface ResultDisplayProps {
  result: unknown;
  variant: 'success' | 'error';
  onDismiss?: () => void;
}

function ResultDisplay({ result, variant, onDismiss }: ResultDisplayProps) {
  const { colors, isDark } = useTheme();

  const isError = variant === 'error';
  const bgColor = isError
    ? colors.status.error + '15'
    : colors.accent.primary + '15';
  const borderColor = isError
    ? colors.status.error + '40'
    : colors.accent.primary + '40';
  const textColor = isError ? colors.status.error : colors.accent.primary;

  const displayText =
    typeof result === 'string'
      ? result
      : typeof result === 'object' && result !== null && 'error' in result
      ? (result as { error: string }).error
      : JSON.stringify(result, null, 2);

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={[
        styles.resultContainer,
        { backgroundColor: bgColor, borderColor },
      ]}
    >
      <BlurView
        intensity={20}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.resultContent}>
        <Label color={textColor}>{isError ? 'Error' : 'Result'}</Label>
        <Body color={colors.foreground.primary} style={styles.resultText}>
          {displayText}
        </Body>
        {onDismiss && (
          <AnimatedPressable onPress={onDismiss} haptic="light">
            <View
              style={[styles.dismissButton, { backgroundColor: colors.background.tertiary }]}
            >
              <Caption1 color={colors.foreground.secondary}>Dismiss</Caption1>
            </View>
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// MAIN BROWSER SCREEN
// ============================================================================

export default function MinoBrowserScreen() {
  const { colors } = useTheme();
  const { session, latestScreenshot, endSession } = useMinoStore();

  // Cinematic browsing effects - syncs with Dynamic Island
  const { startBrowsing, completeBrowsing } = useBrowsingEffect();

  // Sync session status with cinematic effects
  useEffect(() => {
    if (!session) return;

    if (session.status === 'starting' || session.status === 'active') {
      startBrowsing(session.url);
    } else if (session.status === 'completed') {
      completeBrowsing(true);
    } else if (session.status === 'error') {
      completeBrowsing(false);
    }
  }, [session?.status, session?.url, startBrowsing, completeBrowsing]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    completeBrowsing(false);
    endSession();
  }, [endSession, completeBrowsing]);

  // No active session
  if (!session) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        {/* Subtle ambient background */}
        <AmbientLayer variant="aurora" intensity="subtle" />
        <EmptyState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      {/* Ambient browsing atmosphere */}
      <AmbientLayer variant="aurora" intensity="subtle" />

      {/* Header */}
      <Header
        goal={session.goal}
        url={session.url}
        status={session.status}
        onStop={handleStop}
      />

      {/* Screenshot */}
      <ScreenshotViewer
        screenshot={latestScreenshot?.base64 || null}
        status={session.status}
      />

      {/* Action Log */}
      <ActionLog actions={session.actions} />

      {/* Result */}
      {session.status === 'completed' && session.result !== undefined && (
        <ResultDisplay result={session.result} variant="success" />
      )}

      {/* Error */}
      {session.status === 'error' && session.result !== undefined && (
        <ResultDisplay
          result={session.result}
          variant="error"
          onDismiss={endSession}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyIconWrapper: {
    marginBottom: spacing[6],
  },
  emptyIcon: {
    fontSize: 80,
  },
  emptySubtitle: {
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  examplesWrapper: {
    width: '100%',
    gap: spacing[3],
  },
  exampleCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  exampleText: {
    fontStyle: 'italic',
  },

  // Header
  headerContainer: {
    overflow: 'hidden',
  },
  headerBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.5,
    borderBottomWidth: 0.5,
  },
  headerContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  goalText: {
    marginBottom: spacing[1],
  },

  // Status Badge
  statusBadge: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  statusBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    gap: spacing[2],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontWeight: '600',
  },

  // Stop Button
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  stopButtonText: {
    fontWeight: '600',
  },

  // Screenshot
  screenshotContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH / SCREENSHOT_ASPECT_RATIO,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  screenshot: {
    width: '100%',
    height: '100%',
  },
  screenshotPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  placeholderText: {
    textAlign: 'center',
  },

  // Action Log
  actionLogContainer: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  actionLogTitle: {
    marginBottom: spacing[3],
  },
  actionLog: {
    flex: 1,
  },
  actionLogContent: {
    paddingBottom: spacing[4],
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: spacing[4],
  },
  actionIconContainer: {
    width: 32,
    alignItems: 'center',
    paddingTop: spacing[0.5],
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionContent: {
    flex: 1,
  },
  thoughtText: {
    marginTop: spacing[1],
    fontStyle: 'italic',
  },
  actionTime: {
    marginTop: spacing[1],
  },

  // Result Display
  resultContainer: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultContent: {
    padding: spacing[4],
  },
  resultText: {
    marginTop: spacing[2],
    lineHeight: 22,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    marginTop: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
});
