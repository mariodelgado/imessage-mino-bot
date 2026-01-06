/**
 * Mino Mobile App - iOS 26 Elite Design
 *
 * Premium React Native app featuring:
 * - Liquid glass UI with blur effects
 * - SF Symbols-style animated icons
 * - Spring animations and haptic feedback
 * - Full HIG compliance
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ChatScreen from './src/screens/ChatScreen';
import MinoBrowserScreen from './src/screens/MinoBrowserScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import HomeScreen from './src/screens/HomeScreen';
import { useNotificationStore } from './src/stores/notificationStore';
import { ThemeProvider, useTheme } from './src/theme';
import { ChatIcon, BrowserIcon, SettingsIcon, HomeIcon } from './src/components';
import { Footnote } from './src/components/Typography';
import { CinematicProvider } from './src/components/CinematicEffects';
import { spacing } from './src/theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ============================================================================
// MORPHING FLOATING TAB BAR - Premium fluid navigation
// ============================================================================

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MorphingTabItem({
  route,
  label,
  isFocused,
  onPress,
  onLongPress,
  colors,
}: {
  route: any;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  colors: any;
}) {
  const progress = useSharedValue(isFocused ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    });
  }, [isFocused, progress]);

  const containerStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['transparent', colors.accent.primary + '20']
    );
    const paddingHorizontal = interpolate(progress.value, [0, 1], [12, 16]);
    const borderRadius = interpolate(progress.value, [0, 1], [12, 20]);

    return {
      backgroundColor,
      paddingHorizontal,
      borderRadius,
      transform: [{ scale: scale.value }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [0, 60]);
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]);
    const marginLeft = interpolate(progress.value, [0, 1], [0, 8]);

    return {
      width,
      opacity,
      marginLeft,
      overflow: 'hidden',
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const renderIcon = () => {
    switch (route.name) {
      case 'Home':
        return <HomeIcon focused={isFocused} size="lg" />;
      case 'Chat':
        return <ChatIcon focused={isFocused} size="lg" />;
      case 'Browser':
        return <BrowserIcon focused={isFocused} size="lg" />;
      case 'Settings':
        return <SettingsIcon focused={isFocused} size="lg" />;
      default:
        return null;
    }
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.morphingTabItem, containerStyle]}
    >
      {renderIcon()}
      <Animated.View style={labelStyle}>
        <Footnote
          color={colors.accent.primary}
          style={styles.morphingTabLabel}
          numberOfLines={1}
        >
          {label}
        </Footnote>
      </Animated.View>
    </AnimatedPressable>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.floatingTabBarContainer}>
      <View style={[styles.floatingTabBar, { backgroundColor: isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)' }]}>
        <BlurView
          intensity={60}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, styles.floatingTabBarBlur]}
        />
        <View style={styles.floatingTabBarContent}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? route.name;
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <MorphingTabItem
                key={route.key}
                route={route}
                label={label}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                colors={colors}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// TAB NAVIGATOR
// ============================================================================

function TabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.primary,
        },
        headerTintColor: colors.foreground.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Snap Apps',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Mino',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Browser"
        component={MinoBrowserScreen}
        options={{
          title: 'Browse',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================================================
// ROOT NAVIGATOR
// ============================================================================

type RootStackParamList = {
  Welcome: undefined;
  Main: undefined;
};

const WELCOME_COMPLETED_KEY = '@mino_welcome_completed';

function RootNavigator() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { initialize, clearUnread } = useNotificationStore();
  const { isDark, colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check if welcome screen has been completed
  useEffect(() => {
    const checkWelcomeStatus = async () => {
      try {
        const hasCompleted = await AsyncStorage.getItem(WELCOME_COMPLETED_KEY);
        setShowWelcome(hasCompleted !== 'true');
      } catch {
        // If error reading, show welcome to be safe
        setShowWelcome(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkWelcomeStatus();
  }, []);

  // Initialize notification listeners
  useEffect(() => {
    const cleanup = initialize((data) => {
      console.log('Notification tapped with data:', data);

      if (data.type === 'morning-update') {
        navigationRef.current?.navigate('Main');
      }

      clearUnread();
    });

    return cleanup;
  }, [initialize, clearUnread]);

  // Handle welcome completion
  const handleWelcomeComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(WELCOME_COMPLETED_KEY, 'true');
    } catch {
      // Continue anyway even if storage fails
    }
    navigationRef.current?.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, []);

  // Don't render until we know the welcome status
  if (isLoading) {
    return null;
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={{
          dark: isDark,
          colors: {
            primary: colors.accent.primary,
            background: colors.background.primary,
            card: colors.background.secondary,
            text: colors.foreground.primary,
            border: colors.border.default,
            notification: colors.status.error,
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            bold: { fontFamily: 'System', fontWeight: '700' },
            heavy: { fontFamily: 'System', fontWeight: '800' },
          },
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {showWelcome && (
            <Stack.Screen name="Welcome">
              {() => <WelcomeScreen onComplete={handleWelcomeComplete} />}
            </Stack.Screen>
          )}
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

// ============================================================================
// APP ROOT
// ============================================================================

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <CinematicProvider>
            <RootNavigator />
          </CinematicProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Floating tab bar styles
  floatingTabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? spacing[8] : spacing[4],
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
  },
  floatingTabBar: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  floatingTabBarBlur: {
    borderRadius: 28,
  },
  floatingTabBarContent: {
    flexDirection: 'row',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    gap: spacing[1],
  },
  morphingTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },
  morphingTabLabel: {
    fontWeight: '600',
  },
});
