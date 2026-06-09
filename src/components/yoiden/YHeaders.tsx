import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { YColors } from '../../config/yoiden';
import { YDisplay, YEyebrow, YUiText } from './YText';

// ── Top bar (eyebrow + big italic title + right action) ─────────
type YTopBarProps = {
  title: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
  onBack?: () => void;
  style?: ViewStyle;
};
export const YTopBar: React.FC<YTopBarProps> = ({
  title,
  eyebrow,
  action,
  onBack,
  style,
}) => (
  <View
    style={[
      {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 22,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      },
      style,
    ]}
  >
    <View style={{ flex: 1, minWidth: 0 }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: YColors.line2,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M14 6l-6 6 6 6"
              stroke={YColors.ink}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
      ) : null}
      {eyebrow ? <YEyebrow style={{ marginBottom: 10 }}>{eyebrow}</YEyebrow> : null}
      {typeof title === 'string' ? (
        <YDisplay size={34}>{title}</YDisplay>
      ) : (
        title
      )}
    </View>
    {action}
  </View>
);

// ── Section header — calmer than hero ────────────────────────────
// Eyebrow + smaller upright UI title (not italic Anton). Lets hero typography breathe.
type YSectionHeadProps = {
  eyebrow?: string;
  title?: React.ReactNode;
  action?: string;
  onActionPress?: () => void;
};
export const YSectionHead: React.FC<YSectionHeadProps> = ({
  eyebrow,
  title,
  action,
  onActionPress,
}) => (
  <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 10 }}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <YEyebrow style={{ marginBottom: 6 }} color={YColors.ink3}>
            {eyebrow}
          </YEyebrow>
        ) : null}
        {title ? (
          typeof title === 'string' ? (
            <YUiText
              size={17}
              weight={900}
              color={YColors.ink}
              style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}
            >
              {title}
            </YUiText>
          ) : (
            title
          )
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onActionPress} hitSlop={6}>
          <YUiText
            size={11}
            weight={800}
            color={YColors.ink2}
            style={{ letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {action}
          </YUiText>
        </Pressable>
      ) : null}
    </View>
  </View>
);
