import { View } from 'react-native';

import { LINK_KIND_LABEL, type LinkKind } from '@/data/models';
import { useTheme } from '@/theme';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { TextField } from '@/ui/TextField';

import type { LinkDraft } from '../../profileForms';

/**
 * The row glyph per kind. Solid glyphs rather than the brand marks: `ListRow` draws the FA5 Free
 * Solid set, and a brand name handed to it renders as nothing at all.
 */
export const LINK_KIND_ICON: Record<LinkKind, string> = {
  portfolio: 'briefcase',
  linkedin: 'id-badge',
  github: 'code-branch',
  website: 'globe',
  other: 'link',
};

export type LinkFieldsProps = {
  draft: LinkDraft;
  patch: (part: Partial<LinkDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickKind: () => void;
};

/**
 * One link on the profile (V2 §7.3). Typing "linkedin.com/in/george" is enough — the address is
 * normalised to an https one on save, because everything downstream opens it rather than reads it.
 *
 * V2 §6.2: there is no supported LinkedIn API, so a LinkedIn link here is an address to open, not
 * an import. The helper under the field says so rather than implying otherwise.
 */
export function LinkFields({ draft, patch, errors, blur, onPickKind }: LinkFieldsProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      <RowGroup title="TYPE">
        <ListRow
          icon={LINK_KIND_ICON[draft.kind]}
          label="Kind"
          value={LINK_KIND_LABEL[draft.kind]}
          accessibilityLabel={`Kind, ${LINK_KIND_LABEL[draft.kind]}`}
          accessibilityHint="Opens the list of link types"
          onPress={onPickKind}
        />
      </RowGroup>

      <TextField
        label="Name"
        value={draft.label}
        onChangeText={(label) => patch({ label })}
        onBlur={() => blur('label')}
        placeholder="What to call this link"
        error={errors.label}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <TextField
        label="Web address"
        value={draft.url}
        onChangeText={(url) => patch({ url })}
        onBlur={() => blur('url')}
        placeholder="yoursite.com"
        helper="We open this link; nothing is imported from it."
        error={errors.url}
        keyboardType="url"
        autoCapitalize="none"
        autoComplete="url"
        returnKeyType="done"
      />
    </View>
  );
}
