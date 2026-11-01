import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme/tokens';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Sheet: React.FC<SheetProps> = ({ visible, onClose, children, style }) => {
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
          {children}
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
    paddingBottom: spacing.unit * 8,
    minHeight: 240,
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
});
