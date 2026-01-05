/**
 * Chat Screen - Elite iOS 26 Conversation Interface
 *
 * Premium features:
 * - Liquid glass message bubbles with blur effects
 * - Spring animations on message send
 * - Animated typing indicator with bouncing dots
 * - Gesture-based interactions
 * - Full HIG compliance with accessibility
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
  FadeIn,
  SlideInRight,
  SlideInLeft,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useWebSocket } from '../hooks/useWebSocket';
import { useChatStore } from '../stores/chatStore';
import { useMinoStore } from '../stores/minoStore';
import { useSettingsStore } from '../stores/settingsStore';
import { generateResponse as generateOfflineResponse } from '../services/onDeviceLLM';
import { ChatMessage, ServerMessage } from '../types';
import { useTheme } from '../theme';
import {
  AnimatedPressable,
  TypingIndicator,
} from '../components';
import {
  useThinkingEffect,
  AmbientLayer,
} from '../components/CinematicEffects';
import {
  Body,
  Caption1,
  Caption2,
  Title2,
  Footnote,
} from '../components/Typography';
import { SendIcon, ConnectionStatusIcon } from '../components/Icons';
import { spacing, borderRadius, animations, shadows } from '../theme/tokens';

// ============================================================================
// ANIMATED MESSAGE BUBBLE
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
}

function MessageBubble({ message, index }: MessageBubbleProps) {
  const { colors, isDark } = useTheme();
  const isUser = message.role === 'user';

  const entering = isUser
    ? SlideInRight.delay(index * 20)
        .duration(350)
        .springify()
        .damping(18)
    : SlideInLeft.delay(index * 20)
        .duration(350)
        .springify()
        .damping(18);

  return (
    <Animated.View
      entering={entering}
      layout={Layout.springify().damping(15)}
      style={[
        styles.messageBubbleWrapper,
        isUser ? styles.userWrapper : styles.assistantWrapper,
      ]}
    >
      {isUser ? (
        // User bubble - solid accent color
        <View
          style={[
            styles.messageBubble,
            styles.userBubble,
            { backgroundColor: colors.accent.primary },
          ]}
          accessibilityRole="text"
          accessibilityLabel={`You said: ${message.content}`}
        >
          <Body color={colors.foreground.inverse} style={styles.messageText}>
            {message.content}
          </Body>
          <Caption2
            color="rgba(0,0,0,0.5)"
            style={styles.timestamp}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Caption2>
        </View>
      ) : (
        // Assistant bubble - liquid glass effect
        <View
          style={[styles.messageBubble, styles.assistantBubble]}
          accessibilityRole="text"
          accessibilityLabel={`Mino said: ${message.content}`}
        >
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.6)',
              },
            ]}
          />
          <View style={styles.bubbleContent}>
            <Body color={colors.foreground.primary} style={styles.messageText}>
              {message.content}
            </Body>

            {message.action === 'mino' && message.minoRequest && (
              <View
                style={[
                  styles.actionBadge,
                  { backgroundColor: colors.accent.primary + '20' },
                ]}
              >
                <Caption1 color={colors.accent.primary}>
                  🌐 {message.minoRequest.url}
                </Caption1>
              </View>
            )}

            <Caption2
              color={colors.foreground.muted}
              style={styles.timestamp}
            >
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Caption2>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// CONNECTION STATUS BAR
// ============================================================================

interface StatusBarProps {
  status: 'authenticated' | 'connecting' | 'disconnected' | 'error';
  isOfflineMode: boolean;
  onReconnect: () => void;
}

function ConnectionStatusBar({ status, isOfflineMode, onReconnect }: StatusBarProps) {
  const { colors, isDark } = useTheme();

  const getStatusLabel = () => {
    if (status === 'authenticated') return 'Connected';
    if (status === 'connecting') return 'Connecting...';
    if (isOfflineMode) return 'Offline Mode';
    return 'Disconnected';
  };

  const getConnectionStatus = (): 'connected' | 'connecting' | 'disconnected' => {
    if (status === 'authenticated') return 'connected';
    if (status === 'connecting') return 'connecting';
    return 'disconnected';
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.statusBarContainer}
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
      <View style={styles.statusBarContent}>
        <View style={styles.statusIndicator}>
          <ConnectionStatusIcon status={getConnectionStatus()} size="sm" />
          <Caption1 color={colors.foreground.secondary} style={styles.statusText}>
            {getStatusLabel()}
          </Caption1>
        </View>

        {status === 'disconnected' && !isOfflineMode && (
          <AnimatedPressable onPress={onReconnect} haptic="light">
            <View
              style={[
                styles.reconnectButton,
                { backgroundColor: colors.background.tertiary },
              ]}
            >
              <Caption1 color={colors.accent.primary}>Reconnect</Caption1>
            </View>
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// LIQUID GLASS INPUT BAR
// ============================================================================

interface InputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
}

function InputBar({ value, onChangeText, onSend, disabled }: InputBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const sendScale = useSharedValue(1);
  const canSend = value.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;

    // Animate send button
    sendScale.value = withSpring(0.8, animations.spring.snappy, () => {
      sendScale.value = withSpring(1, animations.spring.bouncy);
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend();
  };

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  return (
    <View style={[styles.inputWrapper, { paddingBottom: insets.bottom || spacing[4] }]}>
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background.glass },
        ]}
      />
      <View
        style={[styles.inputBorder, { borderTopColor: colors.border.glass }]}
      />

      <View style={styles.inputContainer}>
        <View
          style={[
            styles.textInputWrapper,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.05)',
              borderColor: colors.border.default,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: colors.foreground.primary }]}
            value={value}
            onChangeText={onChangeText}
            placeholder="Message Mino..."
            placeholderTextColor={colors.foreground.muted}
            multiline
            maxLength={2000}
            returnKeyType="default"
            accessibilityLabel="Message input"
            accessibilityHint="Type your message to Mino"
          />
        </View>

        <AnimatedPressable
          onPress={handleSend}
          disabled={!canSend || disabled}
          haptic="medium"
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend || disabled }}
        >
          <Animated.View
            style={[
              styles.sendButton,
              {
                backgroundColor: canSend
                  ? colors.accent.primary
                  : colors.background.tertiary,
              },
              sendAnimatedStyle,
            ]}
          >
            <SendIcon
              size="sm"
              color={canSend ? colors.foreground.inverse : colors.foreground.muted}
            />
          </Animated.View>
        </AnimatedPressable>
      </View>
    </View>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(200).duration(500).springify()}
      style={styles.emptyState}
    >
      <Animated.Text style={styles.emptyIcon}>🐟</Animated.Text>
      <Title2 color={colors.foreground.primary} align="center">
        Hey! I'm Mino
      </Title2>
      <Footnote
        color={colors.foreground.secondary}
        align="center"
        style={styles.emptySubtitle}
      >
        Ask me anything or tell me to browse the web for you.
      </Footnote>
    </Animated.View>
  );
}

// ============================================================================
// MAIN CHAT SCREEN
// ============================================================================

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();

  const { messages, isTyping, addMessage, setTyping } = useChatStore();
  const { startSession, addScreenshot, addAction, setResult, setError } =
    useMinoStore();
  const { serverUrl, onDeviceLlmEnabled } = useSettingsStore();

  // Cinematic thinking effect - syncs with Dynamic Island
  const { startThinking, stopThinking } = useThinkingEffect();

  // Handle incoming messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case 'chat:response':
          setTyping(false);
          const payload = message.payload as {
            text: string;
            action?: string;
            minoRequest?: { url: string; goal: string };
          };

          addMessage({
            role: 'assistant',
            content: payload.text,
            status: 'sent',
            action: payload.action,
            minoRequest: payload.minoRequest,
          });

          // Stop thinking and show response in Live Activity
          stopThinking(true, payload.text);

          if (payload.action === 'mino' && payload.minoRequest) {
            startSession(
              `mino-${Date.now()}`,
              payload.minoRequest.url,
              payload.minoRequest.goal
            );
          }

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;

        case 'chat:error':
          setTyping(false);
          stopThinking(false);
          addMessage({
            role: 'assistant',
            content: message.error || 'Something went wrong',
            status: 'error',
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;

        case 'mino:screenshot':
          const screenshotPayload = message.payload as { screenshot: string };
          addScreenshot(screenshotPayload.screenshot);
          break;

        case 'mino:action':
          const actionPayload = message.payload as {
            action?: string;
            thought?: string;
          };
          if (actionPayload.action) {
            addAction(actionPayload.action, actionPayload.thought);
          }
          break;

        case 'mino:result':
          const resultPayload = message.payload as { result: unknown };
          setResult(resultPayload.result);
          break;

        case 'mino:error':
          const errorPayload = message.payload as { error: string };
          setError(errorPayload.error);
          break;
      }
    },
    [addMessage, setTyping, startSession, addScreenshot, addAction, setResult, setError, stopThinking]
  );

  // WebSocket connection
  const { connectionState, send, connect } = useWebSocket({
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

    addMessage({
      role: 'user',
      content: text,
      status: 'sending',
    });

    setInputText('');
    Keyboard.dismiss();

    if (isOffline && onDeviceLlmEnabled) {
      setTyping(true);
      startThinking('Thinking offline...');
      try {
        const response = await generateOfflineResponse(text);
        addMessage({
          role: 'assistant',
          content: response,
          status: 'sent',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        stopThinking(true, response);
      } catch {
        addMessage({
          role: 'assistant',
          content: "Sorry, I couldn't process that offline. Please try reconnecting.",
          status: 'error',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        stopThinking(false);
      } finally {
        setTyping(false);
      }
      return;
    }

    send({
      type: 'chat',
      payload: { message: text },
    });

    setTyping(true);
    startThinking('Mino is thinking...');
  }, [inputText, addMessage, send, setTyping, isOffline, onDeviceLlmEnabled, startThinking, stopThinking]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Render message
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => (
      <MessageBubble message={item} index={index} />
    ),
    []
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      {/* Ambient cinematic background - subtle aurora effect */}
      <AmbientLayer variant="aurora" intensity="subtle" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Connection Status */}
        <ConnectionStatusBar
          status={connectionState.status as any}
          isOfflineMode={isOffline && onDeviceLlmEnabled}
          onReconnect={connect}
        />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState />}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* Typing indicator */}
        {isTyping && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[
              styles.typingContainer,
              { backgroundColor: colors.background.secondary },
            ]}
          >
            <View style={styles.typingContent}>
              <TypingIndicator color={colors.accent.primary} size={6} />
              <Caption1 color={colors.foreground.secondary}>
                Mino is thinking...
              </Caption1>
            </View>
          </Animated.View>
        )}

        {/* Input */}
        <InputBar
          value={inputText}
          onChangeText={setInputText}
          onSend={sendMessage}
          disabled={false}
        />
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },

  // Status Bar
  statusBarContainer: {
    overflow: 'hidden',
  },
  statusBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusText: {
    marginLeft: spacing[1],
  },
  reconnectButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },

  // Message List
  messageList: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    paddingBottom: spacing[24],
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },

  // Message Bubble
  messageBubbleWrapper: {
    marginBottom: spacing[2],
  },
  userWrapper: {
    alignItems: 'flex-end',
  },
  assistantWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  userBubble: {
    borderBottomRightRadius: borderRadius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  assistantBubble: {
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  messageText: {
    lineHeight: 22,
  },
  timestamp: {
    marginTop: spacing[1],
    alignSelf: 'flex-end',
  },
  actionBadge: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },

  // Typing Indicator
  typingContainer: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    borderRadius: borderRadius['2xl'],
    borderBottomLeftRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  typingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing[4],
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptySubtitle: {
    marginTop: spacing[2],
    lineHeight: 22,
  },

  // Input Bar
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  inputBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0.5,
    borderTopWidth: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  textInputWrapper: {
    flex: 1,
    borderRadius: borderRadius['2xl'],
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  textInput: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
