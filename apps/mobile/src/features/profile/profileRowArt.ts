import type { ListRowArt } from '@/ui/ListRow';

import AppearanceIcon from '../../../assets/icons/profile/appearance.svg';
import AvailabilityIcon from '../../../assets/icons/profile/availability.svg';
import CertificationsIcon from '../../../assets/icons/profile/certifications.svg';
import ContactUsIcon from '../../../assets/icons/profile/contact-us.svg';
import DeleteAccountDangerIcon from '../../../assets/icons/profile/delete-account-danger.svg';
import DeleteAccountIcon from '../../../assets/icons/profile/delete-account.svg';
import DesiredRolesIcon from '../../../assets/icons/profile/desired-roles.svg';
import EducationIcon from '../../../assets/icons/profile/education.svg';
import EmailPasswordIcon from '../../../assets/icons/profile/email-password.svg';
import ExportDataIcon from '../../../assets/icons/profile/export-data.svg';
import HelpFaqIcon from '../../../assets/icons/profile/help-faq.svg';
import LanguageIcon from '../../../assets/icons/profile/language.svg';
import LinksIcon from '../../../assets/icons/profile/links.svg';
import LocationsIcon from '../../../assets/icons/profile/locations.svg';
import MinSalaryIcon from '../../../assets/icons/profile/min-salary.svg';
import NotificationsIcon from '../../../assets/icons/profile/notifications.svg';
import PrivacyIcon from '../../../assets/icons/profile/privacy.svg';
import RateNextKinIcon from '../../../assets/icons/profile/rate-nextkin.svg';
import SkillsIcon from '../../../assets/icons/profile/skills.svg';
import TermsIcon from '../../../assets/icons/profile/terms.svg';
import WorkExperienceDangerIcon from '../../../assets/icons/profile/work-experience-danger.svg';
import WorkExperienceIcon from '../../../assets/icons/profile/work-experience.svg';

/**
 * The illustrated row icons of PROFILE 01/02 (Figma 399:5885 … 399:6338), each at its own drawn
 * size on the 390 board. They are not all the same shape, and none is stretched to match.
 */
export const PROFILE_ROW_ART = {
  experience: { Icon: WorkExperienceIcon, w: 36.0001, h: 21.3489 },
  education: { Icon: EducationIcon, w: 36, h: 22.5543 },
  skills: { Icon: SkillsIcon, w: 36.0001, h: 29.2979 },
  certifications: { Icon: CertificationsIcon, w: 36.0003, h: 23.7714 },
  links: { Icon: LinksIcon, w: 36, h: 23.8811 },
  desiredRoles: { Icon: DesiredRolesIcon, w: 36, h: 24.3047 },
  locations: { Icon: LocationsIcon, w: 36.0002, h: 26.1319 },
  minSalary: { Icon: MinSalaryIcon, w: 36, h: 27.1956 },
  availability: { Icon: AvailabilityIcon, w: 31.5897, h: 30.3448 },
  notifications: { Icon: NotificationsIcon, w: 35.9997, h: 27.9854 },
  appearance: { Icon: AppearanceIcon, w: 36, h: 22.6932 },
  language: { Icon: LanguageIcon, w: 36.0001, h: 21.9637 },
  help: { Icon: HelpFaqIcon, w: 36.0001, h: 21.6712 },
  contact: { Icon: ContactUsIcon, w: 36.0002, h: 21.472 },
  rate: { Icon: RateNextKinIcon, w: 36, h: 25.4554 },
  terms: { Icon: TermsIcon, w: 36, h: 22.5043 },
  privacy: { Icon: PrivacyIcon, w: 36, h: 26.1239 },
  emailPassword: { Icon: EmailPasswordIcon, w: 35.8315, h: 30.3449 },
  exportData: { Icon: ExportDataIcon, w: 36, h: 19.5687 },
  deleteAccount: { Icon: DeleteAccountIcon, w: 36.0001, h: 23.6661 },
} satisfies Record<string, ListRowArt>;

/**
 * The red-tinted versions a destructive confirm leads with (PROFILE 22 577:2330, PROFILE 24
 * 577:3383), drawn 72 wide at 390. Their own drawings, not the row icons recoloured.
 */
export const PROFILE_DANGER_ART = {
  deleteAccount: { Icon: DeleteAccountDangerIcon, w: 72, h: 47.3321 },
  experience: { Icon: WorkExperienceDangerIcon, w: 72, h: 42.6977 },
} satisfies Record<string, ListRowArt>;
