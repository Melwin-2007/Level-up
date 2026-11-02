import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Title, Text, Field, Input, Button, ErrorBar } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import { supabase } from '@/services/supabase';

export default function SignUpScreen(): React.ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('network')) {
          setError('Could not reach the server. Check your connection and try again.');
        } else {
          setError(authError.message);
        }
      } else if (data.user && !data.session) {
        setNotice('Check your email to confirm your account, then sign in.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Title>Create account</Title>
        <Text variant="small" color="ash" style={styles.subtitle}>
          Set up your Monthly access
        </Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {notice ? (
        <View style={styles.noticeContainer}>
          <Text variant="body" color="ink">
            {notice}
          </Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
        </Field>

        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
          />
        </Field>

        <View style={styles.actions}>
          <Button
            label="Create account"
            variant="primary"
            loading={loading}
            onPress={handleSignUp}
          />
        </View>

        <View style={styles.switchRow}>
          <Button
            label="Already have an account? Sign in"
            variant="quiet"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.unit * 12,
    paddingBottom: spacing.unit * 8,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.unit * 8,
  },
  subtitle: {
    marginTop: spacing.unit * 2,
  },
  errorContainer: {
    marginBottom: spacing.unit * 6,
  },
  noticeContainer: {
    marginBottom: spacing.unit * 6,
    padding: spacing.unit * 4,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 4,
  },
  form: {
    gap: spacing.unit * 5,
  },
  actions: {
    marginTop: spacing.unit * 4,
  },
  switchRow: {
    alignItems: 'center',
    marginTop: spacing.unit * 4,
  },
});
