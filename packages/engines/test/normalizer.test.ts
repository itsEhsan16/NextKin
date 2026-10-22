import { describe, expect, it } from 'vitest';

import { TAXONOMY } from '../src/datasets/taxonomy';
import { findSkill, mentionsIn, resolveSkill } from '../src/normalizer';
import { keysOf, phraseKey, tokenize } from '../src/text';

/**
 * The labelled surface-form table (P8-02's done-when). Each row: a text and exactly the skill ids it
 * must yield, in order. Positives cover symbols, versions, German and ambiguous names in context;
 * the negatives are the ambiguity list, which must yield nothing at all.
 */
const POSITIVE: readonly [string, string[]][] = [
  ['C++ and C# on .NET', ['cpp', 'csharp', 'dotnet']],
  ['Node.js, NodeJS and node.js services', ['nodejs', 'nodejs', 'nodejs']],
  ['ReactJS, React.js and React Native', ['react', 'react', 'react-native']],
  ['JavaScript, not Java', ['javascript', 'java']],
  ['Spring Boot microservices', ['spring-boot', 'microservices']],
  ['CI/CD with GitHub Actions and GitLab CI', ['ci-cd', 'github-actions', 'gitlab-ci']],
  ['Python 3.11, Java 8 and Angular 2+', ['python', 'java', 'angular']],
  ['Python3, Vue3 and HTML5', ['python', 'vue', 'html']],
  ['Amazon S3, EC2 and AWS Lambda', ['s3', 'ec2', 'aws-lambda']],
  ['Postgres and PostgreSQL', ['postgresql', 'postgresql']],
  ['k8s clusters', ['kubernetes']],
  ['A/B testing and usability tests', ['ab-testing', 'usability-testing']],
  ['HTML & CSS', ['html-css']],
  ['Built Go services', ['go']],
  ['written in Go', ['go']],
  ['Golang', ['go']],
  ['Python, Go and Rust', ['python', 'go', 'rust']],
  ['Go / Rust / Python', ['go', 'rust', 'python']],
  ['Rust developer', ['rust']],
  ['R scripts for churn models', ['r']],
  ['Swift and Objective-C apps', ['swift', 'objective-c']],
  ['a React app', ['react']],
  ['Spring framework', ['spring']],
  ['Kubernetes-Cluster betreiben', ['kubernetes']],
  ['Go-Entwicklung im Team', ['go']],
  ['Kenntnisse in Java und Python', ['java', 'python']],
  ['Erfahrung mit Datenanalyse und Maschinelles Lernen', ['data-analysis', 'machine-learning']],
  ['Barrierefreiheit (WCAG)', ['accessibility', 'accessibility']],
  ['Microsoft Excel and Power BI', ['excel', 'power-bi']],
  ['Apache Spark and Kafka', ['spark', 'kafka']],
  ['Built internal tooling with Swift', ['swift']],
  ['Migrated the reporting stack to React', ['react']],
  ['Used Jest for unit tests', ['jest']],
  ['Packaged releases with Helm.', ['helm']],
];

/** The ambiguity list: ordinary uses of ambiguous names. Zero false positives allowed. */
const AMBIGUOUS_NEGATIVE: readonly string[] = [
  'Led our go-to-market strategy',
  'We go live next quarter',
  'Doubled the R&D budget',
  'Presented to C-level stakeholders',
  'Grade C in chemistry',
  'Spring 2020 internship',
  'Every spring we hire interns',
  'Swift delivery of every release',
  'React to incidents within an hour',
  'Removed rust from the bridge supports',
  'Chef at a busy restaurant',
  'Sketch ideas on paper first',
  'Excel at customer service',
  'Excelled at every task',
  'Ruby anniversary celebration',
  'Took the rest of the week off',
  'Express delivery for every order',
  'Helm of a sailing boat',
  'Gave 5 ml of saline',
  'Administered 10 ml doses',
  'Shell Oil station manager',
  'Lambda calculus seminar',
  'said it in jest',
  'a puppet show for children',
  'the node at the end of the graph',
  'dart board tournament',
  'a spark of curiosity',
  'Worked with Chef Ramsay on the menu',
  "Cooked with Chef's knives",
  'Moved to Spring Street',
  'Talked to Rust Belt manufacturers',
  'Relocated to Swift Current',
  'Switched to Express delivery for all orders',
  'Went to Ruby Tuesday with the team',
  'Introduced C-level reporting',
  'customer service in Spring 2021',
];

