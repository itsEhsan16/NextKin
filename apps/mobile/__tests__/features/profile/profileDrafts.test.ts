import { profileFixture } from '@/data/mock';
import type { Certification, Education, Experience, ProfileLink } from '@/data/models';
import {
  certificationDraft,
  certificationEntry,
  educationDraft,
  educationEntry,
  experienceDraft,
  experienceEntry,
  linkDraft,
  linkEntry,
} from '@/features/profile/profileDrafts';

/**
 * The round trip, for every entry the profile can hold.
 *
 * A device pass found the Swiggy role showing **End: "Not set"** when its fixture says
 * `endDate: '2022-02-28'`. The load path was innocent — the draft builder reads the field and a
 * test already covered that. What destroyed it was the "I currently work here" switch: turning it
 * ON patched `{ current: true, endDate: '' }`, and turning it back OFF restored only `current`.
 * The date was gone from the draft, the picker then opened on today's month, and saving persisted
 * the loss.
 *
 * No screen test caught it because each half was correct on its own; only the *sequence* lost
 * data. So this file tests the property rather than the path — take a real entry, put it through
 * the draft and back, and assert nothing fell out — and it does it for all four entry types, so a
 * form added later inherits the check instead of needing one written for it.
 */

const experience = profileFixture.experiences.find((entry) => !entry.current);
const currentRole = profileFixture.experiences.find((entry) => entry.current);
const education = profileFixture.education[0];
const link = profileFixture.links[0];

const certification: Certification = {
  id: 'cert_1',
  name: 'Certified Usability Analyst',
  issuer: 'HFI',
  issuedOn: '2021-04-12',
  expiresOn: '2027-04-12',
  credentialUrl: 'https://hfi.example/verify/1',
};

if (!experience || !currentRole || !education || !link) {
  throw new Error(
    'profile fixture: expected a finished role, a current role, education and a link',
  );
}

describe('profileDrafts — every entry survives the round trip', () => {
  it('keeps a finished role whole, dates included', () => {
    const restored: Experience = experienceEntry(experience.id, experienceDraft(experience));

    expect(restored).toEqual(experience);
    // Named explicitly: this is the field that went missing on a device.
    expect(restored.endDate).toBe(experience.endDate);
  });

  it('keeps a current role whole, and leaves it without an end date', () => {
    const restored = experienceEntry(currentRole.id, experienceDraft(currentRole));

    expect(restored).toEqual(currentRole);
    expect(restored.current).toBe(true);
    expect(restored.endDate).toBeUndefined();
  });

  it('keeps education whole, optional field of study included', () => {
    expect(educationEntry(education.id, educationDraft(education))).toEqual(education);
  });

  it('keeps a certification whole, all three optionals included', () => {
    expect(certificationEntry(certification.id, certificationDraft(certification))).toEqual(
      certification,
    );
  });

  it('keeps a link whole', () => {
    const restored: ProfileLink = linkEntry(link.id, linkDraft(link));
    expect(restored).toEqual(link);
  });
});

describe('profileDrafts — the still-here switch hides the end date, it does not destroy it', () => {
  it('gives the date back when the switch goes off again', () => {
    // Exactly the sequence a reader performs when they flick the switch to see what it does.
    const draft = experienceDraft(experience);
    expect(draft.endDate).toBe('2022-02-28');

    const on = { ...draft, current: true };
    // Still in the draft while hidden — the row is not rendered, which is a different thing.
    expect(on.endDate).toBe('2022-02-28');
    // And correctly absent from what would be SAVED in that state.
    expect(experienceEntry(experience.id, on).endDate).toBeUndefined();

    const off = { ...on, current: false };
    expect(experienceEntry(experience.id, off)).toEqual(experience);
  });

  it('does the same for education', () => {
    const draft = educationDraft(education);
    const on = { ...draft, current: true };
    const off = { ...on, current: false };

    expect(educationEntry(education.id, on).endDate).toBeUndefined();
    expect(educationEntry(education.id, off)).toEqual(education);
  });
});

describe('profileDrafts — a new entry starts empty rather than half-filled', () => {
  it('never invents a date for a role that has not been typed', () => {
    const entry = experienceEntry('exp_new', {
      company: 'Zoho',
      title: 'Designer',
      startDate: '2024-01-01',
      endDate: '',
      current: false,
      skills: [],
    });

    expect(entry.endDate).toBeUndefined();
    expect(entry.skills).toEqual([]);
  });
});
