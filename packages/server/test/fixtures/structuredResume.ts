import { extractionSchema } from '../../src/parsing/extract';

/** A synthetic resume with every structure the reader keeps (L4), as text, links and a model's extraction. */

export const TEXT = `Alex Rivera
Pune, India | +91 98470 12345 | alex.rivera@example.com | LinkedIn | GitHub
Summary
Frontend developer who ships fast, accessible web apps.
Technical Skills
Front End: React, TypeScript, HTML
Databases: PostgreSQL
Experience
Brightleaf (brightleaf.dev) Nov 2023 - Present
Full-Stack Developer Pune, India
Ease Home - Home Services Platform | Next.js, PostgreSQL
Built the booking flow in Next.js for customers and admins.
Designed the PostgreSQL schema for orders.
MiTow - Roadside Assistance | Next.js
Built role-based flows for drivers.
Projects
LinkTrack - Link Analytics | React, SQL Jun 2025 - Sep 2025
Built a real-time click dashboard in React.
Education
Coastal Institute of Technology Sep 2019 - Jun 2023
BTech, Computer Science | GPA: 8.1 / 10 Kochi, India
Extracurricular
Code Club - Core Member 2020 - 2023
Ran workshops for 200 students.
Certifications
HackerRank skill assessments: Java, SQL.`;

export const LINKS = [
  { text: 'LinkedIn |', url: 'https://www.linkedin.com/in/alex-rivera' },
  { text: 'GitHub', url: 'https://github.com/alexrivera' },
];

export const EXTRACTION = extractionSchema.parse({
  headline: null,
  summary: 'Frontend developer who ships fast, accessible web apps.',
  roles: [
    {
      company: 'Brightleaf (brightleaf.dev)', title: 'Full-Stack Developer', start: '2023-11', end: null, current: true, skills: ['Next.js'], summary: null, bullets: [],
      entries: [
        { title: 'Ease Home - Home Services Platform', tech: 'Next.js, PostgreSQL', bullets: ['Built the booking flow in Next.js for customers and admins.', 'Designed the PostgreSQL schema for orders.'] },
        { title: 'MiTow - Roadside Assistance', tech: 'Next.js', bullets: ['Built role-based flows for drivers.'] },
      ],
    },
  ],
  education: [{ institution: 'Coastal Institute of Technology', degree: 'BTech', field: 'Computer Science', start: '2019-09', end: '2023-06', gpa: 'GPA: 8.1 / 10', location: 'Kochi, India' }],
  certifications: [],
  projects: [
    // The model listed a client project again as a project, and reused a role line in another.
    { name: 'Ease Home - Home Services Platform', description: null, bullets: ['Built the booking flow in Next.js for customers and admins.'] },
    { name: 'LinkTrack - Link Analytics', description: null, tech: 'React, SQL', start: '2025-06', end: '2025-09', bullets: ['Built a real-time click dashboard in React.', 'Designed the PostgreSQL schema for orders.'] },
  ],
  skills: ['React', 'TypeScript', 'HTML', 'PostgreSQL'],
  skillGroups: [{ label: 'Front End', skills: ['React', 'TypeScript', 'HTML'] }, { label: 'Databases', skills: ['PostgreSQL'] }, { label: 'Made Up', skills: ['Rust'] }],
  extraSections: [
    { heading: 'Extracurricular', entries: [{ title: 'Code Club - Core Member', subtitle: null, right: '2020 - 2023', bullets: ['Ran workshops for 200 students.'] }], lines: [] },
    { heading: 'Certifications', entries: [], lines: ['HackerRank skill assessments: Java, SQL.'] },
  ],
  sectionOrder: ['Summary', 'Technical Skills', 'Experience', 'Projects', 'Education', 'Extracurricular', 'Certifications'],
});
