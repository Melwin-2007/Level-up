import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Title, Text, Field, Input, Button, ErrorBar } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/services/supabase';

export default function SignInScreen(): React.ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('network')) {
          setError('Could not reach the server. Check your connection and try again.');
        } else if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid email or password. Check your details and try again.');
        } else {
          setError(authError.message);
        }
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
        <Title>Monthly</Title>
        <Text variant="small" color="ash" style={styles.subtitle}>
          Sign in to your account
        </Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ErrorBar message={error} onDismiss={() => setError(null)} />
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
            autoComplete="password"
          />
        </Field>

        <View style={styles.actions}>
          <Button label="Sign in" variant="primary" loading={loading} onPress={handleSignIn} />
        </View>

        <View style={styles.switchRow}>
          <Button
            label="Need an account? Sign up"
            variant="quiet"
            onPress={() => router.push('/(auth)/sign-up')}
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
