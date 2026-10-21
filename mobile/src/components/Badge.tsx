import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radius, spacing } from '../constants/theme';

type BadgeTone = 'success' | 'danger' | 'neutral' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, { background: string; text: string }> = {
  success: { background: colors.successSoft, text: colors.success },
  danger: { background: colors.dangerSoft, text: colors.danger },
  warning: { background: colors.warningSoft, text: colors.warning },
  neutral: { background: colors.surfaceMuted, text: colors.inkMuted },
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const palette = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: palette.background }]}>
      <AppText variant="captionStrong" color={palette.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
