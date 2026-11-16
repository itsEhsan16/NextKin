import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { FIGURE_REASON, figureLine, hasSuggestion, type FigureDraft } from '@/data/models';
import { statesResult } from '@/data/models/customize';
import { useDraftFigure } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Icon } from '@/ui/Icon';
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
 * "Add a result", in its bottom sheet (owner, 2026-11-07). The AI rewrites the bullet around a gap
 * and fills it with its best suggestion: its first result at its smallest amount, or its one
 * typical figure. The sheet opens on a finished line the person can add as it is, or change by
 * picking another result or amount.
 *
 * Nobody has to type (owner, 2026-11-17, toreview §212; the web's `LineResult` is the same flow).
 * A field appears only when asked for: "Another amount", "Change the figure", "Write the line
 * myself". With nothing from the AI, the sheet says why and offers to ask again.
 */
export function PlanFigureEditor({
  resumeId,
  bullet,
  saved,
  draft: given,
  onSave,
  onDone,
}: PlanFigureEditorProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const draftFigure = useDraftFigure();
  const [fetched, setFetched] = useState<FigureDraft | null>(null);
  const [own, setOwn] = useState<string | null>(saved ?? null);
  // `undefined` means "not touched yet", so the AI's first result stands.
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const [typed, setTyped] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  // A draft asked for again here replaces the one the row brought.
  const draft = fetched ?? given;
  const options = draft?.options ?? [];
  const why =
    draft && !hasSuggestion(draft) ? FIGURE_REASON[draft.reason ?? 'rejected'] : undefined;
  const pick = picked === undefined ? (options.length > 0 ? 0 : null) : picked;
  const chosen = pick !== null ? options[pick] : undefined;
  const shape = chosen ?? draft;
  const best = chosen
    ? (chosen.amounts[0] ?? '')
    : options.length > 0
      ? ''
      : (draft?.suggestion ?? '');
  const figure = typed ?? best;
  const fromAi = typed === null && figure !== '';

  const { mutate, isIdle, isPending } = draftFigure;
  const ask = () =>
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setFetched, onError: () => setOwn(bullet.text) },
    );
  useEffect(() => {
    if (own !== null || given || !isIdle) return;
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setFetched, onError: () => setOwn(bullet.text) },
    );
  }, [own, given, isIdle, mutate, resumeId, bullet]);

  const line = own ?? (shape && figure.trim() ? figureLine(shape, figure) : '');
  const counts = line !== '' && statesResult(line) && line.trim() !== bullet.text.trim();
  const choose = (index: number) => {
    // Another result brings its own best amount; tapping the picked one clears it.
    setPicked(index === pick ? null : index);
    setTyped(index === pick ? '' : null);
    setTyping(false);
  };
  const unmeasured = own !== null && /\d/.test(own) && own.trim() !== bullet.text.trim();

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
      ) : why ? (
        <>
          <View style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]}>
            <Text variant="callout" color="ink">
              {bullet.text}
            </Text>
          </View>
          <Text variant="callout" color="textSecondary" accessibilityLiveRegion="polite">
            {why.note}
          </Text>
          {why.retry ? (
            <Button
              label={isPending ? 'Asking the AI…' : 'Ask the AI again'}
              size="xl"
              block
              disabled={isPending}
              onPress={ask}
            />
          ) : null}
        </>
      ) : (
        <>
          {/* The line as it will read, the gap filled live. */}
          <View
            accessible
            accessibilityLabel={`Preview: ${figure.trim() ? figureLine(shape!, figure) : `${shape!.before} … ${shape!.after}`}`}
            style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]}
          >
            <Text variant="callout" color="ink">
              {shape!.before}{' '}
              <Text variant="bodyLgStrong" color="brand">
                {figure.trim() || `[${chosen ? chosen.what.toLowerCase() : draft.hint}]`}
              </Text>
              {shape!.after}
            </Text>
          </View>
          {fromAi ? (
            <View style={styles.note}>
              <Icon name="Stars02" size={u(14)} color={colors.brand} />
              <Text variant="footnote" color="brand" style={styles.flex}>
                The AI’s suggestion. Keep it only if it’s true, or change it.
              </Text>
            </View>
          ) : null}

          {options.length > 0 ? (
            <>
              <View style={styles.group} accessibilityRole="radiogroup">
                <Text variant="bodyLgStrong" color="ink">
                  What came of it?
                </Text>
                <View style={styles.chips}>
                  {options.map((option, index) => (
                    <ChoiceChip
                      key={option.what}
                      radio
                      label={option.what}
                      selected={pick === index}
                      onPress={() => choose(index)}
                    />
                  ))}
                </View>
              </View>
              {chosen ? (
                <View style={styles.group} accessibilityRole="radiogroup">
                  <Text variant="bodyLgStrong" color="ink">
                    About how much?
                  </Text>
                  <View style={styles.chips}>
                    {chosen.amounts.map((amount) => (
                      <ChoiceChip
                        key={amount}
                        radio
                        label={amount}
                        selected={!typing && figure === amount}
                        onPress={() => {
                          setTyping(false);
                          setTyped(figure === amount ? '' : amount);
                        }}
                      />
                    ))}
                    <ChoiceChip
                      radio
                      label="Another amount"
                      selected={typing}
                      onPress={() => {
                        setTyping(!typing);
                        setTyped('');
                      }}
                    />
                  </View>
                  {typing ? (
                    <TextField
                      label="The amount"
                      value={figure}
                      onChangeText={setTyped}
                      placeholder={chosen.amounts[0] ?? ''}
                      maxLength={40}
                      autoFocus
                      accessibilityLabel={`The amount: ${chosen.what}`}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : typing ? (
            <TextField
              label="Your figure"
              value={figure}
              onChangeText={setTyped}
              placeholder={draft.suggestion ?? draft.hint}
              maxLength={40}
              autoFocus
              accessibilityLabel={`The result: ${draft.hint}`}
            />
          ) : (
            <Button
              label="Change the figure"
              variant="ghost"
              onPress={() => {
                setTyping(true);
                setTyped(figure);
              }}
            />
          )}
        </>
      )}

      <Text
        variant="footnote"
        color={counts ? 'success' : 'textSecondary'}
        accessibilityLiveRegion="polite"
      >
        {counts
          ? 'Counts as a measured result'
          : unmeasured
            ? 'That number doesn’t say what it measures yet. Add a unit or what it counts: 10%, 100 users, 2 hours.'
            : 'A real number only: a count, %, time or money.'}
      </Text>

      <View style={styles.actions}>
        {!why || own !== null ? (
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
        ) : null}
        {own === null ? (
          <Button
            label="Write the line myself"
            variant="ghost"
            block
            onPress={() => setOwn(line || bullet.text)}
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
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: u(6) },
  group: { gap: u(10) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  actions: { gap: u(4) },
}));
