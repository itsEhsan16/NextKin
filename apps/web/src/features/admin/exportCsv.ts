import {
  ADMIN_GENERATION_KIND_LABEL,
  ADMIN_GENERATION_KINDS,
  ADMIN_RANGE_LABEL,
  ADMIN_ROLE_LABEL,
  type AdminActivity,
  type AdminOverview,
} from '@nextkin/shared/models';

import { maskTarget } from './format';

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: (string | number)[][]) =>
  rows.map((row) => row.map(cell).join(',')).join('\n');

/** Hands the browser a CSV to save. */
export function downloadCsv(name: string, rows: (string | number)[][]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The Overview's figures as rows of (section, measure, value): what is on screen for the window,
 * aggregates only, so the file carries no more than the page does. Panels the source doesn't
 * serve are left out rather than written as zeros.
 */
export function overviewRows(overview: AdminOverview): (string | number)[][] {
  const rows: (string | number)[][] = [['section', 'measure', 'value']];
  const window = ADMIN_RANGE_LABEL[overview.range];
  for (const kpi of overview.kpis) rows.push(['headline', kpi.key, kpi.value]);
  if (overview.generations) {
    for (const kind of ADMIN_GENERATION_KINDS) {
      const total = overview.generations.totals[kind];
      rows.push(['ai runs', `${ADMIN_GENERATION_KIND_LABEL[kind]} runs`, total.runs]);
      rows.push(['ai runs', `${ADMIN_GENERATION_KIND_LABEL[kind]} failed`, total.failed]);
    }
  }
  if (overview.aiCost) {
    for (const stage of overview.aiCost.stages) rows.push(['ai cost usd', stage.label, stage.usd]);
  }
  if (overview.subscriptions)
    rows.push(['subscriptions', 'active pro', overview.subscriptions.activePro]);
  if (overview.ats) {
    for (const bucket of overview.ats.buckets) {
      rows.push(['ats checks', `${bucket.from}-${bucket.to}`, bucket.count]);
    }
  }
  rows.push(['window', 'range', window]);
  return rows;
}

/** The audit rows on screen, with targets masked as the table shows them. */
export function activityRows(activity: AdminActivity[]): (string | number)[][] {
  return [
    ['time', 'staff', 'role', 'action', 'target', 'reason', 'result'],
    ...activity.map((row) => [
      row.at,
      row.staff.name,
      ADMIN_ROLE_LABEL[row.staff.role],
      row.action,
      maskTarget(row.target),
      row.reason,
      row.result,
    ]),
  ];
}