describe('the normalizer', () => {
  it('meets the bar on the labelled positive table (100% here)', () => {
    const misses = POSITIVE.filter(([text, ids]) => {
      const got = mentionsIn(TAXONOMY, text).map((m) => m.skillId);
      return JSON.stringify(got) !== JSON.stringify(ids);
    });
    expect(misses).toEqual([]);
  });

  it('has zero false positives on the ambiguity list', () => {
    const hits = AMBIGUOUS_NEGATIVE.map((text) => [text, mentionsIn(TAXONOMY, text).map((m) => m.skillId)] as const).filter(([, ids]) => ids.length > 0);
    expect(hits).toEqual([]);
  });

  it('never resolves "go-to-market" to Go, in any case or context', () => {
    for (const text of ['go-to-market', 'Go-to-market', 'GO-TO-MARKET plan', 'Python, go-to-market and SQL']) {
      expect(mentionsIn(TAXONOMY, text).map((m) => m.skillId)).not.toContain('go');
    }
  });

  it('accepts an ambiguous name as a whole list item', () => {
    for (const [item, id] of [['Go', 'go'], ['go', 'go'], ['R', 'r'], ['C', 'c'], ['Swift', 'swift'], ['Rust 1.75', 'rust']] as const) {
      expect(resolveSkill(TAXONOMY, item)).toMatchObject({ id, known: true });
    }
  });

  it('keeps the written form and any version', () => {
    const [m] = mentionsIn(TAXONOMY, 'Worked with Postgres 14 daily');
    expect(m).toMatchObject({ skillId: 'postgresql', surface: 'Postgres', version: '14' });
    expect('Worked with Postgres 14 daily'.slice(m!.start, m!.end)).toBe('Postgres 14');
  });

  it('gives an unknown phrase a stable id and matches it only as whole words', () => {
    const ref = resolveSkill(TAXONOMY, 'Stakeholder alignment');
    expect(ref).toEqual({ id: 'x:stakeholder alignment', name: 'Stakeholder alignment', known: false });
    expect(findSkill(TAXONOMY, 'Drove stakeholder alignment across teams', ref)).toHaveLength(1);
    expect(findSkill(TAXONOMY, 'Drove stakeholder-alignments', ref)).toHaveLength(0);
    expect(resolveSkill(TAXONOMY, 'Fintech / payments').known).toBe(false);
  });

  it('has no duplicate ids or alias keys in the taxonomy', () => {
    const ids = TAXONOMY.skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = new Map<string, string>();
    const clashes: string[] = [];
    for (const skill of TAXONOMY.skills) {
      for (const entry of [skill.name, ...skill.aliases]) {
        const key = phraseKey(entry.replace(/^~/, ''));
        const owner = keys.get(key);
        if (owner && owner !== skill.id) clashes.push(`${key}: ${owner} / ${skill.id}`);
        keys.set(key, skill.id);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe('the tokenizer', () => {
  it('keeps symbols inside names and splits punctuation', () => {
    expect(keysOf('C++, C#, .NET, Node.js and CI/CD')).toEqual(['c++', ',', 'c#', ',', '.net', ',', 'node.js', 'and', 'ci', '/', 'cd']);
    expect(keysOf('go-to-market')).toEqual(['go', '-', 'to', '-', 'market']);
  });

  it('points every token back at its source text', () => {
    const text = 'Müller built Go-Entwicklung 🚀 in Köln';
    for (const token of tokenize(text)) expect(text.slice(token.start, token.end)).toBe(token.raw);
  });
});
