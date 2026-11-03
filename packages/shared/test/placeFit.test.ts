import { describe, expect, it } from 'vitest';

import { pickPlaces, picksFor, type FitPlace } from '../src/scoring/placeFit';

/** Where a ticked keyword fits, from the places' own lines (toreview §163). Synthetic resume. */

const asOf = { year: 2026, month: 11 };
const intern: FitPlace = {
  id: 'intern',
  text: 'Developer Intern\nBuilt internal admin screens in React\nWrote unit tests',
  skills: ['React'],
  start: { year: 2025, month: 6 },
  end: null,
};
const shop: FitPlace = {
  id: 'project:shop',
  text: 'Ease Home\nE-commerce store with Stripe payments\nOrder sync driven by Shopify webhook events\nMySQL',
  skills: ['MySQL'],
};
const old: FitPlace = {
  id: 'old',
  text: 'Web developer\nMaintained the company website',
  skills: ['PHP'],
  start: { year: 2008, month: 1 },
  end: { year: 2011, month: 12 },
};
const places = [intern, shop, old];

describe('pickPlaces', () => {
  it('finds the project whose lines say the keyword, stem and all', () => {
    expect(pickPlaces('webhooks', places, asOf)).toEqual(['project:shop']);
    expect(pickPlaces('e-commerce', places, asOf)).toEqual(['project:shop']);
  });

  it('a database goes where a database of the same kind is used', () => {
    expect(pickPlaces('PostgreSQL', places, asOf)).toContain('project:shop');
  });

  it('a common word is not a fit: an API keyword skips a project for its REST APIs', () => {
    const rest: FitPlace = { id: 'project:rest', text: 'Store\nBuilt CRUD RESTful APIs for orders', skills: [] };
    expect(pickPlaces('LLM APIs', [rest], asOf)).toEqual([]);
  });

  it('one form of a word meets another: integrations, integrated', () => {
    const media: FitPlace = { id: 'project:media', text: 'Store\nIntegrated Cloudinary for media delivery', skills: [] };
    expect(pickPlaces('Integrations', [media], asOf)).toEqual(['project:media']);
  });

  it('picks nothing, not the latest role, when nothing fits', () => {
    expect(pickPlaces('Ayurveda', places, asOf)).toEqual([]);
  });

  it('never picks a role whose dates are before the technology', () => {
    const early: FitPlace = { ...old, text: 'React developer\nBuilt React pages', skills: [] };
    expect(pickPlaces('Next.js', [early], asOf)).toEqual([]);
  });

  it('picks several when several fit, best first, at most three', () => {
    const many: FitPlace[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, text: `Built report generation for ${id}`, skills: [] }));
    expect(pickPlaces('report generation', many, asOf)).toEqual(['a', 'b', 'c']);
  });
});

describe('picksFor', () => {
  it('picks for missing skills only: not ones on the resume, not soft skills', () => {
    const picks = picksFor(
      [
        { label: 'webhooks', onResume: false },
        { label: 'React', onResume: true },
        { label: 'e-commerce', onResume: false, kind: 'soft' },
        { label: 'Ayurveda', onResume: false },
      ],
      places,
      asOf,
    );
    expect(picks).toEqual({ webhooks: ['project:shop'] });
  });
});
