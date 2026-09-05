import { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import { FormsSheetDemos } from '@/dev';
import { useTheme } from '@/theme';
import {
  Disclosure,
  IconButton,
  Screen,
  ScreenHeader,
  SheetRow,
  StickyActionBar,
  Text,
  TextField,
} from '@/ui';
import { DevButton, DevSection } from '@/ui/dev';

const EMAIL_ERROR = 'Enter an address we can reach you on.';

/**
 * Gallery page for the form primitives Phase 9A added, so they can be pressed on a device before
 * Phase 9B builds a screen out of them.
 *
 * The page is itself the demo for the two new `Screen` props: `keyboard` lifts it on iOS, and the
 * `footer` bar below rides up with the keyboard instead of being covered by it.
 */
export default function DevFormsRoute() {
  const { colors, radii, sizes, spacing } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [about, setAbout] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [aboutRole, setAboutRole] = useState(false);
  const [rubric, setRubric] = useState(false);
  const emailRef = useRef<TextInput>(null);

  // ScreenHeader carries no gutter of its own — Screen frames it — so these boxes stand in for
  // the page edges, which is the only way to see that both slots are one back button wide.
  const box = {
    borderColor: colors.borderDefault,
    borderWidth: sizes.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  };

  return (
    <Screen
      keyboard
      scroll
      edges={[]}
      footer={
        <StickyActionBar
          primary={{ label: 'Save', onPress: () => {} }}
          secondary={{ label: 'Cancel', onPress: () => {} }}
          note="Focus a field: the bar rides the keyboard up instead of hiding under it."
        />
      }
    >
      <DevSection
        title="Text field"
        description="Submitting the name focuses the email — that is the whole chaining contract: returnKeyType 'next' plus a ref, and no focus state kept anywhere. The error button paints the danger border, swaps the helper line for the message and fires one warning haptic; the message is announced once per transition into error, never once per keystroke, so a screen reader does not talk over the fix being typed."
      >
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Ada Lovelace"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          onSubmit={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="ada@example.com"
          icon="envelope"
          helper="Only used for updates on your applications."
          error={invalid ? EMAIL_ERROR : undefined}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="done"
        />
        <TextField
          label="About you"
          value={about}
          onChangeText={setAbout}
          placeholder="Two lines on the work you are after."
          multiline
          maxLength={200}
          showCount
        />
        <DevButton
          label={invalid ? 'Clear the error' : 'Show an error'}
          active={invalid}
          onPress={() => setInvalid((current) => !current)}
          grow
        />
      </DevSection>

      <DevSection
        title="Screen header"
        description="'title' centres the name between two back-button-wide slots; 'page' leaves the row to the chevron and sets the name large underneath. A trailing action drops into the slot that otherwise only balances the back button, so the centred title stays on the screen's centre line."
      >
        <View style={box}>
          <ScreenHeader title="Add experience" onBack={() => {}} />
        </View>
        <View style={box}>
          <ScreenHeader
            title="Notification preferences"
            variant="page"
            onBack={() => {}}
            trailing={
              <IconButton
                icon="ellipsis-h"
                label="More options"
                variant="ghost"
                onPress={() => {}}
              />
            }
          />
        </View>
      </DevSection>

      <DevSection
        title="Disclosure"
        description="Controlled in both modes: the caller owns `expanded`, so an FAQ list that keeps one row open at a time has only one copy of that state. Nothing measures height — the body mounts and the container animates to fit."
      >
        <Disclosure
          title="About the role"
          expanded={aboutRole}
          onToggle={() => setAboutRole((current) => !current)}
        >
          <Text variant="prose" color="textSecondary">
            You will own a service end to end, from the schema to the dashboards that watch it, and
            sit with the two designers who draw the screens it feeds.
          </Text>
        </Disclosure>
        <Disclosure
          mode="row"
          title="What does this score measure?"
          expanded={rubric}
          onToggle={() => setRubric((current) => !current)}
        >
          <Text variant="prose" color="textSecondary">
            How well this resume answers this posting: the skills it names, the wording it shares
            with the description, and how readable its layout is to a parser.
          </Text>
        </Disclosure>
      </DevSection>

      <DevSection
        title="Sheet row"
        description="`locked` adds the Pro badge and the trailing lock, and folds 'Pro feature' into the row's own name so it stays one focus stop rather than three. The gate is shown, not enforced: the row still opens, and the caller routes it to upgrade."
      >
        <SheetRow
          icon="file-pdf"
          label="Export as PDF"
          description="Fixed layout, ready to attach."
          onPress={() => {}}
        />
        <SheetRow
          icon="file-word"
          label="Export as DOCX"
          description="Editable in Word and Google Docs."
          locked
          onPress={() => {}}
        />
      </DevSection>

      <FormsSheetDemos />
    </Screen>
  );
}
