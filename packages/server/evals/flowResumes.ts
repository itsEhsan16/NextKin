import { makeDocx } from '../test/fixtures/makeDocx';
import { makePdf, type PdfPage, type PdfRun } from '../test/fixtures/makePdf';

/**
 * The resumes the flow check uploads (owner, 2026-11-25). Each is shaped like one that broke on the
 * demo that day: a graduate's page, a mid-level two-pager, and a long senior resume whose summary
 * runs to a dozen lines, whose skill lines have "&" in their labels and whose jobs hold more bullets
 * than a stored role keeps. Every word is invented (L4). Plain ASCII, so the PDF's one font sets it.
 */

export interface FlowResume {
  name: 'graduate' | 'mid' | 'senior';
  lines: string[];
  /** What a good read of it holds, at the least. */
  expect: { roles: number; schools: number; skillLines: number; skills: number; summaryChars: number; bulletsPerRole: number[] };
}

const VERBS = ['Designed', 'Built', 'Reworked', 'Automated', 'Migrated', 'Tuned', 'Documented', 'Shipped', 'Hardened', 'Instrumented', 'Refactored', 'Introduced', 'Led', 'Reviewed'];
const THINGS = ['the order service', 'the billing API', 'a nightly reconciliation job', 'the search index pipeline', 'the customer dashboard', 'the release pipeline', 'the alerting rules', 'the data import worker', 'the reporting queries', 'the audit log', 'the onboarding flow', 'the inventory sync', 'the notification service', 'the rate limiter'];
const WITH = ['in Java and Spring Boot', 'on PostgreSQL', 'with Apache Kafka', 'on AWS with Docker', 'in TypeScript and React', 'with Jenkins and Git', 'using Redis', 'on Kubernetes', 'with JUnit and Mockito', 'using REST APIs', 'in Python', 'with Terraform'];
const SO = ['so that month-end closes a day sooner', 'which cut support tickets for that area', 'so two teams could release on their own', 'which removed a manual step from each release', 'so failures page the owning team first', 'which kept response times steady at peak', 'so new joiners ship in their first week'];

/** Distinct, plausible lines: each role gets its own slice, so no two bullets in a file match. */
const bullets = (seed: number, count: number): string[] =>
  Array.from({ length: count }, (_, i) => {
    const n = seed * 31 + i;
    return `${VERBS[n % VERBS.length]} ${THINGS[(n * 3 + seed) % THINGS.length]} ${WITH[(n * 5 + i) % WITH.length]}, ${SO[(n + seed * 2) % SO.length]} (item ${seed}.${i + 1}).`;
  });

const SUMMARY_LINES = [
  'Eight years of experience designing, building and running backend and full-stack applications for retail, payments and logistics companies of different sizes.',
  'Specialised in Java, Spring Boot and microservices, building scalable and secure services and RESTful APIs that other teams depend on every day.',
  'Strong grounding in object-oriented design, design patterns, exception handling and asynchronous processing for reusable and maintainable code.',
  'Hands-on with AWS services including EC2, S3, Lambda, IAM and CloudWatch for deployment, monitoring and troubleshooting of production systems.',
  'Experienced in event-driven architecture with Apache Kafka, service-to-service communication and reliable integration between distributed services.',
  'Deep knowledge of PostgreSQL, Oracle and MongoDB, covering schema design, query optimisation, indexing, data validation and performance tuning.',
  'Comfortable on the front end with TypeScript, Angular and React, delivering responsive dashboards wired to backend REST APIs.',
  'Skilled in Spring Security, OAuth2, JWT and role-based access control, with unit and integration testing in JUnit and Mockito.',
  'Practised in CI/CD with Jenkins, Git and Docker, automated builds, release management and production support across environments.',
  'Used to Agile delivery with product managers, QA and operations, leading code reviews and mentoring junior engineers on the team.',
  'Background in payment processing, ledger reconciliation and compliance reporting, with attention to data integrity and audit needs.',
  'Known for clear documentation, steady incident handling and leaving systems easier to operate than they were found.',
];

