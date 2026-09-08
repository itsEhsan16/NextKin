import { View, type StyleProp, type ViewStyle } from 'react-native';

import Mark1 from '../../../assets/brand/mark-1.svg';
import Mark2 from '../../../assets/brand/mark-2.svg';
import Mark3 from '../../../assets/brand/mark-3.svg';
import { useTheme } from '@/theme';

/** Figma 1:23 — three layered vectors inside a 51×53 box. */
export const BRAND_MARK_BOX = { width: 51, height: 53 } as const;

const LAYERS = [
  { Icon: Mark1, x: 0, y: 0, width: 37, height: 35 },
  { Icon: Mark2, x: 22, y: 21, width: 29, height: 32 },
  { Icon: Mark3, x: 23, y: 21, width: 28, height: 19 },
] as const;

export type BrandMarkProps = {
  /** Box height in artboard px; width follows the mark's ratio. Defaults to the drawn 53. */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The NextKin mark on its own, without the wordmark.
 *
 * It lives here rather than beside `BrandBlock` because the onboarding flow needs it too, and a
 * primitive may not reach into a feature. `scripts/generate-icons.cjs` composes the same three
 * layers at the same offsets into the launcher icons, so a change to the mark reaches both.
 */
export function BrandMark({ height = BRAND_MARK_BOX.height, style }: BrandMarkProps) {
  const { s } = useTheme();
  const factor = height / BRAND_MARK_BOX.height;
  const width = BRAND_MARK_BOX.width * factor;

  return (
    // Decorative: every caller pairs it with the wordmark or its own header label.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: s(width), height: s(height) }, style]}
    >
      {LAYERS.map(({ Icon, x, y, width: w, height: h }, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: s(x * factor),
            top: s(y * factor),
            width: s(w * factor),
            height: s(h * factor),
          }}
        >
          <Icon width={s(w * factor)} height={s(h * factor)} />
        </View>
      ))}
    </View>
  );
}
