import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { OtpInput, OTP_LENGTH } from '../components/OtpInput';
import { Screen } from '../components/Screen';
import { ErrorBanner } from '../components/StateView';
import { TextField } from '../components/TextField';
import { API_HOST_LABEL } from '../constants/config';
import { colors, radius, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { ApiError, fieldErrors } from '../services/api';
import { authService } from '../services/auth';

type Step = 'details' | 'otp';

interface FormErrors {
  name?: string;
  phone?: string;
  otp?: string;
}

const RESEND_SECONDS = 30;
const PHONE_PATTERN = /^[6-9]\d{9}$/;

export default function LoginScreen() {
  const { status, signIn } = useAuth();

  const [step, setStep] = useState<Step>('details');
  const [fullName, setFullName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const phoneInputRef = useRef<TextInput | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => Math.max(value - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Once the session exists, leave the login screen.
  if (status === 'signedIn') {
    return <Redirect href="/" />;
  }

  function handleNameChange(value: string) {
    setFullName(value);
    setErrors((current) => ({ ...current, name: undefined }));
    setFormError('');
  }

  function handlePhoneChange(value: string) {
    setPhoneDigits(value.replace(/\D/g, '').slice(0, 10));
    setErrors((current) => ({ ...current, phone: undefined }));
    setFormError('');
  }

  function handleOtpChange(value: string) {
    setOtp(value.replace(/\D/g, '').slice(0, OTP_LENGTH));
    setErrors((current) => ({ ...current, otp: undefined }));
    setFormError('');
  }

  function resetToDetails() {
    setStep('details');
    setOtp('');
    setErrors({});
    setFormError('');
    setNotice('');
    setDevOtp(null);
  }

  function validateDetails(): boolean {
    const nextErrors: FormErrors = {};
    const trimmedName = fullName.trim();

    if (trimmedName.length < 2) {
      nextErrors.name =
        trimmedName.length === 0 ? 'Enter your full name.' : 'Name must be at least 2 characters.';
    }
    if (!PHONE_PATTERN.test(phoneDigits)) {
      nextErrors.phone = 'Enter a valid 10-digit mobile number (starting with 6-9).';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function requestOtp(isResend = false) {
    if (!isResend && !validateDetails()) return;

    setBusy(true);
    setErrors({});
    setFormError('');
    try {
      const result = await authService.requestOtp(phoneDigits, fullName.trim());
      if (!mounted.current) return;

      setStep('otp');
      setOtp('');
      setDevOtp(result.devOtp ?? null);
      setResendIn(RESEND_SECONDS);
      const minutes = Math.round(result.expiresInSeconds / 60);
      const expiry =
        result.expiresInSeconds < 60
          ? `${result.expiresInSeconds} seconds`
          : `${minutes} minute${minutes === 1 ? '' : 's'}`;
      setNotice(
        isResend
          ? `A new code has been generated. It expires in ${expiry}.`
          : `Code generated. It expires in ${expiry}.`,
      );
    } catch (caught) {
      if (!mounted.current) return;

      const mapped = fieldErrors(caught);
      const nextErrors: FormErrors = {
        name: mapped.name,
        phone: mapped.phoneNumber,
      };
      if (nextErrors.name || nextErrors.phone) {
        setErrors(nextErrors);
      } else {
        setFormError(
          caught instanceof ApiError
            ? caught.message
            : 'Could not request an OTP. Please try again.',
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== OTP_LENGTH) return;

    setBusy(true);
    setErrors({});
    setFormError('');
    try {
      await signIn(phoneDigits, otp);
      // The `status === 'signedIn'` branch above performs the redirect.
    } catch (caught) {
      if (!mounted.current) return;
      setErrors({
        otp:
          caught instanceof ApiError
            ? caught.message
            : 'Could not verify the OTP. Please try again.',
      });
      setBusy(false);
    }
  }

  const firstName = fullName.trim().split(/\s+/)[0] ?? '';

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <AppText variant="title" color={colors.onPrimary}>
                ₹
              </AppText>
            </View>
            <AppText variant="display" style={styles.brandName}>
              MiniLedger
            </AppText>
            <AppText variant="body" color={colors.inkMuted} style={styles.tagline}>
              Keep track of what you lend, and get it back.
            </AppText>
          </View>

          <Card style={styles.card}>
            {formError ? (
              <View style={styles.banner}>
                <ErrorBanner message={formError} />
              </View>
            ) : null}

            {step === 'details' ? (
              <>
                <AppText variant="heading">Sign in</AppText>
                <AppText variant="small" color={colors.inkMuted} style={styles.subcopy}>
                  Tell us your name and we will send a one-time code to verify your number.
                </AppText>

                <TextField
                  label="Full name"
                  value={fullName}
                  onChangeText={handleNameChange}
                  placeholder="Afnan Khan"
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  maxLength={80}
                  autoFocus
                  error={errors.name}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneInputRef.current?.focus()}
                  containerStyle={styles.field}
                />

                <TextField
                  label="Mobile number"
                  value={phoneDigits}
                  onChangeText={handlePhoneChange}
                  placeholder="98765 43210"
                  prefix="+91"
                  keyboardType="number-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxLength={10}
                  inputRef={phoneInputRef}
                  error={errors.phone}
                  helper="Indian numbers only (10 digits, starting with 6-9)"
                  returnKeyType="done"
                  onSubmitEditing={() => void requestOtp()}
                  containerStyle={styles.field}
                />

                <Button
                  label={busy ? 'Sending code…' : 'Send OTP'}
                  onPress={() => void requestOtp()}
                  loading={busy}
                  style={styles.submit}
                />
              </>
            ) : (
              <>
                <View style={styles.otpHeader}>
                  <View style={styles.flex}>
                    <AppText variant="heading">
                      {firstName ? `Hello, ${firstName}` : 'Enter the code'}
                    </AppText>
                    <AppText variant="small" color={colors.inkMuted} style={styles.subcopy}>
                      Sent to +91 {phoneDigits.slice(0, 5)} {phoneDigits.slice(5)}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={resetToDetails}
                    accessibilityRole="button"
                    accessibilityLabel="Change name or phone number"
                    hitSlop={12}
                    style={styles.changeButton}
                  >
                    <AppText variant="smallStrong" color={colors.primary}>
                      Change
                    </AppText>
                  </Pressable>
                </View>

                <OtpInput
                  value={otp}
                  onChange={handleOtpChange}
                  hasError={Boolean(errors.otp)}
                  autoFocus
                />

                {errors.otp ? (
                  <AppText variant="caption" color={colors.danger} style={styles.otpError}>
                    {errors.otp}
                  </AppText>
                ) : notice ? (
                  <AppText variant="caption" color={colors.inkFaint} style={styles.otpError}>
                    {notice}
                  </AppText>
                ) : null}

                <Button
                  label="Verify & sign in"
                  onPress={() => void verifyOtp()}
                  loading={busy}
                  disabled={otp.length !== OTP_LENGTH}
                  style={styles.submit}
                />

                <View style={styles.resendRow}>
                  <AppText variant="small" color={colors.inkFaint}>
                    Didn&apos;t get it?
                  </AppText>
                  <Pressable
                    onPress={() => void requestOtp(true)}
                    disabled={busy || resendIn > 0}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy || resendIn > 0 }}
                    hitSlop={8}
                    style={styles.resendButton}
                  >
                    <AppText
                      variant="smallStrong"
                      color={busy || resendIn > 0 ? colors.inkFaint : colors.primary}
                    >
                      {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                    </AppText>
                  </Pressable>
                </View>
              </>
            )}
          </Card>

          {step === 'otp' ? (
            <Card variant="sunken" style={styles.devCard}>
              <View style={styles.devHeader}>
                <Ionicons name="terminal-outline" size={16} color={colors.primary} />
                <AppText variant="captionStrong" color={colors.primary}>
                  Development build
                </AppText>
              </View>
              <AppText variant="caption" color={colors.inkMuted} style={styles.devText}>
                This app uses a mock OTP. The 6-digit code is printed in the backend terminal
                (look for &quot;MOCK OTP&quot;). No SMS is sent.
              </AppText>

              {devOtp ? (
                <Pressable
                  onPress={() => handleOtpChange(devOtp)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use the development code ${devOtp}`}
                  style={styles.devOtp}
                >
                  <AppText variant="caption" color={colors.inkMuted}>
                    Code from the API:
                  </AppText>
                  <AppText variant="subheading" color={colors.primary}>
                    {devOtp}
                  </AppText>
                  <AppText variant="captionStrong" color={colors.primary}>
                    Use
                  </AppText>
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          <AppText variant="caption" color={colors.inkFaint} style={styles.footer}>
            {__DEV__ ? `API: ${API_HOST_LABEL}` : 'MiniLedger · keep track of what you lend'}
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brandName: {
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  card: {
    padding: spacing.xxl,
  },
  banner: {
    marginBottom: spacing.lg,
  },
  subcopy: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 19,
  },
  field: {
    marginBottom: spacing.lg,
  },
  submit: {
    marginTop: spacing.xs,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  changeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  otpError: {
    marginTop: spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  resendButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  devCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  devText: {
    lineHeight: 18,
  },
  devOtp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
