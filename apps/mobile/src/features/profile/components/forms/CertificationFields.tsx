import { TextField, useFieldChain } from '@/ui/TextField';

import type { CertificationDraft } from '../../profileForms';
import { PROFILE_ROW_ART } from '../../profileRowArt';
import { SectionCard } from '../cards';
import { DateField, FieldError } from './DateFieldRow';

export type CertificationDateField = 'issuedOn' | 'expiresOn';

export type CertificationFieldsProps = {
  draft: CertificationDraft;
  patch: (part: Partial<CertificationDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickDate: (field: CertificationDateField) => void;
  /** The date whose picker is up, if one is. */
  picking?: CertificationDateField | null;
};

/**
 * One credential on the profile (V2 §7.3, PROFILE 11 577:8527): Name and issuer, Dates, and the
 * credential link.
 */
export function CertificationFields({
  draft,
  patch,
  errors,
  blur,
  onPickDate,
  picking,
}: CertificationFieldsProps) {
  const link = useFieldChain(3);
  return (
    <>
      <SectionCard art={PROFILE_ROW_ART.certifications} title="Name and issuer">
        <TextField
          {...link(0)}
          label="Certification"
          icon="Award01"
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          onBlur={() => blur('name')}
          placeholder="What it is called"
          error={errors.name}
          autoCapitalize="words"
        />
        <TextField
          {...link(1)}
          label="Issued by"
          icon="Building02"
          value={draft.issuer}
          onChangeText={(issuer) => patch({ issuer })}
          onBlur={() => blur('issuer')}
          placeholder="Who awarded it"
          error={errors.issuer}
          autoCapitalize="words"
        />
      </SectionCard>

      <SectionCard
        art={PROFILE_ROW_ART.availability}
        artWidth={26}
        title="Dates"
        subtitle="Month and year are enough"
      >
        <DateField
          label="Issued"
          value={draft.issuedOn}
          open={picking === 'issuedOn'}
          onPress={() => onPickDate('issuedOn')}
        />
        <DateField
          label="Expires"
          value={draft.expiresOn}
          emptyValue="Doesn't expire"
          open={picking === 'expiresOn'}
          onPress={() => onPickDate('expiresOn')}
        />
        <FieldError message={errors.expiresOn} />
      </SectionCard>

      <SectionCard art={PROFILE_ROW_ART.links} title="Credential link">
        <TextField
          accessibilityLabel="Credential link"
          icon="Link01"
          value={draft.credentialUrl}
          onChangeText={(credentialUrl) => patch({ credentialUrl })}
          onBlur={() => blur('credentialUrl')}
          placeholder="Optional"
          error={errors.credentialUrl}
          keyboardType="url"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </SectionCard>
    </>
  );
}
