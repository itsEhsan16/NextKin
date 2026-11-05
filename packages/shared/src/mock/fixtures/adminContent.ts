import type {
  KbChange,
  KbStats,
  MergeSuggestion,
  ResumeTemplate,
  RubricCriterion,
  RubricOverview,
  Skill,
  TaxonomyCategory,
  Technology,
  UnmappedTerm,
} from '../../models/adminContent';

/**
 * The admin Content boards' records (Figma 406:662–410:1771), as drawn. The boards' sample figures
 * "only show the format". Records a list needs but the board doesn't draw (the review queue's six
 * hidden items, rubric v1/v2's weights) are made up in the same style and listed in
 * `toreview.md` §171. The AI prompts' records are in `adminPrompts.ts`.
 */

/** A fixed calendar day, as the boards date everything (the work is set in Oct–Nov 2026). */
const on = (date: string, time = '12:00') => `${date}T${time}:00.000Z`;

// --- Technology KB ------------------------------------------------------------------------------

const tech = (
  id: string,
  name: string,
  category: string,
  aliases: string[],
  latestVersion: string | null,
  releaseDate: string | null,
  source: Technology['source'],
  dataset: string,
  updatedAt: string,
  updatedBy: string,
  status: Technology['status'],
): Technology => ({
  id,
  name,
  category,
  aliases,
  latestVersion,
  releaseDate: releaseDate ? on(releaseDate) : null,
  source,
  sourceUrl:
    source === 'cited' ? `https://${name.toLowerCase().replace(/[^a-z]/g, '')}.dev/releases` : null,
  dataset,
  updatedAt: on(updatedAt),
  updatedBy,
  status,
});

export const technologiesFixture: Technology[] = [
  tech(
    'tech_nextjs',
    'Next.js',
    'Frontend framework',
    ['next', 'nextjs'],
    '15.1',
    '2024-12-10',
    'cited',
    'v2026.11',
    '2026-11-04',
    'Import',
    'in_review',
  ),
  tech(
    'tech_react',
    'React',
    'UI library',
    ['reactjs', 'react.js'],
    '19.0',
    '2024-12-05',
    'cited',
    'v2026.11',
    '2026-10-30',
    'Marco K.',
    'published',
  ),
  tech(
    'tech_k8s',
    'Kubernetes',
    'Container orchestration',
    ['k8s', 'kube'],
    '1.32',
    '2024-12-11',
    'cited',
    'v2026.11',
    '2026-11-04',
    'Import',
    'in_review',
  ),
  tech(
    'tech_postgres',
    'PostgreSQL',
    'Database',
    ['postgres', 'psql'],
    '17.2',
    '2024-11-21',
    'cited',
    'v2026.11',
    '2026-10-28',
    'Ana L.',
    'published',
  ),
  tech(
    'tech_terraform',
    'Terraform',
    'Infrastructure as code',
    ['tf'],
    '1.10',
    '2024-11-27',
    'missing',
    'v2026.11',
    '2026-10-26',
    'Marco K.',
    'needs_source',
  ),
  tech(
    'tech_python',
    'Python',
    'Programming language',
    ['py', 'python3'],
    '3.13',
    '2024-10-07',
    'cited',
    'v2026.11',
    '2026-10-20',
    'Ana L.',
    'published',
  ),
  tech(
    'tech_swift',
    'Swift',
    'Programming language',
    ['swiftlang'],
    '6.0',
    '2024-09-16',
    'cited',
    'v2026.10',
    '2026-09-30',
    'Marco K.',
    'published',
  ),
  tech(
    'tech_figma',
    'Figma',
    'Design tool',
    [],
    null,
    null,
    'missing',
    'v2026.10',
    '2026-09-22',
    'Marco K.',
    'reported',
  ),
  tech(
    'tech_docker',
    'Docker',
    'Containers',
    ['docker engine'],
    '27.4',
    '2024-12-09',
    'cited',
    'v2026.11',
    '2026-10-18',
    'Ana L.',
    'published',
  ),
  tech(
    'tech_typescript',
    'TypeScript',
    'Programming language',
    ['ts'],
    '5.7',
    '2024-11-22',
    'cited',
    'v2026.11',
    '2026-10-15',
    'Marco K.',
    'published',
  ),
  ...kbPageTwo(),
];

