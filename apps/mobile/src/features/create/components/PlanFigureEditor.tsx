import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { figureLine, type FigureDraft } from '@/data/models';
import { statesResult } from '@/data/models/customize';
import { useDraftFigure } from '@/data/queries';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

export type PlanFigureEditorProps = {
  resumeId: string;
  bullet: { roleId: string; index: number; text: string };
  saved: string | undefined;
  onSave: (text: string | null) => void;
  onDone: () => void;
};

/**
 * "Add the result" (owner, toreview §129.6): the AI rewrites the bullet around a gap and the person
 * types only the real figure into it. The AI never writes the figure, and the line counts once it
 * states a measured result. "Write it myself" edits the whole line. Mounted while it is open, so a
 * draft is only asked for when someone wants one.
 */
export function PlanFigureEditor({
  resumeId,
  bullet,
  saved,
  onSave,
  onDone,
}: PlanFigureEditorProps) {
  const { spacing, s } = useTheme();
  const draftFigure = useDraftFigure();
  const [draft, setDraft] = useState<FigureDraft | null>(null);
  const [own, setOwn] = useState<string | null>(saved ?? null);
  const [figure, setFigure] = useState('');

  const { mutate, isIdle } = draftFigure;
  useEffect(() => {
    if (own !== null || !isIdle) return;
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setDraft, onError: () => setOwn(bullet.text) },
    );
  }, [own, isIdle, mutate, resumeId, bullet]);

  const line = own ?? (draft && figure.trim() ? figureLine(draft, figure) : '');
  const counts = line !== '' && statesResult(line) && line.trim() !== bullet.text.trim();

  return (
    <View style={{ gap: spacing[3] }}>
      {own !== null ? (
        <TextField
          label="Rewrite this line with its real result"
          value={own}
          onChangeText={setOwn}
          multiline
          minLines={2}
          maxLength={300}
          autoFocus
          {...(draftFigure.isError
            ? { helper: 'The AI couldn’t draft this line, so write it as you like.' }
            : {})}
        />
      ) : !draft ? (
        <View accessibilityLiveRegion="polite" style={{ gap: spacing[2] }}>
          <Text variant="captionSemiBold">The AI is fitting a result into this line…</Text>
          <Skeleton height={s(20)} />
          <Skeleton width="66%" height={s(20)} />
        </View>
      ) : (
        <View style={{ gap: spacing[2] }}>
          <Text variant="captionSemiBold">Fill in the real result</Text>
          <Text variant="micro" color="textBody">
            {draft.before}
          </Text>
          <TextField
            value={figure}
            onChangeText={setFigure}
            placeholder={draft.hint}
            maxLength={40}
            autoFocus
            accessibilityLabel={`The result: ${draft.hint}`}
          />
          {draft.after ? (
            <Text variant="micro" color="textBody">
              {draft.after}
            </Text>
          ) : null}
        </View>
      )}

      <Text
        variant="micro"
        color={counts ? 'success' : 'textSecondary'}
        accessibilityLiveRegion="polite"
      >
        {counts
          ? 'Counts as a measured result'
          : 'A real number only: a count, %, time or money.'}
      </Text>

      <View style={{ gap: spacing[2] }}>
        <Button
          label="Use this line"
          disabled={!counts}
          block
          onPress={() => {
            onSave(line.trim());
            onDone();
          }}
        />
        {saved !== undefined ? (
          <Button
            label="Keep the original"
            variant="ghost"
            block
            onPress={() => {
              onSave(null);
              onDone();
            }}
          />
        ) : null}
        {own === null ? (
          <Button
            label="Write it myself"
            variant="ghost"
            block
            onPress={() => setOwn(bullet.text)}
          />
        ) : null}
      </View>
    </View>
  );
}
