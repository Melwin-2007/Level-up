import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from './text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
}

export const Sheet: React.FC<SheetProps> = ({ visible, onClose, children, title, style }) => {
  const shouldReduceMotion = useReducedMotion();
  const translateY = useSharedValue(400);

  useEffect(() => {
    if (visible) {
      if (shouldReduceMotion) {
        translateY.value = 0;
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    } else {
      translateY.value = 400;
    }
  }, [visible, shouldReduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
        <Animated.View style={[styles.sheet, animatedStyle, style]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          {title ? (
            <Text variant="heading" color="ink" style={styles.sheetTitle}>
              {title}
            </Text>
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.void,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: spacing.screenPadding,
    maxHeight: '88%',
    minHeight: 200,
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.unit * 2,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.rule,
  },
  sheetTitle: {
    marginBottom: spacing.unit * 2,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: spacing.unit * 6,
  },
});