/**
 * Page 2 (invented): the other entries the review queue names, so every queued change has its entry
 * and the Review queue tab lists all 14. Bun is the import's new technology, in review until decided.
 */
function kbPageTwo(): Technology[] {
  // prettier-ignore
  const rows = [
    ['tech_bun', 'Bun', 'JavaScript runtime', ['bunjs'], '1.1', '2024-04-01', 'cited', 'v2026.12', '2026-11-04', 'Import', 'in_review'],
    ['tech_deno', 'Deno', 'JavaScript runtime', ['deno'], '2.0', '2024-10-09', 'cited', 'v2026.11', '2026-10-12', 'Ana L.', 'published'],
    ['tech_vue', 'Vue', 'Frontend framework', ['vuejs', 'vue.js'], '3.4', '2023-12-28', 'cited', 'v2026.11', '2026-10-10', 'Marco K.', 'published'],
    ['tech_rust', 'Rust', 'Programming language', ['rs'], '1.83', '2024-11-28', 'cited', 'v2026.11', '2026-10-08', 'Ana L.', 'published'],
    ['tech_go', 'Go', 'Programming language', ['golang'], '1.23', '2024-08-13', 'cited', 'v2026.11', '2026-10-06', 'Ana L.', 'published'],
    ['tech_svelte', 'Svelte', 'Frontend framework', ['sveltejs'], '4.2', '2023-06-22', 'cited', 'v2026.10', '2026-09-28', 'Marco K.', 'published'],
    ['tech_redis', 'Redis', 'Database', ['redis-server'], '7.4', '2024-07-29', 'cited', 'v2026.11', '2026-10-04', 'Ana L.', 'published'],
    ['tech_kafka', 'Kafka', 'Streaming platform', ['apache kafka'], '3.8', '2024-07-29', 'cited', 'v2026.11', '2026-10-02', 'Ehsan', 'published'],
  ] as const;
  return rows.map(([id, name, category, aliases, version, date, source, dataset, at, by, status]) =>
    tech(id, name, category, [...aliases], version, date, source, dataset, at, by, status),
  );
}

/** The board's figures; the fixture holds the first page of the 1,284 (`toreview.md` §171). */
export const kbStatsFixture: KbStats = {
  technologies: { total: 1284, added30d: 36 },
  review: { total: 14, fromImports: 9, staffEdits: 5 },
  reports: { total: 5, dates: 3, aliases: 2 },
  dataset: { version: 'v2026.11', closedAt: on('2026-11-01'), nextAt: on('2026-12-01') },
  tabs: { all: 1284, review: 14, reports: 5, imports: 3 },
};

const IMPORT = 'Import kb-2026-11-04.csv';

const change = (
  id: string,
  title: string,
  kind: KbChange['kind'],
  origin: KbChange['origin'],
  originLabel: string,
  at: string,
  detail: Partial<KbChange['detail']> & { technology: string },
): KbChange => ({
  id,
  title,
  kind,
  origin,
  originLabel,
  at: on(at),
  detail: {
    heading: detail.heading ?? title.replace(' · ', ' — '),
    technology: detail.technology,
    proposedBy: detail.proposedBy ?? `${originLabel} · ${at}`,
    resumesAffected: detail.resumesAffected ?? 'aggregate count not yet computed',
    targetDataset: 'v2026.12',
    fields: detail.fields ?? [],
    source: detail.source ?? null,
    reports: detail.reports ?? [],
  },
});

