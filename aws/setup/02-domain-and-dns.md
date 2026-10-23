# 1 · Domain and DNS

**Owner: client** (it needs a payment method) · **Time: under an hour** · **Status: not started — no
domain chosen**

Do this first. It is the cheapest item in the whole setup and it is blocking the longest clock.

## Why this is first

Four things cannot even *begin* until a domain exists:

```
domain
  ├─▶ SES sending identity          (verification and billing email)
  ├─▶ Cognito custom domain          (auth.<domain> — so sign-in looks like ours)
  ├─▶ ACM certificates               (TLS at the edge)
  └─▶ Google OAuth consent screen    ◀── 1–4 WEEKS, and also needs a published privacy policy
```

That last one is the reason for the urgency. Google reviews the consent screen before it will show
your branding. Until it passes, **every new user who clicks "Sign in with Google" sees a warning
screen** telling them the app is unverified. That is a conversion problem, not a technical one, and it
is not something you can ship around.

The review takes one to four weeks and cannot be started without a domain. Buying the domain today
turns that into four weeks that overlap with development. Buying it in two months turns it into four
weeks added to the end of the project.

## Steps

### 1. Choose the name

Check before buying:

- Available as `.com` — the primary market is the US
- Not trademarked in the US, Germany or Australia (the three launch markets)
- Reads correctly to a German speaker; no accidental meaning
- Short enough to type on a phone

Record the choice in `doc/decisions/register.md` as **D-09** with the date and who approved it.

### 2. Register it

Either registrar works:

- **Route 53 directly** — simplest, one bill, no delegation step
- **An external registrar** — then delegate to Route 53 (below)

Enable **auto-renew** and **domain privacy/WHOIS protection** immediately. A resume product whose
domain lapses is an outage that no amount of engineering prevents.

### 3. Create the hosted zone and delegate

If registered outside Route 53:

1. Create a public hosted zone for the domain in Route 53
2. Copy the four nameservers Route 53 gives you
3. Set them as the domain's nameservers at the registrar
4. Wait for propagation — usually minutes, occasionally up to 48 hours

Verify from a terminal:

```bash
dig +short NS <domain>          # should return the four Route 53 nameservers
```

### 4. Create an A record on the parent domain

The Cognito custom domain requires an existing A record on the parent domain before it will accept
`auth.<domain>`. This trips people up because the error message does not say so.

A placeholder pointing anywhere is fine at this stage — it is replaced when CloudFront exists.

### 5. Plan the subdomains

Decide these now, because certificates and cookie scope both depend on the answer:

| Name | Purpose | Notes |
|---|---|---|
| `<domain>` | The application, the API, the public pages, admin | The specification puts all of these behind **one** distribution |
| `auth.<domain>` | Cognito custom domain | Needs a certificate in `us-east-1` |
| `mail.<domain>` | SES sending subdomain | Kept separate so a deliverability problem cannot damage the root domain's reputation |

> **Open decision (D-08).** Whether the authenticated app lives at the root or at `app.<domain>`. The
> specification (§9.1, §9.5, §9.9) puts marketing, public pages, the app, `/admin/*` and `/api/v1/*`
> in one deployable behind one distribution — so the root is the default. A separate `app.` subdomain
> splits that, and changes session-cookie scope. **Decide before the edge stack is written.**

## Done when

```bash
dig +short NS <domain>        # returns four Route 53 nameservers
dig +short A <domain>         # returns something (a placeholder is fine)
```

- [ ] Domain registered, auto-renew on, WHOIS privacy on
- [ ] Route 53 public hosted zone exists and is authoritative
- [ ] A record present on the parent domain
- [ ] Subdomain plan agreed, and D-08 decided
- [ ] Recorded as D-09 in the decision register

## Next

[Step 2 — external filings](03-external-filings.md). The Google review can start as soon as there is a
domain and a privacy policy URL.
