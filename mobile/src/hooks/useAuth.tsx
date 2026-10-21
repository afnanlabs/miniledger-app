import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authService } from '../services/auth';
import { ApiError, setAuthToken, setUnauthorizedHandler } from '../services/api';
import type { User } from '../types';

const TOKEN_KEY = 'miniledger.auth.token';
const USER_KEY = 'miniledger.auth.user';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Verifies the OTP on the backend and persists the session. */
  signIn: (phoneNumber: string, otp: string) => Promise<void>;
  /** Revokes the token on the server and clears the local session. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function clearStoredSession(): Promise<void> {
  setAuthToken(null);
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => undefined);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const handleUnauthorized = useCallback(() => {
    void clearStoredSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Any authenticated 401 (revoked/expired token) ends the local session once.
  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  // Restore the saved session on cold start.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      try {
        const [token, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (!token) {
          if (!cancelled) setStatus('signedOut');
          return;
        }

        setAuthToken(token);

        if (storedUser) {
          try {
            if (!cancelled) {
              setUser(JSON.parse(storedUser) as User);
              setStatus('signedIn');
            }
          } catch {
            // Corrupt cache - ignore it and fall through to /auth/me.
          }
        }

        // Confirm the token is still valid (it may have been revoked).
        try {
          const freshUser = await authService.me();
          if (cancelled) return;
          setUser(freshUser);
          setStatus('signedIn');
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiError && error.isUnauthorized) {
            await clearStoredSession();
            setUser(null);
            setStatus('signedOut');
            return;
          }
          // Network problem: keep the cached session so the app still opens.
          setStatus((current) => (current === 'signedIn' ? current : 'signedOut'));
        }
      } catch {
        if (!cancelled) setStatus('signedOut');
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (phoneNumber: string, otp: string) => {
    const result = await authService.verifyOtp(phoneNumber, otp);
    setAuthToken(result.token);
    setUser(result.user);
    setStatus('signedIn');
    // A storage failure must not undo a successful sign-in; the session simply
    // will not survive a restart.
    try {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, result.token],
        [USER_KEY, JSON.stringify(result.user)],
      ]);
    } catch {
      // Ignored on purpose.
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // The local session is still cleared when the server is unreachable.
    }
    await clearStoredSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
