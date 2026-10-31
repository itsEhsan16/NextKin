import UploadIcon from '../../../../assets/icons/create/upload.svg';
import type { Resume } from '@/data/models';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';

import { ResumePageTile } from './BuildSourceRows';
import { tailorableResumes, tailorResumeMeta } from './tailorResumeMeta';

const PROFILE_KEY = 'profile';
const UPLOAD_KEY = 'upload';
const AVATAR = 34 / 0.75; // the foot row's avatar (652:71)
const UPLOAD_ICON_W = 36 / 0.75; // TAILOR 01's upload row (606:197)
const UPLOAD_ICON_H = 37.3472 / 0.75;
/** The owner's cut (2026-10-27): the two most recent resumes, then an upload. */
const LATEST = 2;

/** The two most recently updated resumes, keeping the picked one in view if it is older. */
export function latestResumes(resumes: readonly Resume[], pickedId: string | null): Resume[] {
  const byRecent = tailorableResumes(resumes).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const latest = byRecent.slice(0, LATEST);
  const picked = byRecent.find((resume) => resume.id === pickedId);
  if (picked && !latest.includes(picked)) latest[LATEST - 1] = picked;
  return latest;
}

export type BuildSourceSheetProps = {
  open: boolean;
  onClose: () => void;
  profile: { name: string; avatarUrl?: string; roles: number; skills: number };
  /** The library; the profile is offered alone while it loads or when it is empty. */
  resumes: readonly Resume[] | undefined;
  /** The picked resume's id, or null for the profile. */
  resumeId: string | null;
  onPick: (resumeId: string | null) => void;
  /** "Upload from your device": the sheet closes and the screen reads the file. */
  onUpload: () => void;
};

/**
 * "Build from" (toreview §139, spec-derived, no board): the profile — what the BUILD boards build
 * from — the two latest resumes, or a file from the device, in the card look of the PROFILE
 * option sheets. A resume
 * sends the job to Customize, the resume against the job, instead of BUILD 04b.
 */
export function BuildSourceSheet({
  open,
  onClose,
  profile,
  resumes,
  resumeId,
  onPick,
  onUpload,
}: BuildSourceSheetProps) {
  const { s } = useTheme();
  const options: SheetOption[] = [
    {
      key: PROFILE_KEY,
      label: 'Your profile',
      caption: `${pluralize(profile.roles, 'role')}, ${pluralize(profile.skills, 'skill')} · A fresh resume`,
      leading: <Avatar source={profile.avatarUrl} name={profile.name} size={s(AVATAR)} />,
    },
    ...latestResumes(resumes ?? [], resumeId).map((resume) => ({
      key: resume.id,
      label: resume.title,
      caption: tailorResumeMeta(resume),
      leading: <ResumePageTile />,
    })),
    {
      key: UPLOAD_KEY,
      label: 'Upload from your device',
      caption: 'PDF or DOCX',
      leading: <UploadIcon width={s(UPLOAD_ICON_W)} height={s(UPLOAD_ICON_H)} />,
    },
  ];

  return (
    <OptionSheet
      open={open}
      onClose={onClose}
      variant="card"
      title="Build from"
      options={options}
      selectedKey={resumeId ?? PROFILE_KEY}
      onSelect={(key) => {
        onClose();
        if (key === UPLOAD_KEY) onUpload();
        else onPick(key === PROFILE_KEY ? null : key);
      }}
      footnote="A resume is matched to the job before anything is written."
    />
  );
}