const SKILL_LINES = [
  'Backend Development: Java, Spring Boot, Spring MVC, Spring Security, Hibernate, Microservices, REST APIs, Multithreading',
  'Cloud Platforms & Infrastructure: AWS, EC2, S3, Lambda, IAM, CloudWatch, Terraform',
  'Distributed Systems & API Development: Apache Kafka, RabbitMQ, API Gateway, OpenAPI, gRPC',
  'Frontend & Full Stack Development: TypeScript, JavaScript, Angular, React, HTML, CSS',
  'Containerization & Orchestration: Docker, Kubernetes, Helm',
  'DevOps & CI/CD: Jenkins, GitHub Actions, Maven, Gradle, Git',
  'Databases & Data Processing: PostgreSQL, Oracle, MongoDB, Redis, SQL',
  'Testing & Code Quality: JUnit, Mockito, Testcontainers, SonarQube',
  'Monitoring & Production Support: Splunk, Datadog, Prometheus, Grafana',
  'Security & Access: OAuth2, JWT, RBAC',
  'Ways of Working: Agile, Scrum, Code Reviews, Mentoring',
];

const role = (title: string, dates: string, employer: string, seed: number, count: number): string[] => [`${title} ${dates}`, employer, ...bullets(seed, count)];

export const FLOW_RESUMES: FlowResume[] = [
  {
    name: 'graduate',
    lines: [
      'Riya Example',
      'Sampletown, Region | +1 555 010 0101 | riya@example.com',
      'Summary',
      'Computer Science graduate who built and shipped three web projects and completed a developer internship on a client platform.',
      'Education',
      'Example University Sep 2022 - Jan 2026',
      'B.Tech, Computer Science and Engineering, CGPA: 7.4 / 10',
      'Technical Skills',
      'Languages & Frameworks: Python, Java, JavaScript, TypeScript, React, Node.js',
      'Databases & Tools: PostgreSQL, SQL, Git, Docker',
      'Work Experience',
      ...role('Developer Intern', 'Jul 2025 - Sep 2025', 'Brightleaf Labs. Sampletown, Region', 1, 3),
      'Projects',
      'LinkTrail - Link Management | React, TypeScript, PostgreSQL',
      ...bullets(2, 3),
      'ShopEase - Store Platform | Node.js, PostgreSQL',
      ...bullets(3, 3),
      'Certifications',
      'Cloud Data Analytics Certificate, Example Skills Academy',
    ],
    expect: { roles: 1, schools: 1, skillLines: 2, skills: 8, summaryChars: 100, bulletsPerRole: [3] },
  },
  {
    name: 'mid',
    lines: [
      'Arun Example',
      'Sampletown, Region | +1 555 010 0102 | arun@example.com',
      'Professional Summary',
      'Software engineer with four years of experience building and supporting backend services and data integrations for enterprise applications.',
      'Works across requirements, development, testing and release with developers, QA and business stakeholders.',
      'Core Skills',
      'Backend & APIs: Java, Spring Boot, REST APIs, Microservices',
      'Data & Integration: SQL, PostgreSQL, Oracle, Apache Kafka',
      'Testing & Quality: JUnit, Mockito, Regression Testing',
      'Cloud & Tools: AWS, Docker, Jenkins, Git',
      'Professional Experience',
      ...role('Software Engineer', 'Mar 2023 - Present', 'Northgate Health. Sampletown, Region', 4, 9),
      ...role('Software Engineer', 'Jun 2021 - Feb 2023', 'Brightleaf Systems. Otherville, Region', 5, 8),
      'Education',
      'Example University May 2021',
      'Masters in Information Technology Management',
    ],
    expect: { roles: 2, schools: 1, skillLines: 4, skills: 12, summaryChars: 200, bulletsPerRole: [9, 8] },
  },
  {
    name: 'senior',
    lines: [
      'Vikram Example',
      '+1 555 010 0103 | vikram@example.com | https://www.example.com/in/vikram-example/',
      'Professional Summary',
      ...SUMMARY_LINES,
      'Technical Skills',
      ...SKILL_LINES,
      'Professional Experience',
      ...role('Software Developer', 'Dec 2024 - Present', 'Harbor Carts. Sampletown, Region', 6, 17),
      ...role('Software Engineer', 'Jul 2024 - Nov 2024', 'Keystone Infosystems. Otherville, Region', 7, 11),
      ...role('Software Engineer', 'Aug 2019 - Nov 2022', 'Savanna Software. Farcity, Country', 8, 22),
      ...role('Software Engineer', 'May 2018 - Jul 2019', 'Lumen India. Farcity, Country', 9, 13),
      'EDUCATION',
      'Master of Science in Data Science',
      'Example University of Sampletown | Sampletown, Region',
      'Graduated: May 2024 | GPA: 4.0/4.0',
      'Bachelor of Technology in Civil Engineering',
      'Example Technological University | Farcity, Country',
      'Graduated: May 2018',
    ],
    expect: { roles: 4, schools: 2, skillLines: 11, skills: 40, summaryChars: SUMMARY_LINES.join(' ').length, bulletsPerRole: [17, 11, 22, 13] },
  },
];

