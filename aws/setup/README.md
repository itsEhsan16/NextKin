# Setup

The ordered path from nothing to a working `dev` environment.

**Nothing is provisioned yet.** Work through these in order — each one unblocks the next, and two of
them start clocks that run for weeks.

## The order, and why it is this order

| # | Step | Who | Time | Blocks |
|---|---|---|---|---|
| **0** | [Verify the facts](06-verification.md) | Engineer | Half a day | Four of the eighteen checks change a design, not just a cost. Do this before building anything |
| **1** | [Domain and DNS](02-domain-and-dns.md) | **Client** | Hours | **Everything with a long lead time.** Cheapest item here, largest downstream cost if delayed |
| **2** | [External filings](03-external-filings.md) | **Client** | Days to file, 1–4 weeks to land | Google sign-in, email sending, payments |
| **3** | [Accounts and access](01-accounts-and-access.md) | Engineer + client | 2 days | Every AWS resource |
| **4** | [Local development](04-local-development.md) | Engineer | Half a day | Nothing — it needs no AWS, so start it in parallel with 1–3 |
| **5** | [First deployment](05-first-deployment.md) | Engineer | Days | The M0 exit gate |
| **6** | [Turning push on](07-push.md) | Client + engineer | Hours, once the Apple account exists | Push on any phone |

## Start the clocks first

Steps 1 and 2 are not engineering work — they are purchases and applications. They are listed first
because **they are the only items that cannot be compressed by adding people**:

- **Google sign-in approval takes 1 to 4 weeks.** Without it, every new user who clicks "Sign in with
  Google" sees a browser warning screen. It cannot start without a domain and a published privacy
  policy.
- **German VAT and Australian GST registration take weeks**, sometimes longer.
- **Email sending approval takes 2–3 days.** Until it lands, verification emails only reach addresses
  we have manually verified — so real sign-up cannot be tested end to end.

Everything else on this page can be done by working faster. These cannot. File them, then build while
they process.

## Decisions that must be made before you start

Some choices cannot be changed afterwards without rebuilding. They are called out where they apply,
but here they are in one place:

| Decision | Where | Why it is irreversible |
|---|---|---|
| The domain name | Step 1 | Every identity, certificate and email identity hangs off it |
| Account structure (separate `prod` / `nonprod`) | Step 3 | Retrofitting after real customer data exists is genuinely painful |
| The eight Cognito pool settings | Step 5 | **Cannot be changed after the pool is created.** Changing one means a new pool and migrating every user |
| The PostgreSQL major version | Step 0 | The local container, Aurora and every migration must agree |
| Region: `us-east-1` | — | Already decided. Moving later means rebuilding everything |

## How to know a step is done

Each page ends with a **Done when** section containing checks you can actually run, not a description
of what you were supposed to have done. If you cannot run the check, the step is not finished.

## If you only have one hour

Buy the domain ([step 1](02-domain-and-dns.md)). It costs about $15, takes ten minutes, and it is
currently the single thing holding up a four-week clock that four other items depend on.
