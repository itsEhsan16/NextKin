import { describe, expect, it } from 'vitest';
import { isStandardFont } from '../src/parsing/layout';
import { decorativeSymbolsIn, normaliseText, texText, texUrl } from '../src/export/latex/escape';
import { preambleOf, texOf } from '../src/export/latex/jakeTemplate';
import { LATEX_STYLES, styleOf } from '../src/export/latex/styles';
import { lintTex } from '../src/export/latex/texLint';
import type { LatexDensity, LatexEntry, LatexResume } from '../src/export/latex/types';

/** Synthetic (L4): a Jake-like resume with every section kind. */
function fixture(density: LatexDensity = 0, paper: LatexResume['paper'] = 'letter'): LatexResume {
  return {
    name: 'Alex Rivera',
    headline: 'Full-stack engineer',
    contact: [
      { text: 'Portland, Oregon, USA' },
      { text: '+1 555 010 0199', url: 'tel:+15550100199' },
      { text: 'alex.rivera@example.com', url: 'mailto:alex.rivera@example.com' },
      { text: 'linkedin.com/in/alex_rivera', url: 'https://linkedin.com/in/alex_rivera' },
      { text: 'github.com/alexr', url: 'https://github.com/alexr' },
    ],
    density,
    paper,
    sections: [
      { kind: 'paragraph', heading: 'Summary', text: 'Engineer who ships web apps end to end -- React, Node and Postgres.' },
      {
        kind: 'entries',
        heading: 'Experience',
        entries: [
          {
            title: 'Brightleaf',
            titleNote: '(brightleaf.dev)',
            right: 'Jan 2022 -- Present',
            subtitle: 'Software Engineer',
            subRight: 'Remote',
            bullets: ['Led a team of 3 to rebuild the billing flow & cut churn by 12%.'],
            children: [
              { title: 'Harbor Health', right: '2023', subtitle: 'Client project', bullets: ['Built a patient portal in Next.js.', 'Moved reports to a queue.'] },
              { title: 'Kestrel Freight', right: '2022', tech: 'Go, Kafka', bullets: ['Wrote the tracking API.'] },
            ],
          },
        ],
      },
      {
        kind: 'entries',
        heading: 'Projects',
        entries: [
          { title: 'iRedirectX', tech: 'React, SQL', techInline: true, right: 'Mar 2021 -- May 2021', bullets: ['A link shortener with per-link analytics.'] },
          { title: 'Tidepool', tech: 'Python, Flask', techInline: true, right: '2020', bullets: ['Tide charts for 400 stations.'] },
        ],
      },
      {
        kind: 'entries',
        heading: 'Education',
        entries: [{ title: 'Riverside State University', right: 'Portland, OR', subtitle: 'B.S. Computer Science, GPA: 3.8/4.0', subRight: 'Aug 2016 -- May 2020', bullets: [] }],
      },
      { kind: 'entries', heading: 'Extracurricular', entries: [{ title: 'Coding Club', subtitle: 'President', right: '2018 -- 2020', bullets: ['Ran weekly workshops for 40 students.'] }] },
      { kind: 'lines', heading: 'Certifications', lines: [{ text: 'AWS Certified Developer -- Associate (2023)' }, { text: 'Certified Scrum Master' }] },
      {
        kind: 'lines',
        heading: 'Technical Skills',
        lines: [
          { label: 'Languages', text: 'TypeScript, Python, Go, SQL' },
          { label: 'Front End', text: 'React, Next.js' },
          { label: 'Tools', text: 'Docker, Git, PostgreSQL' },
        ],
      },
    ],
  };
}

function expectLintClean(tex: string): void {
  const lint = lintTex(tex);
  expect(lint.problems).toEqual([]);
  expect(lint.ok).toBe(true);
}

