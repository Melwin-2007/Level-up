import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export interface MetricCardProps {
  title: string;
  displayValue: string;
  formula: string;
  inputs: Record<string, unknown>;
  percentage?: number; // 0 to 100 for gauge visualization
  accessibilityLabel?: string;
  subtitle?: string;
}

export function MetricCard({
  title,
  displayValue,
  formula,
  inputs,
  percentage,
  accessibilityLabel,
  subtitle,
}: MetricCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedPercentage =
    percentage !== undefined ? Math.max(0, Math.min(100, percentage)) : undefined;

  const accessibleText =
    accessibilityLabel || `${title}: ${displayValue}${subtitle ? ` (${subtitle})` : ''}`;

  return (
    <View style={styles.card} accessible accessibilityLabel={accessibleText}>
      <Pressable
        style={styles.headerRow}
        onPress={() => setIsExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`Toggle calculation for ${title}`}
      >
        <View style={styles.headerTextContainer}>
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color="ash" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.valueRow}>
          <Text variant="title" style={styles.displayValue}>
            {displayValue}
          </Text>
          <View style={styles.chevronWrapper}>
            {isExpanded ? (
              <ChevronUp size={20} color={colors.ash} />
            ) : (
              <ChevronDown size={20} color={colors.ash} />
            )}
          </View>
        </View>
      </Pressable>

      {/* Visual token-only gauge chart */}
      {normalizedPercentage !== undefined ? (
        <View style={styles.gaugeContainer}>
          <Svg
            width="100%"
            height={8}
            viewBox="0 0 100 8"
            accessibilityLabel={`${title} progress gauge: ${normalizedPercentage}%`}
          >
            <Rect x="0" y="0" width="100" height="8" rx="2" fill={colors.wash} />
            <Rect
              x="0"
              y="0"
              width={normalizedPercentage}
              height="8"
              rx="2"
              fill={normalizedPercentage >= 80 ? colors.flare : colors.signal}
            />
          </Svg>
          <Text variant="micro" color="ash" style={styles.gaugeText}>
            {Math.round(normalizedPercentage)}% complete
          </Text>
        </View>
      ) : null}

      {/* Expandable Calculation Breakdown */}
      {isExpanded ? (
        <View style={styles.detailsContainer}>
          <View style={styles.formulaSection}>
            <Text variant="micro" color="ash" style={styles.sectionLabel}>
              Formula
            </Text>
            <Text variant="small" style={styles.formulaText}>
              {formula}
            </Text>
          </View>

          <View style={styles.inputsSection}>
            <Text variant="micro" color="ash" style={styles.sectionLabel}>
              Calculation inputs
            </Text>
            {Object.entries(inputs).map(([key, val]) => (
              <View key={key} style={styles.inputRow}>
                <Text variant="small" color="ash" style={styles.inputKey}>
                  {key}
                </Text>
                <Text variant="small" style={styles.inputValue}>
                  {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.void,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.input,
    padding: spacing.unit * 4,
    marginBottom: spacing.unit * 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: spacing.unit * 2,
  },
  title: {
    color: colors.ink,
  },
  subtitle: {
    marginTop: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
  },
  displayValue: {
    color: colors.flare,
    fontVariant: ['tabular-nums'],
  },
  chevronWrapper: {
    padding: 2,
  },
  gaugeContainer: {
    marginTop: spacing.unit * 2,
    marginBottom: spacing.unit,
  },
  gaugeText: {
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  detailsContainer: {
    marginTop: spacing.unit * 4,
    paddingTop: spacing.unit * 4,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  formulaSection: {
    marginBottom: spacing.unit * 2,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  formulaText: {
    color: colors.ink,
    fontFamily: 'PublicSans_500Medium',
  },
  inputsSection: {
    marginTop: spacing.unit,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  inputKey: {
    fontVariant: ['tabular-nums'],
  },
  inputValue: {
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
