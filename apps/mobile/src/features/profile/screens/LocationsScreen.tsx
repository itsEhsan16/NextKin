import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CITY_SUGGESTIONS, REMOTE_PREFERENCE_LABEL, type RemotePreference } from '@/data/models';
import { useProfile, useUpdatePreferences } from '@/data/queries';
import { columnWidth, useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';

import { countOf, listsEqual } from '../chipEdits';
import { ChipListEditor } from '../components/ChipListEditor';
import { SectionCard } from '../components/cards';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART } from '../profileRowArt';

const LEDE =
  'The cities you would work in — “Remote” and “Anywhere in India” count as answers too.';

/** The page's closing note, which is also the promise §7.3 makes about these fields. */
const PRIVATE_NOTE = 'Only used for matching — never shown on your resume.';

/** The chooser's chip gap at 390 (580:1807). */
const CHOOSER_GAP = 7 / 0.75;

/** Listed rather than derived, so the row reads in the order the options escalate. */
const REMOTE_ORDER: readonly RemotePreference[] = ['remote', 'hybrid', 'onsite', 'any'];

/**
 * Single-choice, so the row is a radiogroup and the chips carry the picked state. `FilterChip`'s
 * `select` variant is the one drawn for exactly this — outlined when unpicked, ink-filled when
 * picked, with no check glyph to suggest more than one can be on at a time. The board sets the
 * four in equal columns (580:1807).
 */
function RemoteChooser({
  value,
  onChange,
}: {
  value: RemotePreference;
  onChange: (next: RemotePreference) => void;
}) {
  const { contentWidth, spacing, s } = useTheme();
  // The card's own padding comes off the content width before the four columns are cut.
  const cell = columnWidth(contentWidth - 2 * spacing[5], s(CHOOSER_GAP), REMOTE_ORDER.length);

  return (
    <SectionCard title="Remote preference">
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Remote preference"
        style={[styles.row, { gap: s(CHOOSER_GAP) }]}
      >
        {REMOTE_ORDER.map((key) => (
          <FilterChip
            key={key}
            label={REMOTE_PREFERENCE_LABEL[key]}
            variant="select"
            selected={value === key}
            accessibilityLabel={`${REMOTE_PREFERENCE_LABEL[key]}, remote preference`}
            hint="Sets how you want to work"
            onPress={() => onChange(key)}
            style={[styles.cell, { width: cell }]}
          />
        ))}
      </View>
    </SectionCard>
  );
}

/**
 * Where you will work (V2 §7.3, PROFILE 16 580:1733) — the city list and the remote preference, which the Profile tab
 * reads back as one row. They are one answer, so one Save writes both fields in a single patch:
 * saving the cities and leaving the preference behind would leave the row half true.
 */
export function LocationsScreen() {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpdatePreferences();
  const [cities, setCities] = useState<string[] | null>(null);
  const [remote, setRemote] = useState<RemotePreference | null>(null);

  // Compared against the profile as it stands now — see the note on SkillsScreen.
  const saved = profile.data?.preferences;
  const items = cities ?? saved?.locations ?? [];
  const choice = remote ?? saved?.remote ?? 'any';
  const dirty =
    saved != null &&
    ((cities != null && !listsEqual(cities, saved.locations)) ||
      (remote != null && remote !== saved.remote));

  return (
    <ChipListEditor
      title="Locations & remote"
      summary={{
        art: PROFILE_ROW_ART.locations,
        artWidth: 56,
        title: `${countOf(items.length, 'location')} on your profile`,
        lede: LEDE,
      }}
      listTitle="Cities"
      noun="location"
      items={items}
      suggestions={CITY_SUGGESTIONS}
      suggestionsIn="list"
      placeholder="Type a city"
      addLabel="Add a location"
      onChange={setCities}
      below={<RemoteChooser value={choice} onChange={setRemote} />}
      note={PRIVATE_NOTE}
      loading={profile.isPending}
      error={profile.isError}
      onRetry={() => void profile.refetch()}
      dirty={dirty}
      saving={save.isPending}
      failed={save.isError}
      onSave={() =>
        save.mutate(
          { locations: [...items], remote: choice },
          { onSuccess: () => actions.backWith('Locations saved') },
        )
      }
      onClose={actions.goBack}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  // A chip hugs its label; a fixed-width cell has to centre it instead.
  cell: { justifyContent: 'center' },
});
