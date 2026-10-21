import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Badge } from './Badge';
import { Card } from './Card';
import { colors, radius, spacing } from '../constants/theme';
import type { Loan } from '../types';
import {
  formatDateFromTimestamp,
  formatDueLabel,
  formatInr,
  initials,
} from '../utils/format';

interface LoanCardProps {
  loan: Loan;
  onRepay: (loan: Loan) => void;
  onEdit?: (loan: Loan) => void;
  /** Server "today" (YYYY-MM-DD) so due labels match the API's overdue rule. */
  today?: string;
  repaying?: boolean;
  showRepayButton?: boolean;
}

export function LoanCard({
  loan,
  onRepay,
  onEdit,
  today,
  repaying = false,
  showRepayButton = true,
}: LoanCardProps) {
  const pending = loan.status === 'pending';
  const overdue = pending && loan.isOverdue;

  return (
    <Card style={[styles.card, overdue ? styles.cardOverdue : null]}>
      {overdue ? <View style={styles.overdueAccent} /> : null}

      <View style={styles.row}>
        <View style={[styles.avatar, overdue ? styles.avatarOverdue : null]}>
          <AppText variant="smallStrong" color={overdue ? colors.danger : colors.primary}>
            {initials(loan.friendName)}
          </AppText>
        </View>

        <View style={styles.identity}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {loan.friendName}
          </AppText>
          <AppText
            variant="caption"
            color={overdue ? colors.danger : colors.inkFaint}
            style={styles.dueLabel}
          >
            {formatDueLabel(loan, today)}
          </AppText>
        </View>

        <View style={styles.amountBlock}>
          <AppText
            variant="amount"
            color={pending ? colors.ink : colors.inkMuted}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {formatInr(loan.amount)}
          </AppText>
          <View style={styles.badgeRow}>
            {overdue ? <Badge label="Overdue" tone="danger" /> : null}
            {pending && !overdue ? <Badge label="Pending" tone="warning" /> : null}
            {!pending ? <Badge label="Repaid" tone="success" /> : null}
          </View>
        </View>
      </View>

      {!pending && loan.repaidAt ? (
        <AppText variant="caption" color={colors.inkFaint} style={styles.repaidNote}>
          Marked repaid on {formatDateFromTimestamp(loan.repaidAt)}
        </AppText>
      ) : null}

      {pending && (showRepayButton || onEdit) ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Pressable
              onPress={() => onEdit(loan)}
              disabled={repaying}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${loan.friendName}'s loan`}
              accessibilityState={{ disabled: repaying }}
              style={({ pressed }) => [
                styles.editButton,
                pressed && !repaying ? styles.editPressed : null,
              ]}
            >
              <AppText variant="smallStrong" color={colors.inkMuted}>
                Edit
              </AppText>
            </Pressable>
          ) : null}

          {showRepayButton ? (
            <Pressable
              onPress={() => onRepay(loan)}
              disabled={repaying}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${loan.friendName}'s loan as repaid`}
              accessibilityState={{ disabled: repaying, busy: repaying }}
              style={({ pressed }) => [
                styles.repayButton,
                pressed && !repaying ? styles.repayPressed : null,
                repaying ? styles.repayBusy : null,
              ]}
            >
              {repaying ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <AppText variant="smallStrong" color={colors.primary}>
                  Mark as repaid
                </AppText>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    overflow: 'hidden',
  },
  cardOverdue: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerWash,
  },
  overdueAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.danger,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarOverdue: {
    backgroundColor: colors.dangerSoft,
  },
  identity: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  dueLabel: {
    marginTop: 2,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs + 2,
  },
  repaidNote: {
    marginTop: spacing.md,
  },
  repayButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  repayPressed: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  repayBusy: {
    opacity: 0.7,
  },
});
