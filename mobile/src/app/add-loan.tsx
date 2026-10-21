import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { ErrorBanner } from '../components/StateView';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../constants/theme';
import { ApiError, fieldErrors } from '../services/api';
import { loansService } from '../services/loans';
import { addDaysIso, isValidDateInput, todayIso } from '../utils/format';

const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export default function AddLoanScreen() {
  const router = useRouter();

  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => addDaysIso(todayIso(), 7));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

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
      await loansService.create({
        friendName: trimmedName,
        amount: trimmedAmount,
        dueDate,
      });
      setSaved(true);
      // Give the user a moment to see the confirmation before going back.
      setTimeout(() => router.back(), 550);
    } catch (error) {
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

  const today = todayIso();

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel and close"
            hitSlop={10}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            <Ionicons name="close" size={22} color={colors.inkMuted} />
          </Pressable>

          <AppText variant="subheading">New loan</AppText>

          <View style={styles.closeButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="small" color={colors.inkMuted} style={styles.intro}>
            Record money you have lent. It stays pending until you mark it as repaid.
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
                value={today}
                selected={dueDate === today}
                onPress={selectDueDate}
              />
              <DateChip
                label="In 1 week"
                value={addDaysIso(today, 7)}
                selected={dueDate === addDaysIso(today, 7)}
                onPress={selectDueDate}
              />
              <DateChip
                label="In 1 month"
                value={addDaysIso(today, 30)}
                selected={dueDate === addDaysIso(today, 30)}
                onPress={selectDueDate}
              />
            </View>
          </Card>

          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkFaint} />
            <AppText variant="caption" color={colors.inkFaint} style={styles.hintText}>
              A loan becomes overdue the day after its due date. Repaid loans are never counted
              as overdue.
            </AppText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={saved ? 'Loan added ✓' : 'Add loan'}
            onPress={() => void submit()}
            loading={busy}
            disabled={saved}
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
    width: 40,
    height: 40,
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
    minHeight: 40,
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
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