export const kbQueueFixture: KbChange[] = [
  change(
    'chg_nextjs',
    'Next.js · release date',
    'date',
    'import',
    `${IMPORT} · row 212`,
    '2026-11-04',
    {
      heading: 'Next.js — release date and latest version',
      technology: 'Next.js · Frontend framework',
      proposedBy: `${IMPORT}, row 212 · Nov 4, 2026`,
      resumesAffected: '3,412 mention Next.js · aggregate count',
      fields: [
        { field: 'Latest version', from: '15.0', to: '15.1' },
        { field: 'Release date', from: 'Oct 21, 2024', to: 'Dec 10, 2024' },
        { field: 'Aliases', unchanged: ['next', 'nextjs'] },
      ],
      source: {
        url: 'nextjs.org/blog/next-15-1',
        cited: true,
        note: 'Official release notes · checked Nov 4',
      },
      reports: [
        {
          id: 'rep_1',
          title: 'Disputed: release date',
          body: 'The listed date is the 15.0 launch. 15.1 shipped in December, so resumes that cite 15.1 are flagged as outdated.',
          at: on('2026-11-02'),
          origin: 'raised from the tailor flow',
        },
        {
          id: 'rep_2',
          title: 'Disputed: latest version',
          body: 'The KB says 15.0 is the latest version, but 15.1 is out. The skills check marked 15.1 as a version that does not exist.',
          at: on('2026-11-03'),
          origin: 'raised from the ATS score',
        },
      ],
    },
  ),
  change(
    'chg_k8s_alias',
    'Kubernetes · new alias “kube”',
    'alias',
    'import',
    `${IMPORT} · row 388`,
    '2026-11-04',
    {
      technology: 'Kubernetes · Container orchestration',
      resumesAffected: '412 mention “kube” · aggregate count',
      fields: [{ field: 'Aliases', from: 'k8s', to: 'k8s, kube' }],
    },
  ),
  change('chg_bun', 'Bun · new technology', 'new', 'import', `${IMPORT} · row 41`, '2026-11-04', {
    technology: 'Bun · JavaScript runtime',
    resumesAffected: '286 mention Bun · aggregate count',
    fields: [
      { field: 'Name', from: null, to: 'Bun' },
      { field: 'Latest version', from: null, to: '1.1' },
      { field: 'Release date', from: null, to: 'Apr 1, 2024' },
    ],
    source: {
      url: 'bun.sh/blog/bun-v1.1',
      cited: true,
      note: 'Official release notes · checked Nov 4',
    },
  }),
  change(
    'chg_terraform',
    'Terraform · release date',
    'report',
    'user_report',
    'User report',
    '2026-11-03',
    {
      technology: 'Terraform · Infrastructure as code',
      proposedBy: 'User report · Nov 3, 2026',
      fields: [{ field: 'Release date', from: 'Nov 27, 2024', to: 'Nov 28, 2024' }],
      reports: [
        {
          id: 'rep_3',
          title: 'Disputed: release date',
          body: 'The 1.10 release went out a day later than listed.',
          at: on('2026-11-03'),
          origin: 'raised from the ATS score',
        },
      ],
    },
  ),
  change(
    'chg_postgres',
    'PostgreSQL · latest version',
    'version',
    'import',
    `${IMPORT} · row 305`,
    '2026-11-04',
    {
      technology: 'PostgreSQL · Database',
      fields: [{ field: 'Latest version', from: '17.1', to: '17.2' }],
      source: {
        url: 'postgresql.org/about/news',
        cited: true,
        note: 'Project news · checked Nov 4',
      },
    },
  ),
  change(
    'chg_swift',
    'Swift · release date',
    'report',
    'user_report',
    'User report',
    '2026-11-02',
    {
      technology: 'Swift · Programming language',
      proposedBy: 'User report · Nov 2, 2026',
      fields: [{ field: 'Release date', from: 'Sep 16, 2024', to: 'Sep 17, 2024' }],
    },
  ),
  change(
    'chg_figma',
    'Figma · category',
    'category',
    'staff_edit',
    'Staff edit · Marco K.',
    '2026-11-01',
    {
      technology: 'Figma · Design tool',
      proposedBy: 'Staff edit · Marco K. · Nov 1, 2026',
      fields: [{ field: 'Category', from: 'Design tool', to: 'Design & prototyping' }],
    },
  ),
  change(
    'chg_deno_alias',
    'Deno · new alias “deno.land”',
    'alias',
    'import',
    `${IMPORT} · row 97`,
    '2026-11-04',
    {
      technology: 'Deno · JavaScript runtime',
      fields: [{ field: 'Aliases', from: 'deno', to: 'deno, deno.land' }],
      reports: [
        {
          id: 'rep_4',
          title: 'Disputed: alias',
          body: 'deno.land is the project’s website, not a name people write for Deno on a resume.',
          at: on('2026-11-04'),
          origin: 'raised from the skills check',
        },
      ],
    },
  ),
  change(
    'chg_vue',
    'Vue · latest version',
    'version',
    'import',
    `${IMPORT} · row 120`,
    '2026-11-04',
    {
      technology: 'Vue · Frontend framework',
      fields: [{ field: 'Latest version', from: '3.4', to: '3.5' }],
      source: { url: 'blog.vuejs.org', cited: true, note: 'Official blog · checked Nov 4' },
    },
  ),
  change(
    'chg_rust_alias',
    'Rust · new alias “rustlang”',
    'alias',
    'import',
    `${IMPORT} · row 150`,
    '2026-11-04',
    {
      technology: 'Rust · Programming language',
      fields: [{ field: 'Aliases', from: 'rs', to: 'rs, rustlang' }],
    },
  ),
  change('chg_go', 'Go · release date', 'date', 'staff_edit', 'Staff edit · Ana L.', '2026-10-31', {
    technology: 'Go · Programming language',
    proposedBy: 'Staff edit · Ana L. · Oct 31, 2026',
    fields: [{ field: 'Release date', from: 'Aug 13, 2024', to: 'Feb 11, 2025' }],
  }),
  change(
    'chg_svelte',
    'Svelte · latest version',
    'version',
    'import',
    `${IMPORT} · row 233`,
    '2026-10-30',
    {
      technology: 'Svelte · Frontend framework',
      fields: [{ field: 'Latest version', from: '4.2', to: '5.0' }],
      source: {
        url: 'svelte.dev/blog/svelte-5-is-alive',
        cited: true,
        note: 'Official blog · checked Oct 30',
      },
    },
  ),
  change(
    'chg_redis',
    'Redis · category',
    'category',
    'import',
    `${IMPORT} · row 271`,
    '2026-10-29',
    {
      technology: 'Redis · Database',
      fields: [{ field: 'Category', from: 'Database', to: 'In-memory data store' }],
    },
  ),
  change(
    'chg_kafka',
    'Kafka · latest version',
    'version',
    'staff_edit',
    'Staff edit · Ehsan',
    '2026-10-28',
    {
      technology: 'Kafka · Streaming platform',
      fields: [{ field: 'Latest version', from: '3.8', to: '3.9' }],
      source: {
        url: 'kafka.apache.org/downloads',
        cited: true,
        note: 'Downloads page · checked Oct 28',
      },
    },
  ),
];

