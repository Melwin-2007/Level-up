import '../global.css';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  ArchivoNarrow_600SemiBold,
  ArchivoNarrow_700Bold,
} from '@expo-google-fonts/archivo-narrow';
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
} from '@expo-google-fonts/public-sans';
import { colors } from '@/theme/tokens';
import { useSessionStore } from '@/stores/session';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.void,
    card: colors.void,
    text: colors.ink,
    border: colors.rule,
    primary: colors.signal,
  },
};

function NavigationRouter(): React.ReactNode {
  const segments = useSegments();
  const router = useRouter();
  const { session, hasProfile, isLoading, isInitialized, initialize } = useSessionStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (isLoading || !isInitialized) {
      return;
    }

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const isOnboarding = firstSegment === 'onboarding';
    const isKit = firstSegment === 'kit';

    if (isKit) {
      return;
    }

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/sign-in');
      }
    } else if (!hasProfile) {
      if (!isOnboarding) {
        router.replace('/onboarding');
      }
    } else if (
      inAuthGroup ||
      isOnboarding ||
      !firstSegment ||
      (firstSegment as string) === 'index'
    ) {
      router.replace('/(tabs)');
    }
  }, [session, hasProfile, isLoading, isInitialized, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.void },
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="cycles" />
      <Stack.Screen name="kit" />
    </Stack>
  );
}

export default function RootLayout(): React.ReactNode {
  const [fontsLoaded, fontError] = useFonts({
    ArchivoNarrow_600SemiBold,
    ArchivoNarrow_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
  });

  const isSessionLoading = useSessionStore((s) => s.isLoading);
  const isSessionInitialized = useSessionStore((s) => s.isInitialized);

  const isReady = (fontsLoaded || fontError) && !isSessionLoading && isSessionInitialized;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={customDarkTheme}>
        <StatusBar style="light" />
        <NavigationRouter />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
