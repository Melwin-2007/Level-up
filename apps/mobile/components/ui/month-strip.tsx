import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from './text';

export interface Marker {
  day: number;
  label: string;
}

export interface MonthStripProps {
  year: number;
  month: number; // 1-12
  today?: number; // day of month 1-31
  markers?: Marker[];
  fills?: Record<number, number>; // day -> 0..1
  style?: ViewStyle;
}

export interface MonthStripLayout {
  cellWidth: number;
  gap: number;
  requiresScroll: boolean;
  totalWidth: number;
}

export function computeMonthStripLayout(
  daysInMonth: number,
  containerWidth: number,
  minCellWidth = 8,
  gap = 2
): MonthStripLayout {
  const totalGaps = Math.max(0, daysInMonth - 1) * gap;
  const availableForCells = containerWidth - totalGaps;
  const calculatedWidth = Math.floor(availableForCells / daysInMonth);

  if (calculatedWidth < minCellWidth) {
    const totalWidth = daysInMonth * minCellWidth + totalGaps;
    return {
      cellWidth: minCellWidth,
      gap,
      requiresScroll: true,
      totalWidth,
    };
  }

  const totalWidth = daysInMonth * calculatedWidth + totalGaps;
  return {
    cellWidth: calculatedWidth,
    gap,
    requiresScroll: false,
    totalWidth,
  };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getFillColor(ratio: number): string {
  if (ratio >= 1.0) {
    return colors.flare;
  }
  if (ratio >= 0.5) {
    return colors.signal;
  }
  return colors.oxblood;
}

export const MonthStrip: React.FC<MonthStripProps> = ({
  year,
  month,
  today,
  markers = [],
  fills = {},
  style,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const daysInMonth = getDaysInMonth(year, month);
  const containerWidth = windowWidth - spacing.screenPadding * 2;
  const layout = computeMonthStripLayout(daysInMonth, containerWidth);

  const markerMap = new Map<number, string>();
  for (const m of markers) {
    markerMap.set(m.day, m.label);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const content = (
    <View
      style={[styles.stripContainer, { width: layout.requiresScroll ? layout.totalWidth : '100%' }]}
    >
      <View style={[styles.cellsRow, { gap: layout.gap }]}>
        {days.map((day) => {
          const ratio = Math.max(0, Math.min(1, fills[day] ?? 0));
          const isToday = day === today;
          const markerLabel = markerMap.get(day);

          return (
            <View key={day} style={[styles.dayColumn, { width: layout.cellWidth }]}>
              {/* Gauge Cell */}
              <View
                style={[styles.cell, { width: layout.cellWidth }, isToday && styles.todayCell]}
                accessibilityLabel={`Day ${day}${isToday ? ', today' : ''}${ratio > 0 ? `, ${Math.round(ratio * 100)}% done` : ''}`}
              >
                {ratio > 0 && (
                  <View
                    style={[
                      styles.fill,
                      {
                        height: `${Math.round(ratio * 100)}%`,
                        backgroundColor: getFillColor(ratio),
                      },
                    ]}
                  />
                )}
              </View>

              {/* Marker Notch / Label */}
              <View style={styles.markerContainer}>
                {markerLabel ? (
                  <>
                    <View style={styles.notch} />
                    <Text variant="micro" color="ash" style={styles.markerLabel}>
                      {markerLabel}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  if (layout.requiresScroll) {
    return (
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={style}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={style}>{content}</View>;
};

const styles = StyleSheet.create({
  stripContainer: {
    paddingVertical: spacing.unit * 2,
  },
  cellsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
  },
  cell: {
    height: 48,
    backgroundColor: colors.wash,
    borderRadius: radius.cell,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.rule,
  },
  todayCell: {
    borderColor: colors.flare,
    borderWidth: 2,
  },
  fill: {
    width: '100%',
  },
  markerContainer: {
    height: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  notch: {
    width: 2,
    height: 4,
    backgroundColor: colors.flare,
    marginBottom: 2,
  },
  markerLabel: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
  },
});
