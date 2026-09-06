import { SUPPORT_MESSAGE_MAX } from '@/data/models';
import {
  contactTopic,
  CONTACT_MESSAGE_BLANK,
  CONTACT_MESSAGE_LONG,
  CONTACT_MESSAGE_MIN,
  CONTACT_MESSAGE_SHORT,
  validateContactMessage,
} from '@/features/support/contactForm';

describe('contactTopic (V2 §7.14)', () => {
  it('keeps a topic the help screen carried through', () => {
    expect(contactTopic('billing')).toBe('billing');
    expect(contactTopic('bug')).toBe('bug');
  });

  it('ignores anything that is not a published topic', () => {
    // A URL is not a type: a deep link can put any string in the query, so an unknown one opens
    // on "A question" rather than being trusted and cast.
    expect(contactTopic('refund')).toBe('question');
    expect(contactTopic('')).toBe('question');
    expect(contactTopic('__proto__')).toBe('question');
  });

  it('falls back when nothing was passed at all', () => {
    expect(contactTopic(undefined)).toBe('question');
  });
});

describe('validateContactMessage (V2 §7.14)', () => {
  it('refuses an empty field and says what is missing', () => {
    const verdict = validateContactMessage('');
    expect(verdict).toEqual({ ok: false, error: CONTACT_MESSAGE_BLANK });
  });

  it('treats whitespace as no message at all', () => {
    // A field full of newlines would otherwise clear a plain length check.
    expect(validateContactMessage('   \n\n  \t ')).toEqual({
      ok: false,
      error: CONTACT_MESSAGE_BLANK,
    });
  });

  it('asks for more than a few words', () => {
    expect(validateContactMessage('help')).toEqual({ ok: false, error: CONTACT_MESSAGE_SHORT });
    expect(validateContactMessage('a'.repeat(CONTACT_MESSAGE_MIN - 1))).toEqual({
      ok: false,
      error: CONTACT_MESSAGE_SHORT,
    });
  });

  it('accepts a real message and hands back the trimmed text', () => {
    const verdict = validateContactMessage('  The export button did nothing.  ');
    expect(verdict).toEqual({ ok: true, message: 'The export button did nothing.' });
  });

  it('counts the trimmed length, not the padding around it', () => {
    // Padded out past the minimum, but there is still only "help" to act on.
    expect(validateContactMessage(`     help     `)).toEqual({
      ok: false,
      error: CONTACT_MESSAGE_SHORT,
    });
  });

  it('refuses a paste that arrives past the published maximum', () => {
    expect(validateContactMessage('x'.repeat(SUPPORT_MESSAGE_MAX + 1))).toEqual({
      ok: false,
      error: CONTACT_MESSAGE_LONG,
    });
    expect(validateContactMessage('x'.repeat(SUPPORT_MESSAGE_MAX)).ok).toBe(true);
  });
});
