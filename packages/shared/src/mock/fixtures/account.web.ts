import type { Profile, User } from "../../models";

import { profileFixture } from "./profile";
import { userFixture } from "./user";

/**
 * The Account board's George (Figma 307:3443): what the store seeds instead of `userFixture` and
 * `profileFixture` once a host calls `configureMockPlatform('web')` (`mock/platform.ts`). Mobile
 * keeps its own.
 *
 * The Account board (307:3443) drew a UX designer four years in with no roles. Its redraw as the
 * Profile page (476:4) lists two, at Google and Figma, while still printing "Current company: Not
 * specified" and an unticked "Add work experience"; the page reads both off these roles instead,
 * so they say Google and ticked (`toreview.md` §91). The web résumés (`resumes.web.ts`) tell the
 * same years as a software engineer's; each page keeps its own board's words (§20).
 *
 * The Settings board (254:326) draws a Priya Sharma instead. By your call it shows this account,
 * the one every other page shows, and takes only its "Verified" from that board (`toreview.md` §21).
 */
export const webUserFixture: User = {
  ...userFixture,
  email: "george.smith@gmail.com",
  emailVerified: true,
};

export const webProfileFixture: Profile = {
  ...profileFixture,
  headline: "UX Designer",
  location: "Bengaluru, India",
  yearsExperience: 4,
  phone: "+91 98765 43210",
  // 307:3582 and 307:3563, verbatim.
  bio: "Passionate UX Designer with 4+ years of experience creating user-centered digital experiences. Skilled in product design, user research, and design systems. Always excited to solve real-world problems through design.",
  tagline: "Designing human experiences for a better tomorrow.",
  // "Link your LinkedIn" is unticked on the board while the URL is listed: the integration isn't
  // connected, which is the Integrations tab's business.
  linkedinConnected: false,
  // The Profile board's ten skills (476:893): seven drawn, then "+3". The last three are ours.
  skills: [
    "UI/UX Design",
    "Figma",
    "User Research",
    "Design Systems",
    "Prototyping",
    "Product Strategy",
    "Usability Testing",
    "Wireframing",
    "Interaction Design",
    "Accessibility",
  ],
  // 476:694 and 476:703, verbatim.
  experiences: [
    {
      id: "exp_web_google",
      company: "Google",
      title: "Senior Product Designer",
      startDate: "2022-01-01",
      current: true,
      skills: ["Design Systems", "Prototyping"],
      summary:
        "Leading the design of AI-powered tools used by millions of users.",
    },
    {
      id: "exp_web_figma",
      company: "Figma",
      title: "Product Designer",
      startDate: "2020-06-01",
      endDate: "2021-12-31",
      current: false,
      skills: ["Figma", "User Research"],
      summary: "Designed collaborative features for Figma's web platform.",
    },
  ],
  education: [
    {
      id: "edu_web_btech",
      institution: "Anna University",
      degree: "B.Tech",
      field: "Design",
      startDate: "2016-07-01",
      endDate: "2020-05-31",
      current: false,
    },
  ],
  links: [
    {
      id: "link_linkedin",
      label: "LinkedIn",
      url: "https://linkedin.com/in/georgesmith",
      kind: "linkedin",
    },
    {
      id: "link_website",
      label: "Website",
      url: "https://georgesmith.design",
      kind: "website",
    },
  ],
  // The ring's figure (307:3697): the profile's own score, as mobile's 72% is.
  completeness: 0.8,
  preferences: {
    ...profileFixture.preferences,
    // The Profile board's "Desired role" (476:957).
    desiredRoles: ["Product Designer"],
    // Full-time and Hybrid are the Account board's "Full-time, Hybrid" (307:3650). The places, the
    // industries and ₹12,00,000 a year are Settings → Preferences' (356:50-84); mobile's George
    // asks ₹24L (`toreview.md` §22).
    locations: ["Bengaluru, India", "Remote", "New York, USA"],
    remote: "hybrid",
    employmentTypes: ["full_time"],
    industries: ["Technology", "Product", "Design"],
    minSalary: { min: 1_200_000, currency: "INR", period: "year" },
  },
};
