export const colors = {
  void: '#000000',
  oxblood: '#830000',
  signal: '#BC0202',
  flare: '#FF0000',
  ink: '#F2F2F2',
  ash: '#A8A8A8',
  rule: 'rgba(255, 255, 255, 0.16)',
  wash: 'rgba(255, 255, 255, 0.05)',
} as const;

export type ColorToken = keyof typeof colors;

export const typography = {
  families: {
    display: 'ArchivoNarrow_600SemiBold',
    displayBold: 'ArchivoNarrow_700Bold',
    text: 'PublicSans_400Regular',
    textMedium: 'PublicSans_500Medium',
    textSemiBold: 'PublicSans_600SemiBold',
  },
  scale: {
    displayXl: {
      fontSize: 64,
      lineHeight: 60,
      fontFamily: 'ArchivoNarrow_700Bold',
      letterSpacing: -0.5,
    },
    display: {
      fontSize: 40,
      lineHeight: 42,
      fontFamily: 'ArchivoNarrow_700Bold',
      letterSpacing: -0.5,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontFamily: 'ArchivoNarrow_600SemiBold',
      letterSpacing: -0.5,
    },
    heading: {
      fontSize: 20,
      lineHeight: 26,
      fontFamily: 'PublicSans_600SemiBold',
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: 'PublicSans_400Regular',
    },
    small: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'PublicSans_400Regular',
    },
    micro: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'PublicSans_400Regular',
    },
  },
} as const;

export type TextVariant = keyof typeof typography.scale;

export const spacing = {
  unit: 4,
  screenPadding: 20,
  rowMinHeight: 56,
  touchTargetMin: 48,
  buttonHeight: 52,
} as const;

export const radius = {
  cell: 2,
  input: 4,
  button: 4,
  sheet: 16,
  avatar: 9999,
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radius,
} as const;
