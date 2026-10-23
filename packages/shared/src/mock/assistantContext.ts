import type { AtsBand, AtsScore, DocumentContent, Resume } from '@/data/models';
import { atsQuickWins } from '@/data/models';

/**
 * NextKin V2 spec §7.16 — what the assistant is allowed to know about the document it was opened
 * from, and §8.5 — what it must never be handed.
 *
 * The PII rule is structural, not procedural: this type has no field that could hold an email,
 * a phone number or an address, so the context builder cannot leak one by mistake. The one
 * borderline field on a document, `ResumeContent.links`, is excluded entirely — a `mailto:` would
 * qualify — and section bodies are never included, only their names. The real API receives this
 * same shape, which is the point of building it here.
 */
export type AssistantContext = {
  documentTitle: string;
  targetRole?: string;
  targetCompany?: string;
  score?: number;
  band?: AtsBand;
  /** Up to three quick wins, label plus what to do about it. */
  quickWins: { label: string; suggestion?: string }[];
  /** JD keywords nothing on the profile backs — named as gaps, never as text to paste (§7.8). */
  gaps: string[];
  /** Section NAMES only. Never bullet text, never dates, never links. */
  sections: string[];
};

const MAX_QUICK_WINS = 3;

export function buildAssistantContext(input: {
  resume: Resume;
  content?: DocumentContent;
  score?: AtsScore;
}): AssistantContext {
  const { resume, content, score } = input;
  const sections: string[] = [];
  if (content?.kind === 'resume') {
    if (content.summary) sections.push('summary');
    if (content.skills.length) sections.push('skills');
    if (content.experience.length) sections.push('experience');
    if (content.projects.length) sections.push('projects');
    if (content.certifications.length) sections.push('certifications');
    if (content.education.length) sections.push('education');
  } else if (content?.kind === 'cover_letter') {
    sections.push('letter');
  }

  const gaps = score
    ? score.sections
        .flatMap((section) => section.items)
        .filter((item) => item.supported === false)
        .map((item) => /"([^"]+)"/.exec(item.label)?.[1] ?? item.label)
    : [];

  return {
    documentTitle: resume.title,
    ...(resume.targetRole ? { targetRole: resume.targetRole } : {}),
    ...(resume.targetCompany ? { targetCompany: resume.targetCompany } : {}),
    ...(score ? { score: score.total, band: score.band } : {}),
    quickWins: score
      ? atsQuickWins(score)
          .slice(0, MAX_QUICK_WINS)
          .map((item) => ({
            label: item.label,
            ...(item.suggestion ? { suggestion: item.suggestion } : {}),
          }))
      : [],
    gaps,
    sections,
  };
}