describe('texOf (Jake layout)', () => {
  const tex = texOf(fixture());

  it('emits the header, the sections in order and the entry structure', () => {
    expect(tex).toContain('\\rName{Alex Rivera}');
    expect(tex).toContain('\\rHeadline{Full-stack engineer}');
    expect(tex).toContain('{Portland, Oregon, USA\\rSep \\href{tel:+15550100199}{+1 555 010 0199}\\rSep \\href{mailto:alex.rivera@example.com}{alex.rivera@example.com}');
    expect(tex).toContain('\\href{https://linkedin.com/in/alex\\%5Frivera}{linkedin.com/in/alex\\_rivera}');
    const headings = [...tex.matchAll(/\\section\*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(headings).toEqual(['Summary', 'Experience', 'Projects', 'Education', 'Extracurricular', 'Certifications', 'Technical Skills']);
    expect(tex).toContain('\\item \\rHeadSub{\\textbf{Brightleaf} (brightleaf.dev)}{Jan 2022 -- Present}{Software Engineer}{Remote}');
    expect(tex).toContain('\\item Led a team of 3 to rebuild the billing flow \\& cut churn by 12\\%.');
    expect(tex).toContain('\\item \\rHead{\\textbf{iRedirectX}\\rSep React, SQL}{Mar 2021 -- May 2021}');
    expect(tex).toContain('\\item \\rHead{\\textbf{Kestrel Freight}}{2022}\n\\rTech{Go, Kafka}');
    expect(tex).toContain('{B.S. Computer Science, GPA: 3.8/4.0}{Aug 2016 -- May 2020}');
    expect(tex).toContain('\\item \\textbf{Languages}: TypeScript, Python, Go, SQL');
    expect(tex).toContain('\\begin{rlines}\n\\item AWS Certified Developer -- Associate (2023)');
    expect(tex.endsWith('\\end{document}\n')).toBe(true);
  });

  it('nests client projects one level inside their role', () => {
    const start = tex.indexOf('\\textbf{Brightleaf}');
    const inner = tex.indexOf('\\begin{rentries}', start);
    expect(inner).toBeGreaterThan(start);
    expect(tex.indexOf('\\textbf{Harbor Health}')).toBeGreaterThan(inner);
    expect(tex.indexOf('\\section*{Projects}')).toBeGreaterThan(tex.indexOf('\\textbf{Kestrel Freight}'));
  });

  it('passes its own lint', () => expectLintClean(tex));

  it('flattens children past the second level and keeps lists balanced', () => {
    const deep: LatexEntry = { title: 'L1', bullets: [], children: [{ title: 'L2', bullets: [], children: [{ title: 'L3', bullets: ['x'], children: [{ title: 'L4', bullets: [] }] }] }] };
    const out = texOf({ ...fixture(), sections: [{ kind: 'entries', heading: 'Deep', entries: [deep] }] });
    expect(out.match(/\\begin\{rentries\}/g)).toHaveLength(2);
    expectLintClean(out);
  });

  it('skips empty pieces without leaving an empty list', () => {
    const out = texOf({ ...fixture(), headline: ' ', contact: [], sections: [
      { kind: 'lines', heading: 'Empty', lines: [] },
      { kind: 'entries', heading: 'None', entries: [] },
      { kind: 'paragraph', heading: 'Blank', text: '\n\t' },
    ] });
    expect(out).not.toContain('\\rHeadline{');
    expect(out).not.toContain('\\begin{rlines}');
    expect(out).not.toMatch(/\\begin\{rentries\}\n\\end/);
    expectLintClean(out);
  });
});

describe('preambles', () => {
  it('differ for every density and paper, and each lints clean', () => {
    const all = ([0, 1, 2] as LatexDensity[]).flatMap((d) => (['letter', 'a4'] as const).map((p) => preambleOf(d, p)));
    expect(new Set(all).size).toBe(6);
    for (const d of [0, 1, 2] as LatexDensity[]) for (const p of ['letter', 'a4'] as const) expectLintClean(texOf(fixture(d, p)));
    expect(preambleOf(0, 'a4')).toContain('\\documentclass[a4paper,11pt]{article}');
    expect(preambleOf(0, 'letter')).toContain('\\fontsize{10.5pt}');
    expect(preambleOf(2, 'letter')).toContain('\\documentclass[letterpaper,11pt]{article}');
    expect(preambleOf(2, 'letter')).toContain('\\fontsize{10pt}');
  });

  it('give every template its own preamble over the same body, each lint-clean (toreview §124)', () => {
    const styles = Object.values(LATEX_STYLES);
    expect(new Set(styles.map((s) => preambleOf(0, 'letter', s))).size).toBe(styles.length);
    for (const style of styles) {
      const tex = texOf(fixture(), style);
      expectLintClean(tex);
      expect(tex.slice(preambleOf(0, 'letter', style).length).replace(/\{(center|rheader)\}/g, '{H}')).toBe(texOf(fixture()).slice(preambleOf(0, 'letter').length).replace(/\{(center|rheader)\}/g, '{H}'));
    }
    expect(texOf(fixture(), LATEX_STYLES.modern)).toContain('\\begin{rheader}');
    expect(styleOf('nonsense').slug).toBe('jake');
    expect(styleOf(undefined).slug).toBe('jake');
  });

  it('use only the packages the compile container has', () => {
    const pkgs = [...preambleOf(0, 'letter').matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/g)].map((m) => m[1]);
    expect(pkgs).toEqual(['geometry', 'fontspec', 'titlesec', 'enumitem', 'hyperref']);
    expect(preambleOf(0, 'letter')).not.toContain('XeTeXinterwordspaceshaping');
    expect(preambleOf(0, 'letter')).not.toMatch(/pdfgentounicode|glyphtounicode/);
  });

  it('refuses a changed preamble or a stray macro in the body', () => {
    const tex = texOf(fixture());
    expect(lintTex(tex.replace('\\usepackage{titlesec}', '\\usepackage{titlesec}\\input{x}')).ok).toBe(false);
    expect(lintTex(tex.replace('\\end{document}', '\\input{/etc/passwd}\\end{document}')).problems[0]).toMatch(/forbidden control sequence \\input/);
    expect(lintTex(tex.replace('\\end{document}', '\\begin{verbatim}\\end{document}')).ok).toBe(false);
    expect(lintTex(tex.replace('\\end{document}', '^^5cinput\\end{document}')).ok).toBe(false);
    expect(lintTex(tex.replace('\\end{document}', '\\item[x]\\end{document}')).ok).toBe(false);
    expect(lintTex(tex.replace('\\end{document}', '\\href{javascript:x}{y}\\end{document}')).ok).toBe(false);
    expect(lintTex(`${tex}\\input{x}`).ok).toBe(false);
  });
});

const INJECTIONS = [
  '\\input{/etc/passwd}', '}\\write18{rm -rf /}', '$\\catcode', '\\def\\x{}', '%comment', '^^5c', '^^5cinput{/etc/passwd}', '~',
  '\\\\', '\\\\[2pt]', '[x] starts with a bracket', '*starred', '\\end{document}', '\\begin{verbatim}', '\\csname input\\endcsname',
  '\\XeTeXinterwordspaceshaping=0', '#1', 'a_b & c', '}}}}{{{{', '\\directlua{os.exit()}', 'Zoë Ålund — 東京 🚀 مرحبا',
  'line\u2028break\u2029here\u0000\u0007\u001b[31m', '\uD800lone surrogate', 'x'.repeat(5000),
];

describe('injection corpus', () => {
  it('prints every hostile string as literal text and stays lint clean', () => {
    for (const s of INJECTIONS) {
      const entry: LatexEntry = { title: s, titleNote: s, right: s, subtitle: s, subRight: s, tech: s, bullets: [s], children: [{ title: s, tech: s, techInline: true, bullets: [s] }] };
      const resume: LatexResume = {
        ...fixture(),
        name: s,
        headline: s,
        contact: [{ text: s }, { text: s, url: 'javascript:alert(1)' }, { text: s, url: `https://example.com/${s}` }],
        sections: [
          { kind: 'paragraph', heading: s, text: s },
          { kind: 'lines', heading: s, lines: [{ label: s, text: s }, { text: s }] },
          { kind: 'entries', heading: s, entries: [entry] },
        ],
      };
      const tex = texOf(resume);
      expectLintClean(tex);
      expect(tex).toContain(`\\rName{${texText(s)}}`);
      expect(tex).not.toContain('javascript');
    }
  });

  it('escapes each special to a text symbol', () => {
    expect(texText('\\input{x}')).toBe('\\textbackslash{}input\\{x\\}');
    expect(texText('$ & # % _ ^ ~')).toBe('\\$ \\& \\# \\% \\_ \\textasciicircum{} \\textasciitilde{}');
    expect(texText('^^5c')).toBe('\\textasciicircum{}\\textasciicircum{}5c');
    expect(texText('[x]')).toBe('{[}x{]}');
    expect(texText('  a \n\n b\u2028c\u0007 ')).toBe('a b c');
    // Emoji and decorative symbols are left out (toreview §130); letters in any script stay.
    expect(normaliseText('Zoë 東京 🚀')).toBe('Zoë 東京');
    expect(normaliseText('✅ Shipped ➜ 3 apps ★')).toBe('Shipped 3 apps');
    expect(decorativeSymbolsIn('✅ Shipped ➜ 3 apps 👍🏽')).toBe(4);
  });

  it('texUrl refuses everything but https, mailto and tel', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'file:///etc/passwd', 'http://example.com', '/relative/path', 'example.com', 'https://user:pw@example.com', 'https://exa\nmple.com', 'https://example.com/\u0000', 'data:text/html,x', 'mailto:', 'ftp://x.org', '']) {
      expect(texUrl(bad), bad).toBeNull();
    }
    expect(texUrl('https://example.com/a b?q={x}#frag')).toBe('https://example.com/a\\%20b?q=\\%7Bx\\%7D\\%23frag');
    expect(texUrl('https://example.com/~me/100%')).toBe('https://example.com/\\%7Eme/100\\%25');
    expect(texUrl('https://example.com/\\x')).toBe('https://example.com//x');
    expect(texUrl('https://bücher.example/straße')).toBe('https://xn--bcher-kva.example/stra\\%C3\\%9Fe');
    expect(texUrl('tel:+1 555 0100')).toBe('tel:+1\\%20555\\%200100');
  });
});

