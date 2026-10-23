import type { InterviewQuestion } from '../models/interview';

/**
 * NextKin V2 spec §7.15: the role-generic behavioural questions every interview reaches for, and
 * the size a set aims at. Phone-safe and mock-free: the mock's builder and the server's interview
 * stage pad a set from the same bank (P11-08).
 */

/**
 * The bank a set is padded from, and the whole of a standalone set. Role-generic on purpose —
 * these are the questions every interview reaches for, and none of them claims a skill.
 */
export const BEHAVIOURAL_BANK: readonly {
  prompt: string;
  answer: string;
  talkingPoints: string[];
}[] = [
  {
    prompt: 'Tell me about yourself.',
    answer:
      'Two minutes, present → past → future: what you do now and what you are known for, the one or two earlier chapters that explain how you got here, and why this role is the next step. It is not a biography — it is the frame for everything that follows.',
    talkingPoints: [
      'Present, past, future — in that order, and under two minutes.',
      'End on why this role, so the interviewer knows where to go next.',
    ],
  },
  {
    prompt: 'Describe a time you disagreed with a decision and what you did about it.',
    answer:
      'Pick a disagreement you handled well, not one you won. Say what the decision was, why you disagreed, how you made your case — with what evidence, to whom — and what happened. If you were overruled and it turned out fine, say that too; it shows you can commit to a call you argued against.',
    talkingPoints: [
      'A disagreement you handled well beats one you won.',
      'What evidence did you bring, and who did you bring it to?',
      'Show that you can commit after being overruled.',
    ],
  },
  {
    prompt: 'Tell me about a project that did not go to plan.',
    answer:
      'Choose something with real stakes, own your part of it plainly, and spend the answer on what you changed afterwards. Interviewers are not testing whether you have failed — everyone has — they are testing whether you noticed, and whether it stuck.',
    talkingPoints: [
      'Real stakes, and your own part owned plainly.',
      'The lasting change matters more than the failure.',
    ],
  },
  {
    prompt: 'How do you prioritise when everything is urgent?',
    answer:
      'Describe the mechanism you actually use — impact against effort, a weekly review, saying no in writing — and then give one concrete case where it decided something. A method with no example sounds borrowed.',
    talkingPoints: [
      'Name the mechanism, then show it deciding one real thing.',
      'Include a time you said no, and how you said it.',
    ],
  },
  {
    prompt: 'Why do you want to leave your current role?',
    answer:
      'Forward, not backward: talk about what you are moving towards, and keep anything about the current role factual and short. A grievance, however justified, is the one answer that costs you the room.',
    talkingPoints: [
      'What you are moving towards, not what you are escaping.',
      'Keep the current role factual and brief.',
    ],
  },
  {
    prompt: 'Where do you see this role taking you in two years?',
    answer:
      'Tie it to something the role actually offers. Growth into a broader remit, depth in the domain, leading others — whichever is true for you, and whichever this company can plausibly give. An ambition the role cannot serve reads as a short stay.',
    talkingPoints: [
      'An ambition this role can plausibly serve.',
      'Be specific enough that they can picture it.',
    ],
  },
  {
    prompt: 'What questions do you have for us?',
    answer:
      'Have three, and make at least one about the work rather than the perks: what a good first six months looks like, what the team is wrestling with now, how decisions like the one that led to this hire get made. Asking nothing reads as wanting nothing.',
    talkingPoints: [
      'Three questions, at least one about the work itself.',
      '"What does a good first six months look like?" is rarely a bad one.',
    ],
  },
  {
    prompt: 'Tell me about a time you had to learn something quickly.',
    answer:
      'Say what forced it, how you went about it — who you asked, what you read, what you built to learn by doing — and how you knew you had learned enough to ship. The method is the answer; the topic is incidental.',
    talkingPoints: [
      'The method you used, more than the topic you learned.',
      'How did you know you knew enough?',
    ],
  },
  {
    prompt: 'Tell me about a piece of feedback that changed how you work.',
    answer:
      'Choose feedback that stung a little and was right. Say who gave it and what they said, what you changed, and what you do differently to this day. The point is not the criticism — it is that you can hear it and act on it.',
    talkingPoints: [
      'Feedback that was hard to hear, and right.',
      'What you still do differently because of it.',
    ],
  },
  {
    prompt: 'Describe a time you worked with someone who was hard to work with.',
    answer:
      'Keep the other person human: describe the friction, not their character. Spend the answer on what you did to make the work go — a conversation, a changed process, a clearer agreement — and on how it ended. Blame, however deserved, is the wrong note.',
    talkingPoints: [
      'The friction, not the person’s character.',
      'What you changed to make the work go.',
    ],
  },
  {
    prompt: 'What are you most proud of in your career so far?',
    answer:
      'One thing, with its outcome and your part in it made plain. Say why it matters to you — that is the part they are listening for, because it tells them what you will care about here.',
    talkingPoints: [
      'One achievement, its outcome, your own part.',
      'Why it matters to you.',
    ],
  },
  {
    prompt: 'How do you handle a deadline you are going to miss?',
    answer:
      'Early and plainly: say when you would raise it, who you would tell, and what you would bring with the news — what can still ship, what it would take to ship the rest. Then give a real case, including what you learned about estimating.',
    talkingPoints: [
      'Raise it early, with options, not just the bad news.',
      'A real case, and what it taught you about estimates.',
    ],
  },
];

export const fromBank = (index: number, id: string): InterviewQuestion => {
  const entry = BEHAVIOURAL_BANK[index % BEHAVIOURAL_BANK.length];
  if (!entry) throw new Error('BEHAVIOURAL_BANK is empty');
  return {
    id,
    kind: 'behavioural',
    mark: 'unmarked',
    ...entry,
    talkingPoints: [...entry.talkingPoints],
  };
};

/** §7.15: "typically 10–20 items". The floor is what padding reaches for. */
export const INTERVIEW_SET_MIN = 10;
export const INTERVIEW_SET_MAX = 20;
