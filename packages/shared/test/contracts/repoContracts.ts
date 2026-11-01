import { expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS, type Experience } from '../../src/models';
import { NotFoundError } from '../../src/repos/state';
import type { NotificationsRepo, ProfileRepo, UserRepo } from '../../src/repos/types';
import { accountSecuritySchema, activityEntrySchema, connectedAccountSchema, dashboardStatsSchema, userSchema } from '../../src/schemas/account';
import { profileSchema } from '../../src/schemas/profile';

/**
 * The repository contract suite (ImBackendImplementationPlan P5-03, old plan C-04). One set of
 * assertions per repository, run against the mock (shared's unit tests) and against HTTP on the
 * local stack (the server's integration tests). Both must pass identically, which is what lets a
 * repository flip from mock to HTTP by configuration alone.
 *
 * The assertions are behaviours, never fixture values: each test reads the state it starts from and
 * checks what its call changed, so the same test holds for a seeded mock persona and for a fresh
 * account on the server. Completeness is checked as a 0–1 number only — the mock still tallies it
 * and the server derives it (M1-07), and the mock keeps the boards' numbers until C-10 realigns it.
 */

export interface ContractRepos {
  user: UserRepo;
  profile: ProfileRepo;
  notifications: NotificationsRepo;
}

type Make = () => Promise<ContractRepos>;

const role = (title: string, overrides: Partial<Experience> = {}): Experience => ({
  id: '',
  company: 'Contract Co',
  title,
  startDate: '2020-01-01',
  endDate: '2022-06-30',
  current: false,
  skills: ['TypeScript'],
  ...overrides,
});

const rejectsNotFound = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toBeInstanceOf(NotFoundError);
};

export function profileRepoContract(make: Make): void {
  it('getProfile returns a whole, well-formed profile with completeness in 0..1', async () => {
    const { profile } = await make();
    const value = profileSchema.parse(await profile.getProfile());
    expect(value.completeness).toBeGreaterThanOrEqual(0);
    expect(value.completeness).toBeLessThanOrEqual(1);
  });

  it('upsert with an empty or unknown id appends with a fresh id; with that id it replaces in place', async () => {
    const { profile } = await make();
    const before = (await profile.getProfile()).experiences.length;
    const added = await profile.upsertExperience(role('Contract Engineer'));
    expect(added.experiences).toHaveLength(before + 1);
    const created = added.experiences.find((e) => e.title === 'Contract Engineer')!;
    expect(created.id).not.toBe('');
    const unknown = await profile.upsertExperience(role('Second Role', { id: 'client-minted-1' }));
    expect(unknown.experiences).toHaveLength(before + 2);
    expect(unknown.experiences.some((e) => e.id === 'client-minted-1')).toBe(false);
    const position = unknown.experiences.findIndex((e) => e.id === created.id);
    const edited = await profile.upsertExperience({ ...created, title: 'Senior Contract Engineer' });
    expect(edited.experiences).toHaveLength(before + 2);
    expect(edited.experiences[position]).toMatchObject({ id: created.id, title: 'Senior Contract Engineer' });
  });

  it('every write returns the whole profile, and a later read agrees', async () => {
    const { profile } = await make();
    const written = await profile.upsertEducation({ id: '', institution: 'Contract University', degree: 'BSc', startDate: '2014-09-01', endDate: '2017-06-30', current: false });
    expect(profileSchema.safeParse(written).success).toBe(true);
    const read = await profile.getProfile();
    expect(read.education.map((e) => e.id)).toEqual(written.education.map((e) => e.id));
  });

  it('remove drops the entry; removing an unknown id is NotFoundError', async () => {
    const { profile } = await make();
    const added = await profile.upsertCertification({ id: '', name: 'Contract Cert', issuer: 'Contract Board', issuedOn: '2021-03-01' });
    const id = added.certifications.find((c) => c.name === 'Contract Cert')!.id;
    const removed = await profile.removeCertification(id);
    expect(removed.certifications.some((c) => c.id === id)).toBe(false);
    await rejectsNotFound(profile.removeCertification(id));
    await rejectsNotFound(profile.removeExperience('no-such-entry'));
    await rejectsNotFound(profile.removeEducation('no-such-entry'));
    await rejectsNotFound(profile.removeLink('no-such-entry'));
  });

  it('links upsert and remove like every other section', async () => {
    const { profile } = await make();
    const added = await profile.upsertLink({ id: '', label: 'Contract site', url: 'https://contract.example', kind: 'website' });
    const link = added.links.find((l) => l.label === 'Contract site')!;
    expect(link).toMatchObject({ url: 'https://contract.example', kind: 'website' });
    const removed = await profile.removeLink(link.id);
    expect(removed.links.some((l) => l.id === link.id)).toBe(false);
  });

  it('updateSkills replaces the whole list, in the given order', async () => {
    const { profile } = await make();
    const skills = ['Figma', 'Design systems', 'Prototyping'];
    expect((await profile.updateSkills(skills)).skills).toEqual(skills);
    expect((await profile.getProfile()).skills).toEqual(skills);
    expect((await profile.updateSkills([])).skills).toEqual([]);
  });

  it('updateProfile and updatePreferences merge, leaving other fields alone', async () => {
    const { profile } = await make();
    const before = await profile.getProfile();
    const identity = await profile.updateProfile({ headline: 'Contract headline', location: 'Contract City' });
    expect(identity).toMatchObject({ headline: 'Contract headline', location: 'Contract City' });
    expect(identity.yearsExperience).toBe(before.yearsExperience);
    const prefs = await profile.updatePreferences({ remote: 'hybrid', desiredRoles: ['Contract Lead'] });
    expect(prefs.preferences).toMatchObject({ remote: 'hybrid', desiredRoles: ['Contract Lead'], language: before.preferences.language });
  });

  it('applyProfileDraft dedupes: roles by company+title, education by institution, skills case-insensitively', async () => {
    const { profile } = await make();
    const seeded = await profile.upsertExperience(role('Draft Engineer', { company: 'Draft Co' }));
    await profile.upsertEducation({ id: '', institution: 'Draft Institute', degree: 'MSc', startDate: '2018-09-01', current: true });
    await profile.updateSkills([...seeded.skills.filter((s) => s.toLowerCase() !== 'kotlin'), 'Kotlin']);
    const before = await profile.getProfile();
    const after = await profile.applyProfileDraft({
      skills: ['kotlin', 'Rust'],
      experiences: [role('draft engineer', { company: 'DRAFT CO' }), role('Draft Architect', { company: 'Draft Co', id: 'draft-1' })],
      education: [{ id: 'd-edu', institution: 'draft institute', degree: 'PhD', startDate: '2020-01-01', current: false }],
    });
    expect(after.skills).toEqual([...before.skills, 'Rust']);
    expect(after.experiences).toHaveLength(before.experiences.length + 1);
    expect(after.experiences.some((e) => e.title === 'Draft Architect' && e.id !== 'draft-1' && e.id !== '')).toBe(true);
    expect(after.education).toHaveLength(before.education.length);
  });

  it('marks what it read from a resume, and a confirmation makes it the person’s word', async () => {
    const { profile } = await make();
    const read = await profile.applyProfileDraft({
      skills: ['Zig'],
      experiences: [{ id: '', company: 'Parsed Co', title: 'Engineer', startDate: '2020-01-01', current: true, skills: [] }],
    });
    const role = read.experiences.find((entry) => entry.company === 'Parsed Co');
    expect(role?.provenance).toBe('parsed_confirmed');
    expect(read.skillsToConfirm).toContain('Zig');

    const confirmed = await profile.confirmFacts({ kind: 'experience', id: role!.id });
    expect(confirmed.experiences.find((entry) => entry.id === role!.id)?.provenance).toBe('user');

    expect((await profile.confirmFacts({ kind: 'skills' })).skillsToConfirm).toBeUndefined();
  });

  it('completeNextStep returns the whole profile; an unknown step is NotFoundError', async () => {
    const { profile } = await make();
    const current = await profile.getProfile();
    const step = current.nextSteps[0];
    if (step) expect(profileSchema.safeParse(await profile.completeNextStep(step.id)).success).toBe(true);
    await rejectsNotFound(profile.completeNextStep('step_no_such_step'));
  });
}

