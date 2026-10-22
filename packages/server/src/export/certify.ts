import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import { resumeModel, type RenderModel } from './model';
import { parseBack, type ParseBackResult } from './parseBack';
import { renderDocx } from './renderDocx';
import type { PdfRenderer } from './renderPdf';
import { renderTxt } from './renderTxt';
import type { ExportTemplate } from './templates';

/**
 * Template certification (ImBackendImplementationPlan P10-06, P10-12). A template is published
 * only when a full-length synthetic resume, rendered through it, reads back with zero section loss
 * in all three formats, and its design claims ATS-safe. The two-column test template must fail.
 */

/** Synthetic (L4): every section filled, long enough to wrap and to run onto a second page. */
export const CERTIFICATION_RESUME: CanonicalResumeJson = {
  schemaVersion: 1,
  headline: 'Senior Backend Engineer',
  summary: { id: 's', text: 'Backend engineer with eight years building payment and ledger systems in Go and PostgreSQL, from first design to on-call, for teams that ship weekly and measure everything they run in production.', evidence: ['r1#d'], origin: 'generated' },
  skills: ['Go', 'PostgreSQL', 'Kafka', 'Kubernetes', 'Terraform', 'gRPC', 'Python', 'Redis', 'AWS', 'Observability'].map((name, i) => ({ id: `k${i}`, name, evidence: ['r1'], origin: 'generated' as const })),
  roles: [1, 2, 3].map((n) => ({
    roleId: `r${n}`,
    company: ['Acme Pay', 'Northwind Logistics', 'Contoso Retail'][n - 1]!,
    title: ['Senior Backend Engineer', 'Backend Engineer', 'Software Engineer'][n - 1]!,
    start: ['2021-03', '2018-06', '2016-01'][n - 1]!,
    end: [null, '2021-02', '2018-05'][n - 1]!,
    location: ['Berlin, Germany', 'Hamburg, Germany', 'Remote'][n - 1]!,
    skills: ['Go', 'PostgreSQL'],
    bullets: [0, 1, 2, 3].map((b) => ({ id: `b${n}-${b}`, text: `Role ${n} result ${b + 1}: rebuilt the settlement pipeline so reconciliation that used to take three days now finishes in four hours, with every adjustment traced to its source event.`, evidence: [`r${n}#r${b}`], origin: 'generated' as const })),
  })),
  education: [{ factId: 'e1', institution: 'Technische Universität Berlin', degree: 'BSc', field: 'Computer Science', start: '2012', end: '2015' }],
  certifications: [{ factId: 'c1', name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services' }],
  projects: [{ factId: 'p1', name: 'Open-source ledger toolkit', description: 'A double-entry library used by three fintech teams', bullets: [{ id: 'pb0', text: 'Wrote the reconciliation engine and its property-based tests.', evidence: ['p1'], origin: 'generated' }] }],
};

export interface Certification {
  template: string;
  certified: boolean;
  results: Record<'pdf' | 'docx' | 'txt', ParseBackResult>;
}

export async function certifyTemplate(template: ExportTemplate, pdf: PdfRenderer, model: RenderModel = resumeModel(CERTIFICATION_RESUME, { name: 'Alex Example', email: 'alex@example.com', phone: '+49 30 0000000', location: 'Berlin, Germany' })): Promise<Certification> {
  const [pdfBytes, docxBytes] = await Promise.all([pdf.render(template.html(model), new Date('2026-01-01T00:00:00Z')), renderDocx(model)]);
  const results = {
    pdf: await parseBack(model, 'pdf', pdfBytes),
    docx: await parseBack(model, 'docx', docxBytes),
    txt: await parseBack(model, 'txt', renderTxt(model)),
  };
  return { template: template.slug, certified: template.atsSafe && results.pdf.ok && results.docx.ok && results.txt.ok, results };
}
