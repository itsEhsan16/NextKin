import { mentionsIn, resolveSkill, type Taxonomy } from './normalizer';
import { phraseKey } from './text';

/**
 * The phrases a user chose to leave out of a tailored resume (toreview §110.3): the missing
 * keywords they did not tick. A generated claim that names one is a hard violation whatever the
 * facts say, because the user was asked and said no. A phrase matches by canonical skill when the
 * taxonomy knows it ("k8s" names Kubernetes), and otherwise as whole words ("stakeholder
 * management"), so practices and domains the technology check ignores are caught too.
 */
export function leftOutChecker(taxonomy: Taxonomy, phrases: readonly string[]): (text: string) => string[] {
  const wanted = phrases
    .map((phrase) => ({ phrase, key: phraseKey(phrase), skill: resolveSkill(taxonomy, phrase) }))
    .filter((p) => p.key);
  if (wanted.length === 0) return () => [];
  return (text) => {
    const words = ` ${phraseKey(text)} `;
    const named = new Set(mentionsIn(taxonomy, text).map((m) => m.skillId));
    return wanted.filter((p) => (p.skill.known && named.has(p.skill.id)) || words.includes(` ${p.key} `)).map((p) => p.phrase);
  };
}
