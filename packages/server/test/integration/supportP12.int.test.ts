import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createSmtpEmail } from '../../src/email/email';
import { getLegal, listFaq, submitTicket } from '../../src/services/support';
import { createUser, deleteUsers, log } from './fixtures/pipeline';

/**
 * Support (ImBackendImplementationPlan P12-13): the published FAQ and legal documents, and a ticket
 * that reaches the support inbox (Mailpit locally) carrying its request id.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const MAILPIT = 'http://127.0.0.1:8025';

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 2 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

describe('support (P12-13)', () => {
  it('serves the published FAQ and legal documents', async () => {
    const faq = await listFaq(db);
    expect(faq.length).toBeGreaterThan(3);
    const terms = await getLegal(db, 'terms');
    expect(terms).toMatchObject({ key: 'terms' });
    expect(terms.sections.length).toBeGreaterThan(0);
  });

  it('a ticket reaches the support inbox with its request id', async () => {
    const userId = await createUser(db, users);
    const requestId = `req-${Date.now()}`;
    const ticket = await submitTicket({ db, email: createSmtpEmail(config.SMTP_URL, config.EMAIL_FROM), inbox: config.SUPPORT_INBOX, log }, { userId, role: 'user' }, { topic: 'bug', message: 'The export button does nothing.' }, requestId);
    expect(ticket.topic).toBe('bug');
    let found: { ID: string; Subject: string } | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      const res = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(ticket.id)}`)).json()) as { messages: { ID: string; Subject: string }[] };
      found = res.messages[0];
      if (!found) await new Promise((r) => setTimeout(r, 250));
    }
    expect(found?.Subject).toContain(ticket.id);
    const body = (await (await fetch(`${MAILPIT}/api/v1/message/${found!.ID}`)).json()) as { Text: string; To: { Address: string }[] };
    expect(body.To[0]!.Address).toBe(config.SUPPORT_INBOX);
    expect(body.Text).toContain(`Request id: ${requestId}`);
  });
});
