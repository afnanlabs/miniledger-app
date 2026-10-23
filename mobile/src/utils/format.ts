/**
 * Display formatting helpers.
 * All money arrives from the API as a decimal string, so it is only ever
 * formatted here - never parsed into a float.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Indian digit grouping: 1,23,45,678 */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

interface MoneyParts {
  negative: boolean;
  rupees: string;
  paise: string;
}

function splitAmount(amount: string): MoneyParts {
  const raw = String(amount ?? '0').trim();
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [rupeesRaw = '0', paiseRaw = ''] = unsigned.split('.');
  return {
    negative,
    rupees: rupeesRaw.replace(/^0+(?=\d)/, '') || '0',
    paise: (paiseRaw + '00').slice(0, 2),
  };
}

/** "₹1,23,456.78" - always two decimal places. */
export function formatInr(amount: string): string {
  const { negative, rupees, paise } = splitAmount(amount);
  return `${negative ? '-' : ''}₹${groupIndian(rupees)}.${paise}`;
}

/** "₹1,23,456" when there are no paise, otherwise "₹1,23,456.78". */
export function formatInrCompact(amount: string): string {
  const { negative, rupees, paise } = splitAmount(amount);
  const suffix = paise === '00' ? '' : `.${paise}`;
  return `${negative ? '-' : ''}₹${groupIndian(rupees)}${suffix}`;
}

/** "2026-10-21" -> "21 Oct 2026" (no timezone conversion). */
export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day || month < 1 || month > 12) return dateString;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Formats an ISO timestamp (e.g. `repaidAt`) using the device's local calendar
 * day. Slicing the UTC string would show the previous day for late-evening
 * repayments in positive-offset timezones.
 */
export function formatDateFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return formatDate(`${year}-${month}-${day}`);
}

/** "+919876543210" -> "+91 98765 43210" */
export function formatPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phoneNumber;
}

/** Keeps friend names from breaking the card layout. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shifts a YYYY-MM-DD date by a number of days. */
export function addDaysIso(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Loose validation used by the form before the request is sent. */
export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function formatDueLabel(
  loan: {
    isOverdue: boolean;
    daysOverdue: number;
    dueDate: string;
    status: string;
  },
  today: string = todayIso(),
): string {
  if (loan.status === 'repaid') return `Due ${formatDate(loan.dueDate)}`;
  if (loan.isOverdue) {
    const days = loan.daysOverdue;
    return days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`;
  }
  if (loan.dueDate === today) return 'Due today';
  if (loan.dueDate === addDaysIso(today, 1)) return 'Due tomorrow';
  return `Due ${formatDate(loan.dueDate)}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
