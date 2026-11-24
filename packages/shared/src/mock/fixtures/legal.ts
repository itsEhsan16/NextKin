import { LEGAL_DOCS } from '../../legal';
import type { LegalDoc, LegalDocKey } from '../../models/support';

/**
 * NextKin V2 spec §8.5: the two documents that must be readable in-product, not only on the web.
 * The mock serves the real published text (`src/legal`, version 2; toreview §264), so the apps
 * read the same words the server seeds.
 */
export const legalFixture: Record<LegalDocKey, LegalDoc> = LEGAL_DOCS;
