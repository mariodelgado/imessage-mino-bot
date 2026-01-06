/**
 * Snap App Card - Gorgeous Liquid Glass Interactive Cards
 *
 * Premium features:
 * - Liquid glass morphism with animated shimmer
 * - Type-specific content renderers
 * - Spring animations and haptic feedback
 * - iOS 26 design language
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Share,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme';
import { SnapApp, SnapAppType, SnapAppInsight } from '../stores/snapAppStore';
import {
  Title3,
  Subheadline,
  Footnote,
  Caption1,
  Caption2,
} from './Typography';
import { AnimatedPressable } from './AnimatedComponents';
import { spacing, borderRadius, shadows, animations } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing[8];
const CARD_COMPACT_WIDTH = (SCREEN_WIDTH - spacing[10]) / 2;

// ============================================================================
// TYPE ICONS
// ============================================================================

const TYPE_ICONS: Record<SnapAppType, string> = {
  price_comparison: '📊',
  product_gallery: '🛒',
  article: '📄',
  map_view: '🗺️',
  availability: '📅',
  code_block: '💻',
  data_table: '📋',
  smart_card: '✨',
};

const TYPE_COLORS: Record<SnapAppType, string> = {
  price_comparison: '#10B981',
  product_gallery: '#8B5CF6',
  article: '#3B82F6',
  map_view: '#F59E0B',
  availability: '#EC4899',
  code_block: '#6366F1',
  data_table: '#14B8A6',
  smart_card: '#00D4FF',
};

// ============================================================================
// INSIGHT BADGE
// ============================================================================

interface InsightBadgeProps {
  insight: SnapAppInsight;
  index: number;
}

function InsightBadge({ insight, index }: InsightBadgeProps) {
  const { colors } = useTheme();

  const getBgColor = () => {
    switch (insight.type) {
      case 'positive':
        return 'rgba(16, 185, 129, 0.15)';
      case 'negative':
        return 'rgba(239, 68, 68, 0.15)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.15)';
      default:
        return colors.background.tertiary;
    }
  };

  const getTextColor = () => {
    switch (insight.type) {
      case 'positive':
        return '#10B981';
      case 'negative':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      default:
        return colors.foreground.secondary;
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(100 + index * 50).duration(300)}
      style={[styles.insightBadge, { backgroundColor: getBgColor() }]}
    >
      <Caption1 style={styles.insightIcon}>{insight.icon}</Caption1>
      <Caption2 color={getTextColor()} style={styles.insightText}>
        {insight.text}
      </Caption2>
    </Animated.View>
  );
}

// ============================================================================
// PRICE COMPARISON CONTENT
// ============================================================================

interface PriceComparisonContentProps {
  data: Record<string, unknown>;
}

function PriceComparisonContent({ data }: PriceComparisonContentProps) {
  const { colors, isDark } = useTheme();
  const items = (data.items as {
    name: string;
    price: number;
    rating: number;
  }[]) || [];

  const maxPrice = Math.max(...items.map((i) => i.price));

  return (
    <View style={styles.priceContent}>
      {items.slice(0, 3).map((item, index) => {
        const barWidth = (item.price / maxPrice) * 100;

        return (
          <Animated.View
            key={item.name}
            entering={FadeInUp.delay(150 + index * 80).duration(300)}
            style={styles.priceItem}
          >
            <View style={styles.priceItemHeader}>
              <Footnote
                color={colors.foreground.primary}
                numberOfLines={1}
                style={styles.priceItemName}
              >
                {item.name}
              </Footnote>
              <Subheadline color={colors.accent.primary} style={styles.priceValue}>
                ${item.price}
              </Subheadline>
            </View>

            <View style={styles.priceBarContainer}>
              <Animated.View
                style={[
                  styles.priceBar,
                  {
                    width: `${barWidth}%`,
                    backgroundColor:
                      index === 0
                        ? colors.accent.primary
                        : isDark
                        ? 'rgba(255,255,255,0.2)'
                        : 'rgba(0,0,0,0.1)',
                  },
                ]}
              />
            </View>

            <View style={styles.priceItemFooter}>
              <Caption2 color={colors.foreground.muted}>
                {'⭐'.repeat(Math.floor(item.rating))} {item.rating}
              </Caption2>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ============================================================================
// PRODUCT GALLERY CONTENT
// ============================================================================

interface ProductGalleryContentProps {
  data: Record<string, unknown>;
}

function ProductGalleryContent({ data }: ProductGalleryContentProps) {
  const { colors, isDark } = useTheme();
  const items = (data.items as {
    name: string;
    price: number;
    score: number;
  }[]) || [];

  return (
    <View style={styles.galleryContent}>
      {items.slice(0, 3).map((item, index) => (
        <Animated.View
          key={item.name}
          entering={FadeInUp.delay(150 + index * 80).duration(300)}
          style={[
            styles.galleryItem,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
            },
          ]}
        >
          <View
            style={[
              styles.galleryImagePlaceholder,
              { backgroundColor: colors.accent.muted },
            ]}
          >
            <Caption1>🖼️</Caption1>
          </View>
          <Caption2
            color={colors.foreground.primary}
            numberOfLines={1}
            style={styles.galleryItemName}
          >
            {item.name}
          </Caption2>
          <Caption2 color={colors.accent.primary}>${item.price}</Caption2>
        </Animated.View>
      ))}
    </View>
  );
}

// ============================================================================
// ARTICLE CONTENT
// ============================================================================

interface ArticleContentProps {
  data: Record<string, unknown>;
}

function ArticleContent({ data }: ArticleContentProps) {
  const { colors } = useTheme();
  const summary = (data.summary as string) || '';
  const keyPoints = (data.keyPoints as string[]) || [];

  return (
    <View style={styles.articleContent}>
      <Footnote
        color={colors.foreground.secondary}
        numberOfLines={2}
        style={styles.articleSummary}
      >
        {summary}
      </Footnote>

      {keyPoints.slice(0, 2).map((point, index) => (
        <Animated.View
          key={index}
          entering={FadeInUp.delay(150 + index * 80).duration(300)}
          style={styles.keyPointItem}
        >
          <Caption1 color={colors.accent.primary}>•</Caption1>
          <Caption2
            color={colors.foreground.secondary}
            numberOfLines={1}
            style={styles.keyPointText}
          >
            {point}
          </Caption2>
        </Animated.View>
      ))}
    </View>
  );
}

// ============================================================================
// AVAILABILITY CONTENT
// ============================================================================

interface AvailabilityContentProps {
  data: Record<string, unknown>;
}

function AvailabilityContent({ data }: AvailabilityContentProps) {
  const { colors, isDark } = useTheme();
  const dates = (data.dates as {
    date: string;
    price: number;
    available: boolean;
  }[]) || [];
  const minPrice = Math.min(...dates.map((d) => d.price));

  return (
    <View style={styles.availabilityContent}>
      {dates.slice(0, 5).map((item, index) => {
        const isLowest = item.price === minPrice;
        const date = new Date(item.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();

        return (
          <Animated.View
            key={item.date}
            entering={FadeInUp.delay(100 + index * 50).duration(200)}
            style={[
              styles.availabilityDay,
              {
                backgroundColor: isLowest
                  ? colors.accent.primary + '20'
                  : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
                borderColor: isLowest ? colors.accent.primary : 'transparent',
              },
            ]}
          >
            <Caption2
              color={isLowest ? colors.accent.primary : colors.foreground.muted}
            >
              {dayName}
            </Caption2>
            <Footnote
              color={
                isLowest ? colors.accent.primary : colors.foreground.primary
              }
              style={styles.availabilityDayNum}
            >
              {dayNum}
            </Footnote>
            <Caption2
              color={
                item.available
                  ? isLowest
                    ? colors.accent.primary
                    : colors.foreground.secondary
                  : colors.status.error
              }
            >
              ${item.price}
            </Caption2>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ============================================================================
// GENERIC CONTENT RENDERER
// ============================================================================

interface ContentRendererProps {
  type: SnapAppType;
  data: Record<string, unknown>;
}

function ContentRenderer({ type, data }: ContentRendererProps) {
  switch (type) {
    case 'price_comparison':
      return <PriceComparisonContent data={data} />;
    case 'product_gallery':
      return <ProductGalleryContent data={data} />;
    case 'article':
      return <ArticleContent data={data} />;
    case 'availability':
      return <AvailabilityContent data={data} />;
    default:
      return null;
  }
}

// ============================================================================
// MAIN SNAP APP CARD
// ============================================================================

interface SnapAppCardProps {
  app: SnapApp;
  variant?: 'full' | 'compact';
  index?: number;
  onPress?: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

export function SnapAppCard({
  app,
  variant = 'full',
  index = 0,
  onPress,
  onSave,
  onShare,
}: SnapAppCardProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);
  const typeColor = TYPE_COLORS[app.type];

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, animations.spring.snappy);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.bouncy);
  }, []);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (app.shareUrl) {
      await Share.share({
        url: app.shareUrl,
        title: app.title,
      });
    }
    onShare?.();
  }, [app, onShare]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave?.();
  }, [onSave]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isCompact = variant === 'compact';
  const cardWidth = isCompact ? CARD_COMPACT_WIDTH : CARD_WIDTH;

  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(400)}
      style={[
        styles.cardWrapper,
        { width: cardWidth },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.card, shadows.lg]}>
          {/* Blur Background */}
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />

          {/* Glass Overlay */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.7)',
              },
            ]}
          />

          {/* Accent Gradient */}
          <LinearGradient
            colors={[typeColor + '20', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.accentGradient}
          />

          {/* Border */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.cardBorder,
              { borderColor: colors.border.glass },
            ]}
          />

          {/* Content */}
          <View style={styles.cardContent}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.typeIndicator}>
                <View
                  style={[
                    styles.typeIconContainer,
                    { backgroundColor: typeColor + '20' },
                  ]}
                >
                  <Caption1>{TYPE_ICONS[app.type]}</Caption1>
                </View>
                {!isCompact && (
                  <Caption2 color={typeColor} style={styles.typeLabel}>
                    {app.type.replace('_', ' ').toUpperCase()}
                  </Caption2>
                )}
              </View>

              {!app.saved && (
                <AnimatedPressable onPress={handleSave} haptic="light">
                  <View style={styles.saveButton}>
                    <Caption1>📌</Caption1>
                  </View>
                </AnimatedPressable>
              )}
            </View>

            {/* Title */}
            <Title3
              color={colors.foreground.primary}
              numberOfLines={isCompact ? 1 : 2}
              style={styles.cardTitle}
            >
              {app.title}
            </Title3>

            {app.subtitle && !isCompact && (
              <Footnote
                color={colors.foreground.secondary}
                style={styles.cardSubtitle}
              >
                {app.subtitle}
              </Footnote>
            )}

            {/* Type-Specific Content */}
            {!isCompact && (
              <View style={styles.contentContainer}>
                <ContentRenderer type={app.type} data={app.data} />
              </View>
            )}

            {/* Insights */}
            {!isCompact && app.insights.length > 0 && (
              <View style={styles.insightsContainer}>
                {app.insights.slice(0, 2).map((insight, idx) => (
                  <InsightBadge key={idx} insight={insight} index={idx} />
                ))}
              </View>
            )}

            {/* Footer Actions */}
            {!isCompact && (
              <View style={styles.cardFooter}>
                <Caption2 color={colors.foreground.muted}>
                  {new Date(app.timestamp).toLocaleDateString()}
                </Caption2>

                <View style={styles.actionButtons}>
                  <AnimatedPressable onPress={handleShare} haptic="light">
                    <View
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.background.tertiary },
                      ]}
                    >
                      <Caption1>🔗</Caption1>
                      <Caption2 color={colors.foreground.secondary}>
                        Share
                      </Caption2>
                    </View>
                  </AnimatedPressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: spacing[4],
  },

  card: {
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },

  cardBorder: {
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
  },

  accentGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },

  cardContent: {
    padding: spacing[4],
  },

  // Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },

  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  typeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  typeLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  saveButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Title
  cardTitle: {
    marginBottom: spacing[1],
  },

  cardSubtitle: {
    marginBottom: spacing[3],
  },

  // Content
  contentContainer: {
    marginBottom: spacing[3],
  },

  // Price Comparison
  priceContent: {
    gap: spacing[3],
  },

  priceItem: {
    gap: spacing[1],
  },

  priceItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  priceItemName: {
    flex: 1,
    marginRight: spacing[2],
  },

  priceValue: {
    fontWeight: '600',
  },

  priceBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },

  priceBar: {
    height: '100%',
    borderRadius: 2,
  },

  priceItemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // Gallery
  galleryContent: {
    flexDirection: 'row',
    gap: spacing[2],
  },

  galleryItem: {
    flex: 1,
    padding: spacing[2],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing[1],
  },

  galleryImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  galleryItemName: {
    textAlign: 'center',
  },

  // Article
  articleContent: {
    gap: spacing[2],
  },

  articleSummary: {
    lineHeight: 18,
  },

  keyPointItem: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
  },

  keyPointText: {
    flex: 1,
  },

  // Availability
  availabilityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[1],
  },

  availabilityDay: {
    flex: 1,
    padding: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    gap: spacing[0.5],
  },

  availabilityDayNum: {
    fontWeight: '600',
  },

  // Insights
  insightsContainer: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },

  insightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    gap: spacing[2],
  },

  insightIcon: {
    fontSize: 12,
  },

  insightText: {
    fontWeight: '500',
  },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
});

export default SnapAppCard;
