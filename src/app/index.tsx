import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { getAuthToken, setAuthToken } from '@/lib/auth';

type Credentials = {
  email: string;
  password: string;
};

type TokenResponse = {
  accessToken?: string;
};

type ApiErrorPayload = {
  detail?: unknown;
  errors?: Record<string, unknown>;
};

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function readApiError(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as ApiErrorPayload;
    if (typeof payload.detail === 'string') {
      return payload.detail;
    }

    if (payload.errors) {
      const messages = Object.values(payload.errors).reduce<string[]>((allMessages, fieldMessages) => {
        if (Array.isArray(fieldMessages)) {
          return allMessages.concat(fieldMessages.filter((message) => typeof message === 'string'));
        }

        if (typeof fieldMessages === 'string') {
          return allMessages.concat(fieldMessages);
        }

        return allMessages;
      }, []);

      if (messages.length > 0) {
        return messages.join(' ');
      }
    }
  } catch {
    return text;
  }

  return text;
}

async function requestLoginToken(credentials: Credentials) {
  const response = await apiFetch('/login', {
    authenticated: false,
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Login failed with status ${response.status}.`));
  }

  const token = (await response.json()) as TokenResponse;
  if (!token.accessToken) {
    throw new Error('The login response did not include an access token.');
  }

  return token.accessToken;
}

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email && password && (!isSignUp || confirmPassword) && !isSubmitting;

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const token = await getAuthToken();
      if (!isMounted) {
        return;
      }

      if (token) {
        router.replace('/problems');
        return;
      }

      setIsCheckingSession(false);
    }

    checkSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogin() {
    setMessage('');
    setIsSubmitting(true);

    try {
      const token = await requestLoginToken({ email, password });
      await setAuthToken(token);
      router.replace('/problems');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp() {
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch('/register', {
        authenticated: false,
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, `Sign up failed with status ${response.status}.`));
      }

      const token = await requestLoginToken({ email, password });
      await setAuthToken(token);
      router.replace('/problems');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign up failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function showSignUp() {
    setMessage('');
    setIsSignUp(true);
  }

  function showLogin() {
    setMessage('');
    setConfirmPassword('');
    setIsSignUp(false);
  }

  if (isCheckingSession) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardAvoiding}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
          <View style={[styles.identity, isWide && styles.identityWide]}>
            <Text style={styles.brand}>IseGrader</Text>
            <Text style={styles.title}>Coding practice, grading, and progress tracking.</Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? 'Create an account to start your assigned problems and Python workspace.'
                : 'Sign in to continue to your assigned problems and Python workspace.'}
            </Text>
          </View>

          <View style={styles.formPanel}>
            <Text style={styles.formTitle}>{isSignUp ? 'Sign up' : 'Sign in'}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="name@example.com"
                placeholderTextColor="#7b8794"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="password"
                placeholder="Password"
                placeholderTextColor="#7b8794"
                secureTextEntry
                style={styles.input}
              />
            </View>

            {isSignUp && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  placeholderTextColor="#7b8794"
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            )}

            {!!message && <Text style={styles.message}>{message}</Text>}

            <Pressable
              disabled={!canSubmit}
              onPress={isSignUp ? handleSignUp : handleLogin}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSubmit && styles.disabledButton,
                pressed && styles.pressed,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Login'}</Text>
              )}
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={isSignUp ? showLogin : showSignUp}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.secondaryButtonText}>
                {isSignUp ? 'Back to sign in' : 'Sign up'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f5f7fb',
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  centeredScreen: {
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 28,
    justifyContent: 'center',
    padding: 24,
  },
  contentWide: {
    flexDirection: 'row',
    gap: 56,
  },
  identity: {
    maxWidth: 520,
    width: '100%',
  },
  identityWide: {
    flex: 1,
  },
  brand: {
    color: '#1d4ed8',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 18,
  },
  title: {
    color: '#111827',
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 48,
  },
  subtitle: {
    color: '#536171',
    fontSize: 17,
    lineHeight: 26,
    marginTop: 16,
  },
  formPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dde7',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 420,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    width: '100%',
  },
  formTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 22,
  },
  fieldGroup: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  message: {
    color: '#b42318',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  divider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginVertical: 18,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#eef6ff',
    borderColor: '#bfdbfe',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
