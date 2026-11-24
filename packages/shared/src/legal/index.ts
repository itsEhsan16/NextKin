import type { LegalDoc, LegalDocKey } from '../models/support';

import { PRIVACY_POLICY } from './privacy';
import { TERMS_OF_SERVICE } from './terms';

export { LEGAL_CONTACT, LEGAL_EFFECTIVE, LEGAL_ENTITY } from './constants';
export { PRIVACY_POLICY } from './privacy';
export { TERMS_OF_SERVICE } from './terms';

/** The current published text of each legal document: what the seed stores as version 2. */
export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
};

/** The schema version the seed writes these texts as (version 1 was the placeholder copy). */
export const LEGAL_VERSION = 2;
