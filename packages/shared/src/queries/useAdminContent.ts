import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PromptEditorTab, TechnologyInput, TemplateStatus } from '../models/adminContent';
import { repos } from '../repos';
import type { SkillQuery, TechnologyQuery } from '../repos/adminContentRepo';

/**
 * Query hooks for the admin portal's Content area (Figma 406:662–410:1771): prompts and their
 * versions, the technology KB and its review queue, skills and aliases, templates, the ATS rubric.
 * Keys live here (`['admin', 'content', ...]`), so `qk.admin.all` still sweeps them. Every write
 * refreshes the whole area: its screens share figures (a decided change moves the KB's counts and
 * the sidebar's queue), and the lists are small.
 */
const key = {
  all: ['admin', 'content'] as const,
  prompts: () => ['admin', 'content', 'prompts'] as const,
  prompt: (name: string) => ['admin', 'content', 'prompt', name] as const,
  kbStats: () => ['admin', 'content', 'kb-stats'] as const,
  technologies: (q: TechnologyQuery) => ['admin', 'content', 'technologies', q] as const,
  kbQueue: () => ['admin', 'content', 'kb-queue'] as const,
  skillsOverview: () => ['admin', 'content', 'skills-overview'] as const,
  skills: (q: SkillQuery) => ['admin', 'content', 'skills', q] as const,
  templates: () => ['admin', 'content', 'templates'] as const,
  rubric: () => ['admin', 'content', 'rubric'] as const,
};

export { key as adminContentKeys };

/** A write that refreshes the area (and the sidebar's queue counts) when it lands. */
function useContentMutation<A, R>(run: (args: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key.all }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'queues'] }),
      ]);
    },
  });
}

// --- AI prompts ----------------------------------------------------------------------------------

export function useAdminPrompts() {
  return useQuery({ queryKey: key.prompts(), queryFn: () => repos.adminContent.listPrompts() });
}

export function useAdminPrompt(name: string) {
  return useQuery({
    queryKey: key.prompt(name),
    queryFn: () => repos.adminContent.getPrompt(name),
  });
}

export function useCreatePromptDraft() {
  return useContentMutation((name: string) => repos.adminContent.createPromptDraft(name));
}

export function useSavePromptDraft(name: string) {
  return useContentMutation((edit: { tab: PromptEditorTab; text: string } | { note: string }) =>
    repos.adminContent.savePromptDraft(name, edit),
  );
}

export function useEvaluatePrompt(name: string) {
  return useContentMutation((version: number) => repos.adminContent.evaluatePrompt(name, version));
}

export function usePublishPrompt(name: string) {
  return useContentMutation((version: number) => repos.adminContent.publishPrompt(name, version));
}

export function useRollbackPrompt(name: string) {
  return useContentMutation((version: number) => repos.adminContent.rollbackPrompt(name, version));
}

/** Runs the draft on a seeded sample; nothing a real user sees is touched. */
export function useRunSandbox(name: string) {
  return useMutation({
    mutationFn: (sample: { resumeId: string; jobId: string }) =>
      repos.adminContent.runSandbox(name, sample),
  });
}

// --- Technology KB ------------------------------------------------------------------------------

export function useKbStats() {
  return useQuery({ queryKey: key.kbStats(), queryFn: () => repos.adminContent.kbStats() });
}

export function useTechnologies(query: TechnologyQuery) {
  return useQuery({
    queryKey: key.technologies(query),
    queryFn: () => repos.adminContent.listTechnologies(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * A KB write. The refresh isn't awaited: the dialog closes, or shows its error, as soon as the write
 * answers, and the lists catch up behind it.
 */
function useKbMutation<A, R>(run: (args: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key.all });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'queues'] });
    },
  });
}

export function useSaveTechnology() {
  return useKbMutation(({ input, id }: { input: TechnologyInput; id?: string }) =>
    repos.adminContent.saveTechnology(input, id),
  );
}

export function useImportTechnologies() {
  return useKbMutation((file: { format: 'csv' | 'json'; content: string }) =>
    repos.adminContent.importTechnologies(file),
  );
}

export function useKbQueue() {
  return useQuery({ queryKey: key.kbQueue(), queryFn: () => repos.adminContent.kbQueue() });
}

export function useDecideChange() {
  return useKbMutation(({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
    repos.adminContent.decideChange(id, decision),
  );
}

/** `source` cites the change (a URL, or `null` to drop it); left out, the source stays. */
export function useEditChange() {
  return useKbMutation(
    ({
      id,
      fields,
      source,
    }: {
      id: string;
      fields: { field: string; to: string }[];
      source?: string | null;
    }) => repos.adminContent.editChange(id, fields, source),
  );
}

// --- Skills & aliases ---------------------------------------------------------------------------

export function useSkillsOverview() {
  return useQuery({
    queryKey: key.skillsOverview(),
    queryFn: () => repos.adminContent.skillsOverview(),
  });
}

export function useSkills(query: SkillQuery) {
  return useQuery({
    queryKey: key.skills(query),
    queryFn: () => repos.adminContent.listSkills(query),
    placeholderData: keepPreviousData,
  });
}

export function useAddSkill() {
  return useContentMutation(
    (input: { name: string; categoryId: string; parent: string; aliases: string[] }) =>
      repos.adminContent.addSkill(input),
  );
}

export function useSetAliases() {
  return useContentMutation(({ skillId, aliases }: { skillId: string; aliases: string[] }) =>
    repos.adminContent.setAliases(skillId, aliases),
  );
}

export function useMapTerm() {
  return useContentMutation(({ term, skillId }: { term: string; skillId: string }) =>
    repos.adminContent.mapTerm(term, skillId),
  );
}

export function useResolveMerge() {
  return useContentMutation(({ id, decision }: { id: string; decision: 'merge' | 'dismiss' }) =>
    repos.adminContent.resolveMerge(id, decision),
  );
}

export function useAddCategory() {
  return useContentMutation((name: string) => repos.adminContent.addCategory(name));
}

// --- Templates ----------------------------------------------------------------------------------

export function useAdminTemplates() {
  return useQuery({ queryKey: key.templates(), queryFn: () => repos.adminContent.listTemplates() });
}

export function useSetTemplateStatus() {
  return useContentMutation(({ slug, status }: { slug: string; status: TemplateStatus }) =>
    repos.adminContent.setTemplateStatus(slug, status),
  );
}

export function useCreateTemplate() {
  return useContentMutation((input: { name: string; basedOn: string }) =>
    repos.adminContent.createTemplate(input),
  );
}

// --- ATS rubric ---------------------------------------------------------------------------------

export function useAdminRubric() {
  return useQuery({ queryKey: key.rubric(), queryFn: () => repos.adminContent.rubric() });
}

export function usePublishRubric() {
  return useContentMutation((version: number) => repos.adminContent.publishRubric(version));
}

export function useSaveRationale() {
  return useContentMutation((paragraphs: string[]) => repos.adminContent.saveRationale(paragraphs));
}
