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
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { API_HOST_LABEL } from '../constants/config';
import { colors, radius, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/api';
import { authService } from '../services/auth';

type Step = 'phone' | 'otp';

const RESEND_SECONDS = 30;

export default function LoginScreen() {
  const { status, signIn } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const otpInputRef = useRef<TextInput | null>(null);
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

  function handlePhoneChange(value: string) {
    setPhoneDigits(value.replace(/\D/g, '').slice(0, 10));
    setError('');
  }

  function handleOtpChange(value: string) {
    setOtp(value.replace(/\D/g, '').slice(0, 6));
    setError('');
  }

  async function requestOtp(isResend = false) {
    if (phoneDigits.length !== 10) {
      setError('Enter your 10-digit mobile number.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await authService.requestOtp(phoneDigits);
      if (!mounted.current) return;

      setStep('otp');
      setOtp('');
      setDevOtp(result.devOtp ?? null);
      setResendIn(RESEND_SECONDS);
      setNotice(
        isResend
          ? 'A new code has been generated. Check the backend terminal.'
          : 'Code generated. It expires in 5 minutes.',
      );
      setTimeout(() => otpInputRef.current?.focus(), 250);
    } catch (caught) {
      if (!mounted.current) return;
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not request an OTP. Please try again.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await signIn(phoneDigits, otp);
      // The `status === 'signedIn'` branch above performs the redirect.
    } catch (caught) {
      if (!mounted.current) return;
      setError(
        caught instanceof ApiError ? caught.message : 'Could not verify the OTP. Please try again.',
      );
      setBusy(false);
    }
  }

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
            {step === 'phone' ? (
              <>
                <AppText variant="heading">Sign in</AppText>
                <AppText variant="small" color={colors.inkMuted} style={styles.subcopy}>
                  We will send a one-time code to verify your number.
                </AppText>

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
                  autoFocus
                  error={error || undefined}
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
                    <AppText variant="heading">Enter the code</AppText>
                    <AppText variant="small" color={colors.inkMuted} style={styles.subcopy}>
                      Sent to +91 {phoneDigits.slice(0, 5)} {phoneDigits.slice(5)}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => {
                      setStep('phone');
                      setOtp('');
                      setError('');
                      setNotice('');
                      setDevOtp(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Change phone number"
                    hitSlop={12}
                    style={styles.changeButton}
                  >
                    <AppText variant="smallStrong" color={colors.primary}>
                      Change
                    </AppText>
                  </Pressable>
                </View>

                <TextField
                  label="6-digit OTP"
                  value={otp}
                  onChangeText={handleOtpChange}
                  placeholder="••••••"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  inputRef={otpInputRef}
                  error={error || undefined}
                  helper={notice || undefined}
                  returnKeyType="done"
                  onSubmitEditing={() => void verifyOtp()}
                  containerStyle={styles.field}
                />

                <Button
                  label="Verify & sign in"
                  onPress={() => void verifyOtp()}
                  loading={busy}
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
                  onPress={() => {
                    setOtp(devOtp);
                    setError('');
                  }}
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
            API: {API_HOST_LABEL}
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
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