/** A small LCG so the fuzz is the same on every run. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const POOL = ['\\', '{', '}', '$', '&', '#', '%', '_', '^', '~', '[', ']', '*', '-', "'", '`', '"', '|', ' ', '\n', '\t', '\u0000', '\u001f', '\u007f', '\u0085', '\u2028', '\uD83D', '\uDE80', 'é', '東', 'a', 'Z', '0', 'input', 'def', '\\write18', '^^5c', 'end{document}'];

describe('fuzz', () => {
  it('lints clean for random strings in every field', () => {
    const rand = lcg(20261019);
    const pick = (): string => {
      let s = '';
      const n = Math.floor(rand() * 24);
      for (let k = 0; k < n; k++) s += rand() < 0.15 ? String.fromCodePoint(Math.floor(rand() * 0x10ffff) % 0xd800) : (POOL[Math.floor(rand() * POOL.length)] ?? '');
      return s;
    };
    for (let run = 0; run < 300; run++) {
      const child: LatexEntry = { title: pick(), right: pick(), subtitle: pick(), tech: pick(), techInline: rand() < 0.5, bullets: [pick(), pick()] };
      const resume: LatexResume = {
        name: pick(),
        headline: pick(),
        contact: [{ text: pick(), url: `https://example.com/${pick()}` }, { text: pick(), url: pick() }],
        density: (run % 3) as LatexDensity,
        paper: run % 2 ? 'a4' : 'letter',
        sections: [
          { kind: 'paragraph', heading: pick(), text: pick() },
          { kind: 'lines', heading: pick(), lines: [{ label: pick(), text: pick() }, { text: pick() }] },
          { kind: 'entries', heading: pick(), entries: [{ title: pick(), titleNote: pick(), subRight: pick(), bullets: [pick()], children: [child] }] },
        ],
      };
      const lint = lintTex(texOf(resume));
      expect(lint.problems, JSON.stringify(resume)).toEqual([]);
    }
  });
});

describe('ATS formatting (toreview §130)', () => {
  const every = Object.values(LATEX_STYLES).flatMap((style) => ([0, 1, 2] as LatexDensity[]).flatMap((d) => (['letter', 'a4'] as const).map((p) => ({ style, d, p, tex: texOf(fixture(d, p), style) }))));

  it('no tables, no images, nothing in a header or footer', () => {
    for (const { tex } of every) {
      expect(tex).not.toMatch(/tabular|\\includegraphics|fancyhdr|\\multicol|minipage/);
      expect(tex).toContain('\\pagestyle{empty}');
    }
  });

  it('two faces of one standard font: regular and bold, no italic or small caps', () => {
    for (const style of Object.values(LATEX_STYLES)) {
      expect(style.font.options.filter((o) => /Font=/.test(o))).toEqual([expect.stringMatching(/^BoldFont=/)]);
      // Our own upload checker's list: what we build passes what we check (toreview §130).
      expect(isStandardFont(style.fontName), style.fontName).toBe(true);
    }
    for (const { tex } of every) expect(tex).not.toMatch(/\\textit|\\itshape|\\scshape|\\small/);
  });

  it('body text 10pt or larger, margins at least half an inch on every side', () => {
    for (const { tex } of every) {
      const size = Number(/\\AtBeginDocument\{\\fontsize\{([\d.]+)pt\}/.exec(tex)?.[1]);
      expect(size).toBeGreaterThanOrEqual(10);
      const margin = Number(/margin=([\d.]+)in/.exec(tex)?.[1]);
      expect(margin).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('bold name, employer and job title; one plain separator', () => {
    const roles = texOf({ ...fixture(), sections: [{ kind: 'entries', heading: 'Experience', entries: [{ title: 'Acme', right: '2020', subtitle: 'Engineer', subtitleBold: true, bullets: [] }] }] });
    expect(roles).toContain('\\rHeadSub{\\textbf{Acme}}{2020}{\\textbf{Engineer}}{}');
    for (const style of Object.values(LATEX_STYLES)) {
      expect(style.name).toContain('\\bfseries');
      expect(style.sep).toBe(' | ');
    }
  });
});
