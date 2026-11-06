import { useState } from 'react';
import { View } from 'react-native';

import {
  isBlank,
  parseZeroPeriod,
  type ContentEducation,
  type ContentRole,
  type ZeroDate,
  type ZeroResolution,
} from '@/data/models';
import { scaledSheet } from '@/theme';
import { TextField, useFieldChain } from '@/ui/TextField';

import {
  CheckButtons,
  CheckHeader,
  DatePicker,
  DateRow,
  datesError,
  type DatePane,
  type ZeroEnd,
} from './ZeroCheckParts';

// ZERO 04's fields at 390 (613:580 → 613:600), in artboard units.
const HEADER_TO_FIELDS = 14 / 0.75; // 613:580 + 613:581
const FIELD_GAP = 12 / 0.75; // 613:590

const GUESS = 'Our guess — change it if it’s wrong';

export type CheckFormProps = {
  /** "1 of 9 · Roles and dates". */
  subtitle: string;
  busy: boolean;
  /** The repo's refusal, said under the fields. */
  error?: string;
  onResolve: (resolution: ZeroResolution) => void;
  /** The sheet's ✕; absent when the form sits inline on the review screen (§173). */
  onClose?: () => void;
};

/** The guessed span, or this year to now when the text cannot be read back. */
function spanOf(period: string): { start: ZeroDate; end: ZeroEnd } {
  return parseZeroPeriod(period) ?? { start: { year: new Date().getFullYear() }, end: 'present' };
}

/** The From/To state and the month picker that stands in for the form while one is picked. */
function useDates(period: string) {
  const [span, setSpan] = useState(() => spanOf(period));
  const [pane, setPane] = useState<DatePane>(null);
  const pick = (which: 'from' | 'to', value: ZeroEnd) => {
    setSpan((current) =>
      which === 'from' && value !== 'present'
        ? { ...current, start: value }
        : { ...current, end: value },
    );
    setPane(null);
  };
  return { ...span, pane, setPane, pick };
}

/**
 * ZERO 04 (613:572), "Is this role right?": the guessed title, the blank company — which must be
 * filled, so its error shows from the start, as drawn — and the guessed dates. Save confirms what
 * is on screen; Delete drops the role, which resolves it as surely (V2 §7.9).
 */
export function RoleCheckForm({ role, ...props }: CheckFormProps & { role: ContentRole }) {
  const styles = useStyles();
  const link = useFieldChain(2);
  const [title, setTitle] = useState(role.title);
  const [company, setCompany] = useState(isBlank(role.company) ? '' : role.company);
  const [tried, setTried] = useState(false);
  const dates = useDates(role.period);

  if (dates.pane) {
    return (
      <DatePicker
        pane={dates.pane}
        start={dates.start}
        end={dates.end}
        stillLabel="I still work here"
        onPick={dates.pick}
        onClose={() => dates.setPane(null)}
      />
    );
  }

  const titleError = tried && isBlank(title) ? 'Add the job title you had.' : undefined;
  const companyError = isBlank(company) ? 'Add the real company — a blank can’t stay' : undefined;
  const rangeError = datesError(dates.start, dates.end);

  const save = () => {
    setTried(true);
    if (isBlank(title) || companyError || rangeError) return;
    props.onResolve({
      kind: 'role',
      roleId: role.id,
      title,
      company,
      start: dates.start,
      end: dates.end,
    });
  };

  return (
    <View>
      <CheckHeader title="Is this role right?" subtitle={props.subtitle} onClose={props.onClose} />
      <View style={styles.fields}>
        <TextField
          {...link(0)}
          label="Job title"
          icon="Briefcase01"
          value={title}
          onChangeText={setTitle}
          helper={GUESS}
          error={titleError}
          autoCapitalize="words"
        />
        <TextField
          {...link(1)}
          label="Company"
          icon="Building02"
          value={company}
          onChangeText={setCompany}
          placeholder="[Company Name]"
          error={companyError}
          autoCapitalize="words"
        />
        <DateRow
          start={dates.start}
          end={dates.end}
          presentLabel="Present"
          error={rangeError ?? props.error}
          onPick={dates.setPane}
        />
      </View>
      <CheckButtons
        deleteLabel="Delete this role"
        busy={props.busy}
        onSave={save}
        onDelete={() => props.onResolve({ kind: 'role', roleId: role.id, remove: true })}
      />
    </View>
  );
}

