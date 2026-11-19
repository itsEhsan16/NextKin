import { Image } from 'expo-image';

import type { Resume } from '@/data/models';
import { pluralize } from '@/lib';
import { motion, useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';

import { tailorableResumes, tailorResumeMeta } from './tailorResumeMeta';

const PROFILE_KEY = 'profile';
const SCRATCH_KEY = 'scratch';
const UPLOAD_KEY = 'upload';
/** The owner's cut (2026-10-27): the two most recent resumes. */
const LATEST = 2;
/** The art's box at 390: the web's method pictures, bare, no tile behind them (§238). */
const ART = 44;

/**
 * The web's method pictures (`apps/web/src/features/tailor/flow/methods.ts` METHOD_ART), copied
 * into the app so both say "tailor", "profile", "scratch" and "upload" with the same drawing.
 */
export const METHOD_ART = {
  tailor: require('../../../../assets/illustrations/methods/profile.webp'),
  profile: require('../../../../assets/illustrations/methods/build.webp'),
  zero: require('../../../../assets/illustrations/methods/zero.webp'),
  upload: require('../../../../assets/illustrations/methods/upload.webp'),
} as const;

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

function MethodArt({ source }: { source: number }) {
  const { s } = useTheme();
  return (
    <Image
      source={source}
      style={{ width: s(ART), height: s(ART) }}
      contentFit="contain"
      accessible={false}
      cachePolicy="memory"
      transition={motion.durations.imageFade}
    />
  );
}

export type BuildSourceSheetProps = {
  open: boolean;
  onClose: () => void;
  profile: { name: string; avatarUrl?: string; roles: number; skills: number };
  /** The library; only the other ways are offered while it loads or when it is empty. */
  resumes: readonly Resume[] | undefined;
  /** The picked resume's id, or null for the profile. */
  resumeId: string | null;
  /** "Start from scratch with AI" is the pick. */
  scratch?: boolean;
  onPick: (resumeId: string | null) => void;
  onScratch: () => void;
  /** "Upload a resume": the sheet closes and the screen reads the file. */
  onUpload: () => void;
};

/**
 * "From", the job step's one choice of how to make the resume (owner, 2026-11-19, toreview §238):
 * the web's four ways — tailor a resume (the two latest), create from the profile, start from
 * scratch with AI, upload one — each with the web's own picture and no tile behind it. Replaces
 * the separate method screen, which asked the same thing a second time.
 */
export function BuildSourceSheet({
  open,
  onClose,
  profile,
  resumes,
  resumeId,
  scratch = false,
  onPick,
  onScratch,
  onUpload,
}: BuildSourceSheetProps) {
  const options: SheetOption[] = [
    ...latestResumes(resumes ?? [], resumeId).map((resume) => ({
      key: resume.id,
      label: `Tailor “${resume.title}”`,
      caption: tailorResumeMeta(resume),
      leading: <MethodArt source={METHOD_ART.tailor} />,
    })),
    {
      key: PROFILE_KEY,
      label: 'Create from my profile',
      caption:
        profile.roles > 0
          ? `${pluralize(profile.roles, 'role')}, ${pluralize(profile.skills, 'skill')} · A fresh resume`
          : 'Add a role to your profile first',
      leading: <MethodArt source={METHOD_ART.profile} />,
    },
    {
      key: SCRATCH_KEY,
      label: 'Start from scratch with AI',
      caption: 'Answer three questions, AI writes a first draft',
      leading: <MethodArt source={METHOD_ART.zero} />,
    },
    {
      key: UPLOAD_KEY,
      label: 'Upload a resume',
      caption: 'PDF or DOCX, tailored to this job',
      leading: <MethodArt source={METHOD_ART.upload} />,
    },
  ];

  return (
    <OptionSheet
      open={open}
      onClose={onClose}
      variant="card"
      title="How should we create it?"
      options={options}
      selectedKey={scratch ? SCRATCH_KEY : (resumeId ?? PROFILE_KEY)}
      onSelect={(key) => {
        onClose();
        if (key === UPLOAD_KEY) onUpload();
        else if (key === SCRATCH_KEY) onScratch();
        else onPick(key === PROFILE_KEY ? null : key);
      }}
    />
  );
}
