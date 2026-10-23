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
 * Figma 239:227 / 239:531 / 239:503 / 239:549 on the redrawn Home board (239:219).
 *
 * The illustrations are the exported Figma vectors and `w`/`h` are their intrinsic boxes, so
 * scaling them with `s()` keeps the artwork at the designed proportions. That board is drawn at
 * 390 and `s()` projects from 520, so each drawn box is divided by the 0.75 between them before
 * it is written here — the same conversion `HeroBlock`'s 130 tile makes.
 */
const SPECS: readonly Spec[] = [
  {
    key: 'build-resume',
    label: 'Build Resume',
    hint: 'For a specific job',
    render: (props) => <BuildResumeIcon {...props} />,
    // 45.8564 x 48.75 drawn. The only one of the four the redraw merely recoloured, so it keeps
    // the box it has had since the first board.
    w: 61.1419,
    h: 65,
  },
  {
    key: 'zero-resume',
    label: 'Zero Resume',
    hint: 'Build from scratch',
    render: (props) => <ZeroResumeIcon {...props} />,
    // 41 x 41.4563 drawn.
    w: 54.6667,
    h: 55.2751,
  },
  {
    key: 'cover-letter',
    label: 'Cover Letter',
    hint: 'Tailored to JD',
    render: (props) => <CoverLetterIcon {...props} />,
    // 41 x 42.8996 drawn — the metaphor changed with it, a document to an open envelope.
    w: 54.6667,
    h: 57.1995,
  },
  {
    key: 'ats-check',
    label: 'ATS Check',
    hint: 'Check your score',
    render: (props) => <AtsCheckIcon {...props} />,
    // 41 x 48.5277 drawn — the tallest of the three redrawn, and now nearly the row's height.
    w: 54.6667,
    h: 64.7036,
  },
];

/** Build Resume is still the tallest at 65, so the row it sets is unchanged by the redraw. */
const ICON_ROW_HEIGHT = 65;

/** 55.5 drawn to the label's top, less the 65 icon row above it. */
const LABEL_GAP = 9;

export function QuickStartCard({ onAction }: QuickStartCardProps) {
  const { spacing, s } = useTheme();

  const items = useMemo<IconTile<QuickStartAction>[]>(
    () =>
      SPECS.map(({ key, label, hint, render, w, h }) => ({
        key,
        label,
        // The first board printed this under the label; at phone width that line came out 6.8pt,
        // so it was given to screen readers instead — "Build Resume, for a specific job" — and
        // the label got the room. The redraw has since dropped the line from the board too, so
        // this is now the only place the hint exists.
        a11yHint: hint,
        icon: render({ width: s(w), height: s(h) }),
      })),
    [s],
  );

  return (
    <Card style={{ paddingVertical: s(25), paddingHorizontal: s(21), gap: spacing[4] }}>
      <Text accessibilityRole="header" variant="homeSection">
        Quick Start
      </Text>
      <IconTileGrid
        items={items}
        onPress={onAction}
        iconBoxHeight={s(ICON_ROW_HEIGHT)}
        iconAlign="flex-end"
        labelVariant="tileLabel"
        labelGap={s(LABEL_GAP)}
      />
    </Card>
  );
}
