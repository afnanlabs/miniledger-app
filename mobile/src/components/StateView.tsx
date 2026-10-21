import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { colors, radius, spacing } from '../constants/theme';

export function LoadingState({ message = 'Loading your ledger…' }: { message?: string }) {
  return (
    <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText variant="small" color={colors.inkFaint} style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.centered}>
      <View style={styles.errorMark}>
        <AppText variant="heading" color={colors.danger}>
          !
        </AppText>
      </View>
      <AppText variant="subheading" style={styles.title}>
        Something went wrong
      </AppText>
      <AppText variant="small" color={colors.inkMuted} style={styles.body}>
        {message}
      </AppText>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyMark}>
        <AppText variant="title" color={colors.primary}>
          ₹
        </AppText>
      </View>
      <AppText variant="subheading" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="small" color={colors.inkMuted} style={styles.body}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

/** Inline red banner used by forms and the dashboard. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppText variant="small" color={colors.danger}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  text: {
    marginTop: spacing.md,
  },
  title: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.sm,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.xl,
    minWidth: 160,
  },
  errorMark: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMark: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
