/**
 * How the app looks and behaves for one account: the web Settings → Preferences board's "App
 * settings" and "Content & AI preferences" cards (Figma 356:85, 356:146). V2 names none of these;
 * the board alone defines them (`toreview.md` §22). Language stays on the profile's preferences,
 * where mobile already keeps it.
 */

/** Light, dark, or whatever the device prefers. Only light exists until a dark palette does. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** How dates read: "14 Jan 2024", "Jan 14, 2024", "14/01/2024", "01/14/2024", "2024-01-14". */
export type DateFormat = 'd_mmm_y' | 'mmm_d_y' | 'dd_mm_y' | 'mm_dd_y' | 'y_mm_dd';

export type AppSettings = {
  theme: ThemePreference;
  dateFormat: DateFormat;
  /** An IANA zone: "Asia/Kolkata". */
  timeZone: string;
  /** "Show AI suggestions" (356:163): tips for the profile, jobs and career growth. */
  aiSuggestions: boolean;
  /** "Include experimental features" (356:170). */
  experimentalFeatures: boolean;
  /** "Personalize job recommendations" (356:177): activity and profile improve the matches. */
  personalizedRecommendations: boolean;
};

/**
 * Who can see the profile: "Profile visibility" on the web Settings → Privacy & data mockup. V2's
 * Release 1 scope has no recruiter portal and no public profile, so nothing reads this, or the two
 * switches after it, until one of them exists.
 */
export type ProfileVisibility = 'recruiters' | 'public' | 'private';

/**
 * "Privacy settings" on the web Settings → Privacy & data mockup. Each control saves alone, so they
 * can disagree: "Private" with "Show on search engines" on. Nothing says yet which wins; whatever
 * first reads them has to settle it (`toreview.md` §30).
 */
export type PrivacySettings = {
  profileVisibility: ProfileVisibility;
  /** "Let recruiters find you": verified recruiters may discover and contact the user. */
  recruitersCanFind: boolean;
  /** "Show on search engines": the profile may appear in Google and other search engines. */
  searchEngines: boolean;
  /** "Share anonymized data": V2 §8.5's product-analytics opt-out, on until the user opts out. */
  shareAnonymizedData: boolean;
};

/**
 * An account the user can sign in with (V2 §7.1's OAuth, linked through Cognito). V2 names Google
 * and Apple; the Connected accounts mockup draws Google, so that is the one there is.
 */
export type ConnectedProvider = 'google';

/** One linkable sign-in account, and whether it is linked. */
export type ConnectedAccount = {
  provider: ConnectedProvider;
  connected: boolean;
  /** ISO-8601; when it was linked. */
  connectedAt?: string;
};
