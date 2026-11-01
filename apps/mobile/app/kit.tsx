import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  ErrorBar,
  Field,
  Input,
  MonthStrip,
  PriorityMarks,
  Row,
  Screen,
  Sheet,
  StatusSquare,
  Text,
  Title,
} from '@/components/ui';
import { spacing } from '@/theme/tokens';

export default function KitScreen(): React.ReactNode {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Title>Design system kit</Title>
        <Text variant="small" color="ash" style={styles.intro}>
          Preview of all design system components and states. Max font scale 130% enforced.
        </Text>
      </View>

      <Divider />

      {/* Typography Scale */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Typography scale
        </Text>
        <Text variant="displayXl">Display XL (64/60)</Text>
        <Text variant="display">Display (40/42)</Text>
        <Text variant="title">Title (26/30)</Text>
        <Text variant="heading">Heading (20/26)</Text>
        <Text variant="body">Body (16/24) — standard body copy under 60 characters.</Text>
        <Text variant="small">Small (14/20) — secondary descriptions and labels.</Text>
        <Text variant="micro">Micro (12/16) — timestamps and markers.</Text>
        <Text variant="body" tabularNums={true}>
          Tabular numbers: 1,234.50 vs 8,888.00
        </Text>
      </View>

      <Divider />

      {/* Buttons */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Buttons
        </Text>
        <View style={styles.gap}>
          <Button label="Primary button" variant="primary" onPress={() => {}} />
          <Button label="Primary loading" variant="primary" loading={true} onPress={() => {}} />
          <Button label="Primary disabled" variant="primary" disabled={true} onPress={() => {}} />
          <Button label="Secondary button" variant="secondary" onPress={() => {}} />
          <Button
            label="Secondary disabled"
            variant="secondary"
            disabled={true}
            onPress={() => {}}
          />
          <Button label="Quiet button" variant="quiet" onPress={() => {}} />
          <Button label="Quiet disabled" variant="quiet" disabled={true} onPress={() => {}} />
        </View>
      </View>

      <Divider />

      {/* Inputs & Fields */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Inputs and fields
        </Text>
        <Field label="Goal title" hint="Give the goal a title (up to 120 characters).">
          <Input
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="e.g. Finish compiler optimization"
          />
        </Field>
        <Field
          label="Invite code"
          error="That code does not match a group. Check it and try again."
        >
          <Input value="ABCDEF23" hasError={true} />
        </Field>
      </View>

      <Divider />

      {/* Month Strip */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Month strip (November)
        </Text>
        <MonthStrip
          year={2026}
          month={11}
          today={12}
          markers={[
            { day: 5, label: '^sub' },
            { day: 10, label: '^rev' },
          ]}
          fills={{
            1: 0.25, // oxblood (< 0.5)
            2: 0.4, // oxblood
            3: 0.5, // signal (0.5..1.0)
            4: 0.75, // signal
            5: 1.0, // flare (1.0)
            6: 1.0,
            12: 0.6,
          }}
        />
      </View>

      <Divider />

      {/* Priority Marks */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Priority marks (1 to 5)
        </Text>
        {[1, 2, 3, 4, 5].map((p) => (
          <Row key={p}>
            <Text variant="body">{`Priority ${p}`}</Text>
            <PriorityMarks priority={p} />
          </Row>
        ))}
      </View>

      <Divider />

      {/* Status Squares */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Status squares
        </Text>
        <Row>
          <Text variant="body">Done (flare solid)</Text>
          <StatusSquare status="done" />
        </Row>
        <Row>
          <Text variant="body">In progress (signal half)</Text>
          <StatusSquare status="in_progress" />
        </Row>
        <Row>
          <Text variant="body">Pending (rule outline)</Text>
          <StatusSquare status="pending" />
        </Row>
        <Row>
          <Text variant="body">Postponed (ash diagonal)</Text>
          <StatusSquare status="postponed" />
        </Row>
      </View>

      <Divider />

      {/* Error Bar */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Error bar
        </Text>
        <ErrorBar message="Could not reach the server. Check your connection and try again." />
      </View>

      <Divider />

      {/* Avatars */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Avatars
        </Text>
        <View style={styles.avatarRow}>
          <Avatar name="Alice" size={32} />
          <Avatar name="Bob" size={40} />
          <Avatar name="Charlie" size={48} />
        </View>
      </View>

      <Divider />

      {/* Rows & Selection */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Rows & selection
        </Text>
        <Row>
          <Text variant="body">Standard unselected row</Text>
          <Text variant="small" color="ash">
            Detail
          </Text>
        </Row>
        <Row selected={true}>
          <Text variant="body">Selected row (oxblood bar)</Text>
          <Text variant="small" color="ash">
            Active
          </Text>
        </Row>
      </View>

      <Divider />

      {/* Empty State */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Empty state
        </Text>
        <EmptyState
          message="Create a group or join one with an invite code."
          actionLabel="Create group"
          onAction={() => {}}
        />
      </View>

      <Divider />

      {/* Sheet Modal */}
      <View style={styles.section}>
        <Text variant="heading" color="ink" style={styles.sectionTitle}>
          Bottom sheet
        </Text>
        <Button
          label="Open bottom sheet"
          variant="secondary"
          onPress={() => setSheetVisible(true)}
        />
      </View>

      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
        <Title style={styles.sheetTitle}>Bottom sheet</Title>
        <Text variant="body" color="ash" style={styles.sheetBody}>
          Top corners 16px radius, background true black with subtle border. Respects reduced
          motion.
        </Text>
        <Button label="Close sheet" variant="primary" onPress={() => setSheetVisible(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.unit * 12,
  },
  section: {
    marginVertical: spacing.unit * 4,
  },
  intro: {
    marginTop: spacing.unit * 2,
  },
  sectionTitle: {
    marginBottom: spacing.unit * 3,
  },
  gap: {
    gap: spacing.unit * 3,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: spacing.unit * 3,
    alignItems: 'center',
  },
  sheetTitle: {
    marginVertical: spacing.unit * 2,
  },
  sheetBody: {
    marginBottom: spacing.unit * 6,
  },
});
