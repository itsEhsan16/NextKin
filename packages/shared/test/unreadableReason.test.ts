import { describe, expect, it } from 'vitest';

import { isUnreadableFileError, readStalledReason, unreadableReason } from '../src/queries/useResumeExports';
import { ApiError } from '../src/repos/http/client';

/** Why a resume could not be read, said in the server's words when the file was not at fault (owner, 2026-11-25). */
describe('the reason a resume could not be read', () => {
  const failed = (reason: string | null, message = 'We couldn’t make sense of this file as a resume.') => new ApiError('UNREADABLE_FILE', message, 422, { reason });

  it('is the server’s own line when the reading failed on our side', () => {
    expect(unreadableReason(failed('unclear'))).toBe('We couldn’t make sense of this file as a resume.');
    expect(unreadableReason(failed('timed_out', 'Reading this resume took too long and was stopped. Upload it again.'))).toContain('took too long');
  });

  it('is left to the screen for a file with no text, or an error that gives no reason', () => {
    expect(unreadableReason(failed('unreadable'))).toBeNull();
    expect(unreadableReason(failed(null))).toBeNull();
    expect(unreadableReason(new ApiError('UNREADABLE_FILE', 'x', 422))).toBeNull();
    expect(unreadableReason(new ApiError('UNAVAILABLE', 'x', 503, { reason: 'provider' }))).toBeNull();
    expect(unreadableReason(new Error('boom'))).toBeNull();
    expect(isUnreadableFileError(failed('unclear'))).toBe(true);
  });

  it('is the server’s line too when the reading took too long or could not be reached', () => {
    const stalled = new ApiError('UNAVAILABLE', 'This is taking longer than it should. Try again in a moment.', 503);
    expect(readStalledReason(stalled)).toBe('This is taking longer than it should. Try again in a moment.');
    expect(readStalledReason(failed('unclear'))).toBeNull();
    expect(readStalledReason(new Error('boom'))).toBeNull();
  });
});
