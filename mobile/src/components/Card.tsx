import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '../constants/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `plain` drops the shadow, `sunken` tints the surface. */
  variant?: 'elevated' | 'plain' | 'sunken';
}

export function Card({ children, style, variant = 'elevated' }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && shadows.card,
        variant === 'sunken' && styles.sunken,
        variant === 'plain' && styles.plain,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sunken: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
  },
  plain: {
    shadowOpacity: 0,
    elevation: 0,
  },
});
