import { Image } from 'expo-image';
import { useState } from 'react';

import type { Resume } from '@/data/models';
import { pluralize } from '@/lib';
import { motion, useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';

import { tailorableResumes, tailorResumeMeta } from './tailorResumeMeta';

const TAILOR_KEY = 'tailor';
const PROFILE_KEY = 'profile';
const SCRATCH_KEY = 'scratch';
const UPLOAD_KEY = 'upload';
/** The art's box at 390: the web's method pictures, bare, no tile behind them (§238, §239). */
const ART = 60;
/** The first frame before the rows are measured; the sheet then hugs them (§240). */
const SHEET_HEIGHT = 420;

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

/** Every resume that can be tailored, newest first. */
export function resumesByRecent(resumes: readonly Resume[]): Resume[] {
  return tailorableResumes(resumes).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
  /** The library; Tailor is offered only once it has a resume. */
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
 * "From", the job step's one choice of how to make the resume (owner, 2026-11-19, §238, §239):
 * the web's four ways, one row each, with the web's own pictures and no tile behind them. Tailor
 * names the resume it will use; with more than one, it opens "Which resume?" in the same sheet.
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
  const { s } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const library = resumesByRecent(resumes ?? []);
  const current = library.find((r) => r.id === resumeId) ?? library[0];
  const close = () => {
    setChoosing(false);
    onClose();
  };

  if (choosing) {
    const options: SheetOption[] = library.map((resume) => ({
      key: resume.id,
      label: resume.title,
      caption: tailorResumeMeta(resume),
      leading: <MethodArt source={METHOD_ART.tailor} />,
    }));
    return (
      <OptionSheet
        open={open}
        onClose={close}
        height={s(SHEET_HEIGHT)}
        variant="card"
        title="Which resume?"
        options={options}
        selectedKey={current?.id ?? ''}
        onSelect={(key) => {
          close();
          onPick(key);
        }}
      />
    );
  }

  const options: SheetOption[] = [
    ...(current
      ? [
          {
            key: TAILOR_KEY,
            label: 'Tailor my resume',
            caption: library.length > 1 ? `${current.title} · or pick another` : current.title,
            leading: <MethodArt source={METHOD_ART.tailor} />,
          },
        ]
      : []),
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
      onClose={close}
      height={s(SHEET_HEIGHT)}
      variant="card"
      title="How should we create it?"
      options={options}
      selectedKey={scratch ? SCRATCH_KEY : resumeId ? TAILOR_KEY : PROFILE_KEY}
      onSelect={(key) => {
        if (key === TAILOR_KEY) {
          // One resume: that is the choice. More: say which, in the same sheet.
          if (library.length > 1) return setChoosing(true);
          close();
          return onPick(current!.id);
        }
        close();
        if (key === UPLOAD_KEY) onUpload();
        else if (key === SCRATCH_KEY) onScratch();
        else onPick(null);
      }}
    />
  );
}
