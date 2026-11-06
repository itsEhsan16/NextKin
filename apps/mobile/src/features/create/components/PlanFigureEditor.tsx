import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { figureLine, type FigureDraft } from '@/data/models';
import { statesResult } from '@/data/models/customize';
import { useDraftFigure } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

export type PlanFigureEditorProps = {
  resumeId: string;
  bullet: { roleId: string; index: number; text: string };
  saved: string | undefined;
  /** The draft the plan row already fetched; without one the editor asks for it. */
  draft?: FigureDraft | null;
  onSave: (text: string | null) => void;
  onDone: () => void;
};

/**
 * "Add a result", in its bottom sheet (owner, 2026-11-07: a tick on the plan, then a sheet with the
 * AI's suggestion). The AI rewrites the bullet around a gap. The person picks the AI's guessed
 * figure (labelled a guess) or types the real one. The line is previewed live and counts once it
 * states a measured result. "Write the line myself" edits the whole line instead.
 */
export function PlanFigureEditor({
  resumeId,
  bullet,
  saved,
  draft: given,
  onSave,
  onDone,
}: PlanFigureEditorProps) {
  const { colors, sizes, u } = useTheme();
  const styles = useStyles();
  const draftFigure = useDraftFigure();
  const [fetched, setFetched] = useState<FigureDraft | null>(null);
  const [own, setOwn] = useState<string | null>(saved ?? null);
  const [figure, setFigure] = useState('');
  const draft = given ?? fetched;

  const { mutate, isIdle } = draftFigure;
  useEffect(() => {
    if (own !== null || given || !isIdle) return;
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setFetched, onError: () => setOwn(bullet.text) },
    );
  }, [own, given, isIdle, mutate, resumeId, bullet]);

  const line = own ?? (draft && figure.trim() ? figureLine(draft, figure) : '');
  const counts = line !== '' && statesResult(line) && line.trim() !== bullet.text.trim();
  const suggestion = draft?.suggestion;

  return (
    <View style={styles.wrap}>
      {own !== null ? (
        <TextField
          label="Your line, with its real result"
          value={own}
          onChangeText={setOwn}
          multiline
          minLines={3}
          maxLines={6}
          maxLength={300}
          autoFocus
          {...(draftFigure.isError
            ? { helper: 'The AI couldn’t draft this line, so write it as you like.' }
            : {})}
        />
      ) : !draft ? (
        <View accessibilityLiveRegion="polite" style={styles.loading}>
          <Text variant="callout" color="textSecondary">
            Fitting a result into this line…
          </Text>
          <Skeleton height={u(18)} />
          <Skeleton width="66%" height={u(18)} />
        </View>
      ) : (
        <>
          {/* The line as it will read, the gap filled live. */}
          <View
            accessible
            accessibilityLabel={`Preview: ${figure.trim() ? figureLine(draft, figure) : `${draft.before} … ${draft.after}`}`}
            style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]}
          >
            <Text variant="callout" color="ink">
              {draft.before}{' '}
              <Text variant="bodyLgStrong" color="brand">
                {figure.trim() || `[${draft.hint}]`}
              </Text>
              {draft.after}
            </Text>
          </View>

          {suggestion ? (
            <View style={styles.suggest}>
              <Text variant="footnote" color="textSecondary">
                AI suggests
              </Text>
              <Pressable
                feedback="subtle"
                accessibilityRole="button"
                accessibilityLabel={`Use the AI's guess: ${suggestion}`}
                onPress={() => setFigure(suggestion)}
                style={[
                  styles.guess,
                  {
                    backgroundColor: colors.brandSurface,
                    borderColor: colors.brand,
                    borderWidth: sizes.border,
                  },
                ]}
              >
                <Icon name="Stars02" size={u(14)} color={colors.brand} />
                <Text variant="bodyLgStrong" color="brand">
                  {suggestion}
                </Text>
              </Pressable>
              <View style={styles.warn}>
                <Icon name="AlertCircle" size={u(14)} color={colors.warningStrong} />
                <Text variant="footnote" color="warningStrong" style={styles.flex}>
                  A guess. Use it only if it’s close to true.
                </Text>
              </View>
            </View>
          ) : null}

          <TextField
            label="Your figure"
            value={figure}
            onChangeText={setFigure}
            placeholder={draft.hint}
            maxLength={40}
            accessibilityLabel={`The result: ${draft.hint}`}
          />
        </>
      )}

      <Text
        variant="footnote"
        color={counts ? 'success' : 'textSecondary'}
        accessibilityLiveRegion="polite"
      >
        {counts ? 'Counts as a measured result' : 'A real number only: a count, %, time or money.'}
      </Text>

      <View style={styles.actions}>
        <Button
          label="Add to bullet"
          size="xl"
          block
          disabled={!counts}
          onPress={() => {
            onSave(line.trim());
            onDone();
          }}
        />
        {own === null ? (
          <Button
            label="Write the line myself"
            variant="ghost"
            block
            onPress={() => setOwn(bullet.text)}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(16) },
  flex: { flex: 1 },
  loading: { gap: u(10) },
  preview: { padding: u(16), borderRadius: u(16) },
  suggest: { gap: u(8) },
  guess: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: u(6),
    paddingHorizontal: u(14),
    paddingVertical: u(9),
    borderRadius: u(999),
    borderStyle: 'dashed',
  },
  warn: { flexDirection: 'row', alignItems: 'flex-start', gap: u(6) },
  actions: { gap: u(4) },
}));
