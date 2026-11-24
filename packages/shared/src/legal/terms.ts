import type { LegalDoc } from '../models/support';

import { LEGAL_CONTACT, LEGAL_EFFECTIVE, LEGAL_ENTITY } from './constants';

/**
 * The terms of service, version 2 (owner, 2026-11-25; toreview §264). Built on what the product
 * does: D-25 (the candidate decides what goes into their resume; the accuracy confirmation before
 * download), V2 §7.8 (the ATS score is our own rubric), the 14-day withdrawal in
 * `services/billing.ts`. Maryland law, with consumers' mandatory local rights kept. Not yet
 * reviewed by counsel.
 */
export const TERMS_OF_SERVICE: LegalDoc = {
  key: 'terms',
  title: 'Terms of service',
  updatedAt: LEGAL_EFFECTIVE,
  url: 'https://app.nextkin.ai/legal/terms',
  intro: `These terms are the agreement between you and ${LEGAL_ENTITY} ("NextKin", "we", "us") for using nextkin.ai, app.nextkin.ai and the NextKin mobile app. By creating an account or using NextKin, you accept them. They are written to be read, so please read them.`,
  sections: [
    {
      id: 'terms_service',
      heading: 'What NextKin does',
      body: `NextKin helps you write, tailor and check job application documents: resumes, cover letters and interview preparation. It builds drafts from the information you give us and the job descriptions you choose, and scores them against our own published rubric.\n\nThe "ATS score" is NextKin's own measure of how well a document matches a job description. It is not a result from any employer's applicant tracking system, and no third-party system has endorsed it.\n\nWe do not apply to jobs for you, and we do not promise interviews, shortlisting or a job.`,
    },
    {
      id: 'terms_account',
      heading: 'Your account',
      body: `You must be at least 16 years old and allowed to make this agreement where you live. One person per account. You can sign up with your email address or with Google; sign-in is provided by our partner Clerk.\n\nKeep your sign-in details to yourself, and tell us at ${LEGAL_CONTACT} if you think someone else has used your account. You are responsible for what happens under it.`,
    },
    {
      id: 'terms_content',
      heading: 'Your content stays yours',
      body: `Your profile, your uploads and the documents NextKin generates for you belong to you. You give us a limited permission to store, process and display them, only to run the service for you and to keep it secure. That permission ends when you delete the content or your account, apart from backups that expire on their own schedule.\n\nWe do not use your content to train AI models, and we do not sell it. How we handle personal data is set out in our Privacy policy.`,
    },
    {
      id: 'terms_ai',
      heading: 'AI suggestions, and your decisions',
      body: `To help your resume reach the top score for a job, NextKin suggests keywords, skills and measured results. Nothing is added until you accept it. What you accept is written in; what you leave out is never written.\n\nWhether an accepted suggestion is true of you is your decision and your responsibility. Before you download a document, we ask you to confirm that it is accurate. Only send employers what you can stand behind. NextKin never invents an employer, school, degree, date, past job title or certificate; those come only from your own information.\n\nAI output can be wrong. Read every document before you use it.`,
    },
    {
      id: 'terms_use',
      heading: 'Using NextKin fairly',
      body: `Do not use NextKin to:\n\n• impersonate someone or apply using another person's identity;\n• create fake qualifications, references or documents meant to deceive;\n• send bulk automated applications, or scrape, copy or resell the service;\n• upload anything unlawful, or anything you have no right to share;\n• probe, overload or work around our security, plan limits or usage caps.\n\nPlan limits are shown in the app. Where a plan says "unlimited", a fair-use figure is published beside it.`,
    },
    {
      id: 'terms_paying',
      heading: 'Paid plans',
      body: `NextKin has a free plan. When paid plans are offered, the price, what it includes and how often you are charged are shown before you pay. Payments are handled by Stripe. Subscriptions renew until you cancel them.\n\nYou can cancel at any time in Settings and keep your plan until the end of the period you have paid for. If you are a consumer in the EU or the UK, you may also withdraw within 14 days of your first payment and get a refund; you can do this in Settings or by writing to us. Other refunds are given where the law requires them.\n\nIf we change a price, we tell you before your next renewal, and you can cancel before it applies.`,
    },
    {
      id: 'terms_links',
      heading: 'Job listings and links',
      body: `When you give NextKin a link to a job, our server reads that page for you. Job listings and other websites belong to their owners. We are not responsible for their content, their accuracy, or what happens when you apply through them.`,
    },
    {
      id: 'terms_ours',
      heading: 'Our service and brand',
      body: `NextKin's software, design, templates, scoring rubric and brand belong to ${LEGAL_ENTITY}. You may use them to prepare your own job applications. You may not copy, modify, resell or reverse-engineer the service, except where the law allows it.`,
    },
    {
      id: 'terms_warranty',
      heading: 'What we cannot promise',
      body: `We work hard to keep NextKin accurate, secure and available, but we provide it "as is" and "as available". As far as the law allows, we make no other promises: for example, that it will never be interrupted, that it is free of errors, or that any document will lead to a particular result.\n\nNothing in these terms limits rights you have as a consumer that cannot be limited by contract.`,
    },
    {
      id: 'terms_liability',
      heading: 'Limits on liability',
      body: `As far as the law allows, ${LEGAL_ENTITY} is not liable for indirect or consequential losses, such as lost opportunities, lost earnings or lost data, arising from your use of NextKin. Our total liability to you for any claim is limited to the greater of what you paid us in the 12 months before the claim and 100 US dollars.\n\nThese limits do not apply to liability that cannot be limited by law, such as for death or personal injury caused by negligence, or for fraud.`,
    },
    {
      id: 'terms_ending',
      heading: 'Ending the agreement',
      body: `You can close your account at any time with "Delete account" in Settings. Your data is then deleted as our Privacy policy describes.\n\nWe may suspend or close an account that seriously or repeatedly breaks these terms, or where the law requires it. Unless the law or safety prevents it, we tell you why and give you a chance to export your data first. If we ever stop offering NextKin, we give at least 30 days' notice.`,
    },
    {
      id: 'terms_changes',
      heading: 'Changes to these terms',
      body: `When we change these terms, we update the date at the top. If a change matters to you, we tell you in the app or by email at least 30 days before it takes effect. If you do not agree, you can close your account before then.`,
    },
    {
      id: 'terms_law',
      heading: 'Law and disputes',
      body: `These terms are governed by the laws of the State of Maryland, USA, and disputes go to the courts of Maryland. If you are a consumer living elsewhere, you keep the protection of the mandatory laws of your country, and you may also bring a claim in your local courts.\n\nIf any part of these terms cannot be enforced, the rest still applies. Please contact us first; most problems can be solved by an email.`,
    },
    {
      id: 'terms_contact',
      heading: 'Contact',
      body: `${LEGAL_ENTITY}, NextKin. Email ${LEGAL_CONTACT}.`,
    },
  ],
};
