import { useCallback, useEffect, useRef, useState } from 'react';

import { loansService } from '../services/loans';
import { summaryService } from '../services/summary';
import { ApiError } from '../services/api';
import type { Loan, Summary } from '../types';

type LoadStatus = 'loading' | 'ready' | 'error';

interface UseLedgerResult {
  summary: Summary | null;
  loans: Loan[];
  /** Server calendar date used by overdue labels and date shortcuts. */
  asOfDate: string;
  status: LoadStatus;
  errorMessage: string;
  refreshing: boolean;
  repayingId: string | null;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
  repay: (loanId: string) => Promise<void>;
}

/**
 * Loads the dashboard data (summary + loans) and exposes refresh/repay actions.
 *
 * Both the dashboard and the loan list use this hook; a screen refetches
 * whenever it regains focus so changes made in the "Add loan" modal or on the
 * other tab appear immediately.
 */
export function useLedger(): UseLedgerResult {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [repayingId, setRepayingId] = useState<string | null>(null);

  const mounted = useRef(true);
  const requestId = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    const id = requestId.current + 1;
    requestId.current = id;

    if (mode === 'refresh') setRefreshing(true);
    else setStatus('loading');

    try {
      const [nextSummary, nextLoans] = await Promise.all([
        summaryService.get(),
        loansService.listAll(),
      ]);

      if (!mounted.current || requestId.current !== id) return;

      setSummary(nextSummary);
      setLoans(nextLoans.loans);
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      if (!mounted.current || requestId.current !== id) return;

      const message =
        error instanceof ApiError
          ? error.message
          : 'Something went wrong while loading your ledger.';

      // Keep previously loaded data on a failed refresh instead of blanking it.
      setErrorMessage(message);
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  const reload = useCallback(() => load('initial'), [load]);
  const refresh = useCallback(() => load('refresh'), [load]);

  const repay = useCallback(
    async (loanId: string) => {
      setRepayingId(loanId);
      try {
        await loansService.repay(loanId);
        const [nextSummary, nextLoans] = await Promise.all([
          summaryService.get(),
          loansService.listAll(),
        ]);
        if (!mounted.current) return;
        setSummary(nextSummary);
        setLoans(nextLoans.loans);
        setErrorMessage('');
        setStatus('ready');
      } finally {
        if (mounted.current) setRepayingId(null);
      }
    },
    [],
  );

  // Cleanup flag so late responses never update an unmounted screen.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    summary,
    loans,
    asOfDate: summary?.asOfDate ?? '',
    status,
    errorMessage,
    refreshing,
    repayingId,
    refresh,
    reload,
    repay,
  };
}
