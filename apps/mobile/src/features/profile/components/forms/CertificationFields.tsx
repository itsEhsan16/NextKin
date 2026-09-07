import { View } from 'react-native';

import { useTheme } from '@/theme';
import { RowGroup } from '@/ui/ListRow';
import { TextField } from '@/ui/TextField';

import type { CertificationDraft } from '../../profileForms';
import { DateFieldRow, FieldError } from './DateFieldRow';

export type CertificationDateField = 'issuedOn' | 'expiresOn';

export type CertificationFieldsProps = {
  draft: CertificationDraft;
  patch: (part: Partial<CertificationDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickDate: (field: CertificationDateField) => void;
};

/** One credential on the profile (V2 §7.3). */
export function CertificationFields({
  draft,
  patch,
  errors,
  blur,
  onPickDate,
}: CertificationFieldsProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      <TextField
        label="Certification"
        value={draft.name}
        onChangeText={(name) => patch({ name })}
        onBlur={() => blur('name')}
        placeholder="What it is called"
        error={errors.name}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <TextField
        label="Issued by"
        value={draft.issuer}
        onChangeText={(issuer) => patch({ issuer })}
        onBlur={() => blur('issuer')}
        placeholder="Who awarded it"
        error={errors.issuer}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <View style={{ gap: spacing[2] }}>
        <RowGroup title="DATES">
          <DateFieldRow
            label="Issued"
            value={draft.issuedOn}
            onPress={() => onPickDate('issuedOn')}
          />
          <DateFieldRow
            label="Expires"
            value={draft.expiresOn}
            emptyValue="Doesn't expire"
            onPress={() => onPickDate('expiresOn')}
          />
        </RowGroup>
        <FieldError message={errors.expiresOn} />
      </View>

      <TextField
        label="Credential link"
        value={draft.credentialUrl}
        onChangeText={(credentialUrl) => patch({ credentialUrl })}
        onBlur={() => blur('credentialUrl')}
        placeholder="Optional"
        error={errors.credentialUrl}
        keyboardType="url"
        autoCapitalize="none"
        returnKeyType="done"
      />
    </View>
  );
}
