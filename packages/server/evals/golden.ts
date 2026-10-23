import type { FactRole, ProfileFacts } from '@nextkin/engines/facts';

/**
 * The golden set, version golden-0.1.0 (ImBackendImplementationPlan P9-06; V2 §16.4). A synthetic
 * starter set of 30 profile + JD pairs (L4: no real person), authored for P9 by the owner's decision
 * (toreview §105.16); the content lane extends or replaces it with reviewed pairs.
 *
 * Each pair is labelled with its trap family and its market, and carries the JD's gold labels
 * (required and preferred skills) for extraction precision and recall. The families §16.4 asks for:
 * - `matched`: the profile backs most of what the JD asks;
 * - `anachronism`: the JD demands technologies newer than the candidate's older roles;
 * - `gap`: the JD requires skills the profile does not have, which must stay gaps;
 * - `sparse`: a thin profile (Zero-Resume-like inputs);
 * - `german`: a German JD (D-11: read, matched on canonical ids, resume stays English);
 * - `switcher`: a career change, where only related experience may be claimed.
 */

export const GOLDEN_VERSION = 'golden-0.1.0';

export type Family = 'matched' | 'anachronism' | 'gap' | 'sparse' | 'german' | 'switcher';

export interface GoldenPair {
  id: string;
  family: Family;
  market: 'us' | 'de' | 'au';
  facts: ProfileFacts;
  jd: string;
  labels: { required: string[]; preferred: string[] };
}

const role = (id: string, company: string, title: string, start: [number, number], end: [number, number] | null, facts: string[], skills: string[]): FactRole => ({
  id,
  company,
  title,
  start: { year: start[0], month: start[1] },
  end: end ? { year: end[0], month: end[1] } : null,
  responsibilities: facts,
  skills,
});

const profile = (headline: string, skills: string[], roles: FactRole[], education: [string, string][] = [['State University', 'BSc Computer Science']]): ProfileFacts => ({
  headline,
  skills,
  roles,
  education: education.map(([institution, degree], i) => ({ id: `edu_${i}`, institution, degree })),
  certifications: [],
  projects: [],
});

