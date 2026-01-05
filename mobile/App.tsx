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
import { useNotificationStore } from './src/stores/notificationStore';
import { ThemeProvider, useTheme } from './src/theme';
import { ChatIcon, BrowserIcon, SettingsIcon } from './src/components';
import { Footnote } from './src/components/Typography';
import { CinematicProvider } from './src/components/CinematicEffects';
import { spacing } from './src/theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ============================================================================
// CUSTOM TAB BAR WITH LIQUID GLASS
// ============================================================================

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.tabBarWrapper}>
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.tabBarBorder, { borderTopColor: colors.border.glass }]} />
      <View style={styles.tabBarContent}>
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
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const renderIcon = () => {
            switch (route.name) {
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
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              {renderIcon()}
              <Footnote
                color={isFocused ? colors.accent.primary : colors.foreground.tertiary}
                style={styles.tabLabel}
              >
                {label}
              </Footnote>
            </Pressable>
          );
        })}
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
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  tabBarBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0.5,
    borderTopWidth: 0.5,
  },
  tabBarContent: {
    flexDirection: 'row',
    paddingTop: spacing[2],
    paddingBottom: Platform.OS === 'ios' ? spacing[7] : spacing[3],
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  tabLabel: {
    marginTop: spacing[1],
  },
});
