import { describe, expect, it } from 'vitest';

import { blockedSiteNotice, sharedJobOf } from '../src/models/jobLink';

describe('sharedJobOf', () => {
  it('takes a bare link', () => {
    expect(sharedJobOf('https://jobs.lever.co/acme/123')).toEqual({ source: 'link', url: 'https://jobs.lever.co/acme/123' });
  });

  it('finds the link in an app’s wrapping, without its punctuation', () => {
    expect(sharedJobOf('Check out this job at Stripe: https://www.linkedin.com/jobs/view/1.')).toEqual({ source: 'link', url: 'https://www.linkedin.com/jobs/view/1' });
  });

  it('takes a long share as the job itself, even with a link in it', () => {
    const job = `Senior Designer at Stripe. ${'You will lead design work across our payments products. '.repeat(5)} https://stripe.com/jobs/1`;
    expect(sharedJobOf(job)).toEqual({ source: 'paste', text: job });
  });

  it('turns down what can’t be a job', () => {
    expect(sharedJobOf('look at this')).toBeNull();
    expect(sharedJobOf('   ')).toBeNull();
    expect(sharedJobOf(null)).toBeNull();
  });
});

describe('blockedSiteNotice', () => {
  it('names the sites we know refuse', () => {
    expect(blockedSiteNotice('https://www.linkedin.com/jobs/view/1')).toBe('LinkedIn doesn’t let us read its pages. Copy the job text and paste it here.');
    expect(blockedSiteNotice('https://in.indeed.com/viewjob?jk=1')).toContain('Indeed');
    expect(blockedSiteNotice('https://www.naukri.com/job-listings-1')).toContain('Naukri');
  });

  it('leaves anything else to the server’s own words', () => {
    expect(blockedSiteNotice('https://jobs.lever.co/acme/1')).toBeNull();
  });
});