// --- Skills & aliases ---------------------------------------------------------------------------

export const skillCategoriesFixture: TaxonomyCategory[] = [
  { id: 'languages', name: 'Languages', count: 486 },
  { id: 'frameworks', name: 'Frameworks & libraries', count: 1204 },
  { id: 'cloud', name: 'Cloud & DevOps', count: 412 },
  { id: 'data', name: 'Data & AI', count: 638 },
  { id: 'design', name: 'Design', count: 297 },
  { id: 'product', name: 'Product', count: 214 },
  { id: 'soft', name: 'Soft skills', count: 661 },
];

const skill = (
  id: string,
  name: string,
  aliases: string[],
  parent: string,
  usedIn: number,
  editedAt: string,
  editedBy: string,
  categoryId = 'cloud',
): Skill => ({
  id,
  name,
  aliases,
  parent,
  categoryId,
  usedIn,
  editedAt: on(editedAt),
  editedBy,
});

export const skillsFixture: Skill[] = [
  skill(
    'sk_k8s',
    'Kubernetes',
    ['K8s', 'kube', 'k8s.io'],
    'Container orchestration',
    18402,
    '2026-10-28',
    'Marco K.',
  ),
  skill(
    'sk_docker',
    'Docker',
    ['docker-ce', 'Docker Engine'],
    'Containers',
    24915,
    '2026-10-21',
    'Marco K.',
  ),
  skill(
    'sk_tf',
    'Terraform',
    ['TF', 'HashiCorp Terraform'],
    'Infrastructure as code',
    9876,
    '2026-10-17',
    'Ana L.',
  ),
  skill(
    'sk_aws',
    'Amazon Web Services',
    ['AWS', 'Amazon AWS', 'AWS Cloud'],
    'Cloud platforms',
    31207,
    '2026-10-09',
    'Marco K.',
  ),
  skill('sk_gha', 'GitHub Actions', ['GH Actions', 'gha'], 'CI/CD', 7342, '2026-09-30', 'Ana L.'),
  skill(
    'sk_gcp',
    'Google Cloud',
    ['GCP', 'Google Cloud Platform'],
    'Cloud platforms',
    8120,
    '2026-09-24',
    'Marco K.',
  ),
  skill('sk_prom', 'Prometheus', ['prom'], 'Observability', 2764, '2026-09-12', 'Marco K.'),
  skill('sk_ansible', 'Ansible', [], 'Configuration management', 3018, '2026-08-30', 'Ana L.'),
  // The merge suggestions' targets, so merging has a skill to add the alias to. Not drawn on the
  // board (it shows Cloud & DevOps only); made up (`toreview.md` §171).
  skill(
    'sk_react',
    'React',
    ['React.js'],
    'Frontend frameworks',
    21480,
    '2026-10-14',
    'Ana L.',
    'frameworks',
  ),
  skill(
    'sk_vue',
    'Vue',
    ['Vue 3'],
    'Frontend frameworks',
    6214,
    '2026-09-19',
    'Ana L.',
    'frameworks',
  ),
  skill(
    'sk_node',
    'Node.js',
    ['NodeJS'],
    'JavaScript runtimes',
    17903,
    '2026-09-26',
    'Marco K.',
    'frameworks',
  ),
  skill(
    'sk_postgres',
    'PostgreSQL',
    ['psql'],
    'Databases',
    12655,
    '2026-10-02',
    'Marco K.',
    'data',
  ),
  skill(
    'sk_excel',
    'Microsoft Excel',
    ['Excel'],
    'Spreadsheets',
    15327,
    '2026-08-21',
    'Ana L.',
    'data',
  ),
];

