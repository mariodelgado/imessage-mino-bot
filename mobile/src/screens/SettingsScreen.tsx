/**
 * Settings Screen - Elite iOS 26 Settings Interface
 *
 * Premium features:
 * - Grouped inset lists with liquid glass blur
 * - Spring animations on interactions
 * - SF Symbols iconography
 * - Full HIG compliance with accessibility
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Application from 'expo-application';

import { useSettingsStore } from '../stores/settingsStore';
import { useTheme } from '../theme';
import {
  AnimatedPressable,
} from '../components';
import {
  Title1,
  Body,
  Subheadline,
  Caption2,
  Label,
} from '../components/Typography';
import {
  ServerIcon,
  AIIcon,
  NotificationIcon,
  ThemeIcon,
  InfoIcon,
  ChevronRightIcon,
  CheckIcon,
} from '../components/Icons';
import { spacing, borderRadius, shadows } from '../theme/tokens';

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Label color={colors.foreground.tertiary} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Label>
      {subtitle && (
        <Caption2 color={colors.foreground.muted} style={styles.sectionSubtitle}>
          {subtitle}
        </Caption2>
      )}
    </View>
  );
}

// ============================================================================
// SECTION FOOTER
// ============================================================================

interface SectionFooterProps {
  text: string;
}

function SectionFooter({ text }: SectionFooterProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionFooter}>
      <Caption2 color={colors.foreground.muted}>{text}</Caption2>
    </View>
  );
}

// ============================================================================
// SETTINGS GROUP (Liquid Glass Container)
// ============================================================================

interface SettingsGroupProps {
  children: React.ReactNode;
  index?: number;
}

function SettingsGroup({ children, index = 0 }: SettingsGroupProps) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(400).springify()}
      layout={Layout.springify()}
      style={styles.groupWrapper}
    >
      <View
        style={[
          styles.groupContainer,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.8)',
            borderColor: colors.border.default,
          },
        ]}
      >
        <BlurView
          intensity={isDark ? 20 : 40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.groupContent}>{children}</View>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// SETTINGS ROW
// ============================================================================

interface SettingsRowProps {
  icon?: React.ReactNode;
  iconColor?: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  accessory?: React.ReactNode;
  showChevron?: boolean;
  isLast?: boolean;
  destructive?: boolean;
}

function SettingsRow({
  icon,
  iconColor,
  label,
  sublabel,
  value,
  onPress,
  accessory,
  showChevron = false,
  isLast = false,
  destructive = false,
}: SettingsRowProps) {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.rowContainer,
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border.subtle },
      ]}
    >
      {icon && (
        <View
          style={[
            styles.rowIconContainer,
            {
              backgroundColor: iconColor
                ? iconColor + '20'
                : colors.accent.primary + '20',
            },
          ]}
        >
          {icon}
        </View>
      )}

      <View style={styles.rowContent}>
        <View style={styles.rowTextContainer}>
          <Body
            color={destructive ? colors.status.error : colors.foreground.primary}
          >
            {label}
          </Body>
          {sublabel && (
            <Caption2 color={colors.foreground.muted} style={styles.rowSublabel}>
              {sublabel}
            </Caption2>
          )}
        </View>

        <View style={styles.rowAccessory}>
          {value && (
            <Subheadline color={colors.foreground.tertiary} style={styles.rowValue}>
              {value}
            </Subheadline>
          )}
          {accessory}
          {showChevron && <ChevronRightIcon size="sm" />}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={sublabel}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return content;
}

// ============================================================================
// TEXT INPUT ROW
// ============================================================================

interface TextInputRowProps {
  icon?: React.ReactNode;
  iconColor?: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: 'default' | 'url' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  isLast?: boolean;
}

function TextInputRow({
  icon,
  iconColor,
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  isLast = false,
}: TextInputRowProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.rowContainer,
        styles.inputRowContainer,
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border.subtle },
      ]}
    >
      {icon && (
        <View
          style={[
            styles.rowIconContainer,
            {
              backgroundColor: iconColor
                ? iconColor + '20'
                : colors.accent.primary + '20',
            },
          ]}
        >
          {icon}
        </View>
      )}

      <View style={styles.inputContent}>
        <Body color={colors.foreground.primary}>{label}</Body>
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.foreground.primary,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.foreground.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

// ============================================================================
// TOGGLE ROW
// ============================================================================

interface ToggleRowProps {
  icon?: React.ReactNode;
  iconColor?: string;
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
}

function ToggleRow({
  icon,
  iconColor,
  label,
  sublabel,
  value,
  onValueChange,
  isLast = false,
}: ToggleRowProps) {
  const { colors } = useTheme();

  const handleChange = (newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(newValue);
  };

  return (
    <View
      style={[
        styles.rowContainer,
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border.subtle },
      ]}
    >
      {icon && (
        <View
          style={[
            styles.rowIconContainer,
            {
              backgroundColor: iconColor
                ? iconColor + '20'
                : colors.accent.primary + '20',
            },
          ]}
        >
          {icon}
        </View>
      )}

      <View style={styles.rowContent}>
        <View style={styles.rowTextContainer}>
          <Body color={colors.foreground.primary}>{label}</Body>
          {sublabel && (
            <Caption2 color={colors.foreground.muted} style={styles.rowSublabel}>
              {sublabel}
            </Caption2>
          )}
        </View>

        <Switch
          value={value}
          onValueChange={handleChange}
          trackColor={{
            false: colors.background.tertiary,
            true: colors.accent.primary,
          }}
          thumbColor="#FFF"
          accessibilityLabel={label}
          accessibilityState={{ checked: value }}
        />
      </View>
    </View>
  );
}

// ============================================================================
// THEME OPTION
// ============================================================================

interface ThemeOptionProps {
  label: string;
  value: 'light' | 'dark' | 'system';
  selected: boolean;
  onSelect: () => void;
  isLast?: boolean;
}

function ThemeOption({ label, selected, onSelect, isLast = false }: ThemeOptionProps) {
  const { colors } = useTheme();

  return (
    <AnimatedPressable
      onPress={onSelect}
      haptic="light"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.rowContainer,
          !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border.subtle },
        ]}
      >
        <View style={styles.rowContent}>
          <Body color={colors.foreground.primary}>{label}</Body>
          {selected && <CheckIcon size="sm" color={colors.accent.primary} />}
        </View>
      </View>
    </AnimatedPressable>
  );
}

// ============================================================================
// MAIN SETTINGS SCREEN
// ============================================================================

export default function SettingsScreen() {
  const { colors } = useTheme();
  const {
    serverUrl,
    onDeviceLlmEnabled,
    notificationsEnabled,
    hapticFeedback,
    theme,
    setServerUrl,
    setOnDeviceLlmEnabled,
    setNotificationsEnabled,
    setHapticFeedbackEnabled,
    updateSetting,
    resetToDefaults,
  } = useSettingsStore();

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);

  // Save server URL on blur
  const handleServerUrlBlur = useCallback(() => {
    if (localServerUrl !== serverUrl) {
      setServerUrl(localServerUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [localServerUrl, serverUrl, setServerUrl]);

  // Theme selection
  const handleThemeSelect = useCallback(
    (newTheme: 'light' | 'dark' | 'system') => {
      updateSetting('theme', newTheme);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [updateSetting]
  );

  // Reset settings
  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetToDefaults();
            setLocalServerUrl('ws://localhost:3001');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, [resetToDefaults]);

  // Open support
  const handleOpenSupport = useCallback(() => {
    Linking.openURL('https://github.com/marioelysian/mino-bot/issues');
  }, []);

  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildNumber = Application.nativeBuildVersion || '1';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.header}
        >
          <Title1 color={colors.foreground.primary}>Settings</Title1>
        </Animated.View>

        {/* Server Connection */}
        <SectionHeader title="Connection" />
        <SettingsGroup index={0}>
          <TextInputRow
            icon={<ServerIcon size="sm" color={colors.accent.primary} />}
            iconColor={colors.accent.primary}
            label="Server URL"
            value={localServerUrl}
            onChangeText={setLocalServerUrl}
            onBlur={handleServerUrlBlur}
            placeholder="ws://localhost:3001"
            keyboardType="url"
            isLast
          />
        </SettingsGroup>
        <SectionFooter text="WebSocket URL for the Mino server. Changes apply on next connection." />

        {/* AI Settings */}
        <SectionHeader title="AI" />
        <SettingsGroup index={1}>
          <ToggleRow
            icon={<AIIcon size="sm" color={colors.status.warning} />}
            iconColor={colors.status.warning}
            label="On-Device LLM"
            sublabel="Use local AI when offline"
            value={onDeviceLlmEnabled}
            onValueChange={setOnDeviceLlmEnabled}
            isLast
          />
        </SettingsGroup>
        <SectionFooter text="Enable offline AI responses using on-device processing. May impact battery life." />

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <SettingsGroup index={2}>
          <ThemeOption
            label="Light"
            value="light"
            selected={theme === 'light'}
            onSelect={() => handleThemeSelect('light')}
          />
          <ThemeOption
            label="Dark"
            value="dark"
            selected={theme === 'dark'}
            onSelect={() => handleThemeSelect('dark')}
          />
          <ThemeOption
            label="System"
            value="system"
            selected={theme === 'system'}
            onSelect={() => handleThemeSelect('system')}
            isLast
          />
        </SettingsGroup>

        {/* Feedback */}
        <SectionHeader title="Feedback" />
        <SettingsGroup index={3}>
          <ToggleRow
            icon={<NotificationIcon size="sm" color={colors.status.error} />}
            iconColor={colors.status.error}
            label="Notifications"
            sublabel="Receive push notifications"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <ToggleRow
            icon={<ThemeIcon size="sm" color={colors.accent.secondary} />}
            iconColor={colors.accent.secondary}
            label="Haptic Feedback"
            sublabel="Vibration on interactions"
            value={hapticFeedback}
            onValueChange={setHapticFeedbackEnabled}
            isLast
          />
        </SettingsGroup>

        {/* About */}
        <SectionHeader title="About" />
        <SettingsGroup index={4}>
          <SettingsRow
            icon={<InfoIcon size="sm" color={colors.accent.primary} />}
            iconColor={colors.accent.primary}
            label="Version"
            value={`${appVersion} (${buildNumber})`}
          />
          <SettingsRow
            label="Support"
            onPress={handleOpenSupport}
            showChevron
            isLast
          />
        </SettingsGroup>

        {/* Danger Zone */}
        <SectionHeader title="Data" />
        <SettingsGroup index={5}>
          <SettingsRow
            label="Reset All Settings"
            onPress={handleReset}
            destructive
            isLast
          />
        </SettingsGroup>
        <SectionFooter text="This will reset all settings to their default values. Your chat history will not be affected." />

        {/* Footer Branding */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.footer}
        >
          <Caption2 color={colors.foreground.muted} align="center">
            Made with love for iOS
          </Caption2>
          <Caption2 color={colors.foreground.muted} align="center" style={styles.footerCopyright}>
            Mino AI Assistant
          </Caption2>
        </Animated.View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[24],
  },

  // Header
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },

  // Section Header
  sectionHeader: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
  },
  sectionTitle: {
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    marginTop: spacing[1],
  },

  // Section Footer
  sectionFooter: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },

  // Settings Group
  groupWrapper: {
    paddingHorizontal: spacing[4],
  },
  groupContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 0.5,
    ...shadows.sm,
  },
  groupContent: {
    position: 'relative',
  },

  // Row
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 52,
  },
  inputRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
  },
  rowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputContent: {
    flex: 1,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: spacing[3],
  },
  rowSublabel: {
    marginTop: spacing[0.5],
  },
  rowAccessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rowValue: {
    textAlign: 'right',
  },

  // Text Input
  textInput: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.md,
    fontSize: 15,
  },

  // Footer
  footer: {
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
  },
  footerCopyright: {
    marginTop: spacing[1],
  },
});
