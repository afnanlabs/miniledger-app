import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';

export const OTP_LENGTH = 6;

interface OtpInputProps {
  /** The digits entered so far, without separators ("".."123456"). */
  value: string;
  onChange: (code: string) => void;
  /** Focus the first box when the screen appears. */
  autoFocus?: boolean;
  /** Renders every box with the error border. */
  hasError?: boolean;
}

function toDigits(value: string): string[] {
  return Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? '');
}

/**
 * Six single-digit boxes with the behaviour users expect from an OTP field:
 * type to advance, Backspace to step back, and paste (or an OS autofill) to
 * fill all six boxes at once.
 *
 * Digits are held locally so that editing or deleting a middle digit keeps the
 * other digits in their boxes. The parent still receives one joined string.
 *
 * Implemented with plain `TextInput`s so it works in Expo Go with no extra
 * native dependencies.
 */
export function OtpInput({ value, onChange, autoFocus = false, hasError = false }: OtpInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);
  const lastEmitted = useRef(value);

  const [digits, setDigits] = useState<string[]>(() => toDigits(value));

  // Pick up external changes (dev autofill, reset) without clobbering positions
  // when the change came from this component.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setDigits(toDigits(value));
    }
  }, [value]);

  const firstEmpty = digits.findIndex((digit) => digit === '');

  function focusBox(index: number) {
    const target = Math.max(0, Math.min(index, OTP_LENGTH - 1));
    refs.current[target]?.focus();
  }

  function emit(next: string[]) {
    setDigits(next);
    const code = next.join('');
    lastEmitted.current = code;
    onChange(code);
  }

  /** Replaces one digit without disturbing the others. */
  function withDigit(index: number, digit: string): string[] {
    const next = digits.slice();
    next[index] = digit;
    return next;
  }

  function handleChange(index: number, text: string) {
    const clean = text.replace(/\D/g, '');

    if (!clean) {
      emit(withDigit(index, ''));
      return;
    }

    // A complete code was pasted (or filled by the keyboard). Long strings are
    // treated as paste-over-existing, so keep the trailing six digits.
    if (clean.length >= OTP_LENGTH) {
      const code = clean.length === OTP_LENGTH ? clean : clean.slice(-OTP_LENGTH);
      emit(code.split(''));
      focusBox(OTP_LENGTH - 1);
      return;
    }

    // A short sequence pasted into one box fills the following boxes.
    if (clean.length > 1) {
      const next = digits.slice();
      for (let offset = 0; offset < clean.length && index + offset < OTP_LENGTH; offset += 1) {
        next[index + offset] = clean[offset];
      }
      emit(next);
      focusBox(index + clean.length);
      return;
    }

    emit(withDigit(index, clean));
    focusBox(index + 1);
  }

  function handleKeyPress(index: number, key: string) {
    if (key !== 'Backspace') return;
    // A filled box clears itself through the default change handler.
    if (digits[index]) return;
    if (index === 0) return;

    emit(withDigit(index - 1, ''));
    focusBox(index - 1);
  }

  // Tapping past the first empty box would leave a hole; send focus back so the
  // visible code always stays a contiguous prefix.
  function handleFocus(index: number) {
    if (firstEmpty !== -1 && index > firstEmpty) {
      focusBox(firstEmpty);
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digit}
          onChangeText={(text) => handleChange(index, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
          onFocus={() => handleFocus(index)}
          keyboardType="number-pad"
          inputMode="numeric"
          // Not 1: the whole code must fit when it is pasted into one box.
          maxLength={OTP_LENGTH}
          textAlign="center"
          selectTextOnFocus
          autoFocus={autoFocus && index === 0}
          caretHidden={false}
          accessibilityLabel={`OTP digit ${index + 1} of ${OTP_LENGTH}`}
          accessibilityHint="Enter one digit of the six-digit code"
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          style={[
            styles.box,
            digit ? styles.boxFilled : null,
            hasError ? styles.boxError : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.ink,
    ...typography.heading,
    paddingVertical: 0,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  boxError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
});
