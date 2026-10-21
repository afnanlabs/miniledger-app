import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { ErrorBanner, ErrorState, LoadingState } from '../components/StateView';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { ApiError, fieldErrors } from '../services/api';
import { loansService } from '../services/loans';
import {
  addDaysIso,
  formatInr,
  isValidDateInput,
  todayIso,
} from '../utils/format';

const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

interface FormValues {
  friendName: string;
  amount: string;
  dueDate: string;
}

/**
 * One form for creating and editing. Editing is reached with an `id` route
 * param; the same validation and field layout is reused so the two flows stay
 * consistent.
 */
export default function AddLoanScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const params = useLocalSearchParams<{ id?: string; asOfDate?: string }>();
  const loanId = typeof params.id === 'string' ? params.id : undefined;
  const isEditing = Boolean(loanId);

  // The dashboard/list pass the server's "today" so the date shortcuts match
  // the API's overdue rule even when the phone is in another timezone.
  const serverToday =
    typeof params.asOfDate === 'string' && isValidDateInput(params.asOfDate)
      ? params.asOfDate
      : todayIso();

  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => addDaysIso(serverToday, 7));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState('');

  const initialValues = useRef<FormValues>({
    friendName: '',
    amount: '',
    dueDate: addDaysIso(serverToday, 7),
  });
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (backTimer.current) clearTimeout(backTimer.current);
    };
  }, []);

  // Load the existing loan when editing. Only pending loans may be changed.
  useEffect(() => {
    if (!loanId) return undefined;

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    loansService
      .get(loanId)
      .then((loan) => {
        if (cancelled) return;
        if (loan.status !== 'pending') {
          setLoadError('Repaid loans cannot be edited or deleted.');
          setLoading(false);
          return;
        }

        const values: FormValues = {
          friendName: loan.friendName,
          amount: loan.amount,
          dueDate: loan.dueDate,
        };
        initialValues.current = values;
        setFriendName(values.friendName);
        setAmount(values.amount);
        setDueDate(values.dueDate);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Could not load this loan. Please go back and try again.',
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loanId]);

  const isDirty =
    friendName !== initialValues.current.friendName ||
    amount !== initialValues.current.amount ||
    dueDate !== initialValues.current.dueDate;

  function handleAmountChange(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const [integerPart = '', ...rest] = cleaned.split('.');
    const next = rest.length > 0 ? `${integerPart}.${rest.join('').slice(0, 2)}` : integerPart;
    setAmount(next.slice(0, 13));
    setErrors((current) => ({ ...current, amount: '' }));
  }

  function selectDueDate(value: string) {
    setDueDate(value);
    setErrors((current) => ({ ...current, dueDate: '' }));
  }

  function requestClose() {
    if (busy || saved || deleting) return;

    if (!isDirty) {
      router.back();
      return;
    }

    Alert.alert('Discard changes?', 'Your changes will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  async function submit() {
    const trimmedName = friendName.trim();
    const trimmedAmount = amount.trim();
    const nextErrors: Record<string, string> = {};

    if (trimmedName.length < 2) {
      nextErrors.friendName = "Enter your friend's name (at least 2 characters).";
    }
    if (!AMOUNT_PATTERN.test(trimmedAmount) || !/[1-9]/.test(trimmedAmount)) {
      nextErrors.amount = 'Enter an amount greater than 0, with up to 2 decimals.';
    }
    if (!isValidDateInput(dueDate)) {
      nextErrors.dueDate = 'Use the YYYY-MM-DD format, e.g. 2026-11-05.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    setErrors({});
    setFormError('');

    try {
      const input = {
        friendName: trimmedName,
        amount: trimmedAmount,
        dueDate,
      };

      if (loanId) {
        await loansService.update(loanId, input);
      } else {
        await loansService.create(input);
      }

      if (!mounted.current) return;
      setSaved(true);
      setBusy(false);
      // Give the user a moment to see the confirmation before going back.
      backTimer.current = setTimeout(() => {
        backTimer.current = null;
        router.back();
      }, 650);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiError) {
        const mapped = fieldErrors(error);
        setErrors(mapped);
        setFormError(Object.keys(mapped).length === 0 ? error.message : '');
      } else {
        setFormError('Something went wrong while saving the loan. Please try again.');
      }
      setBusy(false);
    }
  }

  async function deleteLoan() {
    if (!loanId) return;

    setDeleting(true);
    setFormError('');

    try {
      await loansService.remove(loanId);
      if (!mounted.current) return;
      router.back();
    } catch (error) {
      if (!mounted.current) return;
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong while deleting the loan. Please try again.',
      );
      setDeleting(false);
    }
  }

  function confirmDelete() {
    if (!loanId || busy || saved || deleting) return;

    const describeAmount = AMOUNT_PATTERN.test(amount.trim()) ? formatInr(amount.trim()) : 'This loan';
    Alert.alert(
      'Delete this loan?',
      `${describeAmount} from ${friendName.trim() || 'this friend'} will be permanently removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete loan', style: 'destructive', onPress: () => void deleteLoan() },
      ],
    );
  }

  const closeDisabled = busy || saved || deleting;
  const title = isEditing ? 'Edit loan' : 'New loan';

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Pressable
          onPress={requestClose}
          disabled={closeDisabled}
          accessibilityRole="button"
          accessibilityLabel="Cancel and close"
          accessibilityState={{ disabled: closeDisabled }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && !closeDisabled && styles.closeButtonPressed,
          ]}
        >
          <Ionicons name="close" size={22} color={colors.inkMuted} />
        </Pressable>

        <AppText variant="subheading">{title}</AppText>

        <View style={styles.closeButton} />
      </View>
    );
  }

  // A revoked session while this modal is open should return to sign-in rather
  // than leaving an unusable form on top of the tabs.
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        {renderHeader()}
        <LoadingState message="Loading loan…" />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen edges={['top', 'bottom']}>
        {renderHeader()}
        <ErrorState message={loadError} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderHeader()}

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="small" color={colors.inkMuted} style={styles.intro}>
            {isEditing
              ? 'Update the amount, friend, or due date. Only pending loans can be changed.'
              : 'Record money you have lent. It stays pending until you mark it as repaid.'}
          </AppText>

          {formError ? (
            <View style={styles.bannerWrap}>
              <ErrorBanner message={formError} />
            </View>
          ) : null}

          <Card style={styles.card}>
            <TextField
              label="Friend's name"
              value={friendName}
              onChangeText={(value) => {
                setFriendName(value);
                setErrors((current) => ({ ...current, friendName: '' }));
              }}
              placeholder="e.g. Aarav Mehta"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={80}
              error={errors.friendName || undefined}
              containerStyle={styles.field}
            />

            <TextField
              label="Amount"
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              prefix="₹"
              keyboardType="decimal-pad"
              maxLength={13}
              error={errors.amount || undefined}
              helper="Up to 2 decimal places"
              containerStyle={styles.field}
            />

            <TextField
              label="Due date"
              value={dueDate}
              onChangeText={(value) => selectDueDate(value.replace(/[^0-9-]/g, '').slice(0, 10))}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={errors.dueDate || undefined}
              containerStyle={styles.field}
            />

            <View style={styles.chips}>
              <DateChip
                label="Today"
                value={serverToday}
                selected={dueDate === serverToday}
                onPress={selectDueDate}
              />
              <DateChip
                label="In 1 week"
                value={addDaysIso(serverToday, 7)}
                selected={dueDate === addDaysIso(serverToday, 7)}
                onPress={selectDueDate}
              />
              <DateChip
                label="In 1 month"
                value={addDaysIso(serverToday, 30)}
                selected={dueDate === addDaysIso(serverToday, 30)}
                onPress={selectDueDate}
              />
            </View>
          </Card>

          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
            <AppText variant="caption" color={colors.inkMuted} style={styles.hintText}>
              A loan becomes overdue the day after its due date. Repaid loans are never counted
              as overdue.
            </AppText>
          </View>

          {isEditing ? (
            <Button
              variant="danger"
              label="Delete loan"
              onPress={confirmDelete}
              loading={deleting}
              disabled={busy || saved}
              style={styles.deleteButton}
              accessibilityHint="Permanently removes this pending loan"
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={
              saved
                ? isEditing
                  ? 'Changes saved ✓'
                  : 'Loan added ✓'
                : isEditing
                  ? 'Save changes'
                  : 'Add loan'
            }
            onPress={() => void submit()}
            loading={busy}
            disabled={saved || deleting}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

interface DateChipProps {
  label: string;
  value: string;
  selected: boolean;
  onPress: (value: string) => void;
}

function DateChip({ label, value, selected, onPress }: DateChipProps) {
  return (
    <Pressable
      onPress={() => onPress(value)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <AppText variant="captionStrong" color={selected ? colors.primary : colors.inkMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  intro: {
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  bannerWrap: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  hintText: {
    flex: 1,
    lineHeight: 17,
  },
  deleteButton: {
    marginTop: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
