import { useMemo } from 'react';
import type { SvgProps } from 'react-native-svg';

import HistoryIcon from '../../../../assets/icons/shortcuts/history.svg';
import InterviewPrepIcon from '../../../../assets/icons/shortcuts/interview-prep.svg';
import MyResumesIcon from '../../../../assets/icons/shortcuts/my-resumes.svg';
import SavedJobsIcon from '../../../../assets/icons/shortcuts/saved-jobs.svg';
import type { DashboardStats } from '@/data/models';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { IconTileGrid, type IconTile } from '@/ui/IconTileGrid';

export type Shortcut = 'my-resumes' | 'history' | 'saved-jobs' | 'interview-prep';

export type ShortcutGridProps = {
  stats: DashboardStats | undefined;
  onShortcut: (shortcut: Shortcut) => void;
};

type Spec = {
  key: Shortcut;
  label: string;
  render: (props: SvgProps) => React.ReactElement;
  w: number;
  h: number;
};

/**
 * Figma 414:1288 — four shortcuts, each with a count line under its label.
 *
 * `w`/`h` are each glyph's intrinsic box. The board is drawn at 390 and `s()` projects from 520,
 * so every drawn box is divided by the 0.75 between them before it is written here — the same
 * conversion the old Home hero tile made.
 */
const SPECS: readonly Spec[] = [
  // 44 x 44.8684 drawn.
  {
    key: 'my-resumes',
    label: 'My Resumes',
    render: (p) => <MyResumesIcon {...p} />,
    w: 58.6667,
    h: 59.8245,
  },
  // 44 x 44.6335 drawn.
  {
    key: 'history',
    label: 'History',
    render: (p) => <HistoryIcon {...p} />,
    w: 58.6667,
    h: 59.5114,
  },
  // 28 x 39.695 drawn — the one upright glyph, so the only one that is not near-square.
  {
    key: 'saved-jobs',
    label: 'Saved Jobs',
    render: (p) => <SavedJobsIcon {...p} />,
    w: 37.3333,
    h: 52.9267,
  },
  // 47 x 47.1313 drawn. The redraw scaled this one glyph up by 6.8% and left the other three
  // alone, so it is now the tallest in the row and overhangs the icon slot by 1.9 — as drawn,
  // where the board hangs it 1.758 above the tile's top edge.
  {
    key: 'interview-prep',
    label: 'Interview Prep',
    render: (p) => <InterviewPrepIcon {...p} />,
    w: 62.6667,
    h: 62.8417,
  },
];

/** The board's icon slot (45.2 drawn) and the 4.8 between it and the label. */
const ICON_ROW = 60.2667;
const LABEL_GAP = 6.4;

/**
 * What each tile counts, spoken.
 *
 * The board draws this under the label and the app does not show it at all — a tile is its icon
 * and its name. The number is still worth having where it costs no space, so it is read after the
 * label rather than dropped; see toreview.md.
 */
function spokenValue(key: Shortcut, stats: DashboardStats | undefined): string | undefined {
  if (!stats) return undefined;
  // No zeroed statistics on a new account (V2 §7.2; owner, toreview §148.1): a count shows once it's
  // above zero, and the tile is still the way in.
  const counted = (count: number, text: string) => (count > 0 ? text : undefined);
  switch (key) {
    case 'my-resumes':
      return counted(stats.resumesCount, pluralize(stats.resumesCount, 'Resume'));
    case 'history':
      return counted(
        stats.activitiesCount,
        pluralize(stats.activitiesCount, 'Activity', 'Activities'),
      );
    case 'saved-jobs':
      return counted(stats.savedJobsCount, `${stats.savedJobsCount} Saved`);
    case 'interview-prep':
      return undefined;
  }
}

/** The one shortcut with nothing to count says what it is for instead. */
function hint(key: Shortcut): string | undefined {
  return key === 'interview-prep' ? 'AI Questions' : undefined;
}

export function ShortcutGrid({ stats, onShortcut }: ShortcutGridProps) {
  const { s } = useTheme();

  const items = useMemo<IconTile<Shortcut>[]>(
    () =>
      SPECS.map(({ key, label, render, w, h }) => ({
        key,
        label,
        a11yValue: spokenValue(key, stats),
        a11yHint: hint(key),
        icon: render({ width: s(w), height: s(h) }),
      })),
    [s, stats],
  );

  return (
    <Card style={{ paddingTop: s(28), paddingBottom: s(20), paddingHorizontal: s(20) }}>
      <IconTileGrid
        items={items}
        onPress={onShortcut}
        iconBoxHeight={s(ICON_ROW)}
        labelGap={s(LABEL_GAP)}
      />
    </Card>
  );
}