const P = {
  backend: profile('Backend engineer', ['Go', 'PostgreSQL', 'Docker', 'Kubernetes', 'Python', 'Redis'], [
    role('be_1', 'Lumen Pay', 'Senior Backend Engineer', [2020, 3], null, ['Built the settlement service in Go, processing 2 million transactions daily', 'Reduced API p99 latency from 800 ms to 440 ms by reworking PostgreSQL indexes', 'Moved 40 services onto Kubernetes with zero downtime'], ['Go', 'PostgreSQL', 'Kubernetes', 'Redis']),
    role('be_2', 'Cartwheel', 'Backend Developer', [2009, 1], [2012, 6], ['Developed order APIs in Python for 300 merchants', 'Maintained the MySQL catalogue schema with a team of 12'], ['Python', 'MySQL']),
  ]),
  frontend: profile('Frontend engineer', ['JavaScript', 'TypeScript', 'React', 'CSS', 'jQuery'], [
    role('fe_1', 'Brightdesk', 'Frontend Engineer', [2018, 5], null, ['Rebuilt the dashboard in React and TypeScript for 50,000 daily users', 'Cut bundle size by 35% with code splitting', 'Wrote the component library used by 6 teams'], ['React', 'TypeScript', 'JavaScript']),
    role('fe_2', 'Oldweb Media', 'Web Developer', [2010, 2], [2013, 1], ['Built marketing sites with jQuery and CSS', 'Maintained a PHP content system for 20 client sites'], ['jQuery', 'CSS', 'PHP']),
  ]),
  data: profile('Data analyst', ['SQL', 'Python', 'pandas', 'Tableau', 'Microsoft Excel'], [
    role('da_1', 'Retailytics', 'Senior Data Analyst', [2019, 9], null, ['Built weekly revenue dashboards in Tableau read by 40 managers', 'Automated reporting in Python and pandas, saving 10 hours a week', 'Designed A/B test analyses for pricing experiments'], ['SQL', 'Python', 'pandas', 'Tableau']),
    role('da_2', 'Northbank', 'Analyst', [2015, 1], [2019, 8], ['Produced monthly risk reports in Microsoft Excel and SQL', 'Reconciled 3 data sources for the finance team'], ['SQL', 'Microsoft Excel']),
  ]),
  devops: profile('DevOps engineer', ['Terraform', 'AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Puppet', 'Linux'], [
    role('do_1', 'Cloudnest', 'DevOps Engineer', [2017, 4], null, ['Provisioned AWS infrastructure with Terraform across 3 regions', 'Ran Kubernetes clusters for 120 services', 'Moved CI from Jenkins to GitHub Actions'], ['Terraform', 'AWS', 'Kubernetes', 'Jenkins', 'GitHub Actions']),
    role('do_2', 'Hostwise', 'Systems Administrator', [2008, 6], [2013, 3], ['Managed 200 Linux servers with Puppet', 'Cut provisioning time from 2 days to 3 hours'], ['Linux', 'Puppet']),
  ]),
  mobile: profile('iOS engineer', ['Swift', 'Objective-C', 'Firebase'], [
    role('mo_1', 'Fitloop', 'iOS Engineer', [2016, 1], null, ['Shipped the iOS app in Swift to 1 million installs', 'Added offline sync with Firebase'], ['Swift', 'Firebase']),
    role('mo_2', 'Appforge', 'Mobile Developer', [2011, 3], [2014, 2], ['Built 8 client apps in Objective-C'], ['Objective-C']),
  ]),
  designer: profile('Product designer', ['Figma', 'User research', 'Prototyping', 'Design systems', 'Sketch'], [
    role('ds_1', 'Swiftcart', 'Senior Product Designer', [2019, 6], null, ['Redesigned checkout, lifting conversion 12%', 'Led the design system adopted by 5 squads', 'Ran 30 moderated user research sessions'], ['Figma', 'Design systems', 'User research', 'Prototyping']),
    role('ds_2', 'Pixelhaus', 'UI Designer', [2012, 1], [2015, 12], ['Designed mobile apps in Sketch for 14 clients'], ['Sketch']),
  ]),
  pm: profile('Product manager', ['Product management', 'Roadmapping', 'Stakeholder management', 'SQL', 'Jira'], [
    role('pm_1', 'Ledgerly', 'Product Manager', [2018, 2], null, ['Owned the payments roadmap for 3 engineering teams', 'Launched instant payouts, used by 8,000 merchants in the first quarter', 'Ran discovery interviews with 25 customers'], ['Product management', 'Roadmapping', 'Stakeholder management', 'Jira']),
  ]),
  nurse: profile('Registered nurse', ['Patient care', 'Electronic health records', 'Basic life support'], [
    role('nu_1', 'St Example Hospital', 'Registered Nurse', [2017, 4], null, ['Cared for up to 8 patients per shift on a surgical ward', 'Documented care in the electronic health records system', 'Trained 5 new nurses'], ['Patient care', 'Electronic health records']),
  ], [['Example University', 'Bachelor of Nursing']]),
  junior: profile('Junior developer', ['JavaScript', 'Python', 'Git'], [
    role('jr_1', 'Startly', 'Junior Developer', [2024, 7], null, ['Fixed 40 bugs in the customer portal', 'Wrote unit tests in Python'], ['JavaScript', 'Python', 'Git']),
  ]),
  switcher: profile('Teacher moving into data', ['Microsoft Excel', 'SQL', 'Communication'], [
    role('sw_1', 'Riverside School', 'Mathematics Teacher', [2014, 9], null, ['Tracked results for 150 students in Microsoft Excel', 'Built a SQL report of attendance trends as a side project', 'Presented results to parents and staff each term'], ['Microsoft Excel', 'SQL', 'Communication']),
  ], [['Example University', 'BSc Mathematics']]),
};

type Jd = { family: Family; market: GoldenPair['market']; text: string; required: string[]; preferred: string[] };

