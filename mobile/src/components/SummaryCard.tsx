import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Card } from './Card';
import { colors, radius, spacing } from '../constants/theme';

type SummaryTone = 'default' | 'success' | 'danger';

interface SummaryCardProps {
  label: string;
  value: string;
  caption?: string;
  tone?: SummaryTone;
}

const tones: Record<SummaryTone, { accent: string; value: string; wash: string }> = {
  default: { accent: colors.ink, value: colors.ink, wash: colors.surfaceMuted },
  success: { accent: colors.success, value: colors.success, wash: colors.successSoft },
  danger: { accent: colors.danger, value: colors.danger, wash: colors.dangerSoft },
};

export function SummaryCard({ label, value, caption, tone = 'default' }: SummaryCardProps) {
  const palette = tones[tone];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="overline" color={colors.inkFaint} style={styles.label}>
          {label}
        </AppText>
        <View style={[styles.dot, { backgroundColor: palette.wash }]}>
          <View style={[styles.dotInner, { backgroundColor: palette.accent }]} />
        </View>
      </View>

      <AppText
        variant="amountLarge"
        color={palette.value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </AppText>

      {caption ? (
        <AppText variant="caption" color={colors.inkFaint} style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    flexShrink: 1,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  caption: {
    marginTop: spacing.xs,
  },
});
