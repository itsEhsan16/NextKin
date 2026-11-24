import type { LegalDoc } from '../models/support';

import { LEGAL_CONTACT, LEGAL_EFFECTIVE, LEGAL_ENTITY } from './constants';

/**
 * The privacy policy, version 2 (owner, 2026-11-25; toreview §264). Every claim here is something
 * the code does today, checked against it: the processors in the server config, the retention
 * constants, the AI contact guard (`packages/server/src/ai/pii.ts`), the export and deletion flow
 * (`services/privacy.ts`). Change the code and this text together. Not yet reviewed by counsel.
 */
export const PRIVACY_POLICY: LegalDoc = {
  key: 'privacy',
  title: 'Privacy policy',
  updatedAt: LEGAL_EFFECTIVE,
  url: 'https://app.nextkin.ai/legal/privacy',
  intro: `This policy explains what NextKin holds about you, why, who helps us run it, how long we keep it, and how to get a copy or have it deleted. The short version: your documents are yours, we never sell your data, and we never use it to train AI models.`,
  sections: [
    {
      id: 'privacy_who',
      heading: 'Who we are',
      body: `NextKin is run by ${LEGAL_ENTITY}, a company registered in the United States. We are the data controller for the personal data described here, on nextkin.ai, app.nextkin.ai and in the NextKin mobile app.\n\nFor anything in this policy, write to ${LEGAL_CONTACT}.`,
    },
    {
      id: 'privacy_collect',
      heading: 'What we collect',
      body: `Account details: your name and email address. If you sign in with Google, Google tells us your name, email address, whether that address is verified, and your profile picture. We ask Google for nothing else.\n\nYour career information: the profile you build (roles, education, certifications, skills, links, job preferences), the resumes and files you upload, the documents we generate for you and their versions, the job descriptions you paste, and the job links you give us. When you give us a link, our server fetches that page to read the job description.\n\nUsage of the app: what you did (for example, generated a resume or saved a job), with the time, your device type and app version, plus security records such as sign-ins and the IP address they came from. On the mobile app, crash reports describe what went wrong on your device.\n\nWe do not ask for your photo, date of birth, marital status, nationality or other details a resume does not need.`,
    },
    {
      id: 'privacy_use',
      heading: 'How we use it, and our legal basis',
      body: `To provide the service you signed up for: building, tailoring, scoring and exporting your documents, matching you with jobs, tracking your applications, and keeping your account secure. Under the GDPR, our basis is the contract between us.\n\nTo understand and improve the product, through usage records kept on our own servers, never shared with an analytics or advertising company. Our basis is our legitimate interest. You can switch this off at any time with "Share anonymized data" in Settings, and from then on nothing is recorded.\n\nTo email you about your account (sign-in codes, receipts, and replies to support requests). Product updates only go out if you turn them on in your notification settings, which is consent you can withdraw at any time.\n\nWe do not sell your personal data, share it for advertising, or make decisions about you that have legal or similarly significant effects by automated means.`,
    },
    {
      id: 'privacy_ai',
      heading: 'How the AI uses your information',
      body: `Our AI features run on Claude, a model made by Anthropic. When you ask for a resume, a cover letter, a score or an answer from the assistant, we send the model the parts of your profile and documents that the task needs, together with the job description.\n\nYour contact details are never sent to the model. Your name, email, phone number, address and profile links are removed before any request leaves our server and are added back only into the finished document. A check in our code refuses any request that still contains them.\n\nThe model provider processes these requests only to return an answer to us. Your data is not used to train AI models, ours or anyone else's.`,
    },
    {
      id: 'privacy_google',
      heading: 'Information from Google',
      body: `If you choose "Continue with Google", we receive only your basic profile: name, email address, email verification status and profile picture (the openid, email and profile scopes). We use it only to create your account and sign you in. We do not read your Gmail, Drive, Calendar or contacts, and we do not ask for permission to.\n\nNextKin's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell this information, use it for advertising, or let people read it except to keep the service secure or where the law requires it.`,
    },
    {
      id: 'privacy_share',
      heading: 'Who we share it with',
      body: `Only with the companies that run parts of NextKin for us, under contracts that limit them to doing that job:\n\n• Amazon Web Services: hosting, databases, file storage, backups, email delivery and mobile notifications.\n• Clerk: sign-up and sign-in, including signing in with Google.\n• Anthropic, reached through Amazon Web Services or through OpenRouter: the AI features described above.\n• Sentry: crash reports from the mobile app.\n• Google and Apple: delivering push notifications to your phone, if you turn them on.\n• Stripe: payments, when paid plans are offered. Your card details go to Stripe directly and never reach our servers.\n\nWe also disclose information when the law requires it, to protect people from harm, or as part of a merger or sale of the business, in which case this policy continues to apply to your data.`,
    },
    {
      id: 'privacy_where',
      heading: 'Where your data is kept',
      body: `Your data is stored in the United States, in Amazon Web Services data centres in the us-east-1 region, with backup copies in us-west-2. If you are in the European Economic Area, the United Kingdom or Switzerland, we transfer your data to the United States under the European Commission's Standard Contractual Clauses, or the EU-US Data Privacy Framework where a provider is certified under it.`,
    },
    {
      id: 'privacy_keep',
      heading: 'How long we keep it',
      body: `While your account is open, we keep your profile and documents until you delete them. On top of that:\n\n• Documents you move to Trash are deleted for good after 30 days.\n• Data export archives are deleted after 7 days. Each download link lasts 15 minutes.\n• Notifications are kept for 90 days.\n• Usage records are kept for 13 months.\n• Server logs are kept for up to 90 days and never hold your documents.\n• Backups are kept for up to 35 days, then overwritten.\n\nWhen you delete your account, sign-in stops at once, every session ends, and your account is removed from our sign-in provider. Your data is then permanently deleted from our live systems within 30 days. It disappears from backups as they expire, and we never restore a deleted account from a backup. We keep records of payments for as long as tax law requires.`,
    },
    {
      id: 'privacy_rights',
      heading: 'Your rights',
      body: `You can see, correct, download and delete your data, and you can do most of it yourself. In Settings, "Export my data" gives you an archive of everything we hold about you, and "Delete account" removes it.\n\nIf you are in the EU, the UK or Switzerland, the GDPR gives you the rights of access, rectification, erasure, restriction, data portability and objection, and the right to withdraw consent. If you are in California, the CCPA/CPRA gives you the rights to know, delete and correct your information and to not be discriminated against for using them; we do not sell or share personal information as those laws define it. If you are in Australia, the Australian Privacy Act and its Australian Privacy Principles give you access and correction rights. We give the same rights to everyone, wherever they live.\n\nFor anything you cannot do in the app, write to ${LEGAL_CONTACT}. We answer within 30 days and may need to confirm it is really you first. You can also complain to your local data protection authority, such as your national authority in the EU, the ICO in the UK or the OAIC in Australia.`,
    },
    {
      id: 'privacy_cookies',
      heading: 'Cookies',
      body: `We use only the cookies the service needs to work: a secure cookie that keeps you signed in, and cookies our sign-in provider Clerk sets to protect sign-in from bots and fraud. We use no advertising cookies and no third-party analytics cookies, so there is nothing to opt out of.`,
    },
    {
      id: 'privacy_children',
      heading: 'Age',
      body: `NextKin is for people aged 16 and over. We do not knowingly collect data from anyone younger. If you believe a child has given us their data, write to ${LEGAL_CONTACT} and we will delete it.`,
    },
    {
      id: 'privacy_security',
      heading: 'Keeping it safe',
      body: `Data is encrypted in transit and at rest. Each account's data is separated at the database level, so one account cannot read another's. Staff access is limited to the people who need it, requires a second factor, and is logged. No system is perfectly secure; if a breach affects your data, we will tell you and the authorities as the law requires.`,
    },
    {
      id: 'privacy_changes',
      heading: 'Changes to this policy',
      body: `When we change this policy, we update the date at the top. If the change matters (a new use of your data or a new kind of company we share it with), we tell you in the app or by email before it takes effect.`,
    },
    {
      id: 'privacy_contact',
      heading: 'Contact',
      body: `${LEGAL_ENTITY}, NextKin. Email ${LEGAL_CONTACT}. You can also use Contact us in the Help section of the app.`,
    },
  ],
};
