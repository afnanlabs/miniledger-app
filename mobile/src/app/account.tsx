import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/StateView';
import { colors, radius, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { formatPhone, initials } from '../utils/format';

/**
 * Lightweight account view for information the app already has. It is not a
 * settings system: no profile editing, only identity, phone and logout.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingState message="Loading your account…" />
      </Screen>
    );
  }

  if (status === 'signedOut' || !user) {
    return <Redirect href="/login" />;
  }

  const displayName = user.name?.trim() || 'MiniLedger user';

  function confirmLogout() {
    Alert.alert('Log out?', 'You will need a new OTP to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void signOut();
        },
      },
    ]);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close account"
          hitSlop={10}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <Ionicons name="close" size={22} color={colors.inkMuted} />
        </Pressable>

        <AppText variant="subheading">Account</AppText>

        <View style={styles.closeButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.avatar}>
            <AppText variant="title" color={colors.primary}>
              {initials(displayName)}
            </AppText>
          </View>

          <AppText variant="heading" style={styles.name} numberOfLines={2}>
            {displayName}
          </AppText>

          <AppText variant="body" color={colors.inkMuted} style={styles.phone}>
            {formatPhone(user.phoneNumber)}
          </AppText>
        </Card>

        <Button
          variant="danger"
          label="Log out"
          onPress={confirmLogout}
          loading={busy}
          disabled={busy}
          style={styles.logout}
          accessibilityHint="Revokes this session and returns to the sign-in screen"
        />

        <AppText variant="caption" color={colors.inkFaint} style={styles.note}>
          Signing out requires a new one-time code for this number.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  name: {
    textAlign: 'center',
  },
  phone: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  logout: {
    marginTop: spacing.xxl,
  },
  note: {
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 17,
  },
});
