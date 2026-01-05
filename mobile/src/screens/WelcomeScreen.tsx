/**
 * Welcome Screen - MercuryOS Kiri (霧) Design
 *
 * Inspired by Jason Yuan's MercuryOS concept:
 * - Kiri (霧 - fog): Soft mist aesthetic, clarity where needed
 * - Way of Inexertion: Motion without resistance, easing into stillness
 * - Modular: Self-contained content modules that flow horizontally
 * - Typography: Large contrast in size for hierarchy (Söhne-inspired)
 * - Dark mode: Modules backlit with moonlight incandescence
 * - Fluid, modeless: No hard boundaries between interactions
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInUp,
  SlideInRight,
  SlideInLeft,
  Layout,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { spacing } from '../theme/tokens';
import { SendIcon } from '../components/Icons';
import { AnimatedPressable, TypingIndicator } from '../components';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSettingsStore } from '../stores/settingsStore';
import { generateResponse as generateOfflineResponse } from '../services/onDeviceLLM';
import {
  getWelcomeMessage,
  analyzeTask,
  formatConciergeResponse,
  getConciergeSystemPrompt,
} from '../services/conciergeFormatter';
import {
  startThinkingActivity,
  showResponsePreview,
  showErrorState,
} from '../services/liveActivity';
import { ServerMessage } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// MERCURYOS KIRI COLOR PALETTE
// ============================================================================

const KiriColors = {
  // Light mode - soft fog, barely there
  light: {
    background: '#FAFAFA',
    backgroundAlt: '#F5F5F5',
    mist: 'rgba(0, 0, 0, 0.02)',
    mistDense: 'rgba(0, 0, 0, 0.04)',
    moduleBackground: 'rgba(255, 255, 255, 0.9)',
    moduleBorder: 'rgba(0, 0, 0, 0.04)',
    text: {
      primary: '#1A1A1A',
      secondary: 'rgba(0, 0, 0, 0.5)',
      tertiary: 'rgba(0, 0, 0, 0.3)',
      muted: 'rgba(0, 0, 0, 0.2)',
    },
    accent: '#3A3A3A',
    accentSoft: 'rgba(58, 58, 58, 0.1)',
  },
  // Dark mode - moonlight incandescence
  dark: {
    background: '#0A0A0A',
    backgroundAlt: '#111111',
    mist: 'rgba(255, 255, 255, 0.02)',
    mistDense: 'rgba(255, 255, 255, 0.04)',
    moduleBackground: 'rgba(255, 255, 255, 0.06)',
    moduleBorder: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: 'rgba(255, 255, 255, 0.92)',
      secondary: 'rgba(255, 255, 255, 0.6)',
      tertiary: 'rgba(255, 255, 255, 0.4)',
      muted: 'rgba(255, 255, 255, 0.2)',
    },
    accent: 'rgba(255, 255, 255, 0.9)',
    accentSoft: 'rgba(255, 255, 255, 0.08)',
  },
};

// MercuryOS motion - Way of Inexertion
const KiriMotion = {
  // Gentle, without resistance
  spring: {
    damping: 28,
    stiffness: 120,
    mass: 1,
  },
  // Easing into stillness - standard duration
  timing: {
    duration: 500,
  },
  // Slower, more contemplative
  slow: {
    duration: 800,
  },
};

// Kiri easing - Way of Inexertion: smooth out-expo for gentle deceleration
// Using Easing.out(Easing.expo) for proper TypeScript compatibility
const kiriEaseSlow = Easing.out(Easing.exp);

// ============================================================================
// TYPES
// ============================================================================

interface WelcomeScreenProps {
  onComplete: () => void;
}

interface WelcomeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isIntro?: boolean;
}

// ============================================================================
// ETHEREAL FOG LAYER - Multi-layered Kiri mist
// ============================================================================

interface MistLayerProps {
  isDark: boolean;
}

function MistLayer({ isDark }: MistLayerProps) {
  // Multiple fog layers with different drift speeds
  const fog1Y = useSharedValue(0);
  const fog1X = useSharedValue(0);
  const fog2Y = useSharedValue(0);
  const fog2X = useSharedValue(0);
  const fog3Y = useSharedValue(0);
  const fogOpacity = useSharedValue(0);

  useEffect(() => {
    // Gentle fade in
    fogOpacity.value = withTiming(1, { duration: 3000 });

    // Layer 1 - Slow, sweeping drift
    fog1Y.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 20000, easing: Easing.inOut(Easing.sin) }),
        withTiming(20, { duration: 20000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    fog1X.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 25000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-10, { duration: 25000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Layer 2 - Medium drift, counter-motion
    fog2Y.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 15000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-15, { duration: 15000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    fog2X.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
        withTiming(8, { duration: 18000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Layer 3 - Gentle vertical pulse
    fog3Y.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
        withTiming(12, { duration: 10000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fog1Style = useAnimatedStyle(() => ({
    opacity: fogOpacity.value * 0.4,
    transform: [{ translateY: fog1Y.value }, { translateX: fog1X.value }],
  }));

  const fog2Style = useAnimatedStyle(() => ({
    opacity: fogOpacity.value * 0.3,
    transform: [{ translateY: fog2Y.value }, { translateX: fog2X.value }],
  }));

  const fog3Style = useAnimatedStyle(() => ({
    opacity: fogOpacity.value * 0.5,
    transform: [{ translateY: fog3Y.value }],
  }));

  // Ethereal fog colors
  const fogColorLight = isDark
    ? 'rgba(255, 255, 255, 0.03)'
    : 'rgba(0, 0, 0, 0.02)';
  const fogColorMedium = isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(0, 0, 0, 0.03)';
  const fogColorDense = isDark
    ? 'rgba(255, 255, 255, 0.07)'
    : 'rgba(0, 0, 0, 0.04)';

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Base ambient glow */}
      <LinearGradient
        colors={[
          isDark ? 'rgba(30, 30, 50, 0.3)' : 'rgba(240, 240, 250, 0.5)',
          'transparent',
          isDark ? 'rgba(20, 20, 40, 0.2)' : 'rgba(245, 245, 255, 0.3)',
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Fog layer 1 - Upper ethereal mist */}
      <Animated.View style={[StyleSheet.absoluteFill, fog1Style]}>
        <LinearGradient
          colors={[fogColorDense, 'transparent', fogColorLight]}
          style={[styles.mistGradient, { height: '60%', top: -20 }]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      </Animated.View>

      {/* Fog layer 2 - Mid ethereal drift */}
      <Animated.View style={[StyleSheet.absoluteFill, fog2Style]}>
        <LinearGradient
          colors={['transparent', fogColorMedium, 'transparent']}
          style={[styles.mistGradient, { height: '50%', top: '25%' }]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </Animated.View>

      {/* Fog layer 3 - Lower ground mist */}
      <Animated.View style={[StyleSheet.absoluteFill, fog3Style]}>
        <LinearGradient
          colors={['transparent', fogColorDense]}
          style={[styles.mistGradient, { bottom: 0, height: '45%' }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Subtle radial glow in center */}
      <View style={styles.centerGlow}>
        <LinearGradient
          colors={[
            isDark ? 'rgba(100, 100, 150, 0.08)' : 'rgba(255, 255, 255, 0.6)',
            'transparent',
          ]}
          style={styles.centerGlowGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
    </View>
  );
}

// ============================================================================
// KIRI TYPOGRAPHY - Large contrast for hierarchy
// ============================================================================

interface KiriTextProps {
  children: React.ReactNode;
  variant: 'largeTitle' | 'title' | 'body' | 'caption' | 'micro';
  color?: string;
  style?: any;
  align?: 'left' | 'center' | 'right';
}

function KiriText({ children, variant, color, style, align = 'left' }: KiriTextProps) {
  const { isDark } = useTheme();
  const colors = isDark ? KiriColors.dark : KiriColors.light;

  const variantStyles = {
    largeTitle: {
      fontSize: 40,
      fontWeight: '200' as const,
      letterSpacing: -1,
      lineHeight: 48,
      color: color || colors.text.primary,
    },
    title: {
      fontSize: 24,
      fontWeight: '300' as const,
      letterSpacing: -0.5,
      lineHeight: 32,
      color: color || colors.text.primary,
    },
    body: {
      fontSize: 17,
      fontWeight: '400' as const,
      letterSpacing: -0.2,
      lineHeight: 24,
      color: color || colors.text.primary,
    },
    caption: {
      fontSize: 14,
      fontWeight: '400' as const,
      letterSpacing: 0,
      lineHeight: 20,
      color: color || colors.text.secondary,
    },
    micro: {
      fontSize: 12,
      fontWeight: '500' as const,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      lineHeight: 16,
      color: color || colors.text.tertiary,
    },
  };

  return (
    <Text style={[variantStyles[variant], { textAlign: align }, style]}>
      {children}
    </Text>
  );
}

// ============================================================================
// MESSAGE BUBBLE - MercuryOS module style
// ============================================================================

// Suggested prompts - real examples of what Mino can do
const SUGGESTED_PROMPTS = [
  "What's the weather like today?",
  "Find me a good Italian restaurant nearby",
  "Research the top AI news this week",
  "Help me write a thank-you note",
  "What's Tesla's stock price?",
];

interface MessageBubbleProps {
  message: WelcomeMessage;
  index: number;
  onSuggestPress?: (prompt: string) => void;
}

function MessageBubble({ message, index, onSuggestPress }: MessageBubbleProps) {
  const { isDark } = useTheme();
  const colors = isDark ? KiriColors.dark : KiriColors.light;
  const isUser = message.role === 'user';

  // Way of Inexertion - gentle, flowing motion
  const entering = isUser
    ? SlideInRight.delay(50)
        .duration(KiriMotion.slow.duration)
        .easing(kiriEaseSlow)
    : SlideInLeft.delay(50)
        .duration(KiriMotion.slow.duration)
        .easing(kiriEaseSlow);

  // Intro - animated prompt bubble that emerges from the mist
  if (message.isIntro) {
    return (
      <View style={styles.introPromptWrapper}>
        {/* Floating avatar that pulses gently */}
        <Animated.View
          entering={FadeIn.delay(200).duration(1000)}
          style={styles.floatingAvatarWrapper}
        >
          <View
            style={[
              styles.floatingAvatar,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.05)',
                borderColor: colors.moduleBorder,
              },
            ]}
          >
            <KiriText variant="title" color={colors.text.secondary}>
              M
            </KiriText>
          </View>
        </Animated.View>

        {/* Prompt bubble that pops up */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(800).easing(kiriEaseSlow)}
          style={[styles.promptBubbleWrapper, styles.assistantWrapper]}
        >
          <View
            style={[
              styles.promptBubble,
              {
                backgroundColor: colors.moduleBackground,
                borderColor: colors.moduleBorder,
              },
            ]}
          >
            <KiriText variant="body" style={styles.promptText}>
              {message.content}
            </KiriText>
          </View>
        </Animated.View>

        {/* Suggested prompts - horizontal flowing modules, MercuryOS style */}
        <Animated.View
          entering={FadeIn.delay(1200).duration(800).easing(kiriEaseSlow)}
          style={styles.suggestedPromptsWrapper}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedPromptsScroll}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH * 0.7 + spacing[3]}
          >
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <Animated.View
                key={prompt}
                entering={FadeIn.delay(1400 + i * 150).duration(600).easing(kiriEaseSlow)}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSuggestPress?.(prompt);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.suggestedModule,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.02)',
                    },
                  ]}
                >
                  {/* Subtle glow edge */}
                  <View
                    style={[
                      styles.moduleGlow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(255, 255, 255, 0.8)',
                      },
                    ]}
                  />
                  <KiriText
                    variant="body"
                    color={colors.text.secondary}
                    style={styles.suggestedText}
                  >
                    {prompt}
                  </KiriText>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    );
  }

  // User message - slightly more prominent
  if (isUser) {
    return (
      <Animated.View
        entering={entering}
        layout={Layout.springify().damping(KiriMotion.spring.damping)}
        style={[styles.messageBubbleWrapper, styles.userWrapper]}
      >
        <View
          style={[
            styles.messageBubble,
            styles.userBubble,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.accent,
            },
          ]}
        >
          <KiriText
            variant="body"
            color={isDark ? colors.text.primary : '#FFFFFF'}
            style={styles.messageText}
          >
            {message.content}
          </KiriText>
        </View>
      </Animated.View>
    );
  }

  // Assistant message - soft module
  return (
    <Animated.View
      entering={entering}
      layout={Layout.springify().damping(KiriMotion.spring.damping)}
      style={[styles.messageBubbleWrapper, styles.assistantWrapper]}
    >
      <View
        style={[
          styles.messageBubble,
          styles.assistantBubble,
          {
            backgroundColor: colors.moduleBackground,
            borderColor: colors.moduleBorder,
          },
        ]}
      >
        <KiriText variant="body" style={styles.messageText}>
          {message.content}
        </KiriText>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// LOCUS INPUT - MercuryOS command bar
// ============================================================================

interface LocusInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
}