const JDS: Record<keyof typeof P, Jd[]> = {
  backend: [
    { family: 'matched', market: 'us', text: 'Senior Backend Engineer at Paywell, Austin, TX.\nRequirements: strong Go and PostgreSQL experience. Experience with Kubernetes is required.\nNice to have: Redis.', required: ['Go', 'PostgreSQL', 'Kubernetes'], preferred: ['Redis'] },
    { family: 'anachronism', market: 'us', text: 'Backend Engineer at Freightly, Chicago.\nRequirements: Kubernetes, Docker and Go. You will migrate legacy services.\nNice to have: Terraform.', required: ['Kubernetes', 'Docker', 'Go'], preferred: ['Terraform'] },
    { family: 'gap', market: 'au', text: 'Backend Engineer at Koala Bank, Sydney, NSW.\nRequirements: Java and Kafka are required. Experience with PostgreSQL is required.\nNice to have: Scala.', required: ['Java', 'Kafka', 'PostgreSQL'], preferred: ['Scala'] },
  ],
  frontend: [
    { family: 'matched', market: 'us', text: 'Frontend Engineer at Notely, New York.\nRequirements: React and TypeScript are required.\nNice to have: CSS and JavaScript.', required: ['React', 'TypeScript'], preferred: ['CSS', 'JavaScript'] },
    { family: 'anachronism', market: 'de', text: 'Frontend Developer at Klarwerk, Berlin, Germany.\nRequirements: React and Vue.js are required. Experience with webpack is required.\nNice to have: jQuery.', required: ['React', 'Vue.js', 'webpack'], preferred: ['jQuery'] },
    { family: 'german', market: 'de', text: 'Frontend-Entwickler bei Datenhaus, München.\nAnforderungen: Erfahrung mit React und TypeScript ist erforderlich.\nWünschenswert: Kenntnisse in CSS.', required: ['React', 'TypeScript'], preferred: ['CSS'] },
  ],
  data: [
    { family: 'matched', market: 'au', text: 'Data Analyst at Shopwise, Melbourne VIC.\nRequirements: SQL and Python are required. Experience with Tableau is required.\nNice to have: pandas.', required: ['SQL', 'Python', 'Tableau'], preferred: ['pandas'] },
    { family: 'gap', market: 'us', text: 'Analytics Engineer at Metricly, Seattle.\nRequirements: dbt and Snowflake are required. SQL is required.\nNice to have: Airflow.', required: ['dbt', 'Snowflake', 'SQL'], preferred: ['Airflow'] },
    { family: 'german', market: 'de', text: 'Datenanalyst bei Handelsdaten, Hamburg.\nAnforderungen: sehr gute Kenntnisse in SQL und Python sind erforderlich.\nWünschenswert: Erfahrung mit Tableau.', required: ['SQL', 'Python'], preferred: ['Tableau'] },
  ],
  devops: [
    { family: 'matched', market: 'us', text: 'DevOps Engineer at Shipfast, Boston.\nRequirements: Terraform, AWS and Kubernetes are required.\nNice to have: Jenkins.', required: ['Terraform', 'AWS', 'Kubernetes'], preferred: ['Jenkins'] },
    { family: 'anachronism', market: 'au', text: 'Platform Engineer at Outback Cloud, Brisbane.\nRequirements: Kubernetes, Docker and Terraform are required.\nNice to have: Ansible.', required: ['Kubernetes', 'Docker', 'Terraform'], preferred: ['Ansible'] },
    { family: 'gap', market: 'de', text: 'Site Reliability Engineer at Netzwerk AG, Frankfurt, Germany.\nRequirements: Go and Prometheus are required. Experience with Kubernetes is required.\nNice to have: Grafana.', required: ['Go', 'Prometheus', 'Kubernetes'], preferred: ['Grafana'] },
  ],
  mobile: [
    { family: 'matched', market: 'us', text: 'iOS Engineer at Healthstep, San Francisco.\nRequirements: Swift is required. Experience with Firebase is required.\nNice to have: Objective-C.', required: ['Swift', 'Firebase'], preferred: ['Objective-C'] },
    { family: 'anachronism', market: 'us', text: 'Mobile Engineer at Rideon, Austin.\nRequirements: Swift and Flutter are required.\nNice to have: Firebase.', required: ['Swift', 'Flutter'], preferred: ['Firebase'] },
    { family: 'gap', market: 'au', text: 'Android Engineer at Kanga Apps, Perth.\nRequirements: Kotlin is required. Experience with Firebase is required.\nNice to have: Java.', required: ['Kotlin', 'Firebase'], preferred: ['Java'] },
  ],
  designer: [
    { family: 'matched', market: 'us', text: 'Senior Product Designer at Paylane, New York.\nRequirements: Figma and design systems experience are required. User research is required.\nNice to have: prototyping.', required: ['Figma', 'Design systems', 'User research'], preferred: ['Prototyping'] },
    { family: 'anachronism', market: 'de', text: 'Product Designer at Gestalt GmbH, Berlin, Germany.\nRequirements: Figma is required. Experience with design systems is required.\nNice to have: Sketch.', required: ['Figma', 'Design systems'], preferred: ['Sketch'] },
    { family: 'german', market: 'de', text: 'Produktdesigner bei Formwerk, Köln.\nAnforderungen: Erfahrung mit Figma und Nutzerforschung ist erforderlich.\nWünschenswert: Prototyping.', required: ['Figma', 'User research'], preferred: ['Prototyping'] },
  ],
  pm: [
    { family: 'matched', market: 'us', text: 'Product Manager at Billfold, Chicago.\nRequirements: product management and roadmapping experience are required. Stakeholder management is required.\nNice to have: SQL.', required: ['Product management', 'Roadmapping', 'Stakeholder management'], preferred: ['SQL'] },
    { family: 'gap', market: 'au', text: 'Technical Product Manager at Platypus Labs, Sydney, NSW.\nRequirements: product management is required. Experience with Python and AWS is required.\nNice to have: Jira.', required: ['Product management', 'Python', 'AWS'], preferred: ['Jira'] },
    { family: 'sparse', market: 'us', text: 'Associate Product Manager at Growthy, Seattle.\nRequirements: roadmapping is required.\nNice to have: SQL and Jira.', required: ['Roadmapping'], preferred: ['SQL', 'Jira'] },
  ],
  nurse: [
    { family: 'matched', market: 'au', text: 'Registered Nurse at Harbour Health, Sydney, NSW.\nRequirements: patient care experience is required. Basic life support is required.\nNice to have: electronic health records.', required: ['Patient care', 'Basic life support'], preferred: ['Electronic health records'] },
    { family: 'switcher', market: 'us', text: 'Backend Engineer at Paywell, Austin, TX.\nRequirements: Go and PostgreSQL are required. Kubernetes is required.\nNice to have: Redis.', required: ['Go', 'PostgreSQL', 'Kubernetes'], preferred: ['Redis'] },
    { family: 'sparse', market: 'us', text: 'Clinical Nurse at Mercy Example, Boston.\nRequirements: patient care is required.\nNice to have: phlebotomy.', required: ['Patient care'], preferred: ['Phlebotomy'] },
  ],
  junior: [
    { family: 'sparse', market: 'us', text: 'Junior Software Engineer at Codecamp, Austin.\nRequirements: JavaScript and Git are required.\nNice to have: Python.', required: ['JavaScript', 'Git'], preferred: ['Python'] },
    { family: 'gap', market: 'de', text: 'Junior Backend Developer at Startwerk, Berlin, Germany.\nRequirements: Java and Spring Boot are required.\nNice to have: Docker.', required: ['Java', 'Spring Boot'], preferred: ['Docker'] },
    { family: 'anachronism', market: 'us', text: 'Junior Developer at Webly, Seattle.\nRequirements: React and TypeScript are required.\nNice to have: Git.', required: ['React', 'TypeScript'], preferred: ['Git'] },
  ],
  switcher: [
    { family: 'switcher', market: 'us', text: 'Junior Data Analyst at Schoolmetrics, Chicago.\nRequirements: SQL and Microsoft Excel are required.\nNice to have: Tableau and Python.', required: ['SQL', 'Microsoft Excel'], preferred: ['Tableau', 'Python'] },
    { family: 'gap', market: 'au', text: 'Data Analyst at Wattle Analytics, Melbourne VIC.\nRequirements: Python and Power BI are required.\nNice to have: SQL.', required: ['Python', 'Power BI'], preferred: ['SQL'] },
    { family: 'sparse', market: 'de', text: 'Reporting Analyst at Zahlenwerk, Hamburg, Germany.\nRequirements: Microsoft Excel is required.\nNice to have: SQL.', required: ['Microsoft Excel'], preferred: ['SQL'] },
  ],
};

export const GOLDEN: GoldenPair[] = (Object.keys(P) as (keyof typeof P)[]).flatMap((key) =>
  JDS[key].map((jd, i) => ({ id: `${key}-${i + 1}`, family: jd.family, market: jd.market, facts: P[key], jd: jd.text, labels: { required: jd.required, preferred: jd.preferred } })),
);
