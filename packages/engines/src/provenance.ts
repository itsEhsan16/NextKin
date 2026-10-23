/**
 * The versioned method and the provenance stamp (ImBackendImplementationPlan P8-01, old Q-01, G12,
 * G15).
 *
 * A rubric version fixes everything that turns facts into a number: component weights, band
 * thresholds, D-14's evidence tiers, requirement weights and the section thresholds. Published
 * versions are frozen and their fingerprints pinned in a test, so a weight change cannot slip in:
 * it has to be a new version, and stored runs stay reproducible at the version they name.
 *
 * Every run carries a stamp (engine, rubric, taxonomy, KB, markets, as-of) and a reason: a re-score
 * because the document changed is a `content_change`; one because the method changed is a
 * `method_change`, which the user is told about (G15).
 */

import type { Bps } from './bps';
import { deepFreeze, fingerprint } from './canonical';

/** The engines' semver. Bump on any change to what an engine decides. */
export const ENGINE_VERSION = '1.0.0';

export type ComponentKey = 'keywords' | 'timeline' | 'sections' | 'formatting' | 'achievements';

export interface RubricVersion {
  id: string;
  /** When it was published, as data (never the clock). */
  publishedOn: string;
  components: readonly { key: ComponentKey; weightBps: Bps }[];
  /** Band floors on the 0–100 total. */
  bands: { strong: number; good: number; fair: number };
  /** How much a required requirement counts against a preferred one (§7.8). */
  requirementWeight: { required: number; preferred: number };
  /** D-14: credit by evidence tier, and for a skill shown for fewer years than asked. */
  credit: { demonstrated: Bps; listed: Bps; unbacked: Bps; yearsShort: Bps };
  sections: { summaryMinWords: number; skillsMin: number };
  /** A run of this many words copied from the JD earns nothing (G16). */
  pastedMinWords: number;
  /**
   * A JD's years ask is measured against at most the technology's age (`plausibility.ts`): nobody
   * is marked short of "20 years of React". Absent on rubric-1.
   */
  yearsCappedAtTechAge?: boolean;
  rationale: string;
}

const RUBRIC_1: RubricVersion = {
  id: 'rubric-1',
  publishedOn: '2026-10-11',
  components: [
    { key: 'keywords', weightBps: 4000 },
    { key: 'timeline', weightBps: 2000 },
    { key: 'sections', weightBps: 1500 },
    { key: 'formatting', weightBps: 1500 },
    { key: 'achievements', weightBps: 1000 },
  ],
  bands: { strong: 85, good: 70, fair: 55 },
  requirementWeight: { required: 2, preferred: 1 },
  credit: { demonstrated: 10_000, listed: 5_000, unbacked: 0, yearsShort: 5_000 },
  sections: { summaryMinWords: 15, skillsMin: 3 },
  pastedMinWords: 8,
  rationale:
    'V2 §7.8 initial weights (40/20/15/15/10) and the bands the apps already show (85/70/55). ' +
    'D-14 evidence tiers: a skill a dated role demonstrates earns full credit, a skill only listed ' +
    'earns half, an unbacked one nothing. Required requirements count twice preferred ones.',
};

const RUBRIC_2: RubricVersion = {
  ...RUBRIC_1,
  id: 'rubric-2',
  publishedOn: '2026-10-21',
  yearsCappedAtTechAge: true,
  rationale:
    'rubric-1 unchanged in weights, bands and credit. One method change: a JD asking more years of ' +
    'a technology than it has existed (or than a career holds) is measured against that ceiling, ' +
    'so the candidate is not marked short of an impossible ask.',
};

/** Every published rubric version. Add new versions; never edit one. */
export const RUBRICS: Readonly<Record<string, RubricVersion>> = deepFreeze({ [RUBRIC_1.id]: RUBRIC_1, [RUBRIC_2.id]: RUBRIC_2 });

/** The version new runs use. */
export const CURRENT_RUBRIC_ID = RUBRIC_2.id;

export function rubricById(id: string = CURRENT_RUBRIC_ID): RubricVersion {
  const rubric = RUBRICS[id];
  if (!rubric) throw new RangeError(`Unknown rubric version ${id}`);
  return rubric;
}

/** A versioned dataset, named by id and version, identified by its content. */
export interface DatasetRef {
  version: string;
  fingerprint: string;
}

const refs = new WeakMap<object, DatasetRef>();

export function datasetRef(dataset: { version: string }): DatasetRef {
  let ref = refs.get(dataset);
  if (!ref) {
    ref = { version: dataset.version, fingerprint: fingerprint(dataset) };
    refs.set(dataset, ref);
  }
  return ref;
}

/** G12's provenance stamp. */
export interface Stamp {
  engine: string;
  rubric: string;
  rubricFingerprint: string;
  taxonomy: DatasetRef;
  kb: DatasetRef;
  markets?: DatasetRef;
  /** "Present" for open-ended roles, as YYYY-MM. */
  asOf: string;
}

export type RunReason = 'content_change' | 'method_change';

/** The method part of a stamp: everything except the inputs. */
function methodOf(stamp: Stamp): string {
  return fingerprint({ ...stamp, asOf: undefined });
}

/**
 * Why a run happened, given the one before it. A method change takes precedence, so the user is
 * told when a number moved because the method did (G15). A first run is a content change. `asOf`
 * belongs to the inputs: time passing is a content change, not a method change.
 */
export function runReason(
  previous: { stamp: Stamp; contentFingerprint: string } | undefined,
  next: { stamp: Stamp; contentFingerprint: string },
): { reason: RunReason; methodChanged: boolean; contentChanged: boolean } {
  if (!previous) return { reason: 'content_change', methodChanged: false, contentChanged: true };
  const methodChanged = methodOf(previous.stamp) !== methodOf(next.stamp);
  const contentChanged =
    previous.contentFingerprint !== next.contentFingerprint || previous.stamp.asOf !== next.stamp.asOf;
  return { reason: methodChanged ? 'method_change' : 'content_change', methodChanged, contentChanged };
}
