/**
 * CoverFlow - Classic Apple 3D Carousel
 *
 * The iconic album art browser from iTunes/iPod:
 * - 3D perspective transforms with reflection
 * - Gesture-driven navigation
 * - Smooth physics-based animations
 * - Center-focused item with depth falloff
 *
 * Perfect for browsing conversations, memories, or any collection.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  ImageSourcePropType,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { Body, Caption1 } from './Typography';
import { borderRadius } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// CoverFlow dimensions
const ITEM_WIDTH = 200;
const ITEM_HEIGHT = 200;
const ITEM_SPACING = -60; // Negative for overlap effect
const PERSPECTIVE = 800;
const ROTATION_ANGLE = 55; // degrees

// ============================================================================
// TYPES
// ============================================================================

export interface CoverFlowItem {
  id: string;
  image?: ImageSourcePropType | string;
  title?: string;
  subtitle?: string;
  color?: string;
  data?: unknown;
}

interface CoverFlowProps {
  items: CoverFlowItem[];
  onItemSelect?: (item: CoverFlowItem, index: number) => void;
  onIndexChange?: (index: number) => void;
  initialIndex?: number;
  showReflection?: boolean;
  showLabels?: boolean;
  itemWidth?: number;
  itemHeight?: number;
}

// ============================================================================
// SINGLE COVER ITEM
// ============================================================================

interface CoverItemProps {
  item: CoverFlowItem;
  index: number;
  scrollX: Animated.SharedValue<number>;
  itemWidth: number;
  itemHeight: number;
  showReflection: boolean;
  onPress: () => void;
}

function CoverItem({
  item,
  index,
  scrollX,
  itemWidth,
  itemHeight,
  showReflection,
  onPress,
}: CoverItemProps) {
  const { colors, isDark } = useTheme();

  // Calculate center position for this item
  const inputRange = [
    (index - 2) * (itemWidth + ITEM_SPACING),
    (index - 1) * (itemWidth + ITEM_SPACING),
    index * (itemWidth + ITEM_SPACING),
    (index + 1) * (itemWidth + ITEM_SPACING),
    (index + 2) * (itemWidth + ITEM_SPACING),
  ];

  const animatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      [ROTATION_ANGLE, ROTATION_ANGLE, 0, -ROTATION_ANGLE, -ROTATION_ANGLE],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.7, 0.8, 1, 0.8, 0.7],
      Extrapolation.CLAMP
    );

    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-30, -15, 0, 15, 30],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 0.7, 1, 0.7, 0.5],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { perspective: PERSPECTIVE },
        { translateX },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
      zIndex: Math.round(
        interpolate(
          scrollX.value,
          inputRange,
          [1, 2, 3, 2, 1],
          Extrapolation.CLAMP
        )
      ),
    };
  });

  const reflectionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.1, 0.15, 0.3, 0.15, 0.1],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  // Determine image source
  const imageSource = useMemo(() => {
    if (!item.image) return null;
    if (typeof item.image === 'string') {
      return { uri: item.image };
    }
    return item.image;
  }, [item.image]);

  // Fallback color for items without images
  const bgColor = item.color || colors.accent.primary;

  return (
    <Animated.View
      style={[
        styles.coverItemContainer,
        { width: itemWidth, marginHorizontal: ITEM_SPACING / 2 },
        animatedStyle,
      ]}
    >
      {/* Main Cover */}
      <Animated.View
        style={[
          styles.coverItem,
          {
            width: itemWidth,
            height: itemHeight,
            backgroundColor: bgColor,
          },
        ]}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: bgColor }]}>
            <LinearGradient
              colors={[`${bgColor}00`, `${bgColor}80`]}
              style={StyleSheet.absoluteFill}
            />
            {item.title && (
              <Body color="#FFF" align="center" numberOfLines={2}>
                {item.title.charAt(0).toUpperCase()}
              </Body>
            )}
          </View>
        )}

        {/* Gloss overlay */}
        <LinearGradient
          colors={['rgba(255,255,255,0.3)', 'transparent', 'rgba(0,0,0,0.1)']}
          style={[StyleSheet.absoluteFill, styles.gloss]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Reflection */}
      {showReflection && (
        <Animated.View style={[styles.reflection, reflectionStyle]}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={[
                styles.reflectionImage,
                { width: itemWidth, height: itemHeight * 0.5 },
              ]}
            />
          ) : (
            <View
              style={[
                styles.reflectionPlaceholder,
                {
                  width: itemWidth,
                  height: itemHeight * 0.5,
                  backgroundColor: bgColor,
                },
              ]}
            />
          )}
          <LinearGradient
            colors={['transparent', isDark ? '#000' : '#fff']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// LABEL DISPLAY
// ============================================================================

interface CoverLabelItemProps {
  item: CoverFlowItem;
  index: number;
  currentIndex: Animated.SharedValue<number>;
}

function CoverLabelItem({ item, index, currentIndex }: CoverLabelItemProps) {
  const { colors } = useTheme();

  const itemLabelStyle = useAnimatedStyle(() => {
    const isActive = currentIndex.value === index;
    return {
      opacity: isActive ? 1 : 0,
      transform: [
        { translateY: isActive ? 0 : 10 },
        { scale: isActive ? 1 : 0.9 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.labelItem, itemLabelStyle]}>
      {item.title && (
        <Body
          color={colors.foreground.primary}
          align="center"
          style={{ fontWeight: '600' }}
          numberOfLines={1}
        >
          {item.title}
        </Body>
      )}
      {item.subtitle && (
        <Caption1
          color={colors.foreground.secondary}
          align="center"
          numberOfLines={1}
        >
          {item.subtitle}
        </Caption1>
      )}
    </Animated.View>
  );
}

interface CoverLabelProps {
  items: CoverFlowItem[];
  scrollX: Animated.SharedValue<number>;
  itemWidth: number;
}

function CoverLabel({ items, scrollX, itemWidth }: CoverLabelProps) {
  const currentIndex = useDerivedValue(() => {
    return Math.round(scrollX.value / (itemWidth + ITEM_SPACING));
  });

  return (
    <View style={styles.labelContainer}>
      {items.map((item, index) => (
        <CoverLabelItem
          key={item.id}
          item={item}
          index={index}
          currentIndex={currentIndex}
        />
      ))}
    </View>
  );
}

// ============================================================================
// MAIN COVERFLOW COMPONENT
// ============================================================================

export function CoverFlow({
  items,
  onItemSelect,
  onIndexChange,
  initialIndex = 0,
  showReflection = true,
  showLabels = true,
  itemWidth = ITEM_WIDTH,
  itemHeight = ITEM_HEIGHT,
}: CoverFlowProps) {
  const { isDark } = useTheme();
  const scrollX = useSharedValue(initialIndex * (itemWidth + ITEM_SPACING));
  const lastIndex = useRef(initialIndex);

  // Handle scroll
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const index = Math.round(event.contentOffset.x / (itemWidth + ITEM_SPACING));
      if (index !== lastIndex.current) {
        lastIndex.current = index;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        if (onIndexChange) {
          runOnJS(onIndexChange)(index);
        }
      }
    },
  });

  // Handle item tap
  const handleItemPress = useCallback(
    (item: CoverFlowItem, index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onItemSelect?.(item, index);
    },
    [onItemSelect]
  );

  // Calculate padding to center items
  const sidePadding = (SCREEN_WIDTH - itemWidth) / 2;

  return (
    <View style={styles.container}>
      {/* Ambient glow behind center item */}
      <View style={styles.ambientGlow}>
        <BlurView
          intensity={isDark ? 30 : 20}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Scrollable covers */}
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth + ITEM_SPACING}
        decelerationRate="fast"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: sidePadding },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentOffset={{ x: initialIndex * (itemWidth + ITEM_SPACING), y: 0 }}
      >
        {items.map((item, index) => (
          <CoverItem
            key={item.id}
            item={item}
            index={index}
            scrollX={scrollX}
            itemWidth={itemWidth}
            itemHeight={itemHeight}
            showReflection={showReflection}
            onPress={() => handleItemPress(item, index)}
          />
        ))}
      </Animated.ScrollView>

      {/* Labels */}
      {showLabels && (
        <CoverLabel items={items} scrollX={scrollX} itemWidth={itemWidth} />
      )}

      {/* Bottom reflection surface */}
      {showReflection && (
        <View style={styles.reflectionSurface}>
          <LinearGradient
            colors={[
              isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              'transparent',
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </View>
  );
}

// ============================================================================
// MINI COVERFLOW - Compact version for inline use
// ============================================================================

interface MiniCoverFlowProps {
  items: CoverFlowItem[];
  onItemSelect?: (item: CoverFlowItem, index: number) => void;
  height?: number;
}

export function MiniCoverFlow({
  items,
  onItemSelect,
  height = 100,
}: MiniCoverFlowProps) {
  const itemSize = height - 20;

  return (
    <CoverFlow
      items={items}
      onItemSelect={onItemSelect}
      showReflection={false}
      showLabels={false}
      itemWidth={itemSize}
      itemHeight={itemSize}
    />
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT + 100, // Extra space for reflection and labels
    justifyContent: 'center',
  },

  ambientGlow: {
    position: 'absolute',
    width: ITEM_WIDTH * 1.5,
    height: ITEM_HEIGHT * 1.2,
    alignSelf: 'center',
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },

  scrollContent: {
    alignItems: 'center',
  },

  // Cover Item
  coverItemContainer: {
    alignItems: 'center',
  },
  coverItem: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gloss: {
    borderRadius: borderRadius.lg,
  },

  // Reflection
  reflection: {
    marginTop: 2,
    transform: [{ scaleY: -1 }],
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
  },
  reflectionImage: {
    resizeMode: 'cover',
  },
  reflectionPlaceholder: {},
  reflectionSurface: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },

  // Labels
  labelContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelItem: {
    position: 'absolute',
    width: SCREEN_WIDTH - 80,
    alignItems: 'center',
  },
});

export default CoverFlow;
