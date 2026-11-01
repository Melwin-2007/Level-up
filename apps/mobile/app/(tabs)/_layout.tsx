import React from 'react';
import { Tabs } from 'expo-router';
import { Calendar, Clock, User, Users } from 'lucide-react-native';
import { colors, typography } from '@/theme/tokens';

export default function TabsLayout(): React.ReactNode {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.void,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.flare,
        tabBarInactiveTintColor: colors.ash,
        tabBarLabelStyle: {
          fontFamily: typography.families.textMedium,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="month"
        options={{
          title: 'Month',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: 'Group',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 22} />,
        }}
      />
    </Tabs>
  );
}