export const asDocx = (resume: FlowResume): Uint8Array => makeDocx(resume.lines.map((text) => [{ text }]));

/** One line of text per row, wrapped at a width Helvetica 10pt fits on US Letter, 54 rows a page. */
export function asPdf(resume: FlowResume): Uint8Array {
  const rows: string[] = [];
  for (const line of resume.lines) {
    let rest = line;
    while (rest.length > 96) {
      const cut = rest.lastIndexOf(' ', 96);
      rows.push(rest.slice(0, cut > 0 ? cut : 96));
      rest = rest.slice(cut > 0 ? cut + 1 : 96);
    }
    rows.push(rest);
  }
  const pages: PdfPage[] = [];
  for (let at = 0; at < rows.length; at += 54) {
    const runs: PdfRun[] = rows.slice(at, at + 54).map((text, i) => ({ text, x: 54, y: 750 - i * 13, size: 10 }));
    pages.push({ runs });
  }
  return makePdf(pages);
}

export const FLOW_JOBS: { name: string; text: string }[] = [
  {
    name: 'java-backend',
    text: [
      'Senior Java Backend Developer',
      'Location: Sampletown (Hybrid)',
      'We are looking for a Java backend developer to design, build and operate microservices for our payments platform.',
      'Must-have skills',
      '- Java, Spring Boot, Spring Security, Hibernate',
      '- Microservices Architecture, RESTful APIs, API Gateway',
      '- Apache Kafka, event-driven architecture',
      '- PostgreSQL, Oracle, Redis, SQL query optimization',
      '- AWS, Docker, Kubernetes',
      '- CI/CD pipelines with Jenkins, Maven, Git',
      '- JUnit, Mockito, integration testing',
      'Nice to have',
      '- Terraform, Datadog, Splunk, distributed tracing',
      '- Payment processing, ledger reconciliation',
      'Responsibilities',
      '- Design and develop scalable backend services and RESTful APIs in Java and Spring Boot.',
      '- Build event-driven integrations on Apache Kafka for transaction processing.',
      '- Troubleshoot production incidents and perform root cause analysis.',
      '- Lead code reviews and mentor junior engineers in an Agile team.',
    ].join('\n'),
  },
  {
    name: 'qa-automation',
    text: [
      'Software Engineer - Test Automation',
      'Location: Otherville',
      'MUST-HAVE SKILLS:',
      'Python & Java Programming',
      'Test Automation & Regression Testing',
      'End-to-End (E2E) Testing',
      'Backend Services & API Integration',
      'SQL & Database Connectivity',
      'Log Analysis & Root Cause Analysis',
      'ADDITIONAL SKILLS:',
      'AWS / Docker',
      'Apache Kafka',
      'KEY RESPONSIBILITIES:',
      'Execute E2E testing across backend services, data pipelines and browser UI.',
      'Develop and execute manual test scenarios.',
      'Report defects with clear reproduction steps.',
      'Collaborate with internal engineering teams.',
    ].join('\n'),
  },
];
