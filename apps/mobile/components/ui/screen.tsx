import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';

export interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  refreshControl,
  style,
  contentContainerStyle,
}) => {
  return (
    <SafeAreaView style={[styles.container, style]} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.void,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.void,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.void,
  },
});
