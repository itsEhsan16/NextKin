# Security incident

**Owner role:** Security lead · **IC:** declared for every suspected exposure

A suspected breach, data exposure, account takeover at scale, abuse of AI or paid features, or a
leaked secret. When in doubt, declare it; closing a false alarm costs little.

## First hour

1. **Declare.** Name the IC and the Security lead, open a private channel, and start a timeline.
   Every action gets a UTC timestamp. Do not discuss it in public channels.
2. **Preserve evidence before changing anything you can avoid changing.** Export the audit log
   (`GET /api/v1/admin/audit/export`), the `security_events` rows, and the relevant logs and traces
   for the window. In the cloud, snapshot the affected resources.
3. **Contain.** Take the smallest action that stops the harm:
   - A user account: `POST /admin/users/{id}/suspend`, which ends every session.
   - A leaked secret: [Key rotation](key-rotation.md), revoking first.
   - A feature being abused: its kill switch (`features.<name>.enabled = false`).
   - An admin account: remove its roles (`PUT /admin/staff/{id}/roles`), then end its sessions.
   - Every session (a signing key leaked): see Key rotation, "Ending every session".
   - Abuse from an IP range: rate limits locally; WAF rules in the cloud (X-09).
4. **Scope.** Which users, which data, which window? The audit log records every admin action and
   every staff content read with its reason. Logs carry no personal data (X.1), so identify users
   by id.

## Notify

The Security lead decides, with legal advice, within the deadlines that apply:
- GDPR: the supervisory authority within 72 hours of becoming aware of a personal-data breach;
  affected users without undue delay when the risk is high.
- Australian Privacy Act (Notifiable Data Breaches): assess within 30 days; notify the OAIC and
  the individuals for an eligible breach.
- US state laws (CCPA and others): as each requires.
- The client (V2 §17), as the contract requires.

Record the decision and its basis even when the answer is "no notification needed".

## Recover and review

- Fix the cause. Add a test or a drill that would have caught it, and a row in
  [`aws/security/threat-model.md`](../security/threat-model.md).
- Restore anything damaged ([Restore](restore.md)), then lift containment step by step.
- Write a blameless review within five working days.

## Never

- Never copy user data out of production to investigate. Query in place, with the read-only role
  and a recorded reason.
- Never paste secrets, tokens or personal data into tickets, chat or AI tools.
