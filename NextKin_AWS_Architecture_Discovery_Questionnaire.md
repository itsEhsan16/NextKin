**NextKin Apply**

**AWS Architecture Discovery Questionnaire**

_Pre-Architecture Review for AWS Production Onboarding_

**Purpose: Close the business, scale, security, compliance, operational, and deployment questions that materially affect the AWS architecture before selecting AWS services or approving a production design.**

Context: The current NextKin Apply V1 specification is web-first and proposes Next.js/Vercel, Supabase PostgreSQL/Auth/Storage, Inngest for asynchronous AI workflows, Claude with OpenAI fallback, Adzuna + JSearch, and Razorpay/Stripe. If AWS is now a target or requirement, the architecture should be re-evaluated from requirements and constraints rather than performing a service-by-service lift-and-shift.

# A. Priority Questions - Required Before AWS Architecture Is Finalized

Please answer these first. These items can materially change the AWS account, Region, data, networking, identity, compute, resilience, and cost design.

**1\. What are the exact five launch countries?**

List all five countries. Also clarify whether "launch in five countries" means users are located there, infrastructure must run there, data must remain there, or the application is simply localized for those markets.

**2\. Why is AWS required or being considered?**

Is AWS mandatory because of company standards, customer requirements, AWS credits, security/compliance, enterprise networking, data residency, Bedrock, operational preference, or cost? Or should AWS be compared objectively with the current Vercel/Supabase design?

**3\. What is the current implementation status?**

Not started, prototype, active development, staging, beta, or production? If code exists, identify the repository structure and any strong dependencies on Vercel, Supabase, or Inngest.

**4\. What AWS foundation already exists?**

Do we already have an AWS Organization, accounts, Control Tower, IAM Identity Center, VPCs, Route 53, CloudTrail, GuardDuty, Security Hub, centralized logging, budgets, KMS standards, or GitHub/AWS integration?

**5\. What is the expected user and workload scale?**

Provide estimates for launch, 6 months, and 12 months: registered users, MAU/DAU, concurrent users, API traffic, resume generations, uploads, job searches, and AI assistant usage.

**6\. What are the data residency rules for user PII?**

Can resumes, candidate profiles, work-authorization/visa fields, chat history, generated documents, logs, backups, and AI-processing data leave the user's country or geographic region?

**7\. Is the product English-only or multilingual?**

Specify supported UI languages, resume languages, JD languages, AI-generation languages, and job-listing languages for launch.

**8\. What is the monthly operating budget?**

Provide separate ranges, if possible, for AWS infrastructure, AI/model usage, job APIs, payments, and observability/monitoring.

**9\. What is the target beta and production launch date?**

Include whether rollout is global/big-bang or country-by-country, and identify any immovable business dates.

**10\. Must the solution be AWS-native wherever practical?**

Can third-party managed services such as Vercel, Supabase, Inngest, direct Anthropic/OpenAI APIs, and external observability remain, or is the goal to replace them with AWS services where feasible?

# B. Detailed Architecture Discovery Questions

The following questions should be resolved during architecture discovery. Unknown values can be recorded as "TBD" and converted into explicit assumptions, risks, or launch constraints.

## 1\. Product Scope and Launch

- Which V1 capabilities are mandatory for production launch, and which can be deferred without blocking launch?
- Is native mobile explicitly out of V1, with responsive web/PWA as the launch experience?
- Is the Admin Portal part of the same production application/deployment or should it have stronger isolation?
- Will all five countries receive the same features on day one?
- Are there country-specific feature flags, legal notices, pricing, payment methods, job providers, or resume conventions?
- Who is the business owner authorized to approve scope cuts and architecture trade-offs?

## 2\. Traffic, Capacity, and Growth

