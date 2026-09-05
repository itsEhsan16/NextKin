import { StringListEditor } from './StringListEditor';
import type { SectionFieldsProps } from './types';

/** V2 §7.11 — certifications are a plain string list, so they take the skills shape exactly. */
export function CertificationsEditor(props: SectionFieldsProps<string[]>) {
  return <StringListEditor {...props} noun="certification" label="Certifications" />;
}
