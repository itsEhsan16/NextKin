import type { Profile } from '@/data/models';

import { USER_ID } from './user';

/** PROFILE 01 (Figma 1:2189) — George Smith, Senior UX Designer · Bengaluru, 72% complete. */
export const profileFixture: Profile = {
  userId: USER_ID,
  headline: 'Senior UX Designer',
  location: 'Bengaluru',
  yearsExperience: 8,
  // "Skills — 12" (Figma 1:2251).
  skills: [
    'Figma',
    'Design systems',
    'Prototyping',
    'User research',
    'Accessibility',
    'Interaction design',
    'Usability testing',
    'Information architecture',
    'Design tokens',
    'Motion design',
    'Workshop facilitation',
    'HTML & CSS',
  ],
  // "Work experience — 4 roles" (Figma 1:2241).
  experiences: [
    {
      id: 'exp_1',
      company: 'Flipkart',
      title: 'Senior UX Designer',
      startDate: '2022-03-01',
      current: true,
      skills: ['Design systems', 'Figma', 'Mobile UX'],
    },
    {
      id: 'exp_2',
      company: 'Swiggy',
      title: 'Product Designer',
      startDate: '2019-06-01',
      endDate: '2022-02-28',
      current: false,
      skills: ['User research', 'Prototyping', 'Growth'],
    },
    {
      id: 'exp_3',
      company: 'PhonePe',
      title: 'UX Designer',
      startDate: '2017-08-01',
      endDate: '2019-05-31',
      current: false,
      skills: ['Payments', 'Mobile UX', 'Usability testing'],
    },
    {
      id: 'exp_4',
      company: 'Obvious',
      title: 'UI Designer',
      startDate: '2016-01-15',
      endDate: '2017-07-31',
      current: false,
      skills: ['Visual design', 'Branding', 'Web'],
    },
  ],
  // "Education — 2" (Figma 1:2246).
  education: [
    {
      id: 'edu_1',
      institution: 'National Institute of Design',
      degree: 'M.Des.',
      field: 'Interaction Design',
      startDate: '2014-07-01',
      endDate: '2016-05-31',
      current: false,
    },
    {
      id: 'edu_2',
      institution: 'Anna University',
      degree: 'B.E.',
      field: 'Computer Science',
      startDate: '2010-08-01',
      endDate: '2014-05-31',
      current: false,
    },
  ],
  // "Certifications — Add" (Figma 1:2256): empty on purpose.
  certifications: [],
  // "Links — Portfolio, LinkedIn" (Figma 1:2261).
  links: [
    { id: 'link_portfolio', label: 'Portfolio', url: 'https://georgesmith.design' },
    { id: 'link_linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/george-smith' },
  ],
  // Stats card (Figma 1:2208): 12 applications · 2 interviews · 87 avg ATS.
  stats: { applications: 12, interviews: 2, avgAtsScore: 87 },
  completeness: 0.72,
  nextSteps: [
    { id: 'step_skills', label: 'Add skills', icon: 'plus' },
    { id: 'step_salary', label: 'Set salary range', icon: 'plus' },
  ],
  preferences: {
    availability: 'open_to_offers',
    // "Minimum salary — ₹24L" (Figma 1:2277).
    minSalary: { min: 2_400_000, currency: 'INR', period: 'year' },
    locations: ['Bengaluru'],
    remote: 'remote',
    language: 'en',
    // "Desired roles — 3 of 5" (Figma 1:2267).
    desiredRoles: ['Senior UX Designer', 'Senior Product Designer', 'Design Systems Lead'],
  },
};
