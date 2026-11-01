import React from 'react';
import { type TextStyle, type TextProps as RNTextProps } from 'react-native';
import { Text } from './text';

export interface TitleProps extends RNTextProps {
  children: string;
  style?: TextStyle;
}

export const Title: React.FC<TitleProps> = ({ children, style, ...props }) => {
  return (
    <Text variant="title" color="ink" style={style} {...props}>
      {children}
    </Text>
  );
};