export function userRepoContract(make: Make): void {
  it('getCurrentUser returns a well-formed user, and updateName sticks', async () => {
    const { user } = await make();
    userSchema.parse(await user.getCurrentUser());
    const renamed = await user.updateName({ firstName: ' Casey ', lastName: 'Contract ' });
    expect(renamed).toMatchObject({ firstName: 'Casey', lastName: 'Contract' });
    expect(await user.getCurrentUser()).toMatchObject({ firstName: 'Casey', lastName: 'Contract' });
  });

  it('app and privacy settings merge one change in and return the whole set', async () => {
    const { user } = await make();
    const before = await user.getAppSettings();
    const after = await user.updateAppSettings({ dateFormat: 'y_mm_dd' });
    expect(after).toEqual({ ...before, dateFormat: 'y_mm_dd' });
    expect(await user.getAppSettings()).toEqual(after);
    const privacy = await user.getPrivacySettings();
    const changed = await user.updatePrivacySettings({ searchEngines: !privacy.searchEngines });
    expect(changed).toEqual({ ...privacy, searchEngines: !privacy.searchEngines });
  });

  it('two quick setting changes in a row both land', async () => {
    const { user } = await make();
    await user.updateAppSettings({ aiSuggestions: false });
    await user.updateAppSettings({ experimentalFeatures: true });
    expect(await user.getAppSettings()).toMatchObject({ aiSuggestions: false, experimentalFeatures: true });
  });

  it('security, dashboard, activity and connected accounts are well-formed', async () => {
    const { user } = await make();
    accountSecuritySchema.parse(await user.getSecurity());
    const stats = dashboardStatsSchema.parse(await user.getDashboardStats());
    expect(Object.values(stats).every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
    const activity = (await user.listActivity()).map((entry) => activityEntrySchema.parse(entry));
    const times = activity.map((entry) => entry.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    (await user.listConnectedAccounts()).forEach((account) => connectedAccountSchema.parse(account));
  });

  it('signing out everywhere else keeps this session working', async () => {
    const { user } = await make();
    await user.signOutEverywhere();
    await expect(user.getCurrentUser()).resolves.toBeTruthy();
  });
}

export function notificationsRepoContract(make: Make): void {
  it('preferences round-trip whole', async () => {
    const { notifications } = await make();
    const prefs = await notifications.getPrefs();
    const flipped = { ...prefs, weeklyDigest: !prefs.weeklyDigest, categories: { ...prefs.categories, billing: !prefs.categories.billing } };
    expect(await notifications.setPrefs(flipped)).toEqual(flipped);
    expect(await notifications.getPrefs()).toEqual(flipped);
  });

  it('settings replace whole, and reset returns to what a new account starts with', async () => {
    const { notifications } = await make();
    const settings = await notifications.getSettings();
    const changed = { ...settings, channels: { ...settings.channels, push: false } };
    expect(await notifications.setSettings(changed)).toEqual(changed);
    expect(await notifications.getSettings()).toEqual(changed);
    expect(await notifications.resetSettings()).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });
}
