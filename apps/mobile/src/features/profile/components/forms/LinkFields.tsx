import { LINK_KIND_LABEL } from '@/data/models';
import { SelectField } from '@/ui/SelectField';
import { TextField, useFieldChain } from '@/ui/TextField';

import { linkIcon } from '../../entryRows';
import type { LinkDraft } from '../../profileForms';
import { PROFILE_ROW_ART } from '../../profileRowArt';
import { SectionCard } from '../cards';

export type LinkFieldsProps = {
  draft: LinkDraft;
  patch: (part: Partial<LinkDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickKind: () => void;
  /** The kind list is up. */
  kindOpen?: boolean;
};

/**
 * One link on the profile (V2 §7.3, PROFILE 13 577:9404). Typing "linkedin.com/in/george" is
 * enough — the address is normalised to an https one on save, because everything downstream opens
 * it rather than reads it.
 *
 * V2 §6.2: there is no supported LinkedIn API, so a LinkedIn link here is an address to open, not
 * an import. The helper under the field says so rather than implying otherwise.
 */
export function LinkFields({ draft, patch, errors, blur, onPickKind, kindOpen }: LinkFieldsProps) {
  const link = useFieldChain(2);
  return (
    <SectionCard art={PROFILE_ROW_ART.links} title="Link">
      <SelectField
        label="Kind"
        icon={linkIcon(draft.kind)}
        value={LINK_KIND_LABEL[draft.kind]}
        hint="Opens the list of link types"
        open={kindOpen}
        onPress={onPickKind}
      />
      <TextField
        {...link(0)}
        label="Name"
        icon="Tag01"
        value={draft.label}
        onChangeText={(label) => patch({ label })}
        onBlur={() => blur('label')}
        placeholder="What to call this link"
        error={errors.label}
        autoCapitalize="words"
      />
      <TextField
        {...link(1)}
        label="Web address"
        icon="Globe02"
        value={draft.url}
        onChangeText={(url) => patch({ url })}
        onBlur={() => blur('url')}
        placeholder="yoursite.com"
        helper="We open this link; nothing is imported from it."
        error={errors.url}
        keyboardType="url"
        autoCapitalize="none"
        autoComplete="url"
      />
    </SectionCard>
  );
}
