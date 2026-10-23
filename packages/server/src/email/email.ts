import nodemailer from 'nodemailer';

/**
 * EmailPort (ImBackendImplementationPlan §1.5). Locally SMTP to Mailpit, where every message is
 * caught and readable at http://127.0.0.1:8025; in AWS the SES adapter (X-08). Templates are plain
 * text so they render the same everywhere and never carry tracking.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

export function createSmtpEmail(smtpUrl: string, from: string): EmailPort {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(message) {
      await transport.sendMail({ from, to: message.to, subject: message.subject, text: message.text });
    },
  };
}

/** Unit tests: keeps every message in memory. */
export function createMemoryEmail(): EmailPort & { sent: EmailMessage[]; lastTo(to: string): EmailMessage | undefined } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
    lastTo(to) {
      return [...sent].reverse().find((m) => m.to.toLowerCase() === to.toLowerCase());
    },
  };
}

/** Pulls the 6-digit code out of a verification or reset email (tests and local tooling). */
export function codeFrom(message: EmailMessage | undefined): string | undefined {
  return message?.text.match(/\b(\d{6})\b/)?.[1];
}
