import { themeFor, typography, type TypographyRole } from '@/theme';

import { naturalLineHeight } from '../../testSupport/fontMetrics';

/**
 * Leading against the metrics of the font that actually renders it.
 *
 * The onboarding board is set in DM Sans and Montserrat, neither of which is loaded; both map
 * onto Plus Jakarta Sans, whose ascent and descent are taller. So the board's own leading — as
 * tight as 1.0x the font size on the two wordmarks and the step counter — is not enough room for
 * the glyphs that end up in the box, and React Native clips what does not fit rather than
 * growing the line. That is what cut the tops off "you ahead.", "Sign in" and "Continue with
 * Google" on the first device pass.
 *
 * `naturalLineHeight` is (ascender - descender + lineGap) from the shipped TTF, which is the
 * least a line can be without clipping. Every role has to clear it at every width.
 */
const roles = Object.entries(typography) as [TypographyRole, (typeof typography)[TypographyRole]][];
const authRoles = roles.filter(([, role]) => role.singleBoard).map(([name]) => name);

describe('the onboarding board leading', () => {
  it('has roles to check', () => {
    expect(authRoles.length).toBeGreaterThanOrEqual(15);
  });

  it.each([320, 360, 390, 412, 520])('clears the font metrics at %ipx', (width) => {
    const { typography: at } = themeFor('light', width);
    for (const name of authRoles) {
      const role = at[name];
      // Rounded to the half-pixel the ramp already rounds leading to, so a rounding artefact
      // cannot fail a role that is otherwise exactly on the floor.
      expect(role.lineHeight ?? 0).toBeGreaterThanOrEqual(
        Math.floor(naturalLineHeight(role) * 2) / 2,
      );
    }
  });
});
