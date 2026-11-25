import { CANONICAL_SCHEMA_VERSION, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import type { StageJd } from '../../src/pipeline/stages/common';

/**
 * Two tailored runs of one resume for one job, as they were downloaded (owner, 2026-11-25): an
 * outside keyword checker gave RUN_A 84 and RUN_B 74. The roles' lines and the skills are as the
 * runs wrote them; the employers, the school and every contact detail are invented (L4).
 * RUN_A's summary says the job's phrases word for word; RUN_B's paraphrases them and drops "UI".
 */

const claim = (id: string, text: string) => ({ id, text, evidence: [] as string[], origin: 'user' as const });
const skills = (names: string[]) => names.map((name, i) => ({ id: `k${i}`, name, evidence: [] as string[], origin: 'user' as const }));
const list = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);

export const DEVICE_JD_TEXT = [
  'Role: Software Engineer – Device Testing',
  'Location: Sunnyvale, CA',
  'Experience: 8–10 Years',
  'MUST-HAVE SKILLS:',
  'Python & Java Programming',
  'Device Testing & Test Automation',
  'XCUI / Device Automation Frameworks',
  'End-to-End (E2E) Testing',
  'Backend Services & API Integration',
  'Distributed Systems Debugging',
  'SQL & Database Connectivity',
  'Log Analysis & Root Cause Analysis',
  'Data Pipeline Validation',
  'Manual & Automated Testing',
  'ADDITIONAL TECHNICAL SKILLS:',
  'JavaScript Test Frameworks',
  'AWS / GCP Cloud Platforms',
  'Kafka & Apache Spark',
  'Docker / Containerization',
  'System Telemetry & Diagnostics',
  'Cross-System Workflow Validation',
  'KEY RESPONSIBILITIES:',
  'Execute E2E testing across devices, backend services, data pipelines and browser UI.',
  'Validate unreleased device features and platform changes.',
  'Develop and execute manual test scenarios.',
  'Debug failures across devices and distributed systems.',
  'Analyze logs and telemetry to identify root causes.',
  'Report defects with clear reproduction steps.',
  'Independently troubleshoot issues before escalation.',
  'Collaborate with internal engineering teams.',
  'IMPORTANT:',
  '8–10 Years Experience',
  'Strong Python + Java Skills',
  'Hands-on Device Testing & XCUI Experience',
].join('\n');

export const DEVICE_JD: StageJd = {
  id: 'jd-device',
  title: 'Software Engineer – Device Testing',
  titled: true,
  company: null,
  location: 'Sunnyvale, CA',
  requiredSkills: ['Python', 'Java', 'Device Testing', 'Test Automation', 'XCUI', 'Device Automation Frameworks', 'End-to-End (E2E) Testing', 'Backend Services', 'API Integration', 'Distributed Systems Debugging', 'SQL', 'Database Connectivity', 'Log Analysis', 'Root Cause Analysis', 'Data Pipeline Validation', 'Automated Testing', 'manual test scenarios', 'Reproduction Steps'],
  preferredSkills: ['JavaScript Test Frameworks', 'AWS', 'GCP', 'Kafka', 'Apache Spark', 'Docker', 'Containerization', 'System Telemetry', 'Diagnostics', 'Cross-System Workflow Validation', 'Telemetry'],
  tools: ['XCUI', 'Kafka', 'Apache Spark', 'Docker', 'AWS', 'GCP'],
  responsibilities: [],
  rawText: DEVICE_JD_TEXT,
  completeness: 'full',
  language: 'en',
};

const SHARED_SKILLS =
  'Requirements Gathering, Business Requirements, Functional Requirements, Technical Requirements, Business Process Analysis, Gap Analysis, Workflow Analysis, Process Mapping, Requirements Documentation, Stakeholder Communication, Salesforce CRM, nCino, Loan Origination System (LOS), Banking Application Workflows, Customer and Account Data, Loan Processing Workflows, Financial Services Processes, Business Requirements Documents (BRD), Functional Requirements Documents (FRD), User Stories, Acceptance Criteria, Business Rules, Functional Specifications, Requirements Traceability, User Acceptance Testing (UAT), Functional Testing, Regression Testing, Test Case Support, Defect Tracking, Issue Reproduction, Automated Testing, Device Testing, End-to-End (E2E) Testing, Test Automation, Device Automation Frameworks, manual test scenarios, Reproduction Steps, E2E testing, SQL, Python, Java, API Integration, Data Pipeline Validation, JavaScript, Cross-System Workflow Validation, Kafka, Apache Spark, JavaScript Test Frameworks, XCUI, Telemetry, Distributed Systems Debugging, Database Connectivity, AWS, GCP, Docker, System Telemetry, Diagnostics, Root Cause Analysis, Log Analysis, Containerization';

