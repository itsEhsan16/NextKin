import type { FaqItem } from '@/data/models/support';

/**
 * NextKin V2 spec §7.14 — the help content the FAQ screen searches and filters.
 *
 * Written in the product's own voice and, deliberately, in its own limits: the answers about the
 * score repeat §7.8's honesty note rather than softening it, the one about LinkedIn says there is
 * no API rather than promising a date (§6.2), and the billing answers quote the published caps
 * from §13.3 instead of "generous" or "plenty". An FAQ is where a product is most tempted to
 * oversell, so these are the same claims the screens make.
 */
export const faqFixture: readonly FaqItem[] = [
  {
    id: 'faq_start',
    topic: 'getting_started',
    question: 'What do I need before NextKin is useful?',
    answer:
      'One resume, or five minutes with the Zero Resume draft. Everything the app generates is built from your profile and the job description you give it, so the more of your work history is in there, the less you will have to correct afterwards.',
  },
  {
    id: 'faq_upload',
    topic: 'getting_started',
    question: 'Can I bring a resume I already have?',
    answer:
      'Yes — upload a PDF, DOCX or TXT and we will read your roles, education and skills out of it. You then choose row by row what goes onto your profile; nothing is added until you say so, and skipping that step leaves your profile exactly as it was.',
  },
  {
    id: 'faq_linkedin',
    topic: 'getting_started',
    question: 'Why can I not import from LinkedIn?',
    answer:
      'LinkedIn has no public API that lets an app pull your profile, so we cannot offer it honestly. Exporting your LinkedIn profile to PDF and uploading that file gets you the same result today.',
  },
  {
    id: 'faq_score',
    topic: 'resumes',
    question: 'What does the ATS score actually measure?',
    answer:
      "It measures your document against NextKin's own published rubric — keyword match, timeline validity, section completeness, formatting and quantified achievements — and nothing else. It is not a prediction of how any particular employer's software will read, rank or filter your application. Every system parses differently, and no tool can honestly promise a result in one.",
  },
  {
    id: 'faq_score_move',
    topic: 'resumes',
    question: 'How do I raise my score?',
    answer:
      'Open the score and work down the quick wins — each one names the section it changes and applies in a tap. Closing a required-skill gap moves the number more than anything else on the page. A keyword your profile does not back is shown as a gap and never written in for you.',
  },
  {
    id: 'faq_tailor',
    topic: 'resumes',
    question: 'What does tailoring change?',
    answer:
      'Your summary and the emphasis inside your experience bullets, against the job description you paste in. Your history is not rewritten: dates, employers and titles come from your profile and stay as you entered them.',
  },
  {
    id: 'faq_export',
    topic: 'resumes',
    question: 'Which formats can I download?',
    answer:
      'PDF and plain text on every plan, always clean and never watermarked. DOCX is a Pro format. On a phone, DOCX is saved as text — a real DOCX needs a desktop, and we would rather say so than hand you a file that will not open.',
  },
  {
    id: 'faq_versions',
    topic: 'resumes',
    question: 'Can I get an earlier draft back?',
    answer:
      'Every edit saves a new version rather than overwriting the last one, so nothing you have written is lost. Free keeps the last 3 versions of a document and Pro keeps the last 20.',
  },
  {
    id: 'faq_match',
    topic: 'jobs',
    question: 'How is the match percentage worked out?',
    answer:
      'We compare the role against your profile — skills, years, location and the seniority the listing asks for — and show you every criterion behind the number. It is an indicative profile match, not a prediction of whether you will be shortlisted.',
  },
  {
    id: 'faq_apply',
    topic: 'jobs',
    question: 'Does NextKin apply to jobs for me?',
    answer:
      'No. We prepare the documents and track what you have sent; the application itself is yours to submit. Automated bulk applying is against the terms of most job boards and it does not work.',
  },
  {
    id: 'faq_quota',
    topic: 'billing',
    question: 'What do I get on the free plan?',
    answer:
      '3 resume generations a month, 1 cover letter, 3 standalone ATS checks, 3 starter templates, up to 10 saved jobs, the last 3 versions of each document, and unlimited clean PDF and TXT export. Every cap is published — you will never hit a limit we did not tell you about.',
  },
  {
    id: 'faq_billing_where',
    topic: 'billing',
    question: 'Where do I pay, and how do I cancel?',
    answer:
      'Billing runs on the NextKin website and the receipt arrives by email. You can cancel any time from your account there; nothing auto-renews after a trial, because we do not run trials that auto-renew.',
  },
  {
    id: 'faq_data',
    topic: 'account',
    question: 'Can I get a copy of my data, or delete it?',
    answer:
      'Both, from Profile → Settings. An export builds an archive of your profile, documents and application history and hands you a download. Deleting your account removes all of it permanently — that one cannot be undone.',
  },
  {
    id: 'faq_training',
    topic: 'account',
    question: 'Do you train models on my resume?',
    answer:
      'No. Your documents and profile are used to generate your own material and nothing else. They are not used to train models and are not sold or shared with advertisers.',
  },
];
