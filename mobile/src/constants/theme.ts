/**
 * MiniLedger design tokens.
 * One source of truth for colour, spacing, radius and type so every screen
 * stays visually consistent.
 */

export const colors = {
  background: '#F4F7F4',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF2EE',
  surfaceSunken: '#E7EEE9',

  ink: '#0C1A13',
  inkMuted: '#5A6B62',
  // Dark enough for WCAG AA (>= 4.5:1) on the app background, not just white.
  inkFaint: '#5F6E66',

  border: '#E1E8E2',
  borderStrong: '#CFDAD2',

  primary: '#0B7A55',
  primaryPressed: '#075E41',
  primarySoft: '#E3F3EB',
  primarySoftPressed: '#D3EBE0',
  primaryTint: '#F7FBF9',
  onPrimary: '#FFFFFF',

  success: '#0B7A55',
  successSoft: '#E3F3EB',

  danger: '#C2410C',
  dangerSoft: '#FCEFE7',
  dangerSoftPressed: '#F8E0D2',
  dangerSurface: '#FFFBF9',
  dangerBorder: '#F3D9C8',
  dangerWash: '#FFFDFC',

  warning: '#A16207',
  warningSoft: '#FBF3E2',

  overlay: 'rgba(12, 26, 19, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 13, fontWeight: '400' },
  smallStrong: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  captionStrong: { fontSize: 12, fontWeight: '600' },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  amountLarge: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  amount: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#0C1A13',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0C1A13',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

/** Minimum accessible touch target (iOS HIG / Android) is 44-48dp. */
export const MIN_TOUCH_TARGET = 48;
