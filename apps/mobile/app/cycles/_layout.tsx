import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function CyclesLayout(): React.ReactNode {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.void },
        animation: 'none',
      }}
    >
      <Stack.Screen name="[id]/submission" />
      <Stack.Screen name="[id]/review" />
      <Stack.Screen name="[id]/plan" />
    </Stack>
  );
}
