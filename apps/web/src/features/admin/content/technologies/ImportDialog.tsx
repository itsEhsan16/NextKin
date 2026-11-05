'use client';

import { useState } from 'react';

import type { KbImportResult } from '@nextkin/shared/models';
import { useImportTechnologies } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup, TextArea } from '../../ui/AdminForm';
import { errorMessage } from '../format';

const CSV_SAMPLE = 'name,category,aliases,latest_version,release_date,source';

/**
 * Bulk import (Figma 409:1872 "Import CSV / JSON", P12-04): paste or load a CSV or JSON file;
 * valid rows go to the review queue, and each invalid row is listed with what's wrong with it.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const run = useImportTechnologies();
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<KbImportResult | null>(null);

  const reset = (next: boolean) => {
    if (!next) {
      setContent('');
      setResult(null);
    }
    onOpenChange(next);
  };

  return (
    <AdminDialog
      open={open}
      onOpenChange={reset}
      icon="UploadCloud02"
      tone="brand"
      width="lg"
      title="Import technologies"
      description="Valid rows go to the review queue. Invalid rows are listed with the reason, and nothing from them is imported."
      {...(result
        ? {}
        : {
            confirm: {
              label: 'Import',
              disabled: !content.trim(),
              busy: run.isPending,
              onConfirm: () =>
                run.mutate(
                  { format, content },
                  {
                    onSuccess: (r) => {
                      setResult(r);
                      showToast(
                        r.imported
                          ? `${r.imported} imported${r.failed.length ? ` · ${r.failed.length} not imported` : ''}`
                          : 'Nothing imported',
                        { tone: r.imported ? 'success' : 'error' },
                      );
                    },
                    onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
                  },
                ),
            },
          })}
    >
      {result ? (
        <div className="flex flex-col gap-4" aria-live="polite">
          {result.imported > 0 ? (
            <p className="flex items-center gap-2 text-body-m font-semibold text-text-primary">
              <AdminIcon name="CheckCircle" className="text-success-600" />
              {result.imported} {result.imported === 1 ? 'row' : 'rows'} sent to the review queue
            </p>
          ) : (
            <p className="flex items-center gap-2 text-body-m font-semibold text-text-primary">
              <AdminIcon name="AlertTriangle" className="text-warning-600" />
              Nothing was imported
            </p>
          )}
          {result.failed.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-body-s font-medium text-neutral-700">
                {result.failed.length} not imported
              </p>
              <ul className="flex max-h-[240px] flex-col overflow-y-auto rounded-md border border-neutral-200">
                {result.failed.map((row) => (
                  <li
                    key={row.row}
                    className="flex gap-3 border-b border-neutral-100 px-3.5 py-2.5 text-body-s last:border-b-0"
                  >
                    <span className="w-14 shrink-0 font-medium text-text-primary">
                      Row {row.row}
                    </span>
                    <span className="text-danger-600">{row.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <RadioCardGroup
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              {
                id: 'csv',
                label: 'CSV',
                description: `Header row: ${CSV_SAMPLE}. Separate aliases in a cell with ; or |.`,
              },
              {
                id: 'json',
                label: 'JSON',
                description:
                  'An array of objects with the same keys as the CSV header; aliases can be a list.',
              },
            ]}
          />
          <label className="flex w-fit cursor-pointer items-center gap-2 text-body-s font-semibold text-brand-700 hover:text-brand-600 has-focus-visible:outline-2 has-focus-visible:outline-brand-600">
            <AdminIcon name="UploadCloud02" size="sm" />
            Load a file
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFormat(file.name.endsWith('.json') ? 'json' : 'csv');
                setContent(await file.text());
              }}
            />
          </label>
          <TextArea
            label="Or paste the rows"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              format === 'csv'
                ? `${CSV_SAMPLE}\nBun,JavaScript runtime,bunjs,1.1,2024-04-01,https://bun.sh/blog/bun-v1.1`
                : '[{ "name": "Bun", "category": "JavaScript runtime" }]'
            }
            className="min-h-[160px] font-mono text-body-s"
          />
        </div>
      )}
    </AdminDialog>
  );
}
