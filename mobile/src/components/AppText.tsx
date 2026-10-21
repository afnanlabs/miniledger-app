import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography } from '../constants/theme';

export type TextVariant = keyof typeof typography;

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

/** Typography wrapper so screens never hard-code font sizes. */
export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant] as TextStyle, { color: color ?? colors.ink }, style]}
    />
  );
}
