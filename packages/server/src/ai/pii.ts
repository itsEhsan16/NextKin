// The patterns live in the shared package, so anything that builds model text redacts the same way.
import { EMAIL, isPhone, PHONE, redactContact } from '@nextkin/shared/privacy/contact';

/**
 * PII minimisation (ImBackendImplementationPlan P6-12, G5). No stage input carries a contact field:
 * name, email, phone, street address and links are merged into the document at render time and
 * never sent to a model provider.
 *
 * Two guards. At compile time, `StageInput<T>` refuses a type with a contact key anywhere in it.
 * At run time, `assertNoContact` refuses a payload with a contact key or anything that looks like an
 * email address or a phone number, before the call is made.
 */

export const CONTACT_KEYS = ['email', 'phone', 'address', 'street', 'postcode', 'postalCode', 'zip', 'firstName', 'lastName', 'fullName', 'linkedin', 'links'] as const;
type ContactKey = (typeof CONTACT_KEYS)[number];

/** `never` when T (deeply) has a contact key; T otherwise. */
export type StageInput<T> = HasContact<T> extends true ? never : T;
type HasContact<T> = T extends readonly (infer U)[]
  ? HasContact<U>
  : T extends object
    ? Extract<keyof T, ContactKey> extends never
      ? true extends { [K in keyof T]: HasContact<T[K]> }[keyof T]
        ? true
        : false
      : true
    : false;

export { redactContact };

export class ContactDataError extends Error {
  constructor(readonly where: string) {
    super(`a stage input holds contact data at ${where}`);
    this.name = 'ContactDataError';
  }
}

export function assertNoContact(value: unknown, path = 'input'): void {
  if (typeof value === 'string') {
    if (EMAIL.test(value)) throw new ContactDataError(`${path} (an email address)`);
    if ((value.match(PHONE) ?? []).some(isPhone)) throw new ContactDataError(`${path} (a phone number)`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoContact(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((CONTACT_KEYS as readonly string[]).includes(key)) throw new ContactDataError(`${path}.${key}`);
      assertNoContact(item, `${path}.${key}`);
    }
  }
}
