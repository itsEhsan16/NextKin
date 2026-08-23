import type { Profile } from '@/data/models';

import { USER_ID } from './user';

export const profileFixture: Profile = {
  userId: USER_ID,
  headline: 'Senior Product Designer',
  location: 'Austin, TX',
  yearsExperience: 8,
  skills: ['Figma', 'Design systems', 'Prototyping', 'User research', 'Accessibility'],
  experiences: [
    {
      id: 'exp_1',
      company: 'Lumen Labs',
      title: 'Senior Product Designer',
      startDate: '2022-03-01',
      current: true,
      skills: ['Design systems', 'Figma', 'Mobile UX'],
    },
    {
      id: 'exp_2',
      company: 'Northwind Health',
      title: 'Product Designer',
      startDate: '2019-06-01',
      endDate: '2022-02-28',
      current: false,
      skills: ['User research', 'Prototyping', 'Healthcare UX'],
    },
    {
      id: 'exp_3',
      company: 'Brightline Studio',
      title: 'UI Designer',
      startDate: '2017-01-15',
      endDate: '2019-05-31',
      current: false,
      skills: ['Visual design', 'Branding', 'Web'],
    },
  ],
  education: [
    {
      id: 'edu_1',
      institution: 'University of Texas at Austin',
      degree: 'B.F.A.',
      field: 'Design',
      startDate: '2012-09-01',
      endDate: '2016-05-31',
      current: false,
    },
  ],
  completeness: 0.72,
  nextSteps: [
    { id: 'step_skills', label: 'Add skills', icon: 'sparkles-outline' },
    { id: 'step_salary', label: 'Set salary range', icon: 'cash-outline' },
  ],
  preferences: {
    availability: '2_weeks',
    minSalary: undefined,
    locations: ['Austin, TX', 'Remote'],
    remote: 'any',
    language: 'en',
  },
};