const base = (summary: string, now: string[], before: string[], extraSkills = ''): CanonicalResumeJson => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Software Engineer – Device Testing',
  summary: claim('s', summary),
  skills: skills(list(`${SHARED_SKILLS}${extraSkills ? `, ${extraSkills}` : ''}`)),
  roles: [
    { roleId: 'now', company: 'Northgate Health', title: 'Software Engineer', start: '2025-10', end: null, skills: [], bullets: now.map((t, i) => claim(`n${i}`, t)) },
    { roleId: 'before', company: 'Brightleaf Systems', title: 'Software Engineer', start: '2020-05', end: '2023-12', skills: [], bullets: before.map((t, i) => claim(`b${i}`, t)) },
  ],
  education: [{ factId: 'edu', institution: 'Example University', degree: 'Masters', field: 'Information Technology Management', start: null, end: '2025-05' }],
  certifications: [],
  projects: [],
});

/** The run the checker gave 84. */
export const RUN_A = base(
  'Software engineer in Device Testing who runs End-to-End (E2E) Testing across backend services, data pipelines and browser UI in Python, Java and JavaScript. Investigates failures with Log Analysis, Root Cause Analysis and Distributed Systems Debugging, with AWS, GCP, Docker and Containerization exposure.',
  [
    'Coordinated with developers and QA teams on Device Testing and End-to-End (E2E) Testing of application enhancements, running regression checks to confirm expected functionality.',
    'Traced requests and reviewed backend behavior using Log Analysis and Root Cause Analysis, documenting findings and Reproduction Steps for resolution.',
    'Supported API Integration and Database Connectivity between frontend applications, backend services and data stores, aiding Distributed Systems Debugging.',
    'Support CRM-related data validation and integration activities, investigating inconsistencies and verifying that application data meets expected business requirements across 100,000 data records.',
    'Ran manual test scenarios and Test Automation with Python and Java, adding Automated Testing to validate application enhancements.',
    'Analyze application workflows and business rules to identify gaps, clarify expected system behavior, and support workflow improvements that prevented 10+ defects in production.',
    'Collaborate with business stakeholders and technical teams to understand business needs and translate requests into functional requirements and technical implementation tasks, delivering 5+ requests on schedule.',
    'Worked with business and technical stakeholders to understand workflow needs and communicate application changes to the appropriate development and testing teams, keeping 5 teams aligned on each release.',
  ],
  [
    'Coordinated with developers and QA teams on regression testing and release validation, supporting XCUI and Device Automation Frameworks.',
    'Investigated production application and data issues using Telemetry, documenting findings with technical teams to support resolution.',
    'Analyzed business application data with SQL, validating records and investigating discrepancies using Diagnostics and System Telemetry.',
    'Supported ETL and data integration activities, performing Data Pipeline Validation of source and destination records across Kafka and Apache Spark data flows.',
    'Performed source-to-target data validation and quality checks to verify transformation results, supporting Cross-System Workflow Validation.',
  ],
);

/** The run the checker gave 74. */
export const RUN_B = base(
  'Software Engineer in Device Testing and Test Automation who validates backend services and data flows across applications with Python, Java and JavaScript. Debugs failures, analyzes logs and works with engineering teams; familiar with AWS, GCP, Docker and Containerization.',
  [
    'Validated application enhancements with developers and QA teams through Device Testing, E2E testing and manual test scenarios, catching 25+ defects before release.',
    'Traced requests, reviewed backend behavior and queried records, using Log Analysis and Root Cause Analysis to document findings for resolution.',
    'Supported REST API and database integration workflows, covering API Integration and Database Connectivity between frontend applications, backend services and data stores.',
    'Investigated CRM data inconsistencies through Data Pipeline Validation and Cross-System Workflow Validation, verifying application data meets business requirements.',
    'Documented testing outcomes with clear Reproduction Steps and built reporting views to monitor business metrics and Telemetry.',
    'Analyze application workflows and business rules to identify gaps, clarify expected system behavior, and support workflow improvements that removed 10 manual steps from the process.',
    'Collaborate with business stakeholders and technical teams to understand business needs and translate requests into functional requirements and technical implementation tasks, delivering 20+ requests on schedule.',
    'Worked with business and technical stakeholders to understand workflow needs and communicate application changes to the appropriate development and testing teams, handling 50+ requirements changes a quarter.',
  ],
  [
    'Investigated production application and data issues using System Telemetry and Distributed Systems Debugging, documenting findings with technical teams.',
    'Performed source-to-target validation and quality checks for End-to-End (E2E) Testing of transformation results, using Diagnostics to identify inconsistencies.',
    'Supported ETL and data integration by validating source and destination records across Kafka and Apache Spark data flows and investigating discrepancies.',
    'Developed SQL queries, stored procedures and data-processing logic on Oracle Database, validating records for Automated Testing and business reporting.',
    'Collaborated with stakeholders, developers and QA teams to clarify functional expectations and coordinate enhancements, validated with Test Automation, JavaScript Test Frameworks and XCUI.',
  ],
  'Defect Validation, Release Validation, Cross-Functional Collaboration, Agile/Scrum, Jira, Project Documentation, Oracle 19c, PL/SQL, PostgreSQL, MySQL, Data Mapping, Data Validation, Data Quality, ETL Workflows, Source-to-Target Validation, REST APIs, System Integration, Power BI, Tableau, Microsoft Excel, ServiceNow, Git, GitHub Actions, Application Support, Technical Documentation',
);
