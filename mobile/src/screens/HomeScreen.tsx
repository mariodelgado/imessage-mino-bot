/**
 * Home Screen - Gorgeous Liquid Glass Snap Apps Dashboard
 *
 * Premium iOS 26 design with:
 * - Liquid glass header with animated greeting
 * - Recent Snap Apps carousel
 * - Saved Apps section
 * - Quick chat FAB
 * - Smooth spring animations
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useTheme } from '../theme';
import { useSnapAppStore, initializeMockData, SnapApp } from '../stores/snapAppStore';
import { SnapAppCard } from '../components/SnapAppCard';
import { AnimatedPressable } from '../components/AnimatedComponents';
import {
  LargeTitle,
  Title2,
  Title3,
  Body,
  Subheadline,
  Footnote,
  Caption1,
} from '../components/Typography';
import { spacing, borderRadius, shadows, animations } from '../theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// GREETING HEADER
// ============================================================================

function GreetingHeader() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shimmerPosition = useSharedValue(0);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withSequence(
        withSpring(1, { duration: 2000 }),
        withSpring(0, { duration: 2000 })
      ),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmerPosition.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      style={[styles.headerContainer, { paddingTop: insets.top + spacing[2] }]}
    >
      {/* Glass Background */}
      <BlurView
        intensity={isDark ? 60 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Shimmer Overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Content */}
      <View style={styles.headerContent}>
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Footnote color={colors.foreground.muted} style={styles.greetingLabel}>
            {getGreeting()}
          </Footnote>
          <LargeTitle color={colors.foreground.primary} style={styles.headerTitle}>
            Snap Apps
          </LargeTitle>
          <Subheadline color={colors.foreground.secondary} style={styles.headerSubtitle}>
            Your intelligent research cards
          </Subheadline>
        </Animated.View>
      </View>

      {/* Bottom Border Glow */}
      <LinearGradient
        colors={[colors.accent.primary + '40', 'transparent']}
        style={styles.headerBorderGlow}
      />
    </Animated.View>
  );
}

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  onSeeAll?: () => void;
}

function SectionHeader({ title, subtitle, count, onSeeAll }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionTitleRow}>
          <Title3 color={colors.foreground.primary}>{title}</Title3>
          {count !== undefined && count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.accent.primary + '20' }]}>
              <Caption1 color={colors.accent.primary}>{count}</Caption1>
            </View>
          )}
        </View>
        {subtitle && (
          <Footnote color={colors.foreground.muted} style={styles.sectionSubtitle}>
            {subtitle}
          </Footnote>
        )}
      </View>
      {onSeeAll && (
        <AnimatedPressable onPress={onSeeAll} haptic="light">
          <Footnote color={colors.accent.primary}>See All</Footnote>
        </AnimatedPressable>
      )}
    </View>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={styles.emptyState}
    >
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
        ]}
      >
        <Title2>✨</Title2>
      </View>
      <Title3 color={colors.foreground.primary} style={styles.emptyTitle}>
        No Snap Apps yet
      </Title3>
      <Body color={colors.foreground.secondary} style={styles.emptySubtitle}>
        Ask Mino to research something and your{'\n'}results will appear here as interactive cards
      </Body>
    </Animated.View>
  );
}

// ============================================================================
// QUICK CHAT FAB
// ============================================================================

function QuickChatFAB() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withSpring(1, { duration: 2000 }),
        withSpring(0, { duration: 2000 })
      ),
      -1,
      false
    );
  }, []);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Chat');
  }, [navigation]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, animations.spring.snappy);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.bouncy);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.4, 0.8]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.2]) }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(400).duration(500)}
      style={[styles.fabContainer, animatedStyle]}
    >
      {/* Glow Effect */}
      <Animated.View style={[styles.fabGlow, glowStyle]}>
        <LinearGradient
          colors={[colors.accent.primary, colors.accent.secondary]}
          style={styles.fabGlowGradient}
        />
      </Animated.View>

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fab}
      >
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[colors.accent.primary, colors.accent.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
        />
        <View style={styles.fabContent}>
          <Title2 style={styles.fabIcon}>💬</Title2>
          <Subheadline color="#FFFFFF" style={styles.fabLabel}>
            Chat with Mino
          </Subheadline>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// MAIN HOME SCREEN
// ============================================================================

export function HomeScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { recentApps, savedApps, saveApp, setFocusedApp } = useSnapAppStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Initialize mock data on first load
  useEffect(() => {
    initializeMockData();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleCardPress = useCallback((app: SnapApp) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFocusedApp(app);
  }, [setFocusedApp]);

  const handleSaveApp = useCallback((appId: string) => {
    saveApp(appId);
  }, [saveApp]);

  const hasContent = recentApps.length > 0 || savedApps.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[24] },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        {/* Header */}
        <GreetingHeader />

        {/* Content */}
        {!hasContent ? (
          <EmptyState />
        ) : (
          <View style={styles.content}>
            {/* Recent Apps */}
            {recentApps.length > 0 && (
              <Animated.View entering={FadeInUp.delay(200).duration(400)}>
                <SectionHeader
                  title="Recent"
                  subtitle="From your latest searches"
                  count={recentApps.length}
                />
                <View style={styles.cardsContainer}>
                  {recentApps.slice(0, 4).map((app, index) => (
                    <SnapAppCard
                      key={app.id}
                      app={app}
                      index={index}
                      onPress={() => handleCardPress(app)}
                      onSave={() => handleSaveApp(app.id)}
                    />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Saved Apps */}
            {savedApps.length > 0 && (
              <Animated.View entering={FadeInUp.delay(300).duration(400)}>
                <SectionHeader
                  title="Saved"
                  subtitle="Your pinned cards"
                  count={savedApps.length}
                />
                <View style={styles.compactCardsContainer}>
                  {savedApps.slice(0, 6).map((app, index) => (
                    <SnapAppCard
                      key={app.id}
                      app={app}
                      variant="compact"
                      index={index}
                      onPress={() => handleCardPress(app)}
                    />
                  ))}
                </View>
              </Animated.View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Quick Chat FAB */}
      <QuickChatFAB />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  // Header
  headerContainer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    overflow: 'hidden',
  },

  headerContent: {
    zIndex: 1,
  },

  greetingLabel: {
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  headerTitle: {
    marginBottom: spacing[1],
  },

  headerSubtitle: {
    opacity: 0.8,
  },

  headerBorderGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },

  // Sections
  content: {
    flex: 1,
    paddingTop: spacing[4],
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },

  sectionHeaderLeft: {
    flex: 1,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  sectionSubtitle: {
    marginTop: spacing[0.5],
  },

  countBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full,
  },

  // Cards
  cardsContainer: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[6],
  },

  compactCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[6],
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    paddingTop: SCREEN_HEIGHT * 0.15,
  },

  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },

  emptyTitle: {
    marginBottom: spacing[2],
    textAlign: 'center',
  },

  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[4],
    left: spacing[4],
  },

  fabGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: borderRadius['2xl'] + 10,
    overflow: 'hidden',
  },

  fabGlowGradient: {
    flex: 1,
    borderRadius: borderRadius['2xl'] + 10,
  },

  fab: {
    height: 56,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    ...shadows.lg,
  },

  fabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },

  fabIcon: {
    fontSize: 20,
  },

  fabLabel: {
    fontWeight: '600',
  },
});

export default HomeScreen;