export const skillsStatsFixture = {
  skills: 3912,
  added30d: 38,
  aliases: 7480,
  perSkill: 1.9,
  merges: 6,
  unmapped: 41,
};

export const unmappedFixture: UnmappedTerm[] = [
  { term: 'Pulumi', seenIn: 14 },
  { term: 'ArgoCD', seenIn: 9 },
  { term: 'Kustomize', seenIn: 6 },
  { term: 'OpenTofu', seenIn: 5 },
  { term: 'Crossplane', seenIn: 4 },
];

export const mergesFixture: MergeSuggestion[] = [
  { id: 'mg_reactjs', alias: 'ReactJS', target: 'React', seenIn: 213, firstSeen: on('2026-10-12') },
  {
    id: 'mg_postgres',
    alias: 'Postgres',
    target: 'PostgreSQL',
    seenIn: 168,
    firstSeen: on('2026-10-03'),
  },
  { id: 'mg_node', alias: 'Node', target: 'Node.js', seenIn: 141, firstSeen: on('2026-09-28') },
  {
    id: 'mg_msexcel',
    alias: 'MS Excel',
    target: 'Microsoft Excel',
    seenIn: 122,
    firstSeen: on('2026-10-19'),
  },
  // The board draws four of six; these two are made up (`toreview.md` §171).
  { id: 'mg_vuejs', alias: 'Vue.js', target: 'Vue', seenIn: 97, firstSeen: on('2026-10-08') },
  { id: 'mg_k8', alias: 'K8', target: 'Kubernetes', seenIn: 64, firstSeen: on('2026-10-21') },
];

// --- Templates ----------------------------------------------------------------------------------

export const templatesFixture: ResumeTemplate[] = [
  {
    slug: 'jake',
    name: 'Jake',
    layout: 'jake',
    atsSafe: true,
    status: 'published',
    rev: 4,
    inUse: 8214,
    editedAt: on('2026-10-21'),
    editedBy: 'Ana L.',
    archivedAt: null,
  },
  {
    slug: 'modern',
    name: 'Modern',
    layout: 'modern',
    atsSafe: true,
    status: 'published',
    rev: 7,
    inUse: 5630,
    editedAt: on('2026-10-12'),
    editedBy: 'Marco K.',
    archivedAt: null,
  },
  {
    slug: 'elegant',
    name: 'Elegant',
    layout: 'elegant',
    atsSafe: true,
    status: 'published',
    rev: 3,
    inUse: 3118,
    editedAt: on('2026-09-28'),
    editedBy: 'Ana L.',
    archivedAt: null,
  },
  {
    slug: 'compact',
    name: 'Compact',
    layout: 'compact',
    atsSafe: true,
    status: 'published',
    rev: 2,
    inUse: 1942,
    editedAt: on('2026-09-14'),
    editedBy: 'Marco K.',
    archivedAt: null,
  },
  {
    slug: 'executive',
    name: 'Executive',
    layout: 'executive',
    atsSafe: false,
    status: 'draft',
    rev: 1,
    inUse: 0,
    editedAt: on('2026-11-02'),
    editedBy: 'Marco K.',
    archivedAt: null,
  },
  {
    slug: 'classic',
    name: 'Classic',
    layout: 'classic',
    atsSafe: true,
    status: 'archived',
    rev: 5,
    inUse: 412,
    editedAt: on('2026-08-30'),
    editedBy: 'Ehsan',
    archivedAt: on('2026-09-02'),
  },
];

