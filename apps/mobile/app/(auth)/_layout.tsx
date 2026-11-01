import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function AuthLayout(): React.ReactNode {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.void },
        animation: 'none',
      }}
    />
  );
}
