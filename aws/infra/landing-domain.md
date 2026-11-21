# nextkin.ai: the landing page on the bare domain

The landing page (`apps/web/app/landing`) answers on `nextkin.ai` and `www.nextkin.ai`. The domain's
DNS stays at Namecheap (it carries the email forwarding), so three pieces meet here:

| Step | Who | What |
|---|---|---|
| 1 | Claude Code (CLI) | ACM certificate for `nextkin.ai` + `www.nextkin.ai`, us-east-1, DNS validation. **Done 2026-11-21:** `arn:aws:acm:us-east-1:962942593570:certificate/52d9cec3-3bfb-4aab-9b96-41dd2431a5f8` |
| 2 | Claude in Chrome, prompt A below | The two validation CNAMEs at Namecheap. **Done 2026-11-21; the certificate is ISSUED** |
| 3 | Claude Code | `landingDomains` + `landingCertificateArn` in `cdk.json`, then `cdk deploy`. It creates the `LandingCdn` distribution and sets `LANDING_HOST` / `APP_HOST` on the web service. **Done 2026-11-21: `LandingCdnDomain` = `dp76rlk4ir1mh.cloudfront.net`** |
| 4 | Claude in Chrome, prompt B below | `@` ALIAS and `www` CNAME at Namecheap, both pointing to `LandingCdnDomain` |
| 5 | Claude Code | Checks `https://nextkin.ai` serves the landing page and app paths move to `app.nextkin.ai` |

What must never change at Namecheap: the nameservers (`dns1/dns2.registrar-servers.com`), the
five `eforward*` MX records, the SPF TXT record, the email forwarding, and the four `app` NS records
that delegate `app.nextkin.ai` to Route 53.

Today (2026-11-21, public DNS): `@` has no A/AAAA/ALIAS record and `www` has nothing, so nothing needs
removing. If Namecheap's own "parking page" or a URL-redirect record shows for `@` or `www` in the
list, it is the only thing to remove.

---

## Prompt A: certificate validation records (now)

```text
You are working in my Namecheap account in Chrome to add two DNS records for my domain nextkin.ai.
These records only prove to AWS that I own the domain so it can issue an HTTPS certificate. They do
not change where the website or email goes.

Before you start:
- Go to https://ap.www.namecheap.com/domains/list/ . If Namecheap asks me to sign in or for a
  2-factor code, stop and tell me; I will sign in myself. Never type a password or code.
- Do not buy, renew, or add anything. Close or decline any upsell, popup or offer.

Steps:
1. In the Domain List, find nextkin.ai and click "Manage".
2. Open the "Advanced DNS" tab.
3. Before changing anything, read the whole "HOST RECORDS" table and the "MAIL SETTINGS" section and
   write down every record you see (type, host, value, TTL). Report this list to me at the end.
4. Confirm the "NAMESERVERS" on the Domain tab say "Namecheap BasicDNS" (dns1/dns2.registrar-servers.com).
   If they say anything else, stop and tell me; do not continue.
5. In HOST RECORDS, click "ADD NEW RECORD" and add this record exactly:
   - Type: CNAME Record
   - Host: _a07f2fa1296039e35fdf13fef3741bf5
   - Value: _9ea5cd756d47dde4cffd2c9093138cd2.wzccmgtwzk.acm-validations.aws.
   - TTL: Automatic
   Then click the green check mark on that row to save it.
6. Click "ADD NEW RECORD" again and add the second record exactly:
   - Type: CNAME Record
   - Host: _0a68b1eab7c24e537a31e5db8e8df083.www
   - Value: _7fd5acd15fbcefc3a645e75263bf6b5c.wzccmgtwzk.acm-validations.aws.
   - TTL: Automatic
   Then click the green check mark on that row to save it.
   Notes on both: Namecheap adds ".nextkin.ai" to the Host by itself, so type the Host exactly as
   above and do not add ".nextkin.ai". Keep the trailing dot on the Value if the field accepts it;
   if Namecheap rejects it, remove only the final dot.
7. Wait for the green "saved" confirmation for each row, then reload the page and check that both
   records appear with exactly the Host and Value above (copy them character by character).

Do NOT, under any circumstances:
- change, delete or edit any existing record, including the MX records (eforward1..5), the TXT
  record starting with "v=spf1", or the four NS records with Host "app";
- change the nameservers, "Mail Settings" or the email forwarding;
- add any A, AAAA, ALIAS, URL Redirect or other record besides the two CNAMEs above.

When finished, report: (a) the full list of records you found before changing anything, (b) the two
records as they now appear after the reload, (c) anything that looked different from what I
described.
```

---

## Prompt B: point nextkin.ai at the landing page (after step 3)

The value is the deploy's `LandingCdnDomain` output: `dp76rlk4ir1mh.cloudfront.net` (2026-11-21).

```text
You are working in my Namecheap account in Chrome to point my domain nextkin.ai and www.nextkin.ai
at my website. Email for nextkin.ai must keep working exactly as it does now.

Before you start:
- Go to https://ap.www.namecheap.com/domains/list/ . If Namecheap asks me to sign in or for a
  2-factor code, stop and tell me; I will sign in myself. Never type a password or code.
- Do not buy, renew, or add anything. Close or decline any upsell, popup or offer.

Steps:
1. In the Domain List, find nextkin.ai, click "Manage", and open the "Advanced DNS" tab.
2. Read the whole "HOST RECORDS" table and write down every record (type, host, value, TTL).
3. Check whether any record already uses Host "@" or Host "www" with type A, AAAA, ALIAS, CNAME or
   URL Redirect (for example a Namecheap parking page). If there is one, stop and tell me what it
   is before removing anything; do not remove it on your own.
4. Click "ADD NEW RECORD" and add:
   - Type: ALIAS Record
   - Host: @
   - Value: dp76rlk4ir1mh.cloudfront.net
   - TTL: 5 min
   Click the green check mark to save.
5. Click "ADD NEW RECORD" and add:
   - Type: CNAME Record
   - Host: www
   - Value: dp76rlk4ir1mh.cloudfront.net
   - TTL: 5 min
   Click the green check mark to save.
6. Reload the page and check both records appear with exactly these values.

Do NOT, under any circumstances:
- change, delete or edit any existing record, including the MX records (eforward1..5), the TXT
  record starting with "v=spf1", the two CNAME records whose Host starts with "_" (certificate
  validation, keep them forever), or the four NS records with Host "app";
- change the nameservers, "Mail Settings" or the email forwarding.

When finished, report: (a) the records you found before changing anything, (b) the two new records
as they appear after the reload, (c) anything unexpected.
```
