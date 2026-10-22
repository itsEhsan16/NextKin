import { SEPARATOR, type RenderModel } from './model';

/**
 * TXT export (ImBackendImplementationPlan P10-05; V2 §7.12): the same render model as plain text,
 * for a portal's paste box. Deterministic section order, a blank line between sections, bullets
 * as "- ", UTF-8.
 */
export function renderTxt(model: RenderModel): Uint8Array {
  const lines: string[] = [model.name];
  if (model.headline) lines.push(model.headline);
  if (model.contact.length) lines.push(model.contact.join(SEPARATOR));
  for (const section of model.sections) {
    lines.push('');
    if (section.heading) lines.push(section.heading.toUpperCase());
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') {
        lines.push(block.text);
        continue;
      }
      lines.push(block.title);
      if (block.subtitle) lines.push(block.subtitle);
      if (block.meta) lines.push(block.meta);
      lines.push(...block.bullets.map((b) => `- ${b}`));
    }
  }
  return new TextEncoder().encode(`${lines.join('\n')}\n`);
}
