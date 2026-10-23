import type { AppSettings, PrivacySettings } from '@nextkin/shared/models';
import type { Database, Identity } from '../db/database';
import { errors } from '../http/errors';

/**
 * Per-user app and privacy settings (userRepo.getAppSettings / getPrivacySettings and their
 * updates). Stored in app.user_settings; an unset field reads as its default. Writes are
 * conditional on the row version the client loaded (ETag / If-Match), so a phone and a browser
 * editing at once cannot overwrite each other silently.
 */

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  dateFormat: 'd_mmm_y',
  timeZone: 'UTC',
  aiSuggestions: true,
  experimentalFeatures: false,
  personalizedRecommendations: true,
};

// Private by default (GDPR data protection by default, spec §8.5): the user opts in to visibility.
export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'private',
  recruitersCanFind: false,
  searchEngines: false,
  shareAnonymizedData: false,
};

export interface UserSettings {
  appSettings: AppSettings;
  privacySettings: PrivacySettings;
  rowVersion: number;
}

export interface SettingsPatch {
  appSettings?: Partial<AppSettings>;
  privacySettings?: Partial<PrivacySettings>;
}

const merge = <T extends object>(defaults: T, stored: unknown): T => ({ ...defaults, ...((stored ?? {}) as Partial<T>) });

export async function getSettings(db: Database, identity: Identity): Promise<UserSettings> {
  return db.withUser(identity, async (tx) => {
    const row = await tx
      .selectFrom('user_settings')
      .select(['app_settings', 'privacy_settings', 'row_version'])
      .where('user_id', '=', identity.userId)
      .executeTakeFirst();
    return {
      appSettings: merge(DEFAULT_APP_SETTINGS, row?.app_settings),
      privacySettings: merge(DEFAULT_PRIVACY_SETTINGS, row?.privacy_settings),
      // No row yet is version 0: the first write must say If-Match "v0".
      rowVersion: row?.row_version ?? 0,
    };
  });
}

export async function updateSettings(db: Database, identity: Identity, expectedVersion: number, patch: SettingsPatch): Promise<UserSettings> {
  return db.withUser(identity, async (tx) => {
    const current = await tx
      .selectFrom('user_settings')
      .select(['app_settings', 'privacy_settings', 'row_version'])
      .where('user_id', '=', identity.userId)
      .executeTakeFirst();
    const appSettings = { ...merge(DEFAULT_APP_SETTINGS, current?.app_settings), ...patch.appSettings };
    const privacySettings = { ...merge(DEFAULT_PRIVACY_SETTINGS, current?.privacy_settings), ...patch.privacySettings };

    if (!current) {
      if (expectedVersion !== 0) throw errors.preconditionFailed();
      const inserted = await tx
        .insertInto('user_settings')
        .values({ user_id: identity.userId, app_settings: JSON.stringify(appSettings), privacy_settings: JSON.stringify(privacySettings) })
        .onConflict((oc) => oc.column('user_id').doNothing())
        .returning('row_version')
        .executeTakeFirst();
      if (!inserted) throw errors.preconditionFailed(); // another writer created it first
      return { appSettings, privacySettings, rowVersion: inserted.row_version };
    }

    // The version check is in the WHERE clause, so a concurrent writer cannot slip in between.
    const updated = await tx
      .updateTable('user_settings')
      .set({ app_settings: JSON.stringify(appSettings), privacy_settings: JSON.stringify(privacySettings) })
      .where('user_id', '=', identity.userId)
      .where('row_version', '=', expectedVersion)
      .returning('row_version')
      .executeTakeFirst();
    if (!updated) throw errors.preconditionFailed();
    return { appSettings, privacySettings, rowVersion: updated.row_version };
  });
}