- What are expected registered users, MAU, DAU, and peak concurrent sessions at launch, 6 months, and 12 months?
- What are average and peak API requests per second?
- How many resume/JD parsing jobs are expected per day and at peak?
- How many full resume-generation pipelines are expected per day and at peak per minute?
- What is the expected country-by-country traffic distribution?
- Are there predictable traffic spikes such as evenings, weekends, marketing campaigns, university recruiting cycles, or layoffs?
- What growth event would require 10x current capacity, and how quickly must the platform absorb it?

## 3\. Global Architecture and Data Residency

- Must application compute exist in each launch country, or is a smaller number of AWS Regions acceptable?
- Which data classes may be stored centrally, and which must remain country/region-local?
- Can backups and disaster-recovery copies cross national or regional boundaries?
- Can user content be sent to AI providers whose processing location differs from the user's location?
- Are cross-region database reads/writes required, or can each user have a home region?
- Is a single global account/profile expected if the user changes country?
- Are there legal requirements for data deletion, export, consent, or subprocessor disclosure by country?

## 4\. AWS Organization, Accounts, and Governance

- Who owns the AWS payer/management account?
- Should dev, staging, and production use separate AWS accounts?
- Are dedicated security/log-archive/shared-services accounts required?
- Who needs console access, CLI access, and production deployment access?
- Will IAM Identity Center/SSO be used? Which identity provider will back workforce access?
- What tagging standards are required for owner, environment, application, cost center, and data classification?
- What AWS budget thresholds and cost anomaly alerts are required?
- Are Service Control Policies, permission boundaries, or organization-wide guardrails required?

## 5\. Networking and Edge

- Does the application require private VPC networking for compute and databases?
- Are any workloads required to have no direct internet access?
- Which external systems require outbound internet access: AI providers, job APIs, payment providers, email, analytics?
- Is a fixed outbound IP required for allowlisting with any provider?
- Is AWS WAF required? What bot, rate-limit, geo, or abuse protections are expected?
- What domains/subdomains will be used for web, API, admin, assets, status, and email?
- Is CloudFront expected to serve all countries from a single global edge distribution?
- Are VPN, Direct Connect, enterprise private connectivity, or customer VPC integrations in scope?

## 6\. Application Runtime and Compute

- Can the Next.js application run as a container, or does it rely on Vercel-specific runtime features?
- Which routes require SSR, ISR, streaming, Server-Sent Events, WebSockets, or edge execution?
- What is the longest synchronous request duration expected?
- Which jobs require CPU/memory-heavy processing such as Chromium rendering or OCR?
- Do background workers need independent scaling from the web/API tier?
- Are there workloads that require GPU compute?
- What deployment model does the engineering team prefer operationally: serverless, containers, or a hybrid?
- What are acceptable cold-start and scale-out characteristics?

## 7\. Asynchronous AI Pipeline

- What is the exact production pipeline and which stages are independently retryable?
- What is the maximum expected duration for each stage?
- What is the required per-user concurrency cap?
- What retry policy, backoff, dead-letter handling, and idempotency behavior is required?
- Can stages run in parallel, or are all stages strictly sequential?
- What state must survive a worker/process/Region failure?
- How long can queued generation work wait before it should fail or alert?
- Which stages are safe to replay without creating duplicate billing, documents, or side effects?

## 8\. AI / LLM Strategy

- Will Claude remain primary and OpenAI fallback, or may Amazon Bedrock be evaluated?
- Which exact model families are required for extraction, classification, generation, validation, scoring, and assistant chat?
- What are typical and maximum input/output token counts for each AI stage?
- What are the free and paid user AI quotas?
- What provider rate limits or committed throughput arrangements already exist?
- Which PII fields are prohibited from model prompts?
- Are prompts/model outputs retained by providers, and are no-training/data-processing terms contractually confirmed?
- What is the fallback behavior when the primary AI provider is unavailable?
- How are prompt versions, model versions, token counts, latency, cost, and outcomes recorded?
- What quality/evaluation gate must a model or prompt pass before production?

## 9\. Database and Data Model