/**
 * A guessed skill (spec-derived from ZERO 04's layout; V2 §7.9 flags each skill claim): keep it
 * as written, rename it to what you really know, or delete it.
 */
export function SkillCheckForm({ skill, ...props }: CheckFormProps & { skill: string }) {
  const styles = useStyles();
  const [name, setName] = useState(skill);
  const [tried, setTried] = useState(false);
  const nameError = tried && isBlank(name) ? 'Add the skill, or delete it.' : undefined;

  return (
    <View>
      <CheckHeader
        title="Do you have this skill?"
        subtitle={props.subtitle}
        onClose={props.onClose}
      />
      <View style={styles.fields}>
        <TextField
          label="Skill"
          icon="Tool02"
          value={name}
          onChangeText={setName}
          helper={GUESS}
          error={nameError ?? props.error}
        />
      </View>
      <CheckButtons
        deleteLabel="Delete this skill"
        busy={props.busy}
        onSave={() => {
          setTried(true);
          if (!isBlank(name)) props.onResolve({ kind: 'skill', skill, name });
        }}
        onDelete={() => props.onResolve({ kind: 'skill', skill, remove: true })}
      />
    </View>
  );
}

/**
 * The education blank (spec-derived from ZERO 04): the degree and the school are both blanks that
 * cannot stay, and the years are a guess counted back from the first role.
 */
export function EducationCheckForm({
  entry,
  ...props
}: CheckFormProps & { entry: ContentEducation }) {
  const styles = useStyles();
  const link = useFieldChain(2);
  const [degree, setDegree] = useState(isBlank(entry.degree) ? '' : entry.degree);
  const [school, setSchool] = useState(isBlank(entry.institution) ? '' : entry.institution);
  const dates = useDates(entry.period);

  if (dates.pane) {
    return (
      <DatePicker
        pane={dates.pane}
        start={dates.start}
        end={dates.end}
        stillLabel="I’m still studying"
        onPick={dates.pick}
        onClose={() => dates.setPane(null)}
      />
    );
  }

  const degreeError = isBlank(degree) ? 'Add your real degree — a blank can’t stay' : undefined;
  const schoolError = isBlank(school) ? 'Add the real school — a blank can’t stay' : undefined;
  const rangeError = datesError(dates.start, dates.end);

  return (
    <View>
      <CheckHeader title="Where did you study?" subtitle={props.subtitle} onClose={props.onClose} />
      <View style={styles.fields}>
        <TextField
          {...link(0)}
          label="Degree"
          icon="GraduationHat01"
          value={degree}
          onChangeText={setDegree}
          placeholder="[Degree]"
          error={degreeError}
          autoCapitalize="words"
        />
        <TextField
          {...link(1)}
          label="School"
          icon="Building01"
          value={school}
          onChangeText={setSchool}
          placeholder="[Institution]"
          error={schoolError}
          autoCapitalize="words"
        />
        <DateRow
          start={dates.start}
          end={dates.end}
          presentLabel="Present"
          error={rangeError ?? props.error}
          onPick={dates.setPane}
        />
      </View>
      <CheckButtons
        deleteLabel="Delete this entry"
        busy={props.busy}
        onSave={() => {
          if (degreeError || schoolError || rangeError) return;
          props.onResolve({
            kind: 'education',
            entryId: entry.id,
            degree,
            institution: school,
            start: dates.start,
            end: dates.end,
          });
        }}
        onDelete={() => props.onResolve({ kind: 'education', entryId: entry.id, remove: true })}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  fields: { marginTop: s(HEADER_TO_FIELDS), gap: s(FIELD_GAP) },
}));
