import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../button';

describe('Button Component', () => {
  it('should render label in sentence case and trigger onPress', () => {
    const handlePress = jest.fn();
    const { getByText } = render(<Button label="Submit goals" onPress={handlePress} />);

    const button = getByText('Submit goals');
    expect(button).toBeTruthy();

    fireEvent.press(button);
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('should not trigger onPress when disabled', () => {
    const handlePress = jest.fn();
    const { getByText } = render(
      <Button label="Save draft" onPress={handlePress} disabled={true} />
    );

    fireEvent.press(getByText('Save draft'));
    expect(handlePress).not.toHaveBeenCalled();
  });

  it('should render loading indicator and not trigger onPress when loading', () => {
    const handlePress = jest.fn();
    const { queryByText, getByRole } = render(
      <Button label="Lock goals" onPress={handlePress} loading={true} />
    );

    // Label should be replaced by loading indicator
    expect(queryByText('Lock goals')).toBeNull();

    const button = getByRole('button');
    fireEvent.press(button);
    expect(handlePress).not.toHaveBeenCalled();
  });

  it('should set accessibility state and label correctly', () => {
    const { getByRole } = render(
      <Button label="Join group" onPress={() => {}} accessibilityLabel="Custom join label" />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Custom join label');
  });
});
