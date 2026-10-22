import {
  formatAmount,
  parseAmount,
  timeZoneLabel,
  withChosen,
} from '@/features/settings/preferencesLibrary';

describe('preferencesLibrary', () => {
  it('groups rupees in lakhs, as the board prints them, and the rest in thousands', () => {
    expect(formatAmount(1_200_000, 'INR')).toBe('12,00,000');
    expect(formatAmount(1_200_000, 'USD')).toBe('1,200,000');
  });

  it('reads whatever digits were typed, and nothing as no minimum', () => {
    expect(parseAmount('12,00,000')).toBe(1_200_000);
    expect(parseAmount(' ₹ 15 00 000 ')).toBe(1_500_000);
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('none')).toBeUndefined();
  });

  it('offers a chosen value the list lacks, after the list', () => {
    expect(withChosen(['A', 'B'], ['B', 'Z'])).toEqual(['A', 'B', 'Z']);
  });

  it('names a zone it knows, and falls back to the id for one it does not', () => {
    expect(timeZoneLabel('Asia/Kolkata')).toBe('(GMT+05:30) India Standard Time - Bengaluru');
    expect(timeZoneLabel('Europe/Paris')).toBe('Europe/Paris');
  });
});
