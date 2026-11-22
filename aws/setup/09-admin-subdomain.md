# The admin portal on admin.app.nextkin.ai

Today the admin portal is a path of the main app: `https://app.nextkin.ai/admin`, with staff
signing in at `/admin/sign-in`. This moves it to its own address, `https://admin.app.nextkin.ai`.
`nextkin.ai` stays the landing page and `app.nextkin.ai` stays the main app.

## Why there are only two steps, and the first is a check

`app.nextkin.ai` is already delegated from Namecheap to a Route 53 zone that the deployment code
owns (`aws/infra/src/domain.ts`, toreview §165). `admin.app.nextkin.ai` is a name **inside** that
zone, so:

- Nothing new is added at Namecheap. The delegation only has to be complete. On 2026-11-04 only two
  of the four NS records had been added (toreview §165). **Checked 2026-11-20:** Namecheap's own
  nameserver now answers with all four, so step 1 is already done. Keep it as the check to repeat if
  DNS ever changes.
- The certificate, the DNS records and the CloudFront alias are all made by the deployment code in
  AWS. Nothing is clicked by hand in the AWS console.

## Step 1 · Domain: check the delegation at Namecheap (Claude in Chrome)

```text
Check the DNS delegation for app.nextkin.ai at Namecheap. Use my Namecheap session as it is already
signed in. Do not sign out, and change nothing except what step 3 says.

1. Open https://ap.www.namecheap.com/domains/list/ and choose "Manage" next to nextkin.ai.
2. Open the "Advanced DNS" tab. Find the host records of type NS whose host is "app".
   The four that must be there, each with host "app":
     ns-1746.awsdns-26.co.uk
     ns-607.awsdns-11.net
     ns-363.awsdns-45.com
     ns-1331.awsdns-38.org
   (A trailing dot on a value is fine.)
3. If any of the four is missing, add it: "Add new record" → type "NS Record", Host "app", the
   nameserver as the value, TTL Automatic, then the tick to save. Add only the missing ones.
4. Do not change, delete or add anything else: not the nameservers for nextkin.ai itself, not the
   email forwarding (MX / mail settings), not any record for "@", "www" or other hosts. Do not add a
   record for "admin" or "admin.app" — that name is served from AWS, not from Namecheap.
5. Tell me which of the four were already there and which (if any) you added.
```

Then check from any terminal (the answer should list all four `awsdns` servers; after an addition
it can take up to an hour):

```bash
nslookup -type=NS app.nextkin.ai 8.8.8.8
```

## Step 2 · AWS and the app: build and deploy (Claude Code)

**Built 2026-11-20 (toreview §249):** `adminDomain` in `aws/infra/cdk.json`, the host routing in `apps/web/proxy.ts`, and `ADMIN_ORIGIN` on the server. What's left is the deploy. The prompt below is kept as the record of what was asked.

Give this to Claude Code in this repository:

```text
Move the admin portal to its own address, https://admin.app.nextkin.ai, on the NextkinDemo stack.
Read aws/setup/09-admin-subdomain.md, aws/infra/README.md, aws/infra/src/{domain,edge,demoStack,
services,runtime}.ts, apps/web/proxy.ts, apps/web/src/lib/dataSource.ts and
packages/server/src/http/routes/authStaff.ts first. Facts: AWS account 962942593570, us-east-1,
CLI profile `nextkin`; the app.nextkin.ai Route 53 zone is owned by the stack (AppDomain), and
admin.app.nextkin.ai sits inside it, so no Namecheap change is needed. Work on a new branch off
main, commit nothing to main, and ask me before deploying.

1. Infrastructure (aws/infra):
   - A cdk.json context value "adminDomain": "admin.app.nextkin.ai", read in bin/app.ts and passed
     to the stack next to appDomain. Off when absent, so nothing changes until it is set.
   - The ACM certificate in AppDomain covers both names (subjectAlternativeNames), validated by DNS
     in the same zone. A changed certificate is a replacement: make sure the distribution moves to
     the new one in the same deploy and the old one is only deleted after.
   - The CloudFront distribution in edge.ts lists both names in domainNames.
   - A and AAAA alias records for "admin" in the app.nextkin.ai zone, pointing at the distribution
     (extend AppDomain.pointAt or add a sibling).
   - The admin origin is trusted by the server: add https://admin.app.nextkin.ai to the origins the
     web and worker containers get (APP_EXTRA_ORIGINS today, which APP_ENV=dev allows), and to the
     browser-upload CORS list (data.allowBrowserUploads). Prefer a dedicated ADMIN_ORIGIN setting
     in packages/server config if APP_EXTRA_ORIGINS would be refused in staging/production, and
     trust it in trustedOrigins.
   - Output "AdminUrl".
2. The web app (apps/web/proxy.ts):
   - Read the request's Host (CloudFront forwards it; check which header reaches the container,
     host or x-forwarded-host, and test with both).
   - On admin.app.nextkin.ai: "/" goes to /admin (redirect), every /admin/* page is served as now,
     and any other page path (the user app, /sign-in, /jobs…) redirects to /admin. The API
     (/api/v1/*) and static assets are untouched.
   - On app.nextkin.ai: /admin and /admin/* redirect (308) to the same path on
     https://admin.app.nextkin.ai, so old links keep working and staff sessions only ever live on
     the admin host. Keep it switchable by an env var (NEXT_PUBLIC_ADMIN_HOST or a server-only
     ADMIN_HOST) so local development and the cloudfront.net address keep serving /admin as today.
   - The session cookie is __Host- and host-only, so a staff session on the admin host and a user
     session on the app host stay separate. Confirm the staff sign-in, TOTP and temporary-password
     flows set and read their cookie on the admin host.
3. Server: anything that builds a link to the admin portal (staff invites, temporary-password
   emails, audit links) uses the admin origin when it is set. grep for "/admin/sign-in" and
   appOrigin in packages/server.
4. Tests: proxy host routing (admin host, app host, unset), the trusted-origin list, and a cdk synth
   that shows both names on the certificate and the distribution and the two alias records.
   Run the web, server unit and infra checks.
5. Record it in toreview.md as the next § and in aws/infra/README.md, then show me the cdk diff and
   wait for my yes before `pnpm --filter @nextkin/infra cdk deploy --profile nextkin`.
6. After the deploy, verify: https://admin.app.nextkin.ai shows the staff sign-in;
   https://app.nextkin.ai/admin redirects there; https://app.nextkin.ai still serves the user app;
   /api/v1/health on both hosts is 200; the certificate in the browser lists both names.
```

## After both steps

- Staff sign in at `https://admin.app.nextkin.ai`. Their old bookmarks under `app.nextkin.ai/admin`
  redirect there.
- A staff member signed in on the old address signs in once more on the new one, because a session
  cookie belongs to one host.
- Optional, later: restrict the admin host further, with a WAF rule or CloudFront function that only
  allows the office or VPN addresses. The server already checks Settings › Access for staff routes.
