import {
  atsBandFor,
  TAILOR_TARGET_PAGES,
  type DocumentContent,
  type Job,
  type TailorComparison,
  type TailorExperienceDepth,
  type TailorFix,
  type TailorKeyword,
  type ResumeSectionKey,
  type TailorRun,
} from '@nextkin/shared/models';

/** W-TAILOR 02's "Choose what to improve" (734:679): every part, on by default. */
export const FIX_ROWS: { key: TailorFix; label: string; line: (job: Job) => string }[] = [
  { key: 'headline', label: 'Headline', line: (job) => `Aim it at ${job.title}` },
  { key: 'summary', label: 'Summary', line: () => 'Rewrite it for this role' },
  { key: 'skills', label: 'Skills', line: () => 'Put the job’s skills first' },
  {
    key: 'experience',
    label: 'Work experience',
    line: () => 'Lead each role with what this job values',
  },
  { key: 'projects', label: 'Projects', line: () => 'Reword your projects in this job’s terms' },
  // The server's page budget (toreview §111.1): one page under five years, the original's up to two.
  { key: 'length', label: 'Length', line: () => 'Fit it to one page, or two with 5+ years' },
];

export const ALL_FIXES: TailorFix[] = FIX_ROWS.map((row) => row.key);

export const EXPERIENCE_DEPTH_LABEL: Record<TailorExperienceDepth, string> = {
  quick: 'Quick edit — your two most recent roles',
  full: 'Full edit — every role (takes a little longer)',
};

/** Step 1's heading and the line under it (734:2), by how far the resume already goes. */
export function compareHeadline(
  comparison: TailorComparison,
  company: string,
): { title: string; line: string } {
  const missing = comparison.keywords.filter((k) => !k.onResume).length;
  const fixes = comparison.improvements.filter((row) => !row.ok).length;
  const work =
    missing + fixes === 0
      ? 'Nothing needs work — you can still tailor the wording.'
      : [
          missing ? `${missing} ${missing === 1 ? 'keyword' : 'keywords'}` : '',
          fixes ? `${fixes} ${fixes === 1 ? 'section' : 'sections'}` : '',
        ]
          .filter(Boolean)
          .join(' and ') + ` ${missing + fixes === 1 ? 'needs' : 'need'} work.`;
  const band = atsBandFor(comparison.score);
  if (band === 'strong') {
    return {
      title: 'Your resume is a strong match — a few touches left',
      line: `Nearly everything ${company} asks for is on your resume. ${work}`,
    };
  }
  if (band === 'good') {
    return {
      title: 'Your resume is a good start — let’s make it stronger',
      line: `Most of what ${company} asks for is already on your resume. ${work}`,
    };
  }
  return {
    title: 'Your resume has gaps for this job — let’s close them',
    line: `Some of what ${company} asks for isn’t on your resume yet. ${work}`,
  };
}

/** The lines a keyword's "In …" can quote: a listing's requirements and responsibilities. */
export const listingLines = (job: Job): string[] => [...job.requirements, ...job.responsibilities];

