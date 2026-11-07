import { classify, type AssistantTopic } from '@nextkin/shared/assistant/domain';

import type { AssistantMessage } from '@/data/models';
import type { LineIconName } from '@/ui/Icon';

/**
 * What the assistant offers to answer (owner, 2026-11-08, §188). Not a fixed list: the welcome
 * starts from what this person has (the resume in use and its score, the role they want), and
 * under a finished answer it offers the natural next questions on the same topic. Every prompt
 * here passes the topic check, so a tap never earns a refusal.
 */

export type StarterPrompt = { icon: LineIconName; prompt: string };

export type StarterInput = {
  /** The resume the answers will use, if any. */
  resumeTitle?: string;
  /** Its ATS score, once read. */
  score?: number;
  /** How many quick wins its score lists: none means nothing to ask about fixing. */
  quickWins?: number;
  /** The role they are after: from set-up, or the profile. */
  role?: string;
};

export function starterPrompts({
  resumeTitle,
  score,
  quickWins,
  role,
}: StarterInput): StarterPrompt[] {
  const prompts: StarterPrompt[] = [];
  if (resumeTitle) {
    prompts.push({
      icon: 'BarChart07',
      prompt:
        score != null ? `Why does my resume score ${score}?` : 'Why is my ATS score what it is?',
    });
    prompts.push(
      quickWins === 0
        ? { icon: 'Target', prompt: 'How do I tailor my resume to a job?' }
        : { icon: 'Target', prompt: 'Which quick wins should I fix first?' },
    );
  } else {
    prompts.push({ icon: 'File04', prompt: 'What makes a strong resume?' });
    prompts.push({ icon: 'ClockRewind', prompt: 'How do I explain a career gap?' });
  }
  prompts.push({
    icon: 'Lightbulb02',
    prompt: role ? `Which skills do ${role} roles ask for?` : 'Which skills should I learn next?',
  });
  prompts.push({
    icon: 'MessageChatSquare',
    prompt: 'How should I answer "tell me about yourself" in an interview?',
  });
  // A role that reads as off-topic (or trips a deny word) falls back rather than being refused.
  return prompts.map((item) =>
    classify(item.prompt).allowed ? item : { ...item, prompt: 'Which skills should I learn next?' },
  );
}

const FOLLOW_UPS: Record<AssistantTopic, readonly string[]> = {
  ats: [
    'Which quick wins should I fix first?',
    'How do keywords affect my score?',
    'How do I tailor my resume to a job?',
  ],
  resume: [
    'How do I write stronger bullets?',
    'Should my resume be one page?',
    'What should my resume summary say?',
  ],
  interview: [
    'How do I use the STAR method?',
    'Which interview questions should I practise?',
    'How do I answer salary questions in an interview?',
  ],
  job_search: [
    'How do I negotiate an offer?',
    'How do I follow up after applying?',
    'How do I get a referral for a job?',
  ],
  skills: [
    'Which skills should I learn next?',
    'How do I switch careers?',
    'Is a certification worth it for my career path?',
  ],
  product: [
    'How do I export my resume as a PDF?',
    'What does the Pro plan add?',
    'How does tailor work on NextKin?',
  ],
};

/**
 * The next questions under the latest answer: same topic as the question it answered, minus
 * anything already asked in this chat, and nothing about quick wins when there are none. None under
 * a refusal or a failed answer.
 */
export function followUps(
  messages: readonly AssistantMessage[],
  { max = 2, quickWins }: { max?: number; quickWins?: number } = {},
): string[] {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant' || last.status !== 'complete' || last.refusal) return [];
  const question = [...messages].reverse().find((message) => message.role === 'user');
  if (!question) return [];
  const verdict = classify(question.text);
  if (!verdict.allowed) return [];
  const asked = new Set(messages.map((message) => message.text.trim().toLowerCase()));
  return (
    FOLLOW_UPS[verdict.topic]
      .filter((prompt) => !asked.has(prompt.toLowerCase()))
      // Nothing to fix: never offer to talk about fixing it.
      .filter((prompt) => quickWins !== 0 || !/quick win/i.test(prompt))
      .slice(0, max)
  );
}

/** The answer as plain text, for Copy: the `**bold**` marks dropped. */
export const plainText = (text: string): string => text.replace(/\*\*(.+?)\*\*/g, '$1');
