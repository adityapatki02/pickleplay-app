import React from 'react';
import { Text, TextProps, TextStyle, StyleSheet } from 'react-native';
import { YColors, YFonts } from '../../config/yoiden';

type Common = Omit<TextProps, 'style'> & { style?: TextStyle | TextStyle[] | undefined };

// Big condensed italic display type (Anton)
export const YDisplay: React.FC<Common & { size?: number; color?: string; italic?: boolean }> = ({
  size = 28,
  color = YColors.ink,
  italic = true,
  style,
  children,
  ...rest
}) => (
  <Text
    {...rest}
    style={[
      {
        fontFamily: YFonts.display,
        fontSize: size,
        color,
        fontStyle: italic ? 'italic' : 'normal',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        // Anton has tall caps; a line height under ~1.1x clips the glyph tops
        // on iOS. Keep it generous enough to never clip, still compact.
        lineHeight: size * 1.18,
      },
      style as any,
    ]}
  >
    {children}
  </Text>
);

// Small uppercase label (Archivo ExtraBold)
export const YEyebrow: React.FC<Common & { size?: number; color?: string }> = ({
  size = 11,
  color = YColors.ink2,
  style,
  children,
  ...rest
}) => (
  <Text
    {...rest}
    style={[
      {
        fontFamily: YFonts.uiExtrabold,
        fontSize: size,
        color,
        letterSpacing: size * 0.14,
        textTransform: 'uppercase',
      },
      style as any,
    ]}
  >
    {children}
  </Text>
);

// JetBrains Mono tabular numbers
export const YMono: React.FC<Common & { size?: number; color?: string; bold?: boolean }> = ({
  size = 12,
  color = YColors.ink,
  bold = false,
  style,
  children,
  ...rest
}) => (
  <Text
    {...rest}
    style={[
      {
        fontFamily: bold ? YFonts.monoBold : YFonts.mono,
        fontSize: size,
        color,
      },
      style as any,
    ]}
  >
    {children}
  </Text>
);

// Body text (Archivo)
export const YUiText: React.FC<Common & { size?: number; color?: string; weight?: 400 | 500 | 600 | 700 | 800 | 900 }> = ({
  size = 14,
  color = YColors.ink,
  weight = 400,
  style,
  children,
  ...rest
}) => {
  const family =
    weight >= 900 ? YFonts.uiBlack :
    weight >= 800 ? YFonts.uiExtrabold :
    weight >= 700 ? YFonts.uiBold :
    weight >= 600 ? YFonts.uiSemibold :
    weight >= 500 ? YFonts.uiMedium :
    YFonts.ui;
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: family, fontSize: size, color },
        style as any,
      ]}
    >
      {children}
    </Text>
  );
};
