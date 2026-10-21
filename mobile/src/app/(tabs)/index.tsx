import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoanCard } from '../../components/LoanCard';
import { Screen } from '../../components/Screen';
import { SummaryCard } from '../../components/SummaryCard';
import { ErrorBanner, ErrorState, LoadingState } from '../../components/StateView';
import { API_HOST_LABEL } from '../../constants/config';
import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useLedger } from '../../hooks/useLedger';
import { ApiError } from '../../services/api';
import { formatInrCompact } from '../../utils/format';

const RECENT_LIMIT = 3;

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { summary, loans, status, errorMessage, refreshing, repayingId, refresh, reload, repay } =
    useLedger();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out?', 'You will need a new OTP to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  const handleRepay = useCallback(
    async (loanId: string) => {
      try {
        await repay(loanId);
      } catch (error) {
        Alert.alert(
          'Could not mark as repaid',
          error instanceof ApiError ? error.message : 'Please try again.',
        );
      }
    },
    [repay],
  );

  if (status === 'loading' && !summary) {
    return (
      <Screen edges={['top']}>
        <LoadingState />
      </Screen>
    );
  }

  if (status === 'error' && !summary) {
    return (
      <Screen edges={['top']}>
        <ErrorState message={errorMessage} onRetry={() => void reload()} />
      </Screen>
    );
  }

  const recentLoans = loans.slice(0, RECENT_LIMIT);

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="overline" color={colors.inkFaint}>
              YOUR LEDGER
            </AppText>
            <AppText variant="title" style={styles.greeting}>
              Hello
            </AppText>
            {user ? (
              <AppText variant="small" color={colors.inkMuted}>
                {user.phoneNumber}
              </AppText>
            ) : null}
          </View>

          <Pressable
            onPress={confirmLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.inkMuted} />
          </Pressable>
        </View>

        {errorMessage && summary ? (
          <View style={styles.bannerWrap}>
            <ErrorBanner message={errorMessage} />
          </View>
        ) : null}

        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <AppText variant="overline" color={colors.inkFaint}>
              TOTAL LENT
            </AppText>
            <View style={styles.heroBadge}>
              <Ionicons name="trending-up" size={14} color={colors.primary} />
            </View>
          </View>
          <AppText
            variant="display"
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatInrCompact(summary?.totalLent ?? '0')}
          </AppText>
          <AppText variant="caption" color={colors.inkMuted} style={styles.heroMeta}>
            {summary?.loanCount === 1
              ? '1 loan in your ledger'
              : `${summary?.loanCount ?? 0} loans in your ledger`}
            {'  ·  '}
            {summary?.pendingCount ?? 0} pending
          </AppText>
        </Card>

        <View style={styles.summaryRow}>
          <SummaryCard
            label="TOTAL REPAID"
            value={formatInrCompact(summary?.totalRepaid ?? '0')}
            caption={`${summary?.repaidCount ?? 0} settled`}
            tone="success"
          />
          <SummaryCard
            label="OVERDUE"
            value={formatInrCompact(summary?.overdueAmount ?? '0')}
            caption={
              summary?.overdueCount
                ? `${summary.overdueCount} past due`
                : 'Nothing overdue'
            }
            tone={summary?.overdueCount ? 'danger' : 'default'}
          />
        </View>

        <Button
          label="Add loan"
          onPress={() => router.push('/add-loan')}
          style={styles.addButton}
          accessibilityHint="Opens a form to record money you lent to a friend"
        />

        <View style={styles.sectionHeader}>
          <AppText variant="subheading">Recent loans</AppText>
          {loans.length > 0 ? (
            <Pressable
              onPress={() => router.push('/loans')}
              accessibilityRole="button"
              accessibilityLabel="View all loans"
              hitSlop={8}
            >
              <AppText variant="smallStrong" color={colors.primary}>
                View all
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {recentLoans.length === 0 ? (
          <Card variant="plain" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={22} color={colors.primary} />
            </View>
            <AppText variant="bodyStrong" style={styles.emptyTitle}>
              No loans yet
            </AppText>
            <AppText variant="small" color={colors.inkMuted} style={styles.emptyCopy}>
              Add the first amount you lent and MiniLedger will keep an eye on the due date.
            </AppText>
            <Button
              label="Add your first loan"
              variant="secondary"
              onPress={() => router.push('/add-loan')}
              style={styles.emptyAction}
            />
          </Card>
        ) : (
          <View style={styles.loanList}>
            {recentLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                onRepay={handleRepay}
                repaying={repayingId === loan.id}
              />
            ))}
          </View>
        )}

        <AppText variant="caption" color={colors.inkFaint} style={styles.footer}>
          Pull down to refresh · API {API_HOST_LABEL}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    marginTop: spacing.xs,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  bannerWrap: {
    marginBottom: spacing.lg,
  },
  hero: {
    paddingVertical: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmount: {
    marginTop: spacing.sm,
  },
  heroMeta: {
    marginTop: spacing.xs + 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  addButton: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  loanList: {
    gap: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: spacing.lg,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