- What is the expected database size at launch and after one year?
- What are the expected largest/highest-growth tables?
- What is the read/write ratio and expected peak database connection count?
- Is PostgreSQL mandatory?
- Are full-text search, semantic/vector search, or embeddings required in V1?
- Will analytics queries run against the transactional database or a separate analytics store?
- Are organization/workspace fields needed from day one for future multi-tenancy?
- What consistency guarantees are required for generation status, quotas, subscriptions, and billing entitlements?
- What database migration tooling is currently used?
- What backup retention, point-in-time recovery, and restore-testing requirements exist?

## 10\. Authentication and Authorization

- Are there already registered users that must be migrated?
- Which login methods are required at launch: email/password, Google, Apple, magic link, OTP?
- Is MFA mandatory only for admins or also available/required for users?
- What roles exist at launch, and what future roles must the model accommodate?
- How are admin privileges granted/revoked and audited?
- Should authentication remain with Supabase Auth, or is migration to an AWS/native or other identity provider acceptable?
- How should sessions be revoked globally after security events?
- Are account linking, duplicate identities, or social-login email conflicts expected?

## 11\. File Storage, Uploads, and Document Security

- What is the average and maximum resume/JD upload size?
- Which file types are accepted?
- How long are original uploads, generated exports, and resume versions retained?
- How many versions per resume/user are expected?
- Should deleted documents have a recovery window before permanent deletion?
- Is malware/virus scanning required for every upload?
- Must document parsing execute inside an isolated/sandboxed environment?
- Should storage use per-user prefixes/buckets, and are separate anonymous-upload buckets required?
- Are legal hold or litigation retention requirements possible?
- What signed-URL lifetime is acceptable for upload and download?

## 12\. Parsing, OCR, and Document Rendering

- What OCR solution is currently selected, if any?
- What percentage of uploaded resumes are expected to be scanned/image PDFs?
- Which languages must OCR support?
- Are complex multi-column resumes, tables, graphics, or non-Latin scripts in scope?
- What parsing accuracy threshold is required before asking the user to correct extracted fields?
- Is headless Chromium the confirmed PDF-rendering strategy?
- What are expected PDF/DOCX export sizes and generation rates?
- Should document rendering be isolated from the primary web/API runtime?

## 13\. Job Aggregation

- Do Adzuna and JSearch provide sufficient coverage for all five launch countries?
- Are API keys/contracts already available for each provider?
- What are provider quotas, rate limits, attribution rules, caching/storage restrictions, and commercial limits?
- Which provider is authoritative when duplicates disagree?
- What is the acceptable cache TTL per provider and country?
- What happens to the user experience if one or all job providers fail?
- Are additional country-specific job providers required at launch?
- Are employer-direct links preferred over aggregator redirect links in all markets?

## 14\. Payments, Pricing, and Entitlements

- Which payment provider(s) are approved for each launch country?
- Which currencies must be supported?
- Is pricing localized by country or converted from a base price?
- Are monthly and annual subscriptions required?
- How many subscription tiers exist, and what exact quotas/entitlements apply to each?
- Who handles VAT, GST, sales tax, invoices, and tax documentation?
- What is the required behavior for failed payments, grace periods, cancellation, refunds, disputes, and chargebacks?
- Must billing webhooks be processed exactly once/idempotently?
- Can payment operations remain in the gateway console as proposed, or are admin-side operations required?

## 15\. Availability, Resilience, Backup, and Disaster Recovery

- Is the specification's 99.5% monthly availability target accepted by the business?
- What is the required RTO for complete production failure?
- What is the required RPO / maximum acceptable data loss?
- Must production tolerate a single instance/task failure automatically?
- Must production tolerate an Availability Zone failure?
- Must V1 tolerate a complete AWS Region failure?
- If Region-level DR is required, is active/passive sufficient or is active/active required?
- How frequently must restore/DR tests be performed?
- Which functions may degrade independently during provider outages: job search, AI generation, payments, exports?
- What is the required user-facing status/incident communication process?

## 16\. Security and Compliance

