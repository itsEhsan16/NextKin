import type { LegalDoc, LegalDocKey } from '../../models/support';

import { daysAgo } from './time';

/**
 * NextKin V2 spec §8.5 — the two documents that must be readable in-product, not only on the web.
 *
 * Written in plain English on purpose: §8.5 asks for terms a person can actually act on, and the
 * rights it names (GDPR for the EU and UK, the Australian Privacy Act, and the same access and
 * deletion rights extended to everyone else) are the ones the Settings rows already implement —
 * "Export my data" and "Delete account" are these paragraphs made real.
 *
 * This is placeholder copy for a mock data layer, not reviewed legal text. It says what the
 * product actually does; a lawyer replaces it before launch.
 */

const TERMS: LegalDoc = {
  key: 'terms',
  title: 'Terms of service',
  updatedAt: daysAgo(48),
  url: 'https://nextkin.ai/legal/terms',
  intro:
    'These terms cover what you can expect from NextKin and what we expect from you. They are written to be read, not to be skipped.',
  sections: [
    {
      id: 'terms_what',
      heading: 'What NextKin does',
      body: 'NextKin helps you write, tailor and check job application documents. We generate drafts from the information you give us and score them against our own published rubric.\n\nWe do not apply to jobs on your behalf, and we do not promise an interview, a shortlisting or a job. Anyone who does is guessing.',
    },
    {
      id: 'terms_account',
      heading: 'Your account',
      body: 'You need an account, you must be old enough to work in your country, and the details you give us should be true — the whole product is built on your work history, so an invented one produces invented documents.\n\nKeep your sign-in to yourself. You are responsible for what happens under your account.',
    },
    {
      id: 'terms_content',
      heading: 'Your content stays yours',
      body: 'Your profile, your resumes and your cover letters belong to you. You give us permission to store and process them so the app can do its job, and nothing more.\n\nWe do not train models on your documents, and we do not sell them or share them with advertisers. You can export everything or delete all of it at any time.',
    },
    {
      id: 'terms_ai',
      heading: 'What the AI writes, and what it cannot know',
      body: 'Generated text is a draft. It is built from what you told us plus the job description you gave us, and it can be wrong — a date misread, an emphasis you would not have chosen, a claim that reads stronger than you meant.\n\nRead it before you send it. Where we assumed something rather than knew it, we mark it and hold the download until you confirm it. You are the one signing your name to the document.',
    },
    {
      id: 'terms_fair',
      heading: 'Fair use',
      body: 'Plan limits are published in the app and on the pricing page, and where a plan says "unlimited" there is a fair-use figure published beside it. You will not hit a cap we did not tell you about.\n\nDo not use NextKin to impersonate someone else, to fabricate qualifications, or to send bulk automated applications. Those get accounts closed.',
    },
    {
      id: 'terms_billing',
      heading: 'Paying and cancelling',
      body: 'Paid plans are billed on the NextKin website and a receipt goes to your email. Prices are shown before you pay, including the period you are actually charged over.\n\nYou can cancel any time and keep your plan until the period you have paid for ends. We do not run trials that turn into charges.',
    },
    {
      id: 'terms_ending',
      heading: 'Ending the agreement',
      body: 'You can close your account whenever you like, from Profile → Settings. We may close an account that breaks these terms, and we will tell you why.\n\nIf we change these terms in a way that matters, we will say so in the app before the change takes effect rather than quietly updating this page.',
    },
  ],
};

const PRIVACY: LegalDoc = {
  key: 'privacy',
  title: 'Privacy policy',
  updatedAt: daysAgo(48),
  url: 'https://nextkin.ai/legal/privacy',
  intro:
    'This explains what we hold about you, why we hold it, and how to get it back or get rid of it. The short version: your documents are yours, and the app is the only thing reading them.',
  sections: [
    {
      id: 'privacy_what',
      heading: 'What we hold',
      body: 'Your account details (name, email and, if you add one, a photo). Your career profile — roles, education, certifications, skills, links and the preferences that drive job matching. The documents you upload and the ones we generate, including their version history. And a record of what you did in the app: generations, exports, saved jobs and applications.',
    },
    {
      id: 'privacy_why',
      heading: 'Why we hold it',
      body: 'To generate your documents, to score them, to match you to jobs, and to show you your own history. That is the whole list.\n\nWe do not sell your data. We do not share it with advertisers. We do not train models on your resumes.',
    },
    {
      id: 'privacy_rights',
      heading: 'Your rights over it',
      body: 'You can see it, correct it, take a copy of it, and have it deleted. In the app: Profile → Settings → Export my data hands you an archive, and Delete account removes everything permanently.\n\nIf you are in the EU or the UK, these are your rights under the GDPR — access, rectification, erasure, restriction, portability and objection. If you are in Australia, they are your rights under the Australian Privacy Act and the Australian Privacy Principles. We extend the same rights to everyone else, because running two standards would mean treating some people worse on purpose.',
    },
    {
      id: 'privacy_where',
      heading: 'Where it lives and who touches it',
      body: 'Your data is stored with our cloud provider and encrypted in transit and at rest. Generation runs through a model provider under a contract that forbids using your content to train their models.\n\nA small number of our staff can access account data when they need to fix something you have reported. That access is logged.',
    },
    {
      id: 'privacy_keep',
      heading: 'How long we keep it',
      body: 'While your account is open, and for a short wind-down period after you close it so an accidental deletion can be undone — after that it is gone from our systems and from our backups on their normal cycle.\n\nA data export you have downloaded is on your device, not ours. The download link we give you expires.',
    },
    {
      id: 'privacy_contact',
      heading: 'Asking us about any of this',
      body: 'Profile → Support → Contact us reaches the same people who would answer a privacy request, and we reply within 2 business days.\n\nIf you are not happy with how we have handled something, you can complain to your local data protection authority — the ICO in the UK, your national authority in the EU, or the OAIC in Australia.',
    },
  ],
};

export const legalFixture: Record<LegalDocKey, LegalDoc> = { terms: TERMS, privacy: PRIVACY };