// --- ATS rubric ---------------------------------------------------------------------------------

const criterion = (
  key: string,
  label: string,
  description: string,
  weight: number,
  evidence: string,
): RubricCriterion => ({ key, label, description, weight, evidence });

const RECRUITER = 'Recruiter panel, Oct 2026';
const PARSER = 'Parser test set, 1,200 PDFs';

const criteriaFor = (w: [number, number, number, number, number, number]): RubricCriterion[] => [
  criterion(
    'keyword',
    'Keyword match',
    'Job-description skills and terms found in the resume',
    w[0],
    RECRUITER,
  ),
  criterion(
    'impact',
    'Quantified impact',
    'Bullets that state a measurable result',
    w[1],
    RECRUITER,
  ),
  criterion(
    'format',
    'Parseable formatting',
    'Text extracts cleanly: no tables, images or column traps',
    w[2],
    PARSER,
  ),
  criterion(
    'structure',
    'Section structure',
    'Standard headings in a sensible order',
    w[3],
    PARSER,
  ),
  criterion(
    'timeline',
    'Timeline validity',
    'Dates parse, run in order and gaps are explained',
    w[4],
    'Q3 support tickets',
  ),
  criterion('length', 'Length', 'One to two pages for the experience level', w[5], RECRUITER),
];

export const rubricFixture: RubricOverview = {
  versions: [
    {
      version: 4,
      status: 'draft',
      author: 'Marco K.',
      dateLabel: 'edited Nov 03, 2026',
      activeSince: null,
      criteria: criteriaFor([30, 20, 20, 15, 10, 5]),
    },
    {
      version: 3,
      status: 'active',
      author: 'Ana L.',
      dateLabel: 'published Sep 30, 2026',
      activeSince: 'Sep 30',
      criteria: criteriaFor([35, 15, 20, 15, 5, 10]),
    },
    // v1 and v2's weights aren't drawn; these are made up (`toreview.md` §171).
    {
      version: 2,
      status: 'retired',
      author: 'Ehsan',
      dateLabel: 'Jun 14, 2026',
      activeSince: null,
      criteria: criteriaFor([40, 15, 20, 10, 5, 10]),
    },
    {
      version: 1,
      status: 'retired',
      author: 'Ehsan',
      dateLabel: 'Mar 02, 2026',
      activeSince: null,
      criteria: criteriaFor([45, 10, 20, 10, 5, 10]),
    },
  ],
  checklist: [
    {
      label: 'Dry run on past checks',
      detail: '6,212 checks re-scored, nothing saved',
      state: 'done',
    },
    { label: 'Rationale and evidence written', detail: '3 sources linked', state: 'done' },
    { label: 'Admin sign-off', detail: 'Requested from Ana L. on Nov 03', state: 'pending' },
  ],
  rationale: {
    paragraphs: [
      'v4 moves five points from keyword match to quantified impact. In the October recruiter panel (40 recruiters, 600 resume pairs), resumes that stated measurable results were shortlisted more often at similar keyword overlap, and keyword weight above 30% rewarded stuffing that recruiters marked down.',
      'Timeline validity gains five points from length. Date gaps and overlapping roles were the most common reason a parsed resume failed in Q3 support tickets, while length rarely changed an outcome once a resume was within two pages.',
      'Parseable formatting and section structure keep their weights. Their pass rates on the 1,200-PDF parser test set did not move between v3 and v4.',
    ],
    byline: 'Drafted by Marco K. · reviewed by Ana L.',
    evidence: [
      { title: 'Recruiter panel report', detail: 'Oct 2026 · 40 recruiters, 600 pairs' },
      { title: 'Parser test set results', detail: '1,200 PDFs · v3 vs v4' },
      { title: 'Q3 support ticket analysis', detail: 'Timeline and date issues' },
    ],
  },
  impact: {
    meanFrom: 71.4,
    meanTo: 69.8,
    checks: 6212,
    note: 'The drop comes mostly from resumes with no measurable results. Users see a v4 score only on their next check; past results keep the version they were scored with.',
    passFrom: 0.58,
    passTo: 0.52,
  },
};
