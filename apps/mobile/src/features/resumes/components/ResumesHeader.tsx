import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { SearchField } from '@/ui/SearchField';
import { TabTitleRow } from '@/ui/TabTitleRow';

import type { ResumesViewMode } from '../resumesStore';
import { ViewModeToggle } from './ViewModeToggle';

type ResumesHeaderBaseProps = {
  hasUnread: boolean;
  onPressNotifications: () => void;
};

/**
 * A union rather than an optional-props bag, so first run cannot be handed a `query` it will
 * never render — the same shape `ScreenProps` uses to make its own dead combination
 * unrepresentable.
 */
export type ResumesHeaderProps = ResumesHeaderBaseProps &
  (
    | {
        /** First run (RESUMES 05) keeps only the title row — no search, toggle, pills or meter. */
        firstRun: true;
      }
    | {
        firstRun?: false;
        query: string;
        onChangeQuery: (value: string) => void;
        viewMode: ResumesViewMode;
        onChangeViewMode: (mode: ResumesViewMode) => void;
      }
  );

/**
 * The pinned half of the Resumes chrome — title + bell, then search + layout toggle
 * (Figma 1:1367–1:1375).
 *
 * Everything below the search row keeps scrolling and lives in `ResumesFilterBar`. The split
 * runs exactly where it does because that is where the pin stops: the type pills, the sort
 * control and the usage meter all scroll away.
 *
 * No `style` prop by design — the padding around this belongs to `Screen`'s `headerStyle` box,
 * which is the one place that knows whether it is being pinned.
 */
export function ResumesHeader(props: ResumesHeaderProps) {
  const { spacing, sizes } = useTheme();
  const { hasUnread, onPressNotifications } = props;

  const titleRow = (
    <TabTitleRow
      title="Resumes"
      hasUnread={hasUnread}
      onPressNotifications={onPressNotifications}
    />
  );

  if (props.firstRun) return titleRow;

  return (
    <View style={{ gap: sizes.titleRowGap }}>
      {titleRow}

      <View style={[styles.searchRow, { gap: spacing[3] }]}>
        <SearchField
          value={props.query}
          onChangeText={props.onChangeQuery}
          placeholder="Search resumes and letters"
          accessibilityLabel="Search resumes and letters"
          style={styles.search}
        />
        <ViewModeToggle value={props.viewMode} onChange={props.onChangeViewMode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1 },
});
