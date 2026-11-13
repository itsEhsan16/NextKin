import { useId, useState, type DragEvent } from 'react';

import { cn } from '@/lib/cn';
import { DocumentsIcon } from '@/ui/icons';
import { UploadResumeFileIllustration } from '@/ui/illustrations';

import { RESUME_INPUT_ACCEPT } from '../resumeUpload';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

/**
 * ONB 04b's dashed drop zone (814:353): the upload art, "Drag and drop your resume here", Browse
 * files and "PDF or DOCX". The whole zone is the file input's label, as on Upload a JD's
 * `FileDropZone`, so a click anywhere opens the picker and a drop anywhere takes the file. The
 * zone turns full brand while a file is dragged over it. `compact` is one row, for a dialog (the
 * tailor dialog's upload, toreview §110.4): the same input, without the art.
 */
export function ResumeDropZone({
  onFile,
  disabled = false,
  compact = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputId = useId();
  const hintId = useId();

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        compact
          ? 'flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left transition-colors duration-press ease-standard'
          : 'flex flex-col items-center rounded-xl border border-dashed px-6 pb-5 pt-6 text-center transition-colors duration-press ease-standard',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600',
        disabled ? 'cursor-default' : 'cursor-pointer',
        over
          ? 'border-brand-600 bg-surface-brand-strong'
          : 'border-border-brand-strong bg-surface-brand hover:bg-surface-brand-strong',
      )}
    >
      {compact ? (
        <>
          <UploadResumeFileIllustration aria-hidden className="h-auto w-9 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-body-m font-semibold text-text-primary">
              Upload a resume from your computer
            </span>
            <span id={hintId} className="block text-body-s text-text-tertiary">
              Drop it here or browse · PDF or DOCX
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              BUTTON_VARIANT['brand-secondary'],
              'h-control-md shrink-0 gap-2 rounded-md border-brand-600 px-3.5 text-body-m font-semibold',
            )}
          >
            <DocumentsIcon className="size-4" />
            Browse
          </span>
        </>
      ) : (
        <>
          <UploadResumeFileIllustration aria-hidden className="h-auto w-16" />
          <span className="mt-3 text-title-l text-text-primary">
            Drag and drop your resume here
          </span>
          <span className="mt-1 text-body-s font-medium text-text-tertiary">or</span>
          <span
            aria-hidden
            className={cn(
              BUTTON_VARIANT['brand-secondary'],
              'mt-2 h-control-md gap-2 rounded-md border-brand-600 px-4 text-body-l font-semibold',
            )}
          >
            <DocumentsIcon className="size-4" />
            Browse files
          </span>
          <span id={hintId} className="mt-3 text-body-s font-medium text-text-tertiary">
            PDF or DOCX
          </span>
        </>
      )}
      <input
        id={inputId}
        type="file"
        accept={RESUME_INPUT_ACCEPT}
        aria-label="Resume file"
        aria-describedby={hintId}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Cleared, so picking the same file again still fires a change.
          event.target.value = '';
        }}
      />
    </label>
  );
}