const words = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9+#./]+/g, ' ')
    .trim()} `;

/**
 * Where the job asks for a keyword (734:679, "In “Strong Figma and prototyping skills”"): the first
 * line that names it as whole words ("CI/CD" is not in "Computer Science"), else one that starts a
 * word with its stem of five letters or more ("prototyping" for "Prototype"), else the description
 * in general. A JD's lines are its own text; a listing's, its requirements and responsibilities.
 */
export function keywordSource(lines: readonly string[], keyword: TailorKeyword): string {
  const label = words(keyword.label);
  const stem = label.trim().split(' ')[0] ?? '';
  const root = stem.length >= 5 ? ` ${stem.slice(0, Math.max(5, stem.length - 2))}` : null;
  const named = lines.map((l) => l.trim()).filter(Boolean);
  const line =
    named.find((item) => words(item).includes(label)) ??
    (root ? named.find((item) => words(item).includes(root)) : undefined);
  if (!line) return 'In the role description';
  const text = line.replace(/^\s*(?:[-*•▪·●◦]|\d+[.)])\s*/, '');
  return `In “${text.length > 44 ? `${text.slice(0, 42).trimEnd()}…` : text}”`;
}

/** The progress card's lines (734:1356), only the work the user asked for, then the score. */
export function tailoringLines(job: Job, run: TailorRun): string[] {
  const fixes = new Set(run.fixes ?? ALL_FIXES);
  const lines: string[] = [];
  if (fixes.has('headline') || fixes.has('summary')) {
    lines.push(
      fixes.has('headline') && fixes.has('summary')
        ? 'Rewrote your headline and summary for this role'
        : fixes.has('headline')
          ? 'Aimed your headline at this role'
          : 'Rewrote your summary for this role',
    );
  }
  if (run.added.length) {
    lines.push(
      run.added.length === 1
        ? `Added ${run.added[0]} — the skill you ticked`
        : `Added ${run.added.length} skills you ticked`,
    );
  }
  if (fixes.has('experience')) lines.push(`Leading each role with what ${job.company} values`);
  lines.push('Checking the ATS score');
  return lines;
}

export type ChangeLine = { label: string; left: boolean };

const joinAnd = (items: readonly string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** "What changed for this job" (734:2033): what the run did, then what was left out and why. */
export function changeLines(job: Job, run: TailorRun): ChangeLine[] {
  const fixes = new Set(run.fixes ?? ALL_FIXES);
  const out: ChangeLine[] = [];
  if (fixes.has('headline')) out.push({ label: `Headline aimed at ${job.title}`, left: false });
  if (fixes.has('summary')) out.push({ label: 'Summary rewritten for this role', left: false });
  for (const skill of run.added) out.push({ label: `Added ${skill} — you ticked it`, left: false });
  if (fixes.has('skills')) out.push({ label: 'The job’s skills listed first', left: false });
  if (fixes.has('experience')) {
    const values = job.tags.slice(3, 5).map((tag) => tag.toLowerCase());
    out.push({
      label:
        values.length === 2
          ? `Each role now leads with ${values[0]} and ${values[1]}`
          : 'Each role now leads with what this job values',
      left: false,
    });
  }
  if (fixes.has('length') && run.sourcePages != null && run.sourcePages > TAILOR_TARGET_PAGES) {
    out.push({
      label: `Trimmed from ${run.sourcePages} pages to ${TAILOR_TARGET_PAGES}`,
      left: false,
    });
  }
  if (run.skipped.length) {
    const lower = run.skipped.map((skill, index) => (index ? skill.toLowerCase() : skill));
    out.push({
      label: `${joinAnd(lower)} left out — you didn’t tick ${run.skipped.length === 1 ? 'it' : 'them'}`,
      left: true,
    });
  }
  return out;
}

/** "George_Smith_Google.pdf": the file a download is saved as. */
export const resumeFileName = (first: string, last: string, company: string) =>
  `${[first, last, company].map((part) => part.replace(/\s+/g, '')).join('_')}.pdf`;

/**
 * The section an "AI rewrite" request is about, from its words (toreview §113, §121), or `null`
 * when the words don't say. It used to fall back to Experience, so "make the dates consistent"
 * rewrote a section nobody named (audit TL-42); now the assistant asks.
 */
export function sectionOf(text: string): ResumeSectionKey | null {
  if (/\bsummary|profile|intro/i.test(text)) return 'summary';
  if (/\bskills?\b/i.test(text)) return 'skills';
  if (/\bprojects?\b/i.test(text)) return 'projects';
  if (/\bexperience|roles?\b|jobs?\b|bullets?\b|work\b/i.test(text)) return 'experience';
  return null;
}

/** The sections the assistant offers when a request doesn't name one. */
export const REWRITE_SECTIONS: readonly ResumeSectionKey[] = [
  'summary',
  'skills',
  'experience',
  'projects',
];

/** A section as plain lines, for the before/after of an AI rewrite. */
export function sectionLines(
  content: DocumentContent | undefined,
  section: ResumeSectionKey,
): string[] {
  if (!content || content.kind !== 'resume') return [];
  switch (section) {
    case 'summary':
      return content.summary ? [content.summary] : [];
    case 'skills':
      return content.skills.length ? [content.skills.join(', ')] : [];
    case 'experience':
      return content.experience.flatMap((role) => [
        `${role.title}, ${role.company}`,
        ...role.bullets.map((b) => `• ${b}`),
      ]);
    case 'projects':
      return content.projects.flatMap((project) => [
        project.name,
        ...project.bullets.map((b) => `• ${b}`),
      ]);
    case 'certifications':
      return content.certifications;
    case 'education':
      return content.education.map((entry) => `${entry.degree}, ${entry.institution}`);
  }
}