- Which compliance obligations are actual launch requirements: GDPR, India DPDP, CCPA/CPRA, SOC 2, ISO 27001, PCI DSS, or customer-specific controls?
- Is OWASP ASVS Level 2 the accepted application-security baseline?
- Is an external penetration test required before public launch?
- What is the data-classification policy for resumes, profiles, visa/work-authorization data, logs, and billing metadata?
- Are customer-managed KMS keys required or are AWS-managed keys acceptable?
- How frequently must keys/secrets rotate?
- Which security events require audit logging and how long must audit logs be retained?
- Who may access production PII and under what approval/break-glass process?
- Are vulnerability scanning, dependency scanning, secret scanning, container scanning, and SBOM generation required?
- What incident-response and breach-notification obligations apply in each launch country?

## 17\. CI/CD, Infrastructure as Code, and Release Management

- Where is the source repository hosted?
- What branching/release strategy is used?
- How many developers and teams deploy the application?
- What checks must pass before merge and before production deployment?
- Should every pull request receive a preview environment?
- Is Terraform, AWS CDK, CloudFormation, or another IaC standard preferred?
- Are production deployments manually approved?
- Which deployment strategy is required: rolling, blue/green, canary, or feature-flagged release?
- What is the target rollback time after a bad release?
- How are database migrations coordinated with backward-compatible application deployments?
- How are secrets/configuration promoted across dev, staging, and production?

## 18\. Observability, SRE, and Operations

- Who owns 24x7 production support and who receives alarms?
- Is support 24x7 or business-hours only?
- What incident severities and response-time expectations exist?
- Which tools are preferred for paging, chat notifications, error tracking, dashboards, and status pages?
- What logs/metrics/traces must be retained and for how long?
- Is distributed tracing required across request -> background job -> AI provider calls?
- What SLOs should be defined for API latency, generation success, generation latency, exports, authentication, and job search?
- What queue-depth, provider-failure, cost, quota, database, and security alarms are required?
- Who owns runbooks and operational readiness reviews?
- Are synthetic login, generation, job-search, and download checks required from multiple geographies?

## 19\. Cost and FinOps

- What is the approved monthly AWS budget at launch and at one-year scale?
- What is the maximum acceptable infrastructure cost per active user?
- What is the maximum acceptable AI cost per generated resume?
- Should budgets be enforced only by alerts or by automated quotas/feature throttling?
- Who reviews AWS Cost Explorer/budgets and how frequently?
- Are Savings Plans/Reserved Instances acceptable after usage stabilizes?
- Should non-production environments scale to zero or shut down outside working hours?
- What cost allocation is needed by environment, feature, country, or team?

## 20\. Team Ownership and Operational Readiness

- Who owns frontend, backend/API, AI pipeline, database, infrastructure, security, payments, and job-provider integrations?
- Who is the final architecture decision-maker?
- Who can approve production access and emergency changes?
- Is there at least two-person knowledge coverage for AI generation and billing?
- What runbooks must exist before launch?
- What dashboards and alarms must be reviewed during launch readiness?
- What are the beta exit criteria and who signs off?
- Who owns post-launch incident review and architectural follow-up actions?

# C. Expected Outputs After Discovery

- Confirmed requirements and constraints.
- Explicit assumptions with owners and due dates.
- Open questions and launch blockers.
- Architecture Decision Records (ADRs) for major choices.
- AWS account/Region and environment strategy.
- Target AWS architecture and service-selection rationale.
- Security, IAM, networking, encryption, and data-residency design.
- Availability, backup, RTO/RPO, and disaster-recovery design.
- CI/CD and Infrastructure-as-Code strategy.
- Observability, incident response, and operational readiness plan.
- Capacity and cost model for launch, 6-month, and 12-month scenarios.
- Migration/onboarding plan from the current Vercel/Supabase/Inngest-oriented specification, if applicable.
- Production readiness checklist and phased rollout plan for the five launch countries.

**Decision principle**

**Requirements -> Constraints -> Failure Modes -> Scale -> Security -> Operations -> Cost -> AWS Service Selection**
