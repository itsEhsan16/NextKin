import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogueModule, fixtureCatalogue } from '../seed/jobFixtures';

/** Regenerates src/jobs/fixtures/catalogue.ts from the apps' board fixtures (P11-01). */
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../jobs/fixtures/catalogue.ts');
const listings = fixtureCatalogue();
writeFileSync(target, catalogueModule(listings));
console.log(`wrote ${listings.length} fixture listings to ${target}`);
