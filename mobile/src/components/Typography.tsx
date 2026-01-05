/**
 * Typography Components - iOS HIG compliant text styles
 *
 * Dynamic type support, semantic naming, and accessibility.
 */

import React, { ReactNode } from 'react';
import {
  Text as RNText,
  TextStyle,
  StyleProp,
  TextProps as RNTextProps,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme';
import { typography } from '../theme/tokens';

interface BaseTextProps extends RNTextProps {
  children: ReactNode;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
}

// ============================================================================
// LARGE TITLE - 34pt bold
// ============================================================================

export function LargeTitle({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <RNText
      style={[
        typography.largeTitle,
        { color: textColor, textAlign: align },
        style,
      ]}
      accessibilityRole="header"
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// TITLE 1 - 28pt bold
// ============================================================================

export function Title1({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <RNText
      style={[
        typography.title1,
        { color: textColor, textAlign: align },
        style,
      ]}
      accessibilityRole="header"
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// TITLE 2 - 22pt bold
// ============================================================================

export function Title2({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <RNText
      style={[
        typography.title2,
        { color: textColor, textAlign: align },
        style,
      ]}
      accessibilityRole="header"
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// TITLE 3 - 20pt semibold
// ============================================================================

export function Title3({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <RNText
      style={[
        typography.title3,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// HEADLINE - 17pt semibold
// ============================================================================

export function Headline({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <RNText
      style={[
        typography.headline,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// BODY - 17pt regular
// ============================================================================

export function Body({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <RNText
      style={[
        typography.body,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// CALLOUT - 16pt regular
// ============================================================================

export function Callout({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.secondary;

  return (
    <RNText
      style={[
        typography.callout,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// SUBHEADLINE - 15pt regular
// ============================================================================

export function Subheadline({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.secondary;

  return (
    <RNText
      style={[
        typography.subheadline,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// FOOTNOTE - 13pt regular
// ============================================================================

export function Footnote({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.tertiary;

  return (
    <RNText
      style={[
        typography.footnote,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// CAPTION 1 - 12pt regular
// ============================================================================

export function Caption1({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.tertiary;

  return (
    <RNText
      style={[
        typography.caption1,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// CAPTION 2 - 11pt regular
// ============================================================================

export function Caption2({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.muted;

  return (
    <RNText
      style={[
        typography.caption2,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// ANIMATED TEXT (for transitions)
// ============================================================================

export function AnimatedBody({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.primary;

  return (
    <Animated.Text
      style={[
        typography.body,
        { color: textColor, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </Animated.Text>
  );
}

// ============================================================================
// LABEL - Uppercase letter-spaced (for section headers)
// ============================================================================

export function Label({ children, color, align, style, ...props }: BaseTextProps) {
  const { colors } = useTheme();
  const textColor = color || colors.foreground.tertiary;

  return (
    <RNText
      style={[
        typography.caption1,
        {
          color: textColor,
          textAlign: align,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: '600',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// LINK - Interactive text
// ============================================================================

interface LinkProps extends BaseTextProps {
  onPress?: () => void;
}

export function Link({ children, color, align, style, onPress, ...props }: LinkProps) {
  const { colors } = useTheme();
  const textColor = color || colors.accent.primary;

  return (
    <RNText
      style={[
        typography.body,
        {
          color: textColor,
          textAlign: align,
          textDecorationLine: 'underline',
        },
        style,
      ]}
      onPress={onPress}
      accessibilityRole="link"
      {...props}
    >
      {children}
    </RNText>
  );
}