function LocusInput({
  value,
  onChangeText,
  onSend,
  disabled,
  placeholder,
}: LocusInputProps) {
  const { isDark } = useTheme();
  const colors = isDark ? KiriColors.dark : KiriColors.light;
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const sendScale = useSharedValue(1);
  const canSend = value.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;

    sendScale.value = withSpring(0.9, { damping: 15 }, () => {
      sendScale.value = withSpring(1, { damping: 12 });
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend();
  };

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: interpolate(sendScale.value, [0.9, 1], [0.8, 1]),
  }));

  return (
    <View
      style={[
        styles.locusWrapper,
        { paddingBottom: insets.bottom || spacing[4] },
      ]}
    >
      {/* Subtle top edge */}
      <View
        style={[
          styles.locusTopEdge,
          { backgroundColor: colors.moduleBorder },
        ]}
      />

      <View style={styles.locusContainer}>
        {/* Input field */}
        <View
          style={[
            styles.locusInputWrapper,
            {
              backgroundColor: colors.moduleBackground,
              borderColor: colors.moduleBorder,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.locusInput, { color: colors.text.primary }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder || 'Ask anything...'}
            placeholderTextColor={colors.text.muted}
            multiline
            maxLength={2000}
            returnKeyType="default"
            accessibilityLabel="Message input"
          />
        </View>

        {/* Send - minimal circle */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend || disabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Animated.View
            style={[
              styles.sendButton,
              {
                backgroundColor: canSend
                  ? colors.accent
                  : colors.accentSoft,
              },
              sendAnimatedStyle,
            ]}
          >
            <SendIcon
              size="sm"
              color={
                canSend
                  ? isDark
                    ? '#0A0A0A'
                    : '#FFFFFF'
                  : colors.text.muted
              }
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// CONTINUE FLOW - MercuryOS transition
// ============================================================================

interface ContinueFlowProps {
  onPress: () => void;
  visible: boolean;
}

function ContinueFlow({ onPress, visible }: ContinueFlowProps) {
  const { isDark } = useTheme();
  const colors = isDark ? KiriColors.dark : KiriColors.light;

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(400).duration(600).easing(kiriEaseSlow)}
      style={styles.continueWrapper}
    >
      <AnimatedPressable onPress={onPress} haptic="medium">
        <View
          style={[
            styles.continueButton,
            {
              backgroundColor: colors.accent,
            },
          ]}
        >
          <KiriText
            variant="caption"
            color={isDark ? '#0A0A0A' : '#FFFFFF'}
            style={styles.continueText}
          >
            Continue
          </KiriText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ============================================================================
// TYPING INDICATOR - Kiri style
// ============================================================================

interface KiriTypingProps {
  visible: boolean;
}

function KiriTyping({ visible }: KiriTypingProps) {
  const { isDark } = useTheme();
  const colors = isDark ? KiriColors.dark : KiriColors.light;

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.typingWrapper,
        {
          backgroundColor: colors.moduleBackground,
          borderColor: colors.moduleBorder,
        },
      ]}
    >
      <TypingIndicator color={colors.text.tertiary} size={5} />
    </Animated.View>
  );
}

// ============================================================================
// MAIN WELCOME SCREEN - MercuryOS Kiri
// ============================================================================

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const { isDark } = useTheme();
  const colors = isDark ? KiriColors.dark : KiriColors.light;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<WelcomeMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const { serverUrl, onDeviceLlmEnabled } = useSettingsStore();

  // Add intro message on mount
  useEffect(() => {
    const introMessage: WelcomeMessage = {
      id: 'intro',
      role: 'assistant',
      content: getWelcomeMessage(),
      timestamp: new Date(),
      isIntro: true,
    };
    setMessages([introMessage]);
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === 'chat:response') {
        setIsTyping(false);
        const payload = message.payload as { text: string };

        const lastUserMessage = messages.find((m) => m.role === 'user');
        const analysis = lastUserMessage
          ? analyzeTask(lastUserMessage.content)
          : null;

        const formattedResponse = analysis
          ? formatConciergeResponse(payload.text, analysis)
          : payload.text;

        const assistantMessage: WelcomeMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Show response preview in Live Activity (iOS lock screen)
        showResponsePreview(formattedResponse);
      } else if (message.type === 'chat:error') {
        setIsTyping(false);
        const errorMessage: WelcomeMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: message.error || 'Something went wrong. Let me try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        // Show error in Live Activity
        showErrorState(message.error);
      }
    },
    [messages]
  );

  // WebSocket connection
  const { connectionState, send } = useWebSocket({
    url: serverUrl,
    autoConnect: true,
    onMessage: handleMessage,
  });

  const isOffline =
    connectionState.status === 'disconnected' ||
    connectionState.status === 'error';

  // Send message
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const analysis = analyzeTask(text);

    const userMessage: WelcomeMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setHasInteracted(true);
    Keyboard.dismiss();

    setIsTyping(true);

    // Start Live Activity to show "thinking" state on lock screen
    startThinkingActivity();

    if (isOffline && onDeviceLlmEnabled) {
      try {
        const systemContext = getConciergeSystemPrompt();
        const response = await generateOfflineResponse(
          `${systemContext}\n\nUser: ${text}`
        );
        const formattedResponse = formatConciergeResponse(response, analysis);

        const assistantMessage: WelcomeMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Show response in Live Activity
        showResponsePreview(formattedResponse);
      } catch {
        const errorMessage: WelcomeMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "I'm currently offline. Please connect to continue.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        // Show error in Live Activity
        showErrorState("I'm currently offline");
      } finally {
        setIsTyping(false);
      }
      return;
    }

    send({
      type: 'chat',
      payload: {
        message: text,
        systemPrompt: getConciergeSystemPrompt(),
      },
    });
  }, [inputText, send, isOffline, onDeviceLlmEnabled]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Handle suggested prompt selection
  const handleSuggestPress = useCallback((prompt: string) => {
    setInputText(prompt);
  }, []);

  const renderMessage = useCallback(
    ({ item, index }: { item: WelcomeMessage; index: number }) => (
      <MessageBubble message={item} index={index} onSuggestPress={handleSuggestPress} />
    ),
    [handleSuggestPress]
  );

  const keyExtractor = useCallback((item: WelcomeMessage) => item.id, []);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  }, [onComplete]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Kiri mist layer */}
      <MistLayer isDark={isDark} />

      {/* Header - minimal, typography focused */}
      <Animated.View
        entering={FadeIn.delay(100).duration(600)}
        style={[styles.header, { paddingTop: insets.top + spacing[2] }]}
      >
        <KiriText variant="micro" align="center">
          MINO
        </KiriText>
      </Animated.View>

      {/* Chat content */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* Typing indicator */}
        <KiriTyping visible={isTyping} />

        {/* Continue flow */}
        <ContinueFlow visible={hasInteracted} onPress={handleContinue} />

        {/* Locus input */}
        <LocusInput
          value={inputText}
          onChangeText={setInputText}
          onSend={sendMessage}
          disabled={isTyping}
          placeholder="Ask anything..."
        />
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================================
// STYLES - MercuryOS Kiri
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Ethereal fog
  mistGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  centerGlow: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    height: '40%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGlowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 200,
  },

  // Header
  header: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },

  // Chat container
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: 160,
  },

  // Intro prompt bubble
  introPromptWrapper: {
    marginBottom: spacing[4],
    paddingTop: spacing[8],
  },
  floatingAvatarWrapper: {
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  floatingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  promptBubbleWrapper: {
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  promptBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  promptText: {
    lineHeight: 24,
  },
  // Suggested prompts - horizontal flowing modules
  suggestedPromptsWrapper: {
    marginTop: spacing[6],
    marginLeft: -spacing[5], // Bleed to edge
    marginRight: -spacing[5],
  },
  suggestedPromptsScroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  suggestedModule: {
    width: SCREEN_WIDTH * 0.7,
    borderRadius: 24,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    overflow: 'hidden',
  },
  moduleGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
  suggestedText: {
    lineHeight: 26,
  },

  // Message bubbles
  messageBubbleWrapper: {
    marginBottom: spacing[3],
  },
  userWrapper: {
    alignItems: 'flex-end',
  },
  assistantWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    borderRadius: 18,
    overflow: 'hidden',
  },
  userBubble: {
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  messageText: {
    lineHeight: 22,
  },

  // Typing indicator
  typingWrapper: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    alignSelf: 'flex-start',
  },

  // Continue flow
  continueWrapper: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  continueButton: {
    borderRadius: 100,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  continueText: {
    fontWeight: '500',
  },

  // Locus input
  locusWrapper: {
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
  },
  locusTopEdge: {
    position: 'absolute',
    top: 0,
    left: spacing[4],
    right: spacing[4],
    height: 1,
  },
  locusContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
  },
  locusInputWrapper: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
  },
  locusInput: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 17,
    maxHeight: 100,
    minHeight: 44,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
