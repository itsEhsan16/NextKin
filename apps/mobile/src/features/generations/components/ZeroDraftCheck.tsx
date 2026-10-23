import { View } from 'react-native';

import { zeroCheckRows, zeroProgress, type ResumeContent } from '@/data/models';
import { FlowHero } from '@/features/create/components/FlowHero';
import { scaledSheet } from '@/theme';

import { ZeroCheckList } from './ZeroCheckList';
import { ZeroDraftPreview } from './ZeroDraftPreview';

// ZERO 03 at 390 (613:362), in artboard units.
const PAGE_TO_HERO = 18 / 0.75; // 613:413
const HERO_TO_LIST = 16 / 0.75; // 613:419

/** "Check 9 things" — the count the draft asked for, so it does not shrink as answers land. */
export const zeroCheckTitle = (total: number) =>
  `Your draft is ready. Check ${total} ${total === 1 ? 'thing' : 'things'}`;

/**
 * ZERO 03 (613:362) under the stepper: the draft with its guesses marked, what to do about them,
 * and how many are done. ZERO 04's sheet rises over this page, which keeps redrawing behind it.
 */
export function ZeroDraftCheck({ content, name }: { content: ResumeContent; name: string }) {
  const styles = useStyles();
  const { checked, total } = zeroProgress(content);

  return (
    <View>
      <ZeroDraftPreview content={content} name={name} />
      <View style={styles.hero}>
        <FlowHero
          title={zeroCheckTitle(total)}
          lede="We marked every guess. Download unlocks once each one is checked."
        />
      </View>
      <View style={styles.list}>
        <ZeroCheckList checked={checked} total={total} rows={zeroCheckRows(content)} />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { marginTop: s(PAGE_TO_HERO) },
  list: { marginTop: s(HERO_TO_LIST) },
}));
