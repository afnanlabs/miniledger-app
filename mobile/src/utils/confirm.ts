import { Alert } from 'react-native';

import type { Loan } from '../types';
import { formatInr } from './format';

/**
 * Repaying is a one-way action (there is no undo), so both the dashboard and
 * the loan list confirm it with the exact loan details before updating.
 */
export function confirmRepayment(loan: Loan, onConfirm: () => void): void {
  Alert.alert(
    'Mark as repaid?',
    `${formatInr(loan.amount)} from ${loan.friendName} will be marked as repaid.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark as repaid', onPress: onConfirm },
    ],
  );
}
