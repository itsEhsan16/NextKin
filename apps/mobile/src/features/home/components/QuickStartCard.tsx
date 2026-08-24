import { useMemo } from 'react';
import type { SvgProps } from 'react-native-svg';

import AtsCheckIcon from '../../../../assets/icons/quick-start/ats-check.svg';
import BuildResumeIcon from '../../../../assets/icons/quick-start/build-resume.svg';
import CoverLetterIcon from '../../../../assets/icons/quick-start/cover-letter.svg';
import ZeroResumeIcon from '../../../../assets/icons/quick-start/zero-resume.svg';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { IconTileGrid, type IconTile } from '@/ui/IconTileGrid';
import { Text } from '@/ui/Text';

export type QuickStartAction = 'build-resume' | 'zero-resume' | 'cover-letter' | 'ats-check';

export type QuickStartCardProps = {
  onAction: (action: QuickStartAction) => void;
};

type Spec = {
  key: QuickStartAction;
  label: string;
  hint: string;
  render: (props: SvgProps) => React.ReactElement;
  w: number;
  h: number;
};

/**
 * Figma 1:38. Illustrations are the exported Figma vectors; `w`/`h` are their intrinsic boxes,
 * so scaling them with `s()` keeps the artwork at the designed proportions.
 */
const SPECS: readonly Spec[] = [
  {
    key: 'build-resume',
    label: 'Build Resume',
    hint: 'For a specific job',
    render: (props) => <BuildResumeIcon {...props} />,
    w: 61,
    h: 65,
  },
  {
    key: 'zero-resume',
    label: 'Zero Resume',
    hint: 'Build from scratch',
    render: (props) => <ZeroResumeIcon {...props} />,
    w: 55,
    h: 56,
  },
  {
    key: 'cover-letter',
    label: 'Cover Letter',
    hint: 'Tailored to JD',
    render: (props) => <CoverLetterIcon {...props} />,
    w: 55,
    h: 60,
  },
  {
    key: 'ats-check',
    label: 'ATS Check',
    hint: 'Check your score',
    render: (props) => <AtsCheckIcon {...props} />,
    w: 47,
    h: 60,
  },
];

const ICON_ROW_HEIGHT = 65;

export function QuickStartCard({ onAction }: QuickStartCardProps) {
  const { spacing, s } = useTheme();

  const items = useMemo<IconTile<QuickStartAction>[]>(
    () =>
      SPECS.map(({ key, label, hint, render, w, h }) => ({
        key,
        label,
        sublabel: hint,
        icon: render({ width: s(w), height: s(h) }),
      })),
    [s],
  );

  return (
    <Card style={{ paddingVertical: s(25), paddingHorizontal: s(21), gap: spacing[4] }}>
      <Text accessibilityRole="header" variant="section">
        Quick Start
      </Text>
      <IconTileGrid
        items={items}
        onPress={onAction}
        iconBoxHeight={s(ICON_ROW_HEIGHT)}
        iconAlign="flex-end"
        labelVariant="captionSemiBold"
        sublabelVariant="micro"
        labelGap={7}
      />
    </Card>
  );
}
