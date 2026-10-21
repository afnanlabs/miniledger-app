import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '../../components/AppText';
import { LoanCard } from '../../components/LoanCard';
import { Screen } from '../../components/Screen';
import { SegmentedControl, type SegmentOption } from '../../components/SegmentedControl';
import { EmptyState, ErrorBanner, ErrorState, LoadingState } from '../../components/StateView';
import { colors, radius, spacing } from '../../constants/theme';
import { useLedger } from '../../hooks/useLedger';
import { ApiError } from '../../services/api';
import type { Loan } from '../../types';
import { confirmRepayment } from '../../utils/confirm';

type Filter = 'all' | 'pending' | 'repaid';

const FILTERS: ReadonlyArray<SegmentOption<Filter>> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'repaid', label: 'Repaid' },
];

export default function LoansScreen() {
  const router = useRouter();
  const { loans, asOfDate, status, errorMessage, refreshing, repayingId, refresh, reload, repay } =
    useLedger();
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const filtered = useMemo<Loan[]>(() => {
    if (filter === 'all') return loans;
    return loans.filter((loan) => loan.status === filter);
  }, [loans, filter]);

  const counts = useMemo(() => {
    const pending = loans.filter((loan) => loan.status === 'pending').length;
    return { pending, repaid: loans.length - pending };
  }, [loans]);

  const handleRepay = useCallback(
    (loan: Loan) => {
      confirmRepayment(loan, () => {
        void (async () => {
          try {
            await repay(loan.id);
          } catch (error) {
            Alert.alert(
              'Could not mark as repaid',
              error instanceof ApiError ? error.message : 'Please try again.',
            );
          }
        })();
      });
    },
    [repay],
  );

  const openAddLoan = useCallback(() => {
    router.push({
      pathname: '/add-loan',
      params: asOfDate ? { asOfDate } : {},
    });
  }, [asOfDate, router]);

  const handleEdit = useCallback(
    (loan: Loan) => {
      router.push({
        pathname: '/add-loan',
        params: { id: loan.id, ...(asOfDate ? { asOfDate } : {}) },
      });
    },
    [asOfDate, router],
  );

  if (status === 'loading' && loans.length === 0) {
    return (
      <Screen edges={['top']}>
        <LoadingState message="Loading your loans…" />
      </Screen>
    );
  }

  if (status === 'error' && loans.length === 0) {
    return (
      <Screen edges={['top']}>
        <ErrorState message={errorMessage} onRetry={() => void reload()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <AppText variant="title">Loans</AppText>
                <AppText variant="small" color={colors.inkMuted} style={styles.subtitle}>
                  {counts.pending} pending · {counts.repaid} repaid
                </AppText>
              </View>
              <Pressable
                onPress={openAddLoan}
                accessibilityRole="button"
                accessibilityLabel="Add a loan"
                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
              >
                <Ionicons name="add" size={18} color={colors.onPrimary} />
                <AppText variant="smallStrong" color={colors.onPrimary}>
                  New
                </AppText>
              </Pressable>
            </View>

            <View style={styles.filter}>
              <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
            </View>

            {errorMessage && loans.length > 0 ? (
              <View style={styles.bannerWrap}>
                <ErrorBanner message={errorMessage} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <LoanCard
            loan={item}
            onRepay={handleRepay}
            onEdit={handleEdit}
            today={asOfDate || undefined}
            repaying={repayingId === item.id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              title={
                filter === 'all'
                  ? 'Your ledger is empty'
                  : filter === 'pending'
                    ? 'No pending loans'
                    : 'Nothing repaid yet'
              }
              message={
                filter === 'all'
                  ? 'Record the money you lend and MiniLedger keeps track of who owes what.'
                  : filter === 'pending'
                    ? 'Every loan has been settled. Nice work.'
                    : 'Loans you mark as repaid will appear here.'
              }
              actionLabel={filter === 'all' ? 'Add a loan' : undefined}
              onAction={filter === 'all' ? openAddLoan : undefined}
            />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    flex: 1,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  filter: {
    marginTop: spacing.lg,
  },
  bannerWrap: {
    marginTop: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 320,
  },
});
