import type { Job } from '@nextkin/shared/models/job';

/** One listing of the local fixture catalogue, with times relative to when it is served. */
export interface FixtureListing {
  id: string;
  title: string;
  company: string;
  logoKey?: string;
  location: string;
  country: string;
  remote: Job['remote'];
  employmentType: Job['employmentType'];
  experienceLevel: Job['experienceLevel'];
  experienceYears?: { min: number; max: number };
  reference?: string;
  applicantsCount?: number;
  salary?: NonNullable<Job['salary']>;
  postedAgoHours: number;
  closingInHours?: number;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits?: string[];
  perks?: string[];
  industries?: string[];
  tags: string[];
  companyIndustry: string;
  companySize: string;
  companyWebsite: string;
  companyAbout?: string;
  companyFounded?: number;
  companyHeadquarters?: string;
  applyUrl?: string;
}
